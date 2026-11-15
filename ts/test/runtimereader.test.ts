// Every forms file, ported or not, reads its runtime: the operations, the load
// declaration and its result style, the record accessor, the public client and
// entity members, and the field types. SDKGEN_RUNTIME_TABLE=<path> writes what
// it read, one section per language, for a porter to write facts from.

import { describe, test } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'
import * as Fs from 'node:fs'
import * as Path from 'node:path'

import type { Decl, Forms, View } from './runtimeforms/forms'
import { OPS, SCAFFOLD, bracketed, esc, findDecls, generatorColumn, read, view } from './runtimeforms/forms'
import { FORMS_SRC, FRAMEWORK, RUNS, streamItems, streamClaims } from './runtimeforms/guard'
import { AHEAD, checkCitation } from './runtimeforms/account'

const { CANON_TYPE } = require('../dist/helpers/canonType.js')
const { canonToType } = require('../dist/sdkgen.js')

const LANGS: string[] = Fs.readdirSync(FORMS_SRC)
  .filter((f: string) => f.endsWith('.ts') && !FRAMEWORK.includes(f.slice(0, -3)))
  .map((f: string) => f.slice(0, -3)).sort()

const formsOf = (t: string): Forms => require(Path.resolve(__dirname, 'runtimeforms', t + '.js')).forms
const CANON = Object.keys(CANON_TYPE)


function problems(t: string, forms: Forms, v: View): string[] {
  const out: string[] = []
  const absent = forms.absentOps || {}
  for (const op of OPS) {
    const m = v.methods[op]
    if (null != absent[op]) {
      if (null != m.method) out.push(`${op} is listed as absent, and the reader finds ${m.method}`)
      continue
    }
    if (null == m.method) out.push(`${op}: ${m.why}`)
    else if (null == m.decl) out.push(`${op}: ${m.method} has no declaration the forms read`)
  }
  if (null == v.load) out.push('no load declaration')
  if ('none' === v.style) out.push('no result style in the load declaration')
  if (null == v.record) out.push('no record accessor (members.dataGet or members.data)')
  if (0 === v.client.length) out.push('no public client member')
  if (0 === v.entity.length) out.push('no public entity member')
  const client = read(forms.files.client)
  const entity = read(forms.files.entity)
  for (const [fam, name] of Object.entries(forms.members)) {
    if (null == name) continue
    const side = ['options', 'utility', 'direct', 'prepare', 'tester'].includes(fam) ? 'client' : 'entity'
    if (0 === findDecls(forms, 'client' === side ? client : entity, esc(name)).length) {
      out.push(`members.${fam} ${name} is not declared in the ${side} files`)
    }
    if (!(v as any)[side].includes(name)) out.push(`members.${fam} ${name} is not among the public ${side} members`)
  }
  const gen = generatorColumn(t)
  if (gen.column !== forms.types.column) out.push(`types: the forms give column ${forms.types.column}; ${gen.file} uses ${gen.column ?? 'none'}`)
  if (null == forms.types.column) {
    if (null == forms.types.reason) out.push('types: no column and no reason')
  }
  else for (const k of CANON) if ('' === String(canonToType('`$' + k + '`', forms.types.column) ?? '')) out.push(`types: ${k} has no ${forms.types.column} type`)
  out.push(...dimensionProblems(t, forms, v))
  return out
}


// What a declaration's own text shows, whatever the forms say: `throws` after
// the parameter list, a `static` head, a decorator or `def self.` that puts it
// on the type.
function shownByText(d: Decl): { throws: boolean, onType: boolean } {
  let throws = false
  if (d.rest.startsWith('(')) {
    const b = bracketed(d.rest, 0, '(')
    if (null != b) throws = /^\s*throws\b/.test(d.rest.slice(b.end))
  }
  const above = d.before.split('\n').slice(-2, -1)[0] || ''
  const onType = /\bstatic\b/.test(d.head) || /^\s*def self\./.test(d.head) || /^\s*@(classmethod|staticmethod)\b/.test(above)
  return { throws, onType }
}

function allDecls(forms: Forms, v: View): Decl[] {
  const names = new Set<string>([
    ...v.client, ...v.entity, ...Object.values(forms.members).filter((x): x is string => null != x),
    ...ctorNames(forms),
  ])
  const files = read([...forms.files.client, ...forms.files.entity, ...forms.files.ops])
  return [...names].flatMap((n) => findDecls(forms, files, esc(n)))
}

const ctorNames = (forms: Forms): string[] =>
  [forms.ctorDecl || forms.tokens.ctor, forms.testDecl || forms.members.tester].filter((x): x is string => null != x)

function dimensionProblems(t: string, forms: Forms, v: View): string[] {
  const out: string[] = []
  for (const d of allDecls(forms, v)) {
    const s = shownByText(d)
    if (s.throws && !/throws/.test(d.fails)) out.push(`${d.name} (${d.file}) is declared \`throws\`; the forms read its failure as ${JSON.stringify(d.fails)}`)
    if (s.onType && 'type' !== d.on) out.push(`${d.name} (${d.file}) is declared on the type; the forms read it as on ${d.on}`)
    if (d.field && 0 < d.params.length) out.push(`${d.name} (${d.file}) is read as a field and takes ${d.params.length} parameters`)
  }
  const opFails = OPS.map((op) => v.methods[op].decl?.fails || '').filter((x) => '' !== x)
  if (null == forms.failure && 0 < opFails.length) {
    out.push(`the operations show their failure in the declaration (${opFails[0]}); the forms state no failure record (failure: { shows, call })`)
  }
  if (null != forms.failure) {
    for (const op of OPS) {
      const d = v.methods[op].decl
      if (null != d && !d.fails.includes(forms.failure.shows)) {
        out.push(`${op}: the forms say an operation shows its failure as ${forms.failure.shows}; ${d.name} shows ${JSON.stringify(d.fails)}`)
      }
    }
  }
  if (null == forms.testDecl && null == forms.members.tester) out.push('no test constructor (testDecl)')
  else if (0 === findDecls(forms, read(forms.files.client), esc(forms.testDecl || forms.members.tester as string)).length) {
    out.push(`test constructor ${forms.testDecl || forms.members.tester} is not declared in the client files`)
  }
  if (null == forms.stream) out.push('no stream record (forms.stream): when the operation runs and when the items are read')
  else {
    const s = streamItems(t, forms.stream)
    if (null != s.problem) out.push('stream: ' + s.problem)
    else {
      if (s.runs !== forms.stream.runs) out.push(`stream: the code runs the operation ${s.runs}; the forms say ${forms.stream.runs}`)
      if (s.items !== forms.stream.items) out.push(`stream: the code reads the streaming feature's items ${s.items}; the forms say ${forms.stream.items}`)
      const kind = v.shapes.find((x) => 'stream' === x.member)?.shape.replace(/ \(.*$/, '')
      const claim = null == kind ? null : streamClaims(kind)
      if (null != claim && claim !== s.items && null == forms.exceptions?.streamItems) {
        out.push(`stream: kind ${kind} says its items are read ${claim}; the code reads them ${s.items}`)
      }
    }
  }
  const every = read([...forms.files.client, ...forms.files.entity, ...forms.files.ops])
  for (const [name, want] of Object.entries(forms.expect || {})) {
    const ds = findDecls(forms, every, esc(name))
    if (0 === ds.length) out.push(`expect ${name}: not declared in the runtime`)
    for (const d of ds) {
      for (const [k, w] of Object.entries(want)) {
        if ((d as any)[k] !== w) out.push(`expect ${name}: ${k} is ${JSON.stringify((d as any)[k])} in ${d.file}; the forms read ${JSON.stringify(w)}`)
      }
    }
  }
  for (const [what, c] of Object.entries(forms.shows || {})) {
    const bad = checkCitation(t, 'shows.' + what, (c as any).value, c, (x) => x)
    if (null != bad) out.push(bad)
  }
  // A fact cited ahead of a provider holds its value now, ported or not.
  const spell = (s: string) => s.replace(/\{(\w+)\}/g, (_m, k: string) => forms.tokens[k] ?? '{' + k + '}')
  for (const [path, c] of Object.entries(forms.cite || {}) as [string, any][]) {
    if (!AHEAD.test(path) || !('value' in c)) continue
    const bad = checkCitation(t, path, c.value, c, spell)
    if (null != bad) out.push(bad)
  }
  return out
}


// A parameter the caller may leave out is marked.
const paramsOf = (forms: Forms, d: Decl) => d.params.map((p) => forms.optional(p) ? p + ' [optional]' : p).join(', ')

const FAMILIES = ['options', 'utility', 'direct', 'prepare', 'data', 'match', 'make', 'name', 'stream']

function dimsCell(d: Decl): string {
  return [d.fails || '', d.on, d.field ? 'field' : 'callable'].join(' | ')
}

function retCell(ds: Decl[]): string {
  return [...new Set(ds.map((d) => d.returns + ('' !== d.returns && 'comment' === d.from ? ' (from a comment)' : '')))].join(' or ')
}


// The entity accessor, and what its argument becomes in the entity constructor.
function accessorLine(forms: Forms, client: any[], entity: any[]): string {
  const acc = null == forms.tokens.accessor ? null : findDecls(forms, client, esc(forms.tokens.accessor))[0]
  const ctor = null == forms.entityCtor ? null : findDecls(forms, entity, esc(forms.entityCtor))[0]
  return '\nEntity accessor: ' + (null == acc ? '(not read)' : '`' + acc.name.replace(/\\(.)/g, '$1') + '(' + acc.params.join(', ') + ')`' + ('' === acc.returns ? '' : ' -> `' + acc.returns + '`')) +
    '; the entity constructor: ' + (null == ctor ? '(not read)' : '`' + ctor.name + '(' + ctor.params.join(', ') + ')`') + '.'
}


// Whether the language's provider declares a fact: a citation of one it does
// not declare is ahead of it (an unported language's).
function declares(t: string, path: string): boolean {
  const p = Path.resolve(__dirname, '..', 'dist-test-scaffold', '.sdk', 'dist', 'cmp', t, 'Syntax_' + t + '.js')
  if (!Fs.existsSync(p)) return false
  let x: any = require(p).Syntax
  for (const k of path.replace(/\[(\d+)\]/g, '.$1').split('.')) { if (null == x) return false; x = x[k] }
  return undefined !== x
}

function section(t: string, forms: Forms, v: View): string {
  const client = read(forms.files.client)
  const entity = read(forms.files.entity)
  const shape = (name: string) => v.shapes.find((s) => new RegExp('[(, ]' + esc(name) + '[,)]').test(s.shape))?.shape.replace(/ \(.*$/, '') || ''
  const memberRow = (name: string, files: any[]) => {
    const ds = findDecls(forms, files, esc(name))
    const fam = Object.entries(forms.members).find(([, n]) => n === name)?.[0] || ''
    const params = 0 === ds.length ? '(not read)' : [...new Set(ds.map((d) => d.bare ? (d.field ? 'property or field' : 'no parameter list') : '(' + paramsOf(forms, d) + ')'))].join(' or ')
    return `| ${name} | ${params} | ${retCell(ds)} | ${[...new Set(ds.map(dimsCell))].join(' or ') || ' | | '} | ${fam} | ${shape(name)} |`
  }
  const ctorRow = (label: string, name: string | undefined) => {
    if (null == name) return `| ${label} | (none) | | | | | |`
    const ds = findDecls(forms, client, esc(name))
    return `| ${label} | ${name}${0 === ds.length ? ' (not read)' : ''} | ${[...new Set(ds.map((d) => '(' + paramsOf(forms, d) + ')'))].join(' or ')} | ${retCell(ds)} | ${[...new Set(ds.map(dimsCell))].join(' or ')} |`
  }
  const st = null == forms.stream ? null : streamItems(t, forms.stream)
  const lines = [
    `## ${t}`, '',
    `Result style: **${v.style}**; operations ${v.async ? 'resolve asynchronously' : 'return'}. ` +
    `Record accessor: ${null == v.record ? '(none)' : '`' + v.record.name + '`, ' + v.record.params + ' parameter(s)'}.`, '',
    'A failure shows in a declaration as its `fails` cell (empty: only by the result style); `on` is what a member is called on; ' +
    '`form` says whether it is called or is a field. A return read from a comment says so.', '',
    '| operation | method | parameters | returns | fails | on | form | source |', '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...OPS.map((op) => {
      const m = v.methods[op]
      if (null != forms.absentOps?.[op]) return `| ${op} | (absent: ${forms.absentOps[op]}) | | | | | | |`
      return `| ${op} | ${m.method ?? '(' + m.why + ')'} | ${null == m.decl ? '' : paramsOf(forms, m.decl)} | ${null == m.decl ? '' : retCell([m.decl])} | ${null == m.decl ? ' | | ' : dimsCell(m.decl)} | ${(m.decl?.file ?? '').split('#')[0]} |`
    }),
    ...(null == forms.failure ? [] : ['', `Every operation's declaration shows its failure as \`${forms.failure.shows}\`` +
      ('' === forms.failure.call ? '.' : `; a call to one is written with \`${forms.failure.call}\`.`)]),
    accessorLine(forms, client, entity),
    '', '| constructor | declaration | parameters | returns | fails | on | form |', '| --- | --- | --- | --- | --- | --- | --- |',
    ctorRow('client', forms.ctorDecl || forms.tokens.ctor), ctorRow('test', forms.testDecl || forms.members.tester),
    '', '| client member | parameters | returns | fails | on | form | family | shape |', '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...v.client.map((n) => memberRow(n, client)),
    '', '| entity member | parameters | returns | fails | on | form | family | shape |', '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...v.entity.map((n) => memberRow(n, entity)),
    '',
    'Members the runtime does not have: ' + (FAMILIES.filter((f) => null == (forms.members as any)[f] && null == (forms.members as any)[f + 'Get']).join(', ') || 'none') + '.',
    '',
    null == st || null != st.problem ? 'Stream: (not read)' :
      `Stream (${forms.stream?.file}): the operation runs **${st.runs}** (a provider declares \`runs: '${RUNS[st.runs]}'\`); the streaming feature's items are read **${st.items}**; ` +
      'without the feature the items are the whole result, read before the first one is handed over.',
    ...newRows(t, forms, v),
    ...Object.entries(forms.cite || {}).filter(([p, c]: [string, any]) => AHEAD.test(p) && 'value' in c)
      .map(([p, c]: [string, any]) => `- \`${p}\`, cited${declares(t, p) ? '' : ' ahead of a provider'}: \`${c.value}\` (` +
        ('absent' in c ? `absent from the whole runtime: ${c.absent.pattern}` : `${c.file}: \`${c.quote}\``) + ')'),
    ...Object.entries(forms.shows || {}).map(([what, c]: [string, any]) => `- ${what}: ${JSON.stringify(c.value)} (${c.file ?? 'absent from ' + c.absent?.files.join(', ')})`),
    '',
    null == forms.types.column
      ? `Field types: no code generator column (${forms.types.reason}).`
      : 'Field types (`canonToType`, column `' + forms.types.column + '`): ' +
        CANON.map((k) => `${k} \`${canonToType('`$' + k + '`', forms.types.column)}\``).join(', ') + '.',
    '',
  ]
  return lines.join('\n')
}


// Where a quote stands in its file, as file:line.
function where(file: string, quote: string | string[]): string {
  const q = ([] as string[]).concat(quote)[0]
  const p = Path.join(SCAFFOLD, file)
  if (!Fs.existsSync(p)) return file
  const text = Fs.readFileSync(p, 'utf8')
  const at = text.indexOf(q)
  return at < 0 ? file : file + ':' + text.slice(0, at).split('\n').length
}

// What a port's call printer and page must agree with: how a call is written,
// whether a stream reads a signal, the deleted mark, the accessor's kept
// instance.
function newRows(t: string, forms: Forms, v: View): string[] {
  const cite = (forms.cite || {}) as Record<string, any>
  const calls = null == forms.calls ? 'not stated yet (a port states them in calls)'
    : Object.entries(forms.calls.on).map(([on, seps]) => `on ${on} through ${0 === (seps as string[]).length ? 'nothing (a free function)' : (seps as string[]).map((x) => '`' + x + '`').join(' or ')}`).join('; ') +
      `; arguments ${({ paren: 'in parentheses', space: 'juxtaposed', lisp: 'in a Lisp form' } as any)[forms.calls.args || 'paren']}` +
      (forms.calls.parenless ? ', the parentheses optional' : '') +
      (null == forms.calls.ctor ? '' : '; ' + Object.entries(forms.calls.ctor).map(([a, b]) => `\`${a}\` runs \`${b}\``).join(', '))
  const sig = cite['ref.facts.streamSignal']
  const cancel = cite['ref.facts.cancel']
  const signal = null != sig && 'absent' in sig ? `none: absent from the whole runtime (${sig.absent.pattern})`
    : null != sig ? `read: \`${([] as string[]).concat(sig.quote)[0]}\` (${where(sig.file, sig.quote)})`
    : (null != cancel && 'absent' in cancel ? 'none: the cancel search leaves no stream region out' : 'not read by these forms')
  const deleted = v.entity.filter((n) => /delet/i.test(n))
  const cached = cite['ref.facts.accessor.cached']
  return [
    '', `Calls: ${calls}.`,
    `Stream signal (\`callopts.signal\`): ${signal}.`,
    `Deleted mark: ${0 === deleted.length ? 'no public entity member names one' : deleted.map((n) => '`' + n + '`' + (null != forms.undocumented?.[n] ? ' (' + forms.undocumented[n] + ')' : '')).join(', ')}.`,
    `Accessor called with no options: ${null == cached ? 'no kept instance cited' : `returns the instance the client keeps (\`${([] as string[]).concat(cached.quote)[0].split('\n')[0]}\`, ${where(cached.file, cached.quote)})`}.`,
  ]
}


describe('runtimereader', () => {
  test('forms files for every language', () => {
    ok(LANGS.length >= 20, 'forms files: ' + LANGS.join(' '))
  })

  const sections: string[] = []
  for (const t of LANGS) {
    test(t + ': the forms read the runtime', () => {
      const forms = formsOf(t)
      const v = view(forms)
      sections.push(section(t, forms, v))
      deepStrictEqual(problems(t, forms, v), [], t + ': what the forms cannot read')
    })
  }

  test('the table (SDKGEN_RUNTIME_TABLE=<path>)', () => {
    const out = process.env.SDKGEN_RUNTIME_TABLE
    if (null != out && '' !== out) {
      Fs.writeFileSync(out, '# What each runtime defines, read through its forms\n\n' + sections.join('\n'))
    }
    ok(0 < sections.length)
  })
})
