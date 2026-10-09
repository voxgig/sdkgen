// VENDORED: @voxgig/sekreto sdk-20261009-0906-0 (javascript/src/provider/env.js)
// Source: https://github.com/voxgig/sekreto @ 83396df4f1c3d579af17e152b7a55fdade307ab1  [tag: sdk-20261009-0906-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
/* Copyright (c) 2025 Voxgig Ltd, MIT License */

const { envkey } = require('./support')

/** Environment variables: `api.token` from `API_TOKEN`. */
function envprovider(prefix, source) {
  const env = source || process.env

  return {
    lookup: (name) => {
      const value = env[envkey(name, prefix)]
      return undefined === value || null === value ? undefined : String(value)
    },
    describe: () => 'env' + (prefix ? ':' + prefix : ''),
  }
}

module.exports = { envprovider }
