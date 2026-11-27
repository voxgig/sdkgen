package JAVAPACKAGE.core;

import java.util.List;
import java.util.Map;

/** Small shared conversions used across the ProjectName SDK runtime. */
@SuppressWarnings({"unchecked"})
public final class Helpers {

  private Helpers() {}

  // unsupportedOp is thrown by entity stub methods for operations the
  // underlying API spec doesn't define. The static SdkEntity interface
  // requires every CRUD method on every entity, so absent ops must still be
  // callable — they error at runtime instead of failing to compile.
  public static SdkError unsupportedOp(String opname, String entityname) {
    return new SdkError("op_unsupported",
        "operation '" + opname + "' not supported by entity '" + entityname + "'", null);
  }

  // The custom action a call names: `$action` in its own request argument,
  // never in a response.
  public static String opAction(Context ctx) {
    if (ctx == null || ctx.op == null) {
      return null;
    }
    Map<String, Object> req = "data".equals(ctx.op.input) ? ctx.reqdata : ctx.reqmatch;
    Object action = req == null ? null : req.get("$action");
    return action instanceof String && !((String) action).isEmpty() ? (String) action : null;
  }

  // The keys an operation is looked up and filed by, most specific first:
  // `<entity>.<op>:<action>`, `<entity>.<op>`, `<op>`, `*`.
  public static List<String> opKeys(Context ctx) {
    Operation op = ctx == null ? null : ctx.op;
    String name = op == null || op.name == null || op.name.isEmpty() ? "_" : op.name;
    // Operation holds `_` for an entity it was not given.
    String entity = op == null || op.entity == null || op.entity.isEmpty()
        || "_".equals(op.entity) ? null : op.entity;
    if (entity == null && ctx != null && ctx.entity != null) {
      entity = ctx.entity.getName();
    }
    if (entity == null || entity.isEmpty()) {
      entity = "_";
    }
    String base = entity + "." + name;
    String action = opAction(ctx);
    return action == null
        ? List.of(base, name, "*")
        : List.of(base + ":" + action, base, name, "*");
  }

  // The key a call is filed under where a consumer reads it: the first key,
  // with the caller's action cleaned as the `action` field of a record, so a
  // sensitive key name masks it as a registered secret does.
  public static String opFileKey(Context ctx) {
    List<String> keys = opKeys(ctx);
    String action = opAction(ctx);
    if (action == null) {
      return keys.get(0);
    }
    if (ctx.utility != null && ctx.utility.clean != null) {
      Map<String, Object> rec = new java.util.LinkedHashMap<>();
      rec.put("action", action);
      Map<String, Object> out = toMapAny(ctx.utility.clean.apply(ctx, rec));
      if (out != null && out.get("action") instanceof String) {
        action = (String) out.get("action");
      }
    }
    return keys.get(1) + ":" + action;
  }

  // Whether a comma-separated allow option names the item: whole names, any case.
  public static boolean allowed(Object names, String item) {
    if (!(names instanceof String) || null == item || item.isEmpty()) {
      return false;
    }
    for (String name : ((String) names).split(",", -1)) {
      if (name.trim().equalsIgnoreCase(item)) {
        return true;
      }
    }
    return false;
  }

  public static Map<String, Object> toMapAny(Object v) {
    if (v == null) {
      return null;
    }
    if (v instanceof Map) {
      return (Map<String, Object>) v;
    }
    return null;
  }

  public static int toInt(Object v) {
    if (v instanceof Number) {
      return ((Number) v).intValue();
    }
    return -1;
  }

  public static long toLong(Object v, long def) {
    if (v instanceof Number) {
      return ((Number) v).longValue();
    }
    return def;
  }

  static Object getCtxProp(Map<String, Object> m, String key) {
    if (m == null) {
      return null;
    }
    return m.get(key);
  }
}
