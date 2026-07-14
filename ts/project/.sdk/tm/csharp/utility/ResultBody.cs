// ProjectName SDK utility: resultBody.

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    internal static Result ResultBodyUtil(Context ctx)
    {
        var response = ctx.Response;
        var result = ctx.Result;

        if (result != null)
        {
            if (response?.JsonFunc != null && response.Body != null)
            {
                result.Body = response.JsonFunc();
            }
        }

        return result!;
    }
}
