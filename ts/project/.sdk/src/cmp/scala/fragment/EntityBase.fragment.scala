package SCALAPACKAGE.entity

import java.util.{LinkedHashMap, Map => JMap}
import SCALAPACKAGE.core.{Context, Helpers, SdkClient, SdkEntity, Utility}
import SCALAPACKAGE.utility.struct.Struct

// Shared entity runtime for the ProjectName SDK: accreting data/match state,
// the entity context, and the operation pipeline (runOp) with its feature
// hooks. Generated entity classes extend this.
abstract class EntityBase(name0: String, client0: SdkClient, entopts0: JMap[String, Object]) extends SdkEntity {

  protected var name: String = name0
  protected var client: SdkClient = client0
  protected var utility: Utility = null
  protected var entopts: JMap[String, Object] = null
  protected var dataState: JMap[String, Object] = new LinkedHashMap[String, Object]()
  protected var matchState: JMap[String, Object] = new LinkedHashMap[String, Object]()
  protected var entctx: Context = null

  locally {
    var eo = entopts0
    if (eo == null) eo = new LinkedHashMap[String, Object]()
    if (!eo.containsKey("active")) eo.put("active", java.lang.Boolean.TRUE)
    else if (java.lang.Boolean.FALSE == eo.get("active")) { /* keep false */ }
    else eo.put("active", java.lang.Boolean.TRUE)

    this.entopts = eo
    this.utility = client0.getUtility()

    val ctxmap = new LinkedHashMap[String, Object]()
    ctxmap.put("entity", this)
    ctxmap.put("entopts", eo)
    this.entctx = this.utility.makeContext(ctxmap, client0.getRootCtx())

    this.utility.featureHook(this.entctx, "PostConstructEntity")
  }

  def getName(): String = this.name

  override def data(args: Object*): Object = {
    if (args.length > 0 && args(0) != null) {
      val d = Helpers.toMapAny(Struct.clone(args(0)))
      this.dataState = if (d == null) new LinkedHashMap[String, Object]() else d
      this.utility.featureHook(this.entctx, "SetData")
    }
    this.utility.featureHook(this.entctx, "GetData")
    Struct.clone(this.dataState)
  }

  override def matchArgs(args: Object*): Object = {
    if (args.length > 0 && args(0) != null) {
      val m = Helpers.toMapAny(Struct.clone(args(0)))
      this.matchState = if (m == null) new LinkedHashMap[String, Object]() else m
      this.utility.featureHook(this.entctx, "SetMatch")
    }
    this.utility.featureHook(this.entctx, "GetMatch")
    Struct.clone(this.matchState)
  }

  // runOp drives one operation through the pipeline: for each stage the
  // feature hook fires, then the stage runs; a failing stage routes through
  // makeError (which throws, or returns fallback data when ctrl.throw false).
  protected def runOp(ctx: Context, postDone: () => Unit): Object = {
    val utility = this.utility

    try {
// #PrePoint-Hook

      val point = utility.makePoint(ctx)
      ctx.out.put("point", point)

// #PreSpec-Hook

      val spec = utility.makeSpec(ctx)
      ctx.out.put("spec", spec)

// #PreRequest-Hook

      val request = utility.makeRequest(ctx)
      ctx.out.put("request", request)

// #PreResponse-Hook

      val response = utility.makeResponse(ctx)
      ctx.out.put("response", response)

// #PreResult-Hook

      val result = utility.makeResult(ctx)
      ctx.out.put("result", result)

// #PreDone-Hook

      postDone()

      utility.done(ctx)
    } catch {
      case err: RuntimeException =>
        // An error already finalised by makeError must not be wrapped twice.
        if (err eq ctx.ctrl.err) throw err
        utility.makeError(ctx, err)
    }
  }
}
