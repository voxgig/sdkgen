// ProjectName SDK utility: the operation pipeline stages - point resolution,
// spec/url/fetchdef construction, transport request, and response/result
// shaping.

import Foundation

func makePointUtil(_ ctx: Context) throws -> VMap? {
  if let stored = ctx.out["point"], let sp = stored {
    // A PrePoint feature hook (e.g. rbac) may short-circuit the operation by
    // storing an error here; surface it before any endpoint resolution.
    if let err = sp as? Error { throw err }
    if let tm = sp as? VMap { ctx.point = tm; return tm }
  }

  let op = ctx.op!
  let options = ctx.options

  let allowOp = gpath(options, "allow", "op").asString ?? ""
  if !allowOp.contains(op.name) {
    throw ctx.makeError("point_op_allow",
      "Operation \"\(op.name)\" not allowed by SDK option allow.op value: \"\(allowOp)\"")
  }

  if op.points.isEmpty {
    throw ctx.makeError("point_no_points",
      "Operation \"\(op.name)\" has no endpoint definitions.")
  }

  if op.points.count == 1 {
    ctx.point = op.points[0]
  } else {
    let reqselector: VMap
    let selector: VMap
    if op.input == "data" {
      reqselector = ctx.reqdata
      selector = ctx.data
    } else {
      reqselector = ctx.reqmatch
      selector = ctx.match
    }

    var point: VMap? = nil
    for candidate in op.points {
      point = candidate
      let selectDef = gp(candidate, "select").asMap
      var found = true

      if let selectDef = selectDef {
        if let existList = gp(selectDef, "exist").asList {
          for ek in existList.items {
            let existkey = ek.asString ?? ""
            let rv = getprop(.map(reqselector), .string(existkey))
            let sv = getprop(.map(selector), .string(existkey))
            if isNil(rv) && isNil(sv) { found = false; break }
          }
        }
      }

      if found {
        let reqAction = gp(reqselector, "$action")
        let selectAction = gp(selectDef == nil ? .noval : .map(selectDef!), "$action")
        if reqAction != selectAction { found = false }
      }

      if found { break }
    }

    let reqAction = gp(reqselector, "$action")
    if !isNil(reqAction), let point = point {
      let pointSelect = gp(point, "select").asMap
      let pointAction = gp(pointSelect == nil ? .noval : .map(pointSelect!), "$action")
      if reqAction != pointAction {
        throw ctx.makeError("point_action_invalid",
          "Operation \"\(op.name)\" action \"\(stringify(reqAction))\" is not valid.")
      }
    }

    ctx.point = point
  }

  return ctx.point
}

func makeSpecUtil(_ ctx: Context) throws -> Spec {
  if let cached = ctx.out["spec"] as? Spec {
    ctx.spec = cached
    return cached
  }

  let options = ctx.options
  let utility = ctx.utility!

  let basev = gp(options, "base").asString ?? ""
  let prefix = gp(options, "prefix").asString ?? ""
  let suffix = gp(options, "suffix").asString ?? ""
  let parts = gp(ctx.point, "parts").asList

  let specmap = VMap()
  specmap.entries["base"] = .string(basev)
  specmap.entries["prefix"] = .string(prefix)
  specmap.entries["parts"] = parts == nil ? .noval : .list(parts!)
  specmap.entries["suffix"] = .string(suffix)
  specmap.entries["step"] = .string("start")

  ctx.spec = Spec(specmap)
  ctx.spec!.method = utility.prepareMethod(ctx)

  let allowMethod = gpath(options, "allow", "method").asString ?? ""
  if !allowMethod.contains(ctx.spec!.method) {
    throw ctx.makeError("spec_method_allow",
      "Method \"\(ctx.spec!.method)\" not allowed by SDK option allow.method value: \"\(allowMethod)\"")
  }

  ctx.spec!.params = utility.prepareParams(ctx)
  ctx.spec!.query = utility.prepareQuery(ctx)
  ctx.spec!.headers = utility.prepareHeaders(ctx)
  ctx.spec!.body = utility.prepareBody(ctx)
  ctx.spec!.path = utility.preparePath(ctx)

  if let explain = ctx.ctrl.explain {
    explain.entries["spec"] = .nat(ctx.spec!)
  }

  let spec = try utility.prepareAuth(ctx)
  ctx.spec = spec
  return spec
}

func makeUrlUtil(_ ctx: Context) throws -> String {
  guard let spec = ctx.spec else {
    throw ctx.makeError("url_no_spec", "Expected context spec property to be defined.")
  }
  guard let result = ctx.result else {
    throw ctx.makeError("url_no_result", "Expected context result property to be defined.")
  }

  var url = join(jtp(spec.base, spec.prefix, spec.path, spec.suffix), "/", true)
  let resmatch = VMap()

  for item in items(.map(spec.params)) {
    let key = item[0].asString ?? ""
    let val = item[1]
    if !isNil(val) {
      let pattern = "\\{" + escre(.string(key)) + "\\}"
      url = regexReplace(url, pattern, escurl(.string(stringify(val))))
      resmatch.entries[key] = val
    }
  }

  var qsep = "?"
  for item in items(.map(spec.query)) {
    let key = item[0].asString ?? ""
    let val = item[1]
    if !isNil(val) {
      url += qsep + escurl(.string(key)) + "=" + escurl(.string(stringify(val)))
      qsep = "&"
      resmatch.entries[key] = val
    }
  }

  result.resmatch = resmatch
  return url
}

func makeFetchDefUtil(_ ctx: Context) throws -> VMap {
  guard let spec = ctx.spec else {
    throw ctx.makeError("fetchdef_no_spec", "Expected context spec property to be defined.")
  }

  if ctx.result == nil { ctx.result = Result(nil) }

  spec.step = "prepare"

  let url = try ctx.utility!.makeUrl(ctx)
  spec.url = url

  let fetchdef = VMap()
  fetchdef.entries["url"] = .string(url)
  fetchdef.entries["method"] = .string(spec.method)
  fetchdef.entries["headers"] = .map(spec.headers)

  if !isNil(spec.body) {
    if spec.body.isMap {
      fetchdef.entries["body"] = .string(jsonify(spec.body, indent: 0))
    } else {
      fetchdef.entries["body"] = spec.body
    }
  }

  return fetchdef
}

func makeRequestUtil(_ ctx: Context) throws -> Response {
  if let cached = ctx.out["request"] as? Response { return cached }

  let utility = ctx.utility!

  var response = Response(nil)
  let result = Result(nil)
  ctx.result = result

  guard let spec = ctx.spec else {
    throw ctx.makeError("request_no_spec", "Expected context spec property to be defined.")
  }

  let fetchdef: VMap
  do {
    fetchdef = try utility.makeFetchDef(ctx)
  } catch {
    response.err = error
    ctx.response = response
    spec.step = "postrequest"
    return response
  }

  if let explain = ctx.ctrl.explain {
    explain.entries["fetchdef"] = .map(fetchdef)
  }

  spec.step = "prerequest"

  let url = gp(fetchdef, "url").asString ?? ""

  var fetched: Value = .noval
  var fetchErr: Error? = nil
  do {
    fetched = try utility.fetcher(ctx, url, fetchdef)
  } catch {
    fetchErr = error
  }

  if let fe = fetchErr {
    response.err = fe
  } else if isNil(fetched) {
    let m = VMap()
    m.entries["err"] = .nat(ctx.makeError("request_no_response", "response: undefined"))
    response = Response(m)
  } else if let fm = fetched.asMap {
    response = Response(fm)
  } else {
    response.err = ctx.makeError("request_invalid_response", "response: invalid type")
  }

  spec.step = "postrequest"
  ctx.response = response
  return response
}

func makeResponseUtil(_ ctx: Context) throws -> Response {
  if let cached = ctx.out["response"] as? Response { return cached }

  let utility = ctx.utility!

  guard let spec = ctx.spec else {
    throw ctx.makeError("response_no_spec", "Expected context spec property to be defined.")
  }
  guard let response = ctx.response else {
    throw ctx.makeError("response_no_response", "Expected context response property to be defined.")
  }
  guard let result = ctx.result else {
    throw ctx.makeError("response_no_result", "Expected context result property to be defined.")
  }

  spec.step = "response"

  _ = utility.resultBasic(ctx)
  _ = utility.resultHeaders(ctx)
  _ = utility.resultBody(ctx)
  _ = utility.transformResponse(ctx)

  if result.err == nil {
    result.ok = true
  }

  if let explain = ctx.ctrl.explain {
    explain.entries["result"] = .nat(result)
  }

  return response
}

func makeResultUtil(_ ctx: Context) throws -> Result {
  if let cached = ctx.out["result"] as? Result { return cached }

  let op = ctx.op!
  let entity = ctx.entity

  guard let spec = ctx.spec else {
    throw ctx.makeError("result_no_spec", "Expected context spec property to be defined.")
  }
  guard let result = ctx.result else {
    throw ctx.makeError("result_no_result", "Expected context result property to be defined.")
  }

  spec.step = "result"

  _ = ctx.utility!.transformResponse(ctx)

  if op.name == "list" {
    let resdata = result.resdata
    result.resdata = .list([])

    if let list = resdata.asList, list.items.count > 0, let entity = entity {
      let entities = VList()
      for entry in list.items {
        let ent = entity.make()
        if let entryMap = entry.asMap {
          ent.data(.map(entryMap))
        }
        entities.items.append(.nat(ent))
      }
      result.resdata = .list(entities)
    }
  }

  if let explain = ctx.ctrl.explain {
    explain.entries["result"] = .nat(result)
  }

  return result
}
