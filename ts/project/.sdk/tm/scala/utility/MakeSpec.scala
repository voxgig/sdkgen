package SCALAPACKAGE.utility

import java.util.{LinkedHashMap, List => JList, Map => JMap}
import SCALAPACKAGE.core._
import SCALAPACKAGE.utility.struct.Struct

object MakeSpec {
  def makeSpec(ctx: Context): Spec = {
    ctx.out.get("spec") match { case s: Spec => ctx.spec = s; return ctx.spec; case _ => }

    val point = ctx.point
    val options = ctx.options
    val utility = ctx.utility

    val base = Struct.getprop(options, "base")
    val prefix = Struct.getprop(options, "prefix")
    val suffix = Struct.getprop(options, "suffix")

    val parts = Struct.getprop(point, "parts")

    val specmap = new LinkedHashMap[String, Object]()
    specmap.put("base", base match { case s: String => s; case _ => "" })
    specmap.put("prefix", prefix match { case s: String => s; case _ => "" })
    parts match { case _: JList[_] => specmap.put("parts", parts); case _ => }
    specmap.put("suffix", suffix match { case s: String => s; case _ => "" })
    specmap.put("step", "start")
    ctx.spec = new Spec(specmap)

    ctx.spec.method = utility.prepareMethod(ctx)

    val allowMethod = Struct.getpath(options, java.util.List.of("allow", "method")) match { case s: String => s; case _ => "" }
    if (!allowMethod.contains(ctx.spec.method)) {
      throw ctx.makeError("spec_method_allow",
        "Method \"" + ctx.spec.method + "\" not allowed by SDK option allow.method value: \"" + allowMethod + "\"")
    }

    ctx.spec.params = utility.prepareParams(ctx)
    ctx.spec.query = utility.prepareQuery(ctx)
    ctx.spec.headers = utility.prepareHeaders(ctx)
    ctx.spec.body = utility.prepareBody(ctx)
    ctx.spec.path = utility.preparePath(ctx)

    if (ctx.ctrl.explain != null) ctx.ctrl.explain.put("spec", ctx.spec)

    val spec = utility.prepareAuth(ctx)
    ctx.spec = spec
    spec
  }
}
