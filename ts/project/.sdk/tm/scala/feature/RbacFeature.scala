package SCALAPACKAGE.feature

import java.util.{LinkedHashMap, List => JList, Map => JMap}
import SCALAPACKAGE.core.{Context, Helpers, SdkClient}

// Client-side role/permission enforcement. Before an operation resolves its
// endpoint, the required permission is checked against the held permissions;
// a disallowed call is short-circuited with an `rbac_denied` error (via
// ctx.out["point"], which makePoint surfaces) and never touches the network.
// Required permissions come from `rules`, keyed by `<entity>.<op>:<action>`,
// `<entity>.<op>`, `<op>` or `*`, most specific first.
class RbacFeature extends BaseFeature("rbac", "0.0.1", true) {

  private var client: SdkClient = null
  private var options: JMap[String, Object] = null
  private var granted: JMap[String, java.lang.Boolean] = new LinkedHashMap[String, java.lang.Boolean]()

  var allowed: Int = 0
  var denied: Int = 0
  var last: JMap[String, Object] = null

  override def init(ctx: Context, options: JMap[String, Object]): Unit = {
    this.client = ctx.client
    this.options = options
    this.active = FeatureOptions.foptBool(options, "active", false)

    this.granted = new LinkedHashMap[String, java.lang.Boolean]()
    val permissions = FeatureOptions.foptStrList(this.options, "permissions")
    if (permissions != null) {
      val it = permissions.iterator()
      while (it.hasNext) this.granted.put(it.next(), java.lang.Boolean.TRUE)
    }
  }

  override def prePoint(ctx: Context): Unit = {
    if (!this.active) return

    val required = requiredPerm(ctx)
    if (required == null) {
      if (FeatureOptions.foptBool(this.options, "deny", false)) reject(ctx, "<default-deny>")
      return
    }

    if ((java.lang.Boolean.TRUE == this.granted.get("*")) || (java.lang.Boolean.TRUE == this.granted.get(required))) {
      track(ctx, required, true)
      return
    }

    reject(ctx, required)
  }

  private def requiredPerm(ctx: Context): String = {
    val rules = FeatureOptions.foptMap(this.options, "rules")
    if (rules == null) return null

    val it = Helpers.opKeys(ctx).iterator()
    while (it.hasNext) {
      rules.get(it.next()) match { case s: String => return s; case _ => }
    }
    null
  }

  private def reject(ctx: Context, required: String): Unit = {
    track(ctx, required, false)

    var opname = "?"
    if (ctx.op != null) opname = ctx.op.name
    val action = Helpers.opAction(ctx)
    if (action != null) opname = opname + ":" + action
    val err = ctx.makeError("rbac_denied",
      "Permission \"" + required + "\" required for operation \"" + opname + "\"")

    ctx.out.put("point", err)
  }

  private def track(ctx: Context, required: String, wasAllowed: Boolean): Unit = {
    if (wasAllowed) this.allowed += 1 else this.denied += 1
    var opname = ""
    if (ctx.op != null) opname = ctx.op.name
    val rec = new LinkedHashMap[String, Object]()
    rec.put("required", required)
    rec.put("allowed", java.lang.Boolean.valueOf(wasAllowed))
    rec.put("op", opname)
    val action = Helpers.opAction(ctx)
    if (action != null) rec.put("action", action)
    this.last = rec
  }
}
