// ProjectName SDK utility: done - final result extraction.

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    internal static object? DoneUtil(Context ctx)
    {
        if (ctx.Ctrl.Explain != null)
        {
            ctx.Ctrl.Explain =
                CleanUtil(ctx, ctx.Ctrl.Explain) as Dictionary<string, object?>;
            if (ctx.Ctrl.Explain != null &&
                ctx.Ctrl.Explain.TryGetValue("result", out var explainResult) &&
                explainResult is Dictionary<string, object?> rm)
            {
                rm.Remove("err");
            }
        }

        // An operation resolves to the ENTITY, not the raw data. Entities are
        // stateful: the op fragment has just absorbed resdata/resmatch into this
        // instance, and the caller reaches the record through .data(). Two
        // structural exceptions: `list` resolves to the ARRAY of entity
        // instances makeResult built, and a context with no entity
        // (direct/prepare, streaming) has nothing to return but the data. A
        // removed entity keeps its data but is no longer live. See AGENTS.md.
        if (ctx.Result != null && ctx.Result.Ok)
        {
            var entity = ctx.Entity;
            var opname = ctx.Op?.Name;

            if (entity != null && "list" != opname)
            {
                if ("remove" == opname)
                {
                    entity.MarkDeleted();
                }
                return entity;
            }

            return ctx.Result.Resdata;
        }

        return MakeErrorUtil(ctx, null);
    }
}
