// ProjectName SDK codec: raw - a response body that is not JSON, read to a bound.

import Foundation

private let rawMaxBuffer: Int64 = 16777216

func maxBuffer(_ ctx: Context) -> Int64 {
  for val in [gp(ctx.options, "maxBuffer"), gp(SdkSchema.optspec, "maxBuffer")] {
    if let n = val.asInt, 0 <= n {
      return n
    }
    if let d = val.asDouble, d.isFinite, 0 <= d {
      return Int64(d)
    }
  }
  return rawMaxBuffer
}

private func rawTooLarge(_ ctx: Context, _ code: String, _ max: Int64, _ declared: Int64?)
  -> ProjectNameError
{
  let what = declared.map { "of \($0) bytes exceeds" } ?? "is longer than"
  return ctx.makeError(code, "response: body \(what) maxBuffer (\(max) bytes)")
}

// The whole body, refused past the bound: by its declared length, then by
// its count. URLSession hands over a body already read, so the default
// transport holds it once before the bound applies; a supplied fetch that
// answers with the declared length alone is refused before its body is read.
func readBounded(_ ctx: Context, _ response: Response?, _ max: Int64, _ code: String) throws -> Data {
  let length = Response.headerValue(response?.headers ?? .noval, "content-length")
    .trimmingCharacters(in: .whitespaces)
  if !length.isEmpty, length.unicodeScalars.allSatisfy({ ("0"..."9").contains($0) }),
    let declared = Int64(length), max < declared
  {
    throw rawTooLarge(ctx, code, max, declared)
  }

  let body = response?.body ?? .noval
  let bytes: Data
  switch body {
  case .noval, .null:
    bytes = Data()
  case .string(let text):
    bytes = Data(text.utf8)
  default:
    bytes = bytesOf(body) ?? Data(itemText(body).utf8)
  }

  if max < Int64(bytes.count) {
    throw rawTooLarge(ctx, code, max, nil)
  }
  return bytes
}

// A raw success body: text into the record under `$body`; bytes only into a
// binary handle's read, never into the record.
func readRawUtil(_ ctx: Context) throws {
  guard let result = ctx.result else { return }
  let transfer = ctx.ctrl.transfer
  let max = maxBuffer(ctx)

  if gpath(ctx.point, "response", "binary").asBool == true {
    result.body = .noval
    if let transfer = transfer, transfer.entries["direction"]?.asString == "read" {
      let bytes = try readBounded(ctx, ctx.response, max, "binary_too_large")
      transfer.entries["bytes"] = .nat(bytes)
    }
    return
  }

  let bytes = try readBounded(ctx, ctx.response, max, "response_too_large")
  var text = String(decoding: bytes, as: UTF8.self)
  if text.hasPrefix("\u{FEFF}") {
    text.removeFirst()
  }
  let body = VMap()
  body.entries[rawBodyKey] = .string(text)
  result.body = .map(body)
}
