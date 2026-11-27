package SCALAPACKAGE.utility

import java.io.{ByteArrayInputStream, IOException, UncheckedIOException}
import java.net.{InetSocketAddress, ProxySelector, URI}
import java.net.http.{HttpClient, HttpRequest, HttpResponse}
import java.nio.charset.{Charset, StandardCharsets}
import java.util.zip.{GZIPInputStream, Inflater, InflaterInputStream}
import java.util.{LinkedHashMap, List => JList, Map => JMap}
import java.util.concurrent.ConcurrentHashMap
import java.util.function.{BiFunction, Function => JFunction, Supplier}
import SCALAPACKAGE.core._
import SCALAPACKAGE.utility.struct.Struct

object Fetcher {

  // Clients keyed by proxy. Each HttpClient owns a connection pool and a
  // selector thread, so one per request reused nothing; one per key pools
  // across calls. None follows a redirect: followRedirects does.
  private val clients = new ConcurrentHashMap[String, HttpClient]()

  private def clientFor(fetchdef: JMap[String, Object]): HttpClient = {
    val proxy = fetchdef.get("proxy") match { case p: String => p; case _ => "" }

    clients.computeIfAbsent(proxy,
      new JFunction[String, HttpClient] {
        def apply(key: String): HttpClient = {
          val clientb = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER)
          if (proxy != "") {
            try {
              val proxyUri = URI.create(proxy)
              val port = if (proxyUri.getPort < 0) 80 else proxyUri.getPort
              clientb.proxy(ProxySelector.of(new InetSocketAddress(proxyUri.getHost, port)))
            } catch { case _: RuntimeException => }
          }
          clientb.build()
        }
      })
  }

  val GETONLY_ENV = "VOXGIG_GETONLY_GUARD"

  // A GET-only live run refuses any other method before it is sent. The error
  // names the path alone: the query can carry a credential.
  def getOnlyRefusal(fullurl: String, method: String): SdkError = {
    val upper = method.toUpperCase(java.util.Locale.ROOT)
    if ("TRUE" != System.getenv(GETONLY_ENV) || "GET" == upper) return null
    val scheme = fullurl.indexOf("://")
    val rest = if (scheme < 0) fullurl else fullurl.substring(scheme + 3).replaceFirst("^[^/?#]*", "")
    val path = rest.split("[?#]", 2)(0)
    new SdkError("fetch_getonly_block",
      "[GET-ONLY GUARD] blocked " + upper + " " + (if (path.isEmpty) "/" else path), null)
  }

  private val REDIRECT_STATUS = Set(301, 302, 303, 307, 308)
  private val REDIRECT_MAX = 5
  private val CREDENTIAL_HEADERS = Set("authorization", "cookie", "proxy-authorization")

  // Scheme, host and port, the scheme's own port made explicit.
  private def originOf(uri: URI): String = {
    val scheme = String.valueOf(uri.getScheme).toLowerCase(java.util.Locale.ROOT)
    val port = if (uri.getPort < 0) (if ("https" == scheme) 443 else 80) else uri.getPort
    val host = if (uri.getHost == null) String.valueOf(uri.getRawAuthority) else uri.getHost
    scheme + "://" + host.toLowerCase(java.util.Locale.ROOT) + ":" + port
  }

  // What another origin is not sent: the names every client drops, and
  // whatever the SDK holds as a secret, by its name or by its value. Where
  // no registry is at hand to ask, the clean module answers.
  private def isCredential(ctx: Context, name: String, value: Object): Boolean = {
    if (CREDENTIAL_HEADERS.contains(name.toLowerCase(java.util.Locale.ROOT))) return true
    if (ctx != null && ctx.utility != null && ctx.utility.cleanSecret != null)
      ctx.utility.cleanSecret(ctx, name, value)
    else Clean.cleanSecret(ctx, name, value)
  }

  // Left to follow, the JDK client sends another origin every header it does
  // not know for a credential, and a 307's body with them. Followed here
  // instead: each hop passes the GET-only guard; past REDIRECT_MAX hops, or
  // where a body would go to another origin, the 3xx is the answer.
  @scala.annotation.tailrec
  private[utility] def followRedirects(ctx: Context, fullurl: String, fetchdef: JMap[String, Object],
      hops: Int = 0): JMap[String, Object] = {
    val res = fetchOnce(fullurl, fetchdef)
    val location = res.get("headers") match {
      case h: JMap[_, _] => h.asInstanceOf[JMap[String, Object]].get("location")
      case _ => null
    }
    val status = res.get("status") match { case n: java.lang.Integer => n.intValue; case _ => 0 }

    // "manual" (set by the station feature's middleware under a hosts
    // policy) is answered by the 3xx, like any other response.
    if ("manual" == fetchdef.get("redirect") || !location.isInstanceOf[String] ||
        !REDIRECT_STATUS.contains(status) || REDIRECT_MAX <= hops) return res

    var from: URI = null
    var next: URI = null
    try {
      from = URI.create(fullurl)
      next = resolveLocation(from, location.asInstanceOf[String])
    }
    catch { case _: RuntimeException => return res }

    // As the JDK client follows: to the same scheme, or up to https.
    val scheme = next.getScheme
    if (scheme == null ||
        !(scheme.equalsIgnoreCase(from.getScheme) || "https".equalsIgnoreCase(scheme))) return res

    // As the JDK client rewrites it: a 303, and a 301 or 302 answering a
    // POST, become a GET without the body.
    val method = fetchdef.get("method") match {
      case s: String if s != "" => s.toUpperCase(java.util.Locale.ROOT)
      case _ => "GET"
    }
    val toget = 303 == status || ("POST" == method && 307 != status && 308 != status)
    val cross = originOf(next) != originOf(from)
    val body = if (toget) null else fetchdef.get("body")

    // A stream is read once, so it cannot be sent again either.
    if (body != null && (cross || body.isInstanceOf[java.io.InputStream])) return res

    val headers = new LinkedHashMap[String, Object]()
    fetchdef.get("headers") match {
      case hm: JMap[_, _] =>
        val it = hm.asInstanceOf[JMap[String, Object]].entrySet().iterator()
        while (it.hasNext) {
          val h = it.next()
          val dropped =
            (toget && h.getKey.toLowerCase(java.util.Locale.ROOT).startsWith("content-")) ||
              (cross && isCredential(ctx, h.getKey, h.getValue))
          if (!dropped) headers.put(h.getKey, h.getValue)
        }
      case _ =>
    }

    val nextdef = new LinkedHashMap[String, Object](fetchdef)
    nextdef.put("method", if (toget) "GET" else method)
    nextdef.put("headers", headers)
    if (body == null) nextdef.remove("body")

    followRedirects(ctx, next.toString, nextdef, hops + 1)
  }

  // A reference of a query alone keeps the path, as RFC 3986 resolves it;
  // URI.resolve follows RFC 2396 there and drops the last segment.
  def resolveLocation(from: URI, location: String): URI = {
    val loc = location.trim
    if (loc.startsWith("?")) {
      val base = from.toString
      val cut = base.indexWhere(c => c == '?' || c == '#')
      URI.create((if (cut < 0) base else base.substring(0, cut)) + loc)
    }
    else from.resolve(URI.create(loc))
  }

  // For a caller with no operation context, as the secrets exchange is: a
  // redirect follows the same rules, a credential told by the clean defaults.
  def defaultHttpFetch(fullurl: String, fetchdef: JMap[String, Object]): JMap[String, Object] =
    followRedirects(null, fullurl, fetchdef)

  private def fetchOnce(fullurl: String, fetchdef: JMap[String, Object]): JMap[String, Object] = {
    var method = fetchdef.get("method") match { case s: String => s; case _ => "" }
    if ("" == method) method = "GET"
    val refused = getOnlyRefusal(fullurl, method)
    if (refused != null) throw refused

    var bodyPublisher = HttpRequest.BodyPublishers.noBody()
    fetchdef.get("body") match {
      case b: String if b != "" => bodyPublisher = HttpRequest.BodyPublishers.ofString(b)
      case b: Array[Byte] => bodyPublisher = HttpRequest.BodyPublishers.ofByteArray(b)
      case b: java.io.InputStream => bodyPublisher = HttpRequest.BodyPublishers.ofInputStream(() => b)
      case _ =>
    }

    val reqb =
      try HttpRequest.newBuilder(URI.create(fullurl)).method(method, bodyPublisher)
      catch { case e: RuntimeException => throw new RuntimeException("fetch: invalid url: " + fullurl, e) }
    // A bound in milliseconds, for a caller beneath the timeout feature.
    fetchdef.get("timeout") match {
      case n: java.lang.Number if 0 < n.longValue() => reqb.timeout(java.time.Duration.ofMillis(n.longValue()))
      case _ =>
    }

    var hasUA = false
    fetchdef.get("headers") match {
      case hm: JMap[_, _] =>
        val it = hm.asInstanceOf[JMap[String, Object]].entrySet().iterator()
        while (it.hasNext) {
          val e = it.next()
          e.getValue match {
            case v: String =>
              if ("user-agent".equalsIgnoreCase(e.getKey)) hasUA = true
              reqb.setHeader(e.getKey, v)
            case _ =>
          }
        }
      case _ =>
    }
    // The default User-Agent is recorded with the headers the request sent.
    if (!hasUA) {
      val agent = "PROJECTUSERAGENT"
      reqb.setHeader("User-Agent", agent)
      fetchdef.get("headers") match {
        case hm: JMap[_, _] => hm.asInstanceOf[JMap[String, Object]].put("user-agent", agent)
        case _ =>
      }
    }

    val resp =
      try clientFor(fetchdef).send(reqb.build(), decodedText())
      catch { case e: Exception => throw new RuntimeException("fetch: " + e.getMessage, e) }

    val headers = new LinkedHashMap[String, Object]()
    val hit = resp.headers().map().entrySet().iterator()
    while (hit.hasNext) {
      val h = hit.next()
      val vals = h.getValue
      if (vals.size() == 1) headers.put(h.getKey.toLowerCase, vals.get(0))
      else headers.put(h.getKey.toLowerCase, String.join(", ", vals))
    }

    val bodyText = if (resp.body() == null) "" else resp.body()
    var unreadable = false
    val jsonBody: Object =
      if (bodyText.isBlank) null
      else try Json.parse(bodyText)
      catch { case _: RuntimeException => unreadable = true; null }
    val jsonSupplier: Supplier[Object] = () => jsonBody

    val out = new LinkedHashMap[String, Object]()
    out.put("status", java.lang.Integer.valueOf(resp.statusCode()))
    out.put("statusText", statusText(resp.statusCode()))
    out.put("headers", headers)
    out.put("json", jsonSupplier)
    out.put("body", bodyText)
    out.put("unreadable", java.lang.Boolean.valueOf(unreadable))
    out
  }

  // The body as text, as BodyHandlers.ofString reads it, once a gzip or
  // deflate Content-Encoding is undone: HttpClient decodes none, and a server
  // may compress its answer whatever the request asked for.
  def decodedText(): HttpResponse.BodyHandler[String] = (info: HttpResponse.ResponseInfo) => {
    val encoding = info.headers().firstValue("content-encoding").orElse("").trim.toLowerCase
    val charset = charsetOf(info.headers().firstValue("content-type").orElse(""))
    HttpResponse.BodySubscribers.mapping[Array[Byte], String](
      HttpResponse.BodySubscribers.ofByteArray(),
      (bytes: Array[Byte]) =>
        try new String(decodeBody(bytes, encoding), charset)
        catch {
          case e: IOException =>
            throw new UncheckedIOException(
              "response body is not valid " + encoding + " data: " + e.getMessage, e)
        })
  }

  // Deflate is zlib-wrapped, or raw as some servers send it.
  def decodeBody(bytes: Array[Byte], encoding: String): Array[Byte] = {
    if (bytes == null || bytes.isEmpty) return if (bytes == null) Array.emptyByteArray else bytes
    if ("gzip" == encoding || "x-gzip" == encoding) {
      val in = new GZIPInputStream(new ByteArrayInputStream(bytes))
      try return in.readAllBytes() finally in.close()
    }
    if ("deflate" == encoding) {
      val zlib = bytes.length > 1 && (bytes(0) & 0x0f) == 8 &&
        (((bytes(0) & 0xff) << 8) | (bytes(1) & 0xff)) % 31 == 0
      val in = new InflaterInputStream(new ByteArrayInputStream(bytes), new Inflater(!zlib))
      try return in.readAllBytes() finally in.close()
    }
    bytes
  }

  def charsetOf(contentType: String): Charset = {
    for (part <- contentType.split(";")) {
      val kv = part.trim.split("=", 2)
      if (kv.length == 2 && "charset".equalsIgnoreCase(kv(0).trim)) {
        return try Charset.forName(kv(1).trim.replace("\"", ""))
        catch { case _: RuntimeException => StandardCharsets.UTF_8 }
      }
    }
    StandardCharsets.UTF_8
  }

  def statusText(status: Int): String = status match {
    case 200 => "OK"
    case 201 => "Created"
    case 202 => "Accepted"
    case 204 => "No Content"
    case 301 => "Moved Permanently"
    case 302 => "Found"
    case 304 => "Not Modified"
    case 400 => "Bad Request"
    case 401 => "Unauthorized"
    case 403 => "Forbidden"
    case 404 => "Not Found"
    case 405 => "Method Not Allowed"
    case 408 => "Request Timeout"
    case 409 => "Conflict"
    case 422 => "Unprocessable Entity"
    case 425 => "Too Early"
    case 429 => "Too Many Requests"
    case 500 => "Internal Server Error"
    case 502 => "Bad Gateway"
    case 503 => "Service Unavailable"
    case 504 => "Gateway Timeout"
    case _ => ""
  }

  def fetcher(ctx: Context, fullurl: String, fetchdef: JMap[String, Object]): Object = {
    if ("live" != ctx.client.mode) {
      throw ctx.makeError("fetch_mode_block",
        "Request blocked by mode: \"" + ctx.client.mode + "\" (URL was: \"" + fullurl + "\")")
    }

    val options = ctx.client.optionsMap()
    if (java.lang.Boolean.TRUE == Struct.getpath(options, java.util.List.of("feature", "test", "active"))) {
      throw ctx.makeError("fetch_test_block",
        "Request blocked as test feature is active (URL was: \"" + fullurl + "\")")
    }

    var sysFetch = Struct.getpath(options, java.util.List.of("system", "fetch"))
    if (sysFetch eq Struct.UNDEF) sysFetch = null

    if (sysFetch == null) return followRedirects(ctx, fullurl, fetchdef)

    sysFetch match {
      case bf: BiFunction[_, _, _] =>
        bf.asInstanceOf[BiFunction[String, JMap[String, Object], Object]].apply(fullurl, fetchdef)
      case _ =>
        throw ctx.makeError("fetch_invalid", "system.fetch is not a valid function")
    }
  }
}
