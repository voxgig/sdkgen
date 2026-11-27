(* ProjectName SDK codec suite: every form, multipart and raw point, found in
 * the client's own config, driven through a real entity operation against a
 * local listener on its own thread. The SDK ships no transport, so
 * system.fetch here speaks HTTP/1.1 to the listener over a socket. *)

open Voxgig_struct
open Sdk_types
open Sdk_helpers

(* ---- the listener ---- *)

type arrival = { a_method : string; a_path : string; a_headers : (string * string) list;
                 a_body : string }

type answer = { an_status : int; an_type : string; an_body : string }

let lock = Mutex.create ()
let arrivals : arrival list ref = ref []
let current = ref { an_status = 200; an_type = "application/json"; an_body = "" }

let read_all (fd : Unix.file_descr) : string =
  let b = Buffer.create 1024 and chunk = Bytes.create 4096 in
  let rec go () =
    match Unix.read fd chunk 0 4096 with
    | 0 -> ()
    | n -> Buffer.add_subbytes b chunk 0 n; go () in
  (try go () with Unix.Unix_error _ -> ());
  Buffer.contents b

let find (hay : string) (needle : string) (from : int) : int option =
  let n = String.length needle in
  let rec go i =
    if i + n > String.length hay then None
    else if String.sub hay i n = needle then Some i else go (i + 1) in
  go from

(* The head lines and the body of an HTTP message, by its content length. *)
let split_message (fd : Unix.file_descr) : string list * string =
  let b = Buffer.create 1024 and chunk = Bytes.create 4096 in
  let rec head () =
    match find (Buffer.contents b) "\r\n\r\n" 0 with
    | Some at -> at
    | None ->
      (match Unix.read fd chunk 0 4096 with
       | 0 -> failwith "the message ended in its head"
       | n -> Buffer.add_subbytes b chunk 0 n; head ()) in
  let at = head () in
  let text = Buffer.contents b in
  let lines = String.split_on_char '\n' (String.sub text 0 at)
              |> List.map (fun l -> String.trim l) in
  let length = List.fold_left (fun acc l ->
      match String.index_opt l ':' with
      | Some i when String.lowercase_ascii (String.sub l 0 i) = "content-length" ->
        int_of_string (String.trim (String.sub l (i + 1) (String.length l - i - 1)))
      | _ -> acc) 0 lines in
  let body = Buffer.create length in
  Buffer.add_string body (String.sub text (at + 4) (String.length text - at - 4));
  while Buffer.length body < length do
    match Unix.read fd chunk 0 4096 with
    | 0 -> failwith "the message ended in its body"
    | n -> Buffer.add_subbytes body chunk 0 n
  done;
  (lines, Buffer.contents body)

let header_pairs (lines : string list) : (string * string) list =
  List.filter_map (fun l ->
      match String.index_opt l ':' with
      | Some i -> Some (String.lowercase_ascii (String.sub l 0 i),
                        String.trim (String.sub l (i + 1) (String.length l - i - 1)))
      | None -> None) lines

let serve (sock : Unix.file_descr) : unit =
  while true do
    let (fd, _) = Unix.accept sock in
    (try
       let (lines, body) = split_message fd in
       let first = match lines with l :: _ -> String.split_on_char ' ' l | [] -> [] in
       let (meth, path) = match first with m :: p :: _ -> (m, p) | _ -> ("", "") in
       Mutex.lock lock;
       arrivals := !arrivals @ [{ a_method = meth; a_path = path;
                                  a_headers = header_pairs (List.tl lines); a_body = body }];
       let a = !current in
       Mutex.unlock lock;
       let out = Printf.sprintf "HTTP/1.1 %d OK\r\ncontent-type: %s\r\ncontent-length: %d\r\nconnection: close\r\n\r\n%s"
           a.an_status a.an_type (String.length a.an_body) a.an_body in
       ignore (Unix.write_substring fd out 0 (String.length out))
     with _ -> ());
    Unix.close fd
  done

let listen () : int =
  let sock = Unix.socket Unix.PF_INET Unix.SOCK_STREAM 0 in
  Unix.setsockopt sock Unix.SO_REUSEADDR true;
  Unix.bind sock (Unix.ADDR_INET (Unix.inet_addr_loopback, 0));
  Unix.listen sock 16;
  ignore (Thread.create serve sock);
  match Unix.getsockname sock with Unix.ADDR_INET (_, port) -> port | _ -> 0

(* ---- system.fetch over the socket ---- *)

let fetch (port : int) : value =
  Func (fun _ args _ _ ->
      let url = match getelem args (Num 0.) with Str s -> s | _ -> "" in
      let def = getelem args (Num 1.) in
      let path = match find url "://" 0 with
        | Some i -> (match String.index_from_opt url (i + 3) '/' with
            | Some j -> String.sub url j (String.length url - j)
            | None -> "/")
        | None -> url in
      let body = match getp def "body" with Str s -> s | Noval | Null -> "" | v -> json_encode v in
      let headers = getp def "headers" in
      let head = Buffer.create 256 in
      Buffer.add_string head (get_str_d def "method" "GET" ^ " " ^ path ^ " HTTP/1.1\r\n");
      Buffer.add_string head ("host: 127.0.0.1:" ^ string_of_int port ^ "\r\n");
      List.iter (fun k ->
          match getp headers k with
          | Str v -> Buffer.add_string head (k ^ ": " ^ v ^ "\r\n")
          | _ -> ()) (keysof headers);
      Buffer.add_string head ("content-length: " ^ string_of_int (String.length body) ^
                              "\r\nconnection: close\r\n\r\n");
      let fd = Unix.socket Unix.PF_INET Unix.SOCK_STREAM 0 in
      Unix.setsockopt_float fd Unix.SO_RCVTIMEO 10.;
      Unix.connect fd (Unix.ADDR_INET (Unix.inet_addr_loopback, port));
      let msg = Buffer.contents head ^ body in
      ignore (Unix.write_substring fd msg 0 (String.length msg));
      let (lines, rbody) = Fun.protect ~finally:(fun () -> Unix.close fd)
          (fun () -> split_message fd) in
      let status = match lines with
        | l :: _ -> (match String.split_on_char ' ' l with _ :: c :: _ -> int_of_string c | _ -> 0)
        | [] -> 0 in
      let rheaders = empty_map () in
      List.iter (fun (k, v) -> setp rheaders k (Str v)) (header_pairs (List.tl lines));
      jo [("status", vint_of status); ("statusText", Str "OK"); ("headers", rheaders);
          ("body", Str rbody);
          ("json", Func (fun _ _ _ _ -> if rbody = "" then Noval else Sdk_json.json_read rbody))])

(* ---- the cases ---- *)

let content (name : string) : string = "file:" ^ name ^ "\000\255\r\n--"

let params (point : value) : (string * value) list =
  match getp point "parts" with
  | List r ->
    List.filter_map (function
        | Str p when String.length p > 2 && p.[0] = '{' && p.[String.length p - 1] = '}' ->
          Some (String.sub p 1 (String.length p - 2), Str "p1")
        | _ -> None) !r
  | _ -> []

let action (point : value) : string option =
  match getp (getp point "select") "$action" with Str a -> Some a | _ -> None

let select (point : value) : (string * value) list =
  match action point with Some a -> [("$action", Str a)] | None -> []

exception Check of string

let check (what : string) (ok : bool) = if not ok then raise (Check what)

let check_eq (what : string) (got : string) (want : string) =
  if got <> want then raise (Check (what ^ ": got " ^ String.escaped got ^ ", want " ^ String.escaped want))

type expect = EValue of string * string | EFile of string * string * string * string

(* The data a form or multipart point is sent, the sources beside it, and
 * the parts it must arrive as. *)
let plan (body : value) =
  let form = getp body "kind" = Str "form" in
  let fields = match getp body "fields" with List r -> !r | _ -> [] in
  List.fold_left (fun (data, sources, expect) f ->
      let n = get_str_d f "name" "" in
      if getp f "binary" = Bool true then begin
        let type_ = if form then None
          else Some (match getp f "media" with Str m -> m | _ -> "application/octet-stream") in
        let src = Sdk_binary.bytes ~name:("/local/dir/" ^ n ^ ".bin") ?type_ (content n) in
        (data, sources @ [(n, src)],
         expect @ [if form then EValue (n, content n)
                   else EFile (n, content n, n ^ ".bin", Option.value type_ ~default:"")])
      end
      else if getp f "list" = Bool true then
        (data @ [(n, ja [Str "a"; Str "b c"])], sources,
         expect @ [EValue (n, "a"); EValue (n, "b c")])
      else match getp f "join" with
        | Str sep ->
          (data @ [(n, ja [Str "a"; Str "b"])], sources, expect @ [EValue (n, "a" ^ sep ^ "b")])
        | _ ->
          let v = "v\"" ^ n ^ "\r\n" in
          (data @ [(n, Str v)], sources, expect @ [EValue (n, v)]))
    ([], [], []) fields

let unescape_form (s : string) : string =
  let b = Buffer.create (String.length s) in
  let i = ref 0 in
  while !i < String.length s do
    (match s.[!i] with
     | '+' -> Buffer.add_char b ' '
     | '%' -> Buffer.add_char b (Char.chr (int_of_string ("0x" ^ String.sub s (!i + 1) 2))); i := !i + 2
     | c -> Buffer.add_char b c);
    incr i
  done;
  Buffer.contents b

let form_items (body : string) : expect list =
  if body = "" then []
  else List.map (fun pair ->
      match String.index_opt pair '=' with
      | Some i -> EValue (unescape_form (String.sub pair 0 i),
                          unescape_form (String.sub pair (i + 1) (String.length pair - i - 1)))
      | None -> EValue (unescape_form pair, "")) (String.split_on_char '&' body)

let between (s : string) (pre : string) (post : char) : string option =
  match find s pre 0 with
  | Some i ->
    let at = i + String.length pre in
    let stop = match String.index_from_opt s at post with Some j -> j | None -> String.length s in
    Some (String.sub s at (stop - at))
  | None -> None

let multipart_items (arrived : arrival) : expect list =
  let ctype = Option.value (List.assoc_opt "content-type" arrived.a_headers) ~default:"" in
  let bnd = match between ctype "boundary=" ';' with Some b -> b | None -> raise (Check ("no boundary in " ^ ctype)) in
  let body = arrived.a_body in
  let close = "--" ^ bnd ^ "--\r\n" in
  check "the body closes" (String.length body >= String.length close &&
                           String.sub body (String.length body - String.length close)
                             (String.length close) = close);
  let delim = "--" ^ bnd in
  let rec chunks from acc =
    match find body delim from with
    | Some i ->
      let next = i + String.length delim in
      (match find body delim next with
       | Some j -> chunks j (acc @ [String.sub body next (j - next)])
       | None -> acc)
    | None -> acc in
  List.map (fun chunk ->
      let at = match find chunk "\r\n\r\n" 0 with Some a -> a | None -> raise (Check "a part has no head") in
      let head = String.sub chunk 2 (at - 2) in
      let part = String.sub chunk (at + 4) (String.length chunk - at - 6) in
      let name = match between head "name=\"" '"' with Some n -> n | None -> raise (Check "no name") in
      match between head "filename=\"" '"' with
      | None -> EValue (name, part)
      | Some file ->
        EFile (name, part, file, Option.value (between head "Content-Type: " '\r') ~default:""))
    (chunks 0 [])

let item_name = function EValue (n, _) | EFile (n, _, _, _) -> n

let show = function
  | EValue (n, v) -> n ^ "=" ^ String.escaped v
  | EFile (n, v, f, t) -> n ^ "=<" ^ f ^ " " ^ t ^ " " ^ String.escaped v ^ ">"

let check_items (got : expect list) (want : expect list) =
  let got = List.filter (fun g -> List.exists (fun w -> item_name w = item_name g) want) got in
  check_eq "parts" (String.concat "; " (List.map show got)) (String.concat "; " (List.map show want))

let run_op (ent : entity_obj) (op : string) ?sources (data : value) : entity_obj =
  match op with
  | "create" -> ent.e_create ?sources data Noval
  | "update" -> ent.e_update ?sources data Noval
  | "patch" -> ent.e_patch ?sources data Noval
  | "load" -> ent.e_load data Noval
  | other -> raise (Check ("no op " ^ other))

let answer (a : answer) = Mutex.lock lock; current := a; Mutex.unlock lock

let arrived () : arrival =
  Mutex.lock lock;
  let all = !arrivals in
  Mutex.unlock lock;
  match List.rev all with a :: _ -> a | [] -> raise (Check "nothing arrived")

let json_answer = { an_status = 200; an_type = "application/json"; an_body = "{\"id\":\"p1\"}" }

let at_params (ent : entity_obj) (point : value) =
  ent.e_data_set (jo (params point));
  ent.e_match_set (jo (params point))

let cases (client : unit -> sdk_client) : (string * (unit -> unit)) list =
  let config = Sdk_config.make_config () in
  let entities = getp config "entity" in
  List.concat_map (fun ename ->
      let ops = getp (getp entities ename) "op" in
      List.concat_map (fun opname ->
          let points = match getp (getp ops opname) "points" with List r -> !r | _ -> [] in
          List.concat_map (fun point ->
              let label = ename ^ "." ^ opname ^
                          (match action point with Some a -> ":" ^ a | None -> "") in
              let entity () = match Sdk_client.entity (client ()) ename Noval with
                | Some e -> e
                | None -> raise (Check ("no entity " ^ ename)) in
              let rb = getp point "body" and rs = getp point "response" in
              let writes = List.mem opname ["create"; "update"; "patch"] in
              let kind = get_str_d rb "kind" "" in
              let encoded =
                if writes && (kind = "form" || kind = "multipart") then
                  [(label ^ " sends a " ^ kind ^ " body", fun () ->
                       let (data, sources, expect) = plan rb in
                       answer json_answer;
                       let ent = entity () in
                       ignore (run_op ent opname ~sources (jo (params point @ select point @ data)));
                       let a = arrived () in
                       if kind = "form" then begin
                         check_eq "content-type"
                           (Option.value (List.assoc_opt "content-type" a.a_headers) ~default:"")
                           (get_str_d rb "media" "");
                         check_items (form_items a.a_body) expect
                       end
                       else check_items (multipart_items a) expect)]
                else [] in
              let raw_sent =
                if writes && kind = "raw" then
                  let binary = getp rb "binary" = Bool true in
                  [(label ^ " sends a raw " ^ (if binary then "binary" else "text") ^ " body", fun () ->
                       answer json_answer;
                       let ent = entity () in
                       at_params ent point;
                       if binary then begin
                         let src = Sdk_binary.bytes ?type_:(get_str rb "media") (content label) in
                         let got = (ent.e_binary (action point)).bh_put src in
                         check "put resolves to the entity" (got == ent);
                         check_eq "body" (arrived ()).a_body (content label)
                       end
                       else begin
                         let text = "text \"" ^ label ^ "\"\n" in
                         ignore (run_op ent opname (jo (select point @ [("$body", Str text)])));
                         check_eq "body" (arrived ()).a_body text
                       end;
                       check_eq "content-type"
                         (Option.value (List.assoc_opt "content-type" (arrived ()).a_headers) ~default:"")
                         (get_str_d rb "media" ""))]
                else [] in
              let raw_read =
                if opname = "load" && get_str_d rs "kind" "" = "raw" then
                  let binary = getp rs "binary" = Bool true in
                  [(label ^ " reads a raw " ^ (if binary then "binary" else "text") ^ " body", fun () ->
                       let ent = entity () in
                       at_params ent point;
                       let media = get_str_d rs "media" "" in
                       if binary then begin
                         answer { an_status = 200; an_type = media; an_body = content label };
                         check_eq "bytes" ((ent.e_binary (action point)).bh_bytes ()) (content label);
                         let code = try ignore (run_op ent "load" (jo (params point @ select point))); ""
                           with Sdk_error_exc e -> e.err_code in
                         check_eq "the plain op" code "binary_sink_required"
                       end
                       else begin
                         answer { an_status = 200; an_type = media; an_body = "caf\195\169 " ^ label };
                         let got = run_op ent "load" (jo (params point @ select point)) in
                         check "load resolves to the entity" (got == ent);
                         check_eq "$body" (get_str_d (ent.e_data_get ()) "$body" "") ("caf\195\169 " ^ label)
                       end)]
                else [] in
              encoded @ raw_sent @ raw_read) points)
        (List.sort compare (keysof ops)))
    (List.sort compare (keysof entities))

let () =
  let port = listen () in
  let base = "http://127.0.0.1:" ^ string_of_int port in
  let client () = Sdk_client.make (jo [("base", Str base); ("system", jo [("fetch", fetch port)])]) in
  let all = cases client in
  let ran = ref 0 and failed = ref 0 in
  if all = [] then print_endline "FAIL this SDK has a point to drive: no form, multipart or raw point was found";
  List.iter (fun (name, run) ->
      incr ran;
      Mutex.lock lock; arrivals := []; Mutex.unlock lock;
      match run () with
      | () -> print_endline ("PASS " ^ name)
      | exception e ->
        incr failed;
        print_endline ("FAIL " ^ name ^ " :: " ^
                       (match e with Check m -> m | e -> Printexc.to_string e))) all;
  Printf.printf "codec: ran %d case(s), %d failed\n%!" !ran !failed;
  exit (if all = [] || !failed > 0 then 1 else 0)
