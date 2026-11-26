
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeExplanation = cmp(function ReadmeExplanation(props: any) {
  const { target, ctx$: { model } } = props

  Content(`### Data as tables

The Lua SDK uses plain Lua tables throughout rather than typed
objects. This mirrors the dynamic nature of the API and keeps the
SDK flexible: code that works with the tables needs no regeneration
when the API schema changes. The typed models in
\`${model.name}_types.lua\` follow the schema only when the SDK is
regenerated.

Use \`helpers.to_map()\` to safely validate that a value is a table.

### Module structure

\`\`\`
lua/
├── ${model.name}_sdk.lua    -- Main SDK module
├── config.lua               -- Configuration
├── schema.lua               -- Generated option + entity specs
├── features.lua             -- Feature factory
├── core/                    -- Core types and context
├── entity/                  -- Entity implementations
├── feature/                 -- Feature implementations
├── utility/                 -- Utility functions and struct library
└── test/                    -- Test suites
\`\`\`

The main module (\`${model.name}_sdk\`) exports the SDK constructor
and test helper. Import entity or utility modules directly only
when needed.

`)

})


export {
  ReadmeExplanation
}
