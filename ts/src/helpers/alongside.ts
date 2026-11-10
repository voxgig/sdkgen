import { KIT } from '@voxgig/apidef'


const PHASES = ['entity', 'feature', 'readme', 'agentguide', 'test']


// A consumer (py-data) switches every phase off and has no ReadmeTop components.
function isConsumer(target: any): boolean {
  return PHASES.every((name: string) => false === target?.phase?.[name]?.active)
}


// Names only the active surfaces, so a project with go-mcp off is not promised one.
function alongsideNote(model: any, self: string): string {
  const target = model?.main?.[KIT]?.target || {}
  const others = Object.entries(target)
    .filter(([name, t]: [string, any]) => name !== self && null != t && false !== t.active)

  const has = (name: string) => others.some(([other]) => other === name)
  const cli = has('go-cli')
  const mcp = has('go-mcp')
  const langs = others.some(([name, t]: [string, any]) =>
    'go-cli' !== name && 'go-mcp' !== name && !isConsumer(t))

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
  isConsumer,
  alongsideNote,
}
