(* ProjectName SDK binary handle over an entity's slots. *)

open Voxgig_struct
open Sdk_types
open Sdk_helpers

(* A slot the entity component derived from the model: the action whose
 * points move its bytes ("" for the entity's own), and the operations that
 * read and write them. *)
type slot_def = { sl_action : string; sl_read : string option; sl_write : string option }

let fail (code : string) (msg : string) = raise (Sdk_error_exc (mk_error code msg))

(* The caller's control, plus the transfer record the read fills. *)
let with_transfer (ctrl : value) (transfer : value) : value =
  let out = empty_map () in
  (match ctrl with Map _ -> List.iter (fun k -> setp out k (getp ctrl k)) (keysof ctrl) | _ -> ());
  setp out "transfer" transfer;
  out

let make (ent : entity_obj) (slots : (string * slot_def) list) (slot : string option)
  : binary_handle =
  let name = Option.value slot ~default:"" in
  let def = List.assoc_opt name slots in
  let inactive what () =
    fail "binary_feature_inactive"
      ("The binary slot \"" ^ name ^ "\" of entity \"" ^ ent.e_name ^ "\" cannot " ^ what ^
       " without the binary feature; in core it answers bytes() and put().") in
  let direction way =
    match def with
    | None -> fail "binary_slot_unknown"
                ("Entity \"" ^ ent.e_name ^ "\" has no binary slot \"" ^ name ^ "\".")
    | Some d ->
      (match (if way = "read" then d.sl_read else d.sl_write) with
       | Some op -> (d, op)
       | None -> fail "binary_slot_direction"
                   ("The binary slot \"" ^ name ^ "\" of entity \"" ^ ent.e_name ^
                    "\" cannot be " ^ (if way = "read" then "read" else "written") ^ ".")) in
  let select d = if d.sl_action = "" then empty_map () else jo [("$action", Str d.sl_action)] in
  {
    bh_name = name;
    bh_bytes = (fun ?range ?(ctrl = Noval) () ->
        (match range with Some _ -> inactive "read a range" () | None -> ());
        let (d, op) = direction "read" in
        let transfer = jo [("slot", Str name); ("direction", Str "read")] in
        (match op with
         | "load" -> ignore (ent.e_load (select d) (with_transfer ctrl transfer))
         | other -> fail "binary_slot_direction" ("A binary slot cannot be read by " ^ other ^ "."));
        match getp transfer "bytes" with Str s -> s | _ -> "");
    bh_put = (fun ?(ctrl = Noval) src ->
        let (d, op) = direction "write" in
        let transfer = jo [("slot", Str name); ("direction", Str "write")] in
        let sources = [(Sdk_binary.raw_body_key, src)] in
        let ctrl = with_transfer ctrl transfer in
        let run = match op with
          | "create" -> ent.e_create | "patch" -> ent.e_patch | _ -> ent.e_update in
        ignore (run ~sources (select d) ctrl);
        ent);
    bh_save = inactive "save";
    bh_stream = inactive "stream";
    bh_open = inactive "open";
  }
