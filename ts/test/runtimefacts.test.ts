// A syntax provider declares facts about its runtime (RuntimeFacts, RefFacts).
// They are facts about the target's own templates, not the model, so they are
// re-derived here from those templates, through the forms each language
// declares in test/runtimeforms/<lang>.ts: every operation method, every
// declared signature's function and its parameters, the result style, the
// record accessor, every member both ways, the kind of the data, match and
// stream members, and the field-type printer. A provider with no forms fails.
// Each check has a negative control: the declared fact is changed in a copy
// of the provider and the check must then fail.

import { describe, test } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'
import * as Fs from 'node:fs'
import * as Path from 'node:path'

import type { Decl, Family, Forms } from './runtimeforms/forms'
import {
  defaultSigName, defaultSigParams, defaultSigReturns, findDecls, namePattern, publicNames, read,
} from './runtimeforms/forms'

const { CANON_TYPE } = require('../dist/helpers/canonType.js')
const { canonToType } = require('../dist/sdkgen.js')


const STAGE = Path.resolve(__dirname, '..', 'dist-test-scaffold', '.sdk', 'dist', 'cmp')
const FORMS = Path.resolve(__dirname, 'runtimeforms')

const PROVIDERS: string[] = Fs.readdirSync(STAGE)
  .filter((t: string) => Fs.existsSync(Path.join(STAGE, t, 'Syntax_' + t + '.js')))
  .sort()

function formsOf(t: string): Forms | null {
  const p = Path.join(FORMS, t + '.js')
  return Fs.existsSync(p) ? require(p).forms : null
}

function syntaxOf(t: string): any {
  return require(Path.join(STAGE, t, 'Syntax_' + t + '.js')).Syntax
}

const clone = (x: any): any => {
  const out: any = Array.isArray(x) ? [] : {}
  for (const [k, v] of Object.entries(x)) out[k] = null != v && 'object' === typeof v ? clone(v) : v
  return out
}


const FAMILY: Record<string, Family> = {
  options: 'options', utility: 'utility', utilityBase: 'utility', direct: 'direct', prepare: 'prepare',
  tester: 'tester', data: 'data', dataArg: 'data', dataGet: 'data', dataSet: 'data',
  match: 'match', matchArg: 'match', matchGet: 'match', matchSet: 'match',
  make: 'make', name: 'name', client: 'client', entopts: 'entopts',
  stream: 'stream', streamIterator: 'stream', streamGenerator: 'stream', streamList: 'stream', streamLazy: 'stream',
  streamSync: 'stream', streamFunction: 'stream',
}

const STYLES = ['pair', 'errslot', 'union', 'wrapped'] as const
const CANON = Object.keys(CANON_TYPE).map((k) => '`$' + k + '`')


type Finding = { check: string, what: string }

// Everything the guard re-derives for one language. Each finding names the
// check that failed; none when the provider agrees with its runtime.
function check(t: string, S: any, forms: Forms): Finding[] {
  const out: Finding[] = []
  const add = (c: string, what: string) => out.push({ check: c, what })
  const f = S.facts
  const r = S.ref ? S.ref.facts : null
  const client = read(forms.files.client)
  const entity = read(forms.files.entity)
  const ops = read(forms.files.ops)
  const all = [...client, ...entity, ...ops]

  const sigName = forms.sigName || defaultSigName
  const sigParams = forms.sigParams || defaultSigParams
  const sigReturns = forms.sigReturns || defaultSigReturns
  const one = (files: any[], name: string): Decl | null => findDecls(forms, files, name)[0] || null

  // A declared signature against its runtime declaration: the function, the
  // parameter count, which parameters may be left out, and the return.
  const sig = (where: string, sigText: string, files: any[]) => {
    const name = sigName(sigText)
    if ('' === name || /^\{(accessor|ctor)\}$/.test(name)) return
    const decls = findDecls(forms, files, namePattern(name))
    if (0 === decls.length) return add('signature', `${where}: ${name} is not defined by the runtime (${sigText})`)
    const declared = sigParams(sigText)
    const fits = decls.find((d) => d.params.length === declared.length) ||
      decls.find((d) => d.params.some((p) => /^\.\.\.|\.\.\.\w*$|^&?rest\b/.test(p)))
    if (null == fits) {
      return add('parameters', `${where}: ${name} takes ${decls.map((d) => d.params.length).join(' or ')} ` +
        `parameters in the runtime, ${declared.length} declared (${sigText})`)
    }
    const opt = (ps: string[]) => ps.map((p) => forms.optional(p) ? '?' : '!').join('')
    if (fits.params.length === declared.length && opt(fits.params) !== opt(declared) && null == forms.exceptions?.['optional:' + where]) {
      add('optional', `${where}: ${name} parameters ${opt(declared)} declared, ${opt(fits.params)} in the runtime (${sigText})`)
    }
    const dret = norm(sigReturns(sigText), forms)
    const rret = norm(fits.returns, forms)
    if ('' !== dret && '' !== rret && dret !== rret && null == forms.exceptions?.['returns:' + where]) {
      add('returns', `${where}: ${name} returns ${rret} in the runtime, ${dret} declared`)
    }
  }

  // Operation methods, each declared by the runtime's operations.
  for (const [op, m] of Object.entries(f.method)) {
    if (null == one(ops, m as string)) add('method', `${op} -> ${m} is not an operation the runtime defines`)
  }

  // The result style, re-derived from the load operation's declaration.
  const load = one(ops, f.method.load)
  if (null != load) {
    const derived = STYLES.find((s) => forms.style[s] && (forms.style[s] as any)(load)) ||
      (forms.style.raises.test(all.map((x) => x.text).join('\n')) ? forms.style.exception : 'none')
    if (derived !== f.result) add('style', `the runtime's load is in the ${derived} style; declared ${f.result}`)
    const isAsync = null != forms.async && forms.async(load)
    if (isAsync !== !!f.async) add('async', `the runtime's load ${isAsync ? 'resolves' : 'returns'}; declared async: ${f.async}`)
  }

  // The record accessor: a member an entity defines, with its arity where the
  // accessor states one.
  const acc = forms.record(f.record)
  const accDecls = findDecls(forms, [...entity, ...all], acc.name)
  if (0 === accDecls.length) add('record', `record accessor ${acc.name} (from ${f.record}) is not defined`)
  else if (null != acc.arity && !accDecls.some((d) => d.params.length === acc.arity)) {
    add('record', `record accessor ${acc.name} takes ${accDecls[0].params.length} parameters, ${acc.arity} declared`)
  }

  // Field types: the printer is total over the canonical types, and equal to
  // the code generator's map where the language has one.
  if (S.ref) {
    for (const c of CANON) {
      const got = S.ref.type(c)
      const key = c.replace(/[`$]/g, '')
      if (null == got || '' === got) add('types', `${key} prints no type`)
      else if (null != forms.types.column) {
        const want = canonToType(c, forms.types.column)
        if (got !== want && null == forms.exceptions?.['types:' + key]) add('types', `${key} prints ${got}; the code generator's map says ${want}`)
      }
      else if ('any' === got && !(forms.types.any || []).includes(key)) add('types', `${key} prints the generic any`)
    }
  }

  if (null == r) return out

  // Every declared signature.
  for (const [op, s] of Object.entries(r.op)) sig('op ' + op, s as string, ops)
  for (const [op, s] of Object.entries(r.opMatched || {})) sig('opMatched ' + op, s as string, ops)
  for (const m of r.client) sig('client ' + m.kind, m.sig, client)
  for (const m of r.entity) sig('entity ' + m.kind, m.sig, [...entity, ...all])
  for (const x of r.test) sig('test', x.sig, client)
  sig('accessor', r.accessor.sig, entity)

  // Members both ways: what the runtime defines publicly is declared (or
  // listed as undocumented, with its reason), and what is declared is defined.
  const spell = (n: string) => n.replace(/\{(\w+)\}/g, (_m, k: string) => forms.tokens[k] ?? '{' + k + '}')
  const known = [
    ...[...r.client, ...r.entity].map((m: any) => sigName(m.sig)), ...r.test.map((x: any) => sigName(x.sig)),
    ...Object.values(f.method) as string[], ...Object.values(r.op).map((s: any) => sigName(s)),
    ...r.ctor.map((l: string) => sigName(l)), ...(r.ctorAlts || []).map((x: any) => sigName(x.call)),
    sigName(r.accessor.sig), '{ctor}',
  ].filter((x) => '' !== x).map(spell)
  const isKnown = (n: string) => known.some((k) => k === n || (/\{\w+\}/.test(k) && new RegExp('^' + namePattern(k) + '$').test(n)))
  const undocumented = forms.undocumented || {}
  const pub = new Set<string>()
  for (const [where, re, files] of [['client', forms.public.client, client], ['entity', forms.public.entity, entity]] as const) {
    for (const n of publicNames(re, files as any)) {
      pub.add(n)
      if (!isKnown(n) && null == undocumented[n]) {
        add('members', `the runtime's ${where} defines ${n}, which the reference neither declares nor lists as undocumented`)
      }
    }
  }
  for (const n of Object.keys(undocumented)) {
    if (!pub.has(n)) add('members', `${n} is listed as undocumented and the runtime no longer defines it publicly`)
  }

  // Each family the runtime has is declared, under that family.
  const declaredFamilies = new Map<Family, string[]>()
  for (const m of [...r.client, ...r.entity]) {
    const fam = FAMILY[m.kind]
    declaredFamilies.set(fam, [...(declaredFamilies.get(fam) || []), m.kind])
  }
  for (const [fam, rname] of Object.entries(forms.members)) {
    if (null == rname || fam.endsWith('Get') || fam.endsWith('Set')) continue
    const files = ['options', 'utility', 'direct', 'prepare', 'tester'].includes(fam) ? client : entity
    const d = pub.has(rname) ? one(files, rname) : null
    if (null != d && !declaredFamilies.has(fam as Family)) add('members', `the runtime defines ${fam} (${rname}); the reference does not declare it`)
    if (null == d && declaredFamilies.has(fam as Family)) add('members', `${fam} is declared; the runtime has no ${rname}`)
  }

  // The shape of data and match: a get and set pair, one function whose
  // argument may be left out, or one whose argument is always passed.
  for (const fam of ['data', 'match'] as const) {
    const kinds = declaredFamilies.get(fam)
    if (null == kinds) continue
    const getn = forms.members[(fam + 'Get') as 'dataGet']
    const one1 = forms.members[fam]
    let want: string[] | null = null
    if (null != getn && null != one(entity, getn)) want = [fam + 'Get', fam + 'Set']
    else if (null != one1) {
      const d = one(entity, one1)
      if (null != d) want = [0 < d.params.length && !forms.optional(d.params[d.params.length - 1]) ? fam + 'Arg' : fam]
    }
    if (null != want && want.join() !== [...kinds].sort().join()) {
      add('kind', `${fam} is ${kinds.join(' and ')} in the reference; the runtime's shape is ${want.join(' and ')}`)
    }
  }

  // The kind of stream, from its declaration.
  const streamKinds = declaredFamilies.get('stream')
  if (null != streamKinds && null != forms.streamKind && null != forms.members.stream) {
    const d = one(entity, forms.members.stream)
    if (null != d) {
      const want = forms.streamKind(d)
      if (want !== streamKinds[0]) add('kind', `stream is ${streamKinds[0]} in the reference; the runtime's is ${want}`)
    }
  }

  return out
}

// A return type with the signature tokens spelled as the templates spell them.
function norm(s: string, forms: Forms): string {
  let out = s
  for (const [k, v] of Object.entries(forms.tokens)) out = out.split('{' + k + '}').join(v)
  return out.replace(/\s+/g, '')
}


// The declared facts no check reads, per language: what the guard cannot
// derive from the runtime.
const GUARDED_FACTS = new Set(['method', 'result', 'record', 'async'])
const GUARDED_REF = new Set(['op', 'opMatched', 'client', 'entity', 'test'])

function unguarded(S: any, forms: Forms): string[] {
  const out: string[] = []
  for (const k of Object.keys(S.facts)) if (!GUARDED_FACTS.has(k)) out.push('facts.' + k)
  if (S.ref) for (const k of Object.keys(S.ref.facts)) if (!GUARDED_REF.has(k)) out.push('ref.facts.' + k)
  if (S.ref) {
    for (const m of [...S.ref.facts.client, ...S.ref.facts.entity]) {
      if ('utility' === m.kind || 'utilityBase' === m.kind) out.push('ref.facts member kind ' + m.kind + ' (copy or live node)')
      if (null != m.returns) out.push('ref.facts member returns ' + m.kind)
    }
  }
  for (const k of Object.keys(S.notes || {})) out.push('notes.' + k)
  for (const k of Object.keys(forms.exceptions || {})) out.push('exception ' + k)
  return out
}


// Negative controls: each declared fact changed in a copy of the provider,
// and the check that must then fail.
type Control = { name: string, check: string, mutate: (S: any, forms: Forms) => boolean }

const CONTROLS: Control[] = [
  { name: 'an operation method renamed', check: 'method', mutate: (S) => { S.facts.method.update = S.facts.method.update + 'Nope'; return true } },
  { name: 'async flipped', check: 'async', mutate: (S) => { S.facts.async = !S.facts.async; return true } },
  { name: 'the result style changed', check: 'style', mutate: (S) => { S.facts.result = 'union' === S.facts.result ? 'throw' : 'union'; return true } },
  {
    name: 'the record accessor renamed', check: 'record', mutate: (S, forms) => {
      S.facts.record = S.facts.record.replace(forms.record(S.facts.record).name, 'nosuchreader')
      return true
    },
  },
  {
    name: 'a parameter added to load', check: 'parameters', mutate: (S, forms) => {
      if (null == S.ref) return false
      const sig = S.ref.facts.op.load
      const n = (forms.sigName || defaultSigName)(sig)
      const at = sig.indexOf(n) + n.length
      S.ref.facts.op.load = '(' === sig[at] ? sig.slice(0, at + 1) + 'extra, ' + sig.slice(at + 1)
        : sig.slice(0, at) + ' extra' + sig.slice(at)
      return true
    },
  },
  {
    name: 'a member the runtime does not define declared', check: 'signature', mutate: (S, forms) => {
      if (null == S.ref) return false
      const sig = S.ref.facts.entity[0].sig
      S.ref.facts.entity.push({ kind: 'make', sig: sig.replace((forms.sigName || defaultSigName)(sig), 'nosuchmember') })
      return true
    },
  },
  {
    name: 'a member the runtime defines left undeclared', check: 'members', mutate: (S) => {
      if (null == S.ref) return false
      const i = S.ref.facts.entity.findIndex((m: any) => 'make' === m.kind || 'name' === m.kind)
      if (i < 0) return false
      S.ref.facts.entity.splice(i, 1)
      return true
    },
  },
  {
    name: 'the stream kind changed', check: 'kind', mutate: (S) => {
      if (null == S.ref) return false
      const m = S.ref.facts.entity.find((x: any) => 'stream' === FAMILY[x.kind])
      if (null == m) return false
      m.kind = 'streamList' === m.kind ? 'streamIterator' : 'streamList'
      return true
    },
  },
  {
    name: 'an optional parameter shown required', check: 'optional', mutate: (S) => {
      if (null == S.ref) return false
      const sig = S.ref.facts.op.load
      const next = sig.replace(/^(.*)(\?(?=\s*:)|=None|\s*\\\\\s*nil)/, '$1')
      if (next === sig) return false
      S.ref.facts.op.load = next
      return true
    },
  },
  {
    name: 'a declared return changed', check: 'returns', mutate: (S, forms) => {
      if (null == S.ref) return false
      const sig = S.ref.facts.op.load
      const ret = (forms.sigReturns || defaultSigReturns)(sig)
      if ('' === ret || null != forms.exceptions?.['returns:op load']) return false
      // A return written ahead of the name (c) is the first occurrence.
      const at = sig.indexOf(ret) < sig.indexOf('(') ? sig.indexOf(ret) : sig.lastIndexOf(ret)
      S.ref.facts.op.load = sig.slice(0, at) + 'Nope' + sig.slice(at + ret.length)
      return true
    },
  },
  {
    name: 'the data member\'s shape changed', check: 'kind', mutate: (S) => {
      if (null == S.ref) return false
      const m = S.ref.facts.entity.find((x: any) => 'data' === FAMILY[x.kind])
      if (null == m) return false
      m.kind = ({ data: 'dataArg', dataArg: 'data', dataGet: 'dataArg' } as any)[m.kind] || m.kind
      return true
    },
  },
  {
    name: 'a field type printed as the generic any', check: 'types', mutate: (S) => {
      if (null == S.ref) return false
      const type = S.ref.type
      S.ref.type = (t: any) => '`$INTEGER`' === t ? ('any' === type(t) ? 'anything' : 'any') : type(t)
      return true
    },
  },
]


describe('runtimefacts', () => {

  test('every provider is checked', () => {
    ok(PROVIDERS.length >= 8, 'providers found: ' + PROVIDERS.join(' '))
  })

  for (const t of PROVIDERS) {
    test(t + ': the language declares its runtime forms', () => {
      ok(null != formsOf(t), t + ' has a syntax provider and no test/runtimeforms/' + t + '.ts: ' +
        'a ported language must declare how its runtime writes things')
    })

    test(t + ': the declared facts are what its runtime defines', () => {
      const forms = formsOf(t)
      if (null == forms) throw new Error(t + ': no runtime forms')
      deepStrictEqual(check(t, syntaxOf(t), forms), [], t + ': declared facts the runtime contradicts')
    })

    test(t + ': each check fails when its fact is changed (negative controls)', () => {
      const forms = formsOf(t)
      if (null == forms) throw new Error(t + ': no runtime forms')
      const missed: string[] = []
      for (const c of CONTROLS) {
        const S = clone(syntaxOf(t))
        S.ref = S.ref ? { ...S.ref, facts: clone(S.ref.facts) } : S.ref
        if (!c.mutate(S, forms)) continue
        const found = check(t, S, forms)
        if (!found.some((x) => x.check === c.check)) missed.push(`${c.name} (${c.check}): ${JSON.stringify(found)}`)
      }
      deepStrictEqual(missed, [], t + ': a changed fact the guard did not catch')
    })
  }

  test('unguarded declared facts, per language (listed, not asserted)', () => {
    const lines: string[] = []
    for (const t of PROVIDERS) {
      const forms = formsOf(t)
      if (null == forms) continue
      const u = unguarded(syntaxOf(t), forms)
      lines.push(`${t}: ${u.length} unguarded: ${u.join(', ')}`)
    }
    if (process.env.SDKGEN_GUARD_REPORT) console.log(lines.join('\n'))
    ok(0 < lines.length)
  })
})


export { check, unguarded, CONTROLS }
