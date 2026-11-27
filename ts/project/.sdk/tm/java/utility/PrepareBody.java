package JAVAPACKAGE.utility;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import JAVAPACKAGE.core.BinarySource;
import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.Utility;
import JAVAPACKAGE.utility.struct.Struct;

final class PrepareBody {

  private PrepareBody() {}

  static Object prepareBody(Context ctx) {
    if ("data".equals(ctx.op.input)) {
      Sources.liftSources(ctx);

      if (Media.isRawRequest(ctx.point)) {
        Object raw = ctx.sources.get(Media.RAW_BODY);
        return Media.rawBody(raw instanceof BinarySource ? ((BinarySource) raw).data : raw);
      }

      Object body = ctx.utility.transformRequest.apply(ctx);

      Object kind = Struct.getprop(Struct.getprop(ctx.point, "body"), "kind");
      if ("form".equals(kind) || "multipart".equals(kind)) {
        return encodeBody(ctx, (String) kind, body);
      }
      return body;
    }

    Object fields = Struct.getprop(ctx.point, "fields");
    if (fields instanceof List && !((List<?>) fields).isEmpty()) {
      return matchBody(ctx, (List<?>) fields);
    }

    return null;
  }

  // The encoded body, with its content type replacing any the headers carry:
  // a multipart boundary is the encoder's alone to choose.
  private static Object encodeBody(Context ctx, String kind, Object data) {
    Object encode = ctx.utility.codec == null ? null : ctx.utility.codec.get(kind);
    if (!(encode instanceof Utility.EncodeFn)) {
      throw ctx.makeError("body_codec_missing",
          "This SDK was generated without a " + kind + " encoder.");
    }

    Map<String, Object> encoded = ((Utility.EncodeFn) encode).encode(ctx, data,
        ctx.sources == null ? new LinkedHashMap<>() : ctx.sources);

    if (ctx.spec != null && ctx.spec.headers != null) {
      ctx.spec.headers.keySet().removeIf((key) -> key != null
          && "content-type".equals(key.toLowerCase(Locale.ROOT)));
      ctx.spec.headers.put("content-type", encoded.get("type"));
    }

    return encoded.get("body");
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
