package JAVAPACKAGE.utility;

import java.util.Map;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.Helpers;

@SuppressWarnings({"unchecked"})
final class Done {

  private Done() {}

  static Object done(Context ctx) {
    if (ctx.ctrl.explain != null) {
      ctx.ctrl.explain = (Map<String, Object>) Clean.clean(ctx, ctx.ctrl.explain);
      Object explainResult = ctx.ctrl.explain.get("result");
      Map<String, Object> rm = Helpers.toMapAny(explainResult);
      if (rm != null) {
        rm.remove("err");
      }
    }

    // An operation resolves to the ENTITY, not the raw data. Entities are
    // stateful: the op fragment has just absorbed resdata/resmatch into this
    // instance, and the caller reaches the record through .data(). Two
    // structural exceptions: `list` resolves to the ARRAY of entity
    // instances makeResult built, and a context with no entity
    // (direct/prepare, streaming) has nothing to return but the data. A
    // removed entity keeps its data but is no longer live. See AGENTS.md.
    if (ctx.result != null && ctx.result.ok) {
      Entity entity = ctx.entity;
      String opname = ctx.op == null ? null : ctx.op.name;

      if (entity != null && !"list".equals(opname)) {
        if ("remove".equals(opname)) {
          entity.markDeleted();
        }
        return entity;
      }

      return ctx.result.resdata;
    }

    return MakeError.makeError(ctx, null);
  }
}
