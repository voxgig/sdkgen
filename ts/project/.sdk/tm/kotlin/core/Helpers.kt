package KOTLINPACKAGE.core

/** Small shared conversions used across the ProjectName SDK runtime. */
object Helpers {

  // unsupportedOp is thrown by entity stub methods for operations the
  // underlying API spec doesn't define. The static SdkEntity interface
  // requires every CRUD method on every entity, so absent ops must still be
  // callable — they error at runtime instead of failing to compile.
  fun unsupportedOp(opname: String, entityname: String): SdkError {
    return SdkError(
      "op_unsupported",
      "operation '" + opname + "' not supported by entity '" + entityname + "'",
      null,
    )
  }

  // The custom action a call names: `$action` in its own request argument,
  // never in a response.
  fun opAction(ctx: Context): String? {
    val req = if ("data" == ctx.op.input) ctx.reqdata else ctx.reqmatch
    val action = req["\$action"]
    return if (action is String && action.isNotEmpty()) action else null
  }

  // The keys an operation is looked up and filed by, most specific first:
  // `<entity>.<op>:<action>`, `<entity>.<op>`, `<op>`, `*`.
  fun opKeys(ctx: Context): List<String> {
    val name = if ("" == ctx.op.name) "_" else ctx.op.name
    // Operation holds `_` for an entity it was not given.
    var entity: String? = if ("" == ctx.op.entity || "_" == ctx.op.entity) null else ctx.op.entity
    if (entity == null) {
      entity = ctx.entity?.name
    }
    if (entity.isNullOrEmpty()) {
      entity = "_"
    }
    val base = "$entity.$name"
    val action = opAction(ctx) ?: return listOf(base, name, "*")
    return listOf("$base:$action", base, name, "*")
  }

  // The key a call is filed under where a consumer reads it: the first key,
  // with the caller's action cleaned as the `action` field of a record, so a
  // sensitive key name masks it as a registered secret does.
  fun opFileKey(ctx: Context): String {
    val keys = opKeys(ctx)
    val action = opAction(ctx) ?: return keys[0]
    val out = toMapAny(ctx.utility?.clean?.invoke(ctx, linkedMapOf<String, Any?>("action" to action)))
    val cleaned = out?.get("action") as? String ?: action
    return keys[1] + ":" + cleaned
  }

  // Whether a comma-separated allow option names the item: whole names, any case.
  fun allowed(names: Any?, item: String?): Boolean {
    if (names !is String || item.isNullOrEmpty()) {
      return false
    }
    return names.split(",").any { it.trim().equals(item, ignoreCase = true) }
  }

  @Suppress("UNCHECKED_CAST")
  fun toMapAny(v: Any?): MutableMap<String, Any?>? {
    if (v == null) {
      return null
    }
    if (v is MutableMap<*, *>) {
      return v as MutableMap<String, Any?>
    }
    return null
  }

  fun toInt(v: Any?): Int {
    if (v is Number) {
      return v.toInt()
    }
    return -1
  }

  fun toLong(v: Any?, def: Long): Long {
    if (v is Number) {
      return v.toLong()
    }
    return def
  }

  fun getCtxProp(m: Map<String, Any?>?, key: String): Any? {
    if (m == null) {
      return null
    }
    return m[key]
  }
}
