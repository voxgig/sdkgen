// ProjectName SDK utility: fetcher - the default URLSession transport,
// mode/test blocking, and the injectable system.fetch override.

import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

// Cookies OFF on both sessions: the process-wide session carries the
// process-wide cookie storage, so one call's Set-Cookie would come back on
// the next, under a different credential. Pooling is per configuration and
// is unaffected.
private func cookielessConfiguration() -> URLSessionConfiguration {
  let cfg = URLSessionConfiguration.default
  cfg.httpCookieStorage = nil
  cfg.httpShouldSetCookies = false
  cfg.httpCookieAcceptPolicy = .never
  return cfg
}

// Every 3xx comes back as a response: defaultHttpFetch follows redirects.
private final class ManualRedirectDelegate: NSObject, URLSessionTaskDelegate {
  func urlSession(
    _ session: URLSession, task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    completionHandler(nil)
  }
}

private let manualRedirectSession = URLSession(
  configuration: cookielessConfiguration(),
  delegate: ManualRedirectDelegate(), delegateQueue: nil)

let getOnlyEnv = "VOXGIG_GETONLY_GUARD"

// A GET-only live run refuses any other method before it is sent. The error
// names the path alone: the query can carry a credential.
func getOnlyRefusal(_ fullurl: String, _ method: String) -> ProjectNameError? {
  let upper = method.uppercased()
  if ProcessInfo.processInfo.environment[getOnlyEnv] != "TRUE" || upper == "GET" {
    return nil
  }
  var rest = Substring(fullurl)
  if let scheme = rest.range(of: "://") {
    rest = rest[scheme.upperBound...]
    rest = rest[(rest.firstIndex(where: { "/?#".contains($0) }) ?? rest.endIndex)...]
  }
  let path = rest[..<(rest.firstIndex(where: { "?#".contains($0) }) ?? rest.endIndex)]
  return ProjectNameError("fetch_getonly_block",
    "[GET-ONLY GUARD] blocked \(upper) \(path.isEmpty ? "/" : String(path))", nil)
}

let redirectStatus: Set<Int64> = [301, 302, 303, 307, 308]
let redirectMax = 5

// The Location resolved against the URL that answered with it.
func resolveLocation(_ base: String, _ location: String) -> String? {
  let trimmed = location.filter { !$0.isWhitespace }
  guard let resolved = URL(string: trimmed, relativeTo: URL(string: base)) else { return nil }
  return String(resolved.absoluteString.prefix { $0 != "#" })
}

private func redirectOrigin(_ url: String) -> String {
  guard let parts = URLComponents(string: url) else { return url }
  let scheme = parts.scheme?.lowercased() ?? ""
  return "\(scheme)://\(parts.host?.lowercased() ?? ""):\(parts.port ?? (scheme == "https" ? 443 : 80))"
}

private func withoutCredentials(_ fetchdef: VMap) -> VMap {
  let copy = VMap(fetchdef.entries)
  if let headers = gp(fetchdef, "headers").asMap {
    var kept = headers.entries
    for key in kept.keys where ["authorization", "cookie", "proxy-authorization"].contains(key.lowercased()) {
      _ = kept.removeValue(forKey: key)
    }
    copy.entries["headers"] = .map(VMap(kept))
  }
  return copy
}

// URLSession on Linux drops the trailing slash of a Location it follows, so
// redirects are followed here. A GET or HEAD follows one, unless the fetch
// definition says "manual", each hop passing the GET-only guard first; past
// redirectMax hops the last 3xx is the answer. Another origin is not sent the
// request's credentials.
func defaultHttpFetch(_ fullurl: String, _ fetchdef: VMap) throws -> Value {
  let raw = gp(fetchdef, "method").asString ?? "GET"
  let method = raw.isEmpty ? "GET" : raw.uppercased()
  let follow = (method == "GET" || method == "HEAD") && gp(fetchdef, "redirect").asString != "manual"
  var url = fullurl
  var def = fetchdef
  var hops = 0
  while true {
    if let refused = getOnlyRefusal(url, method) {
      throw refused
    }
    let res = try sendOnce(url, def)
    guard follow, hops < redirectMax, let status = gp(res, "status").asInt,
      redirectStatus.contains(status), let location = gp(gp(res, "headers"), "location").asString,
      let next = resolveLocation(url, location)
    else {
      return res
    }
    if redirectOrigin(next) != redirectOrigin(url) {
      def = withoutCredentials(def)
    }
    url = next
    hops += 1
  }
}

private func sendOnce(_ fullurl: String, _ fetchdef: VMap) throws -> Value {
  // A request that cannot be sent fails the operation.
  guard let url = URL(string: fullurl) else {
    throw ProjectNameError("fetch_transport", "the URL could not be parsed", nil)
  }

  var req = URLRequest(url: url)
  req.httpMethod = gp(fetchdef, "method").asString ?? "GET"

  let body = gp(fetchdef, "body")
  if let text = body.asString, text != "" {
    req.httpBody = text.data(using: .utf8)
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
  } else if case .native(let ref) = body {
    if let data = ref.value as? Data {
      req.httpBody = data
    } else if let bytes = ref.value as? [UInt8] {
      req.httpBody = Data(bytes)
    }
  }

  var hasUA = false
  if let headers = gp(fetchdef, "headers").asMap {
    for (k, v) in headers.entries {
      if let sv = v.asString {
        if k.lowercased() == "user-agent" { hasUA = true }
        req.setValue(sv, forHTTPHeaderField: k)
      }
    }
  }
  // The default User-Agent is recorded with the headers the request sent.
  if !hasUA {
    let agent = "Mozilla/5.0 (compatible; ProjectNameSDK/1.0)"
    req.setValue(agent, forHTTPHeaderField: "User-Agent")
    if let sent = gp(fetchdef, "headers").asMap {
      sent.entries["user-agent"] = .string(agent)
    }
  }

  // Also per request, so no store reached another way can rewrite the
  // Cookie header set above — an `apiKey in: cookie` scheme sets one.
  req.httpShouldHandleCookies = false

  final class FetchBox: @unchecked Sendable {
    var data: Data?
    var resp: URLResponse?
    var err: Error?
  }
  let box = FetchBox()
  let sem = DispatchSemaphore(value: 0)
  let task = manualRedirectSession.dataTask(with: req) { d, r, e in
    box.data = d; box.resp = r; box.err = e; sem.signal()
  }
  task.resume()
  sem.wait()

  if let e = box.err { throw e }

  let respData = box.data
  let http = box.resp as? HTTPURLResponse
  let status = http?.statusCode ?? 0
  let bodyText = respData.flatMap { String(data: $0, encoding: .utf8) } ?? ""

  let resheaders = VMap()
  if let http = http {
    for (k, v) in http.allHeaderFields {
      if let ks = k as? String {
        resheaders.entries[ks.lowercased()] = .string("\(v)")
      }
    }
  }

  var jsonBody: Value = .noval
  var unreadable = false
  if !bodyText.allSatisfy({ $0.isWhitespace }) {
    if let parsed = try? JSON.parse(bodyText) { jsonBody = parsed } else { unreadable = true }
  }
  let captured = jsonBody

  let m = VMap()
  m.entries["status"] = .int(Int64(status))
  m.entries["statusText"] = .string(HTTPURLResponse.localizedString(forStatusCode: status))
  m.entries["headers"] = .map(resheaders)
  m.entries["json"] = .nat({ () -> Value in captured } as NativeCall0)
  m.entries["body"] = .string(bodyText)
  m.entries["unreadable"] = .bool(unreadable)
  return .map(m)
}

func fetcherUtil(_ ctx: Context, _ fullurl: String, _ fetchdef: VMap) throws -> Value {
  if ctx.client!.mode != "live" {
    throw ctx.makeError("fetch_mode_block",
      "Request blocked by mode: \"\(ctx.client!.mode)\" (URL was: \"\(fullurl)\")")
  }

  let options = ctx.client!.optionsMap()
  if gpath(options, "feature", "test", "active") == .bool(true) {
    throw ctx.makeError("fetch_test_block",
      "Request blocked as test feature is active (URL was: \"\(fullurl)\")")
  }

  let sysFetch = gpath(options, "system", "fetch")
  if isNil(sysFetch) {
    return try defaultHttpFetch(fullurl, fetchdef)
  }

  if let fn = sysFetch.asNative as? SystemFetch {
    return fn(fullurl, fetchdef)
  }

  throw ctx.makeError("fetch_invalid", "system.fetch is not a valid function")
}
