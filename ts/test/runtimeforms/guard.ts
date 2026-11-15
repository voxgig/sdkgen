// The checks behind runtimefacts.test.ts: a provider's declared facts
// re-derived from its runtime through the language's forms, and the
// negative controls that change one fact each.

import * as Fs from 'node:fs'
import * as Path from 'node:path'

import type { Decl, Family, Forms, On, OpName, StreamItems } from './forms'
import { SCAFFOLD } from './forms'
import {
  OPS, defaultSigName, defaultSigParams, defaultSigReturns, esc, findDecls, generatorColumn, namePattern, opMethod, opSource,
  publicNames, read,
} from './forms'
import { account, checkCitation, codeTokens, runtimeFiles, runtimeText } from './account'
import type { Call } from './calls'
import { arityFits, readCalls, receiverFits } from './calls'

const { CANON_TYPE } = require('../../dist/helpers/canonType.js')
const { canonToType } = require('../../dist/sdkgen.js')


const STAGE = Path.resolve(__dirname, '..', '..', 'dist-test-scaffold', '.sdk', 'dist', 'cmp')
const FORMS = __dirname
const FORMS_SRC = Path.resolve(__dirname, '..', '..', 'test', 'runtimeforms')
const FRAMEWORK = ['forms', 'account', 'guard', 'calls']

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
  const sig = (where: string, path: string, sigText: string, files: any[], instance = false): Decl | null => {
    const name = sigName(sigText) || (/\(/.test(sigText) ? '' : (/^\s*([\w{}$]+)/.exec(sigText) || [])[1] || '')
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
    // A field is not called, and what is called is not written as a field.
    const called = null != forms.called ? forms.called(spell(sigText), spell(name))
      : new RegExp(esc(spell(name)) + '\\s*[(\\[]').test(spell(sigText)) || /^\(/.test(sigText.trim())
    if (fits.field && called && null == exc['field:' + where]) {
      good = false
      add('field', `${where}: ${spell(name)} is a field of the runtime, declared as called (${sigText})`)
    }
    if (!fits.field && !called && !(forms.parenless && null == forms.called) && null == exc['field:' + where]) {
      good = false
      add('field', `${where}: ${spell(name)} is called in the runtime, declared as a field (${sigText})`)
    }
    if (null != forms.failure && fits.fails.includes(forms.failure.shows) &&
      !spell(sigText).includes(forms.failure.shows) && null == exc['fails:' + where]) {
      good = false
      add('fails', `${where}: ${spell(name)} shows its failure as ${forms.failure.shows} in the runtime; the signature does not (${sigText})`)
    }
    // What the signature writes the member on must be what the runtime declares.
    if (null != forms.calls) {
      const c = readCalls(forms.calls, spell(sigText), spell(name))[0]
      // On a variable the page binds (an instance), or on a type or module
      // name; a qualifier that is neither (c's vtable) says nothing.
      const types = [forms.tokens.client, forms.tokens.module, forms.tokens.sdk].filter((x) => null != x)
      const head = null == c ? '' : (/^\(?\s*\$?([A-Za-z_][\w$]*)/.exec(c.recv) || [])[1] || ''
      if (null != c && ('instance' === c.kind || 'result' === c.kind ? 'instance' !== fits.on : (types.includes(head) && 'instance' === fits.on)) &&
        null == exc['on:' + where]) {
        good = false
        add('on', `${where}: the signature writes ${spell(name)} on ${c.recv} (${sigText}); the runtime declares it on ${fits.on === 'module' ? 'its module' : 'the ' + fits.on}`)
      }
    }
    if (instance && 'type' === fits.on && null == exc['on:' + where]) {
      good = false
      add('on', `${where}: ${spell(name)} is declared on the type in the runtime, and listed among the instance members (${sigText})`)
    }
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
    const recv = receiver(line.split(token).join('\u0000ctor'), '\u0000ctor')
    if ('instance' === fit.on || 'instance' === recv) return add('on', `${where}: ${name} is declared on ${fit.on} in the runtime; the call ${line} makes it on ${recv}`)
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
  if (!recordWhole(t, S, forms, acc.name, printed, spell, add)) recordOk = false
  // A record printed by the print printer is unwrapped with facts.unwrap too.
  if (null != f.unwrap) {
    const shown = printStmt(S)
    if (null == shown || !shown.includes(String(f.unwrap))) {
      recordOk = false
      add('record', `the print printer shows a record as ${JSON.stringify(shown)}, which does not unwrap with facts.unwrap (${f.unwrap})`)
    }
  }
  if (recordOk) verified.add('facts.record')

  if (S.ref) {
    // The column is the generator's own: the one its EntityTypes component reads.
    const gen = generatorColumn(t)
    if (gen.column !== forms.types.column) {
      add('types', `the forms give type column ${forms.types.column}; ${gen.file} ${null == gen.column ? 'uses none' : 'uses ' + gen.column}`)
    }
    if (null == forms.types.column && (null == forms.types.reason || '' === forms.types.reason.trim())) {
      add('types', 'the forms give no type column and no reason: say why the type words are pinned instead')
    }
    for (const c of CANON) {
      const got = S.ref.type(c)
      const key = c.replace(/[`$]/g, '')
      if (null == got || '' === got) add('types', `${key} prints no type`)
      else if (null != forms.types.column) {
        const want = canonToType(c, forms.types.column)
        if (got !== want && null == exc['types:' + key]) add('types', `${key} prints ${got}; the code generator's map says ${want}`)
        // A word that differs from the map, with its reason, is pinned as well.
        else if (got !== want && got !== forms.types.words?.[key]) {
          add('types', `${key} prints ${got}, which differs from the code generator's ${want} with a reason; pin the word in types.words (pinned: ${forms.types.words?.[key]})`)
        }
      }
      else {
        // No generator map: each word is pinned, and the reviewer audits the pins.
        const pin = forms.types.words?.[key]
        if (null == pin) add('types', `${key} prints ${got}; with no generator column every type word is pinned in types.words`)
        else if (got !== pin) add('types', `${key} prints ${got}; the forms pin the type word ${pin}`)
        if ('any' === got && !(forms.types.any || []).includes(key)) add('types', `${key} prints the generic any`)
      }
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
    memberDecl['client' + i] = sig('client ' + m.kind, `ref.facts.client[${i}].sig`, m.sig, client, true)
  })
  r.entity.forEach((m: any, i: number) => {
    memberDecl['entity' + i] = sig('entity ' + m.kind, `ref.facts.entity[${i}].sig`, m.sig, entity, true)
  })
  r.test.forEach((x: any, i: number) => {
    const d = sig('test', `ref.facts.test[${i}].sig`, x.sig, client)
    if (null == d) return
    if (null != forms.calls) { /* read with the forms' call notation below */ }
    else if (!spell(x.call).includes(spell(sigName(x.sig)))) add('test', `test constructor call ${x.call} does not call ${sigName(x.sig)}`)
    else {
      const recv = receiver(spell(x.call), spell(sigName(x.sig)))
      if (!fitsOn(d.on, recv)) add('on', `test constructor ${sigName(x.sig)} is declared on ${d.on === 'module' ? 'its module' : 'the ' + d.on} in the runtime; the call ${x.call} makes it on ${recv}`)
      else verified.add(`ref.facts.test[${i}].call`)
    }
    if ((0 < d.params.length) === !!x.args) verified.add(`ref.facts.test[${i}].args`)
    else add('test', `test constructor ${sigName(x.sig)} takes ${d.params.length} parameters; args declared ${x.args}`)
  })
  const accD = sig('accessor', 'ref.facts.accessor.sig', r.accessor.sig, client)
  // The name the accessor's signature gives its argument, as the page prints it.
  if (null != r.accessor.param) {
    const ps = sigParams(r.accessor.sig)
    const last = ps[ps.length - 1]
    const pname = null == last ? '' : forms.param ? (forms.param as any)(spell(last)).name : last
    if (pname !== r.accessor.param) add('accessor', `the accessor's signature names its argument ${pname || '(none)'}; declared param: ${r.accessor.param}`)
    else if (null != accD) verified.add('ref.facts.accessor.param')
  }

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
    if (null != forms.calls) return
    if (line.includes('{ctor}') || (null != forms.tokens.ctor && new RegExp('\\b' + esc(forms.tokens.ctor) + '\\(').test(line))) {
      callOf('ctor', `ref.facts.ctor[${i}]`, line, client)
    }
  })

  for (const which of ['direct', 'prepare'] as const) {
    const rname = forms.members[which]
    const d = null == rname ? null : one(client, rname)
    if (null != d && '' !== d.returns && type(d.returns) === norm(r[which].returns, forms)) verified.add(`ref.facts.${which}.returns`)
  }

  // Calls as the provider prints them, read in the runtime's notation: the
  // constructor the naming hook gives, the test constructors, the accessor
  // and each operation exist, are made on what the runtime declares them on,
  // through its separator, with as many arguments as they take.
  if (null == forms.calls) add('calls', 'the forms do not say how a call is written (calls: { on, args, parenless, ctor })')
  else {
    const N = forms.calls
    const hook = namingOf(t)
    if (null != hook.problem) add('ctor', hook.problem)
    else {
      const layout = hook.layout
      const desc = probeDesc(hook)
      const imports = importsOf(S, desc)
      // A printed call: its declaration exists, takes that many arguments, is on what the call is made on.
      const judge = (where: string, path: string | null, c: Call, decls: Decl[], text: string, classCall = false) => {
        // The class itself called (py, swift) is a call on the type.
        if (classCall && 'free' === c.kind) c = { ...c, kind: 'type' }
        const fit = decls.find((d) => arityFits(forms, d.params, c.args.length))
        let good = true
        if (null == fit) {
          good = false
          add('arity', `${where}: ${c.name} takes ${decls.map((d) => arity(forms, d.params)).join(' or ')} in the runtime; ${JSON.stringify(text.trim())} passes ${c.args.length}`)
        }
        const d = fit || decls[0]
        if (!receiverFits(d.on, c.kind)) {
          good = false
          add('on', `${where}: ${c.name} is declared on ${d.on === 'module' ? 'its module' : 'the ' + d.on}; ${JSON.stringify(text.trim())} calls it on ${c.recv || '(nothing)'} (${c.kind})`)
        }
        else if ('' !== c.sep && null != N.on[d.on] && !(N.on[d.on] as string[]).includes(c.sep)) {
          good = false
          add('on', `${where}: ${c.name} is declared on ${d.on === 'module' ? 'its module' : 'the ' + d.on}, called through ${(N.on[d.on] as string[]).join(' or ')}; ${JSON.stringify(text.trim())} calls it through ${c.sep}`)
        }
        if (good && null != path) verified.add(path)
        return good
      }
      // The constructor: the hook's name, as the client printer prints it.
      const member = layout.ctor.split(/::|->|\.|\/|:/).pop() as string
      const classCall = [layout.client, forms.tokens.client].includes(member)
      const declName = classCall ? (forms.ctorDecl || forms.tokens.ctor) : (N.ctor?.[member] ?? member)
      const ctorDecls = null == declName ? [] : findDecls(forms, client, esc(declName))
      if (0 === ctorDecls.length) add('ctor', `the naming hook's constructor ${layout.ctor} runs ${declName}, which the ${t} runtime does not declare`)
      // With no options the printer may use a declared defaults constructor (ocaml's make0).
      const alts = (r.ctorAlts || []).map((x: any) => (/([\w{}$]+)\s*(?:\(|\s|$)/.exec(x.call.replace(/^.*?(?:\.|::|->)(?=[\w{}$]+\s*(?:\(|\s|$))/, '')) || [])[1])
        .filter((x: any) => null != x).map(spell)
      for (const opts of [[], [{ key: 'apikey', value: { k: 'str', text: 'k' } }]]) {
        let text = ''
        try { text = S.client({ k: 'client', options: opts }, desc, scope()).join('\n') }
        catch (e: any) { add('ctor', 'the client printer throws: ' + e.message); continue }
        const cs = readCalls(N, text, member)
        if (0 === cs.length && (0 < opts.length || !alts.some((a: string) => 0 < readCalls(N, text, a).length))) {
          add('ctor', `the client printer does not call the naming hook's constructor ${layout.ctor}: ${JSON.stringify(text)}`)
        }
        for (const c of cs) {
          if (0 === ctorDecls.length) continue
          judge('ctor', null, c, ctorDecls, text, classCall)
          if ('' !== c.recv && !boundBy(imports, c.recv, [layout.client, layout.module, forms.tokens.client])) {
            add('ctor', `${layout.ctor} is called on ${c.recv}, which the imports the provider prints do not bind (${JSON.stringify(imports)})`)
          }
        }
      }
      // The reference's constructor lines, spelled as the page spells them.
      ;(r.ctor as string[]).forEach((line, i) => {
        const text = spellLayout(line, layout)
        const cs = readCalls(N, text, member)
        if (!line.includes('{ctor}') && 0 === cs.length) return
        if (0 === cs.length) return add('ctor', `ref.facts.ctor[${i}]: ${JSON.stringify(text)} does not call ${member}`)
        if (0 < ctorDecls.length && cs.every((c) => judge(`ref.facts.ctor[${i}]`, null, c, ctorDecls, text, classCall))) verified.add(`ref.facts.ctor[${i}]`)
      })
      // Test constructors and the reference's other constructors.
      const calledAs = (where: string, path: string, call: string, sigText: string) => {
        const name = spell(sigName(sigText))
        const decls = findDecls(forms, client, pattern(sigName(sigText)))
        const text = spellLayout(spell(call), layout)
        const cs = readCalls(N, text, name)
        if (0 === decls.length) return
        if (0 === cs.length) return add('test', `${where}: ${JSON.stringify(call)} does not call ${name}`)
        if (cs.every((c) => judge(where, null, c, decls, text))) verified.add(path)
      }
      r.test.forEach((x: any, i: number) => calledAs('test', `ref.facts.test[${i}].call`, x.call, x.sig))
      ;(r.ctorAlts || []).forEach((x: any, i: number) => {
        const name = sigName(x.call) || (/([\w{}$]+)\s*(?:\(|\s|$)/.exec(x.call.replace(/^.*?(?:\.|::|->)(?=[\w{}$]+\s*(?:\(|\s|$))/, '')) || [])[1]
        if (null != name) calledAs('ctorAlts', `ref.facts.ctorAlts[${i}].call`, x.call, name + (/\(/.test(x.call) ? '()' : ''))
      })
      // Each operation as the call printer prints it: the accessor, then the method.
      const accDecls = findDecls(forms, client, pattern(forms.tokens.accessor || ''))
      const ent = desc.entities[0]
      for (const op of OPS) {
        const m = (f.method as any)[op]
        const d = one(read(opSource(forms, op)), m) || one(ops, m)
        if (null == d) continue
        // No argument where a page calls it so; one member; three, so that a
        // map spread into separate arguments shows in their count.
        const one1 = [{ key: 'id', value: { k: 'str', text: 'x' } }]
        const three = [...one1, { key: 'name', value: { k: 'str', text: 'n' } }, { key: 'size', value: { k: 'lit', type: 'INTEGER', text: '1' } }]
        const variants = ['list', 'load', 'remove'].includes(op) ? [null, one1, three] : [one1, three]
        for (const arg of variants) {
          let text = ''
          try {
            text = S.call({ k: 'call', entity: ent, op, arg, bind: { role: 'one', entity: ent, name: ent.sym.var }, wide: false },
              desc, scope(), { inAttempt: false, last: false }).join('\n')
          }
          catch (e: any) { add('arity', `the call printer throws for ${op}: ${e.message}`); continue }
          const cs = readCalls(N, text, m, [ent.sym.var])
          if (0 === cs.length) add('arity', `the call printer prints ${op} as ${JSON.stringify(text)}, which calls no ${m}`)
          for (const c of cs) judge(`op ${op}`, null, c, [d], text)
          if (0 < accDecls.length) for (const c of readCalls(N, text, ent.sym.accessor, [ent.sym.var])) judge(`op ${op} accessor`, null, c, accDecls, text)
        }
      }
    }
  }

  // The call a provider prints for an operation carries what calling a
  // declaration that fails this way needs.
  if (null != forms.failure && '' !== forms.failure.call && null != load && load.fails.includes(forms.failure.shows)) {
    const printed = printCall(S)
    if (null == printed || !printed.includes(forms.failure.call)) {
      add('fails', `the runtime's load shows its failure as ${forms.failure.shows}; the printed call ${JSON.stringify(printed)} has no ${forms.failure.call}`)
    }
  }

  // When a stream's operation runs is what the code's positions give; a kind
  // whose sentence says when the items are read must be what the code does.
  if (null != forms.stream) {
    const st = streamItems(t, forms.stream)
    for (const side of ['client', 'entity'] as const) {
      r[side].forEach((m: any, i: number) => {
        if ('stream' !== FAMILY[m.kind]) return
        if (null != st.problem) return add('streamItems', st.problem)
        const claim = streamClaims(m.kind)
        if (null != claim && claim !== st.items && null == exc.streamItems) {
          add('streamItems', `stream is ${m.kind}, whose page says the items are read ${claim}; the code reads them ${st.items}`)
        }
        if (null == m.runs) return
        const want = RUNS[st.runs]
        if (want !== m.runs) add('runs', `the code runs the stream's operation ${st.runs} (${want}); declared runs: ${m.runs}`)
        else verified.add(`ref.facts.${side}[${i}].runs`)
      })
    }
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
    if (null != d && !declaredFamilies.has(fam as Family) && null == exc['members:' + fam]) add('members', `the runtime defines ${fam} (${rname}); the reference does not declare it`)
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

// The record expression whole, beyond its trailing accessor: an unwrap in it
// is facts.unwrap itself, every other member or type it names is declared by
// the runtime (or cited in recordParts), and a record of more than one part
// is printed as stated.
function recordWhole(t: string, S: any, forms: Forms, accessor: string, printed: string | null,
  spell: (s: string) => string, add: (c: string, what: string) => void): boolean {
  const f = S.facts
  let rec = spell(String(f.record))
  let good = true
  let parts = 0
  if (null != f.unwrap) {
    const at = new RegExp('(?<!\\w)' + esc(String(f.unwrap)) + '(?!\\w)').exec(rec)
    if (null == at) {
      good = false
      add('record', `facts.record ${f.record} does not unwrap with facts.unwrap, \`${f.unwrap}\`, as cited`)
    }
    else rec = rec.slice(0, at.index) + ' ' + rec.slice(at.index + String(f.unwrap).length)
    parts++
  }
  const body = rec.replace(/\$?\{var\}/g, ' ')
  const names = new Set<string>()
  for (const m of body.matchAll(/^\s*([A-Za-z_]\w*)\s*(?=->|\.)|(?:->|\.|\(:)\s*([A-Za-z_][\w-]*)|\bas[?!]?\s+([A-Za-z_]\w*)|\b([A-Za-z_][\w-]*)\s*\(/g)) {
    const n = m[1] || m[2] || m[3] || m[4]
    if (n !== accessor) names.add(n)
  }
  for (const n of names) {
    parts++
    const c = forms.recordParts?.[n]
    if (null != c) {
      const bad = checkCitation(t, 'recordParts.' + n, n, c, spell)
      if (null != bad) good = false, add('record', bad)
    }
    else if (!declaredInRuntime(t, n)) {
      good = false
      add('record', `facts.record ${f.record} names ${n}, which the ${t} runtime does not declare (cite it in recordParts where a declaration reads otherwise)`)
    }
  }
  if (0 < parts) {
    const whole = String(f.record).replace(/\$\{var\}/g, '$planet').replace(/\{var\}/g, 'planet')
    if (null == printed || !printed.includes(spell(whole))) {
      good = false
      add('record', `the provider prints a record as ${JSON.stringify(printed)}, which is not facts.record whole (${whole})`)
    }
  }
  return good
}

// Whether a name is declared anywhere in a language's runtime: a function,
// method, binding, type or field declaration, or a C struct field.
function declaredInRuntime(t: string, name: string): boolean {
  const n = esc(name)
  const re = new RegExp(
    '(^|\\n)[ \\t]*(?:(?:pub|public|open|static|export|private|internal|final|override|inline|extern|const|async|mutable|@discardableResult)\\s+)*' +
    '(?:func|fn|def|defn|defp|function|sub|let|val|var|const|class|struct|interface|protocol|enum|type|module|defmodule|mutable)\\s+(?:[\\w.]+[.:])?' + n + '\\b' +
    '|[\\w*]\\s+\\*?' + n + '\\s*;|^\\s*:' + n + '\\s', 'm')
  return runtimeFiles(t).some((f) => re.test(Fs.readFileSync(Path.join(SCAFFOLD, f), 'utf8')))
}

// A type with the signature tokens spelled as the templates spell them.
function norm(s: string, forms: Forms): string {
  let out = s
  for (const [k, v] of Object.entries(forms.tokens)) out = out.split('{' + k + '}').join(v)
  return out.replace(/\s+/g, '')
}

// What a printed call is made on: the instance its code holds (the name a
// line binds, client or sdk), a qualifier (a type, a module), `new`, or nothing.
function receiver(call: string, name: string): On | 'qualified' | 'free' {
  const at = call.lastIndexOf(name)
  if (at < 0) return 'free'
  const pre = call.slice(0, at)
  if (/\bnew\s+$/.test(pre)) return 'type'
  const m = /(\$?[\w{}\u0000]+)\s*(?:\.|::|->|\/)$/.exec(pre)
  if (null == m) return 'free'
  const bound = new Set([...call.matchAll(/(?:^|\n|\(def\s+)\s*(?:[\w{}<>*:]+\s+\**)?\$?(\w+)\s*(?::=|=(?!=)|\))/g)].map((x) => x[1]))
  for (const v of ['client', 'self', 'this']) bound.add(v)
  const r = m[1].replace(/^\$/, '')
  return bound.has(r) ? 'instance' : 'qualified'
}

function fitsOn(on: On, recv: string): boolean {
  if ('instance' === on) return 'instance' === recv
  if ('type' === on) return 'qualified' === recv || 'type' === recv
  return 'free' === recv || 'qualified' === recv
}

// The positions of a stream's quotes give when the operation runs and when the
// streaming feature's items are read.
function streamItems(lang: string, s: StreamItems): { runs: string, items: string, problem?: string } {
  const text = runtimeText(lang, s.file)
  if (null == text) return { runs: '', items: '', problem: `${s.file} is not a ${lang} runtime file` }
  const pos: Record<string, number> = {}
  for (const k of ['construct', 'run', 'draw'] as const) {
    const n = text.split(s[k]).length - 1
    if (1 !== n) return { runs: '', items: '', problem: `${s.file} holds the ${k} quote ${n} times (${JSON.stringify(s[k])})` }
    pos[k] = text.indexOf(s[k])
  }
  const after = 'at call' === s.starts ? 'from the call, beside the caller' : 'as the caller iterates'
  return {
    runs: pos.run < pos.construct ? 'before it returns' : after,
    items: pos.draw <= pos.construct ? 'before it returns' : after,
  }
}

// When the page's sentence for a stream kind says the items are read: only
// one list says it; the other kinds name what is returned (ReadmeRef.ts).
function streamClaims(kind: string): string | null {
  return 'streamList' === kind ? 'before it returns' : null
}

// The page's `runs`, from what the positions of the stream's quotes give.
const RUNS: Record<string, string> = {
  'as the caller iterates': 'iterate', 'before it returns': 'call', 'from the call, beside the caller': 'background',
}

const PROBE_ENT = { name: 'planet', Name: 'Planet', sym: { accessor: 'Planet', var: 'planet', plural: 'planets' } }

// An operation's call through the provider's own printer, outside any attempt.
function printCall(S: any): string | null {
  const sc = { declared: new Set(), local: new Set(), stmts: [], section: [], standalone: false }
  const desc: any = { layout: { vars: {}, module: 'm', client: 'C', ctor: 'C' }, entities: [{ ...PROBE_ENT, fields: [] }], quick: null, options: [] }
  try {
    return S.call({ k: 'call', entity: PROBE_ENT, op: 'load', bind: { role: 'one', entity: PROBE_ENT, name: 'planet' }, arg: null },
      desc, sc, { inAttempt: false, last: false }).join('\n')
  }
  catch (e: any) {
    return null
  }
}

// A whole record printed through the provider's print printer.
function printStmt(S: any): string | null {
  const of = { role: 'one', entity: PROBE_ENT, name: 'planet' }
  const desc: any = { layout: { vars: {} }, entities: [{ ...PROBE_ENT, fields: [] }], quick: null, options: [] }
  try {
    return S.print({ k: 'print', what: { k: 'record', of } }, scope(), desc).join('\n')
  }
  catch (e: any) {
    return null
  }
}

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


// The naming hook, called on a probe model with names left as the templates
// spell them, as the guard reads the runtime.
const PROBE_MODEL = { name: 'demo', const: { Name: 'Demo' }, main: { kit: { info: {}, target: {}, entity: {} } } }

function namingOf(t: string): { layout: any, symbols: (e: any) => any, problem?: string } {
  const p = Path.join(STAGE, t, 'Naming_' + t + '.js')
  if (!Fs.existsSync(p)) return { layout: null, symbols: () => ({}), problem: `no naming hook Naming_${t}` }
  try {
    const n = require(p).Naming(PROBE_MODEL, { name: t }, (x: string) => x)
    return { layout: n.layout, symbols: n.symbols }
  }
  catch (e: any) {
    return { layout: null, symbols: () => ({}), problem: `the naming hook throws on a probe model: ${e.message}` }
  }
}

function probeDesc(hook: { layout: any, symbols: (e: any) => any }): any {
  let sym: any = {}
  try { sym = hook.symbols({ name: 'planet', Name: 'Planet', op: {}, field: {} }) || {} }
  catch (e: any) { sym = {} }
  const ent = { ...PROBE_ENT, className: 'PlanetEntity', sym: { ...PROBE_ENT.sym, ...sym, plural: 'planets' }, fields: [], ops: OPS }
  return { layout: { ...hook.layout, vars: { ...(hook.layout.vars || {}) } }, entities: [ent], quick: null, options: [], template: {}, name: 'demo', Name: 'Demo' }
}

const scope = () => ({ declared: new Set(), local: new Set(), stmts: [], section: [], standalone: false })

// The imports a provider prints: its imports printer, else what its program
// printer puts ahead of the steps.
function importsOf(S: any, desc: any): string {
  const used = { env: false, field: false, print: false, entities: [desc.entities[0].name] }
  try {
    if (null != S.imports) return S.imports(desc, used).join('\n')
    if (null != S.program) return S.program([], desc, { ...scope(), section: [] }).join('\n')
  }
  catch (e: any) {
    return ''
  }
  return ''
}

// Whether a call's qualifier is a name the imports bind, or the client type
// or module itself.
function boundBy(imports: string, recv: string, own: string[]): boolean {
  const head = (/^\(?\s*\$?([A-Za-z_][\w$]*)/.exec(recv) || [])[1] || recv
  if (own.filter((x) => null != x).some((x) => x === head || x === recv || x.split(/\.|::/)[0] === head)) return true
  const h = esc(head)
  return new RegExp(`\\b(?:local|const|let|var|my)\\s+${h}\\b|\\bas:?\\s+${h}\\b|import\\s*\\{[^}]*\\b${h}\\b|\\bimport\\s+${h}\\b|\\buse\\s+[\\w:]*\\b${h}\\b|:as\\s+${h}\\b|from\\s+\\S+\\s+import\\s+[^\\n]*\\b${h}\\b|^\\s*${h}\\s+"`, 'm').test(imports)
}

// A line of the page with its layout names, as the page spells it.
function spellLayout(line: string, layout: any): string {
  return line.replace(/\{ctor\}/g, layout.ctor).replace(/\{module\}/g, layout.module).replace(/\{client\}/g, layout.client)
}

function arity(forms: Forms, params: string[]): string {
  const req = params.filter((p) => !forms.optional(p)).length
  return req === params.length ? `${req} argument(s)` : `${req} to ${params.length} argument(s)`
}


function full(t: string, S: any, forms: Forms) {
  const res = check(t, S, forms)
  const acc = account(t, S, forms, res.verified)
  return { ...res, account: acc, all: [...res.findings, ...acc.findings.map((what) => ({ check: 'account', what }))] }
}


type Control = { name: string, check: string, mutate: (S: any, forms: Forms) => boolean }

// The first citation of a fact the provider declares, quoting a file.
const firstCited = (forms: Forms, S: any) => Object.keys(forms.cite || {})
  .find((k) => !('absent' in (forms.cite as any)[k]) && undefined !== (/^notes\./.test(k) ? (S.notes || {})[k.slice(6)] : get(S, k)))

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
    name: 'the record expression names a member the runtime does not declare', check: 'record', mutate: (S) => {
      const rec = String(S.facts.record)
      S.facts.record = /\{var\}/.test(rec) ? rec.replace(/(\$?\{var\})/, '$1.zzNoSuch()') : 'zzNoSuch().' + rec
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
    name: 'a type word changed', check: 'types', mutate: (S) => {
      if (null == S.ref) return false
      const type = S.ref.type
      S.ref.type = (t: any) => '`$INTEGER`' === t ? type(t) + 'Zz' : type(t)
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
    name: 'a citation whose quote no longer exists', check: 'account', mutate: (S, forms) => {
      const p = firstCited(forms, S)
      if (null == p) return false
      const c = (forms.cite as any)[p]
      ;(forms.cite as any)[p] = { ...c, quote: ([] as string[]).concat(c.quote).map((q) => q + ' zz-no-such-text') }
      return true
    },
  },
  {
    name: 'a cited code token changed', check: 'account', mutate: (S, forms) => {
      const spell = (s: string) => s.replace(/\{(\w+)\}/g, (_m, k: string) => forms.tokens[k] ?? '{' + k + '}')
      const p = Object.keys(forms.cite || {}).find((k) => /^facts\.|^ref\.facts\./.test(k) && undefined !== get(S, k) &&
        !('absent' in (forms.cite as any)[k]) && 0 < codeTokens(k, get(S, k), spell).filter((x) => null == (forms.cite as any)[k].unquoted?.[x]).length)
      if (null == p) return false
      const tok = codeTokens(p, get(S, p), spell).filter((x) => null == (forms.cite as any)[p].unquoted?.[x])[0]
      set(S, p, String(get(S, p)).replace(tok, tok + 'Zz'))
      return true
    },
  },
  {
    name: 'a cited prose value changed', check: 'account', mutate: (S, forms) => {
      const p = Object.keys(forms.cite || {}).find((k) => /^facts\.|^ref\.facts\./.test(k) && undefined !== get(S, k) && 'value' in (forms.cite as any)[k])
      if (null == p) return false
      const v = get(S, p)
      set(S, p, 'boolean' === typeof v ? !v : String(v) + ' or more')
      return true
    },
  },
  {
    name: 'a cited fact with its citation removed', check: 'account', mutate: (S, forms) => {
      const p = firstCited(forms, S)
      if (null == p) return false
      delete (forms.cite as any)[p]
      return true
    },
  },
  {
    name: 'a test constructor called on an instance', check: 'on', mutate: (S, forms) => {
      if (null == S.ref || 0 === S.ref.facts.test.length) return false
      const x = S.ref.facts.test[S.ref.facts.test.length - 1]
      const n = (forms.sigName || defaultSigName)(x.sig)
      const re = new RegExp('(?:[\\w{}$]+\\s*(?:\\.|::|->|/))?' + esc(n), 'g')
      const all = [...x.call.matchAll(re)]
      if (0 === all.length) return false
      // On the client, through the separator the language calls an instance member with.
      const sep = null == forms.calls ? '.' : (forms.calls.on.instance || [])[0]
      if (null == sep) return false
      const last = all[all.length - 1]
      x.call = x.call.slice(0, last.index) + 'client' + sep + n + x.call.slice((last.index as number) + last[0].length)
      return true
    },
  },
  {
    name: 'a member the runtime declares on the type listed among the instance members', check: 'on', mutate: (S, forms) => {
      if (null == S.ref || 0 === S.ref.facts.test.length) return false
      const x = S.ref.facts.test[0]
      const n = (forms.sigName || defaultSigName)(x.sig)
      const d = findDecls(forms, read(forms.files.client), esc(n.replace(/\{(\w+)\}/g, (_m, k) => forms.tokens[k] ?? k)))[0]
      if (null == d || 'type' !== d.on) return false
      S.ref.facts.client.push({ kind: 'make', sig: x.sig })
      return true
    },
  },
  {
    name: 'a failure marker dropped from the load signature', check: 'fails', mutate: (S, forms) => {
      if (null == S.ref || null == forms.failure) return false
      const sig = S.ref.facts.op.load
      if (!sig.includes(forms.failure.shows)) return false
      S.ref.facts.op.load = sig.split(forms.failure.shows).join('Zz')
      return true
    },
  },
  {
    name: 'the printed call drops what a failing call needs', check: 'fails', mutate: (S, forms) => {
      if (null == forms.failure || '' === forms.failure.call) return false
      const call = S.call
      S.call = (...a: any[]) => call(...a).map((l: string) => l.split(forms.failure!.call).join(''))
      return true
    },
  },
  {
    name: 'a stream shown as one list when the code reads its items as the caller iterates', check: 'streamItems', mutate: (S, forms) => {
      if (null == S.ref || null == forms.stream) return false
      const m = S.ref.facts.entity.find((x: any) => 'stream' === FAMILY[x.kind])
      if (null == m || null != forms.exceptions?.streamItems) return false
      const lang = (/^(?:src\/cmp|tm)\/([\w-]+)\//.exec(forms.stream.file) || [])[1] || ''
      if ('before it returns' === streamItems(lang, forms.stream).items) return false
      m.kind = 'streamList'
      return true
    },
  },
  {
    name: 'a stream whose operation is declared to run at another time', check: 'runs', mutate: (S) => {
      if (null == S.ref) return false
      const m = S.ref.facts.entity.find((x: any) => 'stream' === FAMILY[x.kind] && null != x.runs)
      if (null == m) return false
      m.runs = 'call' === m.runs ? 'iterate' : 'call'
      return true
    },
  },
  {
    name: "the accessor's parameter named otherwise", check: 'accessor', mutate: (S) => {
      if (null == S.ref || null == S.ref.facts.accessor.param) return false
      S.ref.facts.accessor.param = 'zzparam'
      return true
    },
  },
  {
    name: 'a called member declared as a field', check: 'field', mutate: (S, forms) => {
      if (null == S.ref || forms.parenless) return false
      const m = [...S.ref.facts.client, ...S.ref.facts.entity].find((x: any) => /^[^(]*\w\(\)/.test(x.sig))
      if (null == m) return false
      m.sig = m.sig.replace('()', '')
      return true
    },
  },
  {
    name: 'an absence whose search starts to match', check: 'account', mutate: (_S, forms) => {
      const p = Object.keys(forms.cite || {}).find((k) => 'absent' in (forms.cite as any)[k])
      if (null == p) return false
      const c = (forms.cite as any)[p]
      ;(forms.cite as any)[p] = { ...c, absent: { ...c.absent, pattern: /\w/ } }
      return true
    },
  },
  {
    name: 'a region an absence leaves out with no reason', check: 'account', mutate: (_S, forms) => {
      const p = Object.keys(forms.cite || {}).find((k) => 0 < ((forms.cite as any)[k].absent?.except || []).length)
      if (null == p) return false
      const c = (forms.cite as any)[p]
      ;(forms.cite as any)[p] = { ...c, absent: { ...c.absent, except: c.absent.except.map((x: any, i: number) => 0 === i ? { ...x, why: '' } : x) } }
      return true
    },
  },
  {
    name: 'a region left out for a fact the forms no longer cite', check: 'account', mutate: (_S, forms) => {
      const c = Object.values(forms.cite || {}).find((x: any) => (x.absent?.except || []).some((e: any) => null != e.fact)) as any
      if (null == c) return false
      delete (forms.cite as any)[c.absent.except.find((e: any) => null != e.fact).fact]
      return true
    },
  },
  {
    name: 'an unquoted token that stands beside the quote', check: 'account', mutate: (S, forms) => {
      const spell = (s: string) => s.replace(/\{(\w+)\}/g, (_m, k: string) => forms.tokens[k] ?? '{' + k + '}')
      for (const [k, c] of Object.entries(forms.cite || {}) as [string, any][]) {
        if ('absent' in c || undefined === get(S, k) || !/^(facts|ref\.facts)\./.test(k)) continue
        const toks = codeTokens(k, get(S, k), spell).filter((x) => null == c.unquoted?.[x])
        if (0 === toks.length) continue
        ;(forms.cite as any)[k] = { ...c, unquoted: { ...(c.unquoted || {}), [toks[0]]: 'excused although the quote holds it' } }
        return true
      }
      return false
    },
  },
  {
    name: 'a note naming code its citation does not hold', check: 'account', mutate: (S, forms) => {
      const k = Object.keys(forms.cite || {}).find((x) => /^notes\./.test(x) && null != (S.notes || {})[x.slice(6)])
      if (null == k) return false
      S.notes = { ...S.notes, [k.slice(6)]: S.notes[k.slice(6)] + ' See `zzNoSuchCode`.' }
      const c = (forms.cite as any)[k]
      if ('value' in c) (forms.cite as any)[k] = { ...c, value: S.notes[k.slice(6)] }
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
  CONTROLS, FAMILY, FORMS, FORMS_SRC, FRAMEWORK, PROVIDERS, RUNS, check, clone, fitsOn, formsOf, full, printCall, receiver,
  streamClaims, streamItems, syntaxOf,
}
