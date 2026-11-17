// rust: normalizers whose pattern is Rust syntax.
const { both, onNew } = require('../normalizers.js')
module.exports = [
  { id: 'S50/M12:rust', order: 1, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'secret passed only where the runtime reads it: the `("secret", ...)` entry removed on both sides',
    undo: both((t) => t.replace(/\n    \("secret", Value::str\(std::env::var\("DEMO_SECRET"\)\.unwrap_or_default\(\)\)\),/g, '')) },
  { id: 'S49:rust', order: 2, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'the server option the templated URL needs: the `("server", jo(vec![...]))` entry removed on both sides, and an emptied options map read as Value::Noval',
    undo: both((t) => t.replace(/\n    \("server", jo\(vec!\[\n(        .*\n)+    \]\)\),/g, '').replace(/DemoSDK::new\(jo\(vec!\[\n\]\)\);/g, 'DemoSDK::new(Value::Noval);')) },
  { id: 'getp-import', order: 3, kind: 'correction', keys: /^root$/,
    undoes: 'the root quick start imports getp, which its print uses: getp dropped from the use line on both sides',
    undo: both((t) => t.replace(/use demo_sdk::\{getp, jo,/g, 'use demo_sdk::{jo,')) },
  { id: 'write-comments:rust', order: 4, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'the shared write comments say where the id comes from: the clause after Update/Patch cut on both sides',
    undo: both((t) => t.replace(/^\/\/ (Update|Patch — sends only the fields given)(;| —) the id comes off.*$/mg, '// $1')) },
  { id: 'unify:created-binding:rust', order: 6, kind: 'unification', keys: /^(tutorial|root)/,
    undoes: 'the created entity is bound only where a later step uses it: `let created = ` removed on both sides',
    undo: both((t) => t.replace(/^let created = /mg, '')) },
  { id: 'rust-page-imports', order: 60, kind: 'correction', keys: /^root$/,
    undoes: 'the root block imports what the page imports, getp included (stage 2): getp removed from NEW\'s use line',
    undo: onNew((t) => t.replace('{getp, jo,', '{jo,')) },
]
