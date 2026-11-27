package KOTLINPACKAGE.sdktest

// Every form, multipart and raw point this SDK has, driven through a real
// entity operation against a local listener that decodes what arrives. The
// cases come from the client's own config, so no case names an entity.

import java.io.ByteArrayOutputStream
import java.lang.reflect.InvocationTargetException
import java.lang.reflect.Method
import java.lang.reflect.Proxy
import java.net.InetSocketAddress
import java.util.stream.Stream

import com.sun.net.httpserver.HttpServer

import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertSame
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assumptions
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import org.junit.jupiter.api.TestInstance

import KOTLINPACKAGE.core.ProjectNameSDK
import KOTLINPACKAGE.core.SdkEntity
import KOTLINPACKAGE.core.SdkError

@Suppress("UNCHECKED_CAST")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class CodecTest {

  private val handleClass = "KOTLINPACKAGE.utility.codec.HandleCodec"

  private val writes = listOf("create", "update", "patch")

  private class Answer(val status: Int, val type: String, val body: ByteArray)

  private class Arrived(val type: String, val body: ByteArray)

  /** One expected item: a text value, or a file part. */
  private data class Expect(
    val name: String,
    val value: String? = null,
    val file: String? = null,
    val filename: String? = null,
    val type: String? = null,
  )

  private class Case(val name: String, val run: (ProjectNameSDK) -> Unit)

  private var server: HttpServer? = null
  private var base = ""
  @Volatile private var answer = Answer(200, "application/json", ByteArray(0))
  private val arrivals = mutableListOf<Arrived>()
  private var ran = 0
  private var failed = 0

  private val probe = ProjectNameSDK(linkedMapOf<String, Any?>("base" to "http://127.0.0.1:1"))

  private fun config(): MutableMap<String, Any?> = probe.getRootCtx().config!!

  // Entity name to the client method that builds one.
  private fun accessors(): Map<String, Method> {
    val out = sortedMapOf<String, Method>()
    val entities = config()["entity"] as? Map<String, Any?> ?: return out
    for (m in ProjectNameSDK::class.java.methods) {
      if (1 != m.parameterCount || !Map::class.java.isAssignableFrom(m.parameterTypes[0]) ||
        !SdkEntity::class.java.isAssignableFrom(m.returnType)) {
        continue
      }
      val ent = try {
        m.invoke(probe, *arrayOf<Any?>(null)) as? SdkEntity
      } catch (e: Exception) {
        null
      } ?: continue
      if (entities.containsKey(ent.name)) {
        out[ent.name] = m
      }
    }
    return out
  }

  private fun params(point: Map<String, Any?>): MutableMap<String, Any?> {
    val out = linkedMapOf<String, Any?>()
    for (part in point["parts"] as? List<*> ?: listOf<Any?>()) {
      val m = Regex("^\\{(.+)\\}$").matchEntire(part.toString())
      if (m != null) {
        out[m.groupValues[1]] = "p1"
      }
    }
    return out
  }

  private fun action(point: Map<String, Any?>): String? =
    (point["select"] as? Map<String, Any?>)?.get("\$action") as? String

  private fun select(point: Map<String, Any?>): MutableMap<String, Any?> {
    val out = linkedMapOf<String, Any?>()
    action(point)?.let { out["\$action"] = it }
    return out
  }

  private fun content(name: String): ByteArray =
    ("file:" + name + "\u0000ÿ\r\n--").toByteArray(Charsets.ISO_8859_1)

  private fun latin1(bytes: ByteArray): String = String(bytes, Charsets.ISO_8859_1)

  private fun call(target: Any, method: String, types: Array<Class<*>>, vararg args: Any?): Any? =
    try {
      target.javaClass.getMethod(method, *types).invoke(target, *args)
    } catch (e: InvocationTargetException) {
      throw e.cause ?: e
    }

  private fun handle(ent: Any, slot: String?): Any =
    (if (slot == null) call(ent, "binary", arrayOf()) else
      call(ent, "binary", arrayOf(String::class.java), slot))!!

  // The data a form or multipart point is sent, and the items it must arrive as.
  private fun plan(client: ProjectNameSDK, body: Map<String, Any?>,
    data: MutableMap<String, Any?>): List<Expect> {
    val form = "form" == body["kind"]
    val expect = mutableListOf<Expect>()
    for (f in body["fields"] as? List<*> ?: listOf<Any?>()) {
      val field = f as Map<String, Any?>
      val name = field["name"].toString()
      if (true == field["binary"]) {
        val type = if (form) null else field["media"] as? String ?: "application/octet-stream"
        data[name] = client.binary.bytes(content(name), "/local/dir/$name.bin", type)
        expect.add(if (form) Expect(name, value = latin1(content(name)))
        else Expect(name, file = latin1(content(name)), filename = "$name.bin", type = type))
      } else if (true == field["list"]) {
        data[name] = listOf("a", "b c")
        expect.add(Expect(name, value = "a"))
        expect.add(Expect(name, value = "b c"))
      } else if (field["join"] is String) {
        data[name] = listOf("a", "b")
        expect.add(Expect(name, value = "a" + field["join"] + "b"))
      } else {
        data[name] = "v\"" + name + "\r\n"
        expect.add(Expect(name, value = latin1(("v\"" + name + "\r\n").toByteArray(Charsets.UTF_8))))
      }
    }
    return expect
  }

  private fun multipart(arrived: Arrived): List<Expect> {
    val bm = Regex("boundary=([^;]+)").find(arrived.type)
    assertNotNull(bm, "no boundary in " + arrived.type)
    val boundary = bm!!.groupValues[1]
    val text = latin1(arrived.body)
    assertTrue(text.endsWith("--$boundary--\r\n"), "the body does not close")
    val chunks = text.split("--$boundary")
    val disp = Regex("^Content-Disposition: form-data; name=\"([^\"]*)\"(?:; filename=\"([^\"]*)\")?$",
      RegexOption.MULTILINE)
    val ctype = Regex("^Content-Type: (.*)$", RegexOption.MULTILINE)
    val parts = mutableListOf<Expect>()
    for (chunk in chunks.subList(1, chunks.size - 1)) {
      val at = chunk.indexOf("\r\n\r\n")
      val head = chunk.substring(2, at)
      val body = chunk.substring(at + 4, chunk.length - 2)
      val dm = disp.find(head)
      assertNotNull(dm, "a part without a disposition: $head")
      val type = ctype.find(head)?.groupValues?.get(1)
      val filename = dm!!.groups[2]?.value
      parts.add(if (filename == null) Expect(dm.groupValues[1], value = body)
      else Expect(dm.groupValues[1], file = body, filename = filename, type = type))
    }
    return parts
  }

  // Form pairs, each value its bytes as latin1.
  private fun form(arrived: Arrived): List<Expect> {
    val text = latin1(arrived.body)
    if (text.isEmpty()) return listOf()
    return text.split("&").map {
      val kv = it.split("=", limit = 2)
      Expect(unescape(kv[0]), value = unescape(if (kv.size < 2) "" else kv[1]))
    }
  }

  private fun unescape(text: String): String {
    val out = ByteArrayOutputStream()
    var i = 0
    while (i < text.length) {
      val c = text[i]
      when (c) {
        '+' -> out.write(' '.code)
        '%' -> {
          out.write(text.substring(i + 1, i + 3).toInt(16))
          i += 2
        }
        else -> out.write(c.code)
      }
      i++
    }
    return latin1(out.toByteArray())
  }

  private fun only(got: List<Expect>, expect: List<Expect>): List<Expect> =
    got.filter { g -> expect.any { it.name == g.name } }

  private fun arrived(): Arrived = synchronized(arrivals) {
    assertFalse(arrivals.isEmpty(), "nothing arrived")
    arrivals.last()
  }

  private fun json(): ByteArray = "{\"id\":\"p1\"}".toByteArray(Charsets.UTF_8)

  private fun cases(): List<Case> {
    val out = mutableListOf<Case>()
    val entities = config()["entity"] as Map<String, Any?>

    for ((ename, accessor) in accessors()) {
      val ops = ((entities[ename] as Map<String, Any?>)["op"] as? Map<String, Any?> ?: mapOf())
        .toSortedMap()
      for ((opname, opdef) in ops) {
        for (p in (opdef as Map<String, Any?>)["points"] as? List<*> ?: listOf<Any?>()) {
          val point = p as Map<String, Any?>
          val label = ename + "." + opname + (action(point)?.let { ":$it" } ?: "")
          val rb = point["body"] as? Map<String, Any?> ?: mapOf()
          val rs = point["response"] as? Map<String, Any?> ?: mapOf()
          val rbkind = rb["kind"]
          val entity = { client: ProjectNameSDK -> accessor.invoke(client, *arrayOf<Any?>(null)) as SdkEntity }

          if (("form" == rbkind || "multipart" == rbkind) && writes.contains(opname)) {
            out.add(Case("$label sends a $rbkind body") { client ->
              val data = linkedMapOf<String, Any?>()
              data.putAll(params(point))
              data.putAll(select(point))
              val expect = plan(client, rb, data)
              answer = Answer(200, "application/json", json())
              call(entity(client), opname, arrayOf(MutableMap::class.java, MutableMap::class.java),
                data, null)
              val got = arrived()
              if ("form" == rbkind) {
                assertEquals(rb["media"], got.type)
                assertEquals(expect, only(form(got), expect))
              } else {
                assertEquals(expect, only(multipart(got), expect))
              }
            })
          }

          if ("raw" == rbkind && writes.contains(opname)) {
            val bin = true == rb["binary"]
            out.add(Case("$label sends a raw " + (if (bin) "binary" else "text") + " body") { client ->
              answer = Answer(200, "application/json", json())
              val ent = entity(client)
              ent.data(params(point))
              ent.match(params(point))
              if (bin) {
                val got = call(handle(ent, action(point)), "put",
                  arrayOf(Any::class.java, Map::class.java),
                  client.binary.bytes(content(label), null, rb["media"] as? String), null)
                assertSame(ent, got)
                assertArrayEquals(content(label), arrived().body)
              } else {
                val data = select(point)
                data["\$body"] = "text \"$label\"\n"
                call(ent, opname, arrayOf(MutableMap::class.java, MutableMap::class.java), data, null)
                assertEquals("text \"$label\"\n", String(arrived().body, Charsets.UTF_8))
              }
              assertEquals(rb["media"], arrived().type)
            })
          }

          if ("raw" == rs["kind"] && "load" == opname) {
            val bin = true == rs["binary"]
            out.add(Case("$label reads a raw " + (if (bin) "binary" else "text") + " body") { client ->
              val ent = entity(client)
              ent.data(params(point))
              ent.match(params(point))
              val req = params(point)
              req.putAll(select(point))
              if (bin) {
                answer = Answer(200, rs["media"] as String, content(label))
                val bytes = call(handle(ent, action(point)), "bytes",
                  arrayOf(Map::class.java, Map::class.java), null, null) as ByteArray
                assertArrayEquals(content(label), bytes)
                val refused = try {
                  ent.load(req, null)
                  null
                } catch (err: SdkError) {
                  err
                }
                assertNotNull(refused, "a plain load of bytes was not refused")
                assertEquals("binary_sink_required", refused!!.code)
              } else {
                answer = Answer(200, rs["media"] as String,
                  "café $label".toByteArray(Charsets.UTF_8))
                assertSame(ent, ent.load(req, null))
                assertEquals("café $label", (ent.data() as Map<String, Any?>)["\$body"])
              }
            })
          }
        }
      }
    }
    return out
  }

  @BeforeAll
  fun listen() {
    val srv = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
    srv.createContext("/") { exchange ->
      val body = exchange.requestBody.readAllBytes()
      val type = exchange.requestHeaders.getFirst("content-type") ?: ""
      synchronized(arrivals) {
        arrivals.add(Arrived(type, body))
      }
      val a = answer
      exchange.responseHeaders.set("content-type", a.type)
      exchange.sendResponseHeaders(a.status, if (a.body.isEmpty()) -1L else a.body.size.toLong())
      exchange.responseBody.use { it.write(a.body) }
    }
    srv.start()
    server = srv
    base = "http://127.0.0.1:" + srv.address.port
  }

  @AfterAll
  fun report() {
    println("codec: ran $ran case(s), $failed failed")
    server?.stop(0)
  }

  @Test
  fun thisSdkHasAPointToDrive() {
    assertFalse(cases().isEmpty(), "no form, multipart or raw point was found")
  }

  @TestFactory
  fun codec(): Stream<DynamicTest> = cases().stream().map { kase ->
    DynamicTest.dynamicTest(kase.name) {
      ran++
      synchronized(arrivals) { arrivals.clear() }
      answer = Answer(200, "application/json", ByteArray(0))
      try {
        kase.run(ProjectNameSDK(linkedMapOf<String, Any?>("base" to base)))
      } catch (err: Throwable) {
        failed++
        throw err
      }
    }
  }

  // The handle over a recording entity, with the slots of every kind.
  private fun stubHandle(calls: MutableList<Array<Any?>>, slot: String): Any {
    val handle: Class<*>
    val def: Class<*>
    try {
      handle = Class.forName("$handleClass\$BinaryHandle")
      def = Class.forName("$handleClass\$SlotDef")
    } catch (e: ClassNotFoundException) {
      Assumptions.abort<Unit>("this SDK was generated without a binary handle")
      throw e
    }
    val mk = def.getConstructor(String::class.java, String::class.java, String::class.java)
    val slots = linkedMapOf<String, Any?>(
      "" to mk.newInstance("", "load", null),
      "audio" to mk.newInstance("audio", "load", "update"),
      "cover" to mk.newInstance("cover", null, "create"),
    )
    lateinit var self: SdkEntity
    self = Proxy.newProxyInstance(SdkEntity::class.java.classLoader,
      arrayOf(SdkEntity::class.java)) { _, method, args ->
      if ("getName" == method.name) {
        return@newProxyInstance "episode"
      }
      calls.add(arrayOf(method.name, args[0], args[1]))
      val transfer = (args[1] as Map<String, Any?>)["transfer"] as MutableMap<String, Any?>
      if ("read" == transfer["direction"]) {
        transfer["bytes"] = content("handle")
      }
      self
    } as SdkEntity
    return handle.constructors[0].newInstance(self, null, slots, slot)
  }

  private fun code(err: Throwable?): String? = if (err is SdkError) err.code else err?.toString()

  private fun failure(run: () -> Unit): Throwable? = try {
    run()
    null
  } catch (err: Throwable) {
    err
  }

  @Test
  fun aHandleReadIsOneLoadOfTheSlotsAction() {
    val calls = mutableListOf<Array<Any?>>()
    val explain = linkedMapOf<String, Any?>()
    val got = call(stubHandle(calls, "audio"), "bytes", arrayOf(Map::class.java, Map::class.java),
      null, linkedMapOf<String, Any?>("explain" to explain))
    assertArrayEquals(content("handle"), got as ByteArray)
    assertEquals(1, calls.size)
    assertEquals("load", calls[0][0])
    assertEquals(mapOf("\$action" to "audio"), calls[0][1])
    val sent = calls[0][2] as Map<String, Any?>
    assertSame(explain, sent["explain"])
    val transfer = sent["transfer"] as Map<String, Any?>
    assertEquals("audio", transfer["slot"])
    assertEquals("read", transfer["direction"])

    calls.clear()
    call(stubHandle(calls, ""), "bytes", arrayOf(Map::class.java, Map::class.java), null, null)
    assertEquals("load", calls[0][0])
    assertEquals(mapOf<String, Any?>(), calls[0][1])
  }

  @Test
  fun aHandleWriteSendsTheSourceAndResolvesToTheEntity() {
    val calls = mutableListOf<Array<Any?>>()
    val src = probe.binary.bytes(content("put"), null, "audio/wav")
    val got = call(stubHandle(calls, "audio"), "put", arrayOf(Any::class.java, Map::class.java),
      src, null)
    assertEquals("update", calls[0][0])
    assertEquals(mapOf("\$action" to "audio", "\$body" to src), calls[0][1])
    assertEquals("write",
      ((calls[0][2] as Map<String, Any?>)["transfer"] as Map<String, Any?>)["direction"])
    assertTrue(got is SdkEntity)

    calls.clear()
    call(stubHandle(calls, "cover"), "put", arrayOf(Any::class.java, Map::class.java), src, null)
    assertEquals("create", calls[0][0])
    assertEquals(1, calls.size)
  }

  @Test
  fun aHandleRefusesWhatCoreCannotDo() {
    val calls = mutableListOf<Array<Any?>>()
    val h = stubHandle(calls, "audio")
    for (what in listOf("save", "stream", "open")) {
      val err = failure { call(h, what, arrayOf(Array<Any?>::class.java), arrayOf<Any?>()) }
      assertEquals("binary_feature_inactive", code(err), what)
    }
    assertEquals("binary_feature_inactive", code(failure {
      call(h, "bytes", arrayOf(Map::class.java, Map::class.java), mapOf("range" to "0-1"), null)
    }))

    for ((slot, way, expected) in listOf(
      Triple("nope", "bytes", "binary_slot_unknown"),
      Triple("cover", "bytes", "binary_slot_direction"),
      Triple("", "put", "binary_slot_direction"))) {
      val err = failure {
        val hh = stubHandle(calls, slot)
        if ("bytes" == way) {
          call(hh, "bytes", arrayOf(Map::class.java, Map::class.java), null, null)
        } else {
          call(hh, "put", arrayOf(Any::class.java, Map::class.java), "x", null)
        }
      }
      assertEquals(expected, code(err), "$slot $way")
    }
    assertTrue(calls.isEmpty(), "a refused call ran an operation")
  }
}
