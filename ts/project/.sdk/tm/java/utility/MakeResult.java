package JAVAPACKAGE.utility;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.Entity;
import JAVAPACKAGE.core.Operation;
import JAVAPACKAGE.core.Result;
import JAVAPACKAGE.core.Spec;
import JAVAPACKAGE.core.Utility;

@SuppressWarnings({"unchecked"})
final class MakeResult {

  private MakeResult() {}

  static Result makeResult(Context ctx) {
    Object outResult = ctx.out.get("result");
    if (outResult instanceof Result) {
      return (Result) outResult;
    }

    Utility utility = ctx.utility;
    Operation op = ctx.op;
    Entity entity = ctx.entity;
    Spec spec = ctx.spec;
    Result result = ctx.result;

    if (spec == null) {
      throw ctx.makeError("result_no_spec",
          "Expected context spec property to be defined.");
    }
    if (result == null) {
      throw ctx.makeError("result_no_result",
          "Expected context result property to be defined.");
    }

    spec.step = "result";

    utility.transformResponse.apply(ctx);

    // Every operation resolves to PLAIN records — load, create, update and
    // list alike. `list` used to be the outlier: it wrapped each record in
    // an entity instance, so the same record came back with a different
    // type, a different key order and an extra marker depending on which
    // call produced it. Any consumer touching both paths had to normalise
    // defensively, and feeding a wrapped record into a host framework's own
    // metadata silently produced wrong entities with no error at all. A
    // missing or empty list still normalises to an empty list.
    if ("list".equals(op.name)) {
      Object resdata = result.resdata;
      result.resdata = (resdata instanceof List) ? resdata : new ArrayList<>();
    }

    if (ctx.ctrl.explain != null) {
      ctx.ctrl.explain.put("result", result);
    }

    return result;
  }
}
