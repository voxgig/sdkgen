// VENDORED: @voxgig/sekreto 0.3.0 (typescript/src/provider/dotenv.ts)
// Source: https://github.com/voxgig/sekreto @ ee837130bf444ca46a5a46181bdd6743e118898c  [tag: sdk-20261016-0845-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
/* Copyright (c) 2025 Voxgig Ltd, MIT License */

import { Provider, SekretoError, envkey, nodemod, parsedotenv } from './support'

/** A `.env` file, read once, keyed exactly like the environment. */
export function dotenvprovider(file: string, prefix?: string): Provider {
  let values: Record<string, string> | undefined

  const load = () => {
    if (undefined === values) {
      try {
        const { readFileSync } = nodemod<typeof import('node:fs')>('node:fs')
        values = parsedotenv(readFileSync(file, 'utf8'))
      } catch (err: any) {
        // An absent file - or an absent directory - means "no secrets
        // here", exactly like fileprovider. Anything else (permission
        // denied, an unreadable mount) is a store that could not answer,
        // and swallowing it would fall through to a weaker store.
        if ('ENOENT' === err.code || 'ENOTDIR' === err.code) {
          values = {}
        } else {
          throw new SekretoError(
            'sekreto: dotenv provider cannot read ' + file + ': ' + err.message,
          )
        }
      }
    }
    return values
  }

  return {
    lookup: (name: string) => load()[envkey(name, prefix)],
    describe: () => 'dotenv:' + file,
  }
}
