package SCALAPACKAGE.core

import java.util.{ArrayList, LinkedHashMap, List => JList, Map => JMap}
import java.util.function.Supplier
import SCALAPACKAGE.utility.struct.Struct

// Shared client runtime for the ProjectName SDK. The generated
// ProjectNameSDK class extends this with the API-specific entity accessors.
abstract class SdkClient(options0: JMap[String, Object]) {

  var mode: String = "live"
  var features: JList[Feature] = new ArrayList[Feature]()

  protected var options: JMap[String, Object] = null
  protected var utility: Utility = new Utility()
  protected var rootctx: Context = null

  locally {
    val config = Config.makeConfig()

    val ctxmap = new LinkedHashMap[String, Object]()
    ctxmap.put("client", this)
    ctxmap.put("utility", this.utility)
    ctxmap.put("config", config)
    if (options0 != null) ctxmap.put("options", options0)
    ctxmap.put("shared", new LinkedHashMap[String, Object]())

    this.rootctx = this.utility.makeContext(ctxmap, null)

    this.options = this.utility.makeOptions(this.rootctx)

    if (java.lang.Boolean.TRUE == Struct.getpath(this.options,
        java.util.List.of("feature", "test", "active"))) {
      this.mode = "test"
    }

    this.rootctx.options = this.options

    // Add features in the resolved order (makeOptions puts an explicit list
    // order first, else defaults to test-first). Ordering matters: the `test`
    // feature installs the base mock transport and the transport features
    // (retry/cache/netsim/proxy/ratelimit) wrap whatever is current, so `test`
    // must be added before them to sit at the base of the chain.
    var featureOpts = Helpers.toMapAny(Struct.getprop(this.options, "feature"))
    if (featureOpts == null) featureOpts = new LinkedHashMap[String, Object]()
    Struct.getpath(this.options, java.util.List.of("__derived__", "featureorder")) match {
      case order: JList[_] =>
        val it = order.asInstanceOf[JList[Object]].iterator()
        while (it.hasNext) {
          val fname = it.next() match { case s: String => s; case _ => null }
          val fopts = Helpers.toMapAny(Struct.getprop(featureOpts, fname))
          if (fname != null && fopts != null && (java.lang.Boolean.TRUE == fopts.get("active"))) {
            val f = Config.makeFeature(fname)
            if (f != null) this.utility.featureAdd(this.rootctx, f)
          }
        }
      case _ =>
    }

    // Add extension features.
    Struct.getprop(this.options, "extend") match {
      case ext: JList[_] =>
        val it = ext.asInstanceOf[JList[Object]].iterator()
        while (it.hasNext) {
          it.next() match { case f: Feature => this.utility.featureAdd(this.rootctx, f); case _ => }
        }
      case _ =>
    }

    // Initialize features.
    val fit = new ArrayList[Feature](this.features).iterator()
    while (fit.hasNext) this.utility.featureInit(this.rootctx, fit.next())

    this.utility.featureHook(this.rootctx, "PostConstruct")
  }

  def optionsMap(): JMap[String, Object] = Struct.clone(this.options) match {
    case m: JMap[_, _] => m.asInstanceOf[JMap[String, Object]]
    case _ => new LinkedHashMap[String, Object]()
  }

  def getUtility(): Utility = this.utility.copy()

  def getRootCtx(): Context = this.rootctx

  def prepare(fetchargs0: JMap[String, Object]): JMap[String, Object] = {
    val utility = this.utility
    val fetchargs = if (fetchargs0 == null) new LinkedHashMap[String, Object]() else fetchargs0

    var ctrl = Helpers.toMapAny(Struct.getprop(fetchargs, "ctrl"))
    if (ctrl == null) ctrl = new LinkedHashMap[String, Object]()

    val ctxmap = new LinkedHashMap[String, Object]()
    ctxmap.put("opname", "prepare")
    ctxmap.put("ctrl", ctrl)
    val ctx = utility.makeContext(ctxmap, this.rootctx)

    val opts = this.options

    val path = Struct.getprop(fetchargs, "path") match { case s: String => s; case _ => "" }
    var method = Struct.getprop(fetchargs, "method") match { case s: String => s; case _ => "" }
    if ("" == method) method = "GET"

    var params = Helpers.toMapAny(Struct.getprop(fetchargs, "params"))
    if (params == null) params = new LinkedHashMap[String, Object]()
    var query = Helpers.toMapAny(Struct.getprop(fetchargs, "query"))
    if (query == null) query = new LinkedHashMap[String, Object]()

    val headers = utility.prepareHeaders(ctx)

    val base = Struct.getprop(opts, "base")
    val prefix = Struct.getprop(opts, "prefix")
    val suffix = Struct.getprop(opts, "suffix")

    val specmap = new LinkedHashMap[String, Object]()
    specmap.put("base", base match { case s: String => s; case _ => "" })
    specmap.put("prefix", prefix match { case s: String => s; case _ => "" })
    specmap.put("suffix", suffix match { case s: String => s; case _ => "" })
    specmap.put("path", path)
    specmap.put("method", method)
    specmap.put("params", params)
    specmap.put("query", query)
    specmap.put("headers", headers)
    specmap.put("body", Struct.getprop(fetchargs, "body", null))
    specmap.put("step", "start")
    ctx.spec = new Spec(specmap)

    val uheaders = Helpers.toMapAny(Struct.getprop(fetchargs, "headers"))
    if (uheaders != null) ctx.spec.headers.putAll(uheaders)

    utility.prepareAuth(ctx)

    utility.makeFetchDef(ctx)
  }

  def direct(fetchargs0: JMap[String, Object]): JMap[String, Object] = {
    val utility = this.utility
    val fetchargs = if (fetchargs0 == null) new LinkedHashMap[String, Object]() else fetchargs0

    var ctrl = Helpers.toMapAny(Struct.getprop(fetchargs, "ctrl"))
    if (ctrl == null) ctrl = new LinkedHashMap[String, Object]()

    val ctxmap = new LinkedHashMap[String, Object]()
    ctxmap.put("opname", "direct")
    ctxmap.put("ctrl", ctrl)
    val ctx = utility.makeContext(ctxmap, this.rootctx)

    val out = new LinkedHashMap[String, Object]()

    val fetchdef =
      try this.prepare(fetchargs)
      catch { case err: RuntimeException =>
        out.put("ok", java.lang.Boolean.FALSE); out.put("err", err); return out
      }

    val url = fetchdef.get("url")
    val fetched =
      try utility.fetcher(ctx, url match { case s: String => s; case _ => "" }, fetchdef)
      catch { case err: RuntimeException =>
        out.put("ok", java.lang.Boolean.FALSE); out.put("err", err); return out
      }

    if (fetched == null) {
      out.put("ok", java.lang.Boolean.FALSE)
      out.put("err", ctx.makeError("direct_no_response", "response: undefined"))
      return out
    }

    fetched match {
      case fm0: JMap[_, _] =>
        val fm = fm0.asInstanceOf[JMap[String, Object]]
        val status = Helpers.toInt(Struct.getprop(fm, "status"))
        val headers = Struct.getprop(fm, "headers")

        var contentLength = ""
        headers match {
          case hm: JMap[_, _] =>
            val cl = hm.asInstanceOf[JMap[String, Object]].get("content-length")
            if (cl != null) contentLength = String.valueOf(cl)
          case _ =>
        }
        val noBody = status == 204 || status == 304 || "0" == contentLength

        var jsonData: Object = null
        if (!noBody) {
          Struct.getprop(fm, "json") match {
            case jf: Supplier[_] => jsonData = jf.asInstanceOf[Supplier[Object]].get()
            case _ =>
          }
        }

        out.put("ok", java.lang.Boolean.valueOf(status >= 200 && status < 300))
        out.put("status", java.lang.Integer.valueOf(status))
        out.put("headers", headers)
        out.put("data", jsonData)
        out
      case _ =>
        out.put("ok", java.lang.Boolean.FALSE)
        out.put("err", ctx.makeError("direct_invalid", "invalid response type"))
        out
    }
  }
}

object SdkClient {
  // Builds SDK options with the test feature enabled (shared by testSDK).
  def testOptions(testopts: JMap[String, Object], sdkopts: JMap[String, Object]): JMap[String, Object] = {
    val sopts: JMap[String, Object] =
      if (sdkopts == null) new LinkedHashMap[String, Object]()
      else Struct.clone(sdkopts).asInstanceOf[JMap[String, Object]]

    val topts: JMap[String, Object] =
      if (testopts == null) new LinkedHashMap[String, Object]()
      else Struct.clone(testopts).asInstanceOf[JMap[String, Object]]
    topts.put("active", java.lang.Boolean.TRUE)

    Struct.setpath(sopts, java.util.List.of("feature", "test"), topts)
    sopts
  }
}
