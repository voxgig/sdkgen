(* ProjectName SDK raw codec: a response body read whole, to a bound. *)

open Voxgig_struct
open Sdk_types
open Sdk_helpers

let default_max = 16777216

let max_buffer (ctx : ctx) : int =
  let pick v = match v with Num n when Float.is_finite n && 0. <= n -> Some (int_of_float n) | _ -> None in
  match pick (getp ctx.c_options "maxBuffer") with
  | Some n -> n
  | None ->
    (match pick (getp (Sdk_schema.opt_spec_value ()) "maxBuffer") with
     | Some n -> n
     | None -> default_max)

let too_large (code : string) (max : int) (declared : int option) : exn =
  Body_error (mk_error code
                ("response: body " ^
                 (match declared with
                  | Some n -> "of " ^ string_of_int n ^ " bytes exceeds"
                  | None -> "is longer than") ^
                 " maxBuffer (" ^ string_of_int max ^ " bytes)"))

let digits (s : string) : bool =
  s <> "" && String.for_all (fun c -> '0' <= c && c <= '9') s

(* What system.fetch returned as the body: a string, a list of chunks, or a
 * reader called for each next chunk until it answers none. Refused past the
 * bound by its declared length before a chunk is taken, else by the count. *)
let read_bounded (response : response) (max : int) (code : string) : string =
  let length = String.trim (Sdk_binary.header_value response.rs_headers "content-length") in
  (match int_of_string_opt length with
   | Some n when digits length && max < n -> raise (too_large code max (Some n))
   | _ -> ());
  let out = Buffer.create 256 in
  let take chunk =
    let bytes = match chunk with Str s -> s | v -> Sdk_binary.item_text v in
    if max < Buffer.length out + String.length bytes then raise (too_large code max None);
    Buffer.add_string out bytes in
  (match response.rs_body with
   | Noval | Null -> ()
   | List r -> List.iter take !r
   | Func _ as reader ->
     let rec loop () =
       match call_vfn reader Noval with
       | Noval | Null -> ()
       | chunk -> take chunk; loop () in
     loop ()
   | v -> take v);
  Buffer.contents out

(* A raw success body: text into the record under `$body`; bytes only into a
 * binary handle's read, never into the record. *)
let read (ctx : ctx) : unit =
  match ctx.c_response, ctx.c_result with
  | Some response, Some result ->
    let max = max_buffer ctx in
    if getp (getp ctx.c_point "response") "binary" = Bool true then begin
      result.rt_body <- Noval;
      let transfer = ctx.c_ctrl.ctrl_transfer in
      if getp transfer "direction" = Str "read" then
        setp transfer "bytes" (Str (read_bounded response max "binary_too_large"))
    end
    else
      result.rt_body <- jo [(Sdk_binary.raw_body_key,
                             Str (read_bounded response max "response_too_large"))]
  | _ -> ()
