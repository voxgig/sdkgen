// ProjectName SDK utility: makePoint - endpoint resolution.

using Voxgig.Struct;

namespace ProjectNameSdk.Util;

public static partial class SdkUtility
{
    internal static Dictionary<string, object?>? MakePointUtil(Context ctx)
    {
        if (ctx.Out.TryGetValue("point", out var outPoint) && outPoint != null)
        {
            // A PrePoint feature hook (e.g. rbac) may short-circuit the
            // operation by storing an error here; surface it before any
            // endpoint resolution or network activity.
            if (outPoint is Exception err)
            {
                throw err;
            }
            if (outPoint is Dictionary<string, object?> tm)
            {
                ctx.Point = tm;
                return tm;
            }
        }

        var op = ctx.Op!;
        var options = ctx.Options;

        var allowOp = StructUtils.GetPath(options, StructUtils.Jt("allow", "op")) as string ?? "";
        if (!allowOp.Contains(op.Name))
        {
            throw ctx.MakeError("point_op_allow",
                "Operation \"" + op.Name +
                "\" not allowed by SDK option allow.op value: \"" + allowOp + "\"");
        }

        if (op.Points.Count == 0)
        {
            throw ctx.MakeError("point_no_points",
                "Operation \"" + op.Name + "\" has no endpoint definitions.");
        }

        if (op.Points.Count == 1)
        {
            ctx.Point = op.Points[0];
        }
        else
        {
            Dictionary<string, object?>? reqselector;
            Dictionary<string, object?>? selector;

            if (op.Input == "data")
            {
                reqselector = ctx.Reqdata;
                selector = ctx.Data;
            }
            else
            {
                reqselector = ctx.Reqmatch;
                selector = ctx.Match;
            }

            Dictionary<string, object?>? point = null;
            foreach (var candidate in op.Points)
            {
                point = candidate;
                var selectDef = Helpers.ToMapAny(StructUtils.GetProp(point, "select"));
                var found = true;

                if (selector != null && selectDef != null)
                {
                    if (StructUtils.GetProp(selectDef, "exist") is List<object?> existList)
                    {
                        foreach (var ek in existList)
                        {
                            var existkey = ek as string;
                            var rv = StructUtils.GetProp(reqselector, existkey);
                            var sv = StructUtils.GetProp(selector, existkey);
                            if (rv == null && sv == null)
                            {
                                found = false;
                                break;
                            }
                        }
                    }
                }

                if (found)
                {
                    var reqAction = StructUtils.GetProp(reqselector, "$action");
                    var selectAction = StructUtils.GetProp(selectDef, "$action");
                    if (!Equals(reqAction, selectAction))
                    {
                        found = false;
                    }
                }

                if (found)
                {
                    break;
                }
            }

            if (reqselector != null)
            {
                var reqAction = StructUtils.GetProp(reqselector, "$action");
                if (reqAction != null && point != null)
                {
                    var pointSelect = Helpers.ToMapAny(StructUtils.GetProp(point, "select"));
                    var pointAction = StructUtils.GetProp(pointSelect, "$action");
                    if (!Equals(reqAction, pointAction))
                    {
                        throw ctx.MakeError("point_action_invalid",
                            "Operation \"" + op.Name +
                            "\" action \"" + StructUtils.Stringify(reqAction) +
                            "\" is not valid.");
                    }
                }
            }

            ctx.Point = point;
        }

        return ctx.Point;
    }
}
