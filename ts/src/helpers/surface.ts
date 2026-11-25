import { KIT, getModelPath } from '../types'
import { fact } from './facts'


// What the `surface` slot may hold. The schema leaves it open; package check
// holds it to these, and a document names a target with any other word by its
// title alone.
const SURFACES = ['sdk', 'cli', 'mcp', 'data', 'seneca-provider']


// A surface as one word of a list such as "CLI and MCP surfaces".
const SURFACE_WORD: Record<string, string> = {
  sdk: 'SDK',
  cli: 'CLI',
  mcp: 'MCP',
  data: 'data',
  'seneca-provider': 'Seneca provider',
}


function surfaceOf(target: any): string {
  const surface = fact(target, 'surface')
  return SURFACES.includes(surface) ? surface : ''
}


// The order every document lists targets in: the configured languages by
// origin, then the rest, then the CLI and the MCP server.
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
  surfaceOf,
}
