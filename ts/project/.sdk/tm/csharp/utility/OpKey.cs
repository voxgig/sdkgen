// ProjectName SDK utility: opKeys - the keys an operation is looked up and
// filed by.

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    // The custom action a call names: `$action` in its own request argument,
    // never in a response.
    internal static string? OpAction(Context ctx)
    {
        var req = ctx.Op?.Input == "data" ? ctx.Reqdata : ctx.Reqmatch;
        return req != null && req.TryGetValue("$action", out var action) &&
            action is string name && name != "" ? name : null;
    }

    // Most specific first: `<entity>.<op>:<action>`, `<entity>.<op>`, `<op>`, `*`.
    internal static List<string> OpKeys(Context ctx)
    {
        var name = OpName(ctx);
        var baseKey = OpBaseKey(ctx);
        var action = OpAction(ctx);
        return action == null
            ? new List<string> { baseKey, name, "*" }
            : new List<string> { baseKey + ":" + action, baseKey, name, "*" };
    }

    // The name a call is filed under for a consumer to read: the first key,
    // with its action cleaned as the `action` field of a record, so a
    // sensitive key name masks it as well as a registered value.
    internal static string OpFileKey(Context ctx)
    {
        var action = OpAction(ctx);
        if (action == null)
        {
            return OpBaseKey(ctx);
        }
        var clean = ctx.Utility?.Clean;
        var cleaned = clean?.Invoke(ctx, new Dictionary<string, object?> { ["action"] = action })
            is Dictionary<string, object?> record && record.TryGetValue("action", out var field) &&
            field is string text ? text : action;
        return OpBaseKey(ctx) + ":" + cleaned;
    }

    private static string OpName(Context ctx)
    {
        return ctx.Op?.Name is string opname && opname != "" ? opname : "_";
    }

    private static string OpBaseKey(Context ctx)
    {
        var entity = ctx.Op?.Entity is string opentity && opentity != "" ? opentity
            : ctx.Entity?.GetName() is string entname && entname != "" ? entname
            : "_";
        return entity + "." + OpName(ctx);
    }
}
