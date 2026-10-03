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

    // A cookie argument travels in the cookie header, form serialized and
    // percent-encoded, replacing a cookie of the same name among those the
    // caller's headers already send.
    List<Param.CallArg> sent = new ArrayList<>();
    for (Param.CallArg arg : Param.callArgs(ctx, "cookie")) {
      if (arg.val() != null) {
        sent.add(arg);
      }
    }
    if (!sent.isEmpty()) {
      List<String> names = new ArrayList<>();
      for (Param.CallArg arg : sent) {
        if (arg.val() instanceof Map<?, ?> map) {
          for (String key : Struct.keysof(map)) {
            names.add(Struct.escurl(key));
          }
        } else {
          names.add(arg.wire());
        }
      }
      List<String> kept = new ArrayList<>();
      for (String k : new ArrayList<>(out.keySet())) {
        if (k == null || !"cookie".equals(k.toLowerCase(Locale.ROOT))) {
          continue;
        }
        Object given = out.remove(k);
        if (given instanceof String) {
          kept.addAll(cookieKeep((String) given, names));
        }
      }
      for (Param.CallArg arg : sent) {
        String pair = cookiePair(arg.wire(), arg.val());
        if (!pair.isEmpty()) {
          kept.add(pair);
        }
      }
      if (!kept.isEmpty()) {
        out.put("cookie", String.join("; ", kept));
      }
    }

    return out;
  }

  // The form style of a cookie parameter: a list repeats the name, a map sends
  // its own keys, and every value is percent-encoded.
  private static String cookiePair(String wire, Object val) {
    List<String> pairs = new ArrayList<>();
    if (val instanceof List<?> items) {
      for (Object item : items) {
        pairs.add(wire + "=" + Struct.escurl(Struct.stringify(item)));
      }
    } else if (val instanceof Map<?, ?> map) {
      for (String key : Struct.keysof(map)) {
        pairs.add(Struct.escurl(key) + "=" + Struct.escurl(Struct.stringify(map.get(key))));
      }
    } else {
      pairs.add(wire + "=" + Struct.escurl(Struct.stringify(val)));
    }
    return String.join("&", pairs);
  }

  // The caller's cookie pieces with every named cookie removed. A piece whose
  // &-parts are all pairs is the exploded form cookiePair writes, and loses
  // only the pairs named; any other piece is one cookie, kept or dropped whole.
  static List<String> cookieKeep(String header, List<String> names) {
    List<String> kept = new ArrayList<>();
    for (String piece : header.split(";", -1)) {
      String[] parts = piece.split("&", -1);
      boolean pairs = true;
      for (String part : parts) {
        if (!part.contains("=")) {
          pairs = false;
        }
      }
      List<String> rest = new ArrayList<>();
      if (pairs) {
        for (String part : parts) {
          if (!cookieNamed(part, names)) {
            rest.add(part);
          }
        }
      } else if (!cookieNamed(piece, names)) {
        rest.add(piece);
      }
      String cookie = String.join("&", rest).trim();
      if (!cookie.isEmpty()) {
        kept.add(cookie);
      }
    }
    return kept;
  }

  private static boolean cookieNamed(String part, List<String> names) {
    return names.contains(part.split("=", 2)[0].trim());
  }
}
