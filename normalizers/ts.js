// ts: normalizers whose pattern is a TypeScript convention.
const { lines, onNew, onOld } = require('../normalizers.js')
// A try/catch around a block, removed and dedented.
function untry(t) {
  const L = lines(t)
  if ('try {' !== L[0]) return t
  const c = L.findIndex((l) => /^\} catch \(err\) \{$/.test(l))
  return L.slice(1, c).map((l) => l.replace(/^ {2}/, '')).join('\n')
}
module.exports = [
  { id: 'ts-single-quote', order: 200, kind: 'unification', keys: /^ref:op/,
    undoes: 'a string literal is single-quoted, as every other ts example: OLD\'s "x" read as \'x\'',
    undo: onOld((t) => t.replace(/"(\w+)"/g, "'$1'")) },
  { id: 'ts-trailing-comma', order: 210, kind: 'unification', keys: /^ref:feature$/,
    undoes: 'a member laid out on its own lines closes with a comma: NEW\'s last comma removed',
    undo: onNew((t) => t.replace(/^  \},\n\}\)$/m, '  }\n})')) },
  { id: 'tutorial-write-unbound', order: 260, kind: 'unification', keys: /^tutorial:write$/,
    undoes: 'a tutorial write\'s result is not bound unless a later call reads it: OLD\'s `const updated = ` removed',
    undo: onOld((t) => t.replace(/^const (updated|patched) = /gm, '')) },
  { id: 'tutorial-list-attempt', order: 320, kind: 'unification', keys: /^tutorial:list$/,
    undoes: 'the tutorial list step is inside error handling: NEW\'s try/catch removed, OLD\'s blank line after list() closed up',
    undo: (t, side) => 'new' === side ? untry(t) : t.replace(/(list\(\))\n\n/, '$1\n') },
]
