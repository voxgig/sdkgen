
import {
  Content,
  File,
  cmp,
  isAuthSuppressed,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
} from '@voxgig/sdkgen'


import type { Model } from '@voxgig/apidef'


// The canary sweep (test/clean.test.ts in the ts reference): canaries in
// every credential slot, every diagnostic feature on with a capturing sink,
// a real operation through every outcome, every string that leaves searched
// for the canaries and their encoded forms, and the negative control. A
// scala-cli main of its own, named in the Makefile's test target.
const TestClean = cmp(function TestClean(props: any) {
  const model: Model = props.ctx$.model
  const target = props.target
  const scalapackage: string = props.scalapackage

  const SDK = model.const.Name + 'SDK'

  const auth = {
    suppressed: isAuthSuppressed(model),
    where: resolveAuthIn(model),
    name: 'header' === resolveAuthIn(model)
      ? resolveAuthName(model).toLowerCase() : resolveAuthName(model),
    basic: isHttpBasicAuth(model),
  }

  File({ name: 'SdkCleanTestMain.' + target.ext }, () => Content(render(scalapackage, SDK, auth)))
})


type AuthSpec = { suppressed: boolean, where: string, name: string, basic: boolean }


function render(scalapackage: string, SDK: string, auth: AuthSpec): string {
  return `// The canary sweep: every credential slot holds a distinctive value, every
// diagnostic feature this SDK ships is switched on with a capturing sink, a
// real operation runs through every outcome, and every string that leaves
// the SDK is searched for the canaries and their encoded forms. It also
// proves its own sensitivity: with clean switched off the canary MUST show.
// Run: scala-cli run . --main-class SdkCleanTestMain

import java.io.{PrintWriter, StringWriter}
import java.lang.reflect.{Method, Modifier}
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.{ArrayList, Base64, LinkedHashMap, List => JList, Map => JMap}
import java.util.function.{Consumer, Supplier}
import java.util.logging.{Handler, Level, LogRecord, Logger}

import ${scalapackage}.core.{Config, Context, Helpers, Result, SdkEntity, SdkError, Spec, ${SDK}}
import ${scalapackage}.feature.BaseFeature
import ${scalapackage}.utility.struct.Struct

object SdkCleanTestMain {

  // Generated: the credential's wire placement is fixed when the SDK is built.
  private val AUTH_SUPPRESSED = ${auth.suppressed}
  private val AUTH_WHERE = "${scalastr(auth.where)}"
  private val AUTH_NAME = "${scalastr(auth.name)}"

  private val CANARY_APIKEY = "CANARY-APIKEY-k9x2m7q4p1"
  private val CANARY_SECRET = "CANARY-SECRET-w3e8r5t2y6"
  private val CANARY_HEADER = "CANARY-HEADER-z1x4c7v0b3"
  private val CANARY_VALUE = "CANARY-VALUE-n5m8b2v9c4"

  private val MASK = "[redacted]"

  private def b64(s: String): String =
    Base64.getEncoder.encodeToString(s.getBytes(StandardCharsets.UTF_8))

  // Every form a canary can travel in.
  private val FORMS: List[String] =
    List(CANARY_APIKEY, CANARY_SECRET, CANARY_HEADER, CANARY_VALUE)
      .flatMap(v => List(v, b64(v), URLEncoder.encode(v, StandardCharsets.UTF_8))) :+
      b64(CANARY_APIKEY + ":" + CANARY_SECRET)

  final class Sink(val name: String, val text: String)

  private def om(kv: (String, Object)*): JMap[String, Object] = SdkTestSupport.om(kv*)
  private def I(n: Int): java.lang.Integer = java.lang.Integer.valueOf(n)
  private def B(b: Boolean): java.lang.Boolean = java.lang.Boolean.valueOf(b)

  private def hasFeature(name: String): Boolean = {
    val fm = Helpers.toMapAny(Config.sharedConfig().get("feature"))
    fm != null && fm.get(name) != null
  }

  // Header maps keep the caller's spelling; the assertion should not care.
  private def header(map: Object, name: String): Object = {
    val m = Helpers.toMapAny(map)
    if (m == null) return null
    val it = m.entrySet().iterator()
    while (it.hasNext) {
      val e = it.next()
      if (e.getKey.toLowerCase == name.toLowerCase) return e.getValue
    }
    null
  }

  private def leaks(text: String): List[String] = FORMS.filter(f => text.contains(f))

  // The SDK's own objects print their data, not a class name, so a raw spec
  // handed back with clean off shows what it holds.
  private def plain(v: Object): Object = v match {
    case s: Spec => om("method" -> s.method, "url" -> s.url, "path" -> s.path,
      "headers" -> s.headers, "query" -> s.query, "body" -> s.body)
    case r: Result => om("status" -> I(r.status), "headers" -> r.headers,
      "body" -> r.body, "resdata" -> r.resdata)
    case e: SdkEntity => e.data()
    case _ => v
  }

  private def stack(err: Throwable): String = {
    val sw = new StringWriter()
    err.printStackTrace(new PrintWriter(sw))
    sw.toString
  }

  private def surfaces(name: String, v: Object): List[Sink] = {
    val out = new ArrayList[Sink]()
    def push(kind: String)(fn: => String): Unit =
      try out.add(new Sink(name + ":" + kind, fn))
      catch { case _: Throwable => }
    push("json") { Struct.jsonify(plain(v)) }
    push("string") { String.valueOf(v) }
    v match {
      case t: Throwable =>
        push("message") { if (t.getMessage == null) "" else t.getMessage }
        push("stack") { stack(t) }
      case _ =>
    }
    v match {
      case e: SdkError =>
        push("map") { Struct.jsonify(e.toMap()) }
        push("spec") { Struct.jsonify(plain(e.spec)) }
        push("result") { Struct.jsonify(plain(e.result)) }
      case _ =>
    }
    v match {
      case c: Context => push("record") { Struct.jsonify(c.toMap()) }
      case _ =>
    }
    out.toArray(new Array[Sink](0)).toList
  }

  private def collect(sinks: ArrayList[Sink], name: String, v: Object): Unit =
    surfaces(name, v).foreach(s => sinks.add(s))

  // Captures the serialised context from inside the pipeline: what a hook
  // author would hand to a logger.
  final class CaptureFeature(sinks: ArrayList[Sink]) extends BaseFeature("capture", "0.0.1", true) {
    override def preRequest(ctx: Context): Unit = collect(sinks, "ctx@PreRequest", ctx)
    override def preResponse(ctx: Context): Unit = collect(sinks, "ctx@PreResponse", ctx)
    override def preUnexpected(ctx: Context): Unit = collect(sinks, "ctx@PreUnexpected", ctx)
  }

  final class Scenario(val name: String, val respond: (String, JMap[String, Object]) => Object)

  private def response(status: Int, data: Object, headers: JMap[String, Object]): JMap[String, Object] = {
    val h = new LinkedHashMap[String, Object]()
    h.put("content-type", "application/json")
    if (headers != null) h.putAll(headers)
    val js: Supplier[Object] = () => data
    val out = new LinkedHashMap[String, Object]()
    out.put("status", I(status))
    out.put("statusText", if (status < 400) "OK" else "ERR")
    out.put("headers", h)
    out.put("json", js)
    out.put("body", Struct.jsonify(data))
    out
  }

  private val SCENARIOS: List[Scenario] = List(
    new Scenario("ok", (_, _) => response(200, om("id" -> "i1", "name" -> "n1"),
      om("x-session-token" -> "RESP-TOKEN-a1b2c3d4e5"))),
    new Scenario("notfound", (_, _) => response(404, om("error" -> "no such record"), null)),
    new Scenario("server", (_, _) => response(500, om("error" -> "boom"), null)),
    new Scenario("transport", (url, _) =>
      throw new RuntimeException("socket hang up (URL was: \\"" + url + "\\")")),
    new Scenario("notjson", (_, _) => {
      val js: Supplier[Object] = () => null
      om("status" -> I(200), "statusText" -> "OK",
        "headers" -> new LinkedHashMap[String, Object](), "json" -> js, "body" -> "<html>")
    }),
  )

  private def makeSdk(scenario: Scenario, sinks: ArrayList[Sink], cleanopts: JMap[String, Object]): ${SDK} = {
    def capture(name: String): Consumer[Object] = (rec: Object) => collect(sinks, name, rec)

    val feature = new LinkedHashMap[String, Object]()
    if (hasFeature("log")) {
      val logger = Logger.getLogger("clean-sweep-" + System.nanoTime())
      logger.setUseParentHandlers(false)
      logger.setLevel(Level.ALL)
      logger.addHandler(new Handler() {
        override def publish(record: LogRecord): Unit = collect(sinks, "log", record.getMessage)
        override def flush(): Unit = {}
        override def close(): Unit = {}
      })
      feature.put("log", om("active" -> B(true), "logger" -> logger))
    }
    if (hasFeature("debug")) feature.put("debug", om("active" -> B(true), "onEntry" -> capture("debug")))
    if (hasFeature("audit")) feature.put("audit", om("active" -> B(true), "sink" -> capture("audit")))
    if (hasFeature("telemetry")) feature.put("telemetry", om("active" -> B(true), "exporter" -> capture("telemetry")))
    if (hasFeature("cost")) feature.put("cost", om("active" -> B(true), "sink" -> capture("cost")))
    if (hasFeature("metrics")) feature.put("metrics", om("active" -> B(true)))
    if (hasFeature("clienttrack")) feature.put("clienttrack", om("active" -> B(true)))

    val clean = new LinkedHashMap[String, Object]()
    clean.put("values", CANARY_VALUE)
    if (cleanopts != null) clean.putAll(cleanopts)

    val fetcher: (Context, String, JMap[String, Object]) => Object =
      (_, url, fetchdef) => scenario.respond(url, fetchdef)

    val opts = new LinkedHashMap[String, Object]()
    opts.put("apikey", CANARY_APIKEY)
    opts.put("secret", CANARY_SECRET)
    opts.put("headers", om("X-Custom-Token" -> CANARY_HEADER))
    opts.put("clean", clean)
    opts.put("feature", feature)
    opts.put("extend", SdkTestSupport.jl(new CaptureFeature(sinks)))
    opts.put("utility", om("fetcher" -> fetcher))
    new ${SDK}(opts)
  }

  final class Target(val accessor: Method, val op: String)

  private def accessors(): List[Method] =
    classOf[${SDK}].getMethods.toList
      .filter(m => classOf[SdkEntity].isAssignableFrom(m.getReturnType) &&
        m.getParameterCount == 1 && Modifier.isPublic(m.getModifiers))
      .sortBy(m => m.getName)

  private def entityOf(sdk: ${SDK}, m: Method): SdkEntity =
    try m.invoke(sdk, Array[Object](null)*) match {
      case e: SdkEntity => e
      case _ => null
    }
    catch { case _: Throwable => null }

  private def call(ent: SdkEntity, op: String, ctrl: JMap[String, Object]): Object = op match {
    case "list" => ent.list(new LinkedHashMap[String, Object](), ctrl)
    case "load" => ent.load(new LinkedHashMap[String, Object](), ctrl)
    case "create" => ent.create(new LinkedHashMap[String, Object](), ctrl)
    case "update" => ent.update(new LinkedHashMap[String, Object](), ctrl)
    case "remove" => ent.remove(new LinkedHashMap[String, Object](), ctrl)
    case _ => throw new IllegalArgumentException("no such op: " + op)
  }

  // The first operation that completes against a plain 200 with no arguments
  // (a required path parameter would fail before the request is built).
  private def usableOp(): Target = {
    val plainFetch: (Context, String, JMap[String, Object]) => Object =
      (_, _, _) => response(200, om("id" -> "i1"), null)
    val plain = new ${SDK}(om("apikey" -> CANARY_APIKEY, "utility" -> om("fetcher" -> plainFetch)))
    val entities = Helpers.toMapAny(Config.sharedConfig().get("entity"))
    if (entities == null) return null
    val rank = Map("list" -> 0, "load" -> 1)
    var found: Target = null
    val mit = accessors().iterator
    while (found == null && mit.hasNext) {
      val m = mit.next()
      val inst = entityOf(plain, m)
      val ecfg = if (inst == null) null else Helpers.toMapAny(entities.get(inst.getName()))
      val opmap = if (ecfg == null) null else Helpers.toMapAny(ecfg.get("op"))
      val ops =
        if (opmap == null) Nil
        else opmap.keySet().toArray.toList.map(k => String.valueOf(k)).sortBy(op => rank.getOrElse(op, 2))
      val oit = ops.iterator
      while (found == null && oit.hasNext) {
        val op = oit.next()
        try {
          call(entityOf(plain, m), op, null)
          found = new Target(m, op)
        }
        catch { case _: Throwable => }
      }
    }
    found
  }

  private def drive(sdk: ${SDK}, target: Target, ctrl: JMap[String, Object], sinks: ArrayList[Sink]): Throwable = {
    var out: Object = null
    var err: Throwable = null
    try out = call(entityOf(sdk, target.accessor), target.op, ctrl)
    catch { case e: Throwable => err = e }
    if (err != null) collect(sinks, "error", err)
    if (out != null) collect(sinks, "result", out)
    if (ctrl != null && ctrl.get("explain") != null) collect(sinks, "explain", ctrl.get("explain"))
    err
  }

  private def sweep(rep: SdkTestReport): Unit = {
    val target = usableOp()
    rep.check("clean.usable-op", target != null, "no operation completes without arguments; nothing to sweep")
    if (target == null) return

    val sinks = new ArrayList[Sink]()
    val errors = new LinkedHashMap[String, Throwable]()
    val explains = new LinkedHashMap[String, JMap[String, Object]]()

    for (scenario <- SCENARIOS) {
      for (variant <- List("throw", "explain", "nothrow")) {
        val sdk = makeSdk(scenario, sinks, null)
        val ctrl: JMap[String, Object] = variant match {
          case "throw" => null
          case "explain" => om("explain" -> new LinkedHashMap[String, Object]())
          case _ => om("throw" -> B(false), "explain" -> new LinkedHashMap[String, Object]())
        }
        val err = drive(sdk, target, ctrl, sinks)
        val key = scenario.name + "/" + variant
        if (err != null) errors.put(key, err)
        val explain = if (ctrl == null) null else Helpers.toMapAny(ctrl.get("explain"))
        if (explain != null) explains.put(key, explain)
        collect(sinks, "sdk", sdk)
      }
    }

    val all = sinks.toArray(new Array[Sink](0)).toList
    val leaked = all.map(s => (s.name, leaks(s.text))).filter(l => l._2.nonEmpty)

    println("clean: swept " + all.size + " surface(s), " + leaked.size + " leak(s)")

    rep.check("clean.no-leak", leaked.isEmpty, "credential leaked through: " +
      leaked.map(l => l._1 + " [" + l._2.mkString(", ") + "]").mkString("; "))

    // The positive half: the slot the credential travelled in is masked,
    // and an unregistered token in a response header is masked by name.
    val notfound = errors.get("notfound/throw")
    rep.check("clean.404-throws", notfound != null, "the 404 scenario must throw")
    notfound match {
      case nf: SdkError =>
        rep.eqI("clean.404-status", 404, nf.status)
        val specm = Helpers.toMapAny(nf.spec)
        val spec = if (specm == null) new LinkedHashMap[String, Object]() else specm
        if (!AUTH_SUPPRESSED) {
          if ("query" == AUTH_WHERE) {
            rep.eq("clean.query-masked", MASK, header(spec.get("query"), AUTH_NAME))
          } else if ("cookie" == AUTH_WHERE) {
            val cookie = String.valueOf(header(spec.get("headers"), "cookie"))
            rep.check("clean.cookie-masked", cookie.contains(MASK), "cookie: " + cookie)
          } else {
            val cred = String.valueOf(header(spec.get("headers"), AUTH_NAME))
            rep.check("clean.header-masked", cred.endsWith(MASK), AUTH_NAME + ": " + cred)
          }
        }
        rep.eq("clean.custom-header-masked", MASK, header(spec.get("headers"), "x-custom-token"))
      case other =>
        rep.fail("clean.404-sdkerror", "the 404 scenario should throw an SdkError, got " + other)
    }

    val explained = explains.get("ok/explain")
    val result = if (explained == null) null else Helpers.toMapAny(explained.get("result"))
    rep.check("clean.explain-result", result != null, "the explain record should carry the result")
    if (result != null) {
      rep.eq("clean.response-header-masked", MASK, header(result.get("headers"), "x-session-token"))
    }
  }

  private def sensitivity(rep: SdkTestReport): Unit = {
    val target = usableOp()
    rep.check("clean.off.usable-op", target != null, "no operation completes without arguments")
    if (target == null) return

    val sinks = new ArrayList[Sink]()
    val sdk = makeSdk(SCENARIOS(1), sinks, om("active" -> B(false)))
    val err = drive(sdk, target, null, sinks)
    rep.check("clean.off.throws", err != null, "the 404 scenario must throw")

    val leaked = sinks.toArray(new Array[Sink](0)).toList.filter(s => leaks(s.text).nonEmpty)
    rep.check("clean.off.shows-canary", leaked.nonEmpty,
      "with clean off, nothing showed the canary: the sweep is blind")

    if (!AUTH_SUPPRESSED) err match {
      case e: SdkError =>
        val text = Struct.jsonify(plain(e.spec))
        rep.check("clean.off.raw-spec",
          text.contains(CANARY_APIKEY) || text.contains(b64(CANARY_APIKEY + ":" + CANARY_SECRET)),
          "the raw spec should carry the credential when clean is off")
      case _ =>
    }
  }

  def main(args: Array[String]): Unit = {
    val rep = new SdkTestReport()

    rep.scope("clean-no-credential-leaves-the-sdk") { sweep(rep) }
    rep.scope("clean-the-sweep-can-see-a-leak") { sensitivity(rep) }

    rep.finish("CLEAN")
  }
}
`
}


// A Scala double-quoted string literal body: the auth name comes from the
// API's own securityScheme.
function scalastr(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}


export {
  TestClean
}
