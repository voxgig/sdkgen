// node callcheck.js --clone <clone> --new <root> --lang <l> [--json]
//
// The printed-call check: what can be said about a call in a code block
// without a compiler, from what the guard's forms already read in the runtime
// (test/runtimeforms/<lang>.ts through dist-test: every operation's, client
// member's and entity member's declaration, its parameters, which are
// optional, and what it is called on).
//   ARITY     a call of a runtime member (`.load(`, `:load(`, `->load(`, or
//             OCaml's `.e_load a b`) passes fewer arguments than the
//             declaration requires, or more than it has;
//   RECEIVER  in a language whose separator says what a call is made on (Lua:
//             `:` an instance, `.` the module or type), the separator
//             disagrees with the declaration's `on`; an entity accessor is
//             made on the client instance;
//   MEMBER    a call on the client, the SDK module binding or an entity
//             variable names a member the runtime does not declare.
// It cannot see: an argument of the wrong type or in the wrong place (two
// swapped arguments of one type), a standard-library call (`List.map` for
// `List.iter`), a cast to a type the runtime lacks when no call is made on it,
// a property read (no parentheses), what a call on an expression returns, or
// any call it cannot attribute to a runtime member, a call written without
// parentheses (rb, perl) or in prefix form (clojure's `(f x)`: no call of
// clojure is read). Exit 1 on a finding.
const Fs = require('node:fs')
const Path = require('node:path')
const C = require('./cut.js')
const K = require('./common.js')

const SEP = { lua: { ':': 'instance', '.': 'module' } }
// separators that are not member access in a language
const NOT_SEP = { ocaml: new Set(['->', '::', ':']), elixir: new Set(['->', '::', ':']), clojure: new Set(['->', '::', ':']), c: new Set(['::', ':']), zig: new Set(['::', ':', '->']), go: new Set(['::', ':', '->']), py: new Set(['::', ':', '->']), ts: new Set(['::', ':', '->']), swift: new Set(['::', ':', '->']), rb: new Set([':', '->']), rust: new Set([':', '->']), lua: new Set(['::', '->']), perl: new Set([':', '.']) }
// a whole-line comment, by language: not code a call is read from
const COMMENT = /^\s*(#|\/\/|--|;|\(\*|\*)/
function walk(dir, out = []) { if (!Fs.existsSync(dir)) return out; for (const e of Fs.readdirSync(dir, { withFileTypes: true })) { const p = Path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else out.push(p) } return out }

function table(ts, lang) {
  const dt = Path.join(ts, 'dist-test', 'runtimeforms')
  if (!Fs.existsSync(Path.join(dt, 'guard.js'))) return null
  const G = require(Path.join(dt, 'guard.js')), F = require(Path.join(dt, 'forms.js'))
  let forms
  try { forms = G.formsOf(lang) } catch (e) { return null }
  const v = F.view(forms)
  const members = new Map()
  const add = (d, kind) => { if (d && d.name && !members.has(d.name)) members.set(d.name, { name: d.name, params: d.params, required: d.params.filter((p) => !forms.optional(p)).length, on: d.on, field: d.field, kind }) }
  for (const [op, m] of Object.entries(v.methods)) if (m.decl) add(m.decl, 'operation ' + op)
  const client = F.read(forms.files.client), entity = F.read(forms.files.entity)
  for (const n of v.client) for (const d of F.findDecls(forms, client, F.esc(n))) add(d, 'client member')
  for (const n of v.entity) for (const d of F.findDecls(forms, entity, F.esc(n))) add(d, 'entity member')
  for (const n of [forms.ctorDecl, forms.testDecl, forms.members && forms.members.tester].filter(Boolean)) for (const d of F.findDecls(forms, client, F.esc(n))) add(d, 'constructor')
  // every declaration of a name anywhere in the language's runtime tree is an
  // overload a call may use (swift's no-argument data() in core/Types.swift);
// feature trees (vendored plugins with a `load` of their own) and private
// declarations are not the SDK's members
  const sdk = Path.join(ts, 'project', '.sdk')
  const tree = [Path.join(sdk, 'tm', lang), Path.join(sdk, 'src', 'cmp', lang)].flatMap((d) => walk(d)).filter((f) => !/[/\\]test[s]?[/\\]|_test\.|Test\.|\.test\.|[/\\]feature[/\\]/.test(f)).map((f) => Path.relative(sdk, f))
  const everywhere = F.read(tree)
  for (const m of members.values()) {
    m.arities = new Set([m.params.length])
    for (const d of F.findDecls(forms, everywhere, F.esc(m.name))) {
      if (/\b(private|fileprivate)\b/.test(d.head || '')) continue
      m.arities.add(d.params.length); m.required = Math.min(m.required, d.params.filter((p) => !forms.optional(p)).length); m.max = Math.max(m.max || 0, d.params.length) }
    m.max = Math.max(m.max || 0, m.params.length)
  }
  // the constructor the naming hook prints (`sdk.new`): the member after the binding
  let ctor = null
  try { const L = require('./facts.js').load(ts, lang).facts.find((x) => 'layout.ctor' === x.path); if (L) ctor = String(L.value).split(/\.|::|->|:/).pop() } catch (e) { }
  return { members, forms, ctor }
}

// the top-level arguments of a bracketed list starting at s[i] === '('
function argsAt(s, i) {
  let depth = 0, cur = '', out = [], q = null
  for (let k = i; k < s.length; k++) {
    const c = s[k]
    if (q) { cur += c; if (c === q && s[k - 1] !== '\\') q = null; continue }
    if ('"' === c || "'" === c) { q = c; cur += c; continue }
    if ('([{'.includes(c)) { depth++; if (1 === depth) continue }
    if (')]}'.includes(c)) { depth--; if (0 === depth) { if (cur.trim()) out.push(cur.trim()); return { args: out, end: k } } }
    if (1 === depth && ',' === c) { out.push(cur.trim()); cur = ''; continue }
    if (1 === depth && '=' === c && '>' === s[k + 1]) { out.push(cur.trim()); cur = ''; k++; continue }
    cur += c
  }
  return null
}
// OCaml: juxtaposed atoms after the member, to the end of the expression
function atomsAt(s, i) {
  let k = i, n = 0
  const atoms = []
  while (k < s.length) {
    while (' ' === s[k] || '\t' === s[k]) k++
    const c = s[k]
    if ('\n' === c) { const nx = /^\n([ \t]+)(\S+)/.exec(s.slice(k)); if (nx && !/^(let|in|and|\||end|done|\)|;;)/.test(nx[2])) { k += 1; continue } break }
    if (null == c || ';' === c || ')' === c || ']' === c || ',' === c || '|' === c) break
    const word = /^[A-Za-z_][\w'.]*/.exec(s.slice(k))
    if (word && /^(in|then|else|with|do|done|and|let)$/.test(word[0])) break
    if ('(' === c || '[' === c || '{' === c) { const a = argsAt(s.replace(/[[{]/g, '(').replace(/[\]}]/g, ')'), k); if (!a) break; atoms.push(s.slice(k, a.end + 1)); k = a.end + 1; continue }
    if ('"' === c) { const e = s.indexOf('"', k + 1); atoms.push(s.slice(k, e + 1)); k = e + 1; continue }
    const m = /^[^\s;)\]},|]+/.exec(s.slice(k))
    if (!m) break
    atoms.push(m[0]); k += m[0].length
    if (++n > 20) break
  }
  return atoms
}

function run(a) {
  const lang = a.lang
  const ts = Path.join(Path.resolve(a.clone), 'ts')
  const T = table(ts, lang)
  if (!T) return { lang, ran: false, why: 'no compiled guard forms for ' + lang + ' in the clone', findings: [] }
  const V = C.vocab([a.new])
  const entVars = new Set(V.entities.map((e) => e.toLowerCase()))
  const accessors = new Set(V.entities.filter((e) => /^[A-Z][a-z0-9]+$/.test(e)))
  // an accessor is generated per entity (not in the forms): any entity name form, any case
  const entForm = (n) => entVars.has(n.toLowerCase()) || entVars.has(n.toLowerCase().replace(/_/g, ''))
  const sep = SEP[lang]
  const findings = []
  const seen = new Set()
  let calls = 0
  const names = [...T.members.keys()].sort((x, y) => y.length - x.length)
  const re = new RegExp(`(\\$?[A-Za-z_][\\w]*\\)?|\\))\\s*(\\.|:|->|::)\\s*(${[...names, ...accessors].map((n) => n.replace(/[$]/g, '\\$')).join('|')}|[a-z_]\\w*)\\b(\\s*\\(|\\s+(?=[(\\[A-Z"a-z]))?`, 'g')
  for (const v of C.variationsOf(a.new)) for (const section of C.SECTIONS) {
    const sect = C.loadSection(a.new, v, section, lang)
    if (null == sect) continue
    for (const b of C.blocks(sect)) {
      const code = b.code.split('\n').map((l) => COMMENT.test(l) ? '' : l).join('\n')
      // receivers whose members are the runtime's: the client, the module binding, and a variable bound from the client in this block
      const known = new Set(['client', 'sdk', 'self', ...[...code.matchAll(/\$?(\w+)\s*(?::=|=)(?!=)[^=\n]*\bclient\b/g)].map((x) => x[1])])
      for (const m of code.matchAll(re)) {
        const [all, recv, s, name, open] = m
        if ((NOT_SEP[lang] || new Set()).has(s)) continue
        const rv = recv.replace(/^\$/, '').replace(/\)$/, '')
        const at = m.index + all.length
        const mem = T.members.get(name)
        const report = (kind, why) => { const k = kind + '\u0000' + name + '\u0000' + why; if (seen.has(k)) return; seen.add(k); findings.push({ kind, name, why, v, section, at: b.at, line: code.split('\n')[code.slice(0, m.index).split('\n').length - 1].trim().slice(0, 140) }) }
        if (accessors.has(name) && sep && 'instance' !== sep[s] && 'client' === rv) { report('RECEIVER', `the entity accessor ${name} is made on the client instance; '${s}' makes it on the ${sep[s]}`); continue }
        if (!mem) {
          if (T.ctor && name === T.ctor) continue
          if (open && /\(/.test(open) && known.has(rv) && !accessors.has(name) && !entForm(name) && !/^[A-Z]/.test(rv)) report('MEMBER', `${rv}${s}${name}(...): the runtime declares no member ${name}`)
          continue
        }
        if (!open) continue
        calls++
        if (sep && sep[s] && mem.on && ('instance' === mem.on) !== ('instance' === sep[s])) report('RECEIVER', `${name} is declared on the ${mem.on}; '${s}' calls it on the ${sep[s]}`)
        let n
        if ('ocaml' === lang) { const at0 = atomsAt(code, m.index + all.length - open.length); n = 1 === at0.length && '()' === at0[0] && 0 === mem.max ? 0 : at0.length }
        else if (/\(/.test(open)) { const g = argsAt(code, m.index + all.length - 1); if (!g) continue; n = g.args.length }
        else continue // a call written without parentheses (rb, perl): its arguments are not read
        if (n < mem.required || n > mem.max) report('ARITY', `${name} passes ${n} argument(s); the runtime declares ${[...mem.arities].join(' or ')} (${mem.params.join(', ') || 'none'}), ${mem.required} required`)
      }
    }
  }
  return { lang, ran: true, members: T.members.size, calls, findings }
}

function main() {
  const a = K.args(process.argv.slice(2))
  if (!a.clone || !a.new || !a.lang) { console.error('usage: node callcheck.js --clone <clone> --new <root> --lang <l> [--json]'); process.exit(2) }
  const r = run(a)
  if (a.json) console.log(JSON.stringify(r, null, 1))
  else {
    for (const f of r.findings) console.log(`${f.kind} ${f.v} ${f.section} [${f.at}]: ${f.why}\n    ${f.line}`)
    console.log(`callcheck ${r.lang}: ${r.ran ? `${r.members} runtime members, ${r.calls} calls of them checked, ${r.findings.length} finding(s)` : 'NOT RUN: ' + r.why}`)
  }
  process.exit(r.findings.length ? 1 : 0)
}
module.exports = { run }
if (require.main === module) main()
