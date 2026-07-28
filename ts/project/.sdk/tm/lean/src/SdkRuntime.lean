/- ProjectName SDK runtime: the generic, config-driven operation pipeline.

   Following the Haskell target's model, entities are NOT generated per-entity;
   the whole SDK is driven by the API model (a struct `Value` parsed from the
   embedded config). A client holds `options` + `config`; an operation looks up
   `config.entity.<name>.op.<op>.points`, selects the matching endpoint, builds
   the URL/method/body, calls the `curl` transport, parses the JSON response,
   and applies the response transform.

   The struct `Value` is the single data model throughout (like map[string]any
   in the Go/Python SDKs); everything runs in struct's `SIO` monad. -/

import VoxgigStruct
import SdkJson

open VoxgigStruct

namespace SdkRuntime

/-- Pure string view of a scalar Value. -/
def asStr : Value → String
  | .str s => s
  | _ => ""

def isNv : Value → Bool
  | .noval => true
  | .null  => true
  | _      => false

/-- Get a map field by string key (noval if absent). -/
def gp (v : Value) (k : String) : SIO Value := getprop v (.str k) .noval

def gpS (v : Value) (k : String) : SIO String := do pure (asStr (← gp v k))

-- ---------------------------------------------------------------------------
-- Transport: shell out to curl. Returns (status, body).
-- ---------------------------------------------------------------------------

def curlFetch (method url : String) (body : Option String) : IO (Nat × String) := do
  let base := #["-s", "-w", "\n%{http_code}", "--max-time", "20", "-X", method]
  let hdr  := if body.isSome then #["-H", "Content-Type: application/json"] else #[]
  let dat  := match body with | some b => #["-d", b] | none => #[]
  let out ← IO.Process.output { cmd := "curl", args := base ++ hdr ++ dat ++ #[url] }
  if out.exitCode != 0 then
    throw (IO.userError s!"curl failed ({out.exitCode}): {out.stderr}")
  let lines := out.stdout.splitOn "\n"
  let status := (lines.getLastD "0").toNat!
  let bodyStr := String.intercalate "\n" lines.dropLast
  return (status, bodyStr)

-- ---------------------------------------------------------------------------
-- Point selection (mirrors SdkRuntime.hs prepareOperation): all select.exist
-- keys must be present in match/data, and select.$action must equal the
-- caller's $action (both absent = the plain point).
-- ---------------------------------------------------------------------------

def existOk (point matchV dataV : Value) : SIO Bool := do
  let sel ← gp point "select"
  match (← gp sel "exist") with
  | .list id => do
    let mut ok := true
    for ek in (← listItems id) do
      let k := asStr ek
      if isNv (← gp matchV k) && isNv (← gp dataV k) then ok := false
    pure ok
  | _ => pure true

def actionOk (point matchV : Value) : SIO Bool := do
  let sel ← gp point "select"
  pure ((← gp sel "$action") == (← gp matchV "$action"))

def selectPoint (points matchV dataV : Value) : SIO Value := do
  match points with
  | .list id => do
    let pts ← listItems id
    if pts.size == 1 then pure pts[0]!
    else do
      for pt in pts do
        if (← existOk pt matchV dataV) && (← actionOk pt matchV) then return pt
      pure .noval
  | _ => pure .noval

-- ---------------------------------------------------------------------------
-- Request building + response transform.
-- ---------------------------------------------------------------------------

/-- Substitute a `{name}` path segment from match (falling back to data). -/
def resolvePart (seg : String) (matchV dataV : Value) : SIO String := do
  if seg.startsWith "{" && seg.endsWith "}" then
    let key := (seg.replace "{" "").replace "}" ""
    let mv ← gp matchV key
    let v ← if isNv mv then gp dataV key else pure mv
    pure (asStr v)
  else pure seg

def buildUrl (base : String) (point matchV dataV : Value) : SIO String := do
  match (← gp point "parts") with
  | .list id => do
    let mut segs : Array String := #[]
    for p in (← listItems id) do
      segs := segs.push (← resolvePart (asStr p) matchV dataV)
    pure (base ++ "/" ++ String.intercalate "/" segs.toList)
  | _ => pure base

/-- Strip surrounding backticks from a transform expression. -/
def unquote (s : String) : String := s.replace "`" ""

/-- Apply transform.res: `body`, `body.entity`, etc. -/
def resTransform (point body : Value) : SIO Value := do
  let tr ← gp point "transform"
  let e := unquote (← gpS tr "res")
  let segs := e.splitOn "."
  let mut cur := body
  for s in segs.drop 1 do
    cur ← gp cur s
  pure cur

-- ---------------------------------------------------------------------------
-- The generic operation.
-- ---------------------------------------------------------------------------

def runOp (client : Value) (entityName opName : String)
    (matchV dataV _callopts : Value) : SIO Value := do
  let options ← gp client "options"
  let config  ← gp client "config"
  let userBase ← gpS options "base"
  let base ← if userBase != "" then pure userBase
             else gpS (← gp config "options") "base"
  let ent     ← gp (← gp config "entity") entityName
  let op      ← gp (← gp ent "op") opName
  let point   ← selectPoint (← gp op "points") matchV dataV
  if isNv point then
    throw (IO.userError s!"Operation \"{opName}\" has no matching endpoint for {entityName}.")
  let url    ← buildUrl base point matchV dataV
  let method ← gpS point "method"
  let hasBody := method == "POST" || method == "PUT" || method == "PATCH"
  let bodyStr ← if hasBody then (do pure (some (← jsonify dataV))) else pure none
  let (_st, respBody) ← curlFetch method url bodyStr
  let respV ← SdkJson.jsonRead respBody
  resTransform point respV

-- Entity operation wrappers.
def opList   (c : Value) (e : String) (m co : Value) : SIO Value := do runOp c e "list"   m (← emptyMap) co
def opLoad   (c : Value) (e : String) (m co : Value) : SIO Value := do runOp c e "load"   m (← emptyMap) co
def opCreate (c : Value) (e : String) (d co : Value) : SIO Value := do runOp c e "create" (← emptyMap) d co
def opUpdate (c : Value) (e : String) (m d co : Value) : SIO Value := do runOp c e "update" m d co
def opRemove (c : Value) (e : String) (m co : Value) : SIO Value := do runOp c e "remove" m (← emptyMap) co

/-- Build a client Value from options + config JSON strings. -/
def mkClient (optionsJson configJson : String) : SIO Value := do
  let options ← SdkJson.jsonRead optionsJson
  let config  ← SdkJson.jsonRead configJson
  newMap #[("options", options), ("config", config)]

/-- Build a client from an options `Value` (the generated `newSdk` entry). -/
def mkClientV (options : Value) (configJson : String) : SIO Value := do
  let opts ← (match options with | .map _ => pure options | _ => emptyMap)
  let config ← SdkJson.jsonRead configJson
  newMap #[("options", opts), ("config", config)]

end SdkRuntime
