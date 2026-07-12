// ProjectName SDK utility: makeError - the single error surface of the
// pipeline. Throws the wrapped ProjectNameError unless the per-call ctrl
// disables throwing (ctrl.throw == false), in which case it returns the
// (possibly nil) result data instead.

import Foundation

func makeErrorUtil(_ ctx: Context, _ err: Error?) throws -> Value {
  let op = ctx.op ?? Operation(VMap())
  var opname = op.name
  if opname == "" || opname == "_" {
    opname = "unknown operation"
  }

  let result = ctx.result ?? Result(nil)
  result.ok = false

  var e = err
  if e == nil { e = result.err }
  if e == nil { e = ctx.makeError("unknown", "unknown error") }

  let errmsg = errMessage(e!)
  var msg = "ProjectNameSDK: " + opname + ": " + errmsg
  msg = cleanUtil(ctx, .string(msg)).asString ?? msg

  result.err = nil

  let spec = ctx.spec

  if let explain = ctx.ctrl.explain {
    let em = VMap()
    em.entries["message"] = .string(msg)
    explain.entries["err"] = .map(em)
  }

  let code = (e as? ProjectNameError)?.code ?? ""
  let sdkErr = ProjectNameError(code, msg, ctx)
  sdkErr.resultVal = cleanUtil(ctx, .nat(result))
  sdkErr.specVal = spec == nil ? .noval : cleanUtil(ctx, .nat(spec!))

  ctx.ctrl.err = sdkErr

  if ctx.ctrl.throwErr == false {
    return result.resdata
  }

  throw sdkErr
}
