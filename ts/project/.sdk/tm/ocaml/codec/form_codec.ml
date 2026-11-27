(* ProjectName SDK form codec: application/x-www-form-urlencoded. *)

open Voxgig_struct
open Sdk_types
open Sdk_helpers

let form_media = "application/x-www-form-urlencoded"

(* Alphanumerics and `*-._` as they are, a space as `+`, every other byte
 * as %HH. *)
let escape (bytes : string) : string =
  let b = Buffer.create (String.length bytes) in
  String.iter (fun c ->
      match c with
      | '0'..'9' | 'A'..'Z' | 'a'..'z' | '*' | '-' | '.' | '_' -> Buffer.add_char b c
      | ' ' -> Buffer.add_char b '+'
      | c -> Buffer.add_string b (Printf.sprintf "%%%02X" (Char.code c))) bytes;
  Buffer.contents b

(* No blob or stream exists to refuse here: a string is the only carrier. *)
let value_bytes (l : lifted) : string =
  match l with
  | LSource s -> s.bs_data
  | LValue v -> Sdk_binary.item_text v

let encode (ctx : ctx) (data : value) (lifted : (string * lifted) list)
  : (string * string, sdk_error) Stdlib.result =
  let body = getp ctx.c_point "body" in
  let pairs = List.map (fun (it : Sdk_binary.body_item) ->
      escape it.it_name ^ "=" ^ escape (value_bytes it.it_value))
      (Sdk_binary.body_items body data lifted) in
  let media = match getp body "media" with Str m when m <> "" -> m | _ -> form_media in
  Ok (media, String.concat "&" pairs)
