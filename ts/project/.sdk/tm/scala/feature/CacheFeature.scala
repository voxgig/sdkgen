package SCALAPACKAGE.feature

import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.util.{ArrayList, LinkedHashMap, List => JList, Map => JMap}
import java.util.function.Supplier
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import SCALAPACKAGE.core.{Context, FetcherFn, SdkClient}
import SCALAPACKAGE.utility.Media

// Response caching for safe (read) requests, per client: see the features
// reference for the key, the write invalidation and the Cache-Control rules.
class CacheFeature extends BaseFeature("cache", "0.0.1", true) {

  private var client: SdkClient = null
  private var options: JMap[String, Object] = null
  private var store: JMap[String, CacheEntry] = null
  private var order: JList[String] = null
  private var secret: SecretKeySpec = null

  // Activity tracking (mirrors the ts client._cache record).
  var hit: Int = 0
  var miss: Int = 0
  var bypass: Int = 0

  private class CacheEntry {
    var expiry: Long = 0
    var scope: String = ""
    var snapshot: CacheSnapshot = null
  }

  private class CacheSnapshot {
    var status: Int = 0
    var statusText: String = ""
    var data: Object = null
    var headers: JMap[String, Object] = new LinkedHashMap[String, Object]()
  }

  override def init(ctx: Context, options: JMap[String, Object]): Unit = {
    this.client = ctx.client
    this.options = options
    this.active = FeatureOptions.foptBool(options, "active", false)

    if (!this.active) {
      return
    }

    this.store = new LinkedHashMap[String, CacheEntry]()
    this.order = new ArrayList[String]()
    val bytes = new Array[Byte](32)
    new SecureRandom().nextBytes(bytes)
    this.secret = new SecretKeySpec(bytes, "HmacSHA256")

    val inner: FetcherFn = ctx.utility.fetcher

    ctx.utility.fetcher = (ctx2, url, fetchdef) => through(ctx2, url, fetchdef, inner)
  }

  private def through(ctx: Context, url: String, fetchdef: JMap[String, Object],
      inner: FetcherFn): Object = {

    var method = "GET"
    val m = fetchdef.get("method")
    m match {
      case s: String if s != "" => method = s.toUpperCase()
      case _ =>
    }

    var methods = FeatureOptions.foptStrList(this.options, "methods")
    if (methods == null) {
      methods = java.util.List.of("GET")
    }
    var cacheable = false
    val mit = methods.iterator()
    while (!cacheable && mit.hasNext) {
      val cm = mit.next()
      if (cm.toUpperCase().equals(method)) {
        cacheable = true
      }
    }
    if (!cacheable) {
      if (CacheFeature.SafeMethods.contains(method)) {
        return inner(ctx, url, fetchdef)
      }
      try {
        return inner(ctx, url, fetchdef)
      } finally {
        invalidate(url)
      }
    }

    val key = method + " " + url + " " + digest(fetchdef.get("headers"))
    val now = FeatureOptions.foptNow(this.options).getAsLong()

    val hitEntry = this.store.get(key)
    if (hitEntry != null && hitEntry.expiry > now) {
      this.hit += 1
      return replay(hitEntry.snapshot)
    }

    var res: Object = null
    try {
      res = inner(ctx, url, fetchdef)
    } catch {
      case err: RuntimeException =>
        this.bypass += 1
        throw err
    }

    // A body that declares another type than JSON passes by, unread.
    if (storable(res) && !json(res)) {
      this.bypass += 1
      return res
    }

    if (storable(res)) {
      val snapshot = this.snapshot(res)
      val ttl = CacheFeature.lifetime(snapshot.headers, FeatureOptions.foptInt(this.options, "ttl", 5000).toLong)
      if (ttl <= 0) {
        this.bypass += 1
        return replay(snapshot)
      }
      drop(key)
      evict()
      val entry = new CacheEntry()
      entry.expiry = now + ttl
      entry.scope = CacheFeature.scope(url)
      entry.snapshot = snapshot
      this.store.put(key, entry)
      this.order.add(key)
      this.miss += 1
      return replay(snapshot)
    }

    this.bypass += 1
    res
  }

  private def digest(headers: Object): String = {
    val pairs = new ArrayList[(String, String)]()
    headers match {
      case hm: JMap[_, _] =>
        val it = hm.entrySet().iterator()
        while (it.hasNext) {
          val h = it.next()
          if (h.getValue != null) {
            pairs.add((String.valueOf(h.getKey).toLowerCase(), String.valueOf(h.getValue)))
          }
        }
      case _ =>
    }
    val sorted = pairs.toArray(new Array[(String, String)](0)).sortBy(identity)
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(this.secret)
    for ((name, value) <- sorted) {
      mac.update((name + ":" + value + "\n").getBytes(StandardCharsets.UTF_8))
    }
    mac.doFinal().map(b => f"$b%02x").mkString
  }

  private def invalidate(url: String): Unit = {
    val path = CacheFeature.scope(url)
    val collection = CacheFeature.parent(path)
    val dropped = new ArrayList[String]()
    val it = this.store.entrySet().iterator()
    while (it.hasNext) {
      val e = it.next()
      if (CacheFeature.under(e.getValue.scope, path) || CacheFeature.under(e.getValue.scope, collection)) {
        dropped.add(e.getKey)
      }
    }
    dropped.forEach(k => drop(k))
  }

  private def drop(key: String): Unit = {
    if (this.store.remove(key) != null) {
      this.order.remove(key)
    }
  }

  // A body the transport could not read as JSON passes through, for the operation to report.
  private def storable(res: Object): Boolean = {
    val status = FeatureOptions.fresStatus(res)
    status >= 200 && status < 300 &&
      java.lang.Boolean.TRUE != res.asInstanceOf[JMap[String, Object]].get("unreadable")
  }

  private def json(res: Object): Boolean = {
    val ctype = FeatureOptions.fresHeader(res, "content-type")
    "" == ctype || Media.isJsonMedia(ctype)
  }

  private def snapshot(res: Object): CacheSnapshot = {
    val rm: JMap[String, Object] = res match {
      case m: JMap[_, _] => m.asInstanceOf[JMap[String, Object]]
      case _ => null
    }

    val snap = new CacheSnapshot()

    val status = FeatureOptions.fresStatus(res)
    if (status >= 0) {
      snap.status = status
    }
    if (rm != null) {
      rm.get("statusText") match {
        case st: String => snap.statusText = st
        case _ =>
      }
      rm.get("json") match {
        case jf: Supplier[_] => snap.data = jf.asInstanceOf[Supplier[Object]].get()
        case _ =>
      }
      rm.get("headers") match {
        case hm0: JMap[_, _] =>
          val hm = hm0.asInstanceOf[JMap[String, Object]]
          val it = hm.entrySet().iterator()
          while (it.hasNext) {
            val h = it.next()
            snap.headers.put(h.getKey.toLowerCase(), h.getValue)
          }
        case _ =>
      }
    }

    snap
  }

  // replay builds a fresh transport-shaped response so the body stays
  // re-readable for every consumer.
  private def replay(snap: CacheSnapshot): JMap[String, Object] = {
    val data = snap.data
    val headers = new LinkedHashMap[String, Object](snap.headers)
    val out = new LinkedHashMap[String, Object]()
    out.put("status", java.lang.Integer.valueOf(snap.status))
    out.put("statusText", snap.statusText)
    out.put("body", "not-used")
    val js: Supplier[Object] = () => data
    out.put("json", js)
    out.put("headers", headers)
    out
  }

  // evict drops oldest entries (FIFO) until the store is under `max`.
  private def evict(): Unit = {
    val max = FeatureOptions.foptInt(this.options, "max", 256)
    while (this.store.size() >= max && !this.order.isEmpty) {
      val oldest = this.order.remove(0)
      this.store.remove(oldest)
    }
  }
}


object CacheFeature {
  private val SafeMethods = Set("GET", "HEAD")
  private val Unstored = Set("no-store", "private", "no-cache")
  private val MaxAge = "^max-age\\s*=\\s*\"?(\\d+)\"?$".r

  // The configured ttl capped by the response's Cache-Control; zero when the
  // response may not be stored.
  private def lifetime(headers: JMap[String, Object], ttl: Long): Long = {
    var control = ""
    val it = headers.entrySet().iterator()
    while (it.hasNext) {
      val h = it.next()
      if (h.getKey.toLowerCase() == "cache-control") {
        control = String.valueOf(h.getValue).toLowerCase()
      }
    }
    val directives = control.split(",").map(_.trim)
    if (directives.exists(Unstored.contains)) {
      0L
    } else {
      directives.foldLeft(ttl) { (life, directive) =>
        directive match {
          case MaxAge(secs) => secs.toLongOption.fold(life)(n => math.min(life, n * 1000))
          case _ => life
        }
      }
    }
  }

  private def scope(url: String): String = {
    var out = url.split("[?#]", 2)(0)
    while (out.endsWith("/")) {
      out = out.substring(0, out.length - 1)
    }
    out
  }

  private def parent(scope: String): String = {
    val scheme = scope.indexOf("://")
    val root = if (scheme < 0) 0 else scope.indexOf('/', scheme + 3)
    if (root < 0) scope else scope.substring(0, math.max(scope.lastIndexOf('/'), root))
  }

  private def under(scope: String, prefix: String): Boolean =
    scope == prefix || scope.startsWith(prefix + "/")
}
