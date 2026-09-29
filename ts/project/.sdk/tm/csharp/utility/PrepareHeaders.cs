// ProjectName SDK utility: prepareHeaders.

using Voxgig.Struct;

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    internal static Dictionary<string, object?> PrepareHeadersUtil(Context ctx)
    {
        var options = ctx.Client!.OptionsMap();

        var headers = StructUtils.GetProp(options, "headers");
        var out = (headers == null ? null : StructUtils.Clone(headers) as Dictionary<string, object?>)
            ?? new Dictionary<string, object?>();

        // A header parameter travels as a header, under the name the
        // definition gives it, and only from this call's own arguments.
        if (ctx.Point != null &&
            StructUtils.GetPath(ctx.Point, StructUtils.Jt("args", "header")) is List<object?> hl)
        {
            foreach (var hd in hl)
            {
                if (StructUtils.GetProp(hd, "name") is not string name || name == "")
                {
                    continue;
                }
                var wire = StructUtils.GetProp(hd, "orig") is string orig && orig != "" ? orig : name;
                var val = ctx.Reqmatch == null ? null : StructUtils.GetProp(ctx.Reqmatch, name);
                if (val == null && ctx.Reqdata != null)
                {
                    val = StructUtils.GetProp(ctx.Reqdata, name);
                }
                if (val != null)
                {
                    out[wire.ToLowerInvariant()] = StructUtils.Stringify(val);
                }
            }
        }

        return out;
    }
}
