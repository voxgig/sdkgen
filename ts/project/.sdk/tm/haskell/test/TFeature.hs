-- Feature behaviour tests. Each feature is driven through the mini operation
-- pipeline (Harness) against a mock transport, with injected clocks so timing
-- features are deterministic. Feature tracking is inspected on client._<name>.

module TFeature (tests) where

import Data.IORef

import VoxgigStruct (Value (..), emptyMap, isfunc, isNoval)
import SdkTypes
import SdkHelpers
import Harness
import Testutil

-- number field of a tracking bucket
bnum :: Value -> String -> IO Double
bnum m k = do v <- getp m k; pure (case v of VNum n -> n; _ -> -999)

specHeader :: OpResult -> String -> IO Value
specHeader r name = do
  sp <- readIORef (cSpec (orCtx r))
  case sp of VMap _ -> do h <- getp sp "headers"; headerCI h name; _ -> pure VNoval

tests :: Counters -> IO ()
tests c = do

  runTest c "feature.retry_retries_then_succeeds" $ do
    clk <- makeClock
    let reply n _ = if n <= 2 then do r <- makeResponse 503 VNoval []; pure (r, Nothing)
                    else do d <- jo [("ok", VBool True)]; r <- makeResponse 200 d []; pure (r, Nothing)
    (srv, _) <- recordingServer (Just reply)
    ropts <- jo [("retries", VNum 3), ("minDelay", VNum 1), ("jitter", VBool False), ("sleep", clockSleepFn clk)]
    h <- makeClientH [("retry", ropts)] (Just srv) []
    res <- runOpH h defaultOpArgs
    bucket <- trackGet (hClient h) "retry"
    attempts <- bnum bucket "attempts"
    pure (orOk res && attempts == 2)

  runTest c "feature.timeout_exceeds_deadline" $ do
    clk <- makeClock
    let srv _ _ _ = do clockAdvance clk 100; d <- jo [("ok", VBool True)]; r <- makeResponse 200 d []; pure (r, Nothing)
    topts <- jo [("ms", VNum 10), ("now", clockNowFn clk)]
    h <- makeClientH [("timeout", topts)] (Just srv) []
    res <- runOpH h defaultOpArgs
    ecode <- case orErr res of Just e -> errCode e; Nothing -> pure ""
    pure (not (orOk res) && ecode == "timeout")

  runTest c "feature.ratelimit_throttles" $ do
    clk <- makeClock
    ropts <- jo [("rate", VNum 1), ("burst", VNum 1), ("now", clockNowFn clk), ("sleep", clockSleepFn clk)]
    h <- makeClientH [("ratelimit", ropts)] Nothing []
    _ <- runOpH h defaultOpArgs
    _ <- runOpH h defaultOpArgs
    bucket <- trackGet (hClient h) "ratelimit"
    throttled <- bnum bucket "throttled"
    pure (throttled == 1)

  runTest c "feature.cache_hit_on_second_get" $ do
    clk <- makeClock
    (srv, calls) <- recordingServer Nothing
    copts <- jo [("ttl", VNum 1000), ("now", clockNowFn clk)]
    h <- makeClientH [("cache", copts)] (Just srv) []
    _ <- runOpH h defaultOpArgs
    _ <- runOpH h defaultOpArgs
    bucket <- trackGet (hClient h) "cache"
    hit <- bnum bucket "hit"; miss <- bnum bucket "miss"
    cs <- readIORef calls
    pure (hit == 1 && miss == 1 && length cs == 1)

  runTest c "feature.idempotency_adds_key" $ do
    h <- makeClientH [("idempotency", VNoval)] Nothing []
    res <- runOpH h (defaultOpArgs { oaOp = "create", oaMethod = Just "POST" })
    k <- specHeader res "Idempotency-Key"
    bucket <- trackGet (hClient h) "idempotency"
    issued <- bnum bucket "issued"
    pure (not (isNoval k) && issued == 1)

  runTest c "feature.rbac_denies_unpermitted" $ do
    rules <- jo [("widget.load", VStr "read")]
    ropts <- jo [("rules", rules)]
    h <- makeClientH [("rbac", ropts)] Nothing []
    res <- runOpH h defaultOpArgs
    ecode <- case orErr res of Just e -> errCode e; Nothing -> pure ""
    bucket <- trackGet (hClient h) "rbac"
    denied <- bnum bucket "denied"
    pure (not (orOk res) && ecode == "rbac_denied" && denied == 1)

  runTest c "feature.rbac_allows_permitted" $ do
    rules <- jo [("widget.load", VStr "read")]
    perms <- ja [VStr "read"]
    ropts <- jo [("rules", rules), ("permissions", perms)]
    h <- makeClientH [("rbac", ropts)] Nothing []
    res <- runOpH h defaultOpArgs
    bucket <- trackGet (hClient h) "rbac"
    allowed <- bnum bucket "allowed"
    pure (orOk res && allowed == 1)

  runTest c "feature.metrics_records_op" $ do
    clk <- makeClock
    mopts <- jo [("now", clockNowFn clk)]
    h <- makeClientH [("metrics", mopts)] Nothing []
    _ <- runOpH h defaultOpArgs
    bucket <- trackGet (hClient h) "metrics"
    total <- getp bucket "total"; count <- bnum total "count"
    pure (count == 1)

  runTest c "feature.telemetry_span_and_headers" $ do
    h <- makeClientH [("telemetry", VNoval)] Nothing []
    res <- runOpH h defaultOpArgs
    tid <- specHeader res "X-Trace-Id"
    bucket <- trackGet (hClient h) "telemetry"
    spans <- getp bucket "spans"; n <- case spans of VList r -> length <$> readIORef r; _ -> pure 0
    pure (not (isNoval tid) && n == 1)

  runTest c "feature.debug_records_entry" $ do
    h <- makeClientH [("debug", VNoval)] Nothing []
    _ <- runOpH h defaultOpArgs
    bucket <- trackGet (hClient h) "debug"
    entries <- getp bucket "entries"; n <- case entries of VList r -> length <$> readIORef r; _ -> pure 0
    pure (n == 1)

  runTest c "feature.audit_emits_record" $ do
    aopts <- jo [("actor", VStr "alice")]
    h <- makeClientH [("audit", aopts)] Nothing []
    _ <- runOpH h defaultOpArgs
    bucket <- trackGet (hClient h) "audit"
    recs <- getp bucket "records"; n <- case recs of VList r -> readIORef r; _ -> pure []
    actor <- case n of (r0 : _) -> getp r0 "actor"; [] -> pure VNoval
    pure (length n == 1 && vstring actor == "alice")

  runTest c "feature.clienttrack_stamps_headers" $ do
    h <- makeClientH [("clienttrack", VNoval)] Nothing []
    res <- runOpH h defaultOpArgs
    cid <- specHeader res "X-Client-Id"
    bucket <- trackGet (hClient h) "clienttrack"
    reqs <- bnum bucket "requests"
    pure (not (isNoval cid) && reqs == 1)

  runTest c "feature.paging_stamps_query_and_reads" $ do
    h <- makeClientH [("paging", VNoval)] Nothing []
    res <- runOpH h (defaultOpArgs { oaOp = "list" })
    sp <- readIORef (cSpec (orCtx res))
    q <- getp sp "query"; page <- getp q "page"
    paging <- getp (orResult res) "paging"
    pure ((case page of VNum n -> n == 1; _ -> False) && (case paging of VMap _ -> True; _ -> False))

  runTest c "feature.streaming_attaches_stream" $ do
    h <- makeClientH [("streaming", VNoval)] Nothing []
    res <- runOpH h (defaultOpArgs { oaOp = "list" })
    streaming <- getp (orResult res) "streaming"
    stream <- getp (orResult res) "stream"
    pure (isTrueV streaming && isfunc stream)

  runTest c "feature.proxy_routes_fetchdef" $ do
    (srv, calls) <- recordingServer Nothing
    popts <- jo [("url", VStr "http://proxy:8080")]
    h <- makeClientH [("proxy", popts)] (Just srv) []
    _ <- runOpH h defaultOpArgs
    cs <- readIORef calls
    fd <- case cs of (r0 : _) -> getp r0 "fetchdef"; [] -> pure VNoval
    px <- getp fd "proxy"
    bucket <- trackGet (hClient h) "proxy"
    routed <- bnum bucket "routed"
    pure (vstring px == "http://proxy:8080" && routed == 1)

  runTest c "feature.netsim_offline" $ do
    nopts <- jo [("offline", VBool True)]
    h <- makeClientH [("netsim", nopts)] Nothing []
    res <- runOpH h defaultOpArgs
    ecode <- case orErr res of Just e -> errCode e; Nothing -> pure ""
    pure (not (orOk res) && ecode == "netsim_offline")
