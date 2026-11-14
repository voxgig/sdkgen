import { Content } from 'jostraca'
import { cmp } from '../helpers/component'

import { credentialPlacement, loadOptional } from '../utility'
import { optionalComponent } from '../helpers/optional'
import { sdkDescription } from '../helpers/sdkdesc'
import type { SdkDescription } from '../helpers/sdkdesc'
import {
  clientBlock, listBlock, loadBlock, newScope, printBlock, writeBlock, writeOps,
} from '../helpers/example'
import type { Syntax, Scope } from '../helpers/example'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$ } = props
  const t = target.name

  // A target's own ReadmeQuick_<lang> wins over its provider: a project that
  // forked it keeps its fork, and a copy an upgrade left behind keeps writing
  // what it wrote until doctor's stale finding has it removed.
  const own = loadOptional(ctx$, `./cmp/${t}/ReadmeQuick_${t}`)
  const provider = null == own ? optionalComponent(ctx$, target, 'Syntax') : undefined
  if (provider) {
    Content(quickText(provider.Syntax, sdkDescription(ctx$.model, t)))
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
  return 0 === sentences.length ? '' : wrap(sentences.join(' ')) + '\n\n'
}


// Prose is wrapped at 72 columns, as the hand-written sections are.
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


function quickText(p: Syntax, desc: SdkDescription): string {
  const q = desc.quick
  const sc: Scope = newScope()
  const w = p.words
  const steps: { title: string, text: string, block: string }[] = []

  steps.push({ title: 'Create a client', text: clientText(desc), block: printBlock(p, clientBlock(desc), desc, sc) })
  const lead = ['creating a client']

  const ent = (name: string) => desc.entities.find((e) => e.name === name) as any

  const list = listBlock(desc)
  if (null != q && null != list) {
    const n = ent(q.entity).Name.toLowerCase()
    lead.push(`listing ${n} records`)
    steps.push({
      title: `List ${n} records`,
      text: wrap(`${w.op('list')} returns ${w.many} of entities, one per record, and ${w.fails}; ${w.data} reads an entity's record.`) + '\n\n',
      block: printBlock(p, list, desc, sc),
    })
  }

  const load = loadBlock(desc)
  if (null != q && null != q.load && null != load) {
    const e = ent(q.load.entity)
    const n = e.Name.toLowerCase()
    lead.push(`loading ${article(n)} ${n}`)
    const nested = null == q.load.nested ? '' :
      `${e.Name} is nested under ${q.load.nested.parent}, so provide the \`${q.load.nested.param}\`.\n`
    steps.push({
      title: `Load ${article(n)} ${n}`,
      text: nested + wrap(`${w.op('load')} returns the entity and ${w.fails}; ${w.data} reads its record.`) + '\n\n',
      block: printBlock(p, load, desc, sc),
    })
  }

  const writes = writeBlock(desc)
  if (null != q && null != writes) {
    const ops = writeOps(desc)
    const n = ent(q.entity).Name.toLowerCase()
    lead.push(`${series(ops.map((o) => GERUND[o]))} ${article(n)} ${n}`)
    const title = series(ops)
    steps.push({ title: title.charAt(0).toUpperCase() + title.slice(1), text: '', block: printBlock(p, writes, desc, sc) })
  }

  const where = placement(desc)
  let out = `
## Tutorial: your first API call

${wrap(`This tutorial walks through ${series(lead)}.${'' === where ? '' : ' ' + where}`)}

`
  steps.forEach((s, i) => {
    out += `### ${i + 1}. ${s.title}\n\n${s.text}${s.block}\n`
  })
  return out
}


export {
  ReadmeQuick,
  quickText,
}
