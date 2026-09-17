// VENDORED: @voxgig/sekreto sdk-20260917-1242-0 (javascript/src/provider/memory.js)
// Source: https://github.com/voxgig/sekreto @ 108c4a914bee7b6534c30d1c68c25cd1b9377696  [tag: sdk-20260917-1242-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
/* Copyright (c) 2025 Voxgig Ltd, MIT License */

const { envkey } = require('./support')

/** Literal values, keyed like environment variables. The spec uses this
 * to test chain behaviour without touching the outside world, and an app
 * uses it for defaults. */
function memoryprovider(values, prefix) {
  return {
    lookup: (name) => values[envkey(name, prefix)],
    describe: () => 'memory' + (prefix ? ':' + prefix : ''),
  }
}

module.exports = { memoryprovider }
