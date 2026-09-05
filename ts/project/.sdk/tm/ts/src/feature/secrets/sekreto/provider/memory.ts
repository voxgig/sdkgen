// VENDORED: @voxgig/sekreto 0.2.0 (typescript/src/provider/memory.ts)
// Source: https://github.com/voxgig/sekreto @ a5a00db6e6d3a1ddbdef7ac62e8a75be53a9e042  [tag: sdk-20260904-1610-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
/* Copyright (c) 2025 Voxgig Ltd, MIT License */

import { Provider, envkey } from './support'

/** Literal values, keyed like environment variables. The spec uses this
 * to test chain behaviour without touching the outside world, and an app
 * uses it for defaults. */
export function memoryprovider(values: Record<string, string>, prefix?: string): Provider {
  return {
    lookup: (name: string) => values[envkey(name, prefix)],
    describe: () => 'memory' + (prefix ? ':' + prefix : ''),
  }
}
