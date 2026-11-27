// ProjectName SDK codec: multipart - a multipart/form-data body.

import Foundation

private let multipartMedia = "multipart/form-data"

private let octetMedia = "application/octet-stream"

private let crlf = "\r\n"

func multipartBoundaryUtil(_ ctx: Context) -> String {
  var generator = SystemRandomNumberGenerator()
  return (0..<16).map { _ -> String in
    let hex = String(UInt8.random(in: 0...255, using: &generator), radix: 16)
    return hex.count == 1 ? "0" + hex : hex
  }.joined()
}

// Inside a quoted header parameter nothing may end the quote or the line.
func quotedParam(_ text: String) -> String {
  return text.replacingOccurrences(of: "\\", with: "%5C")
    .replacingOccurrences(of: "\"", with: "%22")
    .replacingOccurrences(of: "\r", with: "%0D")
    .replacingOccurrences(of: "\n", with: "%0A")
}

// A local path never leaves: only its last segment, and nothing for an empty one.
func baseName(_ name: String?) -> String? {
  guard let name = name else { return nil }
  let base = name.split(separator: "/", omittingEmptySubsequences: false).last
    .map(String.init) ?? ""
  let last = base.split(separator: "\\", omittingEmptySubsequences: false).last
    .map(String.init) ?? ""
  return last.isEmpty ? nil : last
}

func encodeMultipart(_ ctx: Context, _ data: Value, _ lifted: VMap) throws
  -> (media: String, body: Value)
{
  let body = gp(ctx.point, "body")
  let boundary = (ctx.utility?.multipartBoundary ?? multipartBoundaryUtil)(ctx)
  var out = Data()

  for item in bodyItems(body, data, lifted) {
    var filename: String? = nil
    var type: String? = gp(item.field, "media").asString
    if item.binary {
      if let source = item.value.asNative as? BinarySource {
        filename = baseName(source.name)
        type = source.type ?? type
      }
      type = type ?? octetMedia
    }

    // By scalar: a CRLF pair is one Character, equal to neither CR nor LF.
    if let type = type, type.unicodeScalars.contains(where: { $0 == "\r" || $0 == "\n" }) {
      throw ctx.makeError("binary_source_refused", "The media type of the multipart field \"" +
        item.name + "\" contains a line break.")
    }

    var head = "--" + boundary + crlf + "Content-Disposition: form-data; name=\"" +
      quotedParam(item.name) + "\""
    if let filename = filename {
      head += "; filename=\"" + quotedParam(filename) + "\""
    }
    head += crlf
    if let type = type {
      head += "Content-Type: " + type + crlf
    }
    head += crlf

    out.append(Data(head.utf8))
    out.append(toBytes(item.value))
    out.append(Data(crlf.utf8))
  }

  out.append(Data(("--" + boundary + "--" + crlf).utf8))

  let declared = (gp(body, "media").asString ?? "").split(separator: ";", maxSplits: 1,
    omittingEmptySubsequences: false).first.map(String.init)?
    .trimmingCharacters(in: .whitespaces) ?? ""
  return (media: (declared.isEmpty ? multipartMedia : declared) + "; boundary=" + boundary,
    body: .nat(out))
}
