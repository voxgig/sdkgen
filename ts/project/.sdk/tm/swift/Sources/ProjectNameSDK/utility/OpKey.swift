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
  var name = "_"
  if let opname = ctx.op?.name, opname != "" { name = opname }
  var entity = "_"
  if let opentity = ctx.op?.entity, opentity != "" {
    entity = opentity
  } else if let entname = ctx.entity?.getName(), entname != "" {
    entity = entname
  }
  let base = entity + "." + name
  guard let action = opAction(ctx) else { return [base, name, "*"] }
  return [base + ":" + action, base, name, "*"]
}
