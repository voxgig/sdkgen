// ProjectNameEntityBase - shared entity behaviour: construction, data/match
// state (with feature hooks), the operation pipeline (runOp) and default
// unsupported-op implementations of every CRUD method. Generated entity
// classes derive from this and override the operations their API defines.

import Foundation

open class ProjectNameEntityBase: Entity {
  var name: String
  var client: ProjectNameSDK
  var utility: Utility
  var entopts: VMap
  var data = VMap()
  var match = VMap()
  var entctx: Context!

  public init(_ client: ProjectNameSDK, _ entoptsIn: VMap?, _ name: String) {
    let entopts = entoptsIn ?? VMap()
    if entopts.entries["active"] == nil {
      entopts.entries["active"] = .bool(true)
    } else if entopts.entries["active"] != .bool(false) {
      entopts.entries["active"] = .bool(true)
    }

    self.name = name
    self.client = client
    self.utility = client.getUtility()
    self.entopts = entopts

    self.entctx = utility.makeContext(["entity": self, "entopts": entopts], client.getRootCtx())

    utility.featureHook(entctx, "PostConstructEntity")
  }

  public func getName() -> String { name }

  open func make() -> Entity {
    return ProjectNameEntityBase(client, cloneOpts(), name)
  }

  func cloneOpts() -> VMap {
    let m = VMap()
    for (k, v) in entopts.entries { m.entries[k] = v }
    return m
  }

  @discardableResult
  public func data(_ newdata: Value?) -> Value {
    if let nd = newdata, !isNil(nd) {
      data = clone(nd).asMap ?? VMap()
      utility.featureHook(entctx, "SetData")
    }
    utility.featureHook(entctx, "GetData")
    return clone(.map(data))
  }

  @discardableResult
  public func matchv(_ newmatch: Value?) -> Value {
    if let nm = newmatch, !isNil(nm) {
      match = clone(nm).asMap ?? VMap()
      utility.featureHook(entctx, "SetMatch")
    }
    utility.featureHook(entctx, "GetMatch")
    return clone(.map(match))
  }

  open func load(_ reqmatch: VMap?, _ ctrl: VMap?) throws -> Value {
    throw unsupportedOp("load", name)
  }

  open func list(_ reqmatch: VMap?, _ ctrl: VMap?) throws -> Value {
    throw unsupportedOp("list", name)
  }

  open func create(_ reqdata: VMap?, _ ctrl: VMap?) throws -> Value {
    throw unsupportedOp("create", name)
  }

  open func update(_ reqdata: VMap?, _ ctrl: VMap?) throws -> Value {
    throw unsupportedOp("update", name)
  }

  open func remove(_ reqmatch: VMap?, _ ctrl: VMap?) throws -> Value {
    throw unsupportedOp("remove", name)
  }

  func runOp(_ ctx: Context, _ postDone: () -> Void) throws -> Value {
    // #PrePoint-Hook

    do {
      let point = try utility.makePoint(ctx)
      ctx.out["point"] = point
    } catch {
      return try utility.makeError(ctx, error)
    }

    // #PreSpec-Hook

    do {
      let spec = try utility.makeSpec(ctx)
      ctx.out["spec"] = spec
    } catch {
      return try utility.makeError(ctx, error)
    }

    // #PreRequest-Hook

    do {
      let resp = try utility.makeRequest(ctx)
      ctx.out["request"] = resp
    } catch {
      return try utility.makeError(ctx, error)
    }

    // #PreResponse-Hook

    do {
      let resp2 = try utility.makeResponse(ctx)
      ctx.out["response"] = resp2
    } catch {
      return try utility.makeError(ctx, error)
    }

    // #PreResult-Hook

    do {
      let result = try utility.makeResult(ctx)
      ctx.out["result"] = result
    } catch {
      return try utility.makeError(ctx, error)
    }

    // #PreDone-Hook

    postDone()

    return try utility.done(ctx)
  }
}
