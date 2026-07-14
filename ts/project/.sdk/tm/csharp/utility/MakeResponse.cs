// ProjectName SDK utility: makeResponse - shape the transport response
// into the result.

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    internal static Response MakeResponseUtil(Context ctx)
    {
        if (ctx.Out.TryGetValue("response", out var outResp) && outResp is Response cached)
        {
            return cached;
        }

        var utility = ctx.Utility!;
        var spec = ctx.Spec;
        var result = ctx.Result;
        var response = ctx.Response;

        if (spec == null)
        {
            throw ctx.MakeError("response_no_spec",
                "Expected context spec property to be defined.");
        }
        if (response == null)
        {
            throw ctx.MakeError("response_no_response",
                "Expected context response property to be defined.");
        }
        if (result == null)
        {
            throw ctx.MakeError("response_no_result",
                "Expected context result property to be defined.");
        }

        spec.Step = "response";

        utility.ResultBasic(ctx);
        utility.ResultHeaders(ctx);
        utility.ResultBody(ctx);
        utility.TransformResponse(ctx);

        if (result.Err == null)
        {
            result.Ok = true;
        }

        if (ctx.Ctrl.Explain != null)
        {
            ctx.Ctrl.Explain["result"] = result;
        }

        return response;
    }
}
