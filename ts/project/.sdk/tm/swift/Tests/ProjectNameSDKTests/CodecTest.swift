// Every form, multipart and raw point this SDK has, driven through a real
// entity operation against a local listener that decodes what arrives. The
// cases come from the client's own config, so no case names an entity; the
// accessors and binary handles come from the generated CodecEntities.swift.

import Foundation
import XCTest

@testable import ProjectNameSdk

final class CodecTest: XCTestCase {

  struct Arrived {
    let headers: [String: String]
    let body: Data
  }

  // A pair or a part as it must arrive, its content as latin1 text.
  struct Expect: Equatable {
    let name: String
    let value: String
    var filename: String? = nil
    var type: String? = nil
    var file = false
  }

  struct Case {
    let name: String
    let run: (Listener) throws -> Void
  }

  struct CheckFailed: Error, CustomStringConvertible {
    let description: String
  }

  // A loopback origin that keeps each request and answers as the case says.
  final class Listener {
    let base: String
    private let fd: Int32
    private let lock = NSLock()
    private var arrivals: [Arrived] = []
    private var type = "application/json"
    private var body = Data()

    init() {
      #if os(Linux)
      let sock = socket(AF_INET, Int32(SOCK_STREAM.rawValue), 0)
      #else
      let sock = socket(AF_INET, SOCK_STREAM, 0)
      #endif
      fd = sock
      var addr = sockaddr_in()
      addr.sin_family = sa_family_t(AF_INET)
      addr.sin_addr.s_addr = inet_addr("127.0.0.1")
      var len = socklen_t(MemoryLayout<sockaddr_in>.size)
      _ = withUnsafeMutablePointer(to: &addr) {
        $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa -> Int32 in
          #if os(Linux)
          return bind(sock, sa, len)
          #else
          return Darwin.bind(sock, sa, len)
          #endif
        }
      }
      listen(sock, 8)
      _ = withUnsafeMutablePointer(to: &addr) {
        $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { getsockname(sock, $0, &len) }
      }
      base = "http://127.0.0.1:\(UInt16(bigEndian: addr.sin_port))"
      Thread.detachNewThread { self.serve() }
    }

    func answer(_ type: String, _ body: Data) {
      lock.lock()
      self.type = type
      self.body = body
      lock.unlock()
    }

    func reset() {
      lock.lock()
      arrivals = []
      type = "application/json"
      body = Data()
      lock.unlock()
    }

    func last() -> Arrived? {
      lock.lock()
      defer { lock.unlock() }
      return arrivals.last
    }

    func stop() {
      _ = try? defaultHttpFetch(base + "/codec-stop",
        vm(("method", .string("GET")), ("headers", .map(VMap()))))
      close(fd)
    }

    private func serve() {
      while true {
        let conn = accept(fd, nil, nil)
        if conn < 0 { return }
        let stopped = handle(conn)
        close(conn)
        if stopped { return }
      }
    }

    // One request: its head, then as many body bytes as it declares.
    private func handle(_ conn: Int32) -> Bool {
      var got: [UInt8] = []
      var buf = [UInt8](repeating: 0, count: 65536)
      var headEnd: Int? = nil
      while headEnd == nil {
        let n = buf.withUnsafeMutableBytes { recv(conn, $0.baseAddress, $0.count, 0) }
        if n <= 0 { return false }
        got.append(contentsOf: buf[0..<n])
        headEnd = CodecTest.find(got, Array("\r\n\r\n".utf8), 0)
      }
      let at = headEnd!
      let lines = CodecTest.lines(Array(got[0..<at]))
      var headers: [String: String] = [:]
      for line in lines.dropFirst() {
        guard let colon = line.firstIndex(of: ":") else { continue }
        headers[String(line[..<colon]).lowercased()] =
          String(line[line.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
      }
      let length = Int(headers["content-length"] ?? "") ?? 0
      while got.count < at + 4 + length {
        let n = buf.withUnsafeMutableBytes { recv(conn, $0.baseAddress, $0.count, 0) }
        if n <= 0 { break }
        got.append(contentsOf: buf[0..<n])
      }
      let target = lines.first?.split(separator: " ").dropFirst().first.map(String.init) ?? ""

      lock.lock()
      if target != "/codec-stop" {
        arrivals.append(Arrived(headers: headers,
          body: Data(got[(at + 4)..<min(got.count, at + 4 + length)])))
      }
      let reply = Data(("HTTP/1.1 200 X\r\nContent-Type: \(type)\r\nContent-Length: \(body.count)" +
        "\r\nConnection: close\r\n\r\n").utf8) + body
      lock.unlock()

      _ = reply.withUnsafeBytes { send(conn, $0.baseAddress, $0.count, 0) }
      return target == "/codec-stop"
    }
  }

  static func find(_ hay: [UInt8], _ needle: [UInt8], _ from: Int) -> Int? {
    if needle.isEmpty || hay.count < needle.count { return nil }
    var i = from
    while i + needle.count <= hay.count {
      if Array(hay[i..<(i + needle.count)]) == needle { return i }
      i += 1
    }
    return nil
  }

  // Byte lines split at CRLF, each as latin1 text.
  static func lines(_ bytes: [UInt8]) -> [String] {
    var out: [String] = []
    var start = 0
    while let at = find(bytes, [13, 10], start) {
      out.append(latin1(Data(bytes[start..<at])))
      start = at + 2
    }
    out.append(latin1(Data(bytes[start..<bytes.count])))
    return out
  }

  static func latin1(_ data: Data) -> String {
    var text = ""
    for byte in data {
      text.unicodeScalars.append(Unicode.Scalar(byte))
    }
    return text
  }

  static func check(_ ok: Bool, _ message: @autoclosure () -> String) throws {
    if !ok { throw CheckFailed(description: message()) }
  }

  static func content(_ name: String) -> Data {
    return Data(("file:" + name).utf8) + Data([0x00, 0xFF, 0x0D, 0x0A, 0x2D, 0x2D])
  }

  static func params(_ point: VMap) -> VMap {
    let out = VMap()
    for part in gp(point, "parts").asList?.items ?? [] {
      if let text = part.asString, text.hasPrefix("{"), text.hasSuffix("}"), 2 < text.count {
        out.entries[String(text.dropFirst().dropLast())] = .string("p1")
      }
    }
    return out
  }

  static func action(_ point: VMap) -> String? {
    return gpath(point, "select", "$action").asString
  }

  static func select(_ point: VMap) -> VMap {
    return action(point).map { vm(("$action", .string($0))) } ?? VMap()
  }

  static func merge(_ maps: VMap...) -> VMap {
    let out = VMap()
    for map in maps {
      for (key, value) in map.entries {
        out.entries[key] = value
      }
    }
    return out
  }

  static func sorted(_ keys: [String]) -> [String] {
    return keys.sorted { Array($0.utf16).lexicographicallyPrecedes(Array($1.utf16)) }
  }

  static func op(_ ent: ProjectNameEntityBase, _ opname: String, _ args: VMap) throws -> Value {
    switch opname {
    case "load": return try ent.load(args, nil)
    case "create": return try ent.create(args, nil)
    case "update": return try ent.update(args, nil)
    case "patch": return try ent.patch(args, nil)
    default: throw CheckFailed(description: "no operation " + opname)
    }
  }

  static func client(_ net: Listener) -> ProjectNameSDK {
    return ProjectNameSDK(vm(("base", .string(net.base))))
  }

  // The data a form or multipart point is sent, and the parts it must arrive as.
  static func plan(_ body: VMap) -> (data: VMap, expect: [Expect]) {
    let data = VMap()
    var expect: [Expect] = []
    let form = gp(body, "kind").asString == "form"
    for fieldv in gp(body, "fields").asList?.items ?? [] {
      guard let field = fieldv.asMap, let name = gp(field, "name").asString else { continue }
      if gp(field, "binary").asBool == true {
        let type: String? = form ? nil : (gp(field, "media").asString ?? "application/octet-stream")
        data.entries[name] = .nat(BinarySource.bytes(content(name),
          name: "/local/dir/" + name + ".bin", type: type))
        expect.append(form ? Expect(name: name, value: latin1(content(name))) :
          Expect(name: name, value: latin1(content(name)), filename: name + ".bin", type: type,
            file: true))
      } else if gp(field, "list").asBool == true {
        data.entries[name] = .list([.string("a"), .string("b c")])
        expect.append(Expect(name: name, value: "a"))
        expect.append(Expect(name: name, value: "b c"))
      } else if let join = gp(field, "join").asString {
        data.entries[name] = .list([.string("a"), .string("b")])
        expect.append(Expect(name: name, value: "a" + join + "b"))
      } else {
        let text = "v\"" + name + "\r\n"
        data.entries[name] = .string(text)
        expect.append(Expect(name: name, value: latin1(Data(text.utf8))))
      }
    }
    return (data: data, expect: expect)
  }

  static func multipart(_ arrived: Arrived) throws -> [Expect] {
    let type = arrived.headers["content-type"] ?? ""
    guard let at = type.range(of: "boundary=") else {
      throw CheckFailed(description: "no boundary in " + type)
    }
    let boundary = String(type[at.upperBound...]).split(separator: ";").first.map(String.init) ?? ""
    let delim = Array(("--" + boundary).utf8)
    let body = Array(arrived.body)
    let close = delim + Array("--\r\n".utf8)
    try check(close.count <= body.count && Array(body[(body.count - close.count)...]) == close,
      "the body does not close")

    var marks: [Int] = []
    var from = 0
    while let mark = find(body, delim, from) {
      marks.append(mark)
      from = mark + delim.count
    }

    var parts: [Expect] = []
    for i in 0..<max(0, marks.count - 1) {
      let chunk = Array(body[(marks[i] + delim.count)..<marks[i + 1]])
      guard let at = find(chunk, Array("\r\n\r\n".utf8), 0), 2 <= at, at + 6 <= chunk.count else {
        throw CheckFailed(description: "a part without a head")
      }
      let head = lines(Array(chunk[2..<at]))
      let content = latin1(Data(chunk[(at + 4)..<(chunk.count - 2)]))
      let disposition = "Content-Disposition: form-data; name=\""
      guard let line = head.first(where: { $0.hasPrefix(disposition) }) else {
        throw CheckFailed(description: "a part without a disposition: " + head.joined(separator: " | "))
      }
      let rest = String(line.dropFirst(disposition.count))
      let name = rest.split(separator: "\"", maxSplits: 1, omittingEmptySubsequences: false)
        .first.map(String.init) ?? ""
      var filename: String? = nil
      if let fat = rest.range(of: "; filename=\"") {
        filename = String(rest[fat.upperBound...]).split(separator: "\"", maxSplits: 1,
          omittingEmptySubsequences: false).first.map(String.init)
      }
      let ctype = head.first(where: { $0.hasPrefix("Content-Type: ") })
        .map { String($0.dropFirst("Content-Type: ".count)) }
      parts.append(filename == nil ? Expect(name: name, value: content) :
        Expect(name: name, value: content, filename: filename, type: ctype, file: true))
    }
    return parts
  }

  static func form(_ arrived: Arrived) -> [Expect] {
    if arrived.body.isEmpty { return [] }
    return Array(arrived.body).split(separator: 0x26, omittingEmptySubsequences: false).map {
      pair -> Expect in
      let halves = pair.split(separator: 0x3d, maxSplits: 1, omittingEmptySubsequences: false)
      return Expect(name: unescape(Array(halves[0])),
        value: 1 < halves.count ? unescape(Array(halves[1])) : "")
    }
  }

  // The bytes of a form-escaped text, as latin1.
  static func unescape(_ text: [UInt8]) -> String {
    var bytes: [UInt8] = []
    var i = 0
    while i < text.count {
      if text[i] == 0x2b {
        bytes.append(0x20)
      } else if text[i] == 0x25, i + 2 < text.count,
        let byte = UInt8(latin1(Data(text[(i + 1)...(i + 2)])), radix: 16)
      {
        bytes.append(byte)
        i += 2
      } else {
        bytes.append(text[i])
      }
      i += 1
    }
    return latin1(Data(bytes))
  }

  static func cases() -> [Case] {
    var out: [Case] = []
    let entities = gp(SdkConfig.sharedConfig(), "entity").asMap ?? VMap()

    for ename in sorted(entities.entries.keys) {
      guard let make = CodecTest.entities[ename] else { continue }
      let ops = gp(entities.entries[ename] ?? .noval, "op").asMap ?? VMap()

      for opname in sorted(ops.entries.keys) {
        for pointv in gp(ops.entries[opname] ?? .noval, "points").asList?.items ?? [] {
          guard let point = pointv.asMap else { continue }
          let act = action(point)
          let label = ename + "." + opname + (act.map { ":" + $0 } ?? "")
          let rb = gp(point, "body").asMap ?? VMap()
          let rs = gp(point, "response").asMap ?? VMap()
          let rbkind = gp(rb, "kind").asString ?? ""
          let writes = ["create", "update", "patch"].contains(opname)

          if (rbkind == "form" || rbkind == "multipart") && writes {
            out.append(Case(name: label + " sends a " + rbkind + " body") { net in
              let planned = plan(rb)
              net.answer("application/json", Data("{\"id\":\"p1\"}".utf8))
              _ = try op(make(client(net)), opname, merge(params(point), select(point), planned.data))
              guard let arrived = net.last() else { throw CheckFailed(description: "nothing arrived") }
              if rbkind == "form" {
                try check(arrived.headers["content-type"] == gp(rb, "media").asString,
                  "content-type " + (arrived.headers["content-type"] ?? "none"))
              }
              let got: [Expect]
              if rbkind == "form" {
                got = form(arrived)
              } else {
                got = try multipart(arrived)
              }
              let names = Set(planned.expect.map { $0.name })
              let kept = got.filter { names.contains($0.name) }
              try check(kept == planned.expect, "arrived \(kept), expected \(planned.expect)")
            })
          }

          if rbkind == "raw" && writes {
            let binary = gp(rb, "binary").asBool == true
            out.append(Case(name: label + " sends a raw " + (binary ? "binary" : "text") + " body") { net in
              net.answer("application/json", Data("{\"id\":\"p1\"}".utf8))
              let ent = make(client(net))
              _ = ent.data(Value.map(params(point)))
              _ = ent.matchv(Value.map(params(point)))
              if binary {
                guard let handle = CodecTest.handle(ent, act) else {
                  throw CheckFailed(description: "no binary handle")
                }
                let got = try handle.put(BinarySource.bytes(content(label), type: gp(rb, "media").asString))
                try check(got === ent, "put did not resolve to the entity")
                try check(net.last()?.body == content(label), "the bytes did not arrive")
              } else {
                let text = "text \"" + label + "\"\n"
                _ = try op(ent, opname, merge(select(point), vm(("$body", .string(text)))))
                try check(net.last().map { String(decoding: $0.body, as: UTF8.self) } == text,
                  "the text did not arrive")
              }
              try check(net.last()?.headers["content-type"] == gp(rb, "media").asString,
                "content-type " + (net.last()?.headers["content-type"] ?? "none"))
            })
          }

          if gp(rs, "kind").asString == "raw" && opname == "load" {
            let binary = gp(rs, "binary").asBool == true
            let media = gp(rs, "media").asString ?? "application/octet-stream"
            out.append(Case(name: label + " reads a raw " + (binary ? "binary" : "text") + " body") { net in
              let ent = make(client(net))
              _ = ent.data(Value.map(params(point)))
              _ = ent.matchv(Value.map(params(point)))
              if binary {
                net.answer(media, content(label))
                guard let handle = CodecTest.handle(ent, act) else {
                  throw CheckFailed(description: "no binary handle")
                }
                let read = try handle.bytes()
                try check(read == content(label), "the bytes read differ")
                var code = ""
                do {
                  _ = try ent.load(merge(params(point), select(point)), nil)
                } catch let err as ProjectNameError {
                  code = err.code
                }
                try check(code == "binary_sink_required", "the plain load was not refused: " + code)
              } else {
                net.answer(media, Data(("café " + label).utf8))
                let got = try ent.load(merge(params(point), select(point)), nil)
                try check((got.asNative as? ProjectNameEntityBase) === ent, "load did not resolve to the entity")
                try check(gp(ent.data(nil), "$body").asString == "café " + label, "the text read differs")
              }
            })
          }
        }
      }
    }
    return out
  }

  func testEveryBodyPointRoundTripsThroughAListener() {
    let net = Listener()
    defer { net.stop() }

    let cases = CodecTest.cases()
    var ran = 0
    var failures: [String] = []
    for kase in cases {
      ran += 1
      net.reset()
      do {
        try kase.run(net)
        print("ok " + kase.name)
      } catch {
        failures.append(kase.name + ": " + errMessage(error))
      }
    }

    print("codec: ran \(ran) case(s), \(failures.count) failed")
    for failure in failures {
      print("FAILED " + failure)
    }

    XCTAssertTrue(0 < cases.count, "no form, multipart or raw point was found")
    XCTAssertEqual(failures, [])
  }
}
