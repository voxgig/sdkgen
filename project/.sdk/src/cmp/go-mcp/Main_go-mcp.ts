
import * as Path from 'node:path'

import {
  cmp, each,
  File, Content, Fragment, Slot,
} from '@voxgig/sdkgen'

import type {
  ModelEntity,
} from '@voxgig/apidef'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const MCP_GO_SDK_VERSION = 'v1.6.0'


const Main = cmp(function Main(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const org = model.origin || 'voxgig-sdk'
  const sdkModule = `github.com/${org}/${model.name}-sdk/go`
  const mcpModule = `github.com/${org}/${model.name}-sdk/go-mcp`

  const entityMap: any = getModelPath(model, `main.${KIT}.entity`)
  const entityNames = Object.keys(entityMap).map(n => n.toLowerCase())
  const entityHelp = entityNames.length > 0 ? entityNames.join(' | ') : '(none)'

  // Slug-based tool name prefix. Goes into `<slug>_list` / `<slug>_load`
  // tool names so an MCP host with multiple installed SDK servers
  // sees unambiguous tool ids.
  const slugLower = model.name.toLowerCase()

  const FRAGMENT = Path.normalize(__dirname + '/../../../src/cmp/go-mcp/fragment')

  // .gitignore — the compiled binary lands at /<modulename>-mcp; ignore it.
  File({ name: '.gitignore' }, () => Content(`/${model.name}-mcp
`))

  // go.mod — sibling SDK via relative replace; MCP Go SDK pulled from
  // the public proxy.
  File({ name: 'go.mod' }, () => Content(`module ${mcpModule}

go 1.21

require ${sdkModule} v0.0.0
require github.com/modelcontextprotocol/go-sdk ${MCP_GO_SDK_VERSION}

replace ${sdkModule} => ../go
`))

  // main.go — produced from fragment/main.fragment.go with one Slot
  // for the MCP server's announced name.
  File({ name: 'main.go' }, () => {
    Fragment(
      {
        from: Path.join(FRAGMENT, 'main.fragment.go'),
        replace: {
          ...props.ctx$.stdrep,
          GOMODULE: sdkModule,
        },
      },
      () => {
        Slot({ name: 'serverName' }, () => Content(slugLower))
      },
    )
  })

  // tools.go — produced from fragment/tools.fragment.go with Slots
  // for: the entity help string in the input-schema description,
  // the two tool name prefixes (`<slug>_list` / `<slug>_load`), and
  // a per-entity `case` block in the entity dispatch switch.
  File({ name: 'tools.go' }, () => {
    Fragment(
      {
        from: Path.join(FRAGMENT, 'tools.fragment.go'),
        replace: {
          ...props.ctx$.stdrep,
          GOMODULE: sdkModule,
        },
      },
      () => {
        Slot({ name: 'entityHelp' }, () => Content(entityHelp))
        Slot({ name: 'toolPrefixList' }, () => Content(`${slugLower}_list`))
        Slot({ name: 'toolPrefixLoad' }, () => Content(`${slugLower}_load`))
        Slot({ name: 'entityCases' }, () => {
          each(entityMap, (entity: ModelEntity) => {
            const lower = entity.name.toLowerCase()
            const pascal = (entity as any).Name
            Content(`\tcase "${lower}":
\t\treturn client.${pascal}(nil), nil
`)
          })
        })
      },
    )
  })
})


export {
  Main
}
