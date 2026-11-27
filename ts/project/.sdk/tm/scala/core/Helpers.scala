package SCALAPACKAGE.core

// Small shared conversions used across the ProjectName SDK runtime.

import java.util.{LinkedHashMap, List => JList, Map => JMap}

object Helpers {

  // unsupportedOp is thrown by entity stub methods for operations the
  // underlying API spec doesn't define. The static SdkEntity contract
  // requires every CRUD method on every entity, so absent ops must still be
  // callable — they error at runtime instead of failing to compile.
  // The custom action a call names: `$action` in its own request argument,
  // never in a response.
  def opAction(ctx: Context): String = {
    if (ctx == null || ctx.op == null) return null
    val req = if ("data" == ctx.op.input) ctx.reqdata else ctx.reqmatch
    if (req == null) return null
    req.get("$action") match {
      case s: String if s.nonEmpty => s
      case _ => null
    }
  }

  // The keys an operation is looked up and filed by, most specific first:
  // `<entity>.<op>:<action>`, `<entity>.<op>`, `<op>`, `*`.
  def opKeys(ctx: Context): JList[String] = {
    val op = if (ctx == null) null else ctx.op
    val name = if (op == null || op.name == null || op.name.isEmpty) "_" else op.name
    // Operation holds `_` for an entity it was not given.
    var entity: String =
      if (op == null || op.entity == null || op.entity.isEmpty || "_" == op.entity) null
      else op.entity
    if (entity == null && ctx != null && ctx.entity != null) entity = ctx.entity.getName()
    if (entity == null || entity.isEmpty) entity = "_"
    val base = entity + "." + name
    val action = opAction(ctx)
    if (action == null) JList.of(base, name, "*")
    else JList.of(base + ":" + action, base, name, "*")
  }

  // Whether a comma-separated allow option names the item: whole names, any case.
  def allowed(names: Object, item: String): Boolean = names match {
    case list: String if null != item && item.nonEmpty =>
      list.split(",", -1).exists(_.trim.equalsIgnoreCase(item))
    case _ => false
  }

  def unsupportedOp(opname: String, entityname: String): SdkError =
    new SdkError("op_unsupported",
      "operation '" + opname + "' not supported by entity '" + entityname + "'", null)

  def toMapAny(v: Object): JMap[String, Object] = v match {
    case null => null
    case m: JMap[_, _] => m.asInstanceOf[JMap[String, Object]]
    case _ => null
  }

  def toInt(v: Object): Int = v match {
    case n: java.lang.Number => n.intValue()
    case _ => -1
  }

  def toLong(v: Object, dflt: Long): Long = v match {
    case n: java.lang.Number => n.longValue()
    case _ => dflt
  }

  def getCtxProp(m: JMap[String, Object], key: String): Object =
    if (m == null) null else m.get(key)

  // Convenience mutable-map/list constructors (java.util for Struct interop).
  def jmap(): LinkedHashMap[String, Object] = new LinkedHashMap[String, Object]()
}
