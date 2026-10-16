// VENDORED: @voxgig/sekreto 0.3.0 (typescript/src/provider/env.ts)
// Source: https://github.com/voxgig/sekreto @ ee837130bf444ca46a5a46181bdd6743e118898c  [tag: sdk-20261016-0845-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
/* Copyright (c) 2025 Voxgig Ltd, MIT License */

import { Provider, envkey } from './support'

/** Environment variables: `api.token` from `API_TOKEN`. */
export function envprovider(prefix?: string, source?: Record<string, any>): Provider {
  const env = source || process.env

  return {
    lookup: (name: string) => {
      const value = env[envkey(name, prefix)]
      return undefined === value || null === value ? undefined : String(value)
    },
    describe: () => 'env' + (prefix ? ':' + prefix : ''),
  }
}
