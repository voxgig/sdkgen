
import {
  Content,
  File,
  cmp,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
  resolveAuthPrefix,
} from '@voxgig/sdkgen'


import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


import {
  ocamlString,
} from './utility_ocaml'


// WHERE THE CREDENTIAL GOES IS A FACT ABOUT THE API, so it is generated
// rather than templated. The ocaml peer of PrepareAuth_ts / PrepareAuth_py;
// read PrepareAuth_ts first, it carries the full account of the defect.
//
// apidef has always resolved the scheme's `in` and `name` into
// `main.kit.info.security` - joplin's says `in: "query", name: "token"` -
// and generation dropped both, so the SDK sent a header the API does not
// read and never sent the query parameter it does. Four repos in the cedar
// fleet ship SDKs that cannot authenticate for this reason: joplin
// (`token`), pipedrive (`api_token`), trello (`key`), lm-umbrella
// (`apiKey`).
//
// OCAML IS THE ODD ONE OUT: it had no prepare_auth TEMPLATE to replace.
// The body was one `let` inside tm/ocaml/sdk_runtime.ml, the 1200-line
// module that holds every `*_util` and the registrar that binds them. So
// the extraction is a real one, and the shape was chosen rather than
// inherited - see EXTRACTION SHAPE below.
const PrepareAuth = cmp(async function PrepareAuth(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const where = resolveAuthIn(model)

  // A HEADER NAME IS LOWER-CASED HERE; A QUERY OR COOKIE NAME IS NOT.
  // apidef writes `name: "Authorization"`, the extracted body hardcoded
  // `"authorization"`, and the whole ocaml runtime keys headers in lower
  // case: make_spec writes "content-type", header_ci lower-cases before it
  // looks up, the secrets feature rewrites `headers.authorization`, and the
  // SHARED corpus asserts `ctx:spec:headers:authorization` - which
  // test/primary_utility_test.ml drives through this very function. A
  // struct map key is case-SENSITIVE, so emitting "Authorization" verbatim
  // would put the credential under a key nothing in the SDK reads.
  //
  // A query parameter and a cookie name are case-sensitive ON THE WIRE:
  // lm-umbrella's `apiKey` is not `apikey`, and lower-casing it would break
  // exactly the APIs this change exists to fix. So they keep the spec's
  // spelling, byte for byte.
  const resolved = resolveAuthName(model)
  const name = 'header' === where ? resolved.toLowerCase() : resolved

  // Read so the resolution is visible at generation time, even though the
  // emitted code takes the prefix from options at runtime (the secrets
  // feature rewrites it there, and `auth.prefix` is a documented option).
  const prefix = resolveAuthPrefix(model)

  const basic = isHttpBasicAuth(model)
  const active = authSwitchedOn(model)

  // FOLDER NESTING. Main_ocaml calls this with NO Folder open: its own
  // Config, SdkError and `sdk_client.ml` all write straight to the target
  // root, and the only Folder it opens (`feature/secrets` for feature.mk)
  // is scoped to that one block and closed before this call. The ocaml tree
  // is FLAT at the root - sdk_types.ml, sdk_helpers.ml, sdk_runtime.ml,
  // sdk_features.ml, sdk_config.ml all sit there, and the Makefile names
  // each by that exact path in `RUNTIME`.
  //
  // So this component opens NO folder. Opening one (`utility`, say, copying
  // the c and lua ports) would write `<root>/utility/sdk_prepare_auth.ml`,
  // which is NOT what `RUNTIME` lists and NOT where `-I .` looks: ocamlc
  // would report `Unbound module Sdk_prepare_auth` while compiling
  // sdk_runtime.ml, and `utility/` already holds the vendored struct port,
  // which the Copy owns.
  File({ name: 'sdk_prepare_auth.' + target.ext }, () => {
    Content(render({
      project: model.const.Name, active, where, name, prefix, basic,
    }))
  })
})


// NOT `isAuthActive`, AND THE DIFFERENCE IS LOAD-BEARING (the py port found
// this first; six of the eleven ports found it independently).
//
// `isAuthActive` is false whenever the SPEC declares no security scheme
// (`main.kit.info.auth: false`). That is a statement about the DEFINITION,
// not a ban on ever sending a credential: apidef writes it for every spec
// with no securitySchemes block - GitHub's official OpenAPI included - and
// those SDKs are still expected to honour an `apikey` the caller passes.
// `optspec` always declares `apikey`, and make_options fills `options.auth`
// from the optspec defaults, so the runtime `auth = Noval | Null` guard
// never fired and every such SDK has ALWAYS sent the credential.
//
// Gating the body on `isAuthActive` therefore does not trim dead code, it
// deletes working authentication - and takes the secrets feature with it,
// since that resolves a secret into `options.apikey` and prepare_auth then
// places nothing. generatedcompile's own fixture is one of these
// (`main: kit: info: { ... auth: false }` in generateharness), and the
// shipped tm/ocaml/test/feature/secrets/t_secrets.ml drives a LIVE client
// on it.
//
// `main.kit.config.auth.active: false` is the project saying "this SDK
// sends no credential, ever" - an explicit per-SDK switch nobody sets by
// accident, and the only signal that can honestly be honoured before
// runtime. So it is the only one used here.
function authSwitchedOn(model: any): boolean {
  const auth = getModelPath(model, `main.${KIT}.config.auth`,
    { only_active: false, required: false })
  return !(null != auth && false === auth.active)
}


type AuthSpec = {
  project: string
  active: boolean
  where: string
  name: string
  prefix: string
  basic: boolean
}


// EXTRACTION SHAPE: ITS OWN COMPILATION UNIT, and the module keeps calling
// it.
//
// The preferred shape, and it fits: `sdk_prepare_auth.ml` is module
// `Sdk_prepare_auth`, compiled between sdk_helpers.ml and sdk_runtime.ml -
// the Makefile's `RUNTIME` is an explicit ORDERED list (ocamlc compiles a
// module before anything that uses it and has no link-time reordering), so
// the position is stated there rather than discovered.
//
// THE BINDING IS PRESERVED EXACTLY. sdk_runtime.ml keeps
//
//   let prepare_auth_util = Sdk_prepare_auth.prepare_auth_util
//
// so every existing call site resolves at the same name it always did:
//   - `u_prepare_auth = prepare_auth_util` in new_utility, and
//     `u.u_prepare_auth <- prepare_auth_util` in register - the closure
//     record that IS the ocaml registrar (sdk_types.ml declares the field);
//   - `u.u_prepare_auth ctx` in make_spec_util (sdk_runtime.ml) and in the
//     secrets feature's re-run of the pipeline (sdk_features.ml);
//   - `prepare_auth_util c` in test/primary_utility_test.ml, which reaches
//     it through `open Sdk_runtime` and drives the SHARED corpus section
//     through it - the parity suite requires ocaml to execute `prepareAuth`
//     (parity.test.ts FULL tier), so that name had to keep resolving;
//   - `cl.cl_utility.u_prepare_auth ctx` in the four t_pipeline.ml cases.
// Nothing in the tree was re-pointed at the new module, and nothing needed
// to be.
//
// THE ONE THING THAT HAD TO MOVE. The body reads the client's options
// through `client_options_map`, which was defined in sdk_runtime.ml - i.e.
// AFTER this module in compile order, so it could not be called from here.
// It is a one-line accessor over `sdk_client.cl_options` with no dependency
// on anything else in that module, so it moved DOWN into sdk_helpers.ml,
// where `cc`, `cu`, `getp` and every other shared accessor already live.
// sdk_runtime.ml opens Sdk_helpers, so its own three call sites are
// unchanged. The alternative - re-deriving the options map here - would
// fork a definition that must not drift.
function render(spec: AuthSpec): string {
  const head = `(* ${spec.project} SDK utility: prepare_auth.
 *
 * GENERATED by @voxgig/sdkgen (src/cmp/ocaml/PrepareAuth_ocaml.ts), not
 * copied from tm/ocaml - WHERE the credential goes and UNDER WHAT NAME is a
 * fact about this API, and a template can hold only one answer. This SDK's
 * scheme places it ${placement(spec)}.
 *
 * Sdk_runtime binds \`prepare_auth_util\` to this one and registers it in the
 * utility record, so every caller reaches it exactly as before. *)

open Voxgig_struct
open Sdk_types
open Sdk_helpers

(* THE PLACEMENT THIS SDK WAS GENERATED FOR, DECLARED rather than left
 * implicit in the code below.
 *
 *   cred_active  false only for main.kit.config.auth.active: false
 *   cred_where   header | query | cookie
 *   cred_name    the key used - ALREADY LOWER-CASED for a header, because
 *                every header key the runtime writes is; verbatim for a
 *                query parameter or a cookie, which are case-sensitive
 *
 * They exist so the SHIPPED suite can hold the runtime to its own contract
 * instead of guessing at it: test/t_pipeline.ml's four \`prepare_auth.*\`
 * cases hardcoded \`spec.headers["authorization"]\`, so they failed on any
 * SDK whose scheme is not a header - precisely the SDK this change exists to
 * make work. Reading them is not circular: the assertions still drive the
 * real prepare_auth and check the bag, key and value it actually wrote. *)
let cred_active = ${spec.active}
let cred_where = "${ocamlString(spec.where)}"
let cred_name = "${ocamlString(spec.name)}"
`

  // AUTH SWITCHED OFF BY THE PROJECT (see authSwitchedOn for why only an
  // EXPLICIT switch counts). The SDK gets a prepare_auth that is honest
  // about it rather than one that deletes a header nobody set. Nothing is
  // read from options, so no constant is emitted either.
  if (!spec.active) {
    return head + `
(* This SDK is configured with authentication off
 * (main.kit.config.auth.active: false), so there is no credential to place.
 * The function stays in the pipeline because make_spec calls it
 * unconditionally. *)
let prepare_auth_util (ctx : ctx) : (spec option * sdk_error option) =
  match ctx.c_spec with
  | None -> (None, Some (ctx_make_error ctx "auth_no_spec" "Expected context spec property to be defined."))
  | Some spec -> (Some spec, None)
`
  }

  if ('query' === spec.where) return renderQuery(spec, head)
  if ('cookie' === spec.where) return renderCookie(spec, head)

  return renderHeader(spec, head)
}


function placement(spec: AuthSpec): string {
  if ('query' === spec.where) return `in the query string, as \`${spec.name}\``
  if ('cookie' === spec.where) return `in the \`cookie\` header, as \`${spec.name}\``
  return `in the \`${spec.name}\` header`
}


// HEADER. Behaviourally what sdk_runtime.ml's `prepare_auth_util` did, line
// for line and idiom for idiom: the same `auth_no_spec` error, the same
// `__NOTFOUND__` sentinel read through `getprop ~alt`, the same
// missing-credential handling (delete the header), the same empty-prefix
// rule. Only the credential NAME moves with the model - and it resolves to
// "authorization" for every header SDK, so those regenerate unchanged.
//
// The HTTP Basic block is the one addition, and it is emitted ONLY when the
// model says the scheme IS basic (`isHttpBasicAuth`). An ordinary
// bearer/apiKey SDK carries no dead code and no behaviour change. ocaml's
// extracted body never had this branch: a basic scheme resolved
// `auth.prefix` to "Basic" and sent `Basic <apikey>` - a single token where
// the scheme demands `base64(user:pass)`, which cannot authenticate. The
// other eleven ports added the same branch for the same reason.
function renderHeader(spec: AuthSpec, head: string): string {
  return head + `
let option_apikey = "apikey"
${spec.basic ? `let option_secret = "secret"
` : ''}let not_found = "__NOTFOUND__"
` + (spec.basic ? BASE64 : '') + `
let prepare_auth_util (ctx : ctx) : (spec option * sdk_error option) =
  match ctx.c_spec with
  | None -> (None, Some (ctx_make_error ctx "auth_no_spec" "Expected context spec property to be defined."))
  | Some spec ->
    let headers = spec.sp_headers in
    let options = client_options_map (cc ctx) in
    (match getp options "auth" with
     (* \`auth: null\` is the documented suppression, and a public API that
      * needs no auth omits the block entirely. Both land here. *)
     | Noval | Null -> ignore (delprop headers (Str cred_name)); (Some spec, None)
     | _ ->
       let apikey = getprop ~alt:(Str not_found) options (Str option_apikey) in
       let is_notfound = (match apikey with Str s -> s = not_found | _ -> false) in
       let no_apikey = is_notfound || is_noval apikey || apikey = Str "" in
${spec.basic ? BASIC : ''}       if no_apikey then
         ignore (delprop headers (Str cred_name))
       else begin
         let auth_prefix = match getpath_s options "auth.prefix" with Str s -> s | _ -> "" in
         let apikey_val = match apikey with Str s -> s | _ -> "" in
         (* Empty prefix (a raw apiKey credential) must not add a leading space. *)
         let authval = if auth_prefix <> "" then auth_prefix ^ " " ^ apikey_val else apikey_val in
         setp headers cred_name (Str authval)
       end;
       (Some spec, None))
`
}


// QUERY. The credential is a query parameter, so it goes in `spec.sp_query`
// and the headers are never touched. prepare_auth runs AFTER prepare_query
// and BEFORE make_url in make_spec_util, and make_url walks `sp_query` into
// the URL - so this placement reaches the wire without any other change.
function renderQuery(spec: AuthSpec, head: string): string {
  return head + `
let option_apikey = "apikey"
let not_found = "__NOTFOUND__"

let prepare_auth_util (ctx : ctx) : (spec option * sdk_error option) =
  match ctx.c_spec with
  | None -> (None, Some (ctx_make_error ctx "auth_no_spec" "Expected context spec property to be defined."))
  | Some spec ->
    let query = spec.sp_query in
    let options = client_options_map (cc ctx) in
    (match getp options "auth" with
     (* \`auth: null\` is the documented suppression, and a public API that
      * needs no auth omits the block entirely. Both land here. *)
     | Noval | Null -> ignore (delprop query (Str cred_name)); (Some spec, None)
     | _ ->
       let apikey = getprop ~alt:(Str not_found) options (Str option_apikey) in
       let is_notfound = (match apikey with Str s -> s = not_found | _ -> false) in
       if is_notfound || is_noval apikey || apikey = Str "" then
         ignore (delprop query (Str cred_name))
       else begin
         (* NO PREFIX IN A QUERY STRING. \`?${spec.name}=Bearer%20abc\` is not a
          * thing any API reads: the prefix is a header-value convention, so
          * it is dropped here deliberately rather than concatenated. *)
         let apikey_val = match apikey with Str s -> s | _ -> "" in
         setp query cred_name (Str apikey_val)
       end;
       (Some spec, None))
`
}


// COOKIE. A cookie IS a header, so the credential rides the header bag -
// but the \`cookie\` header is SHARED with whatever cookies the caller set
// through options.headers, so our pair is SPLICED in and out rather than
// the header assigned over. Splicing also makes this idempotent: the
// secrets feature re-runs the pipeline on a retried request, and an
// assignment would leave the credential in the header twice.
function renderCookie(spec: AuthSpec, head: string): string {
  return head + `
let cookie_header = "cookie"
let option_apikey = "apikey"
let not_found = "__NOTFOUND__"

(* Strip ASCII spaces and tabs from both ends of one cookie pair. *)
let cookie_trim (s : string) : string =
  let n = String.length s in
  let b = ref 0 and e = ref n in
  while !b < !e && (s.[!b] = ' ' || s.[!b] = '\\t') do incr b done;
  while !e > !b && (s.[!e - 1] = ' ' || s.[!e - 1] = '\\t') do decr e done;
  String.sub s !b (!e - !b)

(* True for OUR pair only: the bare name, or the name followed by '='. A
 * cookie called "${ocamlString(spec.name)}_backup" must survive. *)
let cookie_is_cred (pair : string) : bool =
  let n = String.length cred_name in
  pair = cred_name
  || (String.length pair > n && String.sub pair 0 (n + 1) = cred_name ^ "=")

(* Rewrite the cookie header with our pair set (Some v) or removed (None),
 * every other cookie kept in order. *)
let cookie_set (headers : value) (v : string option) : unit =
  let existing = match getp headers cookie_header with Str s -> s | _ -> "" in
  let kept =
    List.filter (fun p -> p <> "" && not (cookie_is_cred p))
      (List.map cookie_trim (String.split_on_char ';' existing)) in
  let kept = match v with None -> kept | Some x -> kept @ [cred_name ^ "=" ^ x] in
  if [] = kept then ignore (delprop headers (Str cookie_header))
  else setp headers cookie_header (Str (String.concat "; " kept))

let prepare_auth_util (ctx : ctx) : (spec option * sdk_error option) =
  match ctx.c_spec with
  | None -> (None, Some (ctx_make_error ctx "auth_no_spec" "Expected context spec property to be defined."))
  | Some spec ->
    let headers = spec.sp_headers in
    let options = client_options_map (cc ctx) in
    (match getp options "auth" with
     (* \`auth: null\` is the documented suppression, and a public API that
      * needs no auth omits the block entirely. Both land here. *)
     | Noval | Null -> cookie_set headers None; (Some spec, None)
     | _ ->
       let apikey = getprop ~alt:(Str not_found) options (Str option_apikey) in
       let is_notfound = (match apikey with Str s -> s = not_found | _ -> false) in
       if is_notfound || is_noval apikey || apikey = Str "" then
         cookie_set headers None
       else begin
         (* NO PREFIX IN A COOKIE either - a cookie carries a bare
          * \`name=value\` pair, not a header's scheme-prefixed credential. *)
         let apikey_val = match apikey with Str s -> s | _ -> "" in
         cookie_set headers (Some apikey_val)
       end;
       (Some spec, None))
`
}


// True HTTP Basic Auth: TWO credentials, base64-joined. Emitted only for a
// HEADER placement, because the scheme IS a header -
// \`Authorization: Basic base64(user:pass)\` cannot be expressed as a query
// parameter or a cookie pair, so renderQuery and renderCookie never carry
// it.
//
// It is the FIRST of three `unit` branches - basic, no-credential,
// single-token - and the shared \`(Some spec, None)\` after them is the one
// result. Written that way rather than as an early return because OCaml
// sequences with \`;\`: a branch returning the tuple could not sit beside
// two returning unit.
const BASIC = `       if (match getpath_s options "auth.basic" with Bool b -> b | _ -> false) then begin
         (* True HTTP Basic Auth needs TWO credentials, base64-joined - a
          * single token in the header (the branch below) can never
          * authenticate against an API that actually checks
          * \`Authorization: Basic base64(user:pass)\`. *)
         let secret = getprop ~alt:(Str not_found) options (Str option_secret) in
         let no_secret =
           (match secret with Str s -> s = not_found | _ -> false)
           || is_noval secret || secret = Str "" in
         if no_apikey || no_secret then
           ignore (delprop headers (Str cred_name))
         else begin
           let auth_prefix = match getpath_s options "auth.prefix" with Str s -> s | _ -> "" in
           let apikey_val = match apikey with Str s -> s | _ -> "" in
           let secret_val = match secret with Str s -> s | _ -> "" in
           let joined = base64_encode (apikey_val ^ ":" ^ secret_val) in
           setp headers cred_name
             (Str (if auth_prefix <> "" then auth_prefix ^ " " ^ joined else joined))
         end
       end
       else
`


// OCaml's stdlib has no base64 (4.14 ships none, and the SDK is
// dependency-free: stock ocamlc, no opam, no dune). The vendored sekreto
// port has one, but it lives inside the OPTIONAL secrets feature - an SDK
// that never asked for secrets does not compile it - so an HTTP Basic SDK
// carries its own. Emitted only in that branch, so nothing else pays for
// it. The lua port carries the same encoder for the same reason.
const BASE64 = `
let b64_alphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

let base64_encode (text : string) : string =
  let n = String.length text in
  let buf = Buffer.create (((n + 2) / 3) * 4) in
  let i = ref 0 in
  while !i < n do
    let rest = n - !i in
    let a = Char.code text.[!i] in
    let b = if 1 < rest then Char.code text.[!i + 1] else 0 in
    let c = if 2 < rest then Char.code text.[!i + 2] else 0 in
    let word = (a lsl 16) lor (b lsl 8) lor c in
    Buffer.add_char buf b64_alphabet.[(word lsr 18) land 0x3f];
    Buffer.add_char buf b64_alphabet.[(word lsr 12) land 0x3f];
    (* One trailing source byte yields two characters and "==", two yield
     * three and "=". *)
    Buffer.add_char buf (if 1 < rest then b64_alphabet.[(word lsr 6) land 0x3f] else '=');
    Buffer.add_char buf (if 2 < rest then b64_alphabet.[word land 0x3f] else '=');
    i := !i + 3
  done;
  Buffer.contents buf
`


export {
  PrepareAuth
}
