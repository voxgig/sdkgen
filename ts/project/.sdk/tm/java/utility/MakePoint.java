package JAVAPACKAGE.utility;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.Helpers;
import JAVAPACKAGE.core.Operation;
import JAVAPACKAGE.utility.struct.Struct;

@SuppressWarnings({"unchecked"})
final class MakePoint {

  private MakePoint() {}

  static Map<String, Object> makePoint(Context ctx) {
    Object outPoint = ctx.out.get("point");
    if (outPoint != null) {
      // A PrePoint feature hook (e.g. rbac) may short-circuit the
      // operation by storing an error here; surface it before any
      // endpoint resolution or network activity.
      if (outPoint instanceof RuntimeException) {
        throw (RuntimeException) outPoint;
      }
      if (outPoint instanceof Map) {
        ctx.point = (Map<String, Object>) outPoint;
        return ctx.point;
      }
    }

    Operation op = ctx.op;
    Map<String, Object> options = ctx.options;

    Object allowOpRaw = Struct.getpath(options, List.of("allow", "op"));
    String allowOp = allowOpRaw instanceof String ? (String) allowOpRaw : "";
    if (!allowOp.contains(op.name)) {
      throw ctx.makeError("point_op_allow",
          "Operation \"" + op.name
              + "\" not allowed by SDK option allow.op value: \"" + allowOp + "\"");
    }

    if (op.points.isEmpty()) {
      throw ctx.makeError("point_no_points",
          "Operation \"" + op.name + "\" has no endpoint definitions.");
    }

    if (op.points.size() == 1) {
      ctx.point = op.points.get(0);
    }
    else {
      Map<String, Object> reqselector;
      Map<String, Object> selector;

      if ("data".equals(op.input)) {
        reqselector = ctx.reqdata;
        selector = ctx.data;
      }
      else {
        reqselector = ctx.reqmatch;
        selector = ctx.match;
      }

      Map<String, Object> point = null;
      for (int i = 0; i < op.points.size(); i++) {
        point = op.points.get(i);
        Map<String, Object> selectDef =
            Helpers.toMapAny(Struct.getprop(point, "select"));
        boolean found = true;

        if (selector != null && selectDef != null) {
          Object exist = Struct.getprop(selectDef, "exist");
          if (exist instanceof List) {
            for (Object ek : (List<Object>) exist) {
              String existkey = ek instanceof String ? (String) ek : "";
              Object rv = Struct.getprop(reqselector, existkey, null);
              Object sv = Struct.getprop(selector, existkey, null);
              if (rv == null && sv == null) {
                found = false;
                break;
              }
            }
          }
        }

        if (found) {
          Object reqAction = Struct.getprop(reqselector, "$action", null);
          Object selectAction = Struct.getprop(selectDef, "$action", null);
          if (!java.util.Objects.equals(reqAction, selectAction)) {
            found = false;
          }
        }

        if (found) {
          break;
        }
      }

      if (reqselector != null) {
        Object reqAction = Struct.getprop(reqselector, "$action", null);
        if (reqAction != null && point != null) {
          Map<String, Object> pointSelect =
              Helpers.toMapAny(Struct.getprop(point, "select"));
          Object pointAction = Struct.getprop(pointSelect, "$action", null);
          if (!java.util.Objects.equals(reqAction, pointAction)) {
            throw ctx.makeError("point_action_invalid",
                "Operation \"" + op.name
                    + "\" action \"" + Struct.stringify(reqAction) + "\" is not valid.");
          }
        }
      }

      ctx.point = point;
    }

    return ctx.point;
  }
}
