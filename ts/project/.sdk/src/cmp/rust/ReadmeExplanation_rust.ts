
import { cmp, Content } from '@voxgig/sdkgen'

import { crateIdent } from './utility_rust'


const ReadmeExplanation = cmp(function ReadmeExplanation(props: any) {
  const { target, ctx$: { model } } = props
  const rustcrate = crateIdent(model)

  Content(`### Data as \`Value\`

The Rust SDK uses a single dynamic \`Value\` type throughout rather than a
typed struct per entity. \`Value\` is the vendored voxgig struct port (a
JSON-shaped enum: \`Str\`, \`Num\`, \`Bool\`, \`List\`, \`Map\`, \`Null\`,
\`Noval\`). This mirrors the dynamic nature of the API and keeps the SDK
flexible: code that works with \`Value\` needs no regeneration when the
API schema changes. The typed models in \`entity/types.rs\` follow the
schema only when the SDK is regenerated.

Build request maps with the \`jo\` / \`ja\` helpers and read fields back with
\`getp\`; use \`to_map\` to safely coerce a value to a map.

### Crate structure

\`\`\`
${target.name}/
├── lib.rs                       -- Crate root (module decls + re-exports)
├── core/                        -- Pipeline types, config, client (sdk.rs)
├── entity/                      -- Per-entity clients (one module each)
├── feature/                     -- Built-in features (base, test, log)
└── utility/                     -- Utilities + the vendored voxgig struct port
\`\`\`

The public API is re-exported from the crate root, so \`use ${rustcrate}::{...}\`
reaches the SDK client, \`Value\`, and the \`jo\` / \`ja\` / \`getp\` helpers
directly. Import entity or utility modules only when needed.

`)

})


export {
  ReadmeExplanation
}
