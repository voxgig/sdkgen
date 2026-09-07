// VENDORED: @voxgig/sekreto sdk-20260907-0029-0 (javascript/src/provider/env.js)
// Source: https://github.com/voxgig/sekreto @ 86ba35a646e68a311bdece43cd5689369ca62e9d  [tag: sdk-20260907-0029-0]
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
