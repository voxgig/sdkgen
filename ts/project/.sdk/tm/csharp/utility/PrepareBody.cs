// ProjectName SDK utility: prepareBody.

using Voxgig.Struct;

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    internal static object? PrepareBodyUtil(Context ctx)
    {
        var op = ctx.Op!;

        if (op.Input == "data")
        {
            if (IsRawRequest(ctx.Point))
            {
                return RawBodyOf(ctx.Reqdata);
            }
            var body = ctx.Utility!.TransformRequest(ctx);
            return body;
        }

        if (StructUtils.GetProp(ctx.Point, "fields") is List<object?> fields && 0 < fields.Count)
        {
            return MatchBody(ctx, fields);
        }

        return null;
    }

    // A list, load or remove routed to a method with a body sends the match
    // fields that body declares, never a path parameter, and never a header,
    // cookie or query argument the body does not also declare as a field.
    private static Dictionary<string, object?> MatchBody(Context ctx, List<object?> fields)
    {
        var routed = new List<object?>();
        if (StructUtils.GetProp(ctx.Point, "params") is List<object?> pl)
        {
            routed.AddRange(pl);
        }
        if (StructUtils.GetPath(ctx.Point, StructUtils.Jt("args", "params")) is List<object?> apl)
        {
            routed.AddRange(apl.Select(pd => StructUtils.GetProp(pd, "name")));
        }
        foreach (var kind in new[] { "header", "cookie", "query" })
        {
            if (StructUtils.GetPath(ctx.Point, StructUtils.Jt("args", kind)) is List<object?> defs)
            {
                routed.AddRange(defs.Where(ad => StructUtils.GetProp(ad, "field") is not true)
                    .Select(ad => StructUtils.GetProp(ad, "name")));
            }
        }

        var body = new Dictionary<string, object?>();
        foreach (var field in fields)
        {
            if (field is string name && "$action" != name && !routed.Contains(name) &&
                StructUtils.GetProp(ctx.Reqmatch, name) is { } val)
            {
                body[name] = val;
            }
        }
        return body;
    }
}
