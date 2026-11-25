import { KIT, getModelPath } from '../types'
import { fact } from './facts'


// What the `surface` slot may hold, each word with the release that first
// reads it. The schema leaves the slot open; package check holds it to these,
// and a document names a target with any other word by its title alone.
const SURFACE_SINCE: Record<string, string> = {
  sdk: '4.47.0',
  cli: '4.47.0',
  mcp: '4.47.0',
  data: '4.47.0',
  'seneca-provider': '4.47.0',
}

const SURFACES = Object.keys(SURFACE_SINCE)


const SURFACE_WORD: Record<string, string> = {
  sdk: 'SDK',
  cli: 'CLI',
  mcp: 'MCP',
  data: 'data',
  'seneca-provider': 'Seneca provider',
}


const SURFACE_NOUN: Record<string, string> = {
  sdk: 'SDK',
  cli: 'CLI',
  mcp: 'MCP server',
  data: 'data package',
  'seneca-provider': 'Seneca provider',
}


function knownSurface(surface: any): string {
  return SURFACES.includes(surface) ? surface : ''
}


function surfaceOf(target: any): string {
  return knownSurface(fact(target, 'surface'))
}


function surfaceName(target: any): string {
  return titledSurface(String(fact(target, 'title')), surfaceOf(target))
}


// The title and the noun for what the target is, with the noun's words the
// title already ends with said once: "Go CLI", "Python Data package".
function titledSurface(titleText: string, surface: string): string {
  const title = titleText.split(' ')
  const noun = (SURFACE_NOUN[knownSurface(surface)] ?? 'package').split(' ')
  for (let k = Math.min(title.length, noun.length); 0 < k; k--) {
    if (title.slice(-k).join(' ').toLowerCase() === noun.slice(0, k).join(' ').toLowerCase()) {
      return [...title, ...noun.slice(k)].join(' ')
    }
  }
  return [...title, ...noun].join(' ')
}


// A target the `external` fact lists, as this repository's documents name it:
// linked to its own repository when the model names one.
function externalName(target: { title: string, surface: string, url: string }): string {
  const name = titledSurface(target.title, target.surface)
  return '' === target.url ? name : `[${name}](${target.url})`
}


// The configured languages by origin, then the rest, then the CLI and MCP server.
function documentOrder(model: any, targets: any[]): any[] {
  const order: string[] = (getModelPath(model, `main.${KIT}.config.docs_order`,
    { only_active: false, required: false }) as any) || []

  const rank = (t: any): number => {
    const i = order.indexOf(fact(t, 'origin'))
    if (-1 !== i) return i
    const surface = surfaceOf(t)
    if ('cli' === surface) return order.length + 1
    if ('mcp' === surface) return order.length + 2
    return order.length
  }

  return targets.slice().sort((a: any, b: any) => rank(a) - rank(b))
}


export {
  SURFACES,
  SURFACE_SINCE,
  SURFACE_WORD,
  documentOrder,
  externalName,
  surfaceName,
  surfaceOf,
}
