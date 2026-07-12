-- ProjectName SDK features + API-agnostic client helpers.
--
-- The 18 pipeline features (base/test/log + the 15 enterprise features) and
-- the transport they wrap, plus make_client_base / direct / prepare / test and
-- the generic (config-driven) entity constructor. Each feature is built by an
-- IO constructor that allocates IORefs for its mutable state and returns a
-- `Feature` whose init/hook closures observe and mutate the shared pipeline
-- state. Transport-wrapping features re-bind the mutable `uFetcher` cell so
-- later inits sit outermost.

module SdkFeatures where

import Control.Concurrent (threadDelay)
import Control.Exception (try)
import Control.Monad (forM_, when)
import Data.Bits ((.&.))
import Data.Char (toLower)
import Data.IORef
import Data.List (isPrefixOf, sort)
import Data.Time.Clock.POSIX (getPOSIXTime)
import System.Environment (lookupEnv)

import VoxgigStruct
  ( Value (..), InjArg (..), emptyList, emptyMap, mkList, mkMap
  , getprop, setprop, delprop, getelem, keysof, listItems, items
  , clone, merge, transform, select, size, isempty, ismap, islist, isfunc
  , isNoval, isNullish, vint, setpath, walk )
import SdkTypes
import SdkHelpers
import SdkRuntime

-- ------------------------------------------------------------------
-- clock / option readers
-- ------------------------------------------------------------------

defaultNowMs :: IO Double
defaultNowMs = (* 1000) . realToFrac <$> getPOSIXTime

realSleep :: Double -> IO ()
realSleep ms = when (ms > 0) (threadDelay (round (ms * 1000)))

optNum :: Value -> String -> Double -> IO Double
optNum opts k d = do v <- getp opts k; pure (case v of VNum n -> n; _ -> d)

optInt :: Value -> String -> Int -> IO Int
optInt opts k d = do v <- getp opts k; pure (case v of VNum n -> truncate n; _ -> d)

optStr :: Value -> String -> String -> IO String
optStr = getStrD

optActive :: Value -> IO Bool
optActive opts = isTrueV <$> getp opts "active"

optStrList :: Value -> String -> [String] -> IO [String]
optStrList opts k d = do
  v <- getp opts k
  case v of VList _ -> do its <- listItems v; pure [s | VStr s <- its]; _ -> pure d

nowOf :: Value -> IO Double
nowOf opts = do
  v <- getp opts "now"
  case v of
    VFunc _ -> do r <- callVfn v VNoval; pure (case r of VNum n -> n; _ -> 0)
    _ -> defaultNowMs

sleepOf :: Value -> Double -> IO ()
sleepOf opts ms = when (ms > 0) $ do
  v <- getp opts "sleep"
  case v of VFunc _ -> () <$ callVfn v (VNum ms); _ -> realSleep ms

toOptsMap :: Value -> IO Value
toOptsMap opts = case toMap opts of VMap _ -> pure opts; _ -> emptyMap

-- ------------------------------------------------------------------
-- small helpers
-- ------------------------------------------------------------------

endsWith :: String -> String -> Bool
endsWith s suf = length s >= length suf && drop (length s - length suf) s == suf

stripLeadDot :: String -> String
stripLeadDot ('.' : r) = r
stripLeadDot s = s

urlHost :: String -> String
urlHost url = case findScheme 0 of
  Just start -> takeWhile (\c -> c /= '/' && c /= ':') (drop start url)
  Nothing -> url
  where
    n = length url
    findScheme i
      | i + 3 > n = Nothing
      | take 3 (drop i url) == "://" = Just (i + 3)
      | otherwise = findScheme (i + 1)

takeN :: Int -> [a] -> ([a], [a])
takeN n xs = splitAt (max 0 n) xs

featureBase :: String -> IO (IORef Bool, IORef Value)
featureBase _ = do
  active <- newIORef True
  fopts <- newIORef VNoval
  pure (active, fopts)

-- ------------------------------------------------------------------
-- base / log
-- ------------------------------------------------------------------

baseFeature :: IO Feature
baseFeature = do
  (active, fopts) <- featureBase "base"
  pure Feature { fName = "base", fVersion = "0.0.1", fActive = active, fOptions = fopts
               , fInit = \_ _ -> pure (), fHook = \_ _ -> pure () }

logFeature :: IO Feature
logFeature = do
  (active, fopts) <- featureBase "log"
  let initFn _ opts = do a <- optActive opts; writeIORef active a
  pure Feature { fName = "log", fVersion = "0.0.1", fActive = active, fOptions = fopts
               , fInit = initFn, fHook = \_ _ -> pure () }

-- ------------------------------------------------------------------
-- retry
-- ------------------------------------------------------------------

retryFeature :: IO Feature
retryFeature = do
  (active, fopts) <- featureBase "retry"
  options <- newIORef =<< emptyMap
  let statuses = do
        opts <- readIORef options
        v <- getp opts "statuses"
        case v of VList _ -> do its <- listItems v; pure [truncate n | VNum n <- its]; _ -> pure [408, 425, 429, 500, 502, 503, 504]
      retryAfter resV = case resV of
        VMap _ -> do
          h <- getp resV "headers"
          case h of
            VMap _ -> do
              ra <- headerCI h "retry-after"
              case ra of
                VNoval -> pure Nothing; VNull -> pure Nothing
                _ -> case reads (vstring ra) :: [(Double, String)] of [(x, _)] -> pure (Just (x * 1000)); _ -> pure Nothing
            _ -> pure Nothing
        _ -> pure Nothing
      retryable resV merr raised = do
        if raised || merr /= Nothing then pure True
        else if isNoval resV then pure True
        else case resV of VMap _ -> do st <- getp resV "status"; sts <- statuses; pure (case st of VNum n -> truncate n `elem` sts; _ -> False); _ -> pure False
      backoff resV attempt = do
        opts <- readIORef options
        minDelay <- optNum opts "minDelay" 50
        maxDelay <- optNum opts "maxDelay" 2000
        factor <- optNum opts "factor" 2
        ra <- retryAfter resV
        case ra of
          Just r -> pure (min maxDelay r)
          Nothing -> do
            let base = minDelay * (factor ^^ attempt)
            jv <- getp opts "jitter"
            jitter <- case jv of VBool False -> pure 0; _ -> do j <- randInt (max 1 (round minDelay)); pure (fromIntegral j)
            pure (min maxDelay (base + jitter))
      track ctx = do
        cl <- cc ctx
        bucket <- trackBucket cl "retry" (do rs <- emptyList; jo [("attempts", VNum 0), ("retries", rs)])
        bumpNum bucket "attempts" 1
      withRetry ctx url fd inner = do
        opts <- readIORef options
        retries <- optInt opts "retries" 2
        let loop attempt = do
              res <- try (inner ctx url fd) :: IO (Either SdkException (Value, Maybe Value))
              case res of
                Left ex -> do
                  ret <- retryable VNoval Nothing True
                  if not ret || attempt >= retries then ioError' ex
                  else do w <- backoff VNoval attempt; track ctx; sleepOf opts w; loop (attempt + 1)
                Right (r, e) -> do
                  ret <- retryable r e False
                  if not ret || attempt >= retries then pure (r, e)
                  else do w <- backoff r attempt; track ctx; sleepOf opts w; loop (attempt + 1)
        loop 0
      initFn ctx opts = do
        om <- toOptsMap opts; writeIORef options om
        a <- optActive opts; writeIORef active a
        when a $ do u <- cu ctx; inner <- readIORef (uFetcher u); writeIORef (uFetcher u) (\c ur f -> withRetry c ur f inner)
  pure Feature { fName = "retry", fVersion = "0.0.1", fActive = active, fOptions = fopts, fInit = initFn, fHook = \_ _ -> pure () }

ioError' :: SdkException -> IO a
ioError' = Control.Exception.throwIO
  where throwIO = SdkTypesThrow

-- helper: rethrow an SdkException
SdkTypesThrow :: SdkException -> IO a
SdkTypesThrow = error "unused"
