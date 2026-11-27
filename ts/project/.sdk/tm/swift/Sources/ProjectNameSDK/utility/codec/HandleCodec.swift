// ProjectName SDK codec: handle - an entity's named bytes.

import Foundation

// Each call is one run of the entity's own operation on the slot's point; in
// core only whole, in-memory bodies move.
public final class BinaryHandle<E: ProjectNameEntityBase> {
  // What the entity component derived from the model: the action whose points
  // move the slot's bytes ("" for the entity's own), and the operations that
  // read and write them.
  public typealias Slot = (action: String, read: String?, write: String?)

  private let entity: E
  private let entctx: Context
  private let slot: String
  private let def: Slot?

  public init(_ entity: E, _ entctx: Context, _ slots: [String: Slot], _ slot: String? = nil) {
    self.entity = entity
    self.entctx = entctx
    self.slot = slot ?? ""
    self.def = slots[slot ?? ""]
  }

  public var name: String { slot }

  // The whole body, within maxBuffer.
  public func bytes(_ opts: VMap? = nil, _ ctrl: VMap? = nil) throws -> Data {
    if let range = opts?.entries["range"], !isNil(range) {
      throw inactive("read a range")
    }
    let def = try direction("read")
    let transfer = vm(("slot", .string(slot)), ("direction", .string("read")))
    _ = try run(def.read ?? "", select(def), withTransfer(ctrl, transfer))
    return bytesOf(transfer.entries["bytes"] ?? .noval) ?? Data()
  }

  // Sends in-memory content as the slot's body; resolves to the entity.
  @discardableResult
  public func put(_ source: Any, _ ctrl: VMap? = nil) throws -> E {
    let def = try direction("write")
    let transfer = vm(("slot", .string(slot)), ("direction", .string("write")))
    let reqdata = select(def)
    if let value = source as? Value {
      reqdata.entries[rawBodyKey] = value
    } else if let text = source as? String {
      reqdata.entries[rawBodyKey] = .string(text)
    } else {
      reqdata.entries[rawBodyKey] = .nat(source)
    }
    _ = try run(def.write ?? "", reqdata, withTransfer(ctrl, transfer))
    return entity
  }

  public func save(_ args: Any...) throws -> Never {
    throw inactive("save")
  }

  public func stream(_ args: Any...) throws -> Never {
    throw inactive("stream")
  }

  public func open(_ args: Any...) throws -> Never {
    throw inactive("open")
  }

  private func run(_ op: String, _ args: VMap, _ ctrl: VMap) throws -> Value {
    switch op {
    case "load": return try entity.load(args, ctrl)
    case "create": return try entity.create(args, ctrl)
    case "update": return try entity.update(args, ctrl)
    case "patch": return try entity.patch(args, ctrl)
    default: throw unsupportedOp(op, entity.getName())
    }
  }

  private func withTransfer(_ ctrl: VMap?, _ transfer: VMap) -> VMap {
    let merged = ctrl.map { VMap($0.entries) } ?? VMap()
    merged.entries["transfer"] = .map(transfer)
    return merged
  }

  private func select(_ def: Slot) -> VMap {
    return def.action.isEmpty ? VMap() : vm(("$action", .string(def.action)))
  }

  private func direction(_ way: String) throws -> Slot {
    guard let def = def else {
      throw entctx.makeError("binary_slot_unknown",
        "Entity \"\(entity.getName())\" has no binary slot \"\(slot)\".")
    }
    if (way == "read" ? def.read : def.write) == nil {
      throw entctx.makeError("binary_slot_direction",
        "The binary slot \"\(slot)\" of entity \"\(entity.getName())\" cannot be " +
        (way == "read" ? "read" : "written") + ".")
    }
    return def
  }

  private func inactive(_ what: String) -> ProjectNameError {
    return entctx.makeError("binary_feature_inactive",
      "The binary slot \"\(slot)\" of entity \"\(entity.getName())\" cannot \(what) " +
      "without the binary feature; in core it answers bytes() and put().")
  }
}
