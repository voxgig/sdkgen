// ProjectName SDK codec: form - an application/x-www-form-urlencoded body.

import Foundation

private let formMedia = "application/x-www-form-urlencoded"

private let formHex = Array("0123456789ABCDEF")

// Alphanumerics and `*-._` as they are, a space as `+`, every other byte as %HH.
func formEscape(_ bytes: Data) -> String {
  var out = ""
  for byte in bytes {
    if (0x30...0x39).contains(byte) || (0x41...0x5a).contains(byte) || (0x61...0x7a).contains(byte)
      || byte == 0x2a || byte == 0x2d || byte == 0x2e || byte == 0x5f
    {
      out.append(Character(UnicodeScalar(byte)))
    } else if byte == 0x20 {
      out.append("+")
    } else {
      out.append("%")
      out.append(formHex[Int(byte >> 4)])
      out.append(formHex[Int(byte & 15)])
    }
  }
  return out
}

func encodeForm(_ ctx: Context, _ data: Value, _ lifted: VMap) throws -> (media: String, body: Value) {
  let body = gp(ctx.point, "body")
  var pairs: [String] = []

  for item in bodyItems(body, data, lifted) {
    pairs.append(formEscape(Data(item.name.utf8)) + "=" + formEscape(toBytes(item.value)))
  }

  let declared = gp(body, "media").asString ?? ""
  return (media: declared.isEmpty ? formMedia : declared, body: .string(pairs.joined(separator: "&")))
}
