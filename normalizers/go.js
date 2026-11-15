// go: normalizers whose pattern is Go syntax or Go layout.
const { lines, onNew, onOld, both } = require('../normalizers.js')
// A go program cut back to the statements of its main, as a fragment.
function goFragment(t) {
  const m = /^package main\n\nimport \(\n([\s\S]*?)\n\)\n\nfunc main\(\) \{\n([\s\S]*)\n\}$/.exec(t)
  if (null == m) return t
  const sdk = lines(m[1]).find((l) => /\bsdk "/.test(l)).trim()
  return 'import ' + sdk + '\n\n' + lines(m[2]).map((l) => l.replace(/^ {4}/, '')).join('\n')
}
module.exports = [
  { id: 'go-indent', order: 50, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'the server option is indented with its map (stage 1, go indentation): every line trimmed on both sides. Only go: in Python indentation is syntax',
    undo: both((t) => lines(t).map((l) => l.trim()).join('\n')) },
  { id: 'go-root-program', order: 80, kind: 'correction', keys: /^root$/,
    undoes: 'the root quick start is one complete program, as the tutorial is (stage 2, B): NEW cut back to the statements of main',
    undo: onNew(goFragment) },
  { id: 'go-testsdk-args', order: 160, kind: 'correction', keys: /^ref:test/,
    undoes: 'TestSDK is called with nil, nil, not undefined testopts, sdkopts (check-ref A12)',
    undo: onNew((t) => t.replace('sdk.TestSDK(nil, nil)', 'sdk.TestSDK(testopts, sdkopts)')) },
  { id: 'tutorial-loop-entity', order: 230, kind: 'unification', keys: /^tutorial/,
    undoes: 'the tutorial loop names its variable after the entity (OLD go tutorial alone used item): OLD\'s item read as planet. Names the entity of the harness model: go only',
    undo: onOld((t) => { const m = /for _, item := range (\w+)/.exec(t); return m ? t.replace(/\bitem\b/g, 'planet') : t }) },
]
