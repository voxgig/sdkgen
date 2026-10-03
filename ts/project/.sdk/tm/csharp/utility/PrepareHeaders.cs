// ProjectName SDK utility: prepareHeaders.

using Voxgig.Struct;

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    internal static Dictionary<string, object?> PrepareHeadersUtil(Context ctx)
    {
        var options = ctx.Client!.OptionsMap();

        var headers = StructUtils.GetProp(options, "headers");
        var result = MediaHeaders(ctx.Point,
            (headers == null ? null : StructUtils.Clone(headers) as Dictionary<string, object?>)
            ?? new Dictionary<string, object?>());

        // A header argument replaces a default of the same name, whatever its
        // case.
        foreach (var arg in CallArgs(ctx, "header"))
        {
            if (arg.Val != null)
            {
                var key = arg.Wire.ToLowerInvariant();
                foreach (var k in new List<string>(result.Keys))
                {
                    if (k.ToLowerInvariant() == key)
                    {
                        result.Remove(k);
                    }
                }
                result[key] = StructUtils.Stringify(arg.Val);
            }
        }

        // A cookie argument travels in the cookie header, form serialized and
        // percent-encoded, replacing a cookie of the same name among those the
        // caller's headers already send.
        var sent = CallArgs(ctx, "cookie").Where(arg => arg.Val != null).ToList();
        if (0 < sent.Count)
        {
            var names = sent.SelectMany(arg => arg.Val is Dictionary<string, object?>
                ? StructUtils.KeysOf(arg.Val).Select(key => StructUtils.EscUrl(key))
                : new List<string> { arg.Wire }).ToList();
            var kept = new List<string>();
            foreach (var k in new List<string>(result.Keys))
            {
                if (k.ToLowerInvariant() != "cookie")
                {
                    continue;
                }
                if (result[k] is string given)
                {
                    kept.AddRange(CookieKeep(given, names));
                }
                result.Remove(k);
            }
            foreach (var arg in sent)
            {
                var pair = CookiePair(arg.Wire, arg.Val);
                if ("" != pair)
                {
                    kept.Add(pair);
                }
            }
            if (0 < kept.Count)
            {
                result["cookie"] = string.Join("; ", kept);
            }
        }

        return result;
    }

    // The caller's cookie pieces with every named cookie removed. A piece whose
    // &-parts are all pairs is the exploded form CookiePair writes, and loses
    // only the pairs named; any other piece is one cookie, kept or dropped whole.
    internal static List<string> CookieKeep(string header, List<string> names)
    {
        bool Named(string part) => names.Contains(part.Split('=', 2)[0].Trim());
        var kept = new List<string>();
        foreach (var piece in header.Split(';'))
        {
            var parts = piece.Split('&');
            var rest = parts.All(part => part.Contains('=')) ? parts.Where(part => !Named(part))
                : Named(piece) ? Enumerable.Empty<string>() : parts;
            var cookie = string.Join("&", rest).Trim();
            if ("" != cookie)
            {
                kept.Add(cookie);
            }
        }
        return kept;
    }

    // The form style of a cookie parameter: a list repeats the name, a map
    // sends its own keys, and every value is percent-encoded.
    private static string CookiePair(string wire, object? val)
    {
        string Esc(object? v) => StructUtils.EscUrl(StructUtils.Stringify(v));
        var pairs = new List<string>();
        if (val is List<object?> items)
        {
            foreach (var item in items)
            {
                pairs.Add(wire + "=" + Esc(item));
            }
        }
        else if (val is Dictionary<string, object?> map)
        {
            foreach (var key in StructUtils.KeysOf(map))
            {
                pairs.Add(StructUtils.EscUrl(key) + "=" + Esc(map[key]));
            }
        }
        else
        {
            pairs.Add(wire + "=" + Esc(val));
        }
        return string.Join("&", pairs);
    }
}
