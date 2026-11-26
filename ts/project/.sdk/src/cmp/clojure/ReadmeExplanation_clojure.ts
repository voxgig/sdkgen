
import { cmp, Content } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const ReadmeExplanation = cmp(function ReadmeExplanation(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity || {})
    .find((e: any) => e.active !== false) as any
  const entityNs = exampleEntity ? `, and an entity
namespace (e.g. \`[sdk.entity.${exampleEntity.name} :as e-${exampleEntity.name}]\`)
only when you call its operations directly` : ''

  Content(`### Data as struct value maps

The Clojure SDK represents API data with the vendored \`voxgig.struct\`
value model (ordered, Java-backed maps and lists) rather than typed
records. This mirrors the dynamic nature of the API and keeps the SDK
flexible — no code generation is needed when the API schema changes.

Build request maps with \`(vs/jm "k" v ...)\` and lists with
\`(vs/jt v ...)\`; read values with \`(vs/getprop m "k")\`. Use
\`(vs/ismap x)\` to safely check that a value is a map.

### Namespace structure

\`\`\`
${target.name}/
├── src/sdk/api.clj        -- public API namespace (entity accessors)
├── src/sdk/client.clj     -- client constructors (make-sdk, test-sdk)
├── src/sdk/config.clj     -- generated configuration
├── src/sdk/schema.clj     -- generated option + entity specs
├── src/sdk/core.clj       -- core types, context and pipeline
├── src/sdk/features.clj   -- feature factory
├── src/sdk/entity/        -- entity namespaces (one per entity)
├── src/voxgig/struct.clj  -- vendored struct value library
└── test/                  -- test suites
\`\`\`

Require \`[sdk.api :as api]\` for the public surface${entityNs}.

`)

})


export {
  ReadmeExplanation
}
