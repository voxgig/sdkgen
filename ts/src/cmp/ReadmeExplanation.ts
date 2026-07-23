
import { cmp, each, names, Content } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'

import { requirePath } from '../utility'

import { entityIdField, pickExampleEntity } from '../helpers/opShape'
import { idLiteral, matchArg, dataArg } from '../helpers/opExample'
import type { ExampleLang } from '../helpers/opExample'
import { safeVarName, exampleVarName } from '../helpers/naming'


function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


// The four sections below differ by target language but share an identical
// structure, so the per-language prose lives in one table rather than in
// parallel if/else chains. Targets not listed here (ts, js, ...) use
// DEFAULT_LANG.
type LangExplain = {
  featureKind: string // what a "feature" is in this language
  // stateful-entity explanation + example, driven by the entity's PRIMARY op
  // (`op`) — never a hardcoded `load` a create-only entity lacks. `arg` is the
  // pre-rendered, language-correct call argument; `matchIdF` is the id key when
  // the op is a match op (so the `.match()` comment shows `{ id: ... }`), else
  // null (a generic comment).
  entityState: (
    eName: string, eLower: string,
    op: string, arg: string,
    matchIdF: string | null, idLit: string,
  ) => string
  direct: string      // direct/prepare explanation
}


const DEFAULT_LANG: LangExplain = {
  featureKind: `Features are the extension mechanism. A feature is an object with a
\`hooks\` map. Each hook key is a pipeline stage name, and the value is
a function that receives the context.

`,
  entityState: (eName, eLower, op, arg, matchIdF, idLit) => `Entity instances are stateful. After a successful \`${op}\`, the entity
stores the returned data and match criteria internally. Subsequent
calls on the same instance can rely on this state.

\`\`\`ts
const ${eLower} = client.${eName}()
await ${eLower}.${op}(${arg})

// ${eLower}.data() now returns the ${eLower} data from the last \`${op}\`
${matchIdF ? `// ${eLower}.match() returns { ${matchIdF}: ${idLit} }` : `// ${eLower}.match() returns the last match criteria`}
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
    featureKind: `Features are the extension mechanism. A feature is a Python class
with hook methods named after pipeline stages (e.g. \`PrePoint\`,
\`PreSpec\`). Each method receives the context.

`,
    entityState: (eName, eLower, op, arg) => `Entity instances are stateful. After a successful \`${op}\`, the entity
stores the returned data and match criteria internally.

\`\`\`python
${eLower} = client.${eName}()
${eLower}.${op}(${arg})

# ${eLower}.data_get() now returns the ${eLower} data from the last ${op}
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
    featureKind: `Features are the extension mechanism. A feature is a PHP class
with hook methods named after pipeline stages (e.g. \`PrePoint\`,
\`PreSpec\`). Each method receives the context.

`,
    entityState: (eName, eLower, op, arg) => `Entity instances are stateful. After a successful \`${op}\`, the entity
stores the returned data and match criteria internally.

\`\`\`php
$${eLower} = $client->${eName}();
$${eLower}->${op}(${arg});

// $${eLower}->data_get() now returns the ${eLower} data from the last ${op}
// $${eLower}->match_get() returns the last match criteria
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
    featureKind: `Features are the extension mechanism. A feature is a Ruby class
with hook methods named after pipeline stages (e.g. \`PrePoint\`,
\`PreSpec\`). Each method receives the context.

`,
    entityState: (eName, eLower, op, arg) => `Entity instances are stateful. After a successful \`${op}\`, the entity
stores the returned data and match criteria internally.

\`\`\`ruby
${eLower} = client.${eName}
${eLower}.${op}(${arg})

# ${eLower}.data_get now returns the ${eLower} data from the last ${op}
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
    featureKind: `Features are the extension mechanism. A feature is a Lua table
with hook methods named after pipeline stages (e.g. \`PrePoint\`,
\`PreSpec\`). Each method receives the context.

`,
    entityState: (eName, eLower, op, arg) => `Entity instances are stateful. After a successful \`${op}\`, the entity
stores the returned data and match criteria internally.

\`\`\`lua
local ${eLower} = client:${eName}()
${eLower}:${op}(${arg})

-- ${eLower}:data_get() now returns the ${eLower} data from the last ${op}
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
    featureKind: `Features are the extension mechanism. A feature implements the
\`Feature\` interface and provides hooks — functions keyed by pipeline
stage names.

`,
    entityState: (eName, eLower, op, arg) => `Entity instances are stateful. After a successful \`${cap(op)}\`, the entity
stores the returned data and match criteria internally.

\`\`\`go
${eLower} := client.${eName}(nil)
${eLower}.${cap(op)}(${arg}, nil)

// ${eLower}.Data() now returns the ${eLower} data from the last ${op}
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

  // Pick a real example entity WITH a real op (prefer a read op) so the
  // entity-state example never references a phantom entity or fabricates a
  // `.load()` on an op-less one (e.g. Cloudsmith's `Abort`). primaryOp is null
  // only when NO entity exposes any op — then the entity-state section is
  // skipped (a direct()-only SDK has no entity op to illustrate).
  const entity = getModelPath(model, `main.${KIT}.entity`, { only_active: false, required: false })
  const { entity: ex, primaryOp } = pickExampleEntity(entity || {})
  const lname = target.name as ExampleLang
  const hasEntityExample = !!(ex && primaryOp)

  let eName = 'Entity', eLower = 'entity', stateArg = '', matchIdF: string | null = null, idLit = ''
  if (hasEntityExample) {
    eName = ex.Name || (ex.name[0].toUpperCase() + ex.name.slice(1))
    // Sanitise against the target's reserved words (a `Delete` entity must
    // not bind `const delete = ...`).
    eLower = exampleVarName(eName.toLowerCase(), target.name)
    const idF = entityIdField(ex)
    const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
    // Type-correct example id literal (numeric when the id param is integer-
    // typed), derived from the OP's param type so an id carried only in the
    // match compiles.
    idLit = idLiteral(ex, primaryOp as string, idF)
    // Language-correct call argument for the primary op: a match for
    // load/remove, a required-field body for create/update, nothing for list.
    if ('list' === primaryOp) {
      stateArg = 'go' === target.name ? 'nil' : ''
    } else if (isMatchOp) {
      stateArg = matchArg(lname, ex, primaryOp as string, idF, idLit)
    } else {
      stateArg = dataArg(lname, ex, primaryOp as string, idF)
    }
    // Only a match op keys the `.match()` comment on `{ id: ... }`.
    matchIdF = isMatchOp ? idF : null
  }

  Content(`
## Advanced

> The sections above cover everyday use. The material below explains the
> SDK's internals — useful when extending it with custom features, but not
> needed for normal use.

### The operation pipeline

Every entity operation follows a six-stage pipeline. Each stage fires a
feature hook before executing:

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

If any stage errors, the pipeline short-circuits and the error surfaces
to the caller — see [Error handling](#error-handling) for how that looks
in this language.

`)


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


  // Entity state — only when the SDK actually has an entity op to show.
  if (hasEntityExample) {
    Content(`### Entity state

`)
    Content(lang.entityState(eName, eLower, primaryOp as string, stateArg, matchIdF, idLit))
  }


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
