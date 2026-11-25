// ProjectName SDK utility: fetcher - the default HttpClient transport,
// mode/test blocking, and the injectable system.fetch override.

using System.Net.Http;
using System.Text;
using System.Text.Json;

using Voxgig.Struct;

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    // Cookies OFF on every handler. The clients are process-wide, so a
    // CookieContainer would send one call's Set-Cookie on the next, under a
    // different credential — and .NET ADDS container cookies to a request
    // that already carries a Cookie header, which an `apiKey in: cookie`
    // scheme does. Pooling is the handler's own and is unaffected. No handler
    // follows a redirect: DefaultHttpFetch does. A gzip or deflate body is
    // decoded, which .NET leaves to the handler to ask for: a server may
    // compress its answer whatever the request asked for.
    private static HttpClientHandler CookielessHandler() =>
        new HttpClientHandler
        {
            AllowAutoRedirect = false,
            UseCookies = false,
            AutomaticDecompression =
                System.Net.DecompressionMethods.GZip | System.Net.DecompressionMethods.Deflate,
        };

    private static readonly HttpClient DefaultHttpClient = new(CookielessHandler());

    // Proxy-routed clients, cached per proxy URL (see the proxy feature's
    // fetchdef annotation).
    private static readonly Dictionary<string, HttpClient> ProxyClients = new();
    private static readonly object ProxyClientsLock = new();

    private static HttpClient ClientFor(Dictionary<string, object?> fetchdef)
    {
        if (fetchdef.TryGetValue("proxy", out var raw) && raw is string proxy && proxy != "")
        {
            lock (ProxyClientsLock)
            {
                if (!ProxyClients.TryGetValue(proxy, out var client))
                {
                    var handler = CookielessHandler();
                    handler.Proxy = new System.Net.WebProxy(proxy);
                    handler.UseProxy = true;
                    client = new HttpClient(handler);
                    ProxyClients[proxy] = client;
                }
                return client;
            }
        }
        return DefaultHttpClient;
    }

    internal const string GetOnlyEnv = "VOXGIG_GETONLY_GUARD";

    // A GET-only live run refuses any other method before it is sent. The
    // error names the path alone: the query can carry a credential.
    internal static ProjectNameError? GetOnlyRefusal(string fullurl, string method)
    {
        var upper = method.ToUpperInvariant();
        if (Environment.GetEnvironmentVariable(GetOnlyEnv) != "TRUE" || upper == "GET")
        {
            return null;
        }
        var rest = fullurl;
        var scheme = rest.IndexOf("://", StringComparison.Ordinal);
        if (scheme >= 0)
        {
            rest = System.Text.RegularExpressions.Regex.Replace(rest.Substring(scheme + 3), "^[^/?#]*", "");
        }
        var path = rest.Split(new[] { '?', '#' }, 2)[0];
        return new ProjectNameError("fetch_getonly_block",
            "[GET-ONLY GUARD] blocked " + upper + " " + (path == "" ? "/" : path), null);
    }

    // 300 as HttpClient followed it, beside the statuses every target follows.
    private static readonly int[] RedirectStatus = { 300, 301, 302, 303, 307, 308 };
    private const int RedirectMax = 5;
    private static readonly string[] CredentialHeaders =
    {
        "authorization", "cookie", "proxy-authorization",
    };

    // What another origin is not sent: the names every client drops, and
    // whatever the SDK holds as a secret, by its name or by its value. A call
    // with no context is answered from the schema's sensitive names.
    private static bool IsCredential(Context? ctx, string name, object? value)
    {
        return CredentialHeaders.Contains(name.ToLowerInvariant()) ||
            (ctx?.Utility?.CleanSecret ?? CleanSecretUtil)(ctx!, name, value);
    }

    private static bool SameOrigin(Uri here, Uri next)
    {
        return here.Scheme == next.Scheme && here.Port == next.Port &&
            string.Equals(here.Host, next.Host, StringComparison.OrdinalIgnoreCase);
    }

    // Left to follow, HttpClient sends another origin every header but
    // Authorization, and a 307's body with them. Followed here instead: each
    // hop passes the GET-only guard; past RedirectMax hops, or where a body
    // would go to another origin, the 3xx is the answer.
    internal static Dictionary<string, object?> DefaultHttpFetch(
        string fullurl, Dictionary<string, object?> fetchdef, Context? ctx = null)
    {
        // "manual" (set by the station feature's middleware under a hosts
        // policy) is answered by the 3xx, like any other response.
        var manual = "manual".Equals(fetchdef.GetValueOrDefault("redirect"));
        var url = fullurl;
        var def = fetchdef;

        for (var hops = 0; ; hops++)
        {
            var method = def.GetValueOrDefault("method") is string given && given != "" ? given : "GET";
            var refused = GetOnlyRefusal(url, method);
            if (refused != null)
            {
                throw refused;
            }

            var res = SendOnce(url, method, def);
            if (manual || RedirectMax <= hops || res["status"] is not int status ||
                !RedirectStatus.Contains(status) ||
                StructUtils.GetProp(res["headers"], "location") is not string location ||
                !Uri.TryCreate(url, UriKind.Absolute, out var here) ||
                !Uri.TryCreate(here, location, out var next))
            {
                return res;
            }

            // As HttpClient refused to: from https to any other scheme.
            if (here.Scheme == Uri.UriSchemeHttps && next.Scheme != Uri.UriSchemeHttps)
            {
                return res;
            }

            // As HttpClient rewrote it: a 303, and any other but a 307 or 308
            // answering a POST, become a GET without the body.
            method = method.ToUpperInvariant();
            var toget = 303 == status ? "HEAD" != method && "GET" != method
                : "POST" == method && 307 != status && 308 != status;
            var cross = !SameOrigin(here, next);
            var body = toget ? null : def.GetValueOrDefault("body");

            // A stream is read once, so it cannot be sent again either.
            if (body != null && (cross || body is Stream))
            {
                return res;
            }

            var headers = new Dictionary<string, object?>();
            if (def.GetValueOrDefault("headers") is Dictionary<string, object?> held)
            {
                foreach (var kv in held)
                {
                    var dropped =
                        (toget && kv.Key.StartsWith("content-", StringComparison.OrdinalIgnoreCase)) ||
                        (cross && IsCredential(ctx, kv.Key, kv.Value));
                    if (!dropped)
                    {
                        headers[kv.Key] = kv.Value;
                    }
                }
            }

            def = new Dictionary<string, object?>(def)
            {
                ["method"] = toget ? "GET" : method,
                ["headers"] = headers,
            };
            if (body == null)
            {
                def.Remove("body");
            }
            url = next.AbsoluteUri;
        }
    }

    private static Dictionary<string, object?> SendOnce(
        string fullurl, string method, Dictionary<string, object?> fetchdef)
    {
        using var req = new HttpRequestMessage(new HttpMethod(method), fullurl);

        if (fetchdef.TryGetValue("body", out var braw))
        {
            if (braw is string body && body != "")
            {
                req.Content = new StringContent(body, Encoding.UTF8, "application/json");
            }
            else if (braw is byte[] bytes)
            {
                req.Content = new ByteArrayContent(bytes);
            }
            else if (braw is Stream stream)
            {
                req.Content = new StreamContent(stream);
            }
        }

        var hasUA = false;
        if (fetchdef.TryGetValue("headers", out var hraw) &&
            hraw is Dictionary<string, object?> headers)
        {
            foreach (var kv in headers)
            {
                if (kv.Value is string sv)
                {
                    if (string.Equals(kv.Key, "user-agent", StringComparison.OrdinalIgnoreCase))
                    {
                        hasUA = true;
                    }
                    if (string.Equals(kv.Key, "content-type", StringComparison.OrdinalIgnoreCase))
                    {
                        // Content headers live on the content object.
                        req.Content ??= new StringContent("", Encoding.UTF8);
                        req.Content.Headers.Remove("Content-Type");
                        req.Content.Headers.TryAddWithoutValidation("Content-Type", sv);
                        continue;
                    }
                    req.Headers.TryAddWithoutValidation(kv.Key, sv);
                }
            }
        }
        // Default User-Agent - some CDNs block requests without one. Use the
        // project's agent (main.kit.http.useragent, browser-shaped by default)
        // unless the caller already set one, and record it with the headers
        // the request sent.
        if (!hasUA)
        {
            var agent = "PROJECTUSERAGENT";
            req.Headers.TryAddWithoutValidation("User-Agent", agent);
            if (hraw is Dictionary<string, object?> sent)
            {
                sent["user-agent"] = agent;
            }
        }

        using var resp = ClientFor(fetchdef).Send(req, HttpCompletionOption.ResponseContentRead);

        var bodyText = resp.Content.ReadAsStringAsync().GetAwaiter().GetResult();

        var resheaders = new Dictionary<string, object?>();
        foreach (var kv in resp.Headers.Concat(resp.Content.Headers))
        {
            var vals = kv.Value.ToList();
            resheaders[kv.Key.ToLowerInvariant()] =
                vals.Count == 1 ? vals[0] : string.Join(", ", vals);
        }

        object? jsonBody = null;
        var unreadable = false;
        if (!string.IsNullOrWhiteSpace(bodyText))
        {
            try
            {
                var el = JsonSerializer.Deserialize<JsonElement>(bodyText);
                jsonBody = JsonToNative(el);
            }
            catch (JsonException)
            {
                unreadable = true;
            }
        }

        var statusText = resp.ReasonPhrase ?? "";

        return new Dictionary<string, object?>
        {
            ["status"] = (int)resp.StatusCode,
            ["statusText"] = statusText,
            ["headers"] = resheaders,
            ["json"] = (Func<object?>)(() => jsonBody),
            ["body"] = bodyText,
            ["unreadable"] = unreadable,
        };
    }

    // JsonToNative converts a JsonElement tree into the loose object model
    // (Dictionary<string, object?> / List<object?> / string / long / double
    // / bool / null) the vendored struct utility manipulates.
    public static object? JsonToNative(JsonElement el)
    {
        return el.ValueKind switch
        {
            JsonValueKind.Object => el.EnumerateObject()
                .ToDictionary(p => p.Name, p => JsonToNative(p.Value)),
            JsonValueKind.Array => el.EnumerateArray()
                .Select(JsonToNative)
                .ToList(),
            JsonValueKind.String => el.GetString(),
            JsonValueKind.Number => el.TryGetInt64(out var l) ? l : el.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null,
        };
    }

    internal static object? FetcherUtil(Context ctx, string fullurl,
        Dictionary<string, object?> fetchdef)
    {
        if (ctx.Client!.Mode != "live")
        {
            throw ctx.MakeError("fetch_mode_block",
                "Request blocked by mode: \"" + ctx.Client.Mode +
                "\" (URL was: \"" + fullurl + "\")");
        }

        var options = ctx.Client.OptionsMap();
        if (Equals(StructUtils.GetPath(options, StructUtils.Jt("feature", "test", "active")), true))
        {
            throw ctx.MakeError("fetch_test_block",
                "Request blocked as test feature is active" +
                " (URL was: \"" + fullurl + "\")");
        }

        var sysFetch = StructUtils.GetPath(options, StructUtils.Jt("system", "fetch"));

        if (sysFetch == null)
        {
            return DefaultHttpFetch(fullurl, fetchdef, ctx);
        }

        if (sysFetch is Func<string, Dictionary<string, object?>, Dictionary<string, object?>> fetchFunc)
        {
            return fetchFunc(fullurl, fetchdef);
        }
        if (sysFetch is Func<string, Dictionary<string, object?>, object?> fetchFuncAny)
        {
            return fetchFuncAny(fullurl, fetchdef);
        }

        throw ctx.MakeError("fetch_invalid", "system.fetch is not a valid function");
    }
}
