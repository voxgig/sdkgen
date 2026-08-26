(* ProjectName SDK primary-utility corpus.
 *
 * Drives the SHARED language-neutral corpus (.sdk/test/test.json -> "primary")
 * through this SDK's request-shaping utilities, so the cases cannot drift from
 * the reference implementation. Each section is looked up with getSpec and
 * executed with runset, as the ts/js reference harness does.
 *
 * ocaml had NO primary-utility suite at all before this: its request-shaping
 * utilities were unverified in every language-neutral sense. The harness is
 * Corpus_runner, shared with the struct corpus.
 *)

open Voxgig_struct
open Sdk_types
open Sdk_helpers
open Sdk_runtime
open Corpus_runner

let client () : sdk_client = Sdk_client.test ()

(* A client built from a section's DEF.setup.a block. prepare_auth reads the
 * CLIENT's options, as the ts reference does via client.options(), so a
 * section's setup cannot reach it through ctx.options. *)
let client_for primary name =
  let setup =
    List.fold_left (fun acc k -> getprop_raw_pub acc k) primary [name; "DEF"; "setup"; "a"]
  in
  match setup with
  | Map _ -> Sdk_client.test_with Noval setup
  | _ -> Sdk_client.test ()

let getspec root path =
  List.fold_left (fun acc k -> getprop_raw_pub acc k) root path

(* A LIVE context from a corpus map. The utilities read and MUTATE spec,
 * result and response through their record types, so a bare value map leaves
 * them nothing to work on and every match reads null. *)
let ctx_from (cl : sdk_client) (ctxmap : value) : ctx =
  let u = cl.cl_utility in
  (* The corpus names the op — {"ctx": {"opname": "create"}} — and
   * prepare_method reads it. Hardcoding "load" made every method GET. *)
  let opname =
    match getprop_raw_pub ctxmap "opname" with Str s -> s | _ -> "load"
  in
  let c =
    u.u_make_context
      { (default_ctxspec ()) with cs_opname = Some opname }
      cl.cl_rootctx
  in
  (match getprop_raw_pub ctxmap "spec" with
   | Map _ as m -> c.c_spec <- Some (new_spec m)
   | _ -> ());
  (match getprop_raw_pub ctxmap "result" with
   | Map _ as m -> c.c_result <- Some (new_result m)
   | _ -> ());
  (match getprop_raw_pub ctxmap "response" with
   | Map _ as m ->
     let r = new_response m in
     (* result_body_util reads response.json and requires it to be CALLABLE;
      * the corpus supplies a plain `body`, so wrap it, as the lua and elixir
      * drivers do. Without this every ctx.result.body match reads empty. *)
     (match getprop_raw_pub m "body" with
      | Noval -> ()
      | b -> r.rs_json <- Func (fun _ _ _ _ -> b));
     c.c_response <- Some r
   | _ -> ());
  (match getprop_raw_pub ctxmap "point" with
   | Map _ as m -> c.c_point <- m
   | _ -> ());
  (match getprop_raw_pub ctxmap "reqdata" with Noval -> () | v -> c.c_reqdata <- v);
  (match getprop_raw_pub ctxmap "reqmatch" with Noval -> () | v -> c.c_reqmatch <- v);
  (match getprop_raw_pub ctxmap "data" with Noval -> () | v -> c.c_data <- v);
  (match getprop_raw_pub ctxmap "match" with Noval -> () | v -> c.c_match <- v);
  c

(* The corpus speaks camelCase; this port stores rs_status_text / rt_ok. A
 * neutral-named view is what the match assertions read. *)
let result_value (r : result option) : value =
  match r with
  | None -> Noval
  | Some rt -> result_to_value rt

let ctx_arg args = match args with x :: _ -> x | [] -> Noval

(* Publish the MUTATED ctx back onto the corpus map the match reads.
 * check_result matches against entry.ctx, which is the raw corpus map; the
 * utilities mutate the live records beside it, so without this every
 * `match: ctx.spec.*` / `ctx.result.*` assertion reads empty. Neutral names,
 * because the corpus is camelCase and this port stores rs_status_text/rt_ok. *)
let publish (ctxmap : value) (c : ctx) =
  (match c.c_spec with
   | Some sp -> ignore (setprop ctxmap (Str "spec") (spec_to_value sp))
   | None -> ());
  (match c.c_result with
   | Some _ -> ignore (setprop ctxmap (Str "result") (result_value c.c_result))
   | None -> ());
  (match c.c_response with
   | Some _ -> ignore (setprop ctxmap (Str "response") (Str "__EXISTS__"))
   | None -> ());
  ()

let () =
  let testfile = if Array.length Sys.argv > 1 then Sys.argv.(1) else "../.sdk/test/test.json" in
  let ic = open_in_bin testfile in
  let len = in_channel_length ic in
  let raw = really_input_string ic len in
  close_in ic;
  let alltests = json_read raw in
  let primary = getprop_raw_pub alltests "primary" in

  let cl = client () in
  let u = cl.cl_utility in

  (* Sections configured by their own DEF.setup block get their own client. *)
  let ctx_section_with cl2 name f =
    run_set name (getspec primary [name; "basic"])
      (fun args ->
         let ctxmap = ctx_arg args in
         let c = ctx_from cl2 ctxmap in
         let out = f c in
         publish ctxmap c;
         out)
  in

  let ctx_section name f =
    run_set name (getspec primary [name; "basic"])
      (fun args ->
         let ctxmap = ctx_arg args in
         let c = ctx_from cl ctxmap in
         let out = f c in
         publish ctxmap c;
         out)
  in

  ctx_section "done" (fun c -> u.u_done c);
  ctx_section "makeUrl" (fun c -> match make_url_util c with (s, _) -> Str s);
  ctx_section "makeRequest"
    (fun c -> ignore (make_request_util c); result_value c.c_result);
  ctx_section "makeResponse"
    (fun c -> ignore (make_response_util c); result_value c.c_result);
  ctx_section_with (client_for primary "makeSpec") "makeSpec"
    (fun c -> match make_spec_util c with
       | (Some s, _) -> spec_to_value s | _ -> Noval);
  ctx_section_with (client_for primary "prepareAuth") "prepareAuth"
    (fun c -> ignore (prepare_auth_util c);
      match c.c_spec with Some s -> spec_to_value s | None -> Noval);
  ctx_section "prepareBody" (fun c -> prepare_body_util c);
  ctx_section "prepareHeaders" (fun c -> prepare_headers_util c);
  ctx_section "prepareMethod"
    (fun c -> match prepare_method_util c with "" -> Noval | m -> Str m);
  ctx_section "prepareParams" (fun c -> prepare_params_util c);
  ctx_section "preparePath" (fun c -> Str (prepare_path_util c));
  ctx_section "prepareQuery" (fun c -> prepare_query_util c);
  ctx_section "resultBasic" (fun c -> result_basic_util c; result_value c.c_result);
  ctx_section "resultBody" (fun c -> result_body_util c; result_value c.c_result);
  ctx_section "resultHeaders" (fun c -> result_headers_util c; result_value c.c_result);
  ctx_section "transformRequest" (fun c -> transform_request_util c);
  ctx_section "transformResponse" (fun c -> transform_response_util c);

  List.iter print_endline (List.rev !failures);
  Printf.printf "\nPRIMARY CORPUS: PASS %d  FAIL %d\n" !npass !nfail;
  (* A run that executes nothing is not a pass. *)
  if !npass = 0 then (print_endline "the primary corpus executed no cases"; exit 1);
  if !nfail > 0 then exit 1
