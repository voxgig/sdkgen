// ProjectName SDK utility: makeError - the single error surface of the
// pipeline. Throws the wrapped ProjectNameError unless the per-call ctrl
// disables throwing (ctrl.throw == false), in which case it returns the
// (possibly nil) result data instead.

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    internal static object? MakeErrorUtil(Context ctx, Exception? err)
    {
        ctx ??= new Context(new Dictionary<string, object?>(), null);

        var op = ctx.Op ?? new Operation(new Dictionary<string, object?>());
        var opname = op.Name;
        if (opname == "" || opname == "_")
        {
            opname = "unknown operation";
        }

        var result = ctx.Result ?? new Result(new Dictionary<string, object?>());
        result.Ok = false;

        err ??= result.Err;
        err ??= ctx.MakeError("unknown", "unknown error");

        var errmsg = err.Message;
        var msg = "ProjectNameSDK: " + opname + ": " + errmsg;
        msg = CleanUtil(ctx, msg) as string ?? msg;

        result.Err = null;

        var spec = ctx.Spec;

        if (ctx.Ctrl.Explain != null)
        {
            ctx.Ctrl.Explain["err"] = new Dictionary<string, object?>
            {
                ["message"] = msg,
            };
        }

        var sdkErr = new ProjectNameError(
            err is ProjectNameError se ? se.Code : "", msg, ctx)
        {
            ResultVal = CleanUtil(ctx, result),
            SpecVal = CleanUtil(ctx, spec),
        };

        ctx.Ctrl.Err = sdkErr;

        if (ctx.Ctrl.Throw == false)
        {
            return result.Resdata;
        }

        throw sdkErr;
    }
}
