package KOTLINPACKAGE.feature

import java.security.SecureRandom
import java.util.function.Supplier
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

import KOTLINPACKAGE.core.Context
import KOTLINPACKAGE.core.FetcherFn
import KOTLINPACKAGE.core.SdkClient
import KOTLINPACKAGE.utility.Media

// Response caching for safe (read) requests, per client: see the features
// reference for the key, the write invalidation and the Cache-Control rules.
@Suppress("UNCHECKED_CAST")
class CacheFeature : BaseFeature("cache", "0.0.1", true) {

  private var client: SdkClient? = null
  private var options: MutableMap<String, Any?>? = null
  private var store: MutableMap<String, CacheEntry> = linkedMapOf()
  private var order: MutableList<String> = mutableListOf()
  private var secret: SecretKeySpec? = null

  // Activity tracking (mirrors the ts client._cache record).
  var hit = 0
  var miss = 0
  var bypass = 0

  private class CacheEntry {
    var expiry: Long = 0
    var scope: String = ""
    lateinit var snapshot: CacheSnapshot
  }

  private class CacheSnapshot {
    var status: Int = 0
    var statusText: String = ""
    var data: Any? = null
    var headers: MutableMap<String, Any?> = linkedMapOf()
  }

  override fun init(ctx: Context, options: MutableMap<String, Any?>) {
    this.client = ctx.client
    this.options = options
    this.active = FeatureOptions.foptBool(options, "active", false)

    if (!this.active) {
      return
    }

    this.store = linkedMapOf()
    this.order = mutableListOf()
    val key = ByteArray(32)
    SecureRandom().nextBytes(key)
    this.secret = SecretKeySpec(key, "HmacSHA256")

    val inner: FetcherFn = ctx.utility!!.fetcher

    ctx.utility!!.fetcher = { ctx2, url, fetchdef -> through(ctx2, url, fetchdef, inner) }
  }

  private fun through(ctx: Context, url: String, fetchdef: MutableMap<String, Any?>, inner: FetcherFn): Any? {
    var method = "GET"
    val m = fetchdef["method"]
    if (m is String && "" != m) {
      method = m.uppercase()
    }

    var methods: List<String>? = FeatureOptions.foptStrList(this.options, "methods")
    if (methods == null) {
      methods = listOf("GET")
    }
    var cacheable = false
    for (cm in methods) {
      if (cm.uppercase() == method) {
        cacheable = true
        break
      }
    }
    if (!cacheable) {
      if (method in SAFE_METHODS) {
        return inner(ctx, url, fetchdef)
      }
      try {
        return inner(ctx, url, fetchdef)
      } finally {
        invalidate(url)
      }
    }

    val key = "$method $url " + digest(fetchdef["headers"])
    val now = FeatureOptions.foptNow(this.options).getAsLong()

    val hitEntry = this.store[key]
    if (hitEntry != null && hitEntry.expiry > now) {
      this.hit++
      return replay(hitEntry.snapshot)
    }

    val res: Any?
    try {
      res = inner(ctx, url, fetchdef)
    } catch (err: RuntimeException) {
      this.bypass++
      throw err
    }

    // A body that declares another type than JSON passes by, unread.
    if (storable(res) && !json(res)) {
      this.bypass++
      return res
    }

    if (storable(res)) {
      val snapshot = snapshot(res)
      val ttl = lifetime(snapshot.headers, FeatureOptions.foptInt(this.options, "ttl", 5000).toLong())
      if (ttl <= 0) {
        this.bypass++
        return replay(snapshot)
      }
      drop(key)
      evict()
      val entry = CacheEntry()
      entry.expiry = now + ttl
      entry.scope = scope(url)
      entry.snapshot = snapshot
      this.store[key] = entry
      this.order.add(key)
      this.miss++
      return replay(snapshot)
    }

    this.bypass++
    return res
  }

  private fun digest(headers: Any?): String {
    val pairs = mutableListOf<Pair<String, String>>()
    if (headers is Map<*, *>) {
      for ((name, value) in headers) {
        if (value != null) {
          pairs.add(Pair(name.toString().lowercase(), value.toString()))
        }
      }
    }
    pairs.sortWith(compareBy<Pair<String, String>> { it.first }.thenBy { it.second })
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(this.secret)
    for ((name, value) in pairs) {
      mac.update("$name:$value\n".toByteArray(Charsets.UTF_8))
    }
    return mac.doFinal().joinToString("") { "%02x".format(it) }
  }

  private fun invalidate(url: String) {
    val path = scope(url)
    val collection = parent(path)
    val dropped = this.store.filterValues { under(it.scope, path) || under(it.scope, collection) }.keys.toList()
    for (key in dropped) {
      drop(key)
    }
  }

  private fun drop(key: String) {
    if (this.store.remove(key) != null) {
      this.order.remove(key)
    }
  }

  // A body the transport could not read as JSON passes through, for the operation to report.
  private fun storable(res: Any?): Boolean {
    val status = FeatureOptions.fresStatus(res)
    return status in 200..299 && (res as Map<*, *>)["unreadable"] != true
  }

  private fun json(res: Any?): Boolean {
    val type = FeatureOptions.fresHeader(res, "content-type")
    return "" == type || Media.isJsonMedia(type)
  }

  private fun snapshot(res: Any?): CacheSnapshot {
    val rm = if (res is MutableMap<*, *>) res as MutableMap<String, Any?> else null

    val snap = CacheSnapshot()

    val status = FeatureOptions.fresStatus(res)
    if (status >= 0) {
      snap.status = status
    }
    if (rm != null) {
      val st = rm["statusText"]
      if (st is String) {
        snap.statusText = st
      }
      val jf = rm["json"]
      if (jf is Supplier<*>) {
        snap.data = (jf as Supplier<Any?>).get()
      }
      val headers = rm["headers"]
      if (headers is MutableMap<*, *>) {
        for (h in (headers as MutableMap<String, Any?>).entries) {
          snap.headers[h.key.lowercase()] = h.value
        }
      }
    }

    return snap
  }

  // replay builds a fresh transport-shaped response so the body stays
  // re-readable for every consumer.
  private fun replay(snap: CacheSnapshot): MutableMap<String, Any?> {
    val data = snap.data
    val headers = LinkedHashMap(snap.headers)
    val out = linkedMapOf<String, Any?>()
    out["status"] = snap.status
    out["statusText"] = snap.statusText
    out["body"] = "not-used"
    out["json"] = Supplier<Any?> { data }
    out["headers"] = headers
    return out
  }

  // evict drops oldest entries (FIFO) until the store is under `max`.
  private fun evict() {
    val max = FeatureOptions.foptInt(this.options, "max", 256)
    while (this.store.size >= max && this.order.isNotEmpty()) {
      val oldest = this.order.removeAt(0)
      this.store.remove(oldest)
    }
  }

  companion object {
    private val SAFE_METHODS = listOf("GET", "HEAD")
    private val UNSTORED = listOf("no-store", "private", "no-cache")
    private val MAX_AGE = Regex("^max-age\\s*=\\s*\"?(\\d+)\"?$")

    // The configured ttl capped by the response's Cache-Control; zero when
    // the response may not be stored.
    private fun lifetime(headers: Map<String, Any?>, ttl: Long): Long {
      var control = ""
      for ((name, value) in headers) {
        if (name.lowercase() == "cache-control") {
          control = value.toString().lowercase()
        }
      }
      var life = ttl
      for (part in control.split(",")) {
        val directive = part.trim()
        if (directive in UNSTORED) {
          return 0
        }
        val secs = MAX_AGE.matchEntire(directive)?.groupValues?.get(1)?.toLongOrNull()
        if (secs != null) {
          life = minOf(life, secs * 1000)
        }
      }
      return life
    }

    private fun scope(url: String): String = url.split(Regex("[?#]"), 2)[0].trimEnd('/')

    private fun parent(scope: String): String {
      val scheme = scope.indexOf("://")
      val root = if (scheme < 0) 0 else scope.indexOf('/', scheme + 3)
      if (root < 0) {
        return scope
      }
      return scope.substring(0, maxOf(scope.lastIndexOf('/'), root))
    }

    private fun under(scope: String, prefix: String): Boolean =
      scope == prefix || scope.startsWith("$prefix/")
  }
}
