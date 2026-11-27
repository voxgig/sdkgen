
import {
  Content,
  File,
  cmp,
  fact,
} from '@voxgig/sdkgen'

import {
  KIT,
} from '@voxgig/apidef'


import type { Model } from '@voxgig/apidef'


// The canary sweep (test/clean.test.ts in the ts reference): canaries in
// every credential slot, every diagnostic feature on with a capturing sink,
// a real operation through every outcome, every string that leaves searched
// for the canaries and for a body of bytes, and a negative control for each.
// A scala-cli main of its own, named in the Makefile's test target.
const TestClean = cmp(function TestClean(props: any) {
  const model: Model = props.ctx$.model
  const authFact = fact(model.main[KIT], 'auth')
  const target = props.target
  const scalapackage: string = props.scalapackage

  const SDK = model.const.Name + 'SDK'

  const auth = {
    suppressed: authFact.suppressed,
    where: authFact.in,
    name: 'header' === authFact.in
      ? authFact.name.toLowerCase() : authFact.name,
    basic: authFact.basic,
  }

  File({ name: 'SdkCleanTestMain.' + target.ext }, () => Content(render(scalapackage, SDK, auth)))
})


type AuthSpec = { suppressed: boolean, where: string, name: string, basic: boolean }


function render(scalapackage: string, SDK: string, auth: AuthSpec): string {
  return `// The canary sweep: every credential slot holds a distinctive value, every
// diagnostic feature this SDK ships is switched on with a capturing sink, a
// real operation runs through every outcome, and every string that leaves
// is searched for the canaries and their encoded forms; a second sweep does
// the same for a body of bytes. With clean off the canary MUST show.
// Run: scala-cli run . --main-class SdkCleanTestMain

import java.io.{ByteArrayInputStream, InputStream, PrintWriter, StringWriter}
import java.lang.reflect.{Method, Modifier}
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.{ArrayList, Base64, LinkedHashMap, List => JList, Map => JMap}
import java.util.function.{Consumer, Supplier}
import java.util.logging.{Handler, Level, LogRecord, Logger}

import ${scalapackage}.core.{Config, Context, Helpers, Response, Result, SdkEntity, SdkError, Spec, ${SDK}}
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

  // The marker a body of bytes carries.
  private val CONTENT = "CANARY-CONTENT-b7n3v9x1c5"
  private val CONTENT_BYTES: Array[Byte] = CONTENT.getBytes(StandardCharsets.UTF_8)

  // The marker a response of bytes carries, as the default transport hands
  // on a body it read into text.
  private val RESPONSE = "CANARY-RESPONSE-k2m8q4w6z0"

  // Every value this SDK accepts as a raw body.
  private val CARRIERS: List[(String, () => Object)] = List(
    ("Array[Byte]", () => CONTENT_BYTES.clone()),
    ("InputStream", () => new ByteArrayInputStream(CONTENT_BYTES)),
    ("String", () => CONTENT),
  )

  final class Sink(val name: String, val text: String)

  private def om(kv: (String, Object)*): JMap[String, Object] = SdkTestSupport.om(kv*)
  private def I(n: Int): java.lang.Integer = java.lang.Integer.valueOf(n)
  private def B(b: Boolean): java.lang.Boolean = java.lang.Boolean.valueOf(b)

  // Every string a value holds, private fields included, as a debugger shows them.
  private def dump(v: Any, depth: Int = 0): String =
    if (v == null || 12 < depth) ""
    else v match {
      case s: String => s
      case m: JMap[_, _] =>
        val out = new StringBuilder("{")
        val it = m.entrySet().iterator()
        while (it.hasNext) {
          val e = it.next()
          out.append(dump(e.getKey, depth + 1)).append('=').append(dump(e.getValue, depth + 1)).append(' ')
        }
        out.append('}').toString
      case l: java.lang.Iterable[_] =>
        val out = new StringBuilder("[")
        val it = l.iterator()
        while (it.hasNext) out.append(dump(it.next(), depth + 1)).append(' ')
        out.append(']').toString
      case _ if v.getClass.getName.startsWith("java.") || v.getClass.getName.startsWith("scala.") =>
        String.valueOf(v)
      case _ =>
        v.getClass.getDeclaredFields.filter(f => !Modifier.isStatic(f.getModifiers)).map { f =>
          try { f.trySetAccessible(); dump(f.get(v), depth + 1) } catch { case _: Exception => "" }
        }.mkString("{", " ", "}")
    }

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

  // The forms bytes travel in once copied: text, a list of byte values, hex,
  // base64 with or without its padding.
  private def contentLeaks(text: String, marker: String = CONTENT): List[String] = {
    val bytes = marker.getBytes(StandardCharsets.UTF_8)
    val flat = text.replaceAll("\\\\s+", "")
    val hex = bytes.map(b => String.format("%02x", I(b & 0xff))).mkString
    List(
      ("text", text.contains(marker)),
      ("byte values", flat.contains(bytes.mkString(","))),
      ("hex", flat.toLowerCase.contains(hex)),
      ("base64", flat.contains(b64(marker).replace("=", ""))),
    ).filter(f => f._2).map(f => f._1)
  }

  // The SDK's own objects print their data, not a class name, so a raw spec
  // handed back with clean off shows what it holds. Bytes print as their
  // values wherever they sit, which is how a serialiser shows them.
  private def plain(v: Object): Object = v match {
    case s: Spec => om("method" -> s.method, "url" -> s.url, "path" -> s.path,
      "headers" -> s.headers, "query" -> s.query, "body" -> plain(s.body))
    case r: Result => om("status" -> I(r.status), "headers" -> r.headers,
      "body" -> r.body, "resdata" -> r.resdata)
    case r: Response => om("status" -> I(r.status), "headers" -> r.headers,
      "body" -> plain(r.body))
    case e: SdkEntity => e.data()
    case b: Array[Byte] =>
      val out = new ArrayList[Object]()
      b.foreach(x => out.add(I(x.toInt)))
      out
    case m: JMap[_, _] =>
      val out = new LinkedHashMap[String, Object]()
      m.asInstanceOf[JMap[Object, Object]].forEach((k, x) => out.put(String.valueOf(k), plain(x)))
      out
    case l: JList[_] =>
      val out = new ArrayList[Object]()
      l.asInstanceOf[JList[Object]].forEach(x => out.add(plain(x)))
      out
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
        push("map") { Struct.jsonify(plain(e.toMap())) }
        push("spec") { Struct.jsonify(plain(e.spec)) }
        push("result") { Struct.jsonify(plain(e.result)) }
      case _ =>
    }
    v match {
      case c: Context => push("record") { Struct.jsonify(plain(c.toMap())) }
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

  // A feature that throws from inside the pipeline, quoting the request it
  // saw: a plain Exception, which is not a RuntimeException. makeError fires
  // PreUnexpected, so what the unexpected variant throws there escapes it.
  final class ThrowFeature(unexpected: Boolean) extends BaseFeature("throwhook", "0.0.1", true) {
    private def saw(ctx: Context): Exception = new Exception("hook saw " + Struct.jsonify(plain(ctx.spec)))
    override def preResponse(ctx: Context): Unit = throw saw(ctx)
    override def preUnexpected(ctx: Context): Unit = if (unexpected) throw saw(ctx)
  }

  // A stream that fails while the caller iterates it, quoting a credential.
  final class StreamThrowFeature extends BaseFeature("streamthrow", "0.0.1", true) {
    override def preDone(ctx: Context): Unit = {
      val failing: Supplier[java.util.Iterator[Object]] = () => new java.util.Iterator[Object] {
        override def hasNext: Boolean = throw new RuntimeException("stream saw " + CANARY_APIKEY)
        override def next(): Object = throw new NoSuchElementException()
      }
      ctx.result.stream = failing
    }
  }

  // A stream that succeeds, yielding the result's items.
  final class StreamOkFeature extends BaseFeature("streamok", "0.0.1", true) {
    override def preDone(ctx: Context): Unit = {
      val items = new ArrayList[Object]()
      ctx.result.resdata match {
        case l: JList[_] => l.forEach(item => items.add(item.asInstanceOf[Object]))
        case null =>
        case other => items.add(other)
      }
      val ok: Supplier[java.util.Iterator[Object]] = () => items.iterator()
      ctx.result.stream = ok
    }
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

  // A response of bytes under the type it declares, as the default transport
  // hands on a body it read into text and could not parse.
  private def bytesScenario(status: Int, ctype: String): Scenario =
    new Scenario("bytes", (_, _) => {
      val js: Supplier[Object] = () => null
      om("status" -> I(status), "statusText" -> (if (status < 400) "OK" else "ERR"),
        "headers" -> om("content-type" -> ctype), "json" -> js, "body" -> RESPONSE,
        "unreadable" -> B(true))
    })

  // Offline, as every generated suite is: the test OPTION resolves a required
  // server variable to test-<name>, and installs no transport.
  private def offline(opts: JMap[String, Object]): JMap[String, Object] = {
    val out = new LinkedHashMap[String, Object](opts)
    out.put("test", om("active" -> B(true)))
    out
  }

  // A client the sweep cannot build leaves nothing swept: a harness error, not
  // a leak.
  private def construct(opts: JMap[String, Object]): ${SDK} =
    try new ${SDK}(offline(opts))
    catch {
      case e: RuntimeException => throw new IllegalStateException(
        "clean harness: the client could not be constructed, so nothing was swept: " + e.getMessage, e)
    }

  private def makeSdk(scenario: Scenario, sinks: ArrayList[Sink], cleanopts: JMap[String, Object],
      extra: BaseFeature = null, auth: JMap[String, Object] = null): ${SDK} = {
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
    val extend = SdkTestSupport.jl(new CaptureFeature(sinks))
    if (extra != null) extend.add(extra)
    opts.put("extend", extend)
    opts.put("utility", om("fetcher" -> fetcher))
    if (auth != null) opts.put("auth", auth)
    construct(opts)
  }

  // media: the type its point declares for a raw body, when it sends one.
  final class Target(val accessor: Method, val op: String, val matchArgs: JMap[String, Object],
      val media: Object = null) {
    // The same operation passing more data, as an upload passes its body.
    def withData(data: JMap[String, Object]): Target = {
      val more = new LinkedHashMap[String, Object](matchArgs)
      more.putAll(data)
      new Target(accessor, op, more, media)
    }
  }

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

  private def call(ent: SdkEntity, op: String, matchArgs: JMap[String, Object],
      ctrl: JMap[String, Object]): Object = {
    val args = new LinkedHashMap[String, Object](matchArgs)
    op match {
      case "list" => ent.list(args, ctrl)
      case "load" => ent.load(args, ctrl)
      case "create" => ent.create(args, ctrl)
      case "update" => ent.update(args, ctrl)
      case "patch" => ent.patch(args, ctrl)
      case "remove" => ent.remove(args, ctrl)
      case _ => throw new IllegalArgumentException("no such op: " + op)
    }
  }

  // Every path parameter an op's points declare, filled in.
  private def filled(opdef: JMap[String, Object]): JMap[String, Object] = {
    val out = new LinkedHashMap[String, Object]()
    Struct.getprop(opdef, "points") match {
      case points: JList[_] =>
        points.forEach { point =>
          Struct.getpath(point, java.util.List.of("args", "params")) match {
            case ps: JList[_] =>
              ps.forEach { p =>
                Struct.getprop(p, "name") match { case n: String => out.put(n, "p1"); case _ => }
              }
            case _ =>
          }
        }
      case _ =>
    }
    out
  }

  // The first operation that completes against a plain 200: with no
  // arguments, else with every path parameter its points declare filled in.
  private def usableOp(): Target = {
    val plainFetch: (Context, String, JMap[String, Object]) => Object =
      (_, _, _) => response(200, om("id" -> "i1"), null)
    val plain = construct(om("apikey" -> CANARY_APIKEY, "utility" -> om("fetcher" -> plainFetch)))
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
        val matches = List(new LinkedHashMap[String, Object](), filled(Helpers.toMapAny(opmap.get(op))))
        val kit = matches.iterator
        while (found == null && kit.hasNext) {
          val matchArgs = kit.next()
          try {
            call(entityOf(plain, m), op, matchArgs, null)
            found = new Target(m, op, matchArgs)
          }
          catch { case _: Throwable => }
        }
      }
    }
    found
  }

  private val NO_OP = "no operation of this SDK completes against a plain 200; nothing to sweep"

  // The first operation with a point that sends a raw body the model marks
  // binary, with every path parameter of that point filled in.
  private def binaryOp(): Target = {
    val client = construct(om("apikey" -> CANARY_APIKEY))
    val entities = Helpers.toMapAny(Config.sharedConfig().get("entity"))
    if (entities == null) return null
    var found: Target = null
    val mit = accessors().iterator
    while (found == null && mit.hasNext) {
      val m = mit.next()
      val inst = entityOf(client, m)
      val ecfg = if (inst == null) null else Helpers.toMapAny(entities.get(inst.getName()))
      val opmap = if (ecfg == null) null else Helpers.toMapAny(ecfg.get("op"))
      val ops =
        if (opmap == null) Nil
        else opmap.keySet().toArray.toList.map(k => String.valueOf(k)).sorted
      val oit = ops.iterator
      while (found == null && oit.hasNext) {
        val op = oit.next()
        Struct.getprop(opmap.get(op), "points") match {
          case points: JList[_] =>
            val pit = points.asInstanceOf[JList[Object]].iterator()
            while (found == null && pit.hasNext) {
              val point = pit.next()
              val body = Struct.getprop(point, "body")
              if ("raw" == Struct.getprop(body, "kind") &&
                  java.lang.Boolean.TRUE == Struct.getprop(body, "binary")) {
                val matchArgs = filled(om("points" -> SdkTestSupport.jl(point)))
                val action = Struct.getprop(Struct.getprop(point, "select"), "$action", null)
                if (action != null) matchArgs.put("$action", action)
                found = new Target(m, op, matchArgs, Struct.getprop(body, "media", null))
              }
            }
          case _ =>
        }
      }
    }
    found
  }

  private val NO_BINARY_OP = "no operation of this SDK sends a binary body; nothing to sweep"

  // What the transport was handed, as text.
  private def sentText(body: Object): String = body match {
    case b: Array[Byte] => new String(b, StandardCharsets.UTF_8)
    case s: InputStream => new String(s.readAllBytes(), StandardCharsets.UTF_8)
    case other => String.valueOf(other)
  }

  private def bodyOf(record: Object): Object = {
    val m = Helpers.toMapAny(record)
    if (m == null) null else m.get("body")
  }

  private def drive(sdk: ${SDK}, target: Target, ctrl: JMap[String, Object], sinks: ArrayList[Sink]): Throwable = {
    // A caller may keep the record it passed rather than read ctrl's entry.
    val held = if (ctrl == null) null else ctrl.get("explain")
    val entity = entityOf(sdk, target.accessor)
    var out: Object = null
    var err: Throwable = null
    try out = call(entity, target.op, target.matchArgs, ctrl)
    catch { case e: Throwable => err = e }
    if (err != null) collect(sinks, "error", err)
    if (out != null) collect(sinks, "result", out)
    // Raw, as a caller copying the match into another query reads it.
    if (entity != null) collect(sinks, "match", entity.matchArgs())
    val explain = if (ctrl == null) null else ctrl.get("explain")
    if (explain != null) collect(sinks, "explain", explain)
    if (held != null && !(held eq explain)) collect(sinks, "explain:held", held)
    err
  }

  private def sweep(rep: SdkTestReport): Unit = {
    val target = usableOp()
    if (target == null) {
      println("clean: skipped: " + NO_OP)
      return
    }

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

    // A name given at run time replaces the declared one: the match leaves
    // out whichever name prepareAuth placed.
    drive(makeSdk(SCENARIOS.head, sinks, null, auth = om("name" -> "zzcred")), target, null, sinks)

    // A credential mistyped as a map. Validation here collects its errors
    // rather than throwing, so there is no rejection to sweep: sweep the
    // client it built, an operation it runs, and a message quoting the value.
    val fetch404: (Context, String, JMap[String, Object]) => Object =
      (_, url, fetchdef) => SCENARIOS(1).respond(url, fetchdef)
    val mistyped = new ${SDK}(offline(om("apikey" -> om("value" -> CANARY_APIKEY),
      "clean" -> om("values" -> CANARY_VALUE), "utility" -> om("fetcher" -> fetch404))))
    collect(sinks, "mistyped", mistyped)
    drive(mistyped, target, null, sinks)
    collect(sinks, "mistyped:quoted",
      mistyped.getUtility().clean(mistyped.getRootCtx(), "found map: " + CANARY_APIKEY))

    // An exception a feature hook throws, quoting the request, skips makeError.
    for (unexpected <- List(false, true)) {
      val hooked = makeSdk(SCENARIOS.head, sinks, null, new ThrowFeature(unexpected))
      val hookerr = drive(hooked, target, om("explain" -> new LinkedHashMap[String, Object]()), sinks)
      rep.check("clean.hook-throws", hookerr != null, "the throwing hook should fail the operation")
    }

    // Iterating a stream runs inside the same catch path as the operation,
    // and the explain record the caller passed is cleaned however it ends.
    for ((name, extra) <- List[(String, BaseFeature)](
        ("stream", new StreamThrowFeature()), ("stream-ok", new StreamOkFeature()), ("stream-plain", null))) {
      val streaming = entityOf(makeSdk(SCENARIOS.head, sinks, null, extra), target.accessor)
      val explain = new LinkedHashMap[String, Object]()
      var streamerr: Throwable = null
      try streaming.stream(target.op, om("reqmatch" -> new LinkedHashMap[String, Object](target.matchArgs)),
        om("ctrl" -> om("explain" -> explain))).foreach(_ => ())
      catch { case e: Throwable => streamerr = e }
      rep.check("clean." + name + ".throws", ("stream" == name) == (streamerr != null),
        name + ": only the failing stream throws")
      if (streamerr != null) collect(sinks, name, streamerr)
      rep.check("clean." + name + ".explain", !explain.isEmpty, name + ": the explain record was not filled")
      collect(sinks, name + ":explain", explain)
    }

    // The raw path returns its failure rather than throwing it.
    val raw = makeSdk(SCENARIOS(3), sinks, null).direct(om("path" -> "raw"))
    rep.check("clean.direct-fails", java.lang.Boolean.FALSE == raw.get("ok") && raw.get("err") != null,
      "a transport failure should fail direct()")
    collect(sinks, "direct", raw.get("err"))

    // A registered value used as a map key is masked; keys that mask alike
    // are kept apart.
    val probe = makeSdk(SCENARIOS.head, sinks, null)
    val named = Helpers.toMapAny(probe.getUtility().clean(probe.getRootCtx(),
      om(CANARY_VALUE -> I(1), CANARY_HEADER -> I(2), "plain" -> I(3))))
    collect(sinks, "named", named)

    // An error's code is cleaned like its message.
    val coded = probe.getUtility().clean(probe.getRootCtx(), new SdkError("code_" + CANARY_VALUE, "coded", null))
    collect(sinks, "coded", coded)

    // The clean registry holds every credential in plain form, and is no option.
    val held = construct(om("apikey" -> CANARY_APIKEY)).optionsMap()
    val helddump = dump(held)
    rep.check("clean.options-apikey", CANARY_APIKEY == held.get("apikey"), "optionsMap lost the caller's apikey")
    rep.check("clean.options-registry",
      leaks(helddump.replaceFirst(java.util.regex.Pattern.quote(CANARY_APIKEY), "")).isEmpty,
      "optionsMap carries a credential beyond the option the caller set: " + helddump)

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

    rep.eq("clean.map-keys", om(MASK -> I(1), (MASK + "#1") -> I(2), "plain" -> I(3)), named)
    coded match {
      case e: SdkError => rep.eq("clean.code-masked", "code_" + MASK, e.code)
      case other => rep.fail("clean.code-sdkerror", "clean should return the SdkError, got " + other)
    }
  }

  private def sensitivity(rep: SdkTestReport): Unit = {
    val target = usableOp()
    if (target == null) {
      println("clean: skipped: " + NO_OP)
      return
    }

    val sinks = new ArrayList[Sink]()
    val sdk = makeSdk(SCENARIOS(1), sinks, om("active" -> B(false)))
    val err = drive(sdk, target, null, sinks)
    rep.check("clean.off.throws", err != null, "the 404 scenario must throw")

    // Explaining a failure must not cost it its error.
    val explained = drive(makeSdk(SCENARIOS(1), new ArrayList[Sink](), om("active" -> B(false))), target,
      om("explain" -> new LinkedHashMap[String, Object]()), new ArrayList[Sink]())
    val errmsg = if (err == null) null else err.getMessage
    val explainedmsg = if (explained == null) null else explained.getMessage
    rep.check("clean.off.explain-keeps-error", errmsg == explainedmsg,
      "with clean off, explain lost the error: expected " + errmsg + ", got " + explainedmsg)

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

  private def contentSweep(rep: SdkTestReport): Unit = {
    val target = binaryOp()
    if (target == null) {
      println("clean: skipped: " + NO_BINARY_OP)
      return
    }

    val sinks = new ArrayList[Sink]()
    val sent = new LinkedHashMap[String, Object]()
    val errors = new LinkedHashMap[String, Throwable]()
    val explains = new LinkedHashMap[String, JMap[String, Object]]()

    for ((carrier, make) <- CARRIERS) {
      for (scenario <- SCENARIOS.take(4)) {
        for (variant <- List("throw", "explain", "nothrow")) {
          val key = carrier + "/" + scenario.name + "/" + variant
          // The transport is where the bytes are meant to arrive, whole.
          val seen = new Scenario(scenario.name, (url, fetchdef) => {
            sent.put(key, fetchdef.get("body"))
            scenario.respond(url, fetchdef)
          })
          val sdk = makeSdk(seen, sinks, null)
          val ctrl: JMap[String, Object] = variant match {
            case "throw" => null
            case "explain" => om("explain" -> new LinkedHashMap[String, Object]())
            case _ => om("throw" -> B(false), "explain" -> new LinkedHashMap[String, Object]())
          }
          val err = drive(sdk, target.withData(om("$body" -> make())), ctrl, sinks)
          if (err != null) errors.put(key, err)
          val explain = if (ctrl == null) null else Helpers.toMapAny(ctrl.get("explain"))
          if (explain != null) explains.put(key, explain)
          collect(sinks, "sdk", sdk)
        }
      }
    }

    val all = sinks.toArray(new Array[Sink](0)).toList
    val leaked = all.map(s => (s.name, contentLeaks(s.text))).filter(l => l._2.nonEmpty)

    println("clean: content swept " + all.size + " surface(s), " + leaked.size + " leak(s)")

    rep.check("clean.content.no-leak", leaked.isEmpty, "a body of bytes leaked through: " +
      leaked.map(l => l._1 + " [" + l._2.mkString(", ") + "]").mkString("; "))

    // The positive half: where the body was, what describes it now is, and
    // the request is untouched. A stream is read into bytes before the
    // request is built, so its body is described as bytes too.
    val desc = om("binary$" -> "bytes", "size" -> I(CONTENT_BYTES.length), "type" -> target.media)
    for ((carrier, _) <- CARRIERS) {
      val name = "clean.content." + carrier
      rep.eq(name + ".sent", CONTENT, sentText(sent.get(carrier + "/notfound/throw")))
      errors.get(carrier + "/notfound/throw") match {
        case failed: SdkError =>
          rep.eq(name + ".thrown-spec", desc, bodyOf(failed.spec))
          val live = if (failed.ctx == null || failed.ctx.spec == null) null else failed.ctx.spec.body
          rep.eq(name + ".live-request", CONTENT, sentText(live))
        case other =>
          rep.fail(name + ".sdkerror", "the 404 scenario should throw an SdkError, got " + other)
      }
      val explained = explains.get(carrier + "/ok/explain")
      rep.check(name + ".explained", explained != null, "the explain record is missing")
      if (explained != null) {
        rep.eq(name + ".explain-spec", desc, bodyOf(explained.get("spec")))
        rep.eq(name + ".explain-fetch", desc, bodyOf(explained.get("fetchdef")))
      }
    }

    // By type, wherever it sits and whatever the operation: a stream is
    // described without being read, and a sensitive name still masks.
    val bytes = om("binary$" -> "bytes", "size" -> I(CONTENT_BYTES.length))
    val probe = makeSdk(SCENARIOS.head, new ArrayList[Sink](), null)
    val unread = new ByteArrayInputStream(CONTENT_BYTES)
    rep.eq("clean.content.by-type",
      om("upload" -> om("binary$" -> "stream"), "parts" -> SdkTestSupport.jl(bytes), "token" -> MASK),
      probe.getUtility().clean(probe.getRootCtx(), om("upload" -> unread,
        "parts" -> SdkTestSupport.jl(CONTENT_BYTES.clone()), "token" -> CONTENT_BYTES.clone())))
    rep.eqI("clean.content.stream-unread", CONTENT_BYTES.length, unread.available())

    // An error is cleaned in place, and what it holds is described.
    val held = new SdkError("held", "upload failed", null)
    held.spec = om("body" -> CONTENT_BYTES.clone())
    held.result = CONTENT_BYTES.clone()
    rep.check("clean.content.error-in-place",
      probe.getUtility().clean(probe.getRootCtx(), held) eq held, "clean should return the error it was given")
    rep.eq("clean.content.error-spec", om("body" -> bytes), held.spec)
    rep.eq("clean.content.error-result", bytes, held.result)

    // By the model: the body is described wherever it sits in what is
    // cleaned, other text stays, and a string cleaned alone stays a string.
    errors.get("String/notfound/throw") match {
      case failed: SdkError if failed.ctx != null =>
        val opctx = failed.ctx
        rep.eq("clean.content.by-model", om("held" -> SdkTestSupport.jl(desc), "note" -> "kept"),
          opctx.utility.clean(opctx, om("held" -> SdkTestSupport.jl(CONTENT), "note" -> "kept")))
        rep.eq("clean.content.string-stays", CONTENT, opctx.utility.clean(opctx, CONTENT))
      case other =>
        rep.fail("clean.content.by-model", "the string carrier should fail with its context, got " + other)
    }
    rep.eq("clean.content.text-stays", om("held" -> CONTENT),
      probe.getUtility().clean(probe.getRootCtx(), om("held" -> CONTENT)))
  }

  private def contentSensitivity(rep: SdkTestReport): Unit = {
    val target = binaryOp()
    if (target == null) {
      println("clean: skipped: " + NO_BINARY_OP)
      return
    }

    for ((carrier, make) <- CARRIERS) {
      val sinks = new ArrayList[Sink]()
      val sdk = makeSdk(SCENARIOS(1), sinks, om("active" -> B(false)))
      val err = drive(sdk, target.withData(om("$body" -> make())), null, sinks)
      rep.check("clean.content.off." + carrier + ".throws", err != null,
        carrier + ": the 404 scenario must throw")
      val leaked = sinks.toArray(new Array[Sink](0)).toList.filter(s => contentLeaks(s.text).nonEmpty)
      rep.check("clean.content.off." + carrier + ".shows-bytes", leaked.nonEmpty,
        carrier + ": with clean off, nothing showed the bytes: the sweep is blind")
    }
  }

  private def responseSweep(rep: SdkTestReport): Unit = {
    val target = usableOp()
    if (target == null) {
      println("clean: skipped: " + NO_OP)
      return
    }

    val sinks = new ArrayList[Sink]()
    val errors = new LinkedHashMap[String, Throwable]()

    for (status <- List(200, 404, 500)) {
      for (variant <- List("throw", "explain", "nothrow")) {
        val sdk = makeSdk(bytesScenario(status, "audio/wav"), sinks, null)
        val ctrl: JMap[String, Object] = variant match {
          case "throw" => null
          case "explain" => om("explain" -> new LinkedHashMap[String, Object]())
          case _ => om("throw" -> B(false), "explain" -> new LinkedHashMap[String, Object]())
        }
        val err = drive(sdk, target, ctrl, sinks)
        if (err != null) errors.put(status.toString + "/" + variant, err)
        collect(sinks, "sdk", sdk)
      }
    }

    val all = sinks.toArray(new Array[Sink](0)).toList
    val leaked = all.map(s => (s.name, contentLeaks(s.text, RESPONSE))).filter(l => l._2.nonEmpty)

    println("clean: response swept " + all.size + " surface(s), " + leaked.size + " leak(s)")

    rep.check("clean.response.no-leak", leaked.isEmpty, "a response of bytes leaked through: " +
      leaked.map(l => l._1 + " [" + l._2.mkString(", ") + "]").mkString("; "))

    // The failure still names what it could not read.
    errors.get("200/throw") match {
      case failed: SdkError =>
        rep.eq("clean.response.code", "response_content_type", failed.code)
        rep.check("clean.response.names-type", String.valueOf(failed.getMessage).contains("audio/wav"),
          "the error does not name the type: " + failed.getMessage)
      case other =>
        rep.fail("clean.response.sdkerror", "a response of bytes must fail the operation, got " + other)
    }
  }

  private def responseSensitivity(rep: SdkTestReport): Unit = {
    val target = usableOp()
    if (target == null) {
      println("clean: skipped: " + NO_OP)
      return
    }

    val sinks = new ArrayList[Sink]()
    val sdk = makeSdk(bytesScenario(200, "audio/wav"), sinks, om("active" -> B(false)))
    val err = drive(sdk, target, null, sinks)
    rep.check("clean.response.off.throws", err != null, "a response of bytes must fail the operation")
    val leaked =
      sinks.toArray(new Array[Sink](0)).toList.filter(s => contentLeaks(s.text, RESPONSE).nonEmpty)
    rep.check("clean.response.off.shows-bytes", leaked.nonEmpty,
      "with clean off, nothing showed the response: the sweep is blind")
  }

  // A feature's name is not a field name: only the sensitive names inside its
  // settings register. An entity block, of per-entity settings or seeded
  // records keyed by entity name and id, is not read at all, and nor are
  // rbac's rules, keyed by entity and operation names.
  private def featureNames(rep: SdkTestReport): Unit = {
    val sdk = construct(om(
      "apikey" -> CANARY_APIKEY,
      "feature" -> om(
        "zzsecrets" -> om("active" -> B(false), "kind" -> "PLAINSETTING-q8w2e4r6"),
        "zzfeat" -> om("active" -> B(false), "apitoken" -> "FEATTOKEN-z9y8x7w6"),
        "rbac" -> om("active" -> B(false), "rules" -> om("zztoken.load" -> "PLAINRULE-k7j5h3g1")),
        "test" -> om("active" -> B(false), "entity" -> om(
          "zztoken" -> om("ZZTOKEN01" -> om("note" -> "PLAINRECORD-t5r3e1w9"))))),
      "entity" -> om("zztoken" -> om("alias" -> om("zzkey" -> "PLAINALIAS-m2n4b6v8")))))
    def clean(s: String): Object = sdk.getUtility().clean(sdk.getRootCtx(), s)

    rep.eq("clean.feature.setting", "kind PLAINSETTING-q8w2e4r6", clean("kind PLAINSETTING-q8w2e4r6"))
    rep.eq("clean.feature.token", "token " + MASK, clean("token FEATTOKEN-z9y8x7w6"))
    rep.eq("clean.entity.record", "record PLAINRECORD-t5r3e1w9", clean("record PLAINRECORD-t5r3e1w9"))
    rep.eq("clean.entity.alias", "alias PLAINALIAS-m2n4b6v8", clean("alias PLAINALIAS-m2n4b6v8"))
    rep.eq("clean.rbac.rule", "rule PLAINRULE-k7j5h3g1", clean("rule PLAINRULE-k7j5h3g1"))
  }

  private def configBlock(rep: SdkTestReport): Unit = {
    val utility = construct(om()).getUtility()
    val config = om("options" -> om("clean" -> om("keys" -> "zzsens", "values" -> "CONFIG-SEEDED-1")))
    val ctx = utility.makeContext(om("utility" -> utility, "config" -> config,
      "options" -> om("clean" -> om("values" -> "CALLER-SEEDED-2"))), null)
    ctx.options = utility.makeOptions(ctx)

    rep.eq("clean.config.values", "a " + MASK + " b " + MASK,
      utility.clean(ctx, "a CONFIG-SEEDED-1 b CALLER-SEEDED-2"))
    val masked = Helpers.toMapAny(utility.clean(ctx, om("my_zzsens" -> "x", "other" -> "y")))
    rep.eq("clean.config.keys", om("my_zzsens" -> MASK, "other" -> "y"), masked)
    rep.eq("clean.config.unchanged", "CONFIG-SEEDED-1",
      Struct.getpath(config, java.util.List.of("options", "clean", "values")))
  }

  private def noBlock(rep: SdkTestReport): Unit = {
    val utility = construct(om()).getUtility()
    val ctx = utility.makeContext(om("utility" -> utility,
      "options" -> om("apikey" -> "NOBLOCK-APIKEY-k3j5h7")), null)
    ctx.options = utility.makeOptions(ctx)

    rep.eq("clean.no-block.values", "failed with " + MASK,
      utility.clean(ctx, "failed with NOBLOCK-APIKEY-k3j5h7"))
    val masked = Helpers.toMapAny(utility.clean(ctx, om("x-session-token" -> "RESP-TOKEN-a1b2c3d4e5")))
    rep.eq("clean.no-block.keys", om("x-session-token" -> MASK), masked)
  }

  def main(args: Array[String]): Unit = {
    val rep = new SdkTestReport()

    rep.scope("clean-no-credential-leaves-the-sdk") { sweep(rep) }
    rep.scope("clean-the-sweep-can-see-a-leak") { sensitivity(rep) }
    rep.scope("clean-no-body-of-bytes-leaves-the-sdk") { contentSweep(rep) }
    rep.scope("clean-the-sweep-can-see-a-body") { contentSensitivity(rep) }
    rep.scope("clean-no-response-of-bytes-leaves-the-sdk") { responseSweep(rep) }
    rep.scope("clean-the-sweep-can-see-a-response") { responseSensitivity(rep) }
    rep.scope("clean-a-feature-name-does-not-make-its-settings-secret") { featureNames(rep) }
    rep.scope("clean-the-config-clean-block-is-honoured") { configBlock(rep) }
    rep.scope("clean-with-no-clean-block-the-schema-defaults-apply") { noBlock(rep) }

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
