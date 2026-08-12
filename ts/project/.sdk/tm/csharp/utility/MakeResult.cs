// ProjectName SDK utility: makeResult - final result shaping. Every
// operation, list included, resolves to plain records.

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    internal static Result MakeResultUtil(Context ctx)
    {
        if (ctx.Out.TryGetValue("result", out var outRes) && outRes is Result cached)
        {
            return cached;
        }

        var utility = ctx.Utility!;
        var op = ctx.Op!;
        var entity = ctx.Entity;
        var spec = ctx.Spec;
        var result = ctx.Result;

        if (spec == null)
        {
            throw ctx.MakeError("result_no_spec",
                "Expected context spec property to be defined.");
        }
        if (result == null)
        {
            throw ctx.MakeError("result_no_result",
                "Expected context result property to be defined.");
        }

        spec.Step = "result";

        utility.TransformResponse(ctx);

        // Every operation resolves to PLAIN records — load, create, update and
        // list alike. `list` used to be the outlier: it wrapped each record in
        // an entity instance, so the same record came back with a different
        // type, a different key order and an extra marker depending on which
        // call produced it. Any consumer touching both paths had to normalise
        // defensively, and feeding a wrapped record into a host framework's own
        // metadata silently produced wrong entities with no error at all. A
        // missing or empty list still normalises to an empty list.
        if (op.Name == "list")
        {
            var resdata = result.Resdata;
            result.Resdata = resdata is List<object?> list ? list : new List<object?>();
        }

        if (ctx.Ctrl.Explain != null)
        {
            ctx.Ctrl.Explain["result"] = result;
        }

        return result;
    }
}
