-- Primary utility tests. Verifies the shared `primary` subtree is present and
-- smoke-drives the pipeline utilities through the client utility (the rust
-- primary_utility_exists analog), plus a few direct utility behaviours.

module TPrimaryUtility (tests) where

import Data.IORef (readIORef, writeIORef)

import VoxgigStruct (Value (..), ismap, emptyMap)
import SdkTypes
import SdkHelpers
import SdkRuntime
import qualified SdkClient as C
import Testutil

mkCtx :: Client -> String -> IO Context
mkCtx cl opname = do
  root <- readIORef (clRootctx cl)
  makeContextImpl (defaultCtxSpec { csOpname = Just opname, csClient = Just cl, csUtility = Just (clUtility cl) }) root

tests :: Counters -> Value -> IO ()
tests c alltests = do
  runTest c "primary.subtree_present" $ do
    primary <- getp alltests "primary"
    pure (ismap primary)

  runTest c "primary.prepare_method" $ do
    cl <- C.testSdk0
    ctx <- mkCtx cl "load"
    m <- prepareMethodUtil ctx
    pure (m == "GET")

  runTest c "primary.prepare_headers_map" $ do
    cl <- C.testSdk0
    ctx <- mkCtx cl "load"
    h <- prepareHeadersUtil ctx
    pure (ismap h)

  runTest c "primary.prepare_query_map" $ do
    cl <- C.testSdk0
    ctx <- mkCtx cl "load"
    q <- prepareQueryUtil ctx
    pure (ismap q)

  runTest c "primary.make_options_map" $ do
    cl <- C.testSdk0
    ctx <- mkCtx cl "load"
    -- make_options runs once on raw options at construction; re-run on a
    -- fresh raw map (the inherited options already carry __derived__).
    raw <- emptyMap
    writeIORef (cOptions ctx) raw
    o <- makeOptionsUtil ctx
    pure (ismap o)

  runTest c "primary.clean_identity" $ do
    cl <- C.testSdk0
    ctx <- mkCtx cl "load"
    r <- cleanUtil ctx (VStr "x")
    pure (vstring r == "x")

  runTest c "primary.make_context_inherits" $ do
    cl <- C.testSdk0
    ctx <- mkCtx cl "load"
    opts <- readIORef (cOptions ctx)
    pure (ismap opts)
