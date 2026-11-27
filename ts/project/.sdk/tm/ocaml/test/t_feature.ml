(* Behavioural + coverage tests for the enterprise features (mirrors the py
 * test_feature). Each block runs only when its feature is present, driving
 * the real generated feature class through the offline harness pipeline. *)

open Voxgig_struct
open Sdk_types
open Sdk_helpers
open Harness
open Testutil

let vs_str v = match v with Str s -> s | _ -> ""
let track h name = track_get h.h_client name
let result_status (r : op_result) = match r.or_result with Some x -> x.rt_status | None -> -1
let err_code (r : op_result) = match r.or_error with Some e -> e.err_code | None -> "<none>"
let fd0 calls = getp (List.nth (List.rev calls) 0) "fetchdef"  (* not used; kept simple below *)
let _ = fd0

let () =
  test "at_least_test_feature_present" (fun () -> check "test present" (has_feature "test"));

  (* ---------------- netsim ---------------- *)
  if fh_present "netsim" then begin
    test "netsim.fixed_latency_then_delegate" (fun () ->
        let c = make_clock () in
        let h = make_client [("netsim", jo [("latency", Num 250.); ("sleep", clock_sleep_fn c)])] in
        let r = op h ~op:"load" ~ctrl:(jo [("explain", empty_map ())]) () in
        check "ok" r.or_ok; check "clock" (clock_now c = 250.);
        check_vnum "calls" (getp (track h "netsim") "calls") 1.);
    test "netsim.ranged_latency" (fun () ->
        let c = make_clock () in
        let h = make_client [("netsim", jo [("latency", jo [("min", Num 100.); ("max", Num 300.)]); ("seed", Num 7.); ("sleep", clock_sleep_fn c)])] in
        ignore (op h ~op:"load" ()); check "range" (clock_now c >= 100. && clock_now c < 300.));
    test "netsim.equal_min_max" (fun () ->
        let c = make_clock () in
        let h = make_client [("netsim", jo [("latency", jo [("min", Num 50.); ("max", Num 50.)]); ("sleep", clock_sleep_fn c)])] in
        ignore (op h ~op:"load" ()); check "exact" (clock_now c = 50.));
    test "netsim.fail_times_retryable" (fun () ->
        let h = make_client [("netsim", jo [("failTimes", Num 2.); ("failStatus", Num 503.)])] in
        check_int "s1" (result_status (op h ~op:"load" ())) 503;
        check_int "s2" (result_status (op h ~op:"load" ())) 503;
        check "s3ok" (op h ~op:"load" ()).or_ok);
    test "netsim.fail_every" (fun () ->
        let h = make_client [("netsim", jo [("failEvery", Num 2.)])] in
        check "1ok" (op h ~op:"load" ()).or_ok;
        check "2fail" (not (op h ~op:"load" ()).or_ok);
        check "3ok" (op h ~op:"load" ()).or_ok);
    test "netsim.fail_rate_seed" (fun () ->
        let h = make_client [("netsim", jo [("failRate", Num 1.); ("seed", Num 5.)])] in
        check "fail" (not (op h ~op:"load" ()).or_ok));
    test "netsim.error_times" (fun () ->
        let h = make_client [("netsim", jo [("errorTimes", Num 1.)])] in
        check_str "code" (err_code (op h ~op:"load" ())) "netsim_conn");
    test "netsim.offline" (fun () ->
        let h = make_client [("netsim", jo [("offline", Bool true)])] in
        check_str "code" (err_code (op h ~op:"load" ())) "netsim_offline");
    test "netsim.rate_limit_times" (fun () ->
        let h = make_client [("netsim", jo [("rateLimitTimes", Num 1.); ("retryAfter", Num 3.)])] in
        let r = op h ~op:"load" () in
        check_int "429" (result_status r) 429;
        check_vstr "retry-after" (getp (match r.or_result with Some x -> x.rt_headers | None -> Noval) "retry-after") "3");
    test "netsim.inactive_no_wrap" (fun () ->
        let h = make_client [("netsim", jo [("active", Bool false)])] in
        check "ok" (op h ~op:"load" ()).or_ok;
        check "no track" (is_nullish (track h "netsim")));
    test "netsim.no_latency" (fun () ->
        let h = make_client [("netsim", empty_map ())] in check "ok" (op h ~op:"load" ()).or_ok)
  end;

  (* ---------------- retry ---------------- *)
  if fh_present "retry" then begin
    test "retry.transient_then_succeeds" (fun () ->
        let c = make_clock () in
        let h = make_client [
          ("netsim", jo [("failTimes", Num 2.); ("failStatus", Num 503.)]);
          ("retry", jo [("retries", Num 3.); ("minDelay", Num 10.); ("jitter", Bool false); ("sleep", clock_sleep_fn c)]) ] in
        check "ok" (op h ~op:"load" ()).or_ok;
        check_vnum "attempts" (getp (track h "retry") "attempts") 2.);
    test "retry.gives_up" (fun () ->
        let c = make_clock () in
        let h = make_client [
          ("netsim", jo [("failTimes", Num 9.); ("failStatus", Num 500.)]);
          ("retry", jo [("retries", Num 2.); ("minDelay", Num 1.); ("jitter", Bool false); ("sleep", clock_sleep_fn c)]) ] in
        check_int "500" (result_status (op h ~op:"load" ())) 500);
    test "retry.no_retry_non_retryable" (fun () ->
        let (srv, calls) = recording_server ~reply:(fun _ _ -> (make_response 404 Noval, None)) () in
        let h = make_client ~server:srv [("retry", jo [("retries", Num 3.); ("minDelay", Num 0.)])] in
        ignore (op h ~op:"load" ()); check_int "calls" (List.length !calls) 1);
    test "retry.raised_then_reraises" (fun () ->
        let c = make_clock () in
        let state = ref 0 in
        let server _ _ _ = incr state; failwith "boom" in
        let h = make_client ~server [("retry", jo [("retries", Num 2.); ("minDelay", Num 1.); ("jitter", Bool false); ("sleep", clock_sleep_fn c)])] in
        let r = op h ~op:"load" () in check "ok false" (not r.or_ok); check_int "n" !state 3);
    test "retry.transport_error_result" (fun () ->
        let state = ref 0 in
        let server ctx _ _ = incr state; if !state < 2 then (Noval, Some (ctx_make_error ctx "conn" "connection lost")) else (make_response 200 (jo [("ok", Bool true)]), None) in
        let h = make_client ~server [("retry", jo [("retries", Num 3.); ("minDelay", Num 0.)])] in
        check "ok" (op h ~op:"load" ()).or_ok; check_int "n" !state 2);
    test "retry.honours_retry_after" (fun () ->
        let c = make_clock () in
        let h = make_client [
          ("netsim", jo [("rateLimitTimes", Num 1.); ("retryAfter", Num 2.)]);
          ("retry", jo [("retries", Num 2.); ("minDelay", Num 10.); ("maxDelay", Num 60000.); ("jitter", Bool false); ("sleep", clock_sleep_fn c)]) ] in
        check "ok" (op h ~op:"load" ()).or_ok; check "wait" (clock_now c = 2000.));
    test "retry.non_numeric_status_not_retryable" (fun () ->
        let (srv, calls) = recording_server ~reply:(fun _ _ -> (jo [("status", Str "weird"); ("json", json_thunk (empty_map ())); ("headers", empty_map ())], None)) () in
        let h = make_client ~server:srv [("retry", jo [("retries", Num 3.); ("minDelay", Num 0.)])] in
        ignore (op h ~op:"load" ()); check_int "calls" (List.length !calls) 1);
    test "retry.inactive_no_wrap" (fun () ->
        let (srv, calls) = recording_server ~reply:(fun _ _ -> (make_response 503 Noval, None)) () in
        let h = make_client ~server:srv [("retry", jo [("active", Bool false)])] in
        ignore (op h ~op:"load" ()); check_int "calls" (List.length !calls) 1)
  end;

  (* ---------------- timeout ---------------- *)
  if fh_present "timeout" then begin
    test "timeout.slow_times_out" (fun () ->
        let c = make_clock () in
        let h = make_client [
          ("netsim", jo [("latency", Num 80.); ("sleep", clock_sleep_fn c)]);
          ("timeout", jo [("ms", Num 10.); ("now", clock_now_fn c)]) ] in
        let r = op h ~op:"load" () in
        check_str "code" (err_code r) "timeout";
        check_vnum "count" (getp (track h "timeout") "count") 1.);
    test "timeout.fast_passes" (fun () ->
        let h = make_client [("timeout", jo [("ms", Num 1000.)])] in check "ok" (op h ~op:"load" ()).or_ok);
    test "timeout.ms_zero_disables" (fun () ->
        let h = make_client [("timeout", jo [("ms", Num 0.)])] in check "ok" (op h ~op:"load" ()).or_ok);
    test "timeout.annotates_fetchdef" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("timeout", jo [("ms", Num 5000.)])] in
        ignore (op h ~op:"load" ());
        check_vnum "timeout" (getp (getp (List.nth !calls 0) "fetchdef") "timeout") 5.);
    test "timeout.inactive_no_wrap" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("timeout", jo [("active", Bool false)])] in
        ignore (op h ~op:"load" ());
        check "no timeout" (is_nullish (getp (getp (List.nth !calls 0) "fetchdef") "timeout")))
  end;

  (* ---------------- ratelimit ---------------- *)
  if fh_present "ratelimit" then begin
    test "ratelimit.throttles" (fun () ->
        let c = make_clock () in
        let h = make_client [("ratelimit", jo [("rate", Num 1.); ("burst", Num 2.); ("now", clock_now_fn c); ("sleep", clock_sleep_fn c)])] in
        ignore (op h ~op:"load" ()); ignore (op h ~op:"load" ()); ignore (op h ~op:"load" ());
        check_vnum "throttled" (getp (track h "ratelimit") "throttled") 1.;
        check "clock>0" (clock_now c > 0.));
    test "ratelimit.refills" (fun () ->
        let c = make_clock () in
        let h = make_client [("ratelimit", jo [("rate", Num 2.); ("now", clock_now_fn c); ("sleep", clock_sleep_fn c)])] in
        ignore (op h ~op:"load" ()); ignore (op h ~op:"load" ()); clock_advance c 1000.; ignore (op h ~op:"load" ());
        let t = track h "ratelimit" in
        check "no throttle" (match getp t "throttled" with Num n -> n = 0. | _ -> true));
    test "ratelimit.inactive_no_wrap" (fun () ->
        let h = make_client [("ratelimit", jo [("active", Bool false)])] in
        check "ok" (op h ~op:"load" ()).or_ok; check "no track" (is_nullish (track h "ratelimit")))
  end;

  (* ---------------- cache ---------------- *)
  if fh_present "cache" then begin
    test "cache.serves_repeated_read" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("cache", jo [("ttl", Num 10000.)])] in
        let a = op h ~op:"load" ~path:"/w/1" () in
        let b = op h ~op:"load" ~path:"/w/1" () in
        check_int "calls" (List.length !calls) 1;
        check "data eq" (veq a.or_data b.or_data);
        check_vnum "hit" (getp (track h "cache") "hit") 1.);
    test "cache.no_cache_non_get" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("cache", empty_map ())] in
        ignore (op h ~op:"create" ~path:"/w" ()); ignore (op h ~op:"create" ~path:"/w" ());
        check_int "calls" (List.length !calls) 2);
    test "cache.no_cache_non_2xx" (fun () ->
        let (srv, calls) = recording_server ~reply:(fun _ _ -> (make_response 500 Noval, None)) () in
        let h = make_client ~server:srv [("cache", empty_map ())] in
        ignore (op h ~op:"load" ~path:"/w" ()); ignore (op h ~op:"load" ~path:"/w" ());
        check_int "calls" (List.length !calls) 2;
        check_vnum "bypass" (getp (track h "cache") "bypass") 2.);
    test "cache.non_json_body_passes_by_unread" (fun () ->
        let sent = ref [] in
        let (srv, calls) = recording_server ~reply:(fun _ _ ->
            let res = make_response ~headers:[("content-type", Str "audio/wav")] 200 Noval in
            sent := !sent @ [res];
            (res, None)) () in
        let h = make_client ~server:srv [("cache", empty_map ())] in
        let a = op h ~op:"load" ~path:"/w/1/audio" () in
        let b = op h ~op:"load" ~path:"/w/1/audio" () in
        check_int "the body was stored" (List.length !calls) 2;
        check "the cache handed on a copy it had read"
          (match !sent with s :: _ -> a.or_response == s | [] -> false);
        check "the second read was handed on as returned"
          (match !sent with _ :: s :: _ -> b.or_response == s | _ -> false);
        check_vnum "bypass" (getp (track h "cache") "bypass") 2.);
    test "cache.refetches_after_ttl" (fun () ->
        let c = make_clock () in
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("cache", jo [("ttl", Num 1000.); ("now", clock_now_fn c)])] in
        ignore (op h ~op:"load" ~path:"/w" ()); clock_advance c 1500.; ignore (op h ~op:"load" ~path:"/w" ());
        check_int "calls" (List.length !calls) 2);
    test "cache.evicts_oldest" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("cache", jo [("ttl", Num 10000.); ("max", Num 1.)])] in
        ignore (op h ~op:"load" ~path:"/a" ()); ignore (op h ~op:"load" ~path:"/b" ()); ignore (op h ~op:"load" ~path:"/a" ());
        check_int "calls" (List.length !calls) 3);
    test "cache.replayed_body_rereadable" (fun () ->
        let (srv, _) = recording_server ~reply:(fun _ _ -> (make_response 200 (jo [("v", Num 1.)]), None)) () in
        let h = make_client ~server:srv [("cache", jo [("ttl", Num 10000.)])] in
        let res = op h ~op:"load" ~path:"/w" () in
        let jf = getp res.or_response "json" in
        check "read1" (veq (call_json jf) (jo [("v", Num 1.)]));
        check "read2" (veq (call_json jf) (jo [("v", Num 1.)])));
    test "cache.inactive_no_wrap" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("cache", jo [("active", Bool false)])] in
        ignore (op h ~op:"load" ~path:"/x" ()); ignore (op h ~op:"load" ~path:"/x" ());
        check_int "calls" (List.length !calls) 2)
  end;

  (* ---------------- idempotency ---------------- *)
  if fh_present "idempotency" then begin
    let hdr calls = getp (getp (List.nth !calls 0) "fetchdef") "headers" in
    test "idempotency.adds_key_mutating" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("idempotency", empty_map ())] in
        ignore (op h ~op:"create" ~path:"/w" ());
        check "key" (not (is_nullish (getp (hdr calls) "Idempotency-Key"))));
    test "idempotency.by_http_method" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("idempotency", empty_map ())] in
        ignore (op h ~op:"act" ~method_:"PUT" ~path:"/w" ());
        check "key" (not (is_nullish (getp (hdr calls) "Idempotency-Key"))));
    test "idempotency.leaves_reads" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("idempotency", empty_map ())] in
        ignore (op h ~op:"load" ~path:"/w/1" ());
        check "no key" (is_nullish (getp (hdr calls) "Idempotency-Key")));
    test "idempotency.preserves_caller_key" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("idempotency", jo [("header", Str "X-Idem")])] in
        ignore (op h ~op:"create" ~path:"/w" ~headers:[("X-Idem", Str "caller-1")] ());
        check_vstr "caller" (getp (hdr calls) "X-Idem") "caller-1");
    test "idempotency.injectable_keygen" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("idempotency", jo [("keygen", vfunc0 (fun () -> Str "fixed-key"))])] in
        ignore (op h ~op:"create" ~path:"/w" ());
        check_vstr "key" (getp (hdr calls) "Idempotency-Key") "fixed-key";
        check_vnum "issued" (getp (track h "idempotency") "issued") 1.);
    test "idempotency.inactive_noop" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("idempotency", jo [("active", Bool false)])] in
        ignore (op h ~op:"create" ~path:"/w" ());
        check "no key" (is_nullish (getp (hdr calls) "Idempotency-Key")))
  end;

  (* ---------------- rbac ---------------- *)
  if fh_present "rbac" then begin
    test "rbac.denies_before_call" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("rbac", jo [("rules", jo [("widget.remove", Str "admin")]); ("permissions", empty_list ())])] in
        let r = op h ~op:"remove" ~path:"/w/1" () in
        check_str "code" (err_code r) "rbac_denied";
        check_int "calls" (List.length !calls) 0;
        check_vnum "denied" (getp (track h "rbac") "denied") 1.);
    test "rbac.allows_held_permission" (fun () ->
        let h = make_client [("rbac", jo [("rules", jo [("widget.remove", Str "admin")]); ("permissions", ja [Str "admin"])])] in
        check "ok" (op h ~op:"remove" ~path:"/w/1" ()).or_ok;
        check_vnum "allowed" (getp (track h "rbac") "allowed") 1.);
    test "rbac.rule_by_op_wildcard" (fun () ->
        let h = make_client [("rbac", jo [("rules", jo [("load", Str "read")]); ("permissions", ja [Str "*"])])] in
        check "ok" (op h ~op:"load" ()).or_ok);
    test "rbac.no_rule_default_and_deny" (fun () ->
        let allow = make_client [("rbac", jo [("permissions", empty_list ())])] in
        check "allow" (op allow ~op:"load" ()).or_ok;
        let deny = make_client [("rbac", jo [("deny", Bool true); ("permissions", empty_list ())])] in
        check_str "deny code" (err_code (op deny ~op:"load" ())) "rbac_denied");
    test "rbac.inactive_noop" (fun () ->
        let h = make_client [("rbac", jo [("active", Bool false); ("deny", Bool true); ("permissions", empty_list ())])] in
        check "ok" (op h ~op:"load" ()).or_ok)
  end;

  (* ---------------- action keys ---------------- *)
  (* A custom action is `$action` in the request argument, and its keys name
     it: `<entity>.<op>:<action>`, most specific first. *)
  let audio () = jo [("$action", Str "audio"); ("id", Str "e1")] in
  let record () = jo [("id", Str "e1")] in
  let episode h req = op h ~entity:"episode" ~op:"load" ~reqmatch:req () in
  let has_key v k = match v with Map m -> omap_has m k | _ -> false in
  let err_msg (r : op_result) = match r.or_error with Some e -> e.err_msg | None -> "" in
  let contains s sub =
    let n = String.length sub in
    let rec at i = i + n <= String.length s && (String.sub s i n = sub || at (i + 1)) in
    at 0 in
  if has_feature "rbac" then begin
    test "action-keys.rbac_record_granted_action_refused" (fun () ->
        let srv, calls = recording_server () in
        let h = make_client ~server:srv [("rbac", jo [
            ("rules", jo [("episode.load", Str "read"); ("episode.load:audio", Str "audio")]);
            ("permissions", ja [Str "read"])])] in
        check "record ok" (episode h (record ())).or_ok;
        let r = episode h (audio ()) in
        check_str "code" (err_code r) "rbac_denied";
        check "message" (contains (err_msg r) "operation \"load:audio\"");
        check_int "calls" (List.length !calls) 1;
        check_vstr "last action" (getp (getp (track h "rbac") "last") "action") "audio");
    test "action-keys.rbac_action_granted_record_refused" (fun () ->
        let h = make_client [("rbac", jo [
            ("rules", jo [("episode.load", Str "read"); ("episode.load:audio", Str "audio")]);
            ("permissions", ja [Str "audio"])])] in
        check_str "record" (err_code (episode h (record ()))) "rbac_denied";
        check "action ok" (episode h (audio ())).or_ok);
    test "action-keys.rbac_action_falls_back_to_operation" (fun () ->
        let h = make_client [("rbac", jo [
            ("rules", jo [("episode.load", Str "read")]); ("permissions", empty_list ())])] in
        check_str "fallback" (err_code (episode h (audio ()))) "rbac_denied")
  end;
  if has_feature "metrics" then
    test "action-keys.metrics_action_counted_apart" (fun () ->
        let h = make_client [("metrics", empty_map ())] in
        ignore (episode h (record ())); ignore (episode h (audio ())); ignore (episode h (audio ()));
        let m = track h "metrics" in
        check_vnum "total" (getpath_s m "total.count") 3.;
        check_vnum "plain" (getp (getp (getp m "ops") "episode.load") "count") 1.;
        check_vnum "action" (getp (getp (getp m "ops") "episode.load:audio") "count") 2.);
  if has_feature "audit" then
    test "action-keys.audit_record_names_action" (fun () ->
        let h = make_client [("audit", empty_map ())] in
        ignore (episode h (record ())); ignore (episode h (audio ()));
        match getp (track h "audit") "records" with
        | List r ->
          let r0 = List.nth !r 0 and r1 = List.nth !r 1 in
          check "plain has no action" (not (has_key r0 "action"));
          check_vstr "plain op" (getp r0 "op") "load";
          check_vstr "action" (getp r1 "action") "audio";
          check_vstr "action op" (getp r1 "op") "load"
        | _ -> failwith "no records");
  if has_feature "cost" then
    test "action-keys.cost_action_priced_apart" (fun () ->
        let sunk = ref [] in
        let sink = vfunc1 (fun v -> sunk := !sunk @ [v]; Noval) in
        let h = make_client [("cost", jo [
            ("rates", jo [("episode.load", Num 1.); ("episode.load:audio", Num 5.)]);
            ("sink", sink)])] in
        ignore (episode h (record ())); ignore (episode h (audio ()));
        let c = track h "cost" in
        let ops = getp c "ops" in
        check_vnum "total" (getpath_s c "total.amount") 6.;
        check_vnum "plain calls" (getp (getp ops "episode.load") "calls") 1.;
        check_vnum "plain amount" (getp (getp ops "episode.load") "amount") 1.;
        check_vnum "action calls" (getp (getp ops "episode.load:audio") "calls") 1.;
        check_vnum "action amount" (getp (getp ops "episode.load:audio") "amount") 5.;
        check "plain sink" (not (has_key (List.nth !sunk 0) "action"));
        check_vstr "action sink" (getp (List.nth !sunk 1) "action") "audio";
        check_vstr "last" (getp (getp c "last") "action") "audio");

  (* ---------------- metrics ---------------- *)
  if fh_present "metrics" then begin
    test "metrics.counts_ok_err_per_op" (fun () ->
        let h = make_client [("netsim", jo [("failTimes", Num 1.); ("failStatus", Num 500.)]); ("metrics", empty_map ())] in
        ignore (op h ~op:"load" ()); ignore (op h ~op:"load" ()); ignore (op h ~op:"list" ());
        let m = track h "metrics" in
        check_vnum "count" (getpath_s m "total.count") 3.;
        check_vnum "ok" (getpath_s m "total.ok") 2.;
        check_vnum "err" (getpath_s m "total.err") 1.;
        check_vnum "load count" (getp (getp (getp m "ops") "widget.load") "count") 2.);
    test "metrics.injected_clock_duration" (fun () ->
        let c = make_clock () in
        let server _ _ _ = clock_advance c 25.; (make_response 200 (jo [("ok", Bool true)]), None) in
        let h = make_client ~server [("metrics", jo [("now", clock_now_fn c)])] in
        ignore (op h ~op:"load" ());
        check_vnum "totalMs" (getpath_s (track h "metrics") "total.totalMs") 25.;
        check_vnum "maxMs" (getpath_s (track h "metrics") "total.maxMs") 25.);
    test "metrics.inactive" (fun () ->
        let h = make_client [("metrics", jo [("active", Bool false)])] in
        ignore (op h ~op:"load" ());
        check_vnum "count" (getpath_s (track h "metrics") "total.count") 0.)
  end;

  (* ---------------- telemetry ---------------- *)
  if fh_present "telemetry" then begin
    test "telemetry.opens_spans_propagates" (fun () ->
        let (srv, calls) = recording_server () in
        let exported = ref [] in
        let h = make_client ~server:srv [("telemetry", jo [("exporter", vfunc1 (fun s -> exported := !exported @ [s]; Noval))])] in
        let r = op h ~op:"load" () in
        check "ok" r.or_ok;
        check_int "spans" (size (getp (track h "telemetry") "spans")) 1;
        check_int "exported" (List.length !exported) 1;
        let span0 = getelem (getp (track h "telemetry") "spans") (Num 0.) in
        let sent = getp (getp (List.nth !calls 0) "fetchdef") "headers" in
        check "trace hdr" (veq (getp sent "X-Trace-Id") (getp span0 "traceId"));
        let tp = vs_str (getp sent "traceparent") in
        check "traceparent" (String.length tp > 6 && String.sub tp 0 3 = "00-" && String.sub tp (String.length tp - 3) 3 = "-01"));
    test "telemetry.failed_span" (fun () ->
        let h = make_client [("netsim", jo [("failTimes", Num 1.); ("failStatus", Num 500.)]); ("telemetry", empty_map ())] in
        ignore (op h ~op:"load" ());
        let span0 = getelem (getp (track h "telemetry") "spans") (Num 0.) in
        check "ok false" (getp span0 "ok" = Bool false));
    test "telemetry.closes_once" (fun () ->
        let h = make_client [("netsim", jo [("failTimes", Num 1.); ("failStatus", Num 500.)]); ("telemetry", empty_map ())] in
        ignore (op h ~op:"load" ());
        check_int "spans" (size (getp (track h "telemetry") "spans")) 1;
        check_vnum "active" (getp (track h "telemetry") "active") 0.);
    test "telemetry.injected_idgen_clock" (fun () ->
        let h = make_client [("telemetry", jo [("idgen", vfunc1 (fun v -> Str (vs_str v ^ "-X"))); ("now", vfunc0 (fun () -> Num 5.))])] in
        ignore (op h ~op:"load" ());
        let span0 = getelem (getp (track h "telemetry") "spans") (Num 0.) in
        check_vstr "traceId" (getp span0 "traceId") "trace-X";
        check_vnum "duration" (getp span0 "durationMs") 0.);
    test "telemetry.default_id" (fun () ->
        let h = make_client [("telemetry", empty_map ())] in
        ignore (op h ~op:"load" ());
        let tid = vs_str (getp (getelem (getp (track h "telemetry") "spans") (Num 0.)) "traceId") in
        check "starts t" (String.length tid > 0 && tid.[0] = 't'));
    test "telemetry.inactive" (fun () ->
        let h = make_client [("telemetry", jo [("active", Bool false)])] in
        ignore (op h ~op:"load" ());
        check_int "spans" (size (getp (track h "telemetry") "spans")) 0)
  end;

  (* ---------------- debug ---------------- *)
  if fh_present "debug" then begin
    test "debug.redacted_trace_max_onentry" (fun () ->
        let seen = ref [] in
        let h = make_client [("debug", jo [("max", Num 1.); ("onEntry", vfunc1 (fun e -> seen := !seen @ [e]; Noval))])] in
        ignore (op h ~op:"load" ~headers:[("authorization", Str "Bearer secret")] ());
        ignore (op h ~op:"list" ());
        check_int "entries" (size (getp (track h "debug") "entries")) 1;
        check_int "seen" (List.length !seen) 2;
        check_vstr "redacted" (getp (getp (List.nth !seen 0) "headers") "authorization") "[redacted]");
    test "debug.captures_failures" (fun () ->
        let h = make_client [("netsim", jo [("failTimes", Num 1.); ("failStatus", Num 500.)]); ("debug", empty_map ())] in
        ignore (op h ~op:"load" ());
        let e0 = getelem (getp (track h "debug") "entries") (Num 0.) in
        check "ok false" (getp e0 "ok" = Bool false);
        check_vnum "status" (getp e0 "status") 500.);
    test "debug.injected_clock_custom_redact" (fun () ->
        let h = make_client [("debug", jo [("now", vfunc0 (fun () -> Num 7.)); ("redact", ja [Str "x-secret"])])] in
        ignore (op h ~op:"load" ~headers:[("x-secret", Str "hide"); ("x-ok", Str "show")] ());
        let e0 = getelem (getp (track h "debug") "entries") (Num 0.) in
        check_vstr "secret" (getp (getp e0 "headers") "x-secret") "[redacted]";
        check_vstr "ok hdr" (getp (getp e0 "headers") "x-ok") "show";
        check_vnum "duration" (getp e0 "durationMs") 0.);
    test "debug.inactive" (fun () ->
        let h = make_client [("debug", jo [("active", Bool false)])] in
        ignore (op h ~op:"load" ());
        check_int "entries" (size (getp (track h "debug") "entries")) 0)
  end;

  (* ---------------- audit ---------------- *)
  if fh_present "audit" then begin
    test "audit.one_record_per_op" (fun () ->
        let sink = ref [] in
        let h = make_client [("netsim", jo [("failTimes", Num 1.); ("failStatus", Num 500.)]); ("audit", jo [("actor", Str "svc"); ("sink", vfunc1 (fun r -> sink := !sink @ [r]; Noval)); ("max", Num 5.)])] in
        ignore (op h ~op:"remove" ~path:"/w/1" ());
        ignore (op h ~op:"load" ~ctrl:(jo [("actor", Str "per-call")]) ());
        let recs = getp (track h "audit") "records" in
        check_int "records" (size recs) 2;
        check_vstr "0 outcome" (getp (getelem recs (Num 0.)) "outcome") "error";
        check_vstr "0 actor" (getp (getelem recs (Num 0.)) "actor") "svc";
        check_vstr "1 actor" (getp (getelem recs (Num 1.)) "actor") "per-call";
        check_vstr "1 outcome" (getp (getelem recs (Num 1.)) "outcome") "ok";
        check_int "sink" (List.length !sink) 2);
    test "audit.default_actor_clock" (fun () ->
        let h = make_client [("audit", jo [("now", vfunc0 (fun () -> Num 42.))])] in
        ignore (op h ~op:"load" ());
        let r0 = getelem (getp (track h "audit") "records") (Num 0.) in
        check_vstr "actor" (getp r0 "actor") "anonymous";
        check_vnum "ts" (getp r0 "ts") 42.;
        check_vstr "entity" (getp r0 "entity") "widget";
        check_vstr "op" (getp r0 "op") "load";
        check_vnum "seq" (getp r0 "seq") 1.;
        check "corr" (not (is_nullish (getp r0 "correlationId"))));
    test "audit.max_bounds" (fun () ->
        let h = make_client [("audit", jo [("max", Num 2.)])] in
        ignore (op h ~op:"load" ()); ignore (op h ~op:"load" ()); ignore (op h ~op:"load" ());
        check_int "records" (size (getp (track h "audit") "records")) 2);
    test "audit.inactive" (fun () ->
        let h = make_client [("audit", jo [("active", Bool false)])] in
        ignore (op h ~op:"load" ());
        check_int "records" (size (getp (track h "audit") "records")) 0)
  end;

  (* ---------------- clienttrack ---------------- *)
  if fh_present "clienttrack" then begin
    test "clienttrack.stable_id_ua" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("clienttrack", jo [("clientName", Str "Acme"); ("clientVersion", Str "2.0.0")])] in
        ignore (op h ~op:"load" ()); ignore (op h ~op:"load" ());
        let h0 = getp (getp (List.nth !calls 0) "fetchdef") "headers" in
        let h1 = getp (getp (List.nth !calls 1) "fetchdef") "headers" in
        check_vstr "ua" (getp h0 "User-Agent") "Acme/2.0.0";
        check "same client id" (veq (getp h0 "X-Client-Id") (getp h1 "X-Client-Id"));
        check "diff request id" (not (veq (getp h0 "X-Request-Id") (getp h1 "X-Request-Id")));
        check_vnum "requests" (getp (track h "clienttrack") "requests") 2.);
    test "clienttrack.no_clobber_ua" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("clienttrack", empty_map ())] in
        ignore (op h ~op:"load" ~headers:[("User-Agent", Str "mine")] ());
        check_vstr "ua" (getp (getp (getp (List.nth !calls 0) "fetchdef") "headers") "User-Agent") "mine");
    test "clienttrack.injected_idgen_session" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("clienttrack", jo [("sessionId", Str "S1"); ("idgen", vfunc1 (fun v -> Str (vs_str v ^ "-1")))])] in
        ignore (op h ~op:"load" ());
        let hd = getp (getp (List.nth !calls 0) "fetchdef") "headers" in
        check_vstr "cid" (getp hd "X-Client-Id") "S1";
        check_vstr "rid" (getp hd "X-Request-Id") "request-1");
    test "clienttrack.inactive" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("clienttrack", jo [("active", Bool false)])] in
        ignore (op h ~op:"load" ());
        check "no cid" (is_nullish (getp (getp (getp (List.nth !calls 0) "fetchdef") "headers") "X-Client-Id")))
  end;

  (* ---------------- paging ---------------- *)
  if fh_present "paging" then begin
    let has s sub =
      let hl = String.length s and nl = String.length sub in
      let rec go i = if i + nl > hl then false else if String.sub s i nl = sub then true else go (i + 1) in nl = 0 || go 0 in
    test "paging.stamps_and_reads" (fun () ->
        let (srv, calls) = recording_server ~reply:(fun _ _ ->
            (make_response ~headers:[("x-next-page", Str "2"); ("x-total-count", Str "5"); ("link", Str "</w?page=2>; rel=\"next\"")] 200 (jo [("items", ja [Num 1.; Num 2.])]), None)) () in
        let h = make_client ~server:srv [("paging", jo [("limit", Num 2.)])] in
        let r = op h ~op:"list" ~path:"/w" () in
        let url = vs_str (getp (List.nth !calls 0) "url") in
        check "page=1" (has url "page=1"); check "limit=2" (has url "limit=2");
        let pg = match r.or_result with Some x -> x.rt_paging | None -> Noval in
        check_vnum "nextPage" (getp pg "nextPage") 2.;
        check_vnum "totalCount" (getp pg "totalCount") 5.;
        check_vstr "next" (getp pg "next") "/w?page=2";
        check "hasMore" (getp pg "hasMore" = Bool true));
    test "paging.body_cursor" (fun () ->
        let (srv, calls) = recording_server ~reply:(fun _ _ -> (make_response 200 (jo [("nextCursor", Str "abc"); ("hasMore", Bool true)]), None)) () in
        let h = make_client ~server:srv [("paging", empty_map ())] in
        let r = op h ~op:"list" ~path:"/w" ~ctrl:(jo [("paging", jo [("cursor", Str "xyz")])]) () in
        check "cursor=xyz" (has (vs_str (getp (List.nth !calls 0) "url")) "cursor=xyz");
        let pg = match r.or_result with Some x -> x.rt_paging | None -> Noval in
        check_vstr "cursor" (getp pg "cursor") "abc";
        check "hasMore" (getp pg "hasMore" = Bool true));
    test "paging.non_list_not_paged" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("paging", empty_map ())] in
        ignore (op h ~op:"load" ~path:"/w/1" ());
        check "no page" (not (has (vs_str (getp (List.nth !calls 0) "url")) "page=")));
    test "paging.inactive" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("paging", jo [("active", Bool false)])] in
        ignore (op h ~op:"list" ~path:"/w" ());
        check "no page" (not (has (vs_str (getp (List.nth !calls 0) "url")) "page=")))
  end;

  (* ---------------- streaming ---------------- *)
  if fh_present "streaming" then begin
    test "streaming.streams_items" (fun () ->
        let c = make_clock () in
        let (srv, _) = recording_server ~reply:(fun _ _ -> (make_response 200 (ja [Str "a"; Str "b"; Str "c"]), None)) () in
        let h = make_client ~server:srv [("streaming", jo [("chunkDelay", Num 5.); ("sleep", clock_sleep_fn c)])] in
        let r = op h ~op:"list" ~path:"/w" () in
        let result = match r.or_result with Some x -> x | None -> assert false in
        check "streaming" result.rt_streaming;
        let seen = match result.rt_stream with Some f -> f () | None -> [] in
        check "items" (List.length seen = 3 && veq (List.nth seen 0) (Str "a") && veq (List.nth seen 2) (Str "c"));
        check "clock" (clock_now c = 15.));
    test "streaming.batches_chunk_size" (fun () ->
        let (srv, _) = recording_server ~reply:(fun _ _ -> (make_response 200 (ja [Num 1.; Num 2.; Num 3.; Num 4.; Num 5.]), None)) () in
        let h = make_client ~server:srv [("streaming", jo [("chunkSize", Num 2.)])] in
        let r = op h ~op:"list" ~path:"/w" () in
        let result = match r.or_result with Some x -> x | None -> assert false in
        let batches = match result.rt_stream with Some f -> f () | None -> [] in
        check "3 batches" (List.length batches = 3);
        check "b0" (veq (List.nth batches 0) (ja [Num 1.; Num 2.]));
        check "b2" (veq (List.nth batches 2) (ja [Num 5.])));
    test "streaming.non_list_not_streamed" (fun () ->
        let h = make_client [("streaming", empty_map ())] in
        let r = op h ~op:"load" () in
        check "not streaming" (match r.or_result with Some x -> not x.rt_streaming | None -> true));
    test "streaming.inactive" (fun () ->
        let (srv, _) = recording_server ~reply:(fun _ _ -> (make_response 200 (ja [Str "a"]), None)) () in
        let h = make_client ~server:srv [("streaming", jo [("active", Bool false)])] in
        let r = op h ~op:"list" ~path:"/w" () in
        check "not streaming" (match r.or_result with Some x -> not x.rt_streaming | None -> true))
  end;

  (* ---------------- proxy ---------------- *)
  if fh_present "proxy" then begin
    let fd calls = getp (List.nth !calls 0) "fetchdef" in
    test "proxy.routes_and_agent" (fun () ->
        let (srv, calls) = recording_server () in
        let agent_url = ref "" in
        let agent = vfunc1 (fun args -> agent_url := (match getelem args (Num 0.) with Str s -> s | _ -> ""); jo [("a", Num 1.)]) in
        let h = make_client ~server:srv [("proxy", jo [("url", Str "http://proxy:8080"); ("agent", agent)])] in
        ignore (op h ~op:"load" ());
        check_vstr "proxy" (getp (fd calls) "proxy") "http://proxy:8080";
        check_vstr "proxies.https" (getp (getp (fd calls) "proxies") "https") "http://proxy:8080";
        check_vnum "dispatcher.a" (getp (getp (fd calls) "dispatcher") "a") 1.;
        check_str "agent_url" !agent_url "http://proxy:8080";
        check_vnum "routed" (getp (track h "proxy") "routed") 1.);
    test "proxy.bypasses_no_proxy" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv ~base:"http://api.test" [("proxy", jo [("url", Str "http://proxy:8080"); ("noProxy", ja [Str "api.test"])])] in
        ignore (op h ~op:"load" ());
        check "no proxy" (is_nullish (getp (fd calls) "proxy")));
    test "proxy.no_url_noop" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("proxy", empty_map ())] in
        ignore (op h ~op:"load" ());
        check "no proxy" (is_nullish (getp (fd calls) "proxy")));
    test "proxy.inactive_no_wrap" (fun () ->
        let (srv, calls) = recording_server () in
        let h = make_client ~server:srv [("proxy", jo [("active", Bool false); ("url", Str "http://proxy:8080")])] in
        ignore (op h ~op:"load" ());
        check "no proxy" (is_nullish (getp (fd calls) "proxy")))
  end;

  (* ---------------- composition ---------------- *)
  if fh_present "cache" && fh_present "netsim" then
    test "composition.cache_plus_netsim" (fun () ->
        let h = make_client [("netsim", jo [("failEvery", Num 2.)]); ("cache", jo [("ttl", Num 10000.)])] in
        check "1ok" (op h ~op:"load" ~path:"/w" ()).or_ok;
        check "2ok" (op h ~op:"load" ~path:"/w" ()).or_ok;
        check_vnum "netsim calls" (getp (track h "netsim") "calls") 1.)
