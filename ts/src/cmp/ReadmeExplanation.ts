
import { cmp, each, names, Content } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'

import { requirePath } from '../utility'


// The four sections below differ by target language but share an identical
// structure, so the per-language prose lives in one table rather than in
// parallel if/else chains. Targets not listed here (ts, js, ...) use
// DEFAULT_LANG.
type LangExplain = {
  error: string       // what happens when a pipeline stage errors
  featureKind: string // what a "feature" is in this language
  // stateful-entity explanation + example; parameterised by the real
  // example entity name so the snippet never references a phantom entity
  entityState: (eName: string, eLower: string) => string
  direct: string      // direct/prepare explanation
}


const DEFAULT_LANG: LangExplain = {
  error: `If any stage returns an error, the pipeline short-circuits and the
error is returned to the caller.

An unexpected exception triggers the \`PreUnexpected\` hook before
propagating.

`,
  featureKind: `Features are the extension mechanism. A feature is an object with a
\`hooks\` map. Each hook key is a pipeline stage name, and the value is
a function that receives the context.

`,
  entityState: (eName, eLower) => `Entity instances are stateful. After a successful \`load\`, the entity
stores the returned data and match criteria internally. Subsequent
calls on the same instance can rely on this state.

\`\`\`ts
const ${eLower} = client.${eLower}
await ${eLower}.load({ id: "example_id" })

// ${eLower}.data() now returns the loaded ${eLower} data
// ${eLower}.match() returns { id: "example_id" }
\`\`\`

Call \`make()\` to create a fresh instance with the same configuration
but no stored state.

`,
  direct: `The \`direct\` method gives full control over the HTTP request. Use it
for non-standard endpoints, bulk operations, or any path not modelled
as an entity. The \`prepare\` method is useful for debugging — it
shows exactly what \`direct\` would send.

`,
}


const LANGS: Record<string, LangExplain> = {
  py: {
    error: `If any stage returns an error, the pipeline short-circuits and the
error is returned to the caller as the second element in the return tuple.

`,
    featureKind: `Features are the extension mechanism. A feature is a Python class
with hook methods named after pipeline stages (e.g. \`PrePoint\`,
\`PreSpec\`). Each method receives the context.

`,
    entityState: (eName, eLower) => `Entity instances are stateful. After a successful \`load\`, the entity
stores the returned data and match criteria internally.

\`\`\`python
${eLower} = client.${eLower}
${eLower}.load({"id": "example_id"})

# ${eLower}.data_get() now returns the loaded ${eLower} data
# ${eLower}.match_get() returns the last match criteria
\`\`\`

Call \`make()\` to create a fresh instance with the same configuration
but no stored state.

`,
    direct: `\`direct()\` gives full control over the HTTP request. Use it for
non-standard endpoints, bulk operations, or any path not modelled as
an entity. \`prepare()\` builds the request without sending it — useful
for debugging or custom transport.

`,
  },

  php: {
    error: `If any stage returns an error, the pipeline short-circuits and the
error is returned to the caller as the second element in the return array.

`,
    featureKind: `Features are the extension mechanism. A feature is a PHP class
with hook methods named after pipeline stages (e.g. \`PrePoint\`,
\`PreSpec\`). Each method receives the context.

`,
    entityState: (eName, eLower) => `Entity instances are stateful. After a successful \`load\`, the entity
stores the returned data and match criteria internally.

\`\`\`php
$${eLower} = $client->${eLower}();
$${eLower}->load(["id" => "example_id"]);

// $${eLower}->dataGet() now returns the loaded ${eLower} data
// $${eLower}->matchGet() returns the last match criteria
\`\`\`

Call \`make()\` to create a fresh instance with the same configuration
but no stored state.

`,
    direct: `\`direct()\` gives full control over the HTTP request. Use it for
non-standard endpoints, bulk operations, or any path not modelled as
an entity. \`prepare()\` builds the request without sending it — useful
for debugging or custom transport.

`,
  },

  rb: {
    error: `If any stage returns an error, the pipeline short-circuits and the
error is returned to the caller as a second return value.

`,
    featureKind: `Features are the extension mechanism. A feature is a Ruby class
with hook methods named after pipeline stages (e.g. \`PrePoint\`,
\`PreSpec\`). Each method receives the context.

`,
    entityState: (eName, eLower) => `Entity instances are stateful. After a successful \`load\`, the entity
stores the returned data and match criteria internally.

\`\`\`ruby
${eLower} = client.${eLower}
${eLower}.load({ "id" => "example_id" })

# ${eLower}.data_get now returns the loaded ${eLower} data
# ${eLower}.match_get returns the last match criteria
\`\`\`

Call \`make\` to create a fresh instance with the same configuration
but no stored state.

`,
    direct: `\`direct\` gives full control over the HTTP request. Use it for
non-standard endpoints, bulk operations, or any path not modelled as
an entity. \`prepare\` builds the request without sending it — useful
for debugging or custom transport.

`,
  },

  lua: {
    error: `If any stage returns an error, the pipeline short-circuits and the
error is returned to the caller as a second return value.

`,
    featureKind: `Features are the extension mechanism. A feature is a Lua table
with hook methods named after pipeline stages (e.g. \`PrePoint\`,
\`PreSpec\`). Each method receives the context.

`,
    entityState: (eName, eLower) => `Entity instances are stateful. After a successful \`load\`, the entity
stores the returned data and match criteria internally.

\`\`\`lua
local ${eLower} = client:${eLower}()
${eLower}:load({ id = "example_id" })

-- ${eLower}:data_get() now returns the loaded ${eLower} data
-- ${eLower}:match_get() returns the last match criteria
\`\`\`

Call \`make()\` to create a fresh instance with the same configuration
but no stored state.

`,
    direct: `\`direct()\` gives full control over the HTTP request. Use it for
non-standard endpoints, bulk operations, or any path not modelled as
an entity. \`prepare()\` builds the request without sending it — useful
for debugging or custom transport.

`,
  },

  go: {
    error: `If any stage returns an error, the pipeline short-circuits and the
error is returned to the caller. An unexpected panic triggers the
\`PreUnexpected\` hook.

`,
    featureKind: `Features are the extension mechanism. A feature implements the
\`Feature\` interface and provides hooks — functions keyed by pipeline
stage names.

`,
    entityState: (eName, eLower) => `Entity instances are stateful. After a successful \`Load\`, the entity
stores the returned data and match criteria internally.

\`\`\`go
${eLower} := client.${eName}(nil)
${eLower}.Load(map[string]any{"id": "example_id"}, nil)

// ${eLower}.Data() now returns the loaded ${eLower} data
// ${eLower}.Match() returns the last match criteria
\`\`\`

Call \`Make()\` to create a fresh instance with the same configuration
but no stored state.

`,
    direct: `\`Direct()\` gives full control over the HTTP request. Use it for
non-standard endpoints, bulk operations, or any path not modelled as
an entity. \`Prepare()\` builds the request without sending it — useful
for debugging or custom transport.

`,
  },
}


const ReadmeExplanation = cmp(function ReadmeExplanation(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const feature = getModelPath(model, `main.${KIT}.feature`)
  const lang = LANGS[target.name] || DEFAULT_LANG

  // Derive a real example entity from the model (the same way the sibling
  // Readme components do) so the entity-state example never references a
  // phantom entity.
  const entity = getModelPath(model, `main.${KIT}.entity`, { only_active: false, required: false })
  const ex = Object.values(entity || {}).find((e: any) => e && e.active !== false) as any
  const eName = ex ? (ex.Name || (ex.name[0].toUpperCase() + ex.name.slice(1))) : 'Entity'
  const eLower = eName.toLowerCase()

  Content(`
## Explanation

### The operation pipeline

Every entity operation (load, list, create, update, remove) follows a
six-stage pipeline. Each stage fires a feature hook before executing:

\`\`\`
PrePoint → PreSpec → PreRequest → PreResponse → PreResult → PreDone
\`\`\`

- **PrePoint**: Resolves which API endpoint to call based on the
  operation name and entity configuration.
- **PreSpec**: Builds the HTTP spec — URL, method, headers, body —
  from the resolved point and the caller's parameters.
- **PreRequest**: Sends the HTTP request. Features can intercept here
  to replace the transport (as TestFeature does with mocks).
- **PreResponse**: Parses the raw HTTP response.
- **PreResult**: Extracts the business data from the parsed response.
- **PreDone**: Final stage before returning to the caller. Entity
  state (match, data) is updated here.

`)

  Content(lang.error)


  // Features and hooks
  Content(`### Features and hooks

`)

  Content(lang.featureKind)

  Content(`The SDK ships with built-in features:

`)
  each(feature, (feat: any) => {
    if (!feat.active) return
    if (!feat.Name) names(feat, feat.name)
    const purpose = feat.title || feat.Name || feat.name
    Content(`- **${feat.Name}Feature**: ${purpose}
`)
  })

  Content(`
Features are initialized in order. Hooks fire in the order features
were added, so later features can override earlier ones.

`)


  // Target-specific explanation
  const ReadmeExplanation_sdk =
    requirePath(ctx$, `./cmp/${target.name}/ReadmeExplanation_${target.name}`, { ignore: true })

  if (ReadmeExplanation_sdk) {
    ReadmeExplanation_sdk['ReadmeExplanation']({ target })
  }


  // Entity state
  Content(`### Entity state

`)

  Content(lang.entityState(eName, eLower))


  // Direct vs entity access
  Content(`### Direct vs entity access

The entity interface handles URL construction, parameter placement,
and response parsing automatically. Use it for standard CRUD operations.

`)

  Content(lang.direct)

})


export {
  ReadmeExplanation
}
