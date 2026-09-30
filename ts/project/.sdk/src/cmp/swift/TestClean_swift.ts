import {
  cmp,
  each,
  entityCollection,
  File,
  Content,
  isAuthSuppressed,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
} from '@voxgig/sdkgen'


import { swiftString } from './utility_swift'


// The canary sweep, the swift twin of TestClean_ts.ts. The entity accessors
// and their operations are typed methods, so the candidates the sweep drives
// are emitted from the model rather than found by walking the client at run
// time. The helper types nest in the test case: the swift type guard reads
// top-level declarations, and the Tests module is a namespace of its own.
const TestClean = cmp(function TestClean(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const auth = {
    suppressed: isAuthSuppressed(model),
    where: resolveAuthIn(model),
    name: 'header' === resolveAuthIn(model)
      ? resolveAuthName(model).toLowerCase() : resolveAuthName(model),
    basic: isHttpBasicAuth(model),
  }

  // Same order the ts sweep tries: list, then load, then the rest.
  const rank: Record<string, number> = { list: 0, load: 1 }
  const candidates = each(entityCollection(model))
    .filter((e: any) => false !== e.active)
    .map((e: any) => ({
      name: e.name,
      Name: e.Name,
      ops: Object.keys(e.op || {})
        .sort((a, b) => (rank[a] ?? 2) - (rank[b] ?? 2)),
    }))
    .filter((c: any) => 0 < c.ops.length)

  // Inside Tests/<Name>SdkTests already: Test_swift.ts opens those folders.
  File({ name: 'CleanTest.' + target.ext }, () =>
    Content(render(model.const.Name, auth, candidates)))
})


function render(
  Name: string,
  auth: { suppressed: boolean, where: string, name: string, basic: boolean },
  candidates: { name: string, Name: string, ops: string[] }[],
): string {
  const candidateLines = candidates.map((c) =>
    `    Candidate(name: ${swiftString(c.name)}, accessor: { $0.${c.Name}(nil) }, ` +
    `ops: [${c.ops.map((o) => swiftString(o)).join(', ')}]),`)
    .join('\n')

  return `// The canary sweep: every credential slot holds a distinctive value, every
// diagnostic feature this SDK ships is switched on with a capturing sink, a
// real operation runs through every outcome, and every string that leaves
// the SDK is searched for the canaries and their encoded forms. It also
// proves its own sensitivity: with clean switched off the canary MUST show.

import Foundation
import XCTest

@testable import ${Name}Sdk

// Generated: the credential's wire placement is fixed when the SDK is built.
private let authSuppressed = ${auth.suppressed ? 'true' : 'false'}
private let authWhere = ${swiftString(auth.where)}
private let authName = ${swiftString(auth.name)}

private let canaryApikey = "CANARY-APIKEY-k9x2m7q4p1"
private let canarySecret = "CANARY-SECRET-w3e8r5t2y6"
private let canaryHeader = "CANARY-HEADER-z1x4c7v0b3"
private let canaryValue = "CANARY-VALUE-n5m8b2v9c4"

private let mask = "[redacted]"

// encodeURIComponent's unreserved set.
private let unreserved = CharacterSet(
  charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()")

private func base64(_ s: String) -> String { Data(s.utf8).base64EncodedString() }

private func percent(_ s: String) -> String {
  s.addingPercentEncoding(withAllowedCharacters: unreserved) ?? s
}

// Every form a canary can travel in.
private let forms: [String] = {
  var out: [String] = []
  for v in [canaryApikey, canarySecret, canaryHeader, canaryValue] {
    out.append(v)
    out.append(base64(v))
    out.append(percent(v))
  }
  out.append(base64(canaryApikey + ":" + canarySecret))
  return out
}()

private func leaks(_ text: String) -> [String] {
  forms.filter { text.contains($0) }
}

// Header maps keep the caller's spelling; the assertion should not care.
private func header(_ map: Value, _ name: String) -> Value {
  guard let m = map.asMap else { return .noval }
  for (k, v) in m.entries where k.caseInsensitiveCompare(name) == .orderedSame {
    return v
  }
  return .noval
}

private func response(_ status: Int, _ data: Value, _ headers: [(String, String)] = []) -> Value {
  let h = VMap()
  h.entries["content-type"] = .string("application/json")
  for (k, v) in headers { h.entries[k.lowercased()] = .string(v) }
  let m = VMap()
  m.entries["status"] = .int(Int64(status))
  m.entries["statusText"] = .string(status < 400 ? "OK" : "ERR")
  m.entries["json"] = .nat({ () -> Value in data } as NativeCall0)
  m.entries["body"] = .string(jsonify(data, indent: 0))
  m.entries["headers"] = .map(h)
  return .map(m)
}

// The typed pipeline products read through their stored properties, so the
// raw spec is visible when clean is off - the sensitivity check depends on it.
private func render(_ any: Any?, _ depth: Int = 0) -> String {
  guard let any = any, depth < 8 else { return "null" }
  if let v = any as? Value {
    if let n = v.asNative { return render(n, depth + 1) }
    return jsonify(v, indent: 0)
  }
  if let m = any as? VMap { return jsonify(.map(m), indent: 0) }
  if let s = any as? String { return s }
  if let sp = any as? Spec {
    let m = VMap()
    m.entries["method"] = .string(sp.method)
    m.entries["url"] = .string(sp.url)
    m.entries["path"] = .string(sp.path)
    m.entries["headers"] = .map(sp.headers)
    m.entries["query"] = .map(sp.query)
    m.entries["params"] = .map(sp.params)
    m.entries["body"] = sp.body
    return jsonify(.map(m), indent: 0)
  }
  if let ent = any as? Entity { return jsonify(ent.data(), indent: 0) }
  if let ctx = any as? Context { return jsonify(.map(ctx.record()), indent: 0) }
  if let e = any as? ${Name}Error { return jsonify(.map(e.record()), indent: 0) }
  var out = ""
  dump(any, to: &out, maxDepth: 8)
  return out
}

final class ${Name}CleanTest: XCTestCase {

  struct Sink {
    let name: String
    let text: String
  }

  // A reference the capturing closures share.
  final class SinkBox {
    var sinks: [Sink] = []
  }

  struct Candidate {
    let name: String
    let accessor: (${Name}SDK) -> ${Name}EntityBase
    let ops: [String]
  }

  struct Target {
    let candidate: Candidate
    let op: String
  }

  struct TransportError: Error, CustomStringConvertible {
    let message: String
    var description: String { message }
  }

  struct Scenario {
    let name: String
    let respond: (String, VMap) throws -> Value
  }

  // Every default print a value has, plus the SDK's own record of it.
  static func formsOf(_ name: String, _ val: Any?) -> [Sink] {
    var out: [Sink] = []
    func push(_ kind: String, _ fn: () -> String) {
      out.append(Sink(name: name + ":" + kind, text: fn()))
    }
    guard let val = val else { return out }
    push("describing") { String(describing: val) }
    push("reflecting") { String(reflecting: val) }
    push("dump") {
      var s = ""
      dump(val, to: &s, maxDepth: 8)
      return s
    }
    push("render") { render(val) }
    if let v = val as? Value { push("json") { jsonify(v, indent: 0) } }
    if let m = val as? VMap { push("json") { jsonify(.map(m), indent: 0) } }
    if let e = val as? ${Name}Error {
      push("message") { e.message }
      push("record") { jsonify(.map(e.record()), indent: 0) }
    }
    if let e = val as? Error { push("message") { errMessage(e) } }
    if let c = val as? Context { push("record") { jsonify(.map(c.record()), indent: 0) } }
    return out
  }

  // Captures the serialised context from inside the pipeline: what a hook
  // author would hand to a logger.
  final class CaptureFeature: BaseFeature {
    let box: SinkBox
    init(_ box: SinkBox) {
      self.box = box
      super.init()
      name = "capture"
      version = "0.0.1"
      active = true
    }
    override func preRequest(_ ctx: Context) { box.sinks += ${Name}CleanTest.formsOf("ctx@PreRequest", ctx) }
    override func preResponse(_ ctx: Context) { box.sinks += ${Name}CleanTest.formsOf("ctx@PreResponse", ctx) }
    override func preUnexpected(_ ctx: Context) { box.sinks += ${Name}CleanTest.formsOf("ctx@PreUnexpected", ctx) }
  }

  static let scenarios: [Scenario] = [
    Scenario(name: "ok", respond: { _, _ in
      response(200, .map(vm(("id", .string("i1")), ("name", .string("n1")))),
        [("x-session-token", "RESP-TOKEN-a1b2c3d4e5")])
    }),
    Scenario(name: "notfound", respond: { _, _ in
      response(404, .map(vm(("error", .string("no such record")))))
    }),
    Scenario(name: "server", respond: { _, _ in
      response(500, .map(vm(("error", .string("boom")))))
    }),
    Scenario(name: "transport", respond: { url, _ in
      throw TransportError(message: "socket hang up (URL was: \\"" + url + "\\")")
    }),
    Scenario(name: "notjson", respond: { _, _ in
      let m = VMap()
      m.entries["status"] = .int(200)
      m.entries["statusText"] = .string("OK")
      m.entries["json"] = .nat({ () -> Value in .noval } as NativeCall0)
      m.entries["body"] = .string("<html>")
      m.entries["headers"] = .map(VMap())
      return .map(m)
    }),
  ]

  // True when this SDK was generated with the named feature.
  static func hasFeature(_ name: String) -> Bool {
    gp(SdkConfig.makeConfig(), "feature").asMap?.entries[name] != nil
  }

  static func makeSdk(_ scenario: Scenario, _ box: SinkBox, _ cleanopts: VMap? = nil) -> ${Name}SDK {
    func capture(_ name: String) -> (VMap) -> Void {
      return { rec in box.sinks += formsOf(name, rec) }
    }

    let feature = VMap()
    if hasFeature("log") {
      let logger: (String, String, VMap) -> Void = { level, _, attrs in
        box.sinks += formsOf("log." + level, attrs)
      }
      feature.entries["log"] = .map(vm(("active", .bool(true)), ("logger", .nat(logger))))
    }
    if hasFeature("debug") {
      feature.entries["debug"] = .map(vm(("active", .bool(true)), ("onEntry", .nat(capture("debug")))))
    }
    if hasFeature("audit") {
      feature.entries["audit"] = .map(vm(("active", .bool(true)), ("sink", .nat(capture("audit")))))
    }
    if hasFeature("telemetry") {
      feature.entries["telemetry"] = .map(vm(("active", .bool(true)), ("exporter", .nat(capture("telemetry")))))
    }
    if hasFeature("cost") {
      let sink: (CostRecord) -> Void = { rec in box.sinks += formsOf("cost", rec) }
      feature.entries["cost"] = .map(vm(("active", .bool(true)), ("sink", .nat(sink))))
    }
    if hasFeature("metrics") {
      feature.entries["metrics"] = .map(vm(("active", .bool(true))))
    }
    if hasFeature("clienttrack") {
      feature.entries["clienttrack"] = .map(vm(("active", .bool(true))))
    }

    let clean = VMap()
    clean.entries["values"] = .string(canaryValue)
    if let extra = cleanopts {
      for (k, v) in extra.entries { clean.entries[k] = v }
    }

    let fetch: FetcherFunc = { _, url, fetchdef in try scenario.respond(url, fetchdef) }

    let opts = VMap()
    opts.entries["apikey"] = .string(canaryApikey)
    opts.entries["secret"] = .string(canarySecret)
    opts.entries["headers"] = .map(vm(("X-Custom-Token", .string(canaryHeader))))
    opts.entries["clean"] = .map(clean)
    opts.entries["feature"] = .map(feature)
    opts.entries["extend"] = .list([.nat(CaptureFeature(box))])
    opts.entries["utility"] = .map(vm(("fetcher", .nat(fetch))))
    return ${Name}SDK(opts)
  }

  // Emitted from the model: every active entity with the operations it
  // declares, list and load first.
  static let candidates: [Candidate] = [
${candidateLines}
  ]

  static func invoke(_ ent: ${Name}EntityBase, _ op: String, _ ctrl: VMap?) throws -> Value {
    switch op {
    case "list": return try ent.list(VMap(), ctrl)
    case "load": return try ent.load(VMap(), ctrl)
    case "create": return try ent.create(VMap(), ctrl)
    case "update": return try ent.update(VMap(), ctrl)
    case "remove": return try ent.remove(VMap(), ctrl)
    default: throw TransportError(message: "unknown operation: " + op)
    }
  }

  // The first operation that completes against a plain 200 with no arguments
  // (a required path parameter would fail before the request is built).
  static func usableOp() -> Target? {
    let fetch: FetcherFunc = { _, _, _ in response(200, .map(vm(("id", .string("i1"))))) }
    let opts = VMap()
    opts.entries["apikey"] = .string(canaryApikey)
    opts.entries["utility"] = .map(vm(("fetcher", .nat(fetch))))
    let plain = ${Name}SDK(opts)
    for candidate in candidates {
      for op in candidate.ops {
        if (try? invoke(candidate.accessor(plain), op, nil)) != nil {
          return Target(candidate: candidate, op: op)
        }
      }
    }
    return nil
  }

  static func drive(_ sdk: ${Name}SDK, _ target: Target, _ ctrl: VMap, _ box: SinkBox) -> Error? {
    var out: Value = .noval
    var err: Error? = nil
    do {
      out = try invoke(target.candidate.accessor(sdk), target.op, ctrl)
    } catch {
      err = error
    }
    if let e = err { box.sinks += formsOf("error", e) }
    if !isNil(out) { box.sinks += formsOf("result", out) }
    if let explain = ctrl.entries["explain"]?.asMap { box.sinks += formsOf("explain", explain) }
    return err
  }

  func testNoCredentialLeavesTheSdkInAnyForm() {
    guard let target = ${Name}CleanTest.usableOp() else {
      XCTFail("no operation completes without arguments; nothing to sweep")
      return
    }

    let box = SinkBox()
    var errors: [String: Error] = [:]
    var explains: [String: VMap] = [:]

    let variants: [(String, () -> VMap)] = [
      ("throw", { VMap() }),
      ("explain", { vm(("explain", .map(VMap()))) }),
      ("nothrow", { vm(("throw", .bool(false)), ("explain", .map(VMap()))) }),
    ]

    for scenario in ${Name}CleanTest.scenarios {
      for (vname, makeCtrl) in variants {
        let sdk = ${Name}CleanTest.makeSdk(scenario, box)
        let ctrl = makeCtrl()
        let err = ${Name}CleanTest.drive(sdk, target, ctrl, box)
        let key = scenario.name + "/" + vname
        if let e = err { errors[key] = e }
        if let ex = ctrl.entries["explain"]?.asMap { explains[key] = ex }
        box.sinks += ${Name}CleanTest.formsOf("sdk", sdk)
      }
    }

    let leaked = box.sinks
      .map { (name: $0.name, found: leaks($0.text)) }
      .filter { !$0.found.isEmpty }

    print("clean: swept \\(box.sinks.count) surface(s), \\(leaked.count) leak(s)")

    XCTAssertEqual(leaked.count, 0, "credential leaked through: " +
      leaked.map { $0.name + " [" + $0.found.joined(separator: ", ") + "]" }.joined(separator: "; "))

    // The positive half: the slot the credential travelled in is masked,
    // and an unregistered token in a response header is masked by name.
    guard let notfound = errors["notfound/throw"] as? ${Name}Error else {
      XCTFail("the 404 scenario must throw")
      return
    }
    XCTAssertEqual(notfound.status, 404)
    let spec = notfound.specVal
    if !authSuppressed {
      if "query" == authWhere {
        XCTAssertEqual(header(gp(spec, "query"), authName), .string(mask))
      } else if "cookie" == authWhere {
        let cookie = header(gp(spec, "headers"), "cookie").asString ?? ""
        XCTAssertTrue(cookie.contains(mask), "cookie: " + cookie)
      } else {
        let cred = header(gp(spec, "headers"), authName).asString ?? ""
        XCTAssertTrue(cred.hasSuffix(mask), authName + ": " + cred)
      }
    }
    XCTAssertEqual(header(gp(spec, "headers"), "x-custom-token"), .string(mask))

    let explained = explains["ok/explain"] ?? VMap()
    let result = gp(explained, "result")
    XCTAssertFalse(isNil(result), "the explain record should carry the result")
    XCTAssertEqual(header(gp(result, "headers"), "x-session-token"), .string(mask))
  }

  func testTheSweepCanSeeALeakCleanSwitchedOffShowsTheCredential() {
    guard let target = ${Name}CleanTest.usableOp() else {
      XCTFail("no operation completes without arguments")
      return
    }

    let box = SinkBox()
    let sdk = ${Name}CleanTest.makeSdk(${Name}CleanTest.scenarios[1], box, vm(("active", .bool(false))))
    let err = ${Name}CleanTest.drive(sdk, target, VMap(), box)
    XCTAssertNotNil(err, "the 404 scenario must throw")

    let leaked = box.sinks.filter { !leaks($0.text).isEmpty }
    XCTAssertTrue(!leaked.isEmpty, "with clean off, nothing showed the canary: the sweep is blind")

    if !authSuppressed, let e = err as? ${Name}Error {
      let text = render(e.specVal)
      XCTAssertTrue(text.contains(canaryApikey) || text.contains(base64(canaryApikey + ":" + canarySecret)),
        "the raw spec should carry the credential when clean is off")
    }
  }
}
`
}


export {
  TestClean
}
