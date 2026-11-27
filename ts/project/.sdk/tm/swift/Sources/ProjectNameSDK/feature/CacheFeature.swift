// Response caching for safe (read) requests, per client: see the features
// reference for the key, the write invalidation and the Cache-Control rules.
// Foundation on Linux has no HMAC: the seeded Hasher over a random per-client
// salt separates header sets within one store without holding a header value.
// It is not a cryptographic commitment.

import Foundation

public final class CacheFeature: BaseFeature {
  private var client: ProjectNameSDK?
  private var options: VMap?
  private var store: [String: CacheEntry] = [:]
  private var order: [String] = []
  private var salt: [UInt8] = []

  private static let safeMethods: Set<String> = ["GET", "HEAD"]
  private static let unstored: Set<String> = ["no-store", "private", "no-cache"]

  // Activity tracking (mirrors the ts client._cache record).
  public var hit = 0
  public var miss = 0
  public var bypass = 0

  private final class CacheEntry {
    var expiry: Int64 = 0
    var scope: String = ""
    var snapshot: CacheSnapshot = CacheSnapshot()
  }

  private final class CacheSnapshot {
    var status: Int = 0
    var statusText: String = ""
    var data: Value = .noval
    var headers: VMap = VMap()
  }

  public override init() {
    super.init()
    version = "0.0.1"
    name = "cache"
    active = true
  }

  public override func initFeature(_ ctx: Context, _ options: VMap) {
    client = ctx.client
    self.options = options
    active = foptBool(options, "active", false)

    if !active {
      return
    }

    store = [:]
    order = []
    var rng = SystemRandomNumberGenerator()
    salt = (0..<32).map { _ in UInt8.random(in: 0...255, using: &rng) }

    let inner = ctx.utility!.fetcher!

    ctx.utility!.fetcher = { ctx2, url, fetchdef in
      try self.through(ctx2, url, fetchdef, inner)
    }
  }

  private func through(_ ctx: Context, _ url: String, _ fetchdef: VMap,
                       _ inner: FetcherFunc) throws -> Value {
    var method = "GET"
    if let m = fetchdef.entries["method"]?.asString, m != "" {
      method = m.uppercased()
    }

    let methods = foptStrList(options, "methods") ?? ["GET"]
    let cacheable = methods.contains { $0.uppercased() == method }
    if !cacheable {
      if CacheFeature.safeMethods.contains(method) {
        return try inner(ctx, url, fetchdef)
      }
      defer { invalidate(url) }
      return try inner(ctx, url, fetchdef)
    }

    let key = method + " " + url + " " + digest(fetchdef.entries["headers"])
    let now = foptNow(options)()

    if let entry = store[key], entry.expiry > now {
      hit += 1
      return CacheFeature.replay(entry.snapshot)
    }

    var res: Value = .noval
    var err: Error? = nil
    do {
      res = try inner(ctx, url, fetchdef)
    } catch {
      err = error
    }

    // A body that declares another type than JSON passes by, unread.
    if err == nil && CacheFeature.storable(res) && !CacheFeature.json(res) {
      bypass += 1
      return res
    }

    if err == nil && CacheFeature.storable(res) {
      let snap = CacheFeature.snapshot(res)
      let ttl = CacheFeature.lifetime(snap.headers, Int64(foptInt(options, "ttl", 5000)))
      if ttl <= 0 {
        bypass += 1
        return CacheFeature.replay(snap)
      }
      drop(key)
      evict()
      let entry = CacheEntry()
      entry.expiry = now + ttl
      entry.scope = CacheFeature.scope(url)
      entry.snapshot = snap
      store[key] = entry
      order.append(key)
      miss += 1
      return CacheFeature.replay(snap)
    }

    bypass += 1
    if let err = err {
      throw err
    }
    return res
  }

  private func digest(_ headers: Value?) -> String {
    var pairs: [(String, String)] = []
    if let hm = headers?.asMap {
      for (k, v) in hm.entries {
        if let text = CacheFeature.headerText(v) {
          pairs.append((k.lowercased(), text))
        }
      }
    }
    pairs.sort { $0.0 != $1.0 ? $0.0 < $1.0 : $0.1 < $1.1 }
    var hasher = Hasher()
    hasher.combine(salt)
    for (k, v) in pairs {
      hasher.combine(k + ":" + v + "\n")
    }
    return String(UInt64(bitPattern: Int64(hasher.finalize())), radix: 16)
  }

  private static func headerText(_ v: Value) -> String? {
    switch v {
    case .noval, .null: return nil
    case .string(let s): return s
    case .int(let n): return String(n)
    case .bool(let b): return String(b)
    default: return "\(v)"
    }
  }

  private func invalidate(_ url: String) {
    let path = CacheFeature.scope(url)
    let collection = CacheFeature.parent(path)
    for (key, entry) in store
      where CacheFeature.under(entry.scope, path) || entry.scope == collection {
      drop(key)
    }
  }

  private func drop(_ key: String) {
    if store.removeValue(forKey: key) != nil {
      order.removeAll { $0 == key }
    }
  }

  // The configured ttl capped by the response's Cache-Control; zero when the
  // response may not be stored.
  private static func lifetime(_ headers: VMap, _ ttl: Int64) -> Int64 {
    var control = ""
    for (k, v) in headers.entries where k.lowercased() == "cache-control" {
      control = (headerText(v) ?? "").lowercased()
    }
    var life = ttl
    for part in control.split(separator: ",", omittingEmptySubsequences: false) {
      let directive = part.trimmingCharacters(in: .whitespaces)
      if unstored.contains(directive) {
        return 0
      }
      if directive.hasPrefix("max-age") {
        var value = directive.dropFirst("max-age".count).trimmingCharacters(in: .whitespaces)
        if value.hasPrefix("=") {
          value = value.dropFirst().trimmingCharacters(in: .whitespaces)
            .trimmingCharacters(in: CharacterSet(charactersIn: "\""))
          if !value.isEmpty, value.count < 16, value.allSatisfy({ $0.isASCII && $0.isNumber }),
             let secs = Int64(value) {
            life = min(life, secs * 1000)
          }
        }
      }
    }
    return life
  }

  private static func scope(_ url: String) -> String {
    var out = String(url.split(maxSplits: 1, omittingEmptySubsequences: false) { $0 == "?" || $0 == "#" }[0])
    while out.hasSuffix("/") {
      out.removeLast()
    }
    return out
  }

  private static func parent(_ scope: String) -> String {
    let chars = Array(scope)
    var root = 0
    if let scheme = scope.range(of: "://") {
      let after = scope.distance(from: scope.startIndex, to: scheme.upperBound)
      guard let slash = chars[after...].firstIndex(of: "/") else {
        return scope
      }
      root = slash
    }
    let cut = chars.lastIndex(of: "/") ?? 0
    return String(chars[0..<Swift.max(cut, root)])
  }

  private static func under(_ scope: String, _ prefix: String) -> Bool {
    return scope == prefix || scope.hasPrefix(prefix + "/")
  }

  // A body the transport could not read as JSON passes through, for the operation to report.
  private static func storable(_ res: Value) -> Bool {
    let (status, has) = fresStatus(res)
    return has && status >= 200 && status < 300 && gp(res, "unreadable") != .bool(true)
  }

  private static func json(_ res: Value) -> Bool {
    let type = Response.headerValue(gp(res, "headers"), "content-type")
    return type.isEmpty || isJsonMedia(.string(type))
  }

  private static func snapshot(_ res: Value) -> CacheSnapshot {
    let snap = CacheSnapshot()

    let (status, has) = fresStatus(res)
    if has {
      snap.status = status
    }
    if let rm = res.asMap {
      if let st = rm.entries["statusText"]?.asString {
        snap.statusText = st
      }
      if let f = rm.entries["json"]?.asNative as? NativeCall0 {
        snap.data = f()
      }
      if let headers = rm.entries["headers"]?.asMap {
        for (k, v) in headers.entries {
          snap.headers.entries[k.lowercased()] = v
        }
      }
    }

    return snap
  }

  // Replay builds a fresh transport-shaped response so the body stays
  // re-readable for every consumer.
  private static func replay(_ snap: CacheSnapshot) -> Value {
    let data = snap.data
    let headers = VMap()
    for (k, v) in snap.headers.entries {
      headers.entries[k] = v
    }
    let r = VMap()
    r.entries["status"] = .int(Int64(snap.status))
    r.entries["statusText"] = .string(snap.statusText)
    r.entries["body"] = .string("not-used")
    r.entries["json"] = .nat({ () -> Value in data } as NativeCall0)
    r.entries["headers"] = .map(headers)
    return .map(r)
  }

  // Evict drops oldest entries (FIFO) until the store is under `max`.
  private func evict() {
    let max = foptInt(options, "max", 256)
    while store.count >= max && order.count > 0 {
      let oldest = order.removeFirst()
      store.removeValue(forKey: oldest)
    }
  }
}
