package KOTLINPACKAGE.entity

import KOTLINPACKAGE.core.Context
import KOTLINPACKAGE.core.Helpers
import KOTLINPACKAGE.core.SdkClient
import KOTLINPACKAGE.core.SdkEntity
import KOTLINPACKAGE.core.Utility
import KOTLINPACKAGE.utility.struct.Struct

/**
 * Shared entity runtime for the ProjectName SDK: accreting data/match state,
 * the entity context, and the operation pipeline (runOp) with its feature
 * hooks. Generated entity classes extend this.
 */
@Suppress("UNCHECKED_CAST")
abstract class EntityBase(nm: String, clientIn: SdkClient, entoptsIn: MutableMap<String, Any?>?) : SdkEntity {

  override var name: String = ""
  protected var client: SdkClient
  protected var utility: Utility
  protected var entopts: MutableMap<String, Any?>
  protected var data: MutableMap<String, Any?> = linkedMapOf()
  protected var match: MutableMap<String, Any?> = linkedMapOf()
  protected var entctx: Context

  init {
    val entopts = entoptsIn ?: linkedMapOf()
    if (!entopts.containsKey("active")) {
      entopts["active"] = true
    } else if (entopts["active"] == false) {
      // keep false
    } else {
      entopts["active"] = true
    }

    this.name = nm
    this.client = clientIn
    this.utility = clientIn.getUtility()
    this.entopts = entopts

    val ctxmap = linkedMapOf<String, Any?>()
    ctxmap["entity"] = this
    ctxmap["entopts"] = entopts
    this.entctx = this.utility.makeContext(ctxmap, clientIn.getRootCtx())

    this.utility.featureHook(this.entctx, "PostConstructEntity")
  }

  override fun data(vararg args: Any?): Any? {
    if (args.isNotEmpty() && args[0] != null) {
      val d = Helpers.toMapAny(Struct.clone(args[0]))
      this.data = d ?: linkedMapOf()
      this.utility.featureHook(this.entctx, "SetData")
    }

    this.utility.featureHook(this.entctx, "GetData")
    return Struct.clone(this.data)
  }

  override fun match(vararg args: Any?): Any? {
    if (args.isNotEmpty() && args[0] != null) {
      val m = Helpers.toMapAny(Struct.clone(args[0]))
      this.match = m ?: linkedMapOf()
      this.utility.featureHook(this.entctx, "SetMatch")
    }

    this.utility.featureHook(this.entctx, "GetMatch")
    return Struct.clone(this.match)
  }

  // runOp drives one operation through the pipeline: for each stage the
  // feature hook fires, then the stage runs; a failing stage routes through
  // makeError (which throws, or returns fallback data when ctrl.throw false).
  protected fun runOp(ctx: Context, postDone: () -> Unit): Any? {
    val utility = this.utility

    try {
// #PrePoint-Hook

      val point = utility.makePoint(ctx)
      ctx.out["point"] = point

// #PreSpec-Hook

      val spec = utility.makeSpec(ctx)
      ctx.out["spec"] = spec

// #PreRequest-Hook

      val request = utility.makeRequest(ctx)
      ctx.out["request"] = request

// #PreResponse-Hook

      val response = utility.makeResponse(ctx)
      ctx.out["response"] = response

// #PreResult-Hook

      val result = utility.makeResult(ctx)
      ctx.out["result"] = result

// #PreDone-Hook

      postDone()

      return utility.done(ctx)
    } catch (err: RuntimeException) {
      // An error already finalised by makeError (e.g. via done) must not be
      // wrapped a second time.
      if (err === ctx.ctrl.err) {
        throw err
      }
      return utility.makeError(ctx, err)
    }
  }
}
