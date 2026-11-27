// Response caching for safe (read) requests, per client: see the features
// reference for the key, the write invalidation and the Cache-Control rules.

using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

using ProjectNameSdk.Util;

using static ProjectNameSdk.Feature.FeatureOptions;

namespace ProjectNameSdk.Feature;

public class CacheFeature : BaseFeature
{
    private ProjectNameSDK? _client;
    private Dictionary<string, object?>? _options;
    private Dictionary<string, CacheEntry> _store = new();
    private List<string> _order = new();
    private byte[] _secret = Array.Empty<byte>();

    private static readonly string[] SafeMethods = { "GET", "HEAD" };
    private static readonly string[] Unstored = { "no-store", "private", "no-cache" };
    private static readonly Regex MaxAge = new("^max-age\\s*=\\s*\"?(\\d+)\"?$");

    // Activity tracking (mirrors the ts client._cache record).
    public int Hit;
    public int Miss;
    public int Bypass;

    private class CacheEntry
    {
        public long Expiry;
        public string Scope = "";
        public CacheSnapshot Snapshot = new();
    }

    private class CacheSnapshot
    {
        public int Status;
        public string StatusText = "";
        public object? Data;
        public Dictionary<string, object?> Headers = new();
    }

    public CacheFeature()
    {
        Version = "0.0.1";
        Name = "cache";
        Active = true;
    }

    public override void Init(Context ctx, Dictionary<string, object?> options)
    {
        _client = ctx.Client;
        _options = options;
        Active = FoptBool(options, "active", false);

        if (!Active)
        {
            return;
        }

        _store = new Dictionary<string, CacheEntry>();
        _order = new List<string>();
        _secret = RandomNumberGenerator.GetBytes(32);

        var inner = ctx.Utility!.Fetcher;

        ctx.Utility.Fetcher = (ctx2, url, fetchdef) => Through(ctx2, url, fetchdef, inner);
    }

    private object? Through(Context ctx, string url, Dictionary<string, object?> fetchdef,
        FetcherFunc inner)
    {
        var method = "GET";
        if (fetchdef.TryGetValue("method", out var mraw) && mraw is string m && m != "")
        {
            method = m.ToUpperInvariant();
        }

        var methods = FoptStrList(_options, "methods") ?? new List<string> { "GET" };
        var cacheable = methods.Any(x => x.ToUpperInvariant() == method);
        if (!cacheable)
        {
            if (SafeMethods.Contains(method))
            {
                return inner(ctx, url, fetchdef);
            }
            try
            {
                return inner(ctx, url, fetchdef);
            }
            finally
            {
                Invalidate(url);
            }
        }

        fetchdef.TryGetValue("headers", out var headers);
        var key = method + " " + url + " " + Digest(headers);
        var now = FoptNow(_options)();

        if (_store.TryGetValue(key, out var hit) && hit.Expiry > now)
        {
            Hit++;
            return Replay(hit.Snapshot);
        }

        object? res = null;
        Exception? err = null;
        try
        {
            res = inner(ctx, url, fetchdef);
        }
        catch (Exception ex)
        {
            err = ex;
        }

        // A body that declares another type than JSON passes by, unread.
        if (err == null && Storable(res) && !Json(res))
        {
            Bypass++;
            return res;
        }

        if (err == null && Storable(res))
        {
            var snapshot = Snapshot(res);
            var ttl = Lifetime(snapshot.Headers, FoptInt(_options, "ttl", 5000));
            if (ttl <= 0)
            {
                Bypass++;
                return Replay(snapshot);
            }
            Drop(key);
            Evict();
            _store[key] = new CacheEntry { Expiry = now + ttl, Scope = UrlScope(url), Snapshot = snapshot };
            _order.Add(key);
            Miss++;
            return Replay(snapshot);
        }

        Bypass++;
        if (err != null)
        {
            throw err;
        }
        return res;
    }

    private string Digest(object? headers)
    {
        var pairs = new List<(string Name, string Value)>();
        if (headers is IDictionary<string, object?> hm)
        {
            foreach (var kv in hm)
            {
                if (kv.Value != null)
                {
                    pairs.Add((kv.Key.ToLowerInvariant(), Convert.ToString(kv.Value, System.Globalization.CultureInfo.InvariantCulture) ?? ""));
                }
            }
        }
        var text = new StringBuilder();
        foreach (var (name, value) in pairs.OrderBy(p => p.Name, StringComparer.Ordinal).ThenBy(p => p.Value, StringComparer.Ordinal))
        {
            text.Append(name).Append(':').Append(value).Append('\n');
        }
        return Convert.ToHexString(HMACSHA256.HashData(_secret, Encoding.UTF8.GetBytes(text.ToString()))).ToLowerInvariant();
    }

    private void Invalidate(string url)
    {
        var path = UrlScope(url);
        var collection = UrlParent(path);
        foreach (var key in _store.Where(kv => Under(kv.Value.Scope, path) || kv.Value.Scope == collection)
            .Select(kv => kv.Key).ToList())
        {
            Drop(key);
        }
    }

    private void Drop(string key)
    {
        if (_store.Remove(key))
        {
            _order.Remove(key);
        }
    }

    // The configured ttl capped by the response's Cache-Control; zero when the
    // response may not be stored.
    private static long Lifetime(Dictionary<string, object?> headers, long ttl)
    {
        var control = "";
        foreach (var kv in headers)
        {
            if (kv.Key.ToLowerInvariant() == "cache-control")
            {
                control = (Convert.ToString(kv.Value) ?? "").ToLowerInvariant();
            }
        }
        var life = ttl;
        foreach (var part in control.Split(','))
        {
            var directive = part.Trim();
            if (Unstored.Contains(directive))
            {
                return 0;
            }
            var age = MaxAge.Match(directive);
            if (age.Success && long.TryParse(age.Groups[1].Value, out var secs))
            {
                life = Math.Min(life, secs * 1000);
            }
        }
        return life;
    }

    private static string UrlScope(string url)
    {
        var cut = url.IndexOfAny(new[] { '?', '#' });
        return (cut < 0 ? url : url[..cut]).TrimEnd('/');
    }

    private static string UrlParent(string scope)
    {
        var scheme = scope.IndexOf("://", StringComparison.Ordinal);
        var root = scheme < 0 ? 0 : scope.IndexOf('/', scheme + 3);
        if (root < 0)
        {
            return scope;
        }
        return scope[..Math.Max(scope.LastIndexOf('/'), root)];
    }

    private static bool Under(string scope, string prefix)
    {
        return scope == prefix || scope.StartsWith(prefix + "/", StringComparison.Ordinal);
    }

    // A body the transport could not read as JSON passes through, for the operation to report.
    private static bool Storable(object? res)
    {
        var (status, has) = FresStatus(res);
        return has && status >= 200 && status < 300 &&
            !(res is Dictionary<string, object?> rm && rm.TryGetValue("unreadable", out var u) && u is true);
    }

    private static bool Json(object? res)
    {
        var headers = res is Dictionary<string, object?> rm ? rm.GetValueOrDefault("headers") : null;
        var type = Response.HeaderValue(headers, "content-type");
        return type == "" || SdkUtility.IsJsonMedia(type);
    }

    private static CacheSnapshot Snapshot(object? res)
    {
        var rm = res as Dictionary<string, object?>;
        var snap = new CacheSnapshot();

        var (status, has) = FresStatus(res);
        if (has)
        {
            snap.Status = status;
        }
        if (rm != null)
        {
            if (rm.TryGetValue("statusText", out var st) && st is string sts)
            {
                snap.StatusText = sts;
            }
            if (rm.TryGetValue("json", out var jf) && jf is Func<object?> f)
            {
                snap.Data = f();
            }
            if (rm.TryGetValue("headers", out var hraw) && hraw is Dictionary<string, object?> headers)
            {
                foreach (var kv in headers)
                {
                    snap.Headers[kv.Key.ToLowerInvariant()] = kv.Value;
                }
            }
        }

        return snap;
    }

    // Replay builds a fresh transport-shaped response so the body stays
    // re-readable for every consumer.
    private static Dictionary<string, object?> Replay(CacheSnapshot snap)
    {
        var data = snap.Data;
        var headers = new Dictionary<string, object?>(snap.Headers);
        return new Dictionary<string, object?>
        {
            ["status"] = snap.Status,
            ["statusText"] = snap.StatusText,
            ["body"] = "not-used",
            ["json"] = (Func<object?>)(() => data),
            ["headers"] = headers,
        };
    }

    // Evict drops oldest entries (FIFO) until the store is under `max`.
    private void Evict()
    {
        var max = FoptInt(_options, "max", 256);
        while (_store.Count >= max && _order.Count > 0)
        {
            var oldest = _order[0];
            _order.RemoveAt(0);
            _store.Remove(oldest);
        }
    }
}
