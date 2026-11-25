import { KIT, getModelPath } from '../types'
import { fact } from './facts'


// What the `surface` slot may hold. The schema leaves it open; package check
// holds it to these, and a document names a target with any other word by its
// title alone.
const SURFACES = ['sdk', 'cli', 'mcp', 'data', 'seneca-provider']


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


function surfaceOf(target: any): string {
  const surface = fact(target, 'surface')
  return SURFACES.includes(surface) ? surface : ''
}


// The title and the noun for what the target is, with the noun's words the
// title already ends with said once: "Go CLI", "Python Data package".
function surfaceName(target: any): string {
  const title = String(fact(target, 'title')).split(' ')
  const noun = (SURFACE_NOUN[surfaceOf(target)] ?? 'package').split(' ')
  for (let k = Math.min(title.length, noun.length); 0 < k; k--) {
    if (title.slice(-k).join(' ').toLowerCase() === noun.slice(0, k).join(' ').toLowerCase()) {
      return [...title, ...noun.slice(k)].join(' ')
    }
  }
  return [...title, ...noun].join(' ')
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
  SURFACE_WORD,
  documentOrder,
  surfaceName,
  surfaceOf,
}
