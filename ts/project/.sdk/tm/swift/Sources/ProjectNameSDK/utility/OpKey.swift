// ProjectName SDK utility: opKeys - the keys an operation is looked up and
// filed by.

import Foundation

// The custom action a call names: `$action` in its own request argument,
// never in a response.
func opAction(_ ctx: Context) -> String? {
  let req: VMap = ctx.op?.input == "data" ? ctx.reqdata : ctx.reqmatch
  guard let action = gp(req, "$action").asString, action != "" else { return nil }
  return action
}

// Most specific first: `<entity>.<op>:<action>`, `<entity>.<op>`, `<op>`, `*`.
func opKeys(_ ctx: Context) -> [String] {
  let name = opKeyName(ctx)
  let base = opBaseKey(ctx)
  guard let action = opAction(ctx) else { return [base, name, "*"] }
  return [base + ":" + action, base, name, "*"]
}

// The name a call is filed under for a consumer to read: the first key, with
// its action cleaned as the `action` field of a record, so a sensitive key
// name masks it as well as a registered value.
func opFileKey(_ ctx: Context) -> String {
  guard let action = opAction(ctx) else { return opBaseKey(ctx) }
  guard let clean = ctx.utility?.clean,
    let cleaned = gp(clean(ctx, .map(vm(("action", .string(action))))), "action").asString
  else {
    return opBaseKey(ctx) + ":" + action
  }
  return opBaseKey(ctx) + ":" + cleaned
}

private func opKeyName(_ ctx: Context) -> String {
  if let opname = ctx.op?.name, opname != "" { return opname }
  return "_"
}

private func opBaseKey(_ ctx: Context) -> String {
  var entity = "_"
  if let opentity = ctx.op?.entity, opentity != "" {
    entity = opentity
  } else if let entname = ctx.entity?.getName(), entname != "" {
    entity = entname
  }
  return entity + "." + opKeyName(ctx)
}
