import { KIT } from '@voxgig/apidef'

import { surfaceOf } from './surface'


// Names only the active surfaces, so a project with go-mcp off is not promised one.
function alongsideNote(model: any, self: string): string {
  const target = model?.main?.[KIT]?.target || {}
  const others = Object.entries(target)
    .filter(([name, t]: [string, any]) => name !== self && null != t && false !== t.active)
    .map(([, t]: [string, any]) => surfaceOf(t))

  const cli = others.includes('cli')
  const mcp = others.includes('mcp')
  const langs = others.includes('sdk')

  const parts: string[] = []
  if (langs) parts.push('Other languages')
  if (cli) parts.push('the CLI')
  if (mcp) parts.push(cli ? 'MCP server' : 'the MCP server')
  if (0 === parts.length) return ''

  const list = 1 === parts.length ? parts[0]
    : 2 === parts.length ? parts.join(' and ')
      : parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1]
  const verb = 1 === parts.length && !langs ? 'lives' : 'live'

  return `> ${list[0].toUpperCase() + list.slice(1)} ${verb} alongside this one — see
> the [top-level README](../README.md).

`
}


export {
  alongsideNote,
}
