package JAVAPACKAGE.utility;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import JAVAPACKAGE.core.Context;
import JAVAPACKAGE.core.Helpers;
import JAVAPACKAGE.utility.struct.Struct;

@SuppressWarnings({"unchecked"})
final class PrepareHeaders {

  private PrepareHeaders() {}

  static Map<String, Object> prepareHeaders(Context ctx) {
    Map<String, Object> options = ctx.client.optionsMap();

    Object headers = Struct.getprop(options, "headers");
    Map<String, Object> out = headers == null ? null : Helpers.toMapAny(Struct.clone(headers));
    if (out == null) {
      out = new LinkedHashMap<>();
    }

    // A header parameter travels as a header, under the name the definition
    // gives it, and only from this call's own arguments.
    Object hl = ctx.point == null ? null : Struct.getpath(ctx.point, List.of("args", "header"));
    if (hl instanceof List) {
      for (Object hd : (List<Object>) hl) {
        Object name = Struct.getprop(hd, "name");
        if (!(name instanceof String) || ((String) name).isEmpty()) {
          continue;
        }
        Object orig = Struct.getprop(hd, "orig");
        String wire = orig instanceof String && !((String) orig).isEmpty() ? (String) orig : (String) name;
        Object val = ctx.reqmatch == null ? null : Struct.getprop(ctx.reqmatch, name, null);
        if (val == null && ctx.reqdata != null) {
          val = Struct.getprop(ctx.reqdata, name, null);
        }
        if (val != null) {
          out.put(wire.toLowerCase(Locale.ROOT), Struct.stringify(val));
        }
      }
    }

    return out;
  }
}
