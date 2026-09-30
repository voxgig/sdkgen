// ProjectName SDK utility: done - final result extraction.

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    internal static object? DoneUtil(Context ctx)
    {
        var explain = ctx.Ctrl.Explain;
        if (explain != null)
        {
            // Refilled in place: the caller holds this very dictionary (the
            // Context copied it out of the ctrl map), so a replacement would
            // leave them reading the raw one.
            if (CleanUtil(ctx, explain) is Dictionary<string, object?> cleaned &&
                !ReferenceEquals(cleaned, explain))
            {
                explain.Clear();
                foreach (var kv in cleaned)
                {
                    explain[kv.Key] = kv.Value;
                }
            }
            if (explain.TryGetValue("result", out var explainResult) &&
                explainResult is Dictionary<string, object?> rm)
            {
                rm.Remove("err");
            }
        }

        if (ctx.Result != null && ctx.Result.Ok)
        {
            return ctx.Result.Resdata;
        }

        return MakeErrorUtil(ctx, null);
    }
}
