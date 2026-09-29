// ProjectName SDK utility: transformRequest - apply the point's request
// transform (when defined) to the request data.

using Voxgig.Struct;

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    internal static object? TransformRequestUtil(Context ctx)
    {
        var spec = ctx.Spec;
        var point = ctx.Point;

        if (spec != null)
        {
            spec.Step = "reqform";
        }

        var data = OmitKeys(ctx.Reqdata, HeaderArgNames(point));

        var transform = Helpers.ToMapAny(StructUtils.GetProp(point, "transform"));
        if (transform == null)
        {
            return StripAction(data);
        }

        var reqform = StructUtils.GetProp(transform, "req");
        if (reqform == null)
        {
            return StripAction(data);
        }

        var reqdata = StructUtils.Transform(new Dictionary<string, object?>
        {
            ["reqdata"] = data,
        }, reqform);

        return StripAction(reqdata);
    }

    // `$action` selects the point (see MakePointUtil); it is never an API
    // field, so the body is a copy without it. The caller's map is left
    // untouched.
    private static object? StripAction(object? reqdata)
    {
        return OmitKeys(reqdata, new List<string> { "$action" });
    }

    // A header argument travels as a header, which PrepareHeadersUtil sends,
    // so the body is built from the request data without it.
    private static List<string> HeaderArgNames(object? point)
    {
        var names = new List<string>();
        if (point != null &&
            StructUtils.GetPath(point, StructUtils.Jt("args", "header")) is List<object?> hl)
        {
            foreach (var hd in hl)
            {
                if (StructUtils.GetProp(hd, "name") is string name && name != "")
                {
                    names.Add(name);
                }
            }
        }
        return names;
    }

    private static object? OmitKeys(object? reqdata, List<string> names)
    {
        if (reqdata is not IDictionary<string, object?> src || !names.Exists(src.ContainsKey))
        {
            return reqdata;
        }
        var body = new Dictionary<string, object?>();
        foreach (var kv in src)
        {
            if (!names.Contains(kv.Key))
            {
                body[kv.Key] = kv.Value;
            }
        }
        return body;
    }
}
