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

        // A cookie argument travels in the cookie header as name=value, after
        // any cookies the caller's headers already send.
        var cookies = new List<string>();
        foreach (var arg in CallArgs(ctx, "cookie"))
        {
            if (arg.Val != null)
            {
                cookies.Add(arg.Wire + "=" + StructUtils.Stringify(arg.Val));
            }
        }
        if (0 < cookies.Count)
        {
            var sent = new List<string>();
            foreach (var k in new List<string>(result.Keys))
            {
                if (k.ToLowerInvariant() == "cookie")
                {
                    if (result[k] is string given && "" != given)
                    {
                        sent.Add(given);
                    }
                    result.Remove(k);
                }
            }
            sent.AddRange(cookies);
            result["cookie"] = string.Join("; ", sent);
        }

        return result;
    }
}
