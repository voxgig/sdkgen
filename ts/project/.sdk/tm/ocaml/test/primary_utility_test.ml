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

let getspec root path =
  List.fold_left (fun acc k -> getprop_raw_pub acc k) root path

(* A LIVE context from a corpus map. The utilities read and MUTATE spec,
 * result and response through their record types, so a bare value map leaves
 * them nothing to work on and every match reads null. *)
let ctx_from (cl : sdk_client) (ctxmap : value) : ctx =
  let u = cl.cl_utility in
  let c =
    u.u_make_context
      { (default_ctxspec ()) with cs_opname = Some "load" }
      cl.cl_rootctx
  in
  (match getprop_raw_pub ctxmap "spec" with
   | Map _ as m -> c.c_spec <- Some (new_spec m)
   | _ -> ());
  (match getprop_raw_pub ctxmap "result" with
   | Map _ as m -> c.c_result <- Some (new_result m)
   | _ -> ());
  (match getprop_raw_pub ctxmap "response" with
   | Map _ as m -> c.c_response <- Some (new_response m)
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

  let ctx_section name f =
    run_set name (getspec primary [name; "basic"])
      (fun args -> f (ctx_from cl (ctx_arg args)))
  in

  ctx_section "done" (fun c -> u.u_done c);
  ctx_section "makeUrl" (fun c -> match make_url_util c with (s, _) -> Str s);
  ctx_section "makeRequest"
    (fun c -> ignore (make_request_util c); result_value c.c_result);
  ctx_section "makeResponse"
    (fun c -> ignore (make_response_util c); result_value c.c_result);
  ctx_section "makeSpec"
    (fun c -> match make_spec_util c with
       | (Some s, _) -> spec_to_value s | _ -> Noval);
  ctx_section "prepareAuth"
    (fun c -> ignore (prepare_auth_util c);
      match c.c_spec with Some s -> spec_to_value s | None -> Noval);
  ctx_section "prepareBody" (fun c -> prepare_body_util c);
  ctx_section "prepareHeaders" (fun c -> prepare_headers_util c);
  ctx_section "prepareMethod" (fun c -> Str (prepare_method_util c));
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
