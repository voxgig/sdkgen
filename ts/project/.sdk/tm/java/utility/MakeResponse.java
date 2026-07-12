package JAVAPACKAGE.utility;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.Response;
import JAVAPACKAGE.core.Result;
import JAVAPACKAGE.core.Spec;
import JAVAPACKAGE.core.Utility;

final class MakeResponse {

  private MakeResponse() {}

  static Response makeResponse(Context ctx) {
    Object outResponse = ctx.out.get("response");
    if (outResponse instanceof Response) {
      return (Response) outResponse;
    }

    Utility utility = ctx.utility;
    Spec spec = ctx.spec;
    Result result = ctx.result;
    Response response = ctx.response;

    if (spec == null) {
      throw ctx.makeError("response_no_spec",
          "Expected context spec property to be defined.");
    }
    if (response == null) {
      throw ctx.makeError("response_no_response",
          "Expected context response property to be defined.");
    }
    if (result == null) {
      throw ctx.makeError("response_no_result",
          "Expected context result property to be defined.");
    }

    spec.step = "response";

    utility.resultBasic.apply(ctx);
    utility.resultHeaders.apply(ctx);
    utility.resultBody.apply(ctx);
    utility.transformResponse.apply(ctx);

    if (result.err == null) {
      result.ok = true;
    }

    if (ctx.ctrl.explain != null) {
      ctx.ctrl.explain.put("result", result);
    }

    return response;
  }
}
