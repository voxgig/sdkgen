import { fact } from './facts'


// What the `surface` slot may hold. The schema leaves it open; package check
// holds it to these, and a document names a target with any other word by its
// title alone.
const SURFACES = ['sdk', 'cli', 'mcp', 'data', 'seneca-provider']


function surfaceOf(target: any): string {
  const surface = fact(target, 'surface')
  return SURFACES.includes(surface) ? surface : ''
}


export {
  SURFACES,
  surfaceOf,
}
