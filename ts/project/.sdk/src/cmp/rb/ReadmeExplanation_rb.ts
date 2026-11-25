
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeExplanation = cmp(function ReadmeExplanation(props: any) {
  const { target, ctx$: { model } } = props

  Content(`### Data as hashes

The Ruby SDK uses plain Ruby hashes throughout rather than typed
objects. This mirrors the dynamic nature of the API and keeps the
SDK flexible: code that works with the hashes needs no regeneration
when the API schema changes. The typed models in
\`${model.const.Name}_types.rb\` follow the schema only when the SDK is
regenerated.

Use \`Helpers.to_map()\` to safely validate that a value is a hash.

### Module structure

\`\`\`
rb/
├── ${model.const.Name}_sdk.rb       -- Main SDK module
├── config.rb                  -- Configuration
├── schema.rb                  -- Generated option + entity specs
├── features.rb                -- Feature factory
├── core/                      -- Core types and context
├── entity/                    -- Entity implementations
├── feature/                   -- Feature implementations
├── utility/                   -- Utility functions and struct library
└── test/                      -- Test suites
\`\`\`

The main module (\`${model.const.Name}_sdk\`) exports the SDK class
and test helper. Import entity or utility modules directly only
when needed.

`)

})


export {
  ReadmeExplanation
}
