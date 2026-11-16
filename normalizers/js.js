// js: normalizers whose pattern is JavaScript syntax.
const { onNew } = require('../normalizers.js')
module.exports = [
  { id: 'js-esm-import', order: 5, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'the SDK is imported with an ES import, as on the ts page, because the steps use top-level await (ran on node 24 from the repository root: OLD\'s require beside top-level await is refused before its first statement, ERR_AMBIGUOUS_MODULE_SYNTAX; NEW\'s import runs to the live request): NEW\'s import { X } from \'p\' read as OLD\'s const { X } = require(\'p\')',
    undo: onNew((t) => t.replace(/^import \{ ([\w$, ]+) \} from '([^']+)'$/m, "const { $1 } = require('$2')")) },
]
