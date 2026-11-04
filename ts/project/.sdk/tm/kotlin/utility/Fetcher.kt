package KOTLINPACKAGE.utility

import java.io.ByteArrayInputStream
import java.io.IOException
import java.io.InputStream
import java.io.UncheckedIOException
import java.net.InetSocketAddress
import java.net.ProxySelector
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.Charset
import java.util.concurrent.ConcurrentHashMap
import java.util.function.BiFunction
import java.util.function.Supplier
import java.util.zip.GZIPInputStream
import java.util.zip.Inflater
import java.util.zip.InflaterInputStream

import KOTLINPACKAGE.core.Context
import KOTLINPACKAGE.core.SdkError
import KOTLINPACKAGE.utility.struct.Struct

// Clients keyed by redirect policy and proxy. Each HttpClient owns a
// connection pool and a selector thread, so one per request reused
// nothing; one per key pools across calls.
private val clients = ConcurrentHashMap<String, HttpClient>()

private fun clientFor(fetchdef: MutableMap<String, Any?>): HttpClient {
  // "manual" (set by the station feature's middleware under a hosts
  // policy) returns a 3xx like any other response: an automatic follow
  // would carry injected credentials to a host no policy approved.
  val redirectPolicy =
    if ("manual" == fetchdef["redirect"]) HttpClient.Redirect.NEVER
    else HttpClient.Redirect.NORMAL

  val praw = fetchdef["proxy"]
  val proxy = if (praw is String) praw else ""

  return clients.computeIfAbsent("$redirectPolicy|$proxy") {
    val clientb = HttpClient.newBuilder().followRedirects(redirectPolicy)
    if ("" != proxy) {
      try {
        val proxyUri = URI.create(proxy)
        val port = if (proxyUri.port < 0) 80 else proxyUri.port
        clientb.proxy(ProxySelector.of(InetSocketAddress(proxyUri.host, port)))
      } catch (e: RuntimeException) {
        // Unparseable proxy target: direct connection, as the go transport.
      }
    }
    clientb.build()
  }
}

internal const val GETONLY_ENV = "VOXGIG_GETONLY_GUARD"

// A GET-only live run refuses any other method before it is sent. The error
// names the path alone: the query can carry a credential.
internal fun getOnlyRefusal(fullurl: String, method: String): SdkError? {
  val upper = method.uppercase()
  if ("TRUE" != System.getenv(GETONLY_ENV) || "GET" == upper) {
    return null
  }
  var rest = fullurl
  val scheme = rest.indexOf("://")
  if (scheme >= 0) {
    rest = rest.substring(scheme + 3).replaceFirst(Regex("^[^/?#]*"), "")
  }
  val path = rest.split(Regex("[?#]"), 2)[0].ifEmpty { "/" }
  return SdkError("fetch_getonly_block", "[GET-ONLY GUARD] blocked $upper $path", null)
}

@Suppress("UNCHECKED_CAST")
fun defaultHttpFetch(fullurl: String, fetchdef: MutableMap<String, Any?>): MutableMap<String, Any?> {
  var method = if (fetchdef["method"] is String) fetchdef["method"] as String else ""
  if ("" == method) {
    method = "GET"
  }
  getOnlyRefusal(fullurl, method)?.let { throw it }

  var bodyPublisher: HttpRequest.BodyPublisher = HttpRequest.BodyPublishers.noBody()
  val body = fetchdef["body"]
  if (body is String && "" != body) {
    bodyPublisher = HttpRequest.BodyPublishers.ofString(body)
  } else if (body is ByteArray) {
    bodyPublisher = HttpRequest.BodyPublishers.ofByteArray(body)
  } else if (body is InputStream) {
    bodyPublisher = HttpRequest.BodyPublishers.ofInputStream { body }
  }

  val reqb: HttpRequest.Builder
  try {
    reqb = HttpRequest.newBuilder(URI.create(fullurl)).method(method, bodyPublisher)
  } catch (e: RuntimeException) {
    throw RuntimeException("fetch: invalid url: $fullurl", e)
  }

  var hasUA = false
  val headersRaw = fetchdef["headers"]
  if (headersRaw is MutableMap<*, *>) {
    for (h in (headersRaw as MutableMap<String, Any?>).entries) {
      val hv = h.value
      if (hv is String) {
        if ("user-agent".equals(h.key, ignoreCase = true)) {
          hasUA = true
        }
        reqb.setHeader(h.key, hv)
      }
    }
  }
  // Default User-Agent — some CDNs block Java's default. It is recorded with
  // the headers the request sent.
  if (!hasUA) {
    val agent = "PROJECTUSERAGENT"
    reqb.setHeader("User-Agent", agent)
    if (headersRaw is MutableMap<*, *>) {
      (headersRaw as MutableMap<String, Any?>)["user-agent"] = agent
    }
  }

  val resp: HttpResponse<String>
  try {
    resp = clientFor(fetchdef).send(reqb.build(), decodedText())
  } catch (e: Exception) {
    throw RuntimeException("fetch: " + e.message, e)
  }

  val headers = linkedMapOf<String, Any?>()
  for ((k, vals) in resp.headers().map()) {
    if (vals.size == 1) {
      headers[k.lowercase()] = vals[0]
    } else {
      headers[k.lowercase()] = vals.joinToString(", ")
    }
  }

  val bodyText = resp.body() ?: ""
  var jsonBody: Any? = null
  var unreadable = false
  if (bodyText.isNotBlank()) {
    try {
      jsonBody = Json.parse(bodyText)
    } catch (e: RuntimeException) {
      unreadable = true
    }
  }
  val parsed = jsonBody

  val out = linkedMapOf<String, Any?>()
  out["status"] = resp.statusCode()
  out["statusText"] = statusText(resp.statusCode())
  out["headers"] = headers
  out["json"] = Supplier<Any?> { parsed }
  out["body"] = bodyText
  out["unreadable"] = unreadable
  return out
}

// The body as text, as BodyHandlers.ofString reads it, once a gzip or deflate
// Content-Encoding is undone: HttpClient decodes none, and a server may
// compress its answer whatever the request asked for.
internal fun decodedText(): HttpResponse.BodyHandler<String> =
  HttpResponse.BodyHandler { info ->
    val encoding = info.headers().firstValue("content-encoding").orElse("").trim().lowercase()
    val charset = charsetOf(info.headers().firstValue("content-type").orElse(""))
    HttpResponse.BodySubscribers.mapping(HttpResponse.BodySubscribers.ofByteArray()) { bytes ->
      try {
        String(decodeBody(bytes, encoding), charset)
      } catch (e: IOException) {
        throw UncheckedIOException("response body is not valid $encoding data: ${e.message}", e)
      }
    }
  }

// Deflate is zlib-wrapped, or raw as some servers send it.
internal fun decodeBody(bytes: ByteArray?, encoding: String): ByteArray {
  if (bytes == null || bytes.isEmpty()) return bytes ?: ByteArray(0)
  if ("gzip" == encoding || "x-gzip" == encoding) {
    return GZIPInputStream(ByteArrayInputStream(bytes)).use { it.readAllBytes() }
  }
  if ("deflate" == encoding) {
    val zlib = bytes.size > 1 && (bytes[0].toInt() and 0x0f) == 8 &&
      (((bytes[0].toInt() and 0xff) shl 8) or (bytes[1].toInt() and 0xff)) % 31 == 0
    return InflaterInputStream(ByteArrayInputStream(bytes), Inflater(!zlib)).use { it.readAllBytes() }
  }
  return bytes
}

internal fun charsetOf(contentType: String): Charset {
  for (part in contentType.split(";")) {
    val kv = part.trim().split("=", limit = 2)
    if (kv.size == 2 && "charset".equals(kv[0].trim(), ignoreCase = true)) {
      return try {
        Charset.forName(kv[1].trim().replace("\"", ""))
      } catch (e: RuntimeException) {
        Charsets.UTF_8
      }
    }
  }
  return Charsets.UTF_8
}

// HTTP/2 responses carry no reason phrase; use the standard text for
// common codes so statusText stays informative.
fun statusText(status: Int): String {
  return when (status) {
    200 -> "OK"
    201 -> "Created"
    202 -> "Accepted"
    204 -> "No Content"
    301 -> "Moved Permanently"
    302 -> "Found"
    304 -> "Not Modified"
    400 -> "Bad Request"
    401 -> "Unauthorized"
    403 -> "Forbidden"
    404 -> "Not Found"
    405 -> "Method Not Allowed"
    408 -> "Request Timeout"
    409 -> "Conflict"
    422 -> "Unprocessable Entity"
    425 -> "Too Early"
    429 -> "Too Many Requests"
    500 -> "Internal Server Error"
    502 -> "Bad Gateway"
    503 -> "Service Unavailable"
    504 -> "Gateway Timeout"
    else -> ""
  }
}

@Suppress("UNCHECKED_CAST")
fun fetcher(ctx: Context, fullurl: String, fetchdef: MutableMap<String, Any?>): Any? {
  if ("live" != ctx.client!!.mode) {
    throw ctx.makeError(
      "fetch_mode_block",
      "Request blocked by mode: \"" + ctx.client!!.mode +
        "\" (URL was: \"" + fullurl + "\")",
    )
  }

  val options = ctx.client!!.optionsMap()
  if (Struct.getpath(options, listOf("feature", "test", "active")) == true) {
    throw ctx.makeError(
      "fetch_test_block",
      "Request blocked as test feature is active (URL was: \"" + fullurl + "\")",
    )
  }

  var sysFetch = Struct.getpath(options, listOf("system", "fetch"))
  if (sysFetch === Struct.UNDEF) {
    sysFetch = null
  }

  if (sysFetch == null) {
    return defaultHttpFetch(fullurl, fetchdef)
  }

  if (sysFetch is BiFunction<*, *, *>) {
    return (sysFetch as BiFunction<String, MutableMap<String, Any?>, Any?>).apply(fullurl, fetchdef)
  }

  throw ctx.makeError("fetch_invalid", "system.fetch is not a valid function")
}
