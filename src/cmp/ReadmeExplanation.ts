
import { cmp, each, names, Content } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'

import { requirePath } from '../utility'


const ReadmeExplanation = cmp(function ReadmeExplanation(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  const feature = getModelPath(model, `main.${KIT}.feature`)

  Content(`
## Explanation

### The operation pipeline

Every entity operation (load, list, create, update, remove) follows a
six-stage pipeline. Each stage fires a feature hook before executing:

\`\`\`
PrePoint \u2192 PreSpec \u2192 PreRequest \u2192 PreResponse \u2192 PreResult \u2192 PreDone
\`\`\`

- **PrePoint**: Resolves which API endpoint to call based on the
  operation name and entity configuration.
- **PreSpec**: Builds the HTTP spec \u2014 URL, method, headers, body \u2014
  from the resolved point and the caller's parameters.
- **PreRequest**: Sends the HTTP request. Features can intercept here
  to replace the transport (as TestFeature does with mocks).
- **PreResponse**: Parses the raw HTTP response.
- **PreResult**: Extracts the business data from the parsed response.
- **PreDone**: Final stage before returning to the caller. Entity
  state (match, data) is updated here.

`)

  // Target-specific error description
  if (target.name === 'go') {
    Content(`If any stage returns an error, the pipeline short-circuits and the
error is returned to the caller. An unexpected panic triggers the
\`PreUnexpected\` hook.

`)
  }
  else {
    Content(`If any stage returns an error, the pipeline short-circuits and the
error is returned to the caller.

An unexpected exception triggers the \`PreUnexpected\` hook before
propagating.

`)
  }


  // Features and hooks
  Content(`### Features and hooks

`)

  if (target.name === 'go') {
    Content(`Features are the extension mechanism. A feature implements the
\`Feature\` interface and provides hooks \u2014 functions keyed by pipeline
stage names.

`)
  }
  else {
    Content(`Features are the extension mechanism. A feature is an object with a
\`hooks\` map. Each hook key is a pipeline stage name, and the value is
a function that receives the context.

`)
  }

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

  if (target.name === 'go') {
    Content(`Entity instances are stateful. After a successful \`Load\`, the entity
stores the returned data and match criteria internally.

\`\`\`go
moon := client.Moon(nil)
moon.Load(map[string]any{"planet_id": "earth", "id": "luna"}, nil)

// moon.Data() now returns the loaded moon data
// moon.Match() returns the last match criteria
\`\`\`

Call \`Make()\` to create a fresh instance with the same configuration
but no stored state.

`)
  }
  else {
    Content(`Entity instances are stateful. After a successful \`load\`, the entity
stores the returned data and match criteria internally. Subsequent
calls on the same instance can rely on this state.

\`\`\`ts
const moon = client.Moon()
await moon.load({ planet_id: 'earth', id: 'luna' })

// moon.data() now returns the loaded moon data
// moon.match() returns { planet_id: 'earth', id: 'luna' }
\`\`\`

Call \`make()\` to create a fresh instance with the same configuration
but no stored state.

`)
  }


  // Direct vs entity access
  Content(`### Direct vs entity access

The entity interface handles URL construction, parameter placement,
and response parsing automatically. Use it for standard CRUD operations.

`)

  if (target.name === 'go') {
    Content(`\`Direct()\` gives full control over the HTTP request. Use it for
non-standard endpoints, bulk operations, or any path not modelled as
an entity. \`Prepare()\` builds the request without sending it \u2014 useful
for debugging or custom transport.

`)
  }
  else {
    Content(`The \`direct\` method gives full control over the HTTP request. Use it
for non-standard endpoints, bulk operations, or any path not modelled
as an entity. The \`prepare\` method is useful for debugging \u2014 it
shows exactly what \`direct\` would send.

`)
  }

})


export {
  ReadmeExplanation
}
