import { Content } from 'jostraca'
import { cmp } from '../helpers/component'

import { credentialPlacement, loadOptional } from '../utility'
import { optionalComponent } from '../helpers/optional'
import { sdkDescription } from '../helpers/sdkdesc'
import type { SdkDescription } from '../helpers/sdkdesc'
import {
  checksItself, clientBlock, listBlock, loadBlock, newScope, printBlock, printJoined, printProgram, writeBlock, writeOps,
} from '../helpers/example'
import { note } from '../helpers/example'
import type { Stmt, Syntax, Scope } from '../helpers/example'
import { listComment, listSentence, loadComment, loadSentence, writeSentence } from '../helpers/runtimeprose'
import type { ShowPlace } from '../helpers/example'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$ } = props
  const t = target.name

  // A target's own ReadmeQuick_<lang> wins over its provider: a pack that
  // ships one, and a project's override, keep it. A copy an upgrade left
  // behind unchanged is RETIRED by doctor and removed by the next add.
  const own = loadOptional(ctx$, `./cmp/${t}/ReadmeQuick_${t}`)
  const provider = null == own ? optionalComponent(ctx$, target, 'Syntax') : undefined
  if (provider) {
    Content(quickText(provider.Syntax, describeTarget(ctx$, target)))
    return
  }

  const placement = credentialPlacement(ctx$.model)

  Content(`
## Tutorial: your first API call

This tutorial walks through creating a client, listing entities, and
loading a specific record.${'' === placement ? '' : ' ' + placement}

`)

  const ReadmeQuick_sdk = own ?? optionalComponent(ctx$, target, 'ReadmeQuick')

  if (ReadmeQuick_sdk) {
    ReadmeQuick_sdk['ReadmeQuick']({ target })
  }
})


// The target's description, named by its own Naming hook. A target with a
// syntax provider has one: names are never guessed for it.
function describeTarget(ctx$: any, target: any): SdkDescription {
  const hook = optionalComponent(ctx$, target, 'Naming')
  if (null == hook) throw new Error(`${target.name}: a syntax provider needs a Naming hook (cmp/${target.name}/Naming_${target.name})`)
  return sdkDescription(ctx$.model, target, hook.Naming, ctx$.stdrep)
}


const article = (s: string) => /^[aeiou]/i.test(s) ? 'an' : 'a'

function series(items: string[]): string {
  if (items.length < 3) return items.join(' and ')
  return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1]
}

const GERUND: Record<string, string> = { create: 'creating', update: 'updating', patch: 'patching', remove: 'removing' }

function placement(desc: SdkDescription): string {
  const { active, in: where, name } = desc.auth
  if (!active) return ''
  if ('query' === where) return `The client sends the API key as the \`${name}\` query parameter.`
  if ('cookie' === where) return `The client sends the API key as the \`${name}\` cookie.`
  return 'authorization' === name.toLowerCase() ? '' : `The client sends the API key in the \`${name}\` header.`
}

function clientText(desc: SdkDescription): string {
  const env = desc.options.filter((o: any) => null != o.env).map((o: any) => '`' + o.env + '`')
  const sentences: string[] = []
  if (1 === env.length) {
    sentences.push(`The client reads its API key from the ${env[0]} environment variable.`)
  }
  else if (2 === env.length) {
    sentences.push(`The client reads its API key and secret from the ${env[0]} and ${env[1]} environment variables.`)
  }
  const required = desc.server.filter((v) => v.required).map((v) => '`' + v.name + '`')
  const dflt = desc.server.filter((v) => !v.required).map((v) => `\`${v.name}\` defaults to \`${v.dflt}\``)
  if (0 < required.length) {
    sentences.push(`The server URL is templated, so \`server\` must give ${series(required)}` +
      (0 < dflt.length ? `; ${series(dflt)}.` : '.'))
  }
  else if (0 < dflt.length) {
    sentences.push(`The server URL is templated; ${series(dflt)}.`)
  }
  return sentences.join(' ')
}


// Prose is wrapped at 72 columns, as the hand-written sections are. A list
// item's continuation lines are indented under its text.
function wrap(text: string, first = '', rest = ''): string {
  const out: string[] = []
  let line = first
  let empty = true
  for (const word of text.split(' ')) {
    if (!empty && 72 < (line + ' ' + word).length) {
      out.push(line)
      line = rest + word
    }
    else {
      line = empty ? line + word : line + ' ' + word
    }
    empty = false
  }
  if (!empty) out.push(line)
  return out.join('\n')
}


// `comment`: how the step is named inside a program, with its runtime fact.
type Step = { title: string, text: string, stmts: Stmt[], comment: string }

// The name a block binds: the list's item, or the loaded entity.
function boundName(stmts: Stmt[], role: 'item' | 'one'): string {
  let found = ''
  const walk = (s: Stmt): void => {
    if ('' !== found) return
    if ('each' === s.k && 'item' === role) found = s.item.name
    if ('call' === s.k && null != s.bind && s.bind.role === role) found = s.bind.name
    if ('attempt' === s.k || 'each' === s.k) s.body.forEach(walk)
  }
  stmts.forEach(walk)
  return found
}

// The steps every quick start takes, each with its sentences, from the
// description and the runtime facts alone.
function quickSteps(p: Syntax, desc: SdkDescription, where: ShowPlace = 'tutorial'): { steps: Step[], lead: string[] } {
  const q = desc.quick
  const f = p.facts
  const steps: Step[] = []
  const lead = ['creating a client']
  const ent = (name: string) => desc.entities.find((e) => e.name === name) as any

  steps.push({ title: 'Create a client', text: clientText(desc), stmts: clientBlock(desc), comment: 'Create a client' })

  const list = listBlock(desc, f, where)
  if (null != q && null != list) {
    const n = ent(q.entity).Name.toLowerCase()
    lead.push(`listing ${n} records`)
    const cls = ent(q.entity).className
    steps.push({
      title: `List ${n} records`, text: listSentence(f, boundName(list, 'item')) + noteText(p, 'tutorial:list', desc),
      stmts: list, comment: listComment(f, `List ${n} records`, cls),
    })
  }

  const load = loadBlock(desc, f, where)
  if (null != q && null != q.load && null != load) {
    const e = ent(q.load.entity)
    const n = e.Name.toLowerCase()
    lead.push(`loading ${article(n)} ${n}`)
    const nested = null == q.load.nested ? '' :
      `${e.Name} is nested under ${q.load.nested.parent}, so provide the \`${q.load.nested.param}\`. `
    steps.push({
      title: `Load ${article(n)} ${n}`, text: nested + loadSentence(f, boundName(load, 'one')) + noteText(p, 'tutorial:load', desc),
      stmts: load, comment: loadComment(f, `Load ${article(n)} ${n}`, e.className),
    })
  }

  const writes = writeBlock(desc, f)
  if (null != q && null != writes) {
    const ops = writeOps(desc)
    const n = ent(q.entity).Name.toLowerCase()
    lead.push(`${series(ops.map((o) => GERUND[o]))} ${article(n)} ${n}`)
    const title = series(ops)
    const Title = title.charAt(0).toUpperCase() + title.slice(1)
    steps.push({ title: Title, text: writeSentence(f, ops) + noteText(p, 'tutorial:write', desc), stmts: writes, comment: Title })
  }
  return { steps, lead }
}


function quickText(p: Syntax, desc: SdkDescription): string {
  const sc: Scope = newScope()
  const { steps, lead } = quickSteps(p, desc)
  sc.section = steps.flatMap((s) => s.stmts)

  const where = placement(desc)
  let out = `
## Tutorial: your first API call

${wrap(`This tutorial walks through ${series(lead)}.${'' === where ? '' : ' ' + where}` +
    (1 < steps.length ? ' Every operation returns entities, not raw records.' : ''))}

`
  out += note(p, 'tutorial', desc)
  // A runtime whose examples are whole programs gets the same sentences, as a
  // numbered list, and the steps as one program. A step whose statements open
  // with their own comment is named by it, not again by its title; the client
  // opens the program unnamed, as it always did.
  if (p.program) {
    out += (1 === steps.length
      ? 'The program after this step runs it.'
      : `The program after these ${steps.length} steps runs them in order.`) + '\n\n'
    steps.forEach((s, i) => {
      const lead = `${i + 1}. **${s.title}.**`
      out += ('' === s.text ? lead : wrap(s.text.trim(), lead + ' ', '   ')) + '\n'
    })
    out += '\n' + printProgram(p, steps.map((s) => ({
      title: 'comment' === s.stmts[0]?.k || 'client' === s.stmts[0]?.k ? '' : s.comment, stmts: s.stmts,
    })), desc, sc) + '\n'
    return out
  }

  steps.forEach((s, i) => {
    out += `### ${i + 1}. ${s.title}\n\n${'' === s.text ? '' : wrap(s.text.trim()) + '\n\n'}${printBlock(p, s.stmts, desc, sc)}\n`
  })
  return out
}


// A runtime note's text as a paragraph's trailing sentences.
function noteText(p: Syntax, slot: Parameters<typeof note>[1], desc: SdkDescription): string {
  const n = note(p, slot, desc).trim()
  return '' === n ? '' : ' ' + n
}

// The statements with every attempt replaced by its body: the call is written
// as the language writes one outside error handling.
function bare(stmts: Stmt[]): Stmt[] {
  return stmts.flatMap((s): Stmt[] => 'attempt' === s.k ? bare(s.body)
    : ('each' === s.k ? [{ ...s, body: bare(s.body) }] : [s]))
}

// The root README's quick start for one language: the tutorial's first steps,
// client, list and load, in one block, each step named in a comment that
// states its runtime fact, its calls outside error handling, as most of the
// old root quick starts were. Where a call does not check itself, its check
// stays: the load after the list may not run past an unchecked failure.
function topQuickText(p: Syntax, desc: SdkDescription): string {
  const sc: Scope = newScope()
  const { steps } = quickSteps(p, desc, 'top')
  const first = steps.filter((s) => /^(Create a client|List |Load )/.test(s.title))
  // The comment names the step, so the program printer adds no title of its own.
  const commented = first.map((s) => ({
    title: '',
    stmts: 'Create a client' === s.title ? s.stmts
      : [{ k: 'comment', text: s.comment } as Stmt, ...(checksItself(p.facts.result) ? bare(s.stmts) : s.stmts)],
  }))
  sc.section = commented.flatMap((s) => s.stmts)
  return p.program ? printProgram(p, commented, desc, sc) : printJoined(p, commented, desc, sc)
}


export {
  ReadmeQuick,
  describeTarget,
  quickText,
  topQuickText,
}
