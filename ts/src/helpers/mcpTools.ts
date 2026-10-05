import { each } from 'jostraca'
import { KIT, getModelPath } from '@voxgig/apidef'

import type { ModelEntity, SdkModel } from '../types'

import { entityOps } from './opShape'


type McpTool = {
  op: string
  name: string
  entities: ModelEntity[]
}


const MCP_READ_OPS = ['list', 'load']
const MCP_WRITE_OPS = ['create', 'update', 'patch', 'remove']


// The tools the go-mcp server registers, each for the entities a plain call of
// its operation runs on, in name order. A tool no entity can serve is left
// out. The write tools need the target's `tool.write`.
function mcpTools(model: SdkModel, target: string = 'go-mcp'): McpTool[] {
  const write = true === model.main?.[KIT]?.target?.[target]?.tool?.write
  const slug = String(model.name ?? '').toLowerCase()
  const entities: ModelEntity[] = each(getModelPath(model, `main.${KIT}.entity`) || {})
    .filter((ent: ModelEntity) => null != ent && false !== ent.active)

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
