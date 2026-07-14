// ProjectName SDK utility: prepareMethod.

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    private static readonly Dictionary<string, string> MethodMap = new()
    {
        ["create"] = "POST",
        ["update"] = "PUT",
        ["load"] = "GET",
        ["list"] = "GET",
        ["remove"] = "DELETE",
        ["patch"] = "PATCH",
    };

    internal static string PrepareMethodUtil(Context ctx)
    {
        var opname = ctx.Op!.Name;
        return MethodMap.TryGetValue(opname, out var m) ? m : "GET";
    }
}
