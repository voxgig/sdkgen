// node purity.js --providers <ts/project/.sdk/src/cmp> [--lang l1,..] [--root <out-root>]
//   [--allow <dir of <lang>.json>] [--json]
//
// Syntax_<lang>.ts: imports only printing helpers; no model, ctx$,
// getModelPath, target., KIT, apidef or utility_<lang>; no reserved-word
// list; no case change or concatenation on a name from the description; no
// operation name outside the fact table; no condition on what the
// description says is shown. Notes (and prose literals of the fact tables)
// that name a feature, an option key, an entity or an operation are flagged.
// Naming_<lang>.ts: a rule the code generator does not share (concatenation
// onto the SDK name, a pluralisation, a reserved list not imported), and for
// each function the hook calls, the non-README components of the language
// that call it too. Exit 1 on any finding not accepted in --allow.
const Fs = require('node:fs')
const Path = require('node:path')
const C = require('./cut.js')
const K = require('./common.js')

// What a provider may import: helpers that quote, lay out or name a type
// from its canonical sentinel. Anything else imported is a finding.
const PRINTING = new Set(['indentLines', 'jsKey', 'jsProp', 'jsQuote', 'luaKey', 'luaString', 'uses', 'canonToType', 'canonKey'])
const OPS = ['list', 'load', 'create', 'update', 'patch', 'remove']

// A model read is any of these, under any name or cast: the model's own
// paths (`.main.kit`, `.main[...]`, `kit.entity`, `.const.Name`) as well as
// the words that name it.
const MODEL_READ = /\bmodel\b|ctx\$|getModelPath|\btarget\.|\bKIT\b|@voxgig\/apidef|utility_\w+|\bnom\(|\.main\s*(\.|\[)\s*['"`]?kit\b|\bmain\.kit\b|\bkit\.(info|entity|feature|config|target|flow)\b|\.const\.(Name|name)\b|\.main\s*\[/
// A word compared with a name in place of a reserved list: an inline array
// of quoted words tested for membership, or a name compared with a quoted word.
const INLINE_RESERVED = /\[\s*['"][A-Za-z_]+['"](\s*,\s*['"][A-Za-z_]+['"])*\s*\]\s*\.(includes|indexOf|some|find)\(|\b(name|n|id|ident|word|s)\s*(===|==|!==)\s*['"][a-z_]+['"]|['"][a-z_]+['"]\s*(===|==|!==)\s*(name|n|id|ident|word)\b/
// Name surgery: cutting or testing the end or start of a name (a
// depluralising `.replace(/s$/, '')`, `.slice(0, -1)`, `endsWith('s')`) is a
// naming rule however it is spelled, in a printer, a hook or a helper either
// one defines. An anchored pattern counts only when it holds a letter, so an
// indentation `.replace(/^/gm, '  ')` is not one.
const NAME_SURGERY = /\.replace\(\s*\/(\^[^/\n]*[A-Za-z][^/\n]*|[^/\n]*[A-Za-z][^/\n]*\$)\/\w*\s*,|\b(?:name|Name|ident|word|var|str|s|n|id|key)\s*\.(?:slice\(\s*0\s*,\s*-\s*\d|substr(?:ing)?\()|\.(?:name|var|accessor|Name)\s*\.(?:slice\(\s*0\s*,\s*-\s*\d|substr(?:ing)?\()|\.(endsWith|startsWith)\(\s*['"`][A-Za-z]{1,6}['"`]\s*\)|\.replace\(\s*['"`][A-Za-z]{1,6}['"`]\s*,/
const SYNTAX_CHECKS = [
  ['name surgery', NAME_SURGERY],
  ['model read', MODEL_READ],
  ['inline reserved-word test', INLINE_RESERVED],
  ['reserved-word list', /RESERVED|isReserved|new Set(<[^>]*>)?\(\[\s*'[a-z]/],
  ['case change on a name', /\.(toLowerCase|toUpperCase|toLocaleLowerCase|toLocaleUpperCase|charAt)\(|\bcamel|\bsnake|\bpascal|\bcapitali[sz]e/i],
  ['concatenation on a description name', /(\b(desc|layout|sym|entity|e|ent)\.[\w.]+)\s*\+\s*['"`]|['"`]\s*\+\s*\b(desc|layout|sym|entity|ent)\.[\w.]+|\$\{\s*(desc|layout|sym|ent|entity)\.[\w.]+\s*\}[A-Za-z_]|[A-Za-z_]\$\{\s*(desc|layout|sym|ent|entity)\.[\w.]+\s*\}/],
  ['condition on what the description shows', /\b(if|while)\s*\(.*\bdesc\.(?!layout\b|Name\b|name\b)\w+|\bdesc\.(?!layout\b|Name\b|name\b)\w+[^\n]*\?[^\n]*:|&&\s*desc\.(?!layout\b)\w+|\|\|\s*desc\.(?!layout\b)\w+|\bdesc\.(quick|auth|options|server|entities|ref|features|test)\b/],
]

// The description under any spelling: a cast `(desc as any)`, a bracket
// `desc['features']`, an alias `const d = desc` and a destructuring
// `const { features } = desc` are all rewritten to `desc.<field>` before the
// checks run, so a condition on a description field is found however it is
// written. Only `layout`, `Name` and `name` are a printer's to read.
function canonicalDesc(src) {
  let t = src.replace(/\(\s*(desc)\s+as\s+[^)]+\)/g, '$1').replace(/<[^>]+>\s*desc\b/g, 'desc')
  t = t.replace(/\bdesc\s*\[\s*['"`](\w+)['"`]\s*\]/g, 'desc.$1')
  const aliases = new Set()
  for (const m of t.matchAll(/\b(?:const|let|var)\s+(\w+)\s*(?::[^=\n]*)?=\s*desc\b(?!\.)/g)) aliases.add(m[1])
  for (const al of aliases) t = t.replace(new RegExp('\\b' + al + '\\s*\\.\\s*(\\w+)', 'g'), 'desc.$1').replace(new RegExp('\\b' + al + '\\s*\\[\\s*[\'"`](\\w+)[\'"`]\\s*\\]', 'g'), 'desc.$1')
  t = t.replace(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*desc\b(?!\.)/g, (m, fields) => m + ' /* ' + fields.split(',').map((f) => f.split(':')[0].trim()).filter(Boolean).map((f) => 'desc.' + f + ' ?x:').join(' ') + ' */')
  return t
}

function regions(src, re) {
  const out = []
  for (const m of src.matchAll(re)) {
    let depth = 0, i = m.index + m[0].length - 1
    for (; i < src.length; i++) { const c = src[i]; if ('{' === c || '[' === c) depth++; else if ('}' === c || ']' === c) { depth--; if (0 === depth) break } }
    out.push([m.index, i, m[1]])
  }
  return out
}

function lineOf(src, idx) { return src.slice(0, idx).split('\n').length }

function vocabulary(a) {
  const feats = new Set()
  const fdir = Path.resolve(a.providers, '../../model/feature')
  if (Fs.existsSync(fdir)) for (const f of Fs.readdirSync(fdir)) if (f.endsWith('.aontu') && !/index/.test(f)) feats.add(f.replace(/\.aontu$/, ''))
  const opts = new Set(), ents = new Set()
  if (a.root) {
    const V = C.vocab([a.root])
    for (const e of V.entities) ents.add(e)
    for (const v of C.variationsOf(a.root)) for (const l of Fs.readdirSync(Path.join(a.root, v))) {
      const t = C.readIf(Path.join(a.root, v, l, 'REFERENCE.md'))
      if (!t) continue
      const con = /### Constructor[\s\S]*?(?=\n### )/.exec(t)
      if (con) for (const m of con[0].matchAll(/^\| `?([A-Za-z_$][\w$]*)/gm)) if (!/^(Key|Option|Name)$/.test(m[1])) opts.add(m[1].replace(/^\$/, ''))
    }
  }
  return { feats: [...feats], opts: [...opts].filter((o) => o.length > 2), ents: [...ents] }
}

function syntaxFindings(file, lang, voc) {
  const raw = Fs.readFileSync(file, 'utf8')
  const src = raw
  const lines = canonicalDesc(raw).split('\n')
  const F = []
  const facts = regions(src, /^\s*(?:export\s+)?const\s+(\w*[fF]acts\w*)\b[^=\n]*=\s*([{[])/gm)
  // A notes table wherever it is declared: a const, or a member of the
  // provider object at any indentation (`  notes: {`).
  const notes = regions(src, /^\s*(?:export\s+)?(?:const\s+|let\s+)?(\w*[nN]otes\w*)\b[^=\n]*[=:]\s*([{[])/gm)
  const inside = (idx, rs) => rs.some(([s, e]) => idx > s && idx < e)
  const offs = []; { let o = 0; for (const l of src.split('\n')) { offs.push(o); o += l.length + 1 } }
  lines.forEach((line, i) => {
    const at = offs[i] || 0
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
    const imp = /^import\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/.exec(line)
    if (imp) {
      if (imp[1]) return
      if ('@voxgig/sdkgen' !== imp[3]) F.push({ check: 'import from outside the printing helpers', line: i + 1, text: line.trim() })
      else for (const n of imp[2].split(',').map((s) => s.trim()).filter(Boolean)) if (!PRINTING.has(n)) F.push({ check: 'import of a non-printing helper', line: i + 1, text: n })
      return
    }
    if (/^import /.test(line)) { F.push({ check: 'import from outside the printing helpers', line: i + 1, text: line.trim() }); return }
    for (const [k, re] of SYNTAX_CHECKS) if (re.test(line)) F.push({ check: k, line: i + 1, text: line.trim() })
    if (!inside(at, facts)) {
      const m = line.match(new RegExp(`['"\`](${OPS.join('|')})['"\`]`))
      if (m) F.push({ check: 'operation name outside the fact table', line: i + 1, text: line.trim() })
    }
  })
  // Notes, and prose literals in the fact tables: no feature, option, entity or operation named.
  const lint = []
  const words = { feature: voc.feats, option: voc.opts, entity: voc.ents, operation: OPS }
  for (const m of src.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)) {
    const isNote = inside(m.index, notes)
    const text = m[0].slice(1, -1)
    // A Lisp form, `(list ent reqmatch ctrl) -> vector`, is a signature, not prose.
    const prose = /[A-Za-z]{2,} [A-Za-z]{2,} [A-Za-z]{2,}/.test(text) && !/[;{}=]|=>/.test(text) && !/^\(\(?:?[\w/{}.-]+[\s)]/.test(text)
    if (!isNote && !(prose && inside(m.index, facts))) continue
    const bare = text.replace(/`[^`]*`/g, ' ')
    // a number in a note is a claim about a value no provider can know
    if (isNote && /(?<![\w.])\d+(?![\w.])/.test(bare)) lint.push({ check: 'note states a number', line: lineOf(src, m.index), text: text.slice(0, 120) })
    for (const [kind, ws] of Object.entries(words)) for (const w of ws) {
      if (new RegExp(`(?<![A-Za-z0-9_])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`, 'i').test(kind === 'operation' ? bare : text)) lint.push({ check: `${isNote ? 'note' : 'fact prose'} names ${kind} "${w}"`, line: lineOf(src, m.index), text: text.slice(0, 120) })
    }
  }
  // Each note in a notes table is string literals and nothing else (one, or
  // several joined by `+`): a constant, a call or a `${...}` would put text
  // on the page that the lint above never read.
  const LIT = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g
  const unq = (q) => q.slice(1, -1).replace(/\\n/g, '\n').replace(/\\(.)/g, '$1')
  const noteEntries = []
  for (const [s0, e0] of notes) {
    const open = src.slice(s0, e0 + 1).search(/[{[]/)
    if (open < 0) continue
    const body = src.slice(s0 + open + 1, e0)
    const lits = []
    let shape = body.replace(LIT, (q) => { lits.push(q); return /^`/.test(q) && /\$\{/.test(q) ? '\u0002' : '\u0001' })
    shape = shape.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '')
    let li = 0
    for (const ent of shape.split(',').filter(Boolean)) {
      // One plain string literal per note (v3.2): a note joined from several
      // literals is a finding too, so a note reads as one string in the table.
      const m = /^(\w+|\u0001):(\u0001)$/.exec(ent)
      const nkey = (ent.match(/\u0001|\u0002/g) || []).length
      const mine = lits.slice(li, li + nkey); li += nkey
      const key = m && '\u0001' === m[1] ? unq(mine[0]) : (/^(\w+)/.exec(ent) || [])[1] || '?'
      const vals = m && '\u0001' === m[1] ? mine.slice(1) : mine
      if (!m) lint.push({ check: 'note is not one plain string literal', line: lineOf(src, s0), text: `${key}: ${ent.replace(/\u0001/g, "'...'").replace(/\u0002/g, '`${...}`').slice(0, 100)}` })
      noteEntries.push({ key, ok: !!m, text: m ? vals.map(unq).join('') : null })
    }
  }
  // the literal texts inside the notes regions: what the lint read
  const noteTexts = []
  for (const m of src.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)) if (inside(m.index, notes)) noteTexts.push(m[0].slice(1, -1).replace(/\\n/g, ' ').replace(/\\(.)/g, '$1'))
  return { lines: lines.length, findings: F, notes: notes.length, noteTexts, noteEntries, lint }
}

// The notes the compiled provider declares (what the page prints), each of
// which the lint must have read in a notes region of the source.
function declaredNotes(providers, lang) {
  const ts = Path.resolve(providers, '../../../..')
  const f = Path.join(ts, 'dist-test-scaffold/.sdk/dist/cmp', lang, 'Syntax_' + lang + '.js')
  if (!Fs.existsSync(f)) return null
  try {
    const S = require(f).Syntax
    return { ...(S.notes || {}), ...((S.ref && S.ref.notes) || {}) }
  } catch (e) { return null }
}
const flat = (s) => String(s).replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim()

// The text of a function a file defines (`function f(`, `const f = (`/`=>`), with its first line.
function fnBody(text, fn) {
  const re = new RegExp(`(^|\\n)[ \\t]*(?:export\\s+)?(?:function\\s+${fn}\\s*\\(|const\\s+${fn}\\s*(?::[^=\\n]*)?=)`)
  const m = re.exec(text)
  if (!m) return null
  const start = m.index + m[1].length
  let i = text.indexOf('{', start), depth = 0
  const arrowExpr = /=>\s*[^{\s]/.test(text.slice(start, (text.indexOf('\n', start) + 1) || text.length)) && !/=>\s*\{/.test(text.slice(start, (text.indexOf('\n', start) + 1) || text.length))
  let end
  if (arrowExpr || i < 0) end = (text.indexOf('\n', start) + 1) || text.length
  else { for (; i < text.length; i++) { if ('{' === text[i]) depth++; else if ('}' === text[i] && 0 === --depth) break } end = i + 1 }
  return { text: text.slice(start, end), line: text.slice(0, start).split('\n').length }
}

function namingFindings(file, lang, providers) {
  const src = Fs.readFileSync(file, 'utf8')
  const F = []
  src.split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return
    if (/(\bName\b|const\.Name|model\.Name)\s*\+\s*['"`]|['"`]\s*\+\s*(model\.const\.)?Name\b|\$\{[^}]*\bName\s*\}\w/.test(line)) F.push({ check: 'concatenation onto the SDK name', line: i + 1, text: line.trim() })
    if (/\+\s*['"`](s|es|ies)['"`]|plurali[sz]|\.replace\([^)]*y\$/.test(line)) F.push({ check: 'pluralisation', line: i + 1, text: line.trim() })
    if (/RESERVED|new Set(<[^>]*>)?\(\[\s*'/.test(line) && !/^import/.test(line)) F.push({ check: 'reserved list not imported', line: i + 1, text: line.trim() })
    if (INLINE_RESERVED.test(line)) F.push({ check: 'inline reserved-word test', line: i + 1, text: line.trim() })
    if (/['"`]\s*\+\s*\w+\(|\w+\([^)]*\)\s*\+\s*['"`]/.test(line) && !/Name\s*\+/.test(line)) F.push({ check: 'concatenation onto a generator name', line: i + 1, text: line.trim() })
    if (NAME_SURGERY.test(line)) F.push({ check: 'name surgery', line: i + 1, text: line.trim() })
  })
  // functions the hook calls, and who else in the language calls them
  const imported = []
  for (const m of src.matchAll(/^import\s+\{([^}]*)\}\s+from\s+'([^']+)'/gm)) for (const n of m[1].split(',').map((s) => s.trim()).filter(Boolean)) imported.push({ n, from: m[2] })
  const dir = Path.join(providers, lang)
  const others = Fs.readdirSync(dir).filter((f) => f.endsWith('.ts') && !/^(Readme|Syntax_|Naming_)/.test(f))
  const calls = []
  for (const { n, from } of imported) {
    if (!new RegExp(`\\b${n}\\s*\\(`).test(src.replace(/^import.*$/gm, ''))) continue
    const by = others.filter((f) => {
      const t = Fs.readFileSync(Path.join(dir, f), 'utf8')
      const defines = new RegExp(`(function\\s+${n}\\b|const\\s+${n}\\s*=)`).test(t)
      const body = defines ? t.replace(new RegExp(`(function\\s+${n}\\b[\\s\\S]*?\\n\\}|const\\s+${n}\\s*=[\\s\\S]*?\\n\\})`), '') : t
      return new RegExp(`\\b${n}\\s*\\(`).test(body)
    })
    calls.push({ fn: n, from, alsoCalledBy: by })
    if (!by.length) F.push({ check: 'naming function no non-README component calls', line: 0, text: `${n} (from ${from})` })
  }
  // Follow what the hook imports from its own language's directory, and the
  // functions those call in the same file: the same rules apply in a helper.
  // A rule in a helper a non-README component also calls is the code
  // generator's own (the generator names things by it): reported, not open.
  const helpers = []
  for (const { n, from } of imported) {
    if (!/^\.\.?\//.test(from)) continue
    const file = ['.ts', '.js', ''].map((x) => Path.resolve(dir, from + x)).find((f) => Fs.existsSync(f) && Fs.statSync(f).isFile())
    if (!file || !Path.resolve(file).startsWith(Path.resolve(providers) + Path.sep)) continue
    const text = Fs.readFileSync(file, 'utf8')
    const shared = (calls.find((c) => c.fn === n) || { alsoCalledBy: [] }).alsoCalledBy.length > 0
    const seen = new Set(), todo = [n]
    while (todo.length) {
      const fn = todo.shift()
      if (seen.has(fn)) continue
      seen.add(fn)
      const body = fnBody(text, fn)
      if (!body) continue
      helpers.push({ fn, file: Path.relative(providers, file), via: n, shared })
      body.text.split('\n').forEach((line, k) => {
        if (/^\s*(\/\/|\*)/.test(line)) return
        const at = body.line + k
        const hit = (check) => F.push({ check: `${check} in helper ${fn} (${Path.relative(providers, file)})`, line: at, text: line.trim(), helper: fn, shared })
        if (/\+\s*['"`](s|es|ies)['"`]|plurali[sz]|\.replace\([^)]*y\$/.test(line)) hit('pluralisation')
        if (NAME_SURGERY.test(line)) hit('name surgery')
        if (/RESERVED|new Set(<[^>]*>)?\(\[\s*'/.test(line) && !/^import/.test(line)) hit('reserved list not imported')
        if (INLINE_RESERVED.test(line)) hit('inline reserved-word test')
        if (MODEL_READ.test(line) && /\bmodel\b/.test(line) && !/\(\s*model\b|model\s*:/.test(line)) void 0
      })
      for (const m of body.text.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) if (!seen.has(m[1]) && fnBody(text, m[1])) todo.push(m[1])
    }
  }
  return { findings: F, calls, helpers }
}

function main() {
  const a = K.args(process.argv.slice(2))
  if (!a.providers) { console.error('usage: node purity.js --providers <ts/project/.sdk/src/cmp> [--lang l1,..] [--root <out-root>] [--allow file] [--json]'); process.exit(2) }
  const langs = K.list(a.lang) || [...new Set(Object.values(C.REG.ported).flat())]
  // accepted findings: purity-allow/<lang>.json, one file per language
  const allowDir = a.allow || Path.join(__dirname, 'purity-allow')
  const allow = {}
  for (const l of langs) { const f = Path.join(allowDir, l + '.json'); if (Fs.existsSync(f)) allow[l] = JSON.parse(Fs.readFileSync(f, 'utf8')) }
  const voc = vocabulary(a)
  const out = {}
  let bad = 0
  for (const l of langs) {
    const sf = Path.join(a.providers, l, `Syntax_${l}.ts`), nf = Path.join(a.providers, l, `Naming_${l}.ts`)
    const r = out[l] = { syntax: null, naming: null, accepted: [], open: [] }
    if (Fs.existsSync(sf)) r.syntax = syntaxFindings(sf, l, voc)
    if (Fs.existsSync(nf)) r.naming = namingFindings(nf, l, a.providers)
    // a provider that declares notes the lint did not read is an error
    const dn = declaredNotes(a.providers, l)
    r.declaredNotes = dn ? Object.keys(dn).length : null
    r.declaredKeys = dn ? Object.keys(dn) : []
    r.noteRegions = r.syntax ? r.syntax.notes : 0
    r.notesMissed = []
    if (dn && r.syntax) {
      const read = r.syntax.noteTexts.map(flat).join(' \u0000 ')
      for (const [k, v] of Object.entries(dn)) if (!flat(v).split(/\s+/).slice(0, 6).every((w) => read.includes(w))) r.notesMissed.push(k)
      if (Object.keys(dn).length && !r.syntax.notes) r.syntax.findings.push({ check: 'notes declared but no notes region found by the lint', line: 0, text: Object.keys(dn).join(', ') })
      else if (r.notesMissed.length) r.syntax.findings.push({ check: 'a declared note outside every notes region the lint read', line: 0, text: r.notesMissed.join(', ') })
      // every declared note, whole, is the text of a plain-literal entry the lint read
      const whole = new Set(r.syntax.noteEntries.filter((x) => x.ok).map((x) => flat(x.text)))
      const differs = Object.entries(dn).filter(([, v]) => !whole.has(flat(v))).map(([k]) => k)
      if (differs.length && !r.notesMissed.length) r.syntax.findings.push({ check: 'a declared note is not, whole, the literals of a notes entry', line: 0, text: differs.join(', ') })
    }
    const all = [...(r.syntax ? r.syntax.findings.map((f) => ({ ...f, file: 'Syntax' })) : []), ...(r.syntax ? r.syntax.lint.map((f) => ({ ...f, file: 'Syntax' })) : []), ...(r.naming ? r.naming.findings.map((f) => ({ ...f, file: 'Naming' })) : [])]
    for (const f of all) {
      const ok = (allow[l] || []).find((x) => x.file === f.file && x.check === f.check && x.text === f.text)
      if (ok) r.accepted.push({ ...f, why: ok.why })
      else if (f.helper && f.shared) r.accepted.push({ ...f, why: `in ${f.helper}, which a non-README component also calls: the code generator names things by this rule too` })
      else r.open.push(f)
    }
    if (r.open.length) bad++
  }
  if (a.json) { console.log(JSON.stringify(out, null, 1)) } else {
    console.log(`purity over ${langs.join(' ')} (vocabulary: ${voc.feats.length} features, ${voc.opts.length} option keys, ${voc.ents.length} entity name forms, ${OPS.length} operations)`)
    for (const [l, r] of Object.entries(out)) {
      console.log(`  ${l.padEnd(7)} Syntax ${r.syntax ? r.syntax.lines + ' lines' : 'absent'}, Naming ${r.naming ? 'present' : 'absent'}: ${r.open.length} open, ${r.accepted.length} accepted | notes declared ${null == r.declaredNotes ? '?' : r.declaredNotes}, note regions found ${r.noteRegions}, note lint findings ${r.syntax ? r.syntax.lint.filter((x) => /^note/.test(x.check)).length : 0}`)
      const by = {}
      for (const f of r.open) (by[f.file + ': ' + f.check] = by[f.file + ': ' + f.check] || []).push(f)
      for (const [k, fs] of Object.entries(by)) { console.log(`     ${k}: ${fs.length}`); for (const f of fs.slice(0, 6)) console.log(`        ${f.line}: ${f.text.slice(0, 130)}`); if (fs.length > 6) console.log(`        ... ${fs.length - 6} more`) }
      if (r.naming) for (const c of r.naming.calls) console.log(`     naming calls ${c.fn} (${c.from}); also called by: ${c.alsoCalledBy.join(', ') || 'NO non-README component'}`)
    }
  }
  process.exit(bad ? 1 : 0)
}
main()
