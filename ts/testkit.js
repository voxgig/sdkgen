/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */

// `require('@voxgig/sdkgen/testkit')` — the package's second entry point.
//
// A stub rather than an `exports` map entry, on purpose. A map would name
// this subpath and, in doing so, replace the deep-import freedom this package
// has without one — and consumers depend on that freedom invisibly (generated
// model files include `@voxgig/sdkgen/model/sdkgen.aontu`; the scaffold is
// reached as `@voxgig/sdkgen/project/<lang>`). See the `_no_exports_comment`
// in package.json for what was measured.

module.exports = require('./dist/testkit.js')
