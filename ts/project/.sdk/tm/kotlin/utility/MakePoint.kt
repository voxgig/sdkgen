package KOTLINPACKAGE.utility

import KOTLINPACKAGE.core.Context
import KOTLINPACKAGE.core.Helpers
import KOTLINPACKAGE.utility.struct.Struct

@Suppress("UNCHECKED_CAST")
fun makePoint(ctx: Context): Map<String, Any?> {
  val outPoint = ctx.out["point"]
  if (outPoint != null) {
    // A PrePoint feature hook (e.g. rbac) may short-circuit the
    // operation by storing an error here; surface it before any
    // endpoint resolution or network activity.
    if (outPoint is RuntimeException) {
      throw outPoint
    }
    if (outPoint is MutableMap<*, *>) {
      ctx.point = outPoint as MutableMap<String, Any?>
      return ctx.point!!
    }
  }

  val op = ctx.op
  val options = ctx.options

  val allowOpRaw = Struct.getpath(options, listOf("allow", "op"))
  val allowOp = if (allowOpRaw is String) allowOpRaw else ""
  if (!allowOp.contains(op.name)) {
    throw ctx.makeError(
      "point_op_allow",
      "Operation \"" + op.name +
        "\" not allowed by SDK option allow.op value: \"" + allowOp + "\"",
    )
  }

  if (op.points.isEmpty()) {
    throw ctx.makeError(
      "point_no_points",
      "Operation \"" + op.name + "\" has no endpoint definitions.",
    )
  }

  if (op.points.size == 1) {
    ctx.point = op.points[0]
  } else {
    val reqselector: MutableMap<String, Any?>?
    val selector: MutableMap<String, Any?>?

    if ("data" == op.input) {
      reqselector = ctx.reqdata
      selector = ctx.data
    } else {
      reqselector = ctx.reqmatch
      selector = ctx.match
    }

    var point: MutableMap<String, Any?>? = null
    for (i in op.points.indices) {
      point = op.points[i]
      val selectDef = Helpers.toMapAny(Struct.getprop(point, "select"))
      var found = true

      if (selectDef != null) {
        val exist = Struct.getprop(selectDef, "exist")
        if (exist is List<*>) {
          for (ek in exist) {
            val existkey = if (ek is String) ek else ""
            val rv = Struct.getprop(reqselector, existkey, null)
            val sv = Struct.getprop(selector, existkey, null)
            if (rv == null && sv == null) {
              found = false
              break
            }
          }
        }
      }

      if (found) {
        val reqAction = Struct.getprop(reqselector, "\$action", null)
        val selectAction = Struct.getprop(selectDef, "\$action", null)
        if (reqAction != selectAction) {
          found = false
        }
      }

      if (found) {
        break
      }
    }

    val reqAction = Struct.getprop(reqselector, "\$action", null)
    if (reqAction != null && point != null) {
      val pointSelect = Helpers.toMapAny(Struct.getprop(point, "select"))
      val pointAction = Struct.getprop(pointSelect, "\$action", null)
      if (reqAction != pointAction) {
        throw ctx.makeError(
          "point_action_invalid",
          "Operation \"" + op.name +
            "\" action \"" + Struct.stringify(reqAction) + "\" is not valid.",
        )
      }
    }

    ctx.point = point
  }

  return ctx.point!!
}
