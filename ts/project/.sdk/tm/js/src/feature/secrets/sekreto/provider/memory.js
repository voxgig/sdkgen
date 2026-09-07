// VENDORED: @voxgig/sekreto sdk-20260907-0029-0 (javascript/src/provider/memory.js)
// Source: https://github.com/voxgig/sekreto @ 86ba35a646e68a311bdece43cd5689369ca62e9d  [tag: sdk-20260907-0029-0]
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
