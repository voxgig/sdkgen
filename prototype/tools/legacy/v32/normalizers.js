// The one source of block normalizers. A normalizer undoes one named change
// on an OLD/NEW pair of code blocks so that blocks.js can say the pair is
// identical once that change is set aside:
//   - a CORRECTION undoes a catalogued fix (NEW right where OLD was wrong);
//   - a UNIFICATION undoes the one shape every language now prints.
// Each: { id, order (they run in ascending order, corrections before
// unifications at a key), kind, undoes (what it undoes, in words), keys (RegExp on the
// block key below), undo(block, side, other) -> block }. `side` is 'old' or
// 'new'; `other` is the other side's block. A normalizer here names no
// language: it applies wherever its pattern matches. One whose pattern is a
// single language's syntax lives in normalizers/<lang>.js, which only that
// language's porter edits; blocks.js loads this file and that one.
//
// Block keys: tutorial:{client,list,load,write,program}, root,
// ref:{ctor,test,instance:X,feature}, ref:op:X:<op>. blocks.js does not know
// which key a block has, so it tries each key of the section in turn (as the
// stage-3a explainer did): keys only order and scope the normalizers.

const lines = (t) => t.split('\n')
const drop = (re) => (t) => lines(t).filter((l) => !re.test(l)).join('\n')
const onNew = (f) => (t, side, other) => 'new' === side ? f(t, other) : t
const onOld = (f) => (t, side, other) => 'old' === side ? f(t, other) : t
const both = (f) => (t) => f(t)
const squeeze = (t) => t.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '')
const KEYS = {
  tutorial: ['tutorial:client', 'tutorial:list', 'tutorial:load', 'tutorial:write', 'tutorial:program'],
  rootquick: ['root'],
  reference: ['ref:ctor', 'ref:test', 'ref:instance:X', 'ref:feature', ...['list', 'load', 'create', 'update', 'patch', 'remove'].map((o) => 'ref:op:X:' + o)],
}

// The loop variable an OLD reference list example used, renamed to `item`.
function loopItem(t) {
  const m = /for \(const (\w+) of results\)|for (\w+) in &?results\b|for \(results\) \|(\w+)\||for \(const auto& (\w+) : results\)|\(doseq \[(\w+) /.exec(t)
  if (null == m) return t
  const v = m.slice(1).find((x) => null != x)
  return 'item' === v ? t : t.replace(new RegExp('(?<![.\\w:>/-])' + v + '\\b(?![(/-])', 'g'), 'item')
}

// The server option a templated URL needs, taken out of a client built over
// several lines (one `server` line and its variables).
const noServerLines = (t) => t.replace(/\n\s*(\.\{ |\(|")?"?server"?[^\n]*\n(\s*[^\n]*(tenant|account)[^\n]*\n)\s*[}\])]+\)?\)?,?\s*\}?\)?,?(?=\n)/, '')

const SHARED = [
  {
    id: 'server-required-given', order: 10, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'the client now gives the server variables that have no default (OLD omitted them, so the client could not be built; S50/D23): the server option is removed from NEW where OLD had none',
    undo: onNew((t, old) => /server/.test(old) ? t : noServerLines(t)),
  },
  {
    id: 'secret-option', order: 20, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'under header Basic auth the client passes the secret the runtime reads (S50/D23): lines naming the secret are removed from NEW where OLD had none',
    undo: onNew((t, old) => /DEMO_SECRET/.test(old || '') ? t : drop(/["(.{ ]*"?secret"?\s*[:,=]|DEMO_SECRET/)(t)),
  },
  {
    id: 'list-plural', order: 30, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'a list variable is the entity\'s plural from apidef, no invented plural (check-ref A2): console_s, historys, utilitys read as consoles, histories, utilities',
    undo: both((t) => t.replace(/\bconsole_s\b/g, 'consoles').replace(/\bhistorys\b/g, 'histories').replace(/\butilitys\b/g, 'utilities')),
  },
  {
    id: 'root-load-entity', order: 40, kind: 'correction', keys: /^root$/,
    undoes: 'the root quick start loads the entity the tutorial loads (the nested one where there is one; stage 2): NEW from its Load comment on is replaced by OLD\'s',
    undo: (t, side, other) => 'new' === side ? t.replace(/(\n(?:\/\/|#|;;) Load\n)[\s\S]*$/, (m) => { const i = other.search(/\n(?:\/\/|#|;;) Load\n/); return i < 0 ? m : other.slice(i) }) : t,
  },
  {
    id: 'blank-lines', order: 70, kind: 'correction', keys: /^(root|tutorial)/,
    undoes: 'one blank line between steps (OLD printed two where a step was absent): runs of blank lines squeezed on both sides',
    undo: both(squeeze),
  },
  {
    id: 'server-required-only', order: 130, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'the client passes only the server variables that have no default, with no comment (S50/D23/M12): OLD\'s region line and its comment are removed',
    undo: onOld((t) => drop(/Required: this API's server URL|"?region"?\s*(:|=>|,)\s*.*<region>|\(\s*"region"/)(t)),
  },
  {
    id: 'write-comment-style', order: 170, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'write comments follow the result style and say where the id comes from (A1, A4, A8): a Create/Update/Patch comment is cut to its first word on both sides',
    undo: both((t) => t.replace(/^(\s*(?:\/\/|#|;;) (?:Create|Update|Patch))\b.*$/gm, '$1')),
  },
  {
    id: 'step-comment-runtime-fact', order: 180, kind: 'correction', keys: /^(root|tutorial:program)/,
    undoes: 'a step comment names the step and states its runtime fact (stage-1 S catalogue): a List/Load comment is cut to its first word on both sides',
    undo: both((t) => t.replace(/^(\s*(?:\/\/|#|;;)) (List|Load)\b.*$/gm, '$1 $2')),
  },
  {
    id: 'trailing-blank', order: 3, kind: 'correction', keys: /^(tutorial|root)/,
    undoes: 'OLD left a blank line at the end of a block when no remove step followed: trailing newlines removed on both sides',
    undo: both((t) => t.replace(/\n+$/, '')),
  },
  // ---- unifications
  {
    id: 'ref-list-printed', order: 290, kind: 'unification', keys: /^ref:op:.*:list$/,
    undoes: 'a list example prints each item (15 of 20 OLD did): where OLD has no `for` loop, NEW is cut before its own',
    undo: onNew((t, old) => /^for /m.test(old) ? t : lines(t).slice(0, lines(t).findIndex((l) => /^for /.test(l)) < 0 ? undefined : lines(t).findIndex((l) => /^for /.test(l))).join('\n')),
  },
  {
    id: 'ref-loop-item', order: 300, kind: 'unification', keys: /^ref:op:.*:list$/,
    undoes: 'a reference list loop names its variable `item` (the plurality): OLD\'s loop variable renamed to item',
    undo: onOld(loopItem),
  },
  {
    id: 'ref-load-unprinted', order: 310, kind: 'unification', keys: /^ref:op:.*:(load|remove)$/,
    undoes: 'a load or remove result is printed only where an unused binding fails the build (14 of 20 OLD did not print): OLD\'s trailing print is removed',
    undo: onOld((t) => squeeze(t.replace(/\n(println!\(.*|if \(result\) \{\n.*\n\})$/, ''))),
  },
  {
    id: 'ref-type-comments', order: 280, kind: 'unification', keys: /^ref:op:.*:create$/,
    undoes: 'a create example comments each data member with its type (17 of 20 OLD did): trailing // comments removed from NEW',
    undo: onNew((t) => t.replace(/ \/\/ [^\n]*$/gm, '')),
  },
  {
    id: 'root-load-step', order: 330, kind: 'unification', keys: /^root$/,
    undoes: 'the root quick start loads as well as lists (most OLD roots did): NEW\'s // Load step removed where OLD had none',
    undo: onNew((t, old) => /\/\/ Load/.test(old) ? t : squeeze(t.replace(/\n\n(\s*)(\/\/) Load[\s\S]*?(?=\n\}\n?$|$)/, ''))),
  },
  {
    id: 'ref-generic-names', order: 240, kind: 'unification', keys: /^ref:op/,
    undoes: 'a reference example names its result `result`, a list `results` (17 of 20 OLD): NEW\'s result/results binding renamed to OLD\'s first binding',
    undo: onNew((t, old) => { const m = /^(\w+) = /m.exec(old); return null == m ? t : t.replace(/^(results|result) = /m, m[1] + ' = ') }),
  },
]

module.exports = { SHARED, KEYS, lines, drop, onNew, onOld, both, squeeze }
