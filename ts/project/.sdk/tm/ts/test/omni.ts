// The corpus test runner: vendored @voxgig/omni behind the struct-runner
// API the corpus tests already use (`import { makeRunner } from '../omni'`
// instead of the old hand-vendored '../runner').
//
// Two local decisions, both required (see vendor/omni/compat.ts):
//
// 1. SPEC PATH. The compat shim's caller-directory heuristic resolves a
//    relative test-file path one level too deep for this layout (loader in
//    dist-test/, test files in dist-test/utility/) - its own header says a
//    port must resolve the path itself. This module compiles to
//    dist-test/omni.js, the same depth as the old dist-test/runner.js, so
//    the existing TEST_JSON_FILE constant keeps working verbatim.
//
// 2. PROVIDER DELEGATION. Corpus-driven contexts get `ctx.client` set to
//    the runner's provider. The stock structprovider forwards utility()
//    and tester() but not options()/_features/_rootctx/_mode, which the
//    corpus subjects and pipeline utilities (prepareHeaders via
//    client.options(), test helpers via client._rootctx) do reach. The
//    provider below is built by PROTOTYPE DELEGATION over the live SDK
//    instance, so every SDK member resolves while the four omni hooks sit
//    on top. Upstream omni's compat shim could adopt the same shape.

import { isAbsolute, join } from 'node:path'

import {
  EXISTSMARK,
  NULLMARK,
  UNDEFMARK,
  nullModifier,
  structprovider,
} from './vendor/omni/compat'

import type { StructProvider, StructRunner } from './vendor/omni/compat'

import { OmniError, makeRunner as omnimakerunner } from './vendor/omni/index'

import type { Json } from './vendor/omni/index'


// Wrap the SDK as an omni provider WITHOUT hiding it: hooks from the stock
// structprovider, everything else through the prototype chain.
function sdkprovider(sdk: any): StructProvider {
  const hooks = structprovider(sdk)
  const provider = Object.assign(Object.create(sdk), hooks)

  // DEF.client entries become SDK instances too - rewrap with the same
  // delegating shape, not the stock one.
  provider.client = async (options: Json) => sdkprovider(await sdk.tester(options))

  return provider
}


// struct's makeRunner(testfile, client) signature, backed by vendored omni.
// Also accepts an already-parsed spec object (omni's own capability), which
// keeps smoke tests free of fixture files.
async function makeRunner(testfile: string | Json, client: any): Promise<StructRunner> {
  const specref = 'string' !== typeof testfile ? testfile
    : isAbsolute(testfile) ? testfile
      : join(__dirname, testfile)

  const provider = sdkprovider(client)
  const runner = await omnimakerunner(specref, provider)

  return async function structrunner(name: string, store?: any) {
    const runpack = await runner(name, store)

    return {
      spec: runpack.spec,
      runset: runpack.runset,
      runsetflags: runpack.runsetflags,
      subject: runpack.subject,
      client: provider,
    }
  }
}


export {
  EXISTSMARK,
  NULLMARK,
  UNDEFMARK,
  OmniError,
  makeRunner,
  nullModifier,
}
