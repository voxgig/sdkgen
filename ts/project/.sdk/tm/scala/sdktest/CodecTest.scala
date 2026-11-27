// Every form, multipart and raw point this SDK has, driven through a real
// entity operation against a local listener that decodes what arrives. The
// cases come from the client's own config, so no case names an entity.
// Run: scala-cli run . --main-class SdkCodecTestMain

import java.lang.reflect.{InvocationTargetException, Method}
import java.net.InetSocketAddress
import java.nio.charset.StandardCharsets
import java.util.{ArrayList, LinkedHashMap, List => JList, Map => JMap}

import com.sun.net.httpserver.{HttpExchange, HttpServer}

import SCALAPACKAGE.core.{BinarySource, Config, Helpers, ProjectNameSDK, SdkEntity, SdkError}

object SdkCodecTestMain {

  private val Latin1 = StandardCharsets.ISO_8859_1

  final case class Arrived(method: String, url: String, headers: Map[String, String], body: Array[Byte])

  final case class Expect(name: String, value: String, filename: String = null, mediaType: String = null,
      file: Boolean = false)

  final case class CodecCase(name: String, run: Listener => Unit)

  // A loopback origin that keeps each request and answers as the case says.
  final class Listener {
    private val server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0)
    private val arrivals = new ArrayList[Arrived]()

    @volatile var status: Int = 200
    @volatile var mediaType: String = "application/json"
    @volatile var body: Array[Byte] = Array.emptyByteArray

    val base: String = "http://127.0.0.1:" + server.getAddress.getPort

    server.createContext("/", (ex: HttpExchange) => {
      val headers = scala.collection.mutable.Map[String, String]()
      ex.getRequestHeaders.forEach((k, v) => headers.put(k.toLowerCase, String.join(", ", v)))
      val sent = ex.getRequestBody.readAllBytes()
      arrivals.synchronized {
        arrivals.add(Arrived(ex.getRequestMethod, ex.getRequestURI.toString, headers.toMap, sent))
      }
      val reply = body
      ex.getResponseHeaders.set("Content-Type", mediaType)
      ex.sendResponseHeaders(status, if (reply.isEmpty) -1 else reply.length.toLong)
      if (reply.nonEmpty) ex.getResponseBody.write(reply)
      ex.close()
    })
    server.start()

    def stop(): Unit = server.stop(0)

    def answer(media: String, bytes: Array[Byte]): Unit = {
      mediaType = media
      body = bytes
    }

    def reset(): Unit = {
      arrivals.synchronized(arrivals.clear())
      status = 200
      mediaType = "application/json"
      body = Array.emptyByteArray
    }

    def last(): Arrived = arrivals.synchronized {
      check(0 < arrivals.size(), "nothing arrived")
      arrivals.get(arrivals.size() - 1)
    }
  }

  private def check(cond: Boolean, msg: => String): Unit =
    if (!cond) throw new AssertionError(msg)

  private def same(label: String, exp: Object, act: Object): Unit =
    check(java.util.Objects.equals(exp, act), label + ": expected " + exp + ", got " + act)

  private def om(kv: (String, Object)*): JMap[String, Object] = {
    val m = new LinkedHashMap[String, Object]()
    kv.foreach { case (k, v) => m.put(k, v) }
    m
  }

  private def merge(maps: JMap[String, Object]*): JMap[String, Object] = {
    val m = new LinkedHashMap[String, Object]()
    maps.foreach(m.putAll)
    m
  }

  private def content(name: String): Array[Byte] = ("file:" + name + "\u0000ÿ\r\n--").getBytes(Latin1)

  private def text(bytes: Array[Byte]): String = new String(bytes, Latin1)

  private def unwrapped(err: Throwable): Throwable = err match {
    case e: InvocationTargetException if e.getCause != null => unwrapped(e.getCause)
    case e => e
  }

  private def mapOf(v: Object): JMap[String, Object] = Helpers.toMapAny(v)

  private def listOf(v: Object): Seq[Object] = v match {
    case l: JList[_] => l.toArray.toSeq
    case _ => Seq.empty
  }

  // The entity accessors of the client, by entity name.
  private def accessors(client: ProjectNameSDK): Map[String, Method] =
    classOf[ProjectNameSDK].getMethods.toSeq
      .filter(m => classOf[SdkEntity].isAssignableFrom(m.getReturnType) && 1 == m.getParameterCount)
      .flatMap { m =>
        m.invoke(client, Seq[Object](null)*) match {
          case e: SdkEntity => Some(e.getName() -> m)
          case _ => None
        }
      }.toMap

  private def params(point: JMap[String, Object]): JMap[String, Object] = {
    val out = new LinkedHashMap[String, Object]()
    listOf(point.get("parts")).foreach {
      case s: String if s.startsWith("{") && s.endsWith("}") => out.put(s.substring(1, s.length - 1), "p1")
      case _ =>
    }
    out
  }

  private def actionOf(point: JMap[String, Object]): String = mapOf(point.get("select")) match {
    case null => null
    case sel => sel.get("$action") match { case s: String => s; case _ => null }
  }

  private def select(point: JMap[String, Object]): JMap[String, Object] =
    if (actionOf(point) == null) om() else om("$action" -> actionOf(point))

  private def op(ent: SdkEntity, opname: String, args: JMap[String, Object]): Object = opname match {
    case "load" => ent.load(args, null)
    case "create" => ent.create(args, null)
    case "update" => ent.update(args, null)
    case "patch" => ent.patch(args, null)
    case _ => throw new IllegalStateException("no operation " + opname)
  }

  // The entity's binary(slot), whose parameter the model decides.
  private def handle(ent: SdkEntity, slot: String): Object = {
    val binary = ent.getClass.getMethods.find(_.getName == "binary")
      .getOrElse(throw new IllegalStateException(ent.getName() + " has no binary()"))
    try binary.invoke(ent, (if (0 == binary.getParameterCount) Seq[Object]() else Seq[Object](if (slot == null) "" else slot))*)
    catch { case e: InvocationTargetException => throw unwrapped(e) }
  }

  private def call(target: Object, method: String, args: Object*): Object = {
    val m = target.getClass.getMethods.find(m => m.getName == method && m.getParameterCount == args.length)
      .getOrElse(throw new IllegalStateException("no method " + method))
    try m.invoke(target, args*)
    catch { case e: InvocationTargetException => throw unwrapped(e) }
  }

  // The data a form or multipart point is sent, and the parts it must arrive as.
  private def plan(body: JMap[String, Object]): (JMap[String, Object], Seq[Expect]) = {
    val data = new LinkedHashMap[String, Object]()
    val expect = scala.collection.mutable.ArrayBuffer[Expect]()
    val form = "form" == body.get("kind")
    listOf(body.get("fields")).map(mapOf).filter(_ != null).foreach { field =>
      val name = field.get("name").asInstanceOf[String]
      if (java.lang.Boolean.TRUE == field.get("binary")) {
        val mediaType = if (form) null else field.get("media") match {
          case s: String => s
          case _ => "application/octet-stream"
        }
        data.put(name, BinarySource.bytes(content(name), "/local/dir/" + name + ".bin", mediaType))
        expect += (if (form) Expect(name, text(content(name)))
          else Expect(name, text(content(name)), name + ".bin", mediaType, true))
      }
      else if (java.lang.Boolean.TRUE == field.get("list")) {
        data.put(name, java.util.List.of("a", "b c"))
        expect += Expect(name, "a")
        expect += Expect(name, "b c")
      }
      else field.get("join") match {
        case join: String =>
          data.put(name, java.util.List.of("a", "b"))
          expect += Expect(name, "a" + join + "b")
        case _ =>
          data.put(name, "v\"" + name + "\r\n")
          expect += Expect(name, text(("v\"" + name + "\r\n").getBytes(StandardCharsets.UTF_8)))
      }
    }
    (data, expect.toSeq)
  }

  private def multipart(arrived: Arrived): Seq[Expect] = {
    val ctype = arrived.headers.getOrElse("content-type", "")
    val boundary = "boundary=([^;]+)".r.findFirstMatchIn(ctype)
      .getOrElse(throw new AssertionError("no boundary in " + ctype)).group(1)
    val delim = "--" + boundary
    val body = text(arrived.body)
    check(body.endsWith(delim + "--\r\n"), "the body does not close")
    val chunks = body.split(java.util.regex.Pattern.quote(delim), -1)
    val Disp = "(?m)^Content-Disposition: form-data; name=\"([^\"]*)\"(?:; filename=\"([^\"]*)\")?\r?$".r
    val Ctype = "(?m)^Content-Type: (.*?)\r?$".r
    chunks.slice(1, chunks.length - 1).toSeq.map { chunk =>
      val at = chunk.indexOf("\r\n\r\n")
      val head = chunk.substring(2, at)
      val value = chunk.substring(at + 4, chunk.length - 2)
      val disp = Disp.findFirstMatchIn(head).getOrElse(throw new AssertionError("a part without a disposition: " + head))
      val ct = Ctype.findFirstMatchIn(head).map(_.group(1)).orNull
      if (disp.group(2) != null) Expect(disp.group(1), value, disp.group(2), ct, true)
      else Expect(disp.group(1), value)
    }
  }

  private def form(arrived: Arrived): Seq[Expect] = {
    val body = text(arrived.body)
    if (body.isEmpty) Seq.empty
    else body.split("&").toSeq.map { pair =>
      val eq = pair.indexOf('=')
      if (eq < 0) Expect(unescape(pair), "") else Expect(unescape(pair.substring(0, eq)), unescape(pair.substring(eq + 1)))
    }
  }

  // The bytes of a form-escaped text, as latin1.
  private def unescape(s: String): String = {
    val out = new java.io.ByteArrayOutputStream()
    var i = 0
    while (i < s.length) {
      s.charAt(i) match {
        case '+' => out.write(0x20)
        case '%' => out.write(Integer.parseInt(s.substring(i + 1, i + 3), 16)); i += 2
        case c => out.write(c.toInt)
      }
      i += 1
    }
    text(out.toByteArray)
  }

  private def client(net: Listener): ProjectNameSDK = new ProjectNameSDK(om("base" -> net.base))

  private def cases(): Seq[CodecCase] = {
    val out = scala.collection.mutable.ArrayBuffer[CodecCase]()
    val probe = new ProjectNameSDK(om("base" -> "http://127.0.0.1:1"))
    val access = accessors(probe)
    val entities = mapOf(Config.sharedConfig().get("entity"))
    if (entities == null) return Seq.empty

    for (ename <- entities.keySet().toArray(Array.empty[String]).sorted if access.contains(ename)) {
      val accessor = access(ename)
      def entity(c: ProjectNameSDK): SdkEntity = accessor.invoke(c, Seq[Object](null)*).asInstanceOf[SdkEntity]
      val ops = mapOf(mapOf(entities.get(ename)).get("op"))
      val opnames = if (ops == null) Array.empty[String] else ops.keySet().toArray(Array.empty[String]).sorted

      for (opname <- opnames; point <- listOf(mapOf(ops.get(opname)).get("points")).map(mapOf) if point != null) {
        val action = actionOf(point)
        val label = ename + "." + opname + (if (action == null) "" else ":" + action)
        val rb = mapOf(point.get("body"))
        val rs = mapOf(point.get("response"))
        val rbkind = if (rb == null) null else rb.get("kind")
        val writes = Seq("create", "update", "patch").contains(opname)

        if (("form" == rbkind || "multipart" == rbkind) && writes) {
          out += CodecCase(label + " sends a " + rbkind + " body", net => {
            val (data, expect) = plan(rb)
            net.answer("application/json", "{\"id\":\"p1\"}".getBytes(StandardCharsets.UTF_8))
            op(entity(client(net)), opname, merge(params(point), select(point), data))
            val arrived = net.last()
            val got = if ("form" == rbkind) form(arrived) else multipart(arrived)
            if ("form" == rbkind) same("content-type", rb.get("media"), arrived.headers.getOrElse("content-type", null))
            same("parts", expect, got.filter(g => expect.exists(_.name == g.name)))
          })
        }

        if ("raw" == rbkind && writes) {
          val binary = java.lang.Boolean.TRUE == rb.get("binary")
          out += CodecCase(label + " sends a raw " + (if (binary) "binary" else "text") + " body", net => {
            net.answer("application/json", "{\"id\":\"p1\"}".getBytes(StandardCharsets.UTF_8))
            val ent = entity(client(net))
            ent.data(params(point))
            ent.matchArgs(params(point))
            if (binary) {
              val got = call(handle(ent, action), "put",
                BinarySource.bytes(content(label), null, rb.get("media").asInstanceOf[String]), null)
              check(got eq ent, "put did not resolve to the entity")
              same("body", text(content(label)), text(net.last().body))
            }
            else {
              op(ent, opname, merge(select(point), om("$body" -> ("text \"" + label + "\"\n"))))
              same("body", "text \"" + label + "\"\n", new String(net.last().body, StandardCharsets.UTF_8))
            }
            same("content-type", rb.get("media"), net.last().headers.getOrElse("content-type", null))
          })
        }

        if (rs != null && "raw" == rs.get("kind") && "load" == opname) {
          val binary = java.lang.Boolean.TRUE == rs.get("binary")
          out += CodecCase(label + " reads a raw " + (if (binary) "binary" else "text") + " body", net => {
            val ent = entity(client(net))
            ent.data(params(point))
            ent.matchArgs(params(point))
            if (binary) {
              net.answer(rs.get("media").asInstanceOf[String], content(label))
              val bytes = call(handle(ent, action), "bytes", null, null)
              same("bytes", text(content(label)), text(bytes.asInstanceOf[Array[Byte]]))
              val refused =
                try { ent.load(merge(params(point), select(point)), null); null }
                catch { case e: SdkError => e }
              check(refused != null, "the plain load was not refused")
              same("code", "binary_sink_required", refused.code)
            }
            else {
              net.answer(rs.get("media").asInstanceOf[String], ("café " + label).getBytes(StandardCharsets.UTF_8))
              val got = ent.load(merge(params(point), select(point)), null)
              check(got eq ent, "load did not resolve to the entity")
              same("$body", "café " + label, mapOf(ent.data()).get("$body"))
            }
          })
        }
      }
    }
    out.toSeq
  }

  def main(args: Array[String]): Unit = {
    val all = cases()
    val failures = new ArrayList[String]()
    var ran = 0

    val net = new Listener()
    try {
      for (kase <- all) {
        ran += 1
        net.reset()
        try {
          kase.run(net)
          println("ok " + kase.name)
        }
        catch { case e: Throwable => failures.add(kase.name + ": " + unwrapped(e)) }
      }
    }
    finally net.stop()

    failures.forEach(f => println("FAILED " + f))
    println("codec: ran " + ran + " case(s), " + failures.size() + " failed")
    if (all.isEmpty) println("FAILED no form, multipart or raw point was found")
    if (all.isEmpty || 0 < failures.size()) System.exit(1)
  }
}
