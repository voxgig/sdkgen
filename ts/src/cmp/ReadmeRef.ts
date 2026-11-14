
import { File, Content } from 'jostraca'
import { cmp } from '../helpers/component'

import { loadOptional } from '../utility'
import { optionalComponent } from '../helpers/optional'
import { describeTarget } from './ReadmeQuick'
import { ReadmeRefFeatures } from './ReadmeRefFeatures'
import { mdCell, mdInline } from '../helpers/markdown'
import { bodyNoteText } from '../helpers/media'
import type { DescEntity, SdkDescription } from '../helpers/sdkdesc'
import {
  actionBlock, entOf, featureBlock, newScope, note, printBlock, refOpBlock,
} from '../helpers/example'
import type { CtorKind, Ent, Expr, Member, MemberKind, OpName, RefSyntax, Stmt, Syntax } from '../helpers/example'
import { failsSentence, opText } from '../helpers/runtimeprose'
import { templateName } from '../helpers/sdkdesc'


// REFERENCE.md. A target with a syntax provider that declares its reference
// facts gets the shared page; a target's own ReadmeRef_<lang> wins over it, as
// for the tutorial, and a target with neither writes nothing.
const ReadmeRef = cmp(function ReadmeRef(props: any) {
  const { target, ctx$ } = props
  const t = target.name

  const own = loadOptional(ctx$, `./cmp/${t}/ReadmeRef_${t}`)
  const provider = null == own ? optionalComponent(ctx$, target, 'Syntax') : undefined
  if (provider && provider.Syntax.ref) {
    const desc = describeTarget(ctx$, target)
    File({ name: 'REFERENCE.md' }, () => {
      Content(refText(provider.Syntax, desc))
      if (0 < desc.ref.features.length) {
        ReadmeRefFeatures({ target })
      }
    })
    return
  }

  const ReadmeRef_sdk = own ?? optionalComponent(ctx$, target, 'ReadmeRef')
  if (ReadmeRef_sdk) {
    // The per-language component owns the REFERENCE.md File, and calls the
    // shared feature reference from inside it.
    ReadmeRef_sdk['ReadmeRef']({ target })
  }
})


const code = (s: string): string => '`' + s + '`'

// A declared signature with the description's names filled in. A name the
// templates spell (ProjectNameError) is substituted as generation substitutes
// the templates, from the same map.
function fill(sig: string, desc: SdkDescription, ent?: DescEntity): string {
  const names: Record<string, string> = {
    sdk: desc.Name, client: desc.layout.client, ctor: desc.layout.ctor, module: desc.layout.module,
    accessor: ent ? ent.sym.accessor : '', var: ent ? ent.sym.var : '',
    Class: ent ? ent.className : '', Name: ent ? ent.Name : '',
  }
  return templateName(desc.template || {}, sig)
    .replace(/\{(sdk|client|ctor|module|accessor|var|Class|Name)\}/g, (_m, k: string) => names[k])
}

function fenced(p: Syntax, lines: string[]): string {
  return '```' + p.fence + '\n' + lines.join('\n') + '\n```\n'
}

// What an entity is called on the page: its class, its Name where the runtime
// has no class per entity, or the module its operations live in.
function typeOf(r: RefSyntax, ent: DescEntity): string {
  switch (r.facts.entityBy) {
    case 'class': return ent.className
    case 'Name': return ent.Name
    case 'module': return ent.sym.module ?? ent.Name
  }
}

const lit = (r: RefSyntax, v: boolean): string => code((r.facts.lits || { true: 'true', false: 'false' })[v ? 'true' : 'false'])


// How prose names a fixed member: its name from its signature, called.
function memberName(r: RefSyntax, k: MemberKind): string {
  const m = [...r.facts.client, ...r.facts.entity].find((x) => x.kind === k)
  const named = null == m ? null : /([\w.]+(?:->\w+)?)\s*\(/.exec(m.sig)
  return null == named ? k : named[1] + '()'
}

// The sentence each fixed member kind is described by.
function memberText(kind: MemberKind, p: Syntax, desc: SdkDescription, ent?: DescEntity): string {
  const r = p.ref as RefSyntax
  const sig = (k: MemberKind) => memberName(r, k)
  switch (kind) {
    case 'options': return 'Return a deep copy of the current SDK options.'
    case 'utility': return 'Return a copy of the SDK utility object.'
    case 'utilityBase': return 'Return the SDK utility object.'
    case 'tester': {
      const test = r.facts.test.find((x) => x.args) || r.facts.test[0]
      return `Alias for ${code(fill(test.call, desc).replace(/^.*?=\s*/, ''))}.`
    }
    case 'data': return 'Get or set the entity data. When called with data, sets the entity\'s\n' +
      'internal data and returns the current data. When called without\narguments, returns a copy of the current data.'
    case 'match': return `Get or set the entity match criteria. Works the same as ${code(sig('data'))}.`
    case 'dataArg': return `Get the entity data. Pass ${r.facts.setArg || 'a map'} to set it.`
    case 'matchArg': return `Get the entity match criteria. Pass ${r.facts.setArg || 'a map'} to set it.`
    case 'dataGet': return 'Get the entity data.'
    case 'dataSet': return 'Set the entity data.'
    case 'matchGet': return 'Get the entity match criteria.'
    case 'matchSet': return 'Set the entity match criteria.'
    case 'make': return `Create a new ${code(ent ? typeOf(r, ent) : '')} instance with the same client and\noptions.`
    case 'name': return 'Return the entity name.'
    case 'client': return `Return the parent ${code(desc.layout.client)} instance.`
    case 'entopts': return 'Return a copy of the entity options.'
    case 'stream': return 'Run an operation through the pipeline and stream its result items.'
    case 'streamIterator': return 'Run an operation through the pipeline and yield its result items as\nthey arrive, as an async iterator.'
    case 'streamGenerator': return 'Run an operation through the pipeline and yield its result items as\nthey arrive, as a generator.'
    case 'streamLazy': return 'Run an operation through the pipeline and return a lazy stream of its\nresult items.'
    case 'streamList': return 'Run an operation through the pipeline and return its result items as\none list. ' + failsSentence(p.facts)
    case 'direct': return 'Make a direct HTTP request to any API endpoint.'
    case 'prepare': return `Prepare a fetch definition without sending the request. Accepts the\nsame parameters as ${code(sig('direct'))}.`
  }
}


// A table of named values: options or fetchargs.
function keyTable(p: Syntax, container: 'options' | 'fetchargs', rows: { path: string[], type: 'STRING' | 'OBJECT' | 'ANY', text: string }[]): string {
  const r = p.ref as RefSyntax
  const bare = 'bare' === r.facts.keys
  let out = bare
    ? `**Parameters (${code(container)} map keys):**\n\n| Key | Value type | Description |\n| --- | --- | --- |\n`
    : '**Parameters:**\n\n| Name | Type | Description |\n| --- | --- | --- |\n'
  if (!bare && 'options' === container) {
    out += `| ${code(r.key('options', []))} | ${code(r.facts.container)} | SDK configuration options. |\n`
  }
  for (const row of rows) {
    out += `| ${code(r.key(container, row.path))} | ${code(r.facts.valueType[row.type])} | ${row.text} |\n`
  }
  return out
}


function directRows(p: Syntax, desc: SdkDescription): { path: string[], type: 'STRING' | 'OBJECT' | 'ANY', text: string }[] {
  const r = p.ref as RefSyntax
  const explain: Expr = { k: 'map', entries: [{ key: 'explain', value: { k: 'lit', type: 'BOOLEAN', text: '' } }] }
  const rows: { path: string[], type: 'STRING' | 'OBJECT' | 'ANY', text: string }[] = [
    { path: ['path'], type: 'STRING', text: 'URL path with optional `{param}` placeholders.' },
    { path: ['method'], type: 'STRING', text: 'HTTP method (default: `GET`).' },
    { path: ['params'], type: 'OBJECT', text: 'Path parameter values for `{param}` substitution.' },
    { path: ['query'], type: 'OBJECT', text: 'Query string parameters.' },
    { path: ['headers'], type: 'OBJECT', text: 'Request headers (merged with defaults).' },
    { path: ['body'], type: 'ANY', text: `Request body (${r.facts.maps} are JSON-serialized).` },
    { path: ['ctrl'], type: 'OBJECT', text: `Control options (e.g. ${code(p.expr(explain, newScope(true), desc))}).` },
  ]
  return rows
}


function clientMember(m: Member, p: Syntax, desc: SdkDescription): string {
  const r = p.ref as RefSyntax
  const f = p.facts
  let out = `#### ${code(fill(m.sig, desc))}\n\n${memberText(m.kind, p, desc)}\n\n`
  if ('direct' === m.kind) {
    out += keyTable(p, 'fetchargs', directRows(p, desc))
    if (r.facts.direct.signal) {
      out += `| ${code(r.key('fetchargs', ['ctrl', 'signal']))} | ${code(r.facts.direct.signal)} | ` +
        `Aborts the request in flight: \`ok\` is then ${lit(r, false)} and \`err.code\` is \`request_aborted\`. |\n`
    }
    out += '\n' + wrap(`**Returns:** ${code(fill(r.facts.direct.returns, desc))}, a result map holding \`ok\`, ` +
      '`status`, `headers` and `data`, even for a non-2xx response; on a failure `ok` is ' +
      `${lit(r, false)} and \`err\` holds the error. A failed request is reported in the result, ` +
      `not as an error, so branch on ${code(r.read('result', 'ok'))}.`) + '\n\n'
  }
  else if ('prepare' === m.kind) {
    const fails = 'value' === r.facts.prepare.fails
      ? `On failure it ${f.async ? 'resolves to' : 'returns'} the error instead.`
      : ('style' === r.facts.prepare.fails ? failsSentence(f) : '')
    out += wrap(`**Returns:** ${code(fill(r.facts.prepare.returns, desc))}, the fetch definition: ` +
      `the request ${code(memberName(r, 'direct'))} would send.${'' === fails ? '' : ' ' + fails}`) + '\n\n'
  }
  else if (null != m.returns) {
    out += `**Returns:** ${code(fill(m.returns, desc))}.\n\n`
  }
  return out + note(p, `member:${m.kind}`)
}


// The sentence each alternate constructor is described by.
function altText(alts: { call: string, kind: CtorKind }[], desc: SdkDescription): string {
  const one = (x: { call: string, kind: CtorKind }) => `${code(fill(x.call, desc))} ` +
    ('defaults' === x.kind ? 'uses the defaults' : 'takes the options spelled out')
  if (0 === alts.length) return ''
  const parts = alts.map(one)
  return ' ' + (1 === parts.length ? parts[0] : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]) + '.'
}

function constructorText(p: Syntax, desc: SdkDescription): string {
  const r = p.ref as RefSyntax
  const container = 'bare' === r.facts.keys
    ? ` ${code('options')} is a ${code(r.facts.container)} map\n(${code(r.facts.none)} for none).` : ''
  return `### Constructor\n\n${fenced(p, r.facts.ctor.map((l) => fill(l, desc)))}\n` +
    `Create a new SDK client instance.${container}${altText(r.facts.ctorAlts || [], desc)}\n\n` +
    note(p, 'ctor') + keyTable(p, 'options', desc.ref.optionRows) + '\n'
}


// The test constructor exists in every runtime, with or without the test
// feature; without it, the client it returns has no mock transport.
function testText(p: Syntax, desc: SdkDescription): string {
  const r = p.ref as RefSyntax
  if (0 === r.facts.test.length) return ''
  let out = '\n### Test client\n\n'
  const mock = desc.ref.test ? 'with mock features active' :
    'in test mode. This SDK is generated without the `test` feature, so it has no mock transport'
  for (const t of r.facts.test) {
    out += `#### ${code(fill(t.sig, desc))}\n\n` + wrap(
      (t.args
        ? `Create a test client ${mock}. \`testopts\` are the test feature's options ` +
          `and \`sdkopts\` further client options, merged over the test defaults; both may be ${code(r.facts.none)}.`
        : `Create a test client ${mock}, and no options.`) +
      `${altText(t.alts || [], desc)} It returns a client in test mode.`) + `\n\n${fenced(p, [fill(t.call, desc)])}\n`
  }
  return out + note(p, 'test')
}


function instanceText(p: Syntax, desc: SdkDescription): string {
  const r = p.ref as RefSyntax
  let out = `\n### Instance ${r.facts.noun}\n\n` + note(p, 'instance')
  for (const ent of desc.entities) {
    out += `#### ${code(fill(r.facts.accessor.sig, desc, ent))}\n\n` +
      `Create a new ${code(typeOf(r, ent))} instance. Pass ${code(r.facts.none)} for no initial\n` +
      ('data' === r.facts.accessor.arg ? 'data.' : 'options.') + '\n\n'
  }
  // tester() aliases the test constructor, so it is documented with it.
  for (const m of r.facts.client) if ('tester' !== m.kind || desc.ref.test) out += clientMember(m, p, desc)
  if (r.facts.cancel) {
    out += `#### Cancelling a call

Every entity operation takes an optional \`ctrl\` object after its match or
data, and an \`AbortSignal\` in \`ctrl.signal\` cancels the request in flight.
The operation then rejects with an error whose \`code\` is
\`request_aborted\` and whose \`cause\` is the signal's reason. A request
whose signal has already aborted is not sent. \`stream()\` takes the signal
as \`callopts.signal\`, and ends when it aborts.

`
  }
  return out
}


function entityText(p: Syntax, desc: SdkDescription, ent: DescEntity): string {
  const r = p.ref as RefSyntax
  const ref: Ent = entOf(desc, ent.name)
  let out = `\n---\n\n## ${typeOf(r, ent)}\n\n`
  const text = mdInline(ent.text)
  if ('' !== text) out += text + '\n\n'
  out += fenced(p, r.instance(ref, desc)) + '\n' + note(p, 'entity')

  if (0 < ent.fields.length) {
    out += '### Fields\n\n| Field | Type | Required | Description |\n| --- | --- | --- | --- |\n'
    for (const f of ent.fields) {
      out += `| ${code(f.name)} | ${code(r.type(f.type))} | ${f.required ? 'Yes' : 'No'} | ${mdCell(f.text)} |\n`
    }
    out += '\n'
    if (ent.fieldOps) {
      const cols = ent.refOps.map((o) => o.name)
      out += `### Field Usage by Operation\n\n| Field | ${cols.join(' | ')} |\n| --- | ${cols.map(() => '---').join(' | ')} |\n`
      for (const f of ent.fields) {
        out += `| ${code(f.name)} | ${cols.map((c) => f.ops.includes(c) ? 'Yes' : '-').join(' | ')} |\n`
      }
      out += '\n'
    }
  }

  if (0 < ent.actions.length) {
    out += `### Actions

This entity exposes custom API actions in addition to the standard
operations. Select one with \`$action\` in the call's argument; the
remaining keys are sent as that action's payload.

| Action | Operation | Route | Call |
| --- | --- | --- | --- |
${ent.actions.map((a) => `| ${code(a.action)} | ${code(p.facts.method[a.op as OpName])} | ${code(a.path)} | ${code(actionCall(p, desc, ent, a))} |`).join('\n')}

An action returns that action's OWN response, which is not necessarily a
${ent.Name} record — check the API definition for its shape.

`
  }

  if (0 < ent.refOps.length) {
    out += '### Operations\n\n' + note(p, 'operations')
    for (const op of ent.refOps) {
      const name = op.name as OpName
      const sig = (0 < op.needs.length && r.facts.opMatched && r.facts.opMatched[name]) || r.facts.op[name]
      const block = refOpBlock(desc, p.facts, ent, op)
      out += `#### ${code(fill(sig, desc, ent))}\n\n` +
        `${wrap(opText(p.facts, op.name, op.needs, op.idInData, boundOf(block)))}\n\n`
      if (null != block) out += printBlock(p, block, desc, newScope(true)) + '\n'
      out += bodyNoteText(op.body, r.facts.body)
    }
  }

  out += `### Common ${r.facts.entityNoun || r.facts.noun}\n\n`
  for (const m of r.facts.entity) {
    out += `#### ${code(fill(m.sig, desc, ent))}\n\n${memberText(m.kind, p, desc, ent)}\n\n` +
      note(p, `member:${m.kind}`)
  }
  return out
}

// How one custom action is called, on one line: the call statement as the
// language writes it outside error handling. Not a block: its payload is the
// action's own, which no model states, so it could be neither type-checked
// nor run.
function actionCall(p: Syntax, desc: SdkDescription, ent: DescEntity, a: { action: string, op: string }): string {
  const [stmt] = actionBlock(desc, ent, a) as Extract<Stmt, { k: 'call' }>[]
  const narrow = { ...stmt, wide: false, note: undefined }
  return p.call(narrow, desc, newScope(true), { inAttempt: false, last: true })[0].split('\n')[0]
}

// The variable an operation's example binds its result to.
function boundOf(block: Stmt[] | null): string {
  const first = (block || [])[0]
  return null != first && 'call' === first.k && null != first.bind ? first.bind.name : 'result'
}


function featuresText(p: Syntax, desc: SdkDescription): string {
  const features = desc.ref.features
  if (0 === features.length) return ''
  return `
---

## Features

| Feature | Version | Description |
| --- | --- | --- |
${features.map((f) => `| ${code(f.name)} | ${f.version} | ${mdCell(f.title)} |`).join('\n')}


Features are activated via the \`feature\` option:

${printBlock(p, featureBlock(features.map((f) => f.name)), desc, newScope(true))}
${note(p, 'features')}`
}


// Prose is wrapped at 72 columns, as the hand-written pages are.
function wrap(text: string): string {
  const out: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if ('' !== line && 72 < (line + ' ' + word).length) {
      out.push(line)
      line = word
    }
    else {
      line = '' === line ? word : line + ' ' + word
    }
  }
  if ('' !== line) out.push(line)
  return out.join('\n')
}


function refText(p: Syntax, desc: SdkDescription): string {
  let out = `# ${desc.Name} ${desc.ref.title} SDK Reference

Complete API reference for the ${desc.Name} ${desc.ref.title} SDK.


## ${null == p.ref?.facts.heading ? desc.layout.client : fill(p.ref.facts.heading, desc)}

`
  out += constructorText(p, desc)
  out += testText(p, desc)
  out += instanceText(p, desc)
  for (const ent of desc.entities) out += entityText(p, desc, ent)
  out += featuresText(p, desc)
  return out
}


export {
  ReadmeRef,
  refText,
}
