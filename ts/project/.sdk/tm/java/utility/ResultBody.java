package JAVAPACKAGE.utility;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.Response;
import JAVAPACKAGE.core.Result;
import JAVAPACKAGE.core.Utility;
import JAVAPACKAGE.utility.struct.Struct;

final class ResultBody {

  private ResultBody() {}

  static Result resultBody(Context ctx) {
    Response response = ctx.response;
    Result result = ctx.result;

    if (result != null) {
      Object raw = ctx.utility.codec == null ? null : ctx.utility.codec.get("raw");
      if (response != null && raw instanceof Utility.RawFn
          && "raw".equals(Struct.getprop(Struct.getprop(ctx.point, "response"), "kind"))
          && result.err == null && response.err == null && result.status < 400) {
        ((Utility.RawFn) raw).read(ctx);
        return result;
      }
      if (response != null && response.jsonFunc != null && response.body != null) {
        result.body = response.jsonFunc.get();
      }
      if (response != null && response.unreadable) {
        Object sent = ctx.spec == null ? null : ctx.spec.headers;
        result.err = Response.unreadableBody(ctx, result.status, result.headers, response.body,
            sent, result.err);
      }
    }

    return result;
  }
}
