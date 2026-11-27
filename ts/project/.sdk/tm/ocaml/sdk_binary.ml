(* ProjectName SDK file content: the source a caller builds, the lift of a
 * point's binary fields out of the request data, and the items a form or
 * multipart body carries. Nothing here reads a path. *)

open Voxgig_struct
open Sdk_types
open Sdk_helpers

let raw_body_key = "$body"

(* The one source core builds. A string is its own bytes: OCaml's string is
 * the byte carrier, so UTF-8 text is already its encoding. *)
let bytes ?name ?type_ (data : string) : binary_source =
  { bs_data = data; bs_name = name;
    bs_type = (match type_ with Some "" -> None | t -> t) }

(* A source serialised anywhere is described, never copied. *)
let describe (src : binary_source) : value =
  let desc = jo [("binary$", Str "bytes"); ("size", vint_of (String.length src.bs_data))] in
  (match src.bs_type with Some t -> setp desc "type" (Str t) | None -> ());
  desc

let header_value (headers : value) (name : string) : string =
  let want = String.lowercase_ascii name in
  match List.find_opt (fun k -> String.lowercase_ascii k = want) (keysof headers) with
  | Some k ->
    (match getp headers k with
     | Str s -> s
     | Noval | Null -> ""
     | v -> js_string v)
  | None -> ""

(* The data keys whose values are file content: a multipart or form body's
 * binary fields, and the whole of a raw body. *)
let binary_names (point : value) : string list =
  let body = getp point "body" in
  match getp body "kind" with
  | Str "raw" -> [raw_body_key]
  | Str ("multipart" | "form") ->
    (match getp body "fields" with
     | List r ->
       List.filter_map (fun f ->
           match getp f "binary", getp f "name" with
           | Bool true, Str n -> Some n
           | _ -> None) !r
     | _ -> [])
  | _ -> []

let source_refused (where : string) : sdk_error =
  mk_error "binary_source_refused"
    ("A binary source was passed in \"" ^ where ^
     "\", which is not a field the operation declares binary.")

(* Closed union: a source cannot sit inside the data, so there is nothing to
 * walk for one. A source passed under a name the point does not declare
 * binary is refused instead; a data value under a binary name is content. *)
let lift_sources (ctx : ctx) : sdk_error option =
  match ctx.c_sources with
  | Some _ -> None
  | None ->
    let names = binary_names ctx.c_point in
    match List.find_opt (fun (n, _) -> not (List.mem n names)) ctx.c_given with
    | Some (n, _) -> Some (source_refused n)
    | None ->
      let reqdata = ctx.c_reqdata in
      let keys = match reqdata with Map _ -> keysof reqdata | _ -> [] in
      let present = List.filter (fun n -> List.mem n keys) names in
      let from_data = List.filter_map (fun n ->
          if List.mem_assoc n ctx.c_given then None
          else Some (n, LValue (getp reqdata n))) present in
      if present <> [] then begin
        let copy = empty_map () in
        List.iter (fun k -> if not (List.mem k present) then setp copy k (getp reqdata k)) keys;
        ctx.c_reqdata <- copy
      end;
      ctx.c_sources <- Some (List.map (fun (n, s) -> (n, LSource s)) ctx.c_given @ from_data);
      None

(* A response the model declares to be bytes is read only through the
 * entity's binary handle, never into its data. *)
let bytes_refused (ctx : ctx) : sdk_error option =
  let response = getp ctx.c_point "response" in
  match getp response "kind", getp response "binary", ctx.c_ctrl.ctrl_transfer with
  | Str "raw", Bool true, (Noval | Null) ->
    let slot = match getp (getp ctx.c_point "select") "$action" with
      | Str a -> "Some \"" ^ a ^ "\""
      | _ -> "None" in
    Some (mk_error "binary_sink_required"
            ("Operation \"" ^ ctx.c_op.op_name ^ "\" on entity \"" ^ ctx.c_op.op_entity ^
             "\" answers bytes, which never enter the entity's data: read them with " ^
             "(entity.e_binary (" ^ slot ^ ")).bh_bytes ()."))
  | _ -> None

type body_item = {
  it_name : string;
  it_field : value;
  it_value : lifted;
  it_binary : bool;
}

(* A plain value as the text of a form pair or a multipart part. *)
let item_text (v : value) : string =
  match v with
  | Str s -> s
  | Num n when is_integer_f n -> Printf.sprintf "%.0f" n
  | Num n -> num_to_string n
  | Bool b -> if b then "true" else "false"
  | _ -> json_encode v

(* The values a form or multipart body carries, in wire order: the fields the
 * model declares, in its order, then any other key of the data, in code
 * point order. An array repeats its field per item, or is one value joined
 * by the field's `join`; an absent or null value sends nothing. *)
let body_items (body : value) (data : value) (lifted : (string * lifted) list) : body_item list =
  let fields = match getp body "fields" with
    | List r -> List.filter (fun f -> match getp f "name" with Str _ -> true | _ -> false) !r
    | _ -> [] in
  let fname f = match getp f "name" with Str n -> n | _ -> "" in
  let declared = List.map fname fields in
  let keys = match data with Map _ -> keysof data | _ -> [] in
  let names =
    List.filter (fun n -> List.mem n keys || List.mem_assoc n lifted) declared
    @ List.sort compare (List.filter (fun k -> not (List.mem k declared)) keys) in
  List.concat_map (fun name ->
      let field = match List.find_opt (fun f -> fname f = name) fields with
        | Some f -> f
        | None -> jo [("name", Str name)] in
      let file = getp field "binary" = Bool true in
      let item v = { it_name = name; it_field = field; it_value = v; it_binary = file } in
      let of_value v = match v with
        | Noval | Null -> []
        | List r ->
          let present = List.filter (fun x -> not (is_nullish x)) !r in
          (match getp field "join" with
           | Str sep when not file ->
             [item (LValue (Str (String.concat sep (List.map item_text present))))]
           | _ -> List.map (fun x -> item (LValue x)) present)
        | v -> [item (LValue v)] in
      match List.filter (fun (n, _) -> n = name) lifted with
      | [] -> of_value (getp data name)
      | given ->
        List.concat_map (fun (_, l) -> match l with
            | LSource _ -> [item l]
            | LValue v -> of_value v) given)
    names
