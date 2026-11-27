// ProjectName SDK - file content a caller hands the SDK.

import Foundation

// Held as given. A string is content, sent as its UTF-8: nothing here reads
// a path. In the data it travels as a native value: `.nat(source)`.
public final class BinarySource: CustomStringConvertible {
  public let kind = "bytes"
  public let data: Data
  public let name: String?
  public let type: String?

  init(_ data: Data, _ name: String?, _ type: String?) {
    self.data = data
    self.name = name
    self.type = (type?.isEmpty ?? true) ? nil : type
  }

  public var size: Int { data.count }

  // Static, not a client member: an entity named binary owns the client's Binary.
  public static func bytes(_ data: Data, name: String? = nil, type: String? = nil) -> BinarySource {
    return BinarySource(data, name, type)
  }

  public static func bytes(_ data: [UInt8], name: String? = nil, type: String? = nil) -> BinarySource {
    return BinarySource(Data(data), name, type)
  }

  public static func bytes(_ text: String, name: String? = nil, type: String? = nil) -> BinarySource {
    return BinarySource(Data(text.utf8), name, type)
  }

  // A source serialised anywhere is described, never copied.
  public func describe() -> VMap {
    let desc = VMap()
    desc.entries["binary$"] = .string("bytes")
    desc.entries["size"] = .int(Int64(size))
    if let type = type {
      desc.entries["type"] = .string(type)
    }
    return desc
  }

  public var description: String { jsonify(.map(describe()), indent: 0) }
}
