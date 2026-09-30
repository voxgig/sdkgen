
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


// The canary sweep: every credential slot holds a distinctive value, every
// diagnostic feature this SDK ships is switched on with a capturing sink, a
// real operation runs through every outcome, and every string that leaves
// the SDK is searched for the canaries and their encoded forms. It also
// proves its own sensitivity: with clean switched off the canary MUST show.
const TestClean = cmp(function TestClean(props: any) {
  const model: Model = props.ctx$.model
  const target = props.target
  const kotlinpackage: string = props.kotlinpackage

  const SDK = model.const.Name + 'SDK'

  const auth = {
    suppressed: isAuthSuppressed(model),
    where: resolveAuthIn(model),
    name: 'header' === resolveAuthIn(model)
      ? resolveAuthName(model).toLowerCase() : resolveAuthName(model),
    basic: isHttpBasicAuth(model),
  }

  File({ name: 'CleanTest.' + target.ext }, () => Content(render(kotlinpackage, SDK, auth)))
})


type AuthSpec = { suppressed: boolean, where: string, name: string, basic: boolean }


function render(kotlinpackage: string, SDK: string, auth: AuthSpec): string {
  return `package ${kotlinpackage}.sdktest

// The canary sweep: every credential slot holds a distinctive value, every
// diagnostic feature this SDK ships is switched on with a capturing sink, a
// real operation runs through every outcome, and every string that leaves
// the SDK is searched for the canaries and their encoded forms. It also
// proves its own sensitivity: with clean switched off the canary MUST show.

import java.io.PrintWriter
import java.io.StringWriter
import java.lang.reflect.Method
import java.lang.reflect.Modifier
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.Base64
import java.util.function.Consumer
import java.util.function.Supplier
import java.util.logging.Handler
import java.util.logging.Level
import java.util.logging.LogRecord
import java.util.logging.Logger

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

import ${kotlinpackage}.core.Config
import ${kotlinpackage}.core.Context
import ${kotlinpackage}.core.Helpers
import ${kotlinpackage}.core.${SDK}
import ${kotlinpackage}.core.Result
import ${kotlinpackage}.core.SdkEntity
import ${kotlinpackage}.core.SdkError
import ${kotlinpackage}.core.Spec
import ${kotlinpackage}.feature.BaseFeature
import ${kotlinpackage}.sdktest.FeatureHarness.fhHasFeature
import ${kotlinpackage}.utility.struct.Struct

@Suppress("UNCHECKED_CAST")
class CleanTest {

  // Generated: the credential's wire placement is fixed when the SDK is built.
  private val authSuppressed = ${auth.suppressed}
  private val authWhere = "${ktstr(auth.where)}"
  private val authName = "${ktstr(auth.name)}"

  private val canaryApikey = "CANARY-APIKEY-k9x2m7q4p1"
  private val canarySecret = "CANARY-SECRET-w3e8r5t2y6"
  private val canaryHeader = "CANARY-HEADER-z1x4c7v0b3"
  private val canaryValue = "CANARY-VALUE-n5m8b2v9c4"

  private val mask = "[redacted]"

  private fun b64(s: String): String =
    Base64.getEncoder().encodeToString(s.toByteArray(StandardCharsets.UTF_8))

  // Every form a canary can travel in.
  private val forms: List<String> = run {
    val out = mutableListOf<String>()
    for (v in listOf(canaryApikey, canarySecret, canaryHeader, canaryValue)) {
      out.add(v)
      out.add(b64(v))
      out.add(URLEncoder.encode(v, StandardCharsets.UTF_8))
    }
    out.add(b64(canaryApikey + ":" + canarySecret))
    out
  }

  class Sink(val name: String, val text: String)

  // Header maps keep the caller's spelling; the assertion should not care.
  private fun header(map: Any?, name: String): Any? {
    val m = Helpers.toMapAny(map) ?: return null
    for ((k, v) in m) {
      if (k.lowercase() == name.lowercase()) {
        return v
      }
    }
    return null
  }

  private fun leaks(text: String): List<String> = forms.filter { text.contains(it) }

  // The SDK's own objects print their data, not a class name, so a raw spec
  // handed back with clean off shows what it holds.
  private fun plain(v: Any?): Any? = when (v) {
    is Spec -> linkedMapOf<String, Any?>(
      "method" to v.method, "url" to v.url, "path" to v.path,
      "headers" to v.headers, "query" to v.query, "body" to v.body)
    is Result -> linkedMapOf<String, Any?>(
      "status" to v.status, "headers" to v.headers, "body" to v.body, "resdata" to v.resdata)
    is SdkEntity -> v.data()
    else -> v
  }

  private fun stack(err: Throwable): String {
    val sw = StringWriter()
    err.printStackTrace(PrintWriter(sw))
    return sw.toString()
  }

  private fun surfaces(name: String, v: Any?): List<Sink> {
    val out = mutableListOf<Sink>()
    val push = { kind: String, fn: () -> String ->
      try {
        out.add(Sink(name + ":" + kind, fn()))
      } catch (e: Throwable) {
      }
    }
    push("json") { Struct.jsonify(plain(v)) }
    push("string") { v.toString() }
    if (v is Throwable) {
      push("message") { v.message ?: "" }
      push("stack") { stack(v) }
    }
    if (v is SdkError) {
      push("map") { Struct.jsonify(v.toMap()) }
      push("spec") { Struct.jsonify(plain(v.spec)) }
      push("result") { Struct.jsonify(plain(v.result)) }
    }
    if (v is Context) {
      push("record") { Struct.jsonify(v.toMap()) }
    }
    return out
  }

  // Captures the serialised context from inside the pipeline: what a hook
  // author would hand to a logger.
  inner class CaptureFeature(private val sinks: MutableList<Sink>) :
    BaseFeature("capture", "0.0.1", true) {
    override fun preRequest(ctx: Context) { sinks.addAll(surfaces("ctx@PreRequest", ctx)) }
    override fun preResponse(ctx: Context) { sinks.addAll(surfaces("ctx@PreResponse", ctx)) }
    override fun preUnexpected(ctx: Context) { sinks.addAll(surfaces("ctx@PreUnexpected", ctx)) }
  }

  class Scenario(val name: String, val respond: (String, MutableMap<String, Any?>) -> Any?)

  private fun response(status: Int, data: Any?, headers: Map<String, String>?): MutableMap<String, Any?> {
    val h = linkedMapOf<String, Any?>("content-type" to "application/json")
    headers?.forEach { (k, v) -> h[k] = v }
    val out = linkedMapOf<String, Any?>()
    out["status"] = status
    out["statusText"] = if (status < 400) "OK" else "ERR"
    out["headers"] = h
    out["json"] = Supplier<Any?> { data }
    out["body"] = Struct.jsonify(data)
    return out
  }

  private val scenarios: List<Scenario> = listOf(
    Scenario("ok") { _, _ ->
      response(200, linkedMapOf<String, Any?>("id" to "i1", "name" to "n1"),
        mapOf("x-session-token" to "RESP-TOKEN-a1b2c3d4e5"))
    },
    Scenario("notfound") { _, _ ->
      response(404, linkedMapOf<String, Any?>("error" to "no such record"), null)
    },
    Scenario("server") { _, _ ->
      response(500, linkedMapOf<String, Any?>("error" to "boom"), null)
    },
    Scenario("transport") { url, _ ->
      throw RuntimeException("socket hang up (URL was: \\"" + url + "\\")")
    },
    Scenario("notjson") { _, _ ->
      val out = linkedMapOf<String, Any?>()
      out["status"] = 200
      out["statusText"] = "OK"
      out["headers"] = linkedMapOf<String, Any?>()
      out["json"] = Supplier<Any?> { null }
      out["body"] = "<html>"
      out
    },
  )

  private fun makeSdk(scenario: Scenario, sinks: MutableList<Sink>, cleanopts: Map<String, Any?>?): ${SDK} {
    val capture = { name: String -> Consumer<Any?> { rec -> sinks.addAll(surfaces(name, rec)) } }

    val feature = linkedMapOf<String, Any?>()
    if (fhHasFeature("log")) {
      val logger = Logger.getLogger("clean-sweep-" + System.nanoTime())
      logger.useParentHandlers = false
      logger.level = Level.ALL
      logger.addHandler(object : Handler() {
        override fun publish(record: LogRecord) { sinks.addAll(surfaces("log", record.message)) }
        override fun flush() {}
        override fun close() {}
      })
      feature["log"] = linkedMapOf<String, Any?>("active" to true, "logger" to logger)
    }
    if (fhHasFeature("debug")) {
      feature["debug"] = linkedMapOf<String, Any?>("active" to true, "onEntry" to capture("debug"))
    }
    if (fhHasFeature("audit")) {
      feature["audit"] = linkedMapOf<String, Any?>("active" to true, "sink" to capture("audit"))
    }
    if (fhHasFeature("telemetry")) {
      feature["telemetry"] = linkedMapOf<String, Any?>("active" to true, "exporter" to capture("telemetry"))
    }
    if (fhHasFeature("cost")) {
      feature["cost"] = linkedMapOf<String, Any?>("active" to true, "sink" to capture("cost"))
    }
    if (fhHasFeature("metrics")) {
      feature["metrics"] = linkedMapOf<String, Any?>("active" to true)
    }
    if (fhHasFeature("clienttrack")) {
      feature["clienttrack"] = linkedMapOf<String, Any?>("active" to true)
    }

    val clean = linkedMapOf<String, Any?>("values" to canaryValue)
    cleanopts?.forEach { (k, v) -> clean[k] = v }

    val fetcher: (Context, String, MutableMap<String, Any?>) -> Any? =
      { _, url, fetchdef -> scenario.respond(url, fetchdef) }

    val opts = linkedMapOf<String, Any?>()
    opts["apikey"] = canaryApikey
    opts["secret"] = canarySecret
    opts["headers"] = linkedMapOf<String, Any?>("X-Custom-Token" to canaryHeader)
    opts["clean"] = clean
    opts["feature"] = feature
    opts["extend"] = mutableListOf<Any?>(CaptureFeature(sinks))
    opts["utility"] = linkedMapOf<String, Any?>("fetcher" to fetcher)
    return ${SDK}(opts)
  }

  class Target(val accessor: Method, val op: String)

  private fun accessors(): List<Method> =
    ${SDK}::class.java.methods
      .filter {
        SdkEntity::class.java.isAssignableFrom(it.returnType) &&
          it.parameterCount == 1 && Modifier.isPublic(it.modifiers)
      }
      .sortedBy { it.name }

  private fun entityOf(sdk: ${SDK}, m: Method): SdkEntity? =
    try {
      m.invoke(sdk, *arrayOf<Any?>(null)) as? SdkEntity
    } catch (e: Throwable) {
      null
    }

  private fun call(ent: SdkEntity, op: String, ctrl: MutableMap<String, Any?>?): Any? = when (op) {
    "list" -> ent.list(linkedMapOf(), ctrl)
    "load" -> ent.load(linkedMapOf(), ctrl)
    "create" -> ent.create(linkedMapOf(), ctrl)
    "update" -> ent.update(linkedMapOf(), ctrl)
    "remove" -> ent.remove(linkedMapOf(), ctrl)
    else -> throw IllegalArgumentException("no such op: " + op)
  }

  // The first operation that completes against a plain 200 with no arguments
  // (a required path parameter would fail before the request is built).
  private fun usableOp(): Target? {
    val plainFetch: (Context, String, MutableMap<String, Any?>) -> Any? =
      { _, _, _ -> response(200, linkedMapOf<String, Any?>("id" to "i1"), null) }
    val plain = ${SDK}(linkedMapOf<String, Any?>(
      "apikey" to canaryApikey,
      "utility" to linkedMapOf<String, Any?>("fetcher" to plainFetch)))
    val entities = Helpers.toMapAny(Config.sharedConfig()["entity"]) ?: linkedMapOf()
    val rank = mapOf("list" to 0, "load" to 1)
    for (m in accessors()) {
      val inst = entityOf(plain, m) ?: continue
      val ecfg = Helpers.toMapAny(entities[inst.name]) ?: continue
      val ops = (Helpers.toMapAny(ecfg["op"]) ?: linkedMapOf()).keys.sortedBy { rank[it] ?: 2 }
      for (op in ops) {
        try {
          call(entityOf(plain, m)!!, op, null)
          return Target(m, op)
        } catch (e: Throwable) {
          continue
        }
      }
    }
    return null
  }

  private fun drive(sdk: ${SDK}, target: Target, ctrl: MutableMap<String, Any?>?, sinks: MutableList<Sink>): Throwable? {
    var out: Any? = null
    var err: Throwable? = null
    try {
      out = call(entityOf(sdk, target.accessor)!!, target.op, ctrl)
    } catch (e: Throwable) {
      err = e
    }
    if (err != null) {
      sinks.addAll(surfaces("error", err))
    }
    if (out != null) {
      sinks.addAll(surfaces("result", out))
    }
    val explain = ctrl?.get("explain")
    if (explain != null) {
      sinks.addAll(surfaces("explain", explain))
    }
    return err
  }

  @Test
  fun noCredentialLeavesTheSdkInAnyForm() {
    val target = usableOp()
    assertNotNull(target, "no operation completes without arguments; nothing to sweep")

    val sinks = mutableListOf<Sink>()
    val errors = linkedMapOf<String, Throwable>()
    val explains = linkedMapOf<String, MutableMap<String, Any?>>()

    for (scenario in scenarios) {
      for (variant in listOf("throw", "explain", "nothrow")) {
        val sdk = makeSdk(scenario, sinks, null)
        val ctrl: MutableMap<String, Any?>? = when (variant) {
          "throw" -> null
          "explain" -> linkedMapOf<String, Any?>("explain" to linkedMapOf<String, Any?>())
          else -> linkedMapOf<String, Any?>("throw" to false, "explain" to linkedMapOf<String, Any?>())
        }
        val err = drive(sdk, target!!, ctrl, sinks)
        val key = scenario.name + "/" + variant
        if (err != null) {
          errors[key] = err
        }
        val explain = Helpers.toMapAny(ctrl?.get("explain"))
        if (explain != null) {
          explains[key] = explain
        }
        sinks.addAll(surfaces("sdk", sdk))
      }
    }

    val leaked = sinks
      .map { Pair(it.name, leaks(it.text)) }
      .filter { it.second.isNotEmpty() }

    println("clean: swept " + sinks.size + " surface(s), " + leaked.size + " leak(s)")

    assertEquals(0, leaked.size, "credential leaked through: " +
      leaked.joinToString("; ") { it.first + " [" + it.second.joinToString(", ") + "]" })

    // The positive half: the slot the credential travelled in is masked,
    // and an unregistered token in a response header is masked by name.
    val notfound = errors["notfound/throw"]
    assertNotNull(notfound, "the 404 scenario must throw")
    assertTrue(notfound is SdkError, "the 404 scenario should throw an SdkError, got " + notfound)
    val nf = notfound as SdkError
    assertEquals(404, nf.status)
    val spec = Helpers.toMapAny(nf.spec) ?: linkedMapOf()
    if (!authSuppressed) {
      if ("query" == authWhere) {
        assertEquals(mask, header(spec["query"], authName))
      } else if ("cookie" == authWhere) {
        assertTrue(header(spec["headers"], "cookie").toString().contains(mask),
          "cookie: " + header(spec["headers"], "cookie"))
      } else {
        assertTrue(header(spec["headers"], authName).toString().endsWith(mask),
          authName + ": " + header(spec["headers"], authName))
      }
    }
    assertEquals(mask, header(spec["headers"], "x-custom-token"))

    val explained = explains["ok/explain"] ?: linkedMapOf()
    val result = Helpers.toMapAny(explained["result"])
    assertNotNull(result, "the explain record should carry the result")
    assertEquals(mask, header(result!!["headers"], "x-session-token"))
  }

  @Test
  fun theSweepCanSeeALeakCleanSwitchedOffShowsTheCredential() {
    val target = usableOp()
    assertNotNull(target)

    val sinks = mutableListOf<Sink>()
    val sdk = makeSdk(scenarios[1], sinks, mapOf("active" to false))
    val err = drive(sdk, target!!, null, sinks)
    assertNotNull(err)

    val leaked = sinks.filter { leaks(it.text).isNotEmpty() }
    assertTrue(leaked.isNotEmpty(), "with clean off, nothing showed the canary: the sweep is blind")

    if (!authSuppressed) {
      val text = Struct.jsonify(plain((err as? SdkError)?.spec))
      assertTrue(text.contains(canaryApikey) || text.contains(b64(canaryApikey + ":" + canarySecret)),
        "the raw spec should carry the credential when clean is off")
    }
  }
}
`
}


// A Kotlin double-quoted string literal body: the auth name comes from the
// API's own securityScheme.
function ktstr(s: string): string {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
}


export {
  TestClean
}
