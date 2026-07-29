/- ProjectName SDK request-shaping utilities (the primary utility layer).

   These are the language-neutral pipeline utilities the shared test corpus
   (.sdk/test/test.json, section `primary`) exercises in every target. The
   context is a struct `Value` map: heap-backed and reference-stable, so the
   utilities mutate it in place exactly as the IORef/pointer-based donors do,
   and nested `ctx.spec` / `ctx.result` handles stay live across calls. -/

import VoxgigStruct
import SdkJson

open VoxgigStruct

namespace SdkUtility

-- ---------------------------------------------------------------------------
-- Value helpers
-- ---------------------------------------------------------------------------

def gp (v : Value) (k : String) : SIO Value := getprop v (.str k) .noval

def sp (v : Value) (k : String) (x : Value) : SIO Unit := do
  let _ ← setprop v (.str k) x

def dp (v : Value) (k : String) : SIO Unit := do
  let _ ← delprop v (.str k)

def vs : Value → String
  | .str s => s
  | _ => ""

def isNov : Value → Bool
  | .noval => true
  | _ => false

def isMapV : Value → Bool
  | .map _ => true
  | _ => false

def truthy : Value → Bool
  | .bool b => b
  | _ => false

def gpS (v : Value) (k : String) : SIO String := do pure (vs (← gp v k))

/-- Field as a map, creating AND attaching an empty map when absent. -/
def gpMap (v : Value) (k : String) : SIO Value := do
  match (← gp v k) with
  | .map i => pure (.map i)
  | _ => do
    let m ← emptyMap
    sp v k m
    pure m

/-- A map view of a value (empty map when it is not a map); does not attach. -/
def asMap (v : Value) : SIO Value := do
  match v with
  | .map i => pure (.map i)
  | _ => emptyMap

/-- An SDK error value: a struct map tagged `__sdkerr__`. -/
def mkErr (code msg : String) : SIO Value :=
  newMap #[("__sdkerr__", .bool true), ("code", .str code), ("message", .str msg)]

def isErrV (v : Value) : SIO Bool := do
  match v with
  | .map _ => pure (truthy (← gp v "__sdkerr__"))
  | _ => pure false

-- ---------------------------------------------------------------------------
-- Operation naming
-- ---------------------------------------------------------------------------

def opMethodOf : String → String
  | "create" => "POST"
  | "update" => "PUT"
  | "remove" => "DELETE"
  | "patch"  => "PATCH"
  | _        => "GET"

def opInputOf : String → String
  | "create" => "data"
  | "update" => "data"
  | _        => "match"

/-- The operation name: `ctx.opname`, falling back to `ctx.op.name`. -/
def opnameOf (ctx : Value) : SIO String := do
  let n ← gpS ctx "opname"
  if n != "" then pure n
  else do gpS (← gp ctx "op") "name"

-- ---------------------------------------------------------------------------
-- makeOptions / makeContext / operator / makeError / done
-- ---------------------------------------------------------------------------

def defaultOptions : SIO Value := do
  let hdr ← newMap #[("content-type", .str "application/json")]
  let ent ← emptyMap
  newMap #[("base", .str "http://localhost:8000"), ("prefix", .str ""),
           ("suffix", .str ""), ("headers", hdr), ("entity", ent)]

/-- Defaults <- config.options <- options, then every entity gets an alias map. -/
def makeOptions (config options : Value) : SIO Value := do
  let base ← defaultOptions
  let copts ← asMap (← gp config "options")
  let uopts ← asMap options
  let parts ← newList #[base, copts, uopts]
  let out ← merge parts
  let ent ← gpMap out "entity"
  for k in (← keysof ent) do
    let e ← gp ent k
    match e with
    | .map _ =>
      match (← gp e "alias") with
      | .map _ => pure ()
      | _ => do
        let a ← emptyMap
        sp e "alias" a
    | _ => pure ()
  pure out

def makeContext (ctxmap : Value) : SIO Value := do
  let ctx ← if isMapV ctxmap then pure ctxmap else emptyMap
  let opname ← opnameOf ctx
  let op ← gpMap ctx "op"
  if (← gpS op "name") == "" then sp op "name" (.str opname)
  if (← gpS op "input") == "" then sp op "input" (.str (opInputOf opname))
  pure ctx

/-- The Operation record (entity/name/input/points) as a plain map. -/
def operator (inv : Value) : SIO Value := do
  let ent ← gp inv "entity"
  let nm ← gp inv "name"
  let inp ← gp inv "input"
  let pts ← match (← gp inv "points") with
    | .list i => pure (Value.list i)
    | _ => emptyList
  newMap #[("entity", ent), ("name", nm), ("input", inp), ("points", pts)]

def sdkNameOf (ctx : Value) : SIO String := do
  let cfg ← gp ctx "config"
  gpS (← gp cfg "main") "name"

/-- "<Name>SDK: <opname>: <message>", with the neutral fallbacks. -/
def makeError (ctx : Value) (errv : Value) : SIO Value := do
  let nm ← sdkNameOf ctx
  let opn ← opnameOf ctx
  let opname := if opn == "" then "unknown operation" else opn
  let m1 ← match errv with
    | .map _ => gpS errv "message"
    | _ => pure ""
  let rerr ← gp (← gp ctx "result") "err"
  let m2 ← match rerr with
    | .map _ => gpS rerr "message"
    | _ => pure ""
  let msg := if m1 != "" then m1 else if m2 != "" then m2 else "unknown error"
  mkErr "sdk_error" (nm ++ "SDK: " ++ opname ++ ": " ++ msg)

/-- Terminal step: the result payload, or the pipeline error. -/
def done (ctx : Value) : SIO (Value × Option Value) := do
  let res ← gp ctx "result"
  if truthy (← gp res "ok") then pure ((← gp res "resdata"), none)
  else do
    let e ← makeError ctx .noval
    pure (.noval, some e)

-- ---------------------------------------------------------------------------
-- param / prepare*
-- ---------------------------------------------------------------------------

/-- Resolve a parameter by name across reqmatch/match/reqdata/data, honouring
    the point's alias map (and recording the reverse alias on the spec). -/
def param (ctx : Value) (paramdef : Value) : SIO Value := do
  let point ← gp ctx "point"
  let specV ← gp ctx "spec"
  let mtch ← gp ctx "match"
  let reqmatch ← gp ctx "reqmatch"
  let dat ← gp ctx "data"
  let reqdata ← gp ctx "reqdata"
  let key ← match paramdef with
    | .str s => pure s
    | _ => gpS paramdef "name"
  let aliasV ← gp point "alias"
  let akey ← match aliasV with
    | .map _ => gpS aliasV key
    | _ => pure ""
  let v1 ← gp reqmatch key
  let v2 ← if isNov v1 then gp mtch key else pure v1
  let v3 ← if isNov v2 && akey != "" then do
      match specV with
      | .map _ => do
        let sa ← gpMap specV "alias"
        sp sa akey (.str key)
      | _ => pure ()
      gp reqmatch akey
    else pure v2
  let v4 ← if isNov v3 then gp reqdata key else pure v3
  let v5 ← if isNov v4 then gp dat key else pure v4
  if isNov v5 && akey != "" then do
    let a ← gp reqdata akey
    if isNov a then gp dat akey else pure a
  else pure v5

/-- Path params declared by the point's args, resolved through `param`. -/
def prepareParams (ctx : Value) : SIO Value := do
  let point ← gp ctx "point"
  let args ← gp point "args"
  let out ← emptyMap
  match (← gp args "params") with
  | .list i =>
    for pd in (← listItems i) do
      let v ← param ctx pd
      if !(isNov v) then do
        let nm ← match pd with
          | .str s => pure s
          | _ => gpS pd "name"
        if nm != "" then sp out nm v
  | _ => pure ()
  pure out

/-- Everything in reqmatch that is NOT a declared path param becomes query. -/
def prepareQuery (ctx : Value) : SIO Value := do
  let point ← gp ctx "point"
  let reqmatch ← asMap (← gp ctx "reqmatch")
  let names ← match (← gp point "params") with
    | .list i => do pure ((← listItems i).map vs)
    | _ => pure #[]
  let out ← emptyMap
  for k in (← keysof reqmatch) do
    let v ← gp reqmatch k
    if !(isNov v) && !(names.contains k) then sp out k v
  pure out

def preparePath (ctx : Value) : SIO String := do
  let point ← gp ctx "point"
  match (← gp point "parts") with
  | .list i => do
    let segs := (← listItems i).map vs
    pure ("/" ++ String.intercalate "/" segs.toList)
  | _ => pure ""

def prepareMethod (ctx : Value) : SIO String := do
  pure (opMethodOf (← opnameOf ctx))

def prepareHeaders (ctx : Value) : SIO Value := do
  let options ← gp ctx "options"
  match (← gp options "headers") with
  | .map i => clone (.map i)
  | _ => newMap #[("content-type", .str "application/json")]

/-- apikey (with the configured auth prefix) becomes the authorization header. -/
def prepareAuth (ctx : Value) : SIO (Value × Option Value) := do
  let specV ← gp ctx "spec"
  match specV with
  | .map _ => do
    let headers ← gpMap specV "headers"
    let options ← gp ctx "options"
    let apikey ← gpS options "apikey"
    if apikey == "" then do
      dp headers "authorization"
      pure (specV, none)
    else do
      let pfx ← gpS (← gp options "auth") "prefix"
      let authval := if pfx != "" then pfx ++ " " ++ apikey else apikey
      sp headers "authorization" (.str authval)
      pure (specV, none)
  | _ => do
    let e ← mkErr "auth_no_spec" "Expected context spec property to be defined."
    pure (.noval, some e)

-- ---------------------------------------------------------------------------
-- transforms
-- ---------------------------------------------------------------------------

def transformRequest (ctx : Value) : SIO Value := do
  let specV ← gp ctx "spec"
  match specV with
  | .map _ => sp specV "step" (.str "reqform")
  | _ => pure ()
  let point ← gp ctx "point"
  let reqdata ← gp ctx "reqdata"
  match (← gp point "transform") with
  | .map i => do
    let reqform ← gp (.map i) "req"
    if isNov reqform then pure reqdata
    else do
      let input ← newMap #[("reqdata", reqdata)]
      transform input reqform
  | _ => pure reqdata

def transformResponse (ctx : Value) : SIO Value := do
  let specV ← gp ctx "spec"
  match specV with
  | .map _ => sp specV "step" (.str "resform")
  | _ => pure ()
  let resultV ← gp ctx "result"
  match resultV with
  | .map _ => do
    if !(truthy (← gp resultV "ok")) then pure .noval
    else do
      let point ← gp ctx "point"
      match (← gp point "transform") with
      | .map i => do
        let resform ← gp (.map i) "res"
        if isNov resform then pure .noval
        else do
          let ok ← gp resultV "ok"
          let status ← gp resultV "status"
          let stt ← gp resultV "statusText"
          let hdr ← gp resultV "headers"
          let body ← gp resultV "body"
          let resdata ← gp resultV "resdata"
          let resmatch ← gp resultV "resmatch"
          let input ← newMap #[("ok", ok), ("status", status), ("statusText", stt),
                               ("headers", hdr), ("body", body),
                               ("resdata", resdata), ("resmatch", resmatch)]
          transform input resform
      | _ => pure .noval
  | _ => pure .noval

/-- The request body: only data-input operations carry one. -/
def prepareBody (ctx : Value) : SIO Value := do
  if opInputOf (← opnameOf ctx) == "data" then transformRequest ctx
  else pure .noval

-- ---------------------------------------------------------------------------
-- result assembly
-- ---------------------------------------------------------------------------

def resultBasic (ctx : Value) : SIO Unit := do
  let responseV ← gp ctx "response"
  let resultV ← gp ctx "result"
  match responseV, resultV with
  | .map _, .map _ => do
    let st ← gp responseV "status"
    let stt ← gp responseV "statusText"
    sp resultV "status" st
    sp resultV "statusText" stt
    let status := jsNumber st
    if status >= 400.0 then do
      let msg := "request: " ++ numToString status ++ ": " ++ vs stt
      let prev ← gp resultV "err"
      let pm ← match prev with
        | .map _ => gpS prev "message"
        | _ => pure ""
      let full := if pm != "" then pm ++ ": " ++ msg else msg
      let e ← mkErr "request_status" full
      sp resultV "err" e
    else pure ()
  | _, _ => pure ()

/-- Response headers land on the result with lower-cased keys. -/
def resultHeaders (ctx : Value) : SIO Unit := do
  let resultV ← gp ctx "result"
  match resultV with
  | .map _ => do
    let out ← emptyMap
    let responseV ← gp ctx "response"
    match responseV with
    | .map _ => do
      match (← gp responseV "headers") with
      | .map i =>
        for k in (← keysof (.map i)) do
          let v ← gp (.map i) k
          sp out k.toLower v
      | _ => pure ()
    | _ => pure ()
    sp resultV "headers" out
  | _ => pure ()

def resultBody (ctx : Value) : SIO Unit := do
  let responseV ← gp ctx "response"
  let resultV ← gp ctx "result"
  match responseV, resultV with
  | .map _, .map _ => do
    let body ← gp responseV "body"
    if !(isNov body) then sp resultV "body" body
  | _, _ => pure ()

-- ---------------------------------------------------------------------------
-- spec / url / request / response
-- ---------------------------------------------------------------------------

def makeSpec (ctx : Value) : SIO (Value × Option Value) := do
  let options ← gp ctx "options"
  let base ← gpS options "base"
  let pfx ← gpS options "prefix"
  let suffix ← gpS options "suffix"
  let point ← gp ctx "point"
  let parts ← match (← gp point "parts") with
    | .list i => pure (Value.list i)
    | _ => emptyList
  let aliasm ← emptyMap
  let spec ← newMap #[("base", .str base), ("prefix", .str pfx),
                      ("suffix", .str suffix), ("parts", parts),
                      ("alias", aliasm), ("step", .str "start")]
  sp ctx "spec" spec
  sp spec "method" (.str (← prepareMethod ctx))
  sp spec "path" (.str (← preparePath ctx))
  sp spec "params" (← prepareParams ctx)
  sp spec "query" (← prepareQuery ctx)
  sp spec "headers" (← prepareHeaders ctx)
  pure (spec, none)

/-- base/prefix/path/suffix joined, `{param}` substituted, query appended. -/
def makeUrl (ctx : Value) : SIO (Value × Option Value) := do
  let specV ← gp ctx "spec"
  match specV with
  | .map _ => do
    let base ← gpS specV "base"
    let pfx ← gpS specV "prefix"
    let path ← gpS specV "path"
    let suffix ← gpS specV "suffix"
    let arr ← newList #[.str base, .str pfx, .str path, .str suffix]
    let url0 ← joinurl arr
    let resmatch ← emptyMap
    let mut url := url0
    let params ← gp specV "params"
    for k in (← keysof params) do
      let v ← gp params k
      if !(isNov v) then do
        let enc ← escurl (.str (vs v))
        sp resmatch k v
        url := url.replace ("{" ++ k ++ "}") (vs enc)
    let query ← gp specV "query"
    let mut qsep := "?"
    for k in (← keysof query) do
      let v ← gp query k
      if !(isNov v) then do
        let ek ← escurl (.str k)
        let ev ← escurl (.str (vs v))
        sp resmatch k v
        url := url ++ qsep ++ vs ek ++ "=" ++ vs ev
        qsep := "&"
    let resultV ← gp ctx "result"
    match resultV with
    | .map _ => sp resultV "resmatch" resmatch
    | _ => pure ()
    pure (.str url, none)
  | _ => do
    let e ← mkErr "url_no_spec" "Expected context spec property to be defined."
    pure (.str "", some e)

/-- Prepare the transport call: the response/result carriers must exist. -/
def makeRequest (ctx : Value) : SIO (Value × Option Value) := do
  let specV ← gp ctx "spec"
  match specV with
  | .map _ => sp specV "step" (.str "request")
  | _ => pure ()
  let _ ← gpMap ctx "response"
  let _ ← gpMap ctx "result"
  pure ((← gp ctx "response"), none)

/-- Fold the transport response into the result (basic/headers/body/resform). -/
def makeResponse (ctx : Value) : SIO (Value × Option Value) := do
  let specV ← gp ctx "spec"
  let responseV ← gp ctx "response"
  let resultV ← gp ctx "result"
  match specV, responseV, resultV with
  | .map _, .map _, .map _ => do
    sp specV "step" (.str "response")
    resultBasic ctx
    resultHeaders ctx
    resultBody ctx
    let _ ← transformResponse ctx
    let errv ← gp resultV "err"
    if !(← isErrV errv) then sp resultV "ok" (.bool true)
    pure (responseV, none)
  | _, _, _ => pure (.noval, none)

end SdkUtility
