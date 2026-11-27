// ProjectName SDK utility: binary - the sources a request's binary fields
// carry, lifted out of its data, and the items a form or multipart body sends.

import Foundation

private let binaryMaxDepth = 32

// Bytes the data carries as a native value. The array is matched by its
// exact type: an empty array of any element casts to an empty [UInt8].
func bytesOf(_ value: Value) -> Data? {
  guard let any = value.asNative else { return nil }
  if let data = any as? Data { return data }
  if type(of: any) == [UInt8].self, let bytes = any as? [UInt8] { return Data(bytes) }
  return nil
}

func toBytes(_ value: Value) -> Data {
  if let source = value.asNative as? BinarySource { return source.data }
  if let data = bytesOf(value) { return data }
  return Data(itemText(value).utf8)
}

// A plain value as the text of a form pair or a multipart part.
func itemText(_ value: Value) -> String {
  switch value {
  case .string(let text): return text
  case .bool(let flag): return flag ? "true" : "false"
  case .int(let n): return String(n)
  case .double(let d): return JSON.formatDouble(d)
  case .native(let ref):
    if let source = ref.value as? BinarySource { return source.description }
    return JSON.stringify(value, indent: 0)
  default: return JSON.stringify(value, indent: 0)
  }
}

// The path of the first source in a value, or nil.
private func sourceAt(_ value: Value, _ path: String, _ depth: Int, _ seen: inout [ObjectIdentifier])
  -> String?
{
  if binaryMaxDepth <= depth { return nil }
  switch value {
  case .native(let ref):
    return ref.value is BinarySource ? path : nil
  case .map(let m):
    if seen.contains(ObjectIdentifier(m)) { return nil }
    seen.append(ObjectIdentifier(m))
    for (key, item) in m.entries {
      if let found = sourceAt(item, path.isEmpty ? key : path + "." + key, depth + 1, &seen) {
        return found
      }
    }
    return nil
  case .list(let l):
    if seen.contains(ObjectIdentifier(l)) { return nil }
    seen.append(ObjectIdentifier(l))
    for (i, item) in l.items.enumerated() {
      let key = String(i)
      if let found = sourceAt(item, path.isEmpty ? key : path + "." + key, depth + 1, &seen) {
        return found
      }
    }
    return nil
  default:
    return nil
  }
}

// The data keys whose values are file content: a multipart or form body's
// binary fields, and the whole of a raw body.
func binaryNames(_ point: VMap?) -> [String] {
  let body = gp(point, "body")
  let kind = gp(body, "kind").asString
  if kind == "raw" {
    return [rawBodyKey]
  }
  guard kind == "multipart" || kind == "form", let fields = gp(body, "fields").asList else {
    return []
  }
  return fields.items.compactMap { field in
    gp(field, "binary").asBool == true ? gp(field, "name").asString : nil
  }
}

// Moves the values of binary fields out of the request data, before a hook,
// a transform, validation or clean reads it. A source anywhere else is refused.
func liftSources(_ ctx: Context) throws {
  if ctx.sources != nil { return }

  let names = binaryNames(ctx.point)
  let lifted = VMap()
  var reqdata = ctx.reqdata

  if names.contains(where: { reqdata.entries[$0] != nil }) {
    reqdata = VMap(reqdata.entries)
    for name in names {
      if let value = reqdata.entries.removeValue(forKey: name) {
        lifted.entries[name] = value
      }
    }
  }

  var seen: [ObjectIdentifier] = []
  var stray = sourceAt(.map(reqdata), "", 0, &seen)
  if stray == nil {
    seen = []
    stray = sourceAt(.map(ctx.reqmatch), "", 0, &seen)
  }
  if let stray = stray {
    throw ctx.makeError("binary_source_refused", "A binary source was passed in \"" + stray +
      "\", which is not a field the operation declares binary.")
  }

  ctx.reqdata = reqdata
  ctx.sources = lifted
}

// A response the model declares to be bytes is read only through the entity's
// binary handle, never into its data.
func bytesRefused(_ ctx: Context) throws {
  let response = gp(ctx.point, "response")
  guard gp(response, "kind").asString == "raw", gp(response, "binary").asBool == true,
    ctx.ctrl.transfer == nil
  else {
    return
  }
  let action = gpath(ctx.point, "select", "$action").asString
  let call = action.map { "binary(\"" + $0 + "\")" } ?? "binary()"
  throw ctx.makeError("binary_sink_required", "Operation \"" + (ctx.op?.name ?? "") +
    "\" on entity \"" + (ctx.op?.entity ?? "") + "\" answers bytes, which never enter the " +
    "entity's data: read them with entity." + call + ".bytes().")
}

// The values a form or multipart body carries, in wire order: the fields the
// model declares, in its order, then any other key of the data, in code unit
// order. A list repeats its field per item, or is one value joined by the
// field's `join`; an absent or null value sends nothing.
func bodyItems(_ body: Value, _ data: Value, _ lifted: VMap)
  -> [(name: String, field: VMap, value: Value, binary: Bool)]
{
  let fields: [VMap] = (gp(body, "fields").asList?.items ?? [])
    .compactMap { $0.asMap }
    .filter { gp($0, "name").asString != nil }
  let declared = fields.map { gp($0, "name").asString ?? "" }
  let plain = data.asMap ?? VMap()

  let rest = plain.entries.keys.filter { !declared.contains($0) }
    .sorted { Array($0.utf16).lexicographicallyPrecedes(Array($1.utf16)) }
  let names = declared.filter { plain.entries[$0] != nil || lifted.entries[$0] != nil } + rest

  var items: [(name: String, field: VMap, value: Value, binary: Bool)] = []
  for name in names {
    let field = fields.first { gp($0, "name").asString == name } ?? vm(("name", .string(name)))
    let value = lifted.entries[name] ?? plain.entries[name] ?? Value.noval
    let file = gp(field, "binary").asBool == true
    if isNil(value) {
      continue
    }
    if let list = value.asList {
      let present = list.items.filter { !isNil($0) }
      if !file, let join = gp(field, "join").asString {
        items.append((name: name, field: field, value: .string(present.map(itemText).joined(separator: join)),
          binary: file))
      } else {
        for item in present {
          items.append((name: name, field: field, value: item, binary: file))
        }
      }
    } else {
      items.append((name: name, field: field, value: value, binary: file))
    }
  }
  return items
}
