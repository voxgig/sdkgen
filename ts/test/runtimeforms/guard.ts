// The checks behind runtimefacts.test.ts: a provider's declared facts
// re-derived from its runtime through the language's forms, and the
// negative controls that change one fact each.

import * as Fs from 'node:fs'
import * as Path from 'node:path'

import type { Decl, Family, Forms, OpName } from './forms'
import {
  OPS, defaultSigName, defaultSigParams, defaultSigReturns, esc, findDecls, namePattern, opMethod, opSource,
  publicNames, read,
} from './forms'
import { account, codeTokens } from './account'

const { CANON_TYPE } = require('../../dist/helpers/canonType.js')
const { canonToType } = require('../../dist/sdkgen.js')


const STAGE = Path.resolve(__dirname, '..', '..', 'dist-test-scaffold', '.sdk', 'dist', 'cmp')
const FORMS = __dirname
const FORMS_SRC = Path.resolve(__dirname, '..', '..', 'test', 'runtimeforms')
const FRAMEWORK = ['forms', 'account', 'guard']

const PROVIDERS: string[] = Fs.readdirSync(STAGE)
  .filter((t: string) => Fs.existsSync(Path.join(STAGE, t, 'Syntax_' + t + '.js')))
  .sort()

function formsOf(t: string): Forms | null {
  if (!Fs.existsSync(Path.join(FORMS_SRC, t + '.ts'))) return null
  const p = Path.join(FORMS, t + '.js')
  return Fs.existsSync(p) ? require(p).forms : null
}

function syntaxOf(t: string): any {
  return require(Path.join(STAGE, t, 'Syntax_' + t + '.js')).Syntax
}

const clone = (x: any): any => {
  if (null == x || 'object' !== typeof x || x instanceof RegExp) return x
  const out: any = Array.isArray(x) ? [] : {}
  for (const [k, v] of Object.entries(x)) out[k] = clone(v)
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
type Result = { findings: Finding[], verified: Set<string>, uncompared: Record<string, number> }

function check(t: string, S: any, forms: Forms): Result {
  const out: Finding[] = []
  const verified = new Set<string>()
  const uncompared: Record<string, number> = { returns: 0, paramTypes: 0, paramNames: 0 }
  const add = (c: string, what: string) => out.push({ check: c, what })
  const f = S.facts
  const r = S.ref ? S.ref.facts : null
  const client = read(forms.files.client)
  const entity = read(forms.files.entity)
  const ops = read(forms.files.ops)
  const all = [...client, ...entity, ...ops]
  const exc = forms.exceptions || {}

  const sigName = forms.sigName || defaultSigName
  const sigParams = forms.sigParams || defaultSigParams
  const sigReturns = forms.sigReturns || defaultSigReturns
  const spell = (n: string) => n.replace(/\{(\w+)\}/g, (_m, k: string) => forms.tokens[k] ?? '{' + k + '}')
  const pattern = (n: string) => /(?<!\$)\{\w+\}/.test(spell(n)) ? namePattern(spell(n)) : esc(spell(n))
  const one = (files: any[], name: string): Decl | null => findDecls(forms, files, esc(name))[0] || null
  const type = (s: string) => {
    const n = norm(s, forms)
    return forms.typeNames?.[n] ?? n
  }

  // Parameter names and types, where both sides state them.
  const params = (where: string, declared: string[], runtime: string[]): boolean => {
    let good = true
    if (null == forms.param) {
      if (0 < declared.length) uncompared.paramNames++
      return good
    }
    declared.forEach((dp, i) => {
      const d = (forms.param as any)(dp)
      const rt = (forms.param as any)(runtime[i])
      if ('' !== d.name && '' !== rt.name) {
        if (d.name !== rt.name && !([] as string[]).concat(forms.renames?.[rt.name] ?? []).includes(d.name) && null == exc['paramNames:' + where]) {
          good = false
          add('paramNames', `${where}: parameter ${i + 1} is ${rt.name} in the runtime, ${d.name} declared`)
        }
      }
      else if ('' !== d.name) uncompared.paramNames++
      if ('' !== d.type && '' !== rt.type) {
        if (type(rt.type) !== norm(d.type, forms) && null == exc['paramTypes:' + where]) {
          good = false
          add('paramTypes', `${where}: parameter ${d.name || i + 1} is ${rt.type} in the runtime, ${d.type} declared`)
        }
      }
      else if ('' !== d.type) uncompared.paramTypes++
    })
    return good
  }

  // A declared signature against its runtime declaration; the declaration
  // when it agrees.
  const sig = (where: string, path: string, sigText: string, files: any[]): Decl | null => {
    const name = sigName(sigText)
    if ('' === name) return null
    const decls = findDecls(forms, files, pattern(name))
    if (0 === decls.length) return add('signature', `${where}: ${spell(name)} is not defined by the runtime's ${where.split(' ')[0]} (${sigText})`), null
    const declared = sigParams(sigText)
    const fits = decls.find((d) => d.params.length === declared.length) ||
      decls.find((d) => d.params.some((p) => /^\.\.\.|\.\.\.\w*$|^&?rest\b/.test(p)))
    if (null == fits) {
      add('parameters', `${where}: ${name} takes ${decls.map((d) => d.params.length).join(' or ')} ` +
        `parameters in the runtime, ${declared.length} declared (${sigText})`)
      return null
    }
    let good = true
    const opt = (ps: string[]) => ps.map((p) => forms.optional(p) ? '?' : '!').join('')
    if (fits.params.length === declared.length && opt(fits.params) !== opt(declared) && null == exc['optional:' + where]) {
      good = false
      add('optional', `${where}: ${name} parameters ${opt(declared)} declared, ${opt(fits.params)} in the runtime (${sigText})`)
    }
    if (fits.params.length === declared.length && !params(where, declared, fits.params)) good = false
    const dret = norm(sigReturns(sigText), forms)
    const rret = '' === fits.returns ? '' : type(fits.returns)
    if ('' !== dret && '' === rret && null == exc['returns:' + where]) uncompared.returns++
    if ('' !== dret && '' !== rret && dret !== rret && null == exc['returns:' + where]) {
      good = false
      add('returns', `${where}: ${name} returns ${fits.returns} in the runtime, ${dret} declared`)
    }
    if (good) verified.add(path)
    return good ? fits : null
  }

  // A call a fact shows: the function exists, and takes that many arguments.
  const callOf = (where: string, path: string, line: string, files: any[]) => {
    const token = line.includes('{ctor}') ? '{ctor}' : spell('{ctor}')
    const at = line.indexOf(token)
    const after = at + token.length
    const name = forms.ctorDecl || spell('{ctor}')
    let args: string[] = []
    if ('(' === line[after]) args = defaultSigParams(name + line.slice(after))
    else args = line.slice(after).replace(/\).*$/, '').trim().split(/\s+/).filter((x) => '' !== x)
    const decls = findDecls(forms, files, esc(name))
    if (0 === decls.length) return add('ctor', `${where}: ${name} is not defined by the runtime (${line})`)
    const fit = decls.find((d) => d.params.filter((p) => !forms.optional(p)).length <= args.length && args.length <= d.params.length)
    if (null == fit) return add('ctor', `${where}: ${name} takes ${decls.map((d) => d.params.length).join(' or ')} parameters, the call passes ${args.length}`)
    verified.add(path)
  }

  // Operations: each method is the one its own operation's source defines.
  for (const op of OPS) {
    const m = (f.method as any)[op]
    const derived = opMethod(forms, op)
    if (null == derived.method) add('method', `${op}: cannot tell which method defines it: ${derived.why}`)
    else if (m !== derived.method) {
      add('method', `${op} -> ${m}, but ${opSource(forms, op).join(' ')} defines ${op} as ${derived.method}`)
    }
    else verified.add('facts.method.' + op)
  }

  const loadM = opMethod(forms, 'load').method
  const load = null == loadM ? null : one(read(opSource(forms, 'load')), loadM) || one(ops, loadM)
  if (null != load) {
    const derived = STYLES.find((s) => forms.style[s] && (forms.style[s] as any)(load)) ||
      (forms.style.raises.test(all.map((x) => x.text).join('\n')) ? forms.style.exception : 'none')
    if (derived !== f.result) add('style', `the runtime's load is in the ${derived} style; declared ${f.result}`)
    else verified.add('facts.result')
    const isAsync = null != forms.async && forms.async(load)
    if (isAsync !== !!f.async) add('async', `the runtime's load ${isAsync ? 'resolves' : 'returns'}; declared async: ${f.async}`)
    else verified.add('facts.async')
  }

  const listM = opMethod(forms, 'list').method
  const list = null == listM ? null : one(read(opSource(forms, 'list')), listM) || one(ops, listM)
  if (null != list && '' !== list.returns) {
    if (null != f.listOf) {
      if (type(list.returns).includes(norm(f.listOf, forms))) verified.add('facts.listOf')
      else add('listOf', `list resolves to ${list.returns} in the runtime; listOf declares ${f.listOf}`)
    }
    const toks = [...String(f.collection).matchAll(/`([^`]+)`/g)].map((x) => x[1])
    if (0 < toks.length && toks.every((x) => list.returns.includes(x))) verified.add('facts.collection')
  }

  // The record accessor is an entity member, and the printer reads it.
  const acc = forms.record(f.record)
  const accDecls = findDecls(forms, entity, esc(acc.name))
  let recordOk = true
  if (0 === accDecls.length) recordOk = false, add('record', `record accessor ${acc.name} (from ${f.record}) is not an entity member`)
  else if (null != acc.arity && !accDecls.some((d) => d.params.length === acc.arity)) {
    recordOk = false
    add('record', `record accessor ${acc.name} takes ${accDecls[0].params.length} parameters, ${acc.arity} declared`)
  }
  const printed = printRecord(S)
  if (null == printed || !printed.includes(acc.name)) {
    recordOk = false
    add('record', `the provider prints a record as ${JSON.stringify(printed)}, which does not call ${acc.name}`)
  }
  if (recordOk) verified.add('facts.record')

  if (S.ref) {
    if (null == forms.types.column && (null == forms.types.reason || '' === forms.types.reason.trim())) {
      add('types', 'the forms give no type column and no reason: say why the printer is checked for totality only')
    }
    for (const c of CANON) {
      const got = S.ref.type(c)
      const key = c.replace(/[`$]/g, '')
      if (null == got || '' === got) add('types', `${key} prints no type`)
      else if (null != forms.types.column) {
        const want = canonToType(c, forms.types.column)
        if (got !== want && null == exc['types:' + key]) add('types', `${key} prints ${got}; the code generator's map says ${want}`)
      }
      else if ('any' === got && !(forms.types.any || []).includes(key)) add('types', `${key} prints the generic any`)
    }
  }

  if (null == r) return finish()

  for (const k of ['STRING', 'OBJECT', 'ANY']) {
    if (null != forms.types.column && r.valueType[k] === S.ref.type('`$' + k + '`')) verified.add('ref.facts.valueType.' + k)
  }

  for (const [which, set] of [['op', r.op], ['opMatched', r.opMatched || {}]] as const) {
    for (const [op, s] of Object.entries(set)) {
      if (spell(sigName(s as string)) !== (f.method as any)[op]) {
        add('signature', `${which} ${op}: the signature names ${sigName(s as string)}; ${op}'s method is ${(f.method as any)[op]}`)
      }
      else sig(which + ' ' + op, `ref.facts.${which}.${op}`, s as string, ops)
    }
  }
  const memberDecl: Record<string, Decl | null> = {}
  r.client.forEach((m: any, i: number) => {
    memberDecl['client' + i] = sig('client ' + m.kind, `ref.facts.client[${i}].sig`, m.sig, client)
  })
  r.entity.forEach((m: any, i: number) => {
    memberDecl['entity' + i] = sig('entity ' + m.kind, `ref.facts.entity[${i}].sig`, m.sig, entity)
  })
  r.test.forEach((x: any, i: number) => {
    const d = sig('test', `ref.facts.test[${i}].sig`, x.sig, client)
    if (null == d) return
    if (spell(x.call).includes(spell(sigName(x.sig)))) verified.add(`ref.facts.test[${i}].call`)
    else add('test', `test constructor call ${x.call} does not call ${sigName(x.sig)}`)
    if ((0 < d.params.length) === !!x.args) verified.add(`ref.facts.test[${i}].args`)
    else add('test', `test constructor ${sigName(x.sig)} takes ${d.params.length} parameters; args declared ${x.args}`)
  })
  sig('accessor', 'ref.facts.accessor.sig', r.accessor.sig, client)

  if (null != forms.entityCtor) {
    const ctor = one(entity, forms.entityCtor)
    if (null == ctor || 0 === ctor.params.length) add('accessor', `entity constructor ${forms.entityCtor} not found`)
    else {
      const last = ctor.params[ctor.params.length - 1]
      const pname = forms.param ? forms.param(last).name : last
      const want = /opt/i.test(pname) ? 'entopts' : (/data/i.test(pname) ? 'data' : '?')
      if (want === r.accessor.arg) verified.add('ref.facts.accessor.arg')
      else if (null == exc['ref.facts.accessor.arg']) {
        add('accessor', `the accessor's argument becomes the entity constructor's ${pname}; declared arg: ${r.accessor.arg}`)
      }
    }
  }

  ;(r.ctor as string[]).forEach((line, i) => {
    if (line.includes('{ctor}') || (null != forms.tokens.ctor && new RegExp('\\b' + esc(forms.tokens.ctor) + '\\(').test(line))) {
      callOf('ctor', `ref.facts.ctor[${i}]`, line, client)
    }
  })

  for (const which of ['direct', 'prepare'] as const) {
    const rname = forms.members[which]
    const d = null == rname ? null : one(client, rname)
    if (null != d && '' !== d.returns && type(d.returns) === norm(r[which].returns, forms)) verified.add(`ref.facts.${which}.returns`)
  }

  // Members both ways.
  const known = [
    ...[...r.client, ...r.entity].map((m: any) => sigName(m.sig)), ...r.test.map((x: any) => sigName(x.sig)),
    ...Object.values(f.method) as string[], ...Object.values(r.op).map((s: any) => sigName(s)),
    ...(r.ctorAlts || []).map((x: any) => sigName(x.call)),
    sigName(r.accessor.sig), '{ctor}', ...[...String(f.record).matchAll(/([\w-]+)\(/g)].map((m) => m[1]),
  ].filter((x) => '' !== x).map(spell)
  const isKnown = (n: string) => known.some((k) => k === n || (/(?<!\$)\{\w+\}/.test(k) && new RegExp('^' + namePattern(k) + '$').test(n)))
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

  const shapeOk = new Set<string>()
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
    else if (null != want) shapeOk.add(fam)
  }

  const streamKinds = declaredFamilies.get('stream')
  if (null != streamKinds && null != forms.streamKind && null != forms.members.stream) {
    const d = one(entity, forms.members.stream)
    if (null != d) {
      const want = forms.streamKind(d)
      if (want !== streamKinds[0]) add('kind', `stream is ${streamKinds[0]} in the reference; the runtime's is ${want}`)
      else shapeOk.add('stream')
    }
  }

  // A member's kind names the runtime member its sig declares.
  for (const [side, list] of [['client', r.client], ['entity', r.entity]] as const) {
    list.forEach((m: any, i: number) => {
      const fam = FAMILY[m.kind]
      const rname = (forms.members as any)[m.kind] ?? (forms.members as any)[fam]
      if (null == rname) return
      if (spell(sigName(m.sig)) !== rname) {
        add('kind', `${side} member ${sigName(m.sig)} is declared as ${m.kind}; the runtime's ${m.kind} is ${rname}`)
        return
      }
      if (['data', 'match', 'stream'].includes(fam) && !shapeOk.has(fam)) return
      // Whether utility is a copy or the live node is not in a name: it is cited.
      if (null != memberDecl[side + i] && 'utility' !== fam) verified.add(`ref.facts.${side}[${i}].kind`)
    })
  }

  return finish()

  function finish(): Result {
    for (const k of ['returns', 'paramTypes', 'paramNames'] as const) {
      if (0 < uncompared[k] && null == forms.uncompared?.[k]) {
        add(k, `${uncompared[k]} declared ${k} compared with nothing in the runtime: compare them, or give the reason in uncompared.${k}`)
      }
    }
    return { findings: out, verified, uncompared }
  }
}

// A type with the signature tokens spelled as the templates spell them.
function norm(s: string, forms: Forms): string {
  let out = s
  for (const [k, v] of Object.entries(forms.tokens)) out = out.split('{' + k + '}').join(v)
  return out.replace(/\s+/g, '')
}

const PROBE_ENT = { name: 'planet', Name: 'Planet', sym: { accessor: 'Planet', var: 'planet', plural: 'planets' } }

// A record read through the provider's own printer.
function printRecord(S: any): string | null {
  const of = { role: 'one', entity: PROBE_ENT, name: 'planet' }
  const sc = { declared: new Set(), local: new Set(), stmts: [], section: [], standalone: false }
  const desc: any = { layout: { vars: {} }, entities: [{ ...PROBE_ENT, fields: [] }], quick: null, options: [] }
  try {
    return String(S.expr({ k: 'record', of }, sc, desc))
  }
  catch (e: any) {
    return null
  }
}


function full(t: string, S: any, forms: Forms) {
  const res = check(t, S, forms)
  const acc = account(t, S, forms, res.verified)
  return { ...res, account: acc, all: [...res.findings, ...acc.findings.map((what) => ({ check: 'account', what }))] }
}


type Control = { name: string, check: string, mutate: (S: any, forms: Forms) => boolean }

const firstCited = (forms: Forms) => Object.keys(forms.cite || {})[0]

const CONTROLS: Control[] = [
  { name: 'an operation method renamed', check: 'method', mutate: (S) => { S.facts.method.update = S.facts.method.update + 'Nope'; return true } },
  {
    name: 'two operations\' methods swapped', check: 'method', mutate: (S) => {
      const m = S.facts.method
      ;[m.list, m.load] = [m.load, m.list]
      return true
    },
  },
  { name: 'async flipped', check: 'async', mutate: (S) => { S.facts.async = !S.facts.async; return true } },
  { name: 'the result style changed', check: 'style', mutate: (S) => { S.facts.result = 'union' === S.facts.result ? 'throw' : 'union'; return true } },
  {
    name: 'the record accessor renamed', check: 'record', mutate: (S, forms) => {
      S.facts.record = S.facts.record.replace(forms.record(S.facts.record).name, 'nosuchreader')
      return true
    },
  },
  {
    name: 'the record printer reads another member', check: 'record', mutate: (S) => {
      const expr = S.expr
      S.expr = (e: any, sc: any, d: any) => 'record' === e.k ? e.of.name + '.nosuchreader()' : expr(e, sc, d)
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
    name: 'a parameter of load renamed', check: 'paramNames', mutate: (S, forms) => {
      if (null == S.ref || null == forms.param) return false
      const ps = (forms.sigParams || defaultSigParams)(S.ref.facts.op.load)
      const p = [...ps].reverse().find((x) => '' !== (forms.param as any)(x).name)
      if (null == p) return false
      const n = (forms.param as any)(p).name
      S.ref.facts.op.load = S.ref.facts.op.load.replace(p, p.replace(n, 'zzrenamed'))
      return true
    },
  },
  {
    name: 'a parameter type of load changed', check: 'paramTypes', mutate: (S, forms) => {
      if (null == S.ref || null == forms.param) return false
      const ps = (forms.sigParams || defaultSigParams)(S.ref.facts.op.load)
      const p = ps.find((x) => '' !== (forms.param as any)(x).type)
      if (null == p) return false
      const ty = (forms.param as any)(p).type
      S.ref.facts.op.load = S.ref.facts.op.load.replace(p, p.replace(ty, 'Zztype'))
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
    name: 'a client member declared on the entity', check: 'signature', mutate: (S, forms) => {
      if (null == S.ref) return false
      const sn = forms.sigName || defaultSigName
      const ent = new Set(S.ref.facts.entity.map((m: any) => sn(m.sig)))
      const m = S.ref.facts.client.find((x: any) => !ent.has(sn(x.sig)))
      if (null == m) return false
      S.ref.facts.entity.push({ ...m })
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
      const next = sig.replace(/^(.*)(\?(?=\s*:)|=None|\s*= nil|\s*\\\\\s*nil)/, '$1')
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
      const m = opMethod(forms, 'load').method
      const d = null == m ? null : findDecls(forms, read(forms.files.ops), esc(m))[0]
      if (null == d || '' === d.returns) return false
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
    name: 'a member\'s kind names another member', check: 'kind', mutate: (S) => {
      if (null == S.ref) return false
      const m = S.ref.facts.client.find((x: any) => 'direct' === x.kind)
      if (null == m) return false
      m.kind = 'prepare'
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
  {
    name: 'a type column dropped with no reason', check: 'types', mutate: (S, forms) => {
      if (null == S.ref) return false
      forms.types = { ...forms.types, column: null, reason: undefined }
      return true
    },
  },
  {
    name: 'a citation whose quote no longer exists', check: 'account', mutate: (_S, forms) => {
      const p = firstCited(forms)
      if (null == p) return false
      const c = (forms.cite as any)[p]
      ;(forms.cite as any)[p] = { ...c, quote: ([] as string[]).concat(c.quote).map((q) => q + ' zz-no-such-text') }
      return true
    },
  },
  {
    name: 'a cited code token changed', check: 'account', mutate: (S, forms) => {
      const spell = (s: string) => s.replace(/\{(\w+)\}/g, (_m, k: string) => forms.tokens[k] ?? '{' + k + '}')
      const p = Object.keys(forms.cite || {}).find((k) => /^facts\.|^ref\.facts\./.test(k) &&
        0 < codeTokens(k, get(S, k), spell).filter((x) => null == (forms.cite as any)[k].unquoted?.[x]).length)
      if (null == p) return false
      const tok = codeTokens(p, get(S, p), spell).filter((x) => null == (forms.cite as any)[p].unquoted?.[x])[0]
      set(S, p, String(get(S, p)).replace(tok, tok + 'Zz'))
      return true
    },
  },
  {
    name: 'a cited fact with its citation removed', check: 'account', mutate: (_S, forms) => {
      const p = firstCited(forms)
      if (null == p) return false
      delete (forms.cite as any)[p]
      return true
    },
  },
  {
    name: 'an accessor argument shown as data when it is options', check: 'accessor', mutate: (S, forms) => {
      if (null == S.ref || null == forms.entityCtor || null != forms.exceptions?.['ref.facts.accessor.arg']) return false
      S.ref.facts.accessor.arg = 'data' === S.ref.facts.accessor.arg ? 'entopts' : 'data'
      return true
    },
  },
]

function get(S: any, path: string): any {
  return path.replace(/\[(\d+)\]/g, '.$1').split('.').reduce((x, k) => null == x ? x : x[k], S)
}

function set(S: any, path: string, v: any) {
  const ks = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  const last = ks.pop() as string
  ks.reduce((x, k) => x[k], S)[last] = v
}


export {
  CONTROLS, FAMILY, FORMS, FORMS_SRC, FRAMEWORK, PROVIDERS, check, clone, formsOf, full, syntaxOf,
}
