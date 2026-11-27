(* ProjectName SDK multipart codec: multipart/form-data. *)

open Voxgig_struct
open Sdk_types
open Sdk_helpers

let multipart_media = "multipart/form-data"
let octet_media = "application/octet-stream"
let crlf = "\r\n"

(* The stdlib holds no cryptographic generator, and core opens no file, so
 * the bits come from a state seeded by the runtime's own system entropy. *)
let boundary (_ : ctx) : string =
  let st = Random.State.make_self_init () in
  String.concat "" (List.init 16 (fun _ -> Printf.sprintf "%02x" (Random.State.int st 256)))

(* Inside a quoted header parameter nothing may end the quote or the line. *)
let quoted (text : string) : string =
  let b = Buffer.create (String.length text) in
  String.iter (fun c ->
      match c with
      | '\\' -> Buffer.add_string b "%5C"
      | '"' -> Buffer.add_string b "%22"
      | '\r' -> Buffer.add_string b "%0D"
      | '\n' -> Buffer.add_string b "%0A"
      | c -> Buffer.add_char b c) text;
  Buffer.contents b

(* A local path never leaves: only its last segment, and nothing for an
 * empty one. *)
let base_name (name : string option) : string option =
  match name with
  | None -> None
  | Some n ->
    let cut = match String.rindex_opt n '/', String.rindex_opt n '\\' with
      | Some a, Some b -> max a b + 1
      | Some a, None | None, Some a -> a + 1
      | None, None -> 0 in
    (match String.sub n cut (String.length n - cut) with "" -> None | base -> Some base)

type part = { p_filename : string option; p_type : string option; p_content : string }

let field_media (field : value) : string option =
  match getp field "media" with Str m -> Some m | _ -> None

(* No stream exists to refuse here: a string is the only carrier. *)
let file_part (field : value) (l : lifted) : part =
  match l with
  | LSource s ->
    { p_filename = base_name s.bs_name;
      p_type = (match s.bs_type with Some t -> Some t
                                   | None -> Some (Option.value (field_media field) ~default:octet_media));
      p_content = s.bs_data }
  | LValue v ->
    { p_filename = None;
      p_type = Some (Option.value (field_media field) ~default:octet_media);
      p_content = Sdk_binary.item_text v }

let text_part (field : value) (l : lifted) : part =
  { p_filename = None; p_type = field_media field;
    p_content = (match l with LSource s -> s.bs_data | LValue v -> Sdk_binary.item_text v) }

let has_break (s : string) : bool = String.contains s '\r' || String.contains s '\n'

let encode (ctx : ctx) (data : value) (lifted : (string * lifted) list)
  : (string * string, sdk_error) Stdlib.result =
  let body = getp ctx.c_point "body" in
  let u = cu ctx in
  let custom = getp u.u_custom "multipartBoundary" in
  let bnd = match custom, u.u_multipart_boundary with
    | Func _, _ -> (match call_vfn custom Noval with Str s -> s | _ -> boundary ctx)
    | _, Some f -> f ctx
    | _, None -> boundary ctx in
  let out = Buffer.create 256 in
  let rec go = function
    | [] -> None
    | (it : Sdk_binary.body_item) :: rest ->
      let p = if it.it_binary then file_part it.it_field it.it_value
        else text_part it.it_field it.it_value in
      (match p.p_type with
       | Some t when has_break t ->
         Some (mk_error "binary_source_refused"
                 ("The media type of the multipart field \"" ^ it.it_name ^
                  "\" contains a line break."))
       | _ ->
         Buffer.add_string out ("--" ^ bnd ^ crlf ^
                                "Content-Disposition: form-data; name=\"" ^ quoted it.it_name ^ "\"" ^
                                (match p.p_filename with
                                 | Some f -> "; filename=\"" ^ quoted f ^ "\""
                                 | None -> "") ^ crlf ^
                                (match p.p_type with Some t -> "Content-Type: " ^ t ^ crlf | None -> "") ^
                                crlf);
         Buffer.add_string out p.p_content;
         Buffer.add_string out crlf;
         go rest) in
  match go (Sdk_binary.body_items body data lifted) with
  | Some err -> Error err
  | None ->
    Buffer.add_string out ("--" ^ bnd ^ "--" ^ crlf);
    let declared = match getp body "media" with
      | Str m -> String.trim (List.hd (String.split_on_char ';' m))
      | _ -> "" in
    Ok ((if declared = "" then multipart_media else declared) ^ "; boundary=" ^ bnd,
        Buffer.contents out)
