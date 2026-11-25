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


function surfaceOf(target: any): string {
  const surface = fact(target, 'surface')
  return SURFACES.includes(surface) ? surface : ''
}


export {
  SURFACES,
  SURFACE_SINCE,
  surfaceOf,
}
