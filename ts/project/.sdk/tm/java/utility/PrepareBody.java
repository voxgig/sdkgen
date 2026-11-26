package JAVAPACKAGE.utility;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.utility.struct.Struct;

final class PrepareBody {

  private PrepareBody() {}

  static Object prepareBody(Context ctx) {
    if ("data".equals(ctx.op.input)) {
      if (Media.isRawRequest(ctx.point)) {
        return Media.rawBody(ctx.reqdata);
      }
      return ctx.utility.transformRequest.apply(ctx);
    }

    Object fields = Struct.getprop(ctx.point, "fields");
    if (fields instanceof List && !((List<?>) fields).isEmpty()) {
      return matchBody(ctx, (List<?>) fields);
    }

    return null;
  }

  // A list, load or remove routed to a method with a body sends the match
  // fields that body declares, never a path parameter, and never a header,
  // cookie or query argument the body does not also declare as a field.
  private static Map<String, Object> matchBody(Context ctx, List<?> fields) {
    List<Object> routed = new ArrayList<>();
    Object pl = Struct.getprop(ctx.point, "params");
    if (pl instanceof List) {
      routed.addAll((List<?>) pl);
    }
    Object apl = Struct.getpath(ctx.point, List.of("args", "params"));
    if (apl instanceof List) {
      for (Object pd : (List<?>) apl) {
        routed.add(Struct.getprop(pd, "name"));
      }
    }
    for (String kind : List.of("header", "cookie", "query")) {
      Object defs = Struct.getpath(ctx.point, List.of("args", kind));
      if (defs instanceof List) {
        for (Object ad : (List<?>) defs) {
          if (!Boolean.TRUE.equals(Struct.getprop(ad, "field", null))) {
            routed.add(Struct.getprop(ad, "name"));
          }
        }
      }
    }

    Map<String, Object> body = new LinkedHashMap<>();
    for (Object name : fields) {
      if (!(name instanceof String)) {
        continue;
      }
      Object val = Struct.getprop(ctx.reqmatch, name, null);
      if (val != null && !"$action".equals(name) && !routed.contains(name)) {
        body.put((String) name, val);
      }
    }
    return body;
  }
}
