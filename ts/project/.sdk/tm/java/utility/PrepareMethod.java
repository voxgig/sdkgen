package JAVAPACKAGE.utility;

import java.util.Map;

import JAVAPACKAGE.core.Context;

final class PrepareMethod {

  private PrepareMethod() {}

  private static final Map<String, String> METHOD_MAP = Map.of(
      "create", "POST",
      "update", "PUT",
      "load", "GET",
      "list", "GET",
      "remove", "DELETE",
      "patch", "PATCH");

  static String prepareMethod(Context ctx) {
    String opname = ctx.op.name;

    String m = METHOD_MAP.get(opname);
    if (m != null) {
      return m;
    }
    return "GET";
  }
}
