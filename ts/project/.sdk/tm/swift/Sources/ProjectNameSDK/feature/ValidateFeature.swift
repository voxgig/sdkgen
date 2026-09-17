// Payload validation against the model's own field types. The swift port of
// tm/ts/src/feature/validate/ValidateFeature.ts.
//
// The specs are NOT written here and not written in the model either: every
// entity field already carries a canonical type sentinel (`$STRING`,
// `$INTEGER`, the `$ONE` union for an OpenAPI multi-type), which is the same
// vocabulary `validate` speaks. The generator maps them once
// (helpers/canonSpec) and emits `SdkSchema.entityspec`, so a field whose type
// changes in the API spec changes what this feature enforces with no edit
// anywhere.
//
// WHAT IS CHECKED
//   outbound (preSpec)  the payload the caller asked to send, against
//                       spec.op[opname] - the operation's request shape.
//   inbound  (preDone)  each record the operation returned, against
//                       spec.data - the entity's own field types.
//
// WHAT IS NOT. The model carries no array element types, no nested object
// schemas, no enums, formats or bounds, so this checks the shape the model
// knows and nothing more.

import Foundation

// `.noval` (TS undefined) and `.null` both read as "absent" for the checks
// below; Value carries the two predicates separately, so this names the pair
// once rather than at each call site.
private extension Value {
  var isAbsent: Bool { isNoval || isNull }
}

public final class ValidateFeature: BaseFeature {
  private var client: ProjectNameSDK?
  private var options: VMap?
  private var spec: Value = .map(VMap())

  private var request = true
  private var response = false
  private var mode = "throw"

  // The `onInvalid` callback, set after construction: the model types it a
  // `$FUNCTION` and an option VMap parsed out of JSON cannot carry one.
  public var onInvalid: ((VMap) -> Void)?

  public override init() {
    super.init()
    version = "0.0.1"
    name = "validate"
    active = true
  }

  public override func initFeature(_ ctx: Context, _ options: VMap) {
    client = ctx.client
    self.options = options
    active = foptBool(options, "active", false)

    // DEFAULTS ARE APPLIED HERE, not by the option spec. The model's
    // `config.options` documents them and types them; it does not inject
    // them, because each feature entry in the spec is optional and struct
    // fills in nothing through an optional union. So every feature resolves
    // its own.
    request = foptBool(options, "request", true)
    response = foptBool(options, "response", false)

    // FAIL CLOSED. Only the exact string "report" selects report mode, so a
    // typo (`mode: "thow"`) still rejects rather than silently turning
    // enforcement off - the failure nobody would notice. The option spec
    // rejects the typo outright; this is what happens if it ever does not.
    mode = "report" == foptStr(options, "mode", "throw") ? "report" : "throw"

    // `strict` is applied ONCE, here, by rebuilding the spec tree without the
    // `$OPEN` markers - rather than per call, which would clone a spec for
    // every request an SDK ever makes. REBUILT, not mutated: SdkSchema's
    // entity spec is a static let every client in the process reads.
    spec = foptBool(options, "strict", false)
      ? ValidateFeature.close(SdkSchema.entityspec)
      : SdkSchema.entityspec
  }

  // Outbound. makeSpecUtil throws an Error left in ctx.out["spec"], so storing
  // the error here rejects the operation before the request is built - the
  // same seam rbac uses one stage earlier through ctx.out["point"].
  public override func preSpec(_ ctx: Context) {
    if !active || !request {
      return
    }

    let opname = ctx.op?.name ?? ""
    let opspec = gp(gp(entitySpec(ctx), "op"), opname)
    if opspec.isAbsent {
      return
    }

    let errs = check(ctx, payload(ctx, opname), opspec, "request")
    if errs.isEmpty || "report" == mode {
      return
    }

    ctx.out["spec"] = ctx.makeError("validate_failed",
      "Invalid " + opname + " request for entity \"" + entName(ctx) + "\": " +
        errs.joined(separator: "; "))
  }

  // Inbound. preDone rather than preResult: the records are extracted from the
  // response body by makeResult, which runs between the two, so at preResult
  // there is nothing to check but the envelope.
  //
  // HOOK ORDER MATTERS HERE, and the default order is not the one you want.
  // preDone hooks fire in feature ADD order, which defaults to `test` first and
  // then names sorted - and `validate` sorts last, after audit, cost, debug,
  // metrics and telemetry. Those observers therefore record the operation as a
  // success before this hook has looked at it. Activating features as an
  // ORDERED LIST fixes it.
  public override func preDone(_ ctx: Context) {
    if !active || !response {
      return
    }

    let dataspec = gp(entitySpec(ctx), "data")
    if dataspec.isAbsent {
      return
    }

    guard let result = ctx.result, !result.resdata.isAbsent else {
      return
    }

    // A list op returns many records and a load returns one; both are checked
    // against the same record spec, because they are the same entity.
    let records: [Value] = result.resdata.asList.map { $0.items } ?? [result.resdata]

    var errs: [String] = []
    for record in records {
      if record.isAbsent {
        continue
      }

      // A NON-OBJECT IS A FAILURE, not something to skip. A load that answered
      // 42 where the entity's spec wants a record must not pass this feature
      // silently - struct rejects it with the field it could not find.
      errs.append(contentsOf: check(ctx, ValidateFeature.unwrap(record), dataspec, "response"))
    }

    if errs.isEmpty || "report" == mode {
      return
    }

    let err = ctx.makeError("validate_failed",
      "Invalid response for entity \"" + entName(ctx) + "\": " +
        errs.joined(separator: "; "))

    // BOTH, and `ok` is the load-bearing half: done returns resdata whenever
    // result.ok is true and never looks at err, so setting the error alone
    // would hand the caller the very records that failed the spec.
    result.ok = false
    result.err = err

    // AND THE DATA GOES. The load/update paths copy result.resdata into the
    // entity's own state on any non-nil value, BEFORE done raises - so
    // rejecting the operation while leaving the records in place would leave
    // the caller holding an entity populated from a payload this feature had
    // just declared invalid.
    result.resdata = .noval
  }

  // The payload an operation is about to send.
  //
  // TWO SLOTS, AND THE OP PICKS. A body op (create/update/patch) carries the
  // caller's argument in `reqdata` over the entity's `data`; a match op
  // (load/list/remove) carries it in `reqmatch` over `match`. That is what the
  // entity operations pass to the context and what makePoint reads - so
  // reading `reqdata` for every op would check a `load(["id": ...])` against
  // the entity's STALE stored match and reject it for the id the caller had
  // just supplied.
  private func payload(_ ctx: Context, _ opname: String) -> Value {
    let body = "create" == opname || "update" == opname || "patch" == opname

    let base = body ? ctx.data : ctx.match
    let req = body ? ctx.reqdata : ctx.reqmatch

    let out = VMap()
    for src in [base, req] {
      for (k, v) in src.entries {
        out.entries[k] = v
      }
    }

    // `$action` SELECTS A CUSTOM ENDPOINT; it is not a field of the record.
    // makePoint reads it off this same argument and the request transformer
    // drops it before the body is built, so a spec built from the API's own
    // fields will never name it - and under `strict` every custom-action call
    // would be rejected for the one key that made it reachable.
    out.entries.removeValue(forKey: "$action")

    return .map(out)
  }

  private func entitySpec(_ ctx: Context) -> Value {
    gp(spec, entName(ctx))
  }

  private func entName(_ ctx: Context) -> String {
    if let name = ctx.entity?.getName(), !name.isEmpty {
      return name
    }
    return ctx.op?.entity ?? ""
  }

  // One validate call. Errors are COLLECTED, never thrown: `validate` raises
  // on the first failure unless given an `errs` list, and a caller fixing a
  // payload wants every problem with it, not the first one.
  private func check(_ ctx: Context, _ data: Value, _ spec: Value,
                     _ direction: String) -> [String] {
    let inj = Injection(val: .noval, parent: .noval)
    inj.errs = VList()
    _ = validate(data, spec, inj)

    let errs = inj.errs.items.map { $0.asString ?? stringify($0) }

    if !errs.isEmpty, let cb = onInvalid {
      // A callback receiving every failure, whatever `mode` does with it, so a
      // client can log or count invalid payloads without changing what the SDK
      // returns.
      let report = VMap()
      report.entries["entity"] = .string(entName(ctx))
      report.entries["op"] = .string(ctx.op?.name ?? "")
      report.entries["direction"] = .string(direction)
      report.entries["errs"] = .list(errs.map { Value.string($0) })
      report.entries["data"] = data
      cb(report)
    }

    return errs
  }

  // Built rather than written, so the backticks cannot be lost in an edit.
  private static let OPEN = String(UnicodeScalar(96)) + "$OPEN" + String(UnicodeScalar(96))

  // A RESULT RECORD AS DATA.
  //
  // makeResult turns every record of a LIST into an entity instance held in a
  // `.native` node, so what reaches preDone for a list is wrappers, not
  // records - and a wrapper checked against a field spec fails on every
  // required field while its actual data goes unchecked. A load returns the
  // record itself, so this handles both.
  private static func unwrap(_ record: Value) -> Value {
    if let ent = record.asNative as? Entity {
      let data = ent.data()
      if !data.isAbsent {
        return data
      }
    }
    return record
  }

  // The spec tree with every `$OPEN` marker removed, so an undeclared key is
  // an error rather than a pass. Rebuilt rather than mutated: SdkSchema's
  // entity spec is shared by every client in the process.
  private static func close(_ node: Value) -> Value {
    if let list = node.asList {
      return .list(list.items.map { close($0) })
    }

    if let map = node.asMap {
      let out = VMap()
      for (k, v) in map.entries where k != OPEN {
        out.entries[k] = close(v)
      }
      return .map(out)
    }

    return node
  }
}
