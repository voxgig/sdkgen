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

        return result;
    }
}
