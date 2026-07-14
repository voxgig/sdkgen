// ProjectName SDK utility: makeSpec - build the HTTP request spec from the
// resolved point and options.

using Voxgig.Struct;

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    internal static Spec MakeSpecUtil(Context ctx)
    {
        if (ctx.Out.TryGetValue("spec", out var outSpec) && outSpec is Spec cached)
        {
            ctx.Spec = cached;
            return cached;
        }

        var point = ctx.Point;
        var options = ctx.Options;
        var utility = ctx.Utility!;

        var basev = StructUtils.GetProp(options, "base") as string ?? "";
        var prefix = StructUtils.GetProp(options, "prefix") as string ?? "";
        var suffix = StructUtils.GetProp(options, "suffix") as string ?? "";

        var parts = StructUtils.GetProp(point, "parts") as List<object?>;

        ctx.Spec = new Spec(new Dictionary<string, object?>
        {
            ["base"] = basev,
            ["prefix"] = prefix,
            ["parts"] = parts,
            ["suffix"] = suffix,
            ["step"] = "start",
        });

        ctx.Spec.Method = utility.PrepareMethod(ctx);

        var allowMethod = StructUtils.GetPath(options, StructUtils.Jt("allow", "method"))
            as string ?? "";
        if (!allowMethod.Contains(ctx.Spec.Method))
        {
            throw ctx.MakeError("spec_method_allow",
                "Method \"" + ctx.Spec.Method +
                "\" not allowed by SDK option allow.method value: \"" + allowMethod + "\"");
        }

        ctx.Spec.Params = utility.PrepareParams(ctx);
        ctx.Spec.Query = utility.PrepareQuery(ctx);
        ctx.Spec.Headers = utility.PrepareHeaders(ctx);
        ctx.Spec.Body = utility.PrepareBody(ctx);
        ctx.Spec.Path = utility.PreparePath(ctx);

        if (ctx.Ctrl.Explain != null)
        {
            ctx.Ctrl.Explain["spec"] = ctx.Spec;
        }

        var spec = utility.PrepareAuth(ctx);

        ctx.Spec = spec;
        return spec;
    }
}
