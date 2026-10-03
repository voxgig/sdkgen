package JAVAPACKAGE.utility;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.Helpers;
import JAVAPACKAGE.utility.struct.Struct;

final class PrepareHeaders {

  private PrepareHeaders() {}

  static Map<String, Object> prepareHeaders(Context ctx) {
    Map<String, Object> options = ctx.client.optionsMap();

    Object headers = Struct.getprop(options, "headers");
    Map<String, Object> out = headers == null ? null : Helpers.toMapAny(Struct.clone(headers));
    if (out == null) {
      out = new LinkedHashMap<>();
    }
    out = Media.headers(ctx.point, out);

    // A header argument replaces a default of the same name, whatever its case.
    for (Param.CallArg arg : Param.callArgs(ctx, "header")) {
      if (arg.val() != null) {
        String key = arg.wire().toLowerCase(Locale.ROOT);
        out.keySet().removeIf(k -> k != null && k.toLowerCase(Locale.ROOT).equals(key));
        out.put(key, Struct.stringify(arg.val()));
      }
    }

    // A cookie argument travels in the cookie header as name=value, after any
    // cookies the caller's headers already send.
    List<String> cookies = new ArrayList<>();
    for (Param.CallArg arg : Param.callArgs(ctx, "cookie")) {
      if (arg.val() != null) {
        cookies.add(arg.wire() + "=" + Struct.stringify(arg.val()));
      }
    }
    if (!cookies.isEmpty()) {
      List<String> sent = new ArrayList<>();
      for (String k : new ArrayList<>(out.keySet())) {
        if (k != null && "cookie".equals(k.toLowerCase(Locale.ROOT))) {
          Object given = out.remove(k);
          if (given instanceof String && !((String) given).isEmpty()) {
            sent.add((String) given);
          }
        }
      }
      sent.addAll(cookies);
      out.put("cookie", String.join("; ", sent));
    }

    return out;
  }
}
