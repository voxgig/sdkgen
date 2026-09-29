// ProjectName SDK utility: result shaping (status/error, headers, body) and
// request/response transforms; plus clean + done.

import Foundation

func resultBasicUtil(_ ctx: Context) -> Result {
  let response = ctx.response
  let result = ctx.result

  if let result = result, let response = response {
    result.status = response.status
    result.statusText = response.statusText

    if result.status >= 400 {
      let msg = "request: \(result.status): \(result.statusText)"
      if let e = result.err {
        result.err = ctx.makeError("request_status", errMessage(e) + ": " + msg)
      } else {
        result.err = ctx.makeError("request_status", msg)
      }
    } else if let re = response.err {
      result.err = re
    }
  }

  return result!
}

func resultBodyUtil(_ ctx: Context) -> Result {
  let response = ctx.response
  let result = ctx.result

  if let result = result {
    if let jf = response?.jsonFunc, let resp = response, !isNil(resp.body) {
      result.body = jf()
    }
  }

  return result!
}

func resultHeadersUtil(_ ctx: Context) -> Result {
  let response = ctx.response
  let result = ctx.result

  if let result = result {
    if let hm = response?.headers.asMap {
      result.headers = hm
    } else {
      result.headers = VMap()
    }
  }

  return result!
}

// `$action` selects the point (see makePointUtil); it is never an API field,
// so the body is a copy without it. The caller's map is left untouched.
private func stripAction(_ reqdata: Value) -> Value {
  return omitKeys(reqdata, ["$action"])
}

// A header argument travels as a header, which prepareHeadersUtil sends, so
// the body is built from the request data without it.
private func headerArgNames(_ ctx: Context) -> [String] {
  guard let ahl = gpath(ctx.point, "args", "header").asList else { return [] }
  return ahl.items.compactMap { hd in
    guard let name = gp(hd, "name").asString, !name.isEmpty else { return nil }
    return name
  }
}

private func omitKeys(_ reqdata: Value, _ names: [String]) -> Value {
  guard let src = reqdata.asMap, names.contains(where: { src.entries[$0] != nil }) else {
    return reqdata
  }
  let body = VMap()
  for (key, val) in src.entries where !names.contains(key) {
    body.entries[key] = val
  }
  return .map(body)
}

func transformRequestUtil(_ ctx: Context) -> Value {
  if let sp = ctx.spec { sp.step = "reqform" }

  let reqdata = omitKeys(.map(ctx.reqdata), headerArgNames(ctx))

  guard let tfm = gp(ctx.point, "transform").asMap else { return stripAction(reqdata) }
  let reqform = gp(tfm, "req")
  if isNil(reqform) { return stripAction(reqdata) }

  return stripAction(transform(.map(vm(("reqdata", reqdata))), reqform))
}

func transformResponseUtil(_ ctx: Context) -> Value {
  if let sp = ctx.spec { sp.step = "resform" }

  guard let result = ctx.result, result.ok else { return .noval }

  guard let tfm = gp(ctx.point, "transform").asMap else { return .noval }
  let resform = gp(tfm, "res")
  if isNil(resform) { return .noval }

  let dataMap = vm(
    ("ok", .bool(result.ok)),
    ("status", .int(Int64(result.status))),
    ("statusText", .string(result.statusText)),
    ("headers", .map(result.headers)),
    ("body", result.body),
    ("err", result.err == nil ? .noval : .nat(result.err!)),
    ("resdata", result.resdata),
    ("resmatch", result.resmatch == nil ? .noval : .map(result.resmatch!))
  )

  let resdata = transform(.map(dataMap), resform)
  result.resdata = resdata
  return resdata
}

func cleanUtil(_ ctx: Context, _ val: Value) -> Value {
  return val
}

func doneUtil(_ ctx: Context) throws -> Value {
  if let explain = ctx.ctrl.explain,
    let rm = explain.entries["result"]?.asMap {
    rm.entries.removeValue(forKey: "err")
  }

  if let result = ctx.result, result.ok {
    return result.resdata
  }

  return try makeErrorUtil(ctx, nil)
}
