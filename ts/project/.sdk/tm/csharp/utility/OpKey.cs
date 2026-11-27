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
        var name = ctx.Op?.Name is string opname && opname != "" ? opname : "_";
        var entity = ctx.Op?.Entity is string opentity && opentity != "" ? opentity
            : ctx.Entity?.GetName() is string entname && entname != "" ? entname
            : "_";
        var baseKey = entity + "." + name;
        var action = OpAction(ctx);
        return action == null
            ? new List<string> { baseKey, name, "*" }
            : new List<string> { baseKey + ":" + action, baseKey, name, "*" };
    }
}
