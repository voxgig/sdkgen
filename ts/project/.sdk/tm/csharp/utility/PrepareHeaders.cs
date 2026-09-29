// ProjectName SDK utility: prepareHeaders.

using Voxgig.Struct;

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    internal static Dictionary<string, object?> PrepareHeadersUtil(Context ctx)
    {
        var options = ctx.Client!.OptionsMap();

        var headers = StructUtils.GetProp(options, "headers");
        var result = (headers == null ? null : StructUtils.Clone(headers) as Dictionary<string, object?>)
            ?? new Dictionary<string, object?>();

        // A header parameter travels as a header, under the name the
        // definition gives it, and only from this call's own arguments. It
        // replaces a default of the same name, whatever its case.
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
                    var key = wire.ToLowerInvariant();
                    foreach (var k in new List<string>(result.Keys))
                    {
                        if (k.ToLowerInvariant() == key)
                        {
                            result.Remove(k);
                        }
                    }
                    result[key] = StructUtils.Stringify(val);
                }
            }
        }

        return result;
    }
}
