package KOTLINPACKAGE.core

import java.util.function.Supplier

import KOTLINPACKAGE.utility.struct.Struct

/**
 * Shared client runtime for the ProjectName SDK. The generated
 * ProjectNameSDK class extends this with the API-specific entity accessors;
 * everything transport- and pipeline-related lives here so features and
 * utilities can reference a fixed type.
 */
@Suppress("UNCHECKED_CAST")
abstract class SdkClient(sdkopts: MutableMap<String, Any?>?) {

  var mode: String = "live"
  var features: MutableList<Feature> = mutableListOf()

  protected val util: Utility = Utility()
  protected var options: MutableMap<String, Any?> = linkedMapOf()
  protected val rootctx: Context

  init {
    val config = Config.makeConfig()

    val ctxmap = linkedMapOf<String, Any?>()
    ctxmap["client"] = this
    ctxmap["utility"] = this.util
    ctxmap["config"] = config
    if (sdkopts != null) {
      ctxmap["options"] = sdkopts
    }
    ctxmap["shared"] = linkedMapOf<String, Any?>()

    this.rootctx = this.util.makeContext(ctxmap, null)

    this.options = this.util.makeOptions(this.rootctx)

    if (Struct.getpath(this.options, listOf("feature", "test", "active")) == true) {
      this.mode = "test"
    }

    this.rootctx.options = this.options

    // Add features from config/options.
    val featureOpts = Helpers.toMapAny(Struct.getprop(this.options, "feature"))
    if (featureOpts != null) {
      for (item in Struct.items(featureOpts)) {
        val fname = item[0] as? String
        val fopts = Helpers.toMapAny(item[1])
        if (fname != null && fopts != null && fopts["active"] == true) {
          val f = Config.makeFeature(fname)
          this.util.featureAdd(this.rootctx, f)
        }
      }
    }

    // Add extension features.
    val extend = Struct.getprop(this.options, "extend")
    if (extend is List<*>) {
      for (f in extend) {
        if (f is Feature) {
          this.util.featureAdd(this.rootctx, f)
        }
      }
    }

    // Initialize features.
    for (f in ArrayList(this.features)) {
      this.util.featureInit(this.rootctx, f)
    }

    this.util.featureHook(this.rootctx, "PostConstruct")
  }

  fun optionsMap(): MutableMap<String, Any?> {
    val out = Struct.clone(this.options)
    if (out is MutableMap<*, *>) {
      return out as MutableMap<String, Any?>
    }
    return linkedMapOf()
  }

  fun getUtility(): Utility {
    return this.util.copy()
  }

  fun getRootCtx(): Context {
    return this.rootctx
  }

  fun prepare(fetchargsIn: MutableMap<String, Any?>?): MutableMap<String, Any?> {
    val utility = this.util

    val fetchargs = fetchargsIn ?: linkedMapOf()

    var ctrl = Helpers.toMapAny(Struct.getprop(fetchargs, "ctrl"))
    if (ctrl == null) {
      ctrl = linkedMapOf()
    }

    val ctxmap = linkedMapOf<String, Any?>()
    ctxmap["opname"] = "prepare"
    ctxmap["ctrl"] = ctrl
    val ctx = utility.makeContext(ctxmap, this.rootctx)

    val options = this.options

    val pathRaw = Struct.getprop(fetchargs, "path")
    val path = if (pathRaw is String) pathRaw else ""
    val methodRaw = Struct.getprop(fetchargs, "method")
    var method = if (methodRaw is String) methodRaw else ""
    if ("" == method) {
      method = "GET"
    }

    var params = Helpers.toMapAny(Struct.getprop(fetchargs, "params"))
    if (params == null) {
      params = linkedMapOf()
    }
    var query = Helpers.toMapAny(Struct.getprop(fetchargs, "query"))
    if (query == null) {
      query = linkedMapOf()
    }

    val headers = utility.prepareHeaders(ctx)

    val base = Struct.getprop(options, "base")
    val prefix = Struct.getprop(options, "prefix")
    val suffix = Struct.getprop(options, "suffix")

    val specmap = linkedMapOf<String, Any?>()
    specmap["base"] = if (base is String) base else ""
    specmap["prefix"] = if (prefix is String) prefix else ""
    specmap["suffix"] = if (suffix is String) suffix else ""
    specmap["path"] = path
    specmap["method"] = method
    specmap["params"] = params
    specmap["query"] = query
    specmap["headers"] = headers
    specmap["body"] = Struct.getprop(fetchargs, "body", null)
    specmap["step"] = "start"
    ctx.spec = Spec(specmap)

    // Merge user-provided headers.
    val uheaders = Helpers.toMapAny(Struct.getprop(fetchargs, "headers"))
    if (uheaders != null) {
      ctx.spec!!.headers.putAll(uheaders)
    }

    utility.prepareAuth(ctx)

    return utility.makeFetchDef(ctx)
  }

  fun direct(fetchargsIn: MutableMap<String, Any?>?): MutableMap<String, Any?> {
    val utility = this.util

    val fetchargs = fetchargsIn ?: linkedMapOf()

    var ctrl = Helpers.toMapAny(Struct.getprop(fetchargs, "ctrl"))
    if (ctrl == null) {
      ctrl = linkedMapOf()
    }

    val ctxmap = linkedMapOf<String, Any?>()
    ctxmap["opname"] = "direct"
    ctxmap["ctrl"] = ctrl
    val ctx = utility.makeContext(ctxmap, this.rootctx)

    val out = linkedMapOf<String, Any?>()

    val fetchdef: MutableMap<String, Any?>
    try {
      fetchdef = this.prepare(fetchargs)
    } catch (err: RuntimeException) {
      out["ok"] = false
      out["err"] = err
      return out
    }

    val url = fetchdef["url"]
    val fetched: Any?
    try {
      fetched = utility.fetcher(ctx, if (url is String) url else "", fetchdef)
    } catch (err: RuntimeException) {
      out["ok"] = false
      out["err"] = err
      return out
    }

    if (fetched == null) {
      out["ok"] = false
      out["err"] = ctx.makeError("direct_no_response", "response: undefined")
      return out
    }

    if (fetched is MutableMap<*, *>) {
      val fm = fetched as MutableMap<String, Any?>
      val status = Helpers.toInt(Struct.getprop(fm, "status"))
      val headers = Struct.getprop(fm, "headers")

      // No-body responses (204, 304) and explicit zero content-length
      // must skip JSON parsing — parsing an empty body errors.
      var contentLength = ""
      if (headers is MutableMap<*, *>) {
        val cl = (headers as MutableMap<String, Any?>)["content-length"]
        if (cl != null) {
          contentLength = cl.toString()
        }
      }
      val noBody = status == 204 || status == 304 || "0" == contentLength

      var jsonData: Any? = null
      if (!noBody) {
        val jf = Struct.getprop(fm, "json")
        if (jf is Supplier<*>) {
          // The supplier returns null on parse error in our fetcher.
          jsonData = (jf as Supplier<Any?>).get()
        }
      }

      out["ok"] = status in 200..299
      out["status"] = status
      out["headers"] = headers
      out["data"] = jsonData
      return out
    }

    out["ok"] = false
    out["err"] = ctx.makeError("direct_invalid", "invalid response type")
    return out
  }

  companion object {
    /** Builds SDK options with the test feature enabled (shared by testSDK). */
    @JvmStatic
    fun testOptions(
      testopts: MutableMap<String, Any?>?,
      sdkopts: MutableMap<String, Any?>?,
    ): MutableMap<String, Any?> {
      val sopts = if (sdkopts == null) {
        linkedMapOf()
      } else {
        Struct.clone(sdkopts) as MutableMap<String, Any?>
      }

      val topts = if (testopts == null) {
        linkedMapOf<String, Any?>()
      } else {
        Struct.clone(testopts) as MutableMap<String, Any?>
      }
      topts["active"] = true

      Struct.setpath(sopts, listOf("feature", "test"), topts)

      return sopts
    }
  }
}
