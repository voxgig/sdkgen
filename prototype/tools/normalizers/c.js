// c: normalizers whose pattern is C syntax.
const { lines, drop, onNew, onOld, both, squeeze } = require('../normalizers.js')
module.exports = [
  { id: 'server-required-given:c', order: 9, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'the client gives the server variables with no default (S50/D23): the `"server", cmap(...)` member removed from NEW, and its cmap count lowered, where OLD had none',
    undo: onNew((t, old) => /server/.test(old) ? t : t.replace(/cmap\((\d+),\n([\s\S]*?)\),\n\s*"server", cmap\([^\n]*\)\)\)\);/, (_m, n, body) => `cmap(${n - 1},\n${body})));`)) },
  { id: 'secret-option:c', order: 19, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'header Basic: the client passes the secret (S50/D23): the `"secret", v_str(getenv(...))` member removed from NEW and its cmap count lowered, where OLD had none',
    undo: onNew((t, old) => {
      if (/DEMO_SECRET/.test(old || '')) return t
      if (/,\n\s*"secret", v_str\(getenv\("DEMO_SECRET"\)\)/.test(t)) return t.replace(/,\n\s*"secret", v_str\(getenv\("DEMO_SECRET"\)\)/, '').replace(/cmap\((\d+),/, (_m, n) => `cmap(${n - 1},`)
      return /DEMO_SECRET/.test(t) ? drop(/["(.{ ]*"?secret"?\s*[:,=]|DEMO_SECRET/)(t).replace(/cmap\((\d+),/, (_m, n) => `cmap(${n - 1},`) : t
    }) },
  { id: 'c-err-declared', order: 90, kind: 'correction', keys: /^ref:/,
    undoes: 'a reference example declares the PNError* err it passes (OLD passed an undeclared err)',
    undo: onNew(drop(/^PNError\* err = NULL;$/)) },
  { id: 'c-err-placement', order: 100, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'err is declared ahead of the first block that calls an operation, not in the client block (stage 2, D)',
    undo: both((t) => squeeze(drop(/^PNError\* err = NULL;$/)(t))) },
  { id: 'c-err-reset', order: 110, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'a reported error is cleared, since a set *err fails every later call (check-v2 A6)',
    undo: onNew(drop(/^\s*err = NULL;$/)) },
  { id: 'c-stdlib', order: 120, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'getenv needs <stdlib.h> (stage 2, DEFECT c-getenv)',
    undo: onNew(drop(/^#include <stdlib\.h>$/)) },
  { id: 'handle-with-step:c', order: 140, kind: 'correction', keys: /^root$/,
    undoes: 'a handle is bound by the step that calls through it, after the step\'s comment (stage 2)',
    undo: both((t) => squeeze(drop(/^Entity\* \w+ = \w+\(client, NULL\);$/)(t)).replace(/^((?:#|\/\/) .*)\n\n/gm, '$1\n')) },
  { id: 'ref-update-note', order: 220, kind: 'unification', keys: /^ref:op:.*:(update|patch)$/,
    undoes: 'an update or patch example closes its data with a comment on what else to send (15 of 20 OLD): NEW\'s cmap with a trailing comment folded back onto one line',
    undo: onNew((t) => t.replace(/cmap\((\d+),\n([\s\S]*?)\n\s*\/\/ [^\n]*\n, NULL, &err\);/, (_m, n, body) => `cmap(${n}, ${lines(body).map((l) => l.trim()).join(' ')}, NULL, &err);`)) },
]
