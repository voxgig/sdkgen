// ProjectName SDK utility: resultBody.

using Voxgig.Struct;

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    internal static Result ResultBodyUtil(Context ctx)
    {
        var response = ctx.Response;
        var result = ctx.Result;

        if (result != null)
        {
            if (response != null && result.Err == null && response.Err == null && result.Status < 400 &&
                "raw".Equals(StructUtils.GetProp(StructUtils.GetProp(ctx.Point, "response"), "kind")) &&
                ctx.Utility?.Codec?.GetValueOrDefault("raw") is Action<Context> readRaw)
            {
                readRaw(ctx);
                return result;
            }
            if (response?.JsonFunc != null && response.Body != null)
            {
                result.Body = response.JsonFunc();
            }
            if (response is { Unreadable: true })
            {
                result.Err = Response.UnreadableBody(ctx, result.Status, result.Headers,
                    response.Body, ctx.Spec?.Headers, result.Err);
            }
        }

        return result!;
    }
}
