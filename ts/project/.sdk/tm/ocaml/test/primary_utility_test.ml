(* ProjectName SDK primary-utility corpus.
 *
 * Drives the SHARED language-neutral corpus (.sdk/test/test.json -> "primary")
 * through this SDK's request-shaping utilities, so the cases cannot drift from
 * the reference implementation. Each section is looked up by name and executed
 * on the VENDORED @voxgig/omni engine through Omni_resolver, exactly as the
 * ts/js reference harness does.
 *
 * Every section here uses `runset_args`: a `ctx` entry arrives as `args.(0)`,
 * a MAP, which the call site turns into a LIVE typed context, runs the
 * utility on, and writes the observable state back into — which is what
 * makes `match: {ctx: ...}` (retargeted onto `match: {args: {"0": ...}}` by
 * the resolver, decision 3) read the POST-call state rather than a stale
 * pre-call copy.
 *)

open Voxgig_struct
open Sdk_types
open Sdk_helpers
open Sdk_runtime

module O = Omni
module R = Omni_resolver

let client () : sdk_client = Sdk_client.test ()

(* A client built from a section's DEF.setup.a block. prepare_auth reads the
 * CLIENT's options, as the ts reference does via client.options(), so a
 * section's setup cannot reach it through ctx.options. *)
let client_for (r : R.run) (name : string) : sdk_client =
  match R.tostruct (R.getset r [name; "DEF"; "setup"; "a"]) with
  | Map _ as setup -> Sdk_client.test_with Noval setup
  | _ -> Sdk_client.test ()

(* A LIVE context from a corpus map. The utilities read and MUTATE spec,
 * result and response through their record types, so a bare value map leaves
 * them nothing to work on and every match reads null. *)
let ctx_from (cl : sdk_client) (ctxmap : value) : ctx =
  let u = cl.cl_utility in
  (* The corpus names the op — {"ctx": {"opname": "create"}} — and
   * prepare_method reads it. Hardcoding "load" made every method GET. *)
  (* Only when the corpus names one. Defaulting to "load" made the SDK report
   * the wrong operation in error messages the corpus matches on — it expects
   * "unknown operation" where no op is named. *)
  let cs =
    match R.getp ctxmap "opname" with
    | Str s -> { (default_ctxspec ()) with cs_opname = Some s }
    | _ -> default_ctxspec ()
  in
  let c = u.u_make_context cs cl.cl_rootctx in
  (match R.getp ctxmap "spec" with
   | Map _ as m -> c.c_spec <- Some (new_spec m)
   | _ -> ());
  (match R.getp ctxmap "result" with
   | Map _ as m ->
     let rt = new_result m in
     (* new_result hardcodes rt_err = None, so a corpus result carrying an err
      * arrives empty and result_basic has no previous message to prepend —
      * it produced "request: 400: BAD" where the contract says
      * "Foo: request: 400: BAD". The lua and elixir drivers build it too. *)
     (match R.getp m "err" with
      | Map _ as em ->
        (match R.getp em "message" with
         | Str msg when msg <> "" ->
           rt.rt_err <- Some { err_code = ""; err_msg = msg; err_result = Noval; err_spec = Noval }
         | _ -> ())
      | _ -> ());
     c.c_result <- Some rt
   | _ -> ());
  (match R.getp ctxmap "response" with
   | Map _ as m ->
     let rs = new_response m in
     (* result_body_util reads response.json and requires it to be CALLABLE;
      * the corpus supplies a plain `body`, so wrap it, as the lua and elixir
      * drivers do. Without this every ctx.result.body match reads empty. *)
     (match R.getp m "body" with
      | Noval -> ()
      | b -> rs.rs_json <- Func (fun _ _ _ _ -> b));
     (* Header names arrive from the wire in any case and the contract is
      * lowercase; the lua and elixir drivers normalise here rather than in
      * result_headers_util, which copies them verbatim. *)
     (match R.getp m "headers" with
      | Map hm ->
        let low = empty_map () in
        List.iter (fun (k, v) -> ignore (setprop low (Str (String.lowercase_ascii k)) v))
          hm.entries;
        rs.rs_headers <- low
      | _ -> ());
     c.c_response <- Some rs
   | _ -> ());
  (match R.getp ctxmap "point" with
   | Map _ as m -> c.c_point <- m
   | _ -> ());
  (match R.getp ctxmap "reqdata" with Noval -> () | v -> c.c_reqdata <- v);
  (match R.getp ctxmap "reqmatch" with Noval -> () | v -> c.c_reqmatch <- v);
  (match R.getp ctxmap "data" with Noval -> () | v -> c.c_data <- v);
  (match R.getp ctxmap "match" with Noval -> () | v -> c.c_match <- v);
  c

(* The corpus speaks camelCase; this port stores rs_status_text / rt_ok. A
 * neutral-named view is what the match assertions read. *)
let result_value (r : result option) : value =
  match r with
  | None -> Noval
  | Some rt -> result_to_value rt

let arg (args : value array) (index : int) : value =
  if index < Array.length args then args.(index) else Noval

(* omni reports a subject failure by its exception MESSAGE, and understands
 * `Failure` (and its own `Omni_error`) directly; anything else renders
 * through Printexc, which turns a branded SDK error into
 * "Sdk_types.Sdk_error_exc(_)" and loses the message the corpus matches on.
 * Convert here rather than teaching the shared resolver about SDK types. *)
let run_guarded f c =
  try f c with Sdk_error_exc e -> raise (Failure e.err_msg)

(* Publish the MUTATED ctx back onto the corpus map the match reads.
 * The resolver retargets `match: {ctx: ...}` onto `match: {args: {"0": ...}}`
 * and writes the argument array back after the call, so this map IS what the
 * assertions read — but only for the state written here. Neutral names,
 * because the corpus is camelCase and this port stores rs_status_text/rt_ok. *)
let publish (ctxmap : value) (c : ctx) =
  (match c.c_spec with
   | Some sp -> ignore (setprop ctxmap (Str "spec") (spec_to_value sp))
   | None -> ());
  (match c.c_result with
   | Some _ -> ignore (setprop ctxmap (Str "result") (result_value c.c_result))
   | None -> ());
  (match c.c_response with
   | Some _ -> ignore (setprop ctxmap (Str "response") (Str R.existsmark))
   | None -> ());
  ()

(* Where this SDK's prepare_auth puts the credential, probed once over empty
 * headers and query. `ac_pair` is the `<scheme>=` lead-in of a cookie
 * credential, which rides the header bag under "cookie". *)
type auth_cred = { ac_query : bool; ac_name : string; ac_pair : string }

let auth_credential () : auth_cred option =
  let cl = Sdk_client.test_with Noval
      (jo [("apikey", Str "PROBE"); ("auth", jo [("prefix", Str ""); ("basic", Bool false)])]) in
  let c = ctx_from cl (jo []) in
  let sp = new_spec (jo [("headers", empty_map ()); ("query", empty_map ())]) in
  c.c_spec <- Some sp;
  let first = function Map { entries = (k, v) :: _ } -> Some (k, v) | _ -> None in
  match (try ignore (prepare_auth_util c); true with _ -> false) with
  | false -> None
  | true ->
    match first sp.sp_headers, first sp.sp_query with
    | Some (k, v), _ ->
      let pair = match v with
        | Str t when k = "cookie" && String.ends_with ~suffix:"=PROBE" t ->
          String.sub t 0 (String.length t - 5)
        | _ -> "" in
      Some { ac_query = false; ac_name = k; ac_pair = pair }
    | None, Some (k, _) -> Some { ac_query = true; ac_name = k; ac_pair = "" }
    | None, None -> None

(* The corpus states the credential as `headers.authorization`, a placeholder
 * for wherever this SDK puts it. Only that entry moves, under the real name
 * and into the real container, and a cookie credential's value becomes its
 * pair: every other header and query parameter stays where it was. *)
let rec auth_retarget (cred : auth_cred) (node : O.json) : O.json =
  match node with
  | O.JList items -> O.JList (List.map (auth_retarget cred) items)
  | O.JMap entries ->
    let placed = ref None in
    let out = List.map (fun (k, v) ->
        match k, v with
        | "headers", O.JMap bag ->
          (match List.assoc_opt "authorization" bag with
           | Some (O.Str t) -> placed := Some (O.Str (cred.ac_pair ^ t))
           | Some other -> placed := Some other
           | None -> ());
          (k, O.JMap (List.remove_assoc "authorization" bag))
        | _ -> (k, auth_retarget cred v)) entries in
    (match !placed with
     | None -> O.JMap out
     | Some v ->
       let dest = if cred.ac_query then "query" else "headers" in
       let bag = match List.assoc_opt dest out with Some (O.JMap b) -> b | _ -> [] in
       O.JMap (List.remove_assoc dest out
               @ [(dest, O.JMap (List.remove_assoc cred.ac_name bag @ [(cred.ac_name, v)]))]))
  | other -> other


(* ---- the body codec sections ---- *)

(* The corpus writes bytes as latin1 characters; a JSON string reads as UTF-8. *)
let to_latin1 (s : string) : string =
  let b = Buffer.create (String.length s) in
  let i = ref 0 in
  while !i < String.length s do
    let c = Char.code s.[!i] in
    if c land 0xE0 = 0xC0 && !i + 1 < String.length s then begin
      Buffer.add_char b (Char.chr (((c land 0x1F) lsl 6) lor (Char.code s.[!i + 1] land 0x3F)));
      i := !i + 2
    end
    else (Buffer.add_char b s.[!i]; incr i)
  done;
  Buffer.contents b

let of_latin1 (s : string) : string =
  let b = Buffer.create (String.length s) in
  String.iter (fun ch ->
      let c = Char.code ch in
      if c < 0x80 then Buffer.add_char b ch
      else begin
        Buffer.add_char b (Char.chr (0xC0 lor (c lsr 6)));
        Buffer.add_char b (Char.chr (0x80 lor (c land 0x3F)))
      end) s;
  Buffer.contents b

(* `source$` is a source built by Sdk_binary.bytes, `bytes$` bytes. *)
let marker_source (v : value) : binary_source option =
  match getp v "source$", getp v "bytes$" with
  | Str d, _ -> Some (Sdk_binary.bytes ?name:(get_str v "name") ?type_:(get_str v "type") (to_latin1 d))
  | _, Str d -> Some (Sdk_binary.bytes (to_latin1 d))
  | _ -> None

let rec debytes (v : value) : value =
  match v with
  | Map m ->
    (match getp v "bytes$" with
     | Str d -> Str (to_latin1 d)
     | _ -> let out = empty_map () in
       List.iter (fun (k, x) -> setp out k (debytes x)) m.entries; out)
  | List r -> ja (List.map debytes !r)
  | v -> v

(* A source has no slot in `value`, so one in the data moves beside it, as a
 * caller passes it: a top-level field by its name, and any other by its path,
 * which the lift then refuses. *)
let rec sources_in (path : string) (v : value) : (string * binary_source) list =
  match v with
  | Map _ when getp v "source$" <> Noval -> (match marker_source v with Some s -> [(path, s)] | None -> [])
  | Map m -> List.concat_map (fun (k, x) -> sources_in (if path = "" then k else path ^ "." ^ k) x) m.entries
  | List r -> List.concat (List.mapi (fun i x -> sources_in (path ^ "." ^ string_of_int i) x) !r)
  | _ -> []

let sourced (c : ctx) : unit =
  let given = ref [] in
  (match c.c_reqdata with
   | Map m ->
     let out = empty_map () in
     List.iter (fun (k, x) ->
         match x with
         | Map _ when getp x "source$" <> Noval ->
           (match marker_source x with Some s -> given := !given @ [(k, s)] | None -> ())
         | List r when List.exists (fun e -> getp e "source$" <> Noval) !r ->
           given := !given @ List.filter_map (fun e ->
               match marker_source e with
               | Some s -> Some (k, s)
               | None -> (match e with Str t -> Some (k, Sdk_binary.bytes t) | _ -> None)) !r
         | _ ->
           (match sources_in k x with
            | [] -> setp out k (debytes x)
            | found -> given := !given @ found)) m.entries;
     c.c_reqdata <- out
   | _ -> ());
  given := !given @ sources_in "" c.c_reqmatch;
  c.c_given <- !given

let body_guarded f c =
  try f c with Body_error e | Sdk_error_exc e -> raise (Failure e.err_msg)

let () =
  let testfile = if Array.length Sys.argv > 1 then Sys.argv.(1) else "SDKREL/.sdk/test/test.json" in
  let r = R.make_run testfile "primary" in

  let cl = client () in
  let u = cl.cl_utility in

  (* Sections configured by their own DEF.setup block get their own client. *)
  let primary_ctx_with ?(prep = fun node -> node) cl2 name f =
    R.runset_args r name (prep (R.getset r [name; "basic"]))
      (fun args ->
         let ctxmap = arg args 0 in
         let c = ctx_from cl2 ctxmap in
         let out = run_guarded f c in
         publish ctxmap c;
         out)
  in

  let primary_ctx name f = primary_ctx_with cl name f in

  primary_ctx "done" (fun c -> u.u_done c);
  primary_ctx "makeUrl" (fun c -> match make_url_util c with (s, _) -> Str s);
  primary_ctx "makeRequest"
    (fun c -> ignore (make_request_util c); result_value c.c_result);
  primary_ctx "makeResponse"
    (fun c -> ignore (make_response_util c); result_value c.c_result);
  primary_ctx_with (client_for r "makeSpec") "makeSpec"
    (fun c -> match make_spec_util c with
       | (Some s, _) -> spec_to_value s | _ -> Noval);
  (* Read from the config, never from a probe: a probe that finds no
   * credential is the regression this section exists to catch. *)
  (match getp (getp (Sdk_config.make_config ()) "options") "auth" with
   | Map _ ->
     (match auth_credential () with
      | None ->
        r.R.failures <- "prepareAuth: prepare_auth placed no credential in headers or query"
                        :: r.R.failures
      | Some cred ->
        primary_ctx_with ~prep:(auth_retarget cred) (client_for r "prepareAuth") "prepareAuth"
          (fun c -> ignore (prepare_auth_util c);
            match c.c_spec with Some s -> spec_to_value s | None -> Noval))
   | _ -> r.R.skipped <- "prepareAuth (this SDK's config declares no auth, so it places no credential)" :: r.R.skipped);
  primary_ctx "prepareBody" (fun c -> prepare_body_util c);
  primary_ctx "prepareHeaders" (fun c -> prepare_headers_util c);
  primary_ctx "prepareMethod"
    (fun c -> match prepare_method_util c with "" -> Noval | m -> Str m);
  primary_ctx "prepareParams" (fun c -> prepare_params_util c);
  primary_ctx "preparePath" (fun c -> Str (prepare_path_util c));
  primary_ctx "prepareQuery" (fun c -> prepare_query_util c);
  primary_ctx "resultBasic" (fun c -> result_basic_util c; result_value c.c_result);
  primary_ctx "resultBody" (fun c -> result_body_util c; result_value c.c_result);
  primary_ctx "resultHeaders" (fun c -> result_headers_util c; result_value c.c_result);
  primary_ctx "transformRequest" (fun c -> transform_request_util c);
  primary_ctx "transformResponse" (fun c -> transform_response_util c);


  (* A codec section a project's corpus has not pulled yet is skipped, as is
   * one for a codec this SDK was generated without. *)
  let runcodec name kind (present : bool) f =
    if not present then
      r.R.skipped <- (name ^ "." ^ kind ^ " (this SDK was generated without that codec)") :: r.R.skipped
    else
      R.runset_args r (name ^ "." ^ kind) (R.getset r [name; kind])
        (fun args ->
           let ctxmap = arg args 0 in
           let c = ctx_from cl ctxmap in
           (match R.getp ctxmap "options" with Map _ as o -> c.c_options <- o | _ -> ());
           (match R.getp (R.getp ctxmap "ctrl") "transfer" with
            | Map _ as t -> c.c_ctrl.ctrl_transfer <- t | _ -> ());
           let out = body_guarded f c in
           publish ctxmap c;
           out)
  in
  let boundary = u.u_multipart_boundary in
  u.u_multipart_boundary <- Some (fun _ -> "BOUNDARY");
  List.iter (fun (kind, present) ->
      runcodec "prepareBody" kind present (fun c ->
          sourced c;
          let sp = new_spec (jo [("headers", empty_map ())]) in
          c.c_spec <- Some sp;
          let body = match prepare_body_util c with Str b -> Str (of_latin1 b) | v -> v in
          match Sdk_binary.header_value sp.sp_headers "content-type" with
          | "" -> jo [("body", body)]
          | t -> jo [("type", Str t); ("body", body)]))
    [("form", Option.is_some u.u_codec.cd_form);
     ("multipart", Option.is_some u.u_codec.cd_multipart);
     ("raw", true)];
  u.u_multipart_boundary <- boundary;
  runcodec "resultBody" "raw" (Option.is_some u.u_codec.cd_raw) (fun c ->
      (match c.c_response with Some rs -> rs.rs_body <- debytes rs.rs_body | None -> ());
      result_body_util c;
      (match getp c.c_ctrl.ctrl_transfer "bytes" with
       | Str b -> setp c.c_ctrl.ctrl_transfer "bytes" (Str (of_latin1 b))
       | _ -> ());
      result_value c.c_result);
  runcodec "makeFetchDef" "encoded" true (fun c ->
      (match c.c_spec with
       | Some sp ->
         sp.sp_body <- debytes sp.sp_body;
         c.c_utility <- Some { u with u_make_url = (fun _ -> (sp.sp_url, None)) }
       | None -> ());
      match make_fetch_def_util c with
      | (fd, None) -> (match getp fd "body" with Str b -> setp fd "body" (Str (of_latin1 b)) | _ -> ()); fd
      | (_, Some e) -> raise (Failure e.err_msg));
  (* A source serialises as its description here, so that is what clean meets. *)
  let described v =
    let rec walk v = match v with
      | Map _ when getp v "source$" <> Noval ->
        (match marker_source v with Some s -> Sdk_binary.describe s | None -> v)
      | Map m -> let out = empty_map () in List.iter (fun (k, x) -> setp out k (walk x)) m.entries; out
      | List r -> ja (List.map walk !r)
      | v -> v in
    walk v in
  R.runset_args r "clean.binary" (R.getset r ["clean"; "binary"]) (fun args ->
        let ctxmap = arg args 0 in
        let c = ctx_from cl ctxmap in
        (match c.c_spec with Some sp -> sp.sp_body <- debytes sp.sp_body | None -> ());
        let v = arg args 1 in
        let v = match v with
          | Str "spec$" ->
            (* The spec as the corpus gives it: spec_to_value adds this port's defaults. *)
            (match c.c_spec with Some sp -> jo [("body", sp.sp_body); ("headers", sp.sp_headers)]
                                | None -> Noval)
          | v -> described v in
        u.u_clean c v);

  (* Sections that take a bare map or explicit args rather than a ctx. *)
  let primary_args name f =
    R.runset_args r name (R.getset r [name; "basic"]) (fun args -> run_guarded f args)
  in

  primary_args "makeContext" (fun args ->
      let inv = arg args 0 in
      let c = ctx_from cl inv in
      jo [("op", jo [("entity", Str c.c_op.op_entity); ("name", Str c.c_op.op_name);
                     ("input", Str c.c_op.op_input); ("points", c.c_op.op_points)])]);

  primary_args "makeOptions" (fun args ->
      let inv = arg args 0 in
      let c = ctx_from cl (jo []) in
      c.c_config <- R.getp inv "config";
      c.c_options <- R.getp inv "options";
      make_options_util c);

  primary_args "makeError" (fun args ->
      let a0 = arg args 0 in
      let a1 = arg args 1 in
      let c = ctx_from cl a0 in
      let msg = (match R.getp a1 "message" with Str m -> m | _ -> "") in
      let e = { err_code = ""; err_msg = msg; err_result = Noval; err_spec = Noval } in
      let out = make_error_util c (if msg = "" then None else Some e) in
      publish a0 c;
      out);

  primary_args "operator" (fun args ->
      let inv = arg args 0 in
      let op = new_operation inv in
      jo [("entity", Str op.op_entity); ("input", Str op.op_input);
          ("name", Str op.op_name); ("points", op.op_points)]);

  primary_args "param" (fun args ->
      let a0 = arg args 0 in
      let a1 = arg args 1 in
      let c = ctx_from cl a0 in
      let out = param_util c a1 in
      publish a0 c;
      out);

  R.report r "PRIMARY CORPUS: "
