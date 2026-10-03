import { KIT, getModelPath } from '@voxgig/apidef'

import { entityOps } from './opShape'


type McpTool = {
  op: string
  name: string
  entities: any[]
}


const MCP_READ_OPS = ['list', 'load']
const MCP_WRITE_OPS = ['create', 'update', 'remove']


// The tools the go-mcp server registers, each for the entities a plain call of
// its operation runs on, in model order. A tool no entity can serve is left
// out. The write tools need the target's `tool.write`.
function mcpTools(model: any, target: string = 'go-mcp'): McpTool[] {
  const write = true === model?.main?.[KIT]?.target?.[target]?.tool?.write
  const slug = String(model?.name ?? '').toLowerCase()
  const entities: any[] = Object.values(getModelPath(model, `main.${KIT}.entity`) || {})
    .filter((ent: any) => null != ent && false !== ent.active)

  return [...MCP_READ_OPS, ...(write ? MCP_WRITE_OPS : [])]
    .map((op) => ({
      op,
      name: slug + '_' + op,
      entities: entities.filter((ent) => entityOps(ent).includes(op)),
    }))
    .filter((tool) => 0 < tool.entities.length)
}


export type {
  McpTool,
}

export {
  mcpTools,
  MCP_READ_OPS,
  MCP_WRITE_OPS,
}
