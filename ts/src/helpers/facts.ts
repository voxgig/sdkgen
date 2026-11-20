import { readFileSync } from 'node:fs'

import { Aontu } from 'aontu'
import { KIT } from '@voxgig/apidef'

import { factRulesFile } from './shipped'


// No fact rule reads these, and they are most of a large model.
const UNREAD = ['entity', 'flow']


function isMap(v: any): boolean {
  return null != v && 'object' === typeof v && !Array.isArray(v)
}


function copyFacts(from: any, to: any): void {
  for (const [key, val] of Object.entries(from)) {
    if ('fact' === key) {
      to.fact = val
    }
    else if (isMap(val) && isMap(to[key])) {
      copyFacts(val, to[key])
    }
  }
}


// Computes every fact once and writes it into the model beside what it
// describes, as `fact`. Templates read facts with `fact`; none computes one.
function applyFacts(model: any): any {
  const kit = model?.main?.[KIT]
  if (!isMap(kit)) {
    return model
  }

  const input: any = {}
  for (const [key, val] of Object.entries(kit)) {
    if (!UNREAD.includes(key)) {
      input[key] = val
    }
  }

  const path = factRulesFile()
  const src = JSON.stringify({ main: { [KIT]: input } }).slice(1, -1) +
    '\n' + readFileSync(path, 'utf8')

  const errs: any[] = []
  const out = new Aontu().generate(src, { path, errs })
  if (0 < errs.length || null == out?.main?.[KIT]) {
    throw new Error('sdkgen facts: the fact rules did not evaluate: ' +
      errs.map((e: any) => `[${e.why}] ${e.msg}`).join(' | '))
  }

  copyFacts(out.main[KIT], kit)
  return model
}


function fact(node: any, name: string): any {
  const facts = node?.fact
  if (!isMap(facts) || !(name in facts)) {
    throw new Error(`sdkgen facts: '${node?.name ?? '?'}' has no fact '${name}': ` +
      'the model did not pass through applyFacts, or lacks what the fact reads')
  }
  return facts[name]
}


export {
  applyFacts,
  fact,
}
