

import { Content } from 'jostraca'
import { cmp } from '../helpers/component'

import {
  KIT,
  getModelPath
} from '../types'

import { optionalComponent } from '../helpers/optional'
import { featureDocs, honoursActivationOrder } from './FeatureDocs'
import { PIPELINE_STAGES, pipelineLength } from './FeatureHook'

import { entityIdField, pickExampleEntity } from '../helpers/opShape'
import { helperLang, idLiteral, matchArg, listMatchArg, dataArg } from '../helpers/opExample'
import { exampleVarName, phpEntityAccessor } from '../helpers/naming'
import { exampleParts, entityName } from '../helpers/exampleCall'
import type { ExampleInput } from '../helpers/exampleCall'
import { originName } from '../helpers/packageMeta'


function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


type StateExample = ExampleInput & {
  eName: string
  eLower: string
  // The primary op's argument in the languages opExample writes.
  arg: string
  // The id key when the op is a match op, so the `.match()` comment can show
  // `{ id: ... }`; else null.
  matchIdF: string | null
  idLit: string
}


type LangExplain = {
  featureKind: string
  // Stateful-entity explanation and example, driven by the entity's PRIMARY
  // op, never a hardcoded `load` a create-only entity lacks. A language
  // without one has no entity object to keep state in, and writes nothing.
  entityState?: (x: StateExample) => string
  direct: string
}


// A language with no row writes neutral prose and no code.
const DEFAULT_LANG: LangExplain = {
  featureKind: `Features are the extension mechanism. A feature implements hooks named
after the pipeline stages, and each hook receives the context.

`,
  direct: `The \`direct\` method gives full control over the HTTP request. Use it
for non-standard endpoints, bulk operations, or any path not modelled
as an entity. The \`prepare\` method is useful for debugging — it
shows exactly what \`direct\` would send.

`,
}


const TS_EXPLAIN = (fence: string): LangExplain => ({
  featureKind: `Features are the extension mechanism. A feature is an object with a
\`hooks\` map. Each hook key is a pipeline stage name, and the value is
a function that receives the context.

`,
  entityState: ({ eName, eLower, op, arg, matchIdF, idLit }) => `Entity instances are stateful. After a successful \`${op}\`, the entity
stores the returned data and match criteria internally. Subsequent
calls on the same instance can rely on this state.

\`\`\`${fence}
const ${eLower} = client.${eName}()
await ${eLower}.${op}(${arg})

// ${eLower}.data() now returns the ${eLower} data from the last \`${op}\`
${matchIdF ? `// ${eLower}.match() returns { ${matchIdF}: ${idLit} }` : `// ${eLower}.match() returns the last match criteria`}
\`\`\`

Call \`make()\` to create a fresh instance with the same configuration
but no stored state.

`,
  direct: DEFAULT_LANG.direct,
})


function featureClass(lang: string, point: string, spec: string, extra = ''): string {
  return `Features are the extension mechanism. A feature is a ${lang} class${extra}
with hook methods named after pipeline stages (e.g. \`${point}\`,
\`${spec}\`). Each method receives the context.

`
}

function stateText(op: string, fence: string, code: string, make: string): string {
  return `Entity instances are stateful. After a successful \`${op}\`, the entity
stores the returned data and match criteria internally.

\`\`\`${fence}
${code}
\`\`\`

Call \`${make}\` to create a fresh instance with the same configuration
but no stored state.

`
}

function directText(direct: string, prepare: string): string {
  return `\`${direct}\` gives full control over the HTTP request. Use it for
non-standard endpoints, bulk operations, or any path not modelled as
an entity. \`${prepare}\` builds the request without sending it — useful
for debugging or custom transport.

`
}

const LANGS: Record<string, LangExplain> = {
  py: {
    featureKind: `Features are the extension mechanism. A feature is a Python class
with hook methods named after pipeline stages (e.g. \`PrePoint\`,
\`PreSpec\`). Each method receives the context.

`,
    entityState: ({ eName, eLower, op, arg }) => `Entity instances are stateful. After a successful \`${op}\`, the entity
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
    entityState: ({ eName, eLower, op, arg }) => `Entity instances are stateful. After a successful \`${op}\`, the entity
stores the returned data and match criteria internally.

\`\`\`php
$${eLower} = $client->${phpEntityAccessor(eName)}();
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
    entityState: ({ eName, eLower, op, arg }) => `Entity instances are stateful. After a successful \`${op}\`, the entity
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
    entityState: ({ eName, eLower, op, arg }) => `Entity instances are stateful. After a successful \`${op}\`, the entity
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
    entityState: ({ eName, eLower, op, arg }) => `Entity instances are stateful. After a successful \`${cap(op)}\`, the entity
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

  ts: TS_EXPLAIN('ts'),

  js: TS_EXPLAIN('js'),

  c: {
    featureKind: `Features are the extension mechanism. A feature is a struct whose first
member is a \`Feature\` holding its vtable. The vtable's \`hook\` function
receives each pipeline stage's name and the context.

`,
    entityState: (x) => {
      const { v, factory, arg } = exampleParts('c', x)
      return stateText(x.op, 'c', `Entity* ${v} = ${factory};
PNError* err = NULL;
${v}->vt->${x.op}(${v}, ${arg}, NULL, &err);

// ${v}->vt->data(${v}, NULL) now returns the ${v} data from the last ${x.op}
// ${v}->vt->matchv(${v}, NULL) returns the last match criteria`, 'vt->make')
    },
    direct: directText('sdk_direct()', 'sdk_prepare()'),
  },

  cpp: {
    featureKind: `Features are the extension mechanism. A feature is a class derived from
\`Feature\` that overrides a method per pipeline stage (e.g. \`prePoint\`,
\`preSpec\`). Each method receives the context.

`,
    entityState: (x) => {
      const { v, factory, arg } = exampleParts('cpp', x)
      return stateText(x.op, 'cpp', `auto ${v} = ${factory};
${v}->${x.op}(${arg}, Value::undef());

// ${v}->data() now returns the ${v} data from the last ${x.op}
// ${v}->match() returns the last match criteria`, 'make()')
    },
    direct: directText('direct()', 'prepare()'),
  },

  rust: {
    featureKind: `Features are the extension mechanism. A feature implements the \`Feature\`
trait, which has a method per pipeline stage (e.g. \`pre_point\`,
\`pre_spec\`). Each method receives the context.

`,
    entityState: (x) => {
      const { v, factory, arg } = exampleParts('rust', x)
      return stateText(x.op, 'rust', `let ${v} = ${factory};
let _ = ${v}.${x.op}(${arg}, Value::Noval);

// ${v}.data(None) now returns the ${v} data from the last ${x.op}
// ${v}.matchv(None) returns the last match criteria`, 'make()')
    },
    direct: directText('direct()', 'prepare()'),
  },

  zig: {
    featureKind: `Features are the extension mechanism. A feature is a \`Feature\` whose
\`dispatch\` function receives each pipeline stage's name and the context.

`,
    entityState: (x) => {
      const { v, factory, arg } = exampleParts('zig', x)
      return stateText(x.op, 'zig', `const ${v} = ${factory};
switch (${v}.${x.op}(${arg}, h.vnull())) {
    .ok => {},
    .err => |e| std.debug.print("${x.op} failed: {s}\\n", .{e.msg}),
}

// ${v}.asEntity().data(null) now returns the ${v} data from the last ${x.op}
// ${v}.asEntity().matchv(null) returns the last match criteria`, 'asEntity().makeEnt()')
    },
    direct: directText('direct()', 'prepare()'),
  },

  ocaml: {
    featureKind: `Features are the extension mechanism. A feature is a \`feature\` record
whose \`f_hook\` function receives each pipeline stage's name and the context.

`,
    entityState: (x) => {
      const { v, factory, arg } = exampleParts('ocaml', x)
      return stateText(x.op, 'ocaml', `let ${v} = ${factory} in
ignore (${v}.e_${x.op} ${arg} Noval)
(* ${v}.e_data_get () now returns the ${v} data from the last e_${x.op} *)
(* ${v}.e_match_get () returns the last match criteria *)`, 'e_make')
    },
    direct: directText('Sdk_client.direct', 'Sdk_client.prepare'),
  },

  perl: {
    featureKind: featureClass('Perl', 'PrePoint', 'PreSpec'),
    entityState: (x) => {
      const { v, factory, arg } = exampleParts('perl', x)
      return stateText(x.op, 'perl', `my $${v} = ${factory};
$${v}->${x.op}(${arg});

# $${v}->data_get now returns the ${v} data from the last ${x.op}
# $${v}->match_get returns the last match criteria`, 'make')
    },
    direct: directText('direct', 'prepare'),
  },

  java: {
    featureKind: featureClass('Java', 'prePoint', 'preSpec', ' extending `BaseFeature`'),
    entityState: (x) => {
      const { v, factory, arg } = exampleParts('java', x)
      return stateText(x.op, 'java', `SdkEntity ${v} = ${factory};
${v}.${x.op}(${arg}, null);

// ${v}.data() now returns the ${v} data from the last ${x.op}
// ${v}.match() returns the last match criteria`, 'make()')
    },
    direct: directText('direct()', 'prepare()'),
  },

  kotlin: {
    featureKind: featureClass('Kotlin', 'prePoint', 'preSpec', ' extending `BaseFeature`'),
    entityState: (x) => {
      const { v, factory, arg } = exampleParts('kotlin', x)
      return stateText(x.op, 'kotlin', `val ${v} = ${factory}
${v}.${x.op}(${arg}, null)

// ${v}.data() now returns the ${v} data from the last ${x.op}
// ${v}.match() returns the last match criteria`, 'make()')
    },
    direct: directText('direct()', 'prepare()'),
  },

  scala: {
    featureKind: featureClass('Scala', 'prePoint', 'preSpec', ' extending `BaseFeature`'),
    entityState: (x) => {
      const { v, factory, arg } = exampleParts('scala', x)
      return stateText(x.op, 'scala', `val ${v} = ${factory}
${v}.${x.op}(${arg}, null)

// ${v}.data() now returns the ${v} data from the last ${x.op}
// ${v}.matchArgs() returns the last match criteria`, 'make()')
    },
    direct: directText('direct()', 'prepare()'),
  },

  csharp: {
    featureKind: featureClass('C#', 'PrePoint', 'PreSpec', ' extending `BaseFeature`'),
    entityState: (x) => {
      const { v, factory, arg } = exampleParts('csharp', x)
      return stateText(x.op, 'csharp', `var ${v} = ${factory};
${v}.${cap(x.op)}(${arg});

// ${v}.Data() now returns the ${v} data from the last ${cap(x.op)}
// ${v}.Match() returns the last match criteria`, 'Make()')
    },
    direct: directText('Direct()', 'Prepare()'),
  },

  swift: {
    featureKind: featureClass('Swift', 'prePoint', 'preSpec', ' extending `BaseFeature`'),
    entityState: (x) => {
      const { v, factory, arg } = exampleParts('swift', x)
      return stateText(x.op, 'swift', `let ${v} = ${factory}
_ = try ${v}.${x.op}(${arg}, nil)

// ${v}.data() now returns the ${v} data from the last ${x.op}
// ${v}.matchv() returns the last match criteria`, 'make()')
    },
    direct: directText('direct()', 'prepare()'),
  },

  elixir: {
    featureKind: `Features are the extension mechanism. A feature is a struct value node
carrying a closure for each hook it implements, keyed by pipeline stage
name (e.g. \`PrePoint\`). Each closure receives the context.

`,
    entityState: (x) => {
      const { v, factory, arg } = exampleParts('elixir', x)
      const mod = `${x.model.const.Name}.Entity.${entityName(x.ent)}`
      return stateText(x.op, 'elixir', `${v} = ${factory}
${mod}.${x.op}(${'' === arg ? v : v + ', ' + arg})

# ${mod}.data_get(${v}) now returns the ${v} data from the last ${x.op}
# ${mod}.match_get(${v}) returns the last match criteria`, 'make/1')
    },
    direct: directText('direct/2', 'prepare/2'),
  },

  clojure: {
    featureKind: `Features are the extension mechanism. A feature is an atom wrapping a
map, with a function under the name of each pipeline stage it implements
(e.g. \`"PrePoint"\`). Each function receives the context.

`,
    entityState: (x) => {
      const { v, factory, arg } = exampleParts('clojure', x)
      const ns = 'e-' + x.ent.name
      return stateText(x.op, 'clojure', `(require '[sdk.api :as api]
         '[sdk.entity.${x.ent.name} :as ${ns}]
         '[voxgig.struct :as vs])

(def ${v} ${factory})
(${ns}/${x.op} ${v} ${arg} nil)

;; ((:data-get ${v})) now returns the ${v} data from the last ${x.op}
;; ((:match-get ${v})) returns the last match criteria`, `((:make ${v}))`)
    },
    direct: directText('api/direct', 'api/prepare'),
  },
}


const ReadmeExplanation = cmp(function ReadmeExplanation(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  // An alias writes its origin's row.
  const origin = originName(model, target.name)
  const lang = LANGS[origin] || DEFAULT_LANG

  // Pick a real example entity WITH a real op (prefer a read op) so the
  // entity-state example never references a phantom entity or fabricates a
  // `.load()` on an op-less one (e.g. Cloudsmith's `Abort`). primaryOp is null
  // only when NO entity exposes any op — then the entity-state section is
  // skipped (a direct()-only SDK has no entity op to illustrate).
  const entity = getModelPath(model, `main.${KIT}.entity`, { only_active: false, required: false })
  const { entity: ex, primaryOp } = pickExampleEntity(entity || {})
  const lname = helperLang(origin)
  const hasEntityExample = !!(ex && primaryOp && lang.entityState)

  let eName = 'Entity', eLower = 'entity', stateArg = '', matchIdF: string | null = null, idLit = ''
  let idF: string | null = null
  if (hasEntityExample) {
    eName = entityName(ex)
    eLower = exampleVarName(eName.toLowerCase(), origin)
    idF = entityIdField(ex)
    const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
    // Type-correct example id literal (numeric when the id param is integer-
    // typed), derived from the OP's param type so an id carried only in the
    // match compiles.
    idLit = idLiteral(ex, primaryOp as string, idF)
    // Language-correct call argument for the primary op: a match for
    // load/remove/list, a required-field body for create/update.
    if ('list' === primaryOp) {
      stateArg = listMatchArg(lname, ex)
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

Every entity operation follows a ${pipelineLength()}-stage pipeline. Each stage fires a
feature hook before executing:

\`\`\`
${PIPELINE_STAGES.map((s) => s.hook).join(' → ')}
\`\`\`

${PIPELINE_STAGES.map((s) => '- **' + s.hook + '**: ' + s.purpose).join('\n')}

If any stage errors, the pipeline short-circuits and the error surfaces
to the caller — see [Error handling](#error-handling) for how that looks
in this language.

`)


  Content(`### Features and hooks

`)

  Content(lang.featureKind)

  // This section describes a TARGET's features.
  const features = featureDocs(model, target)
  if (0 < features.length) {
    Content(`The SDK ships with built-in features:

`)
    for (const f of features) {
      Content(`- **${f.Name}Feature**: ${f.title || f.Name}
`)
    }

    Content(honoursActivationOrder({ name: origin }) ? `
Features are initialized in order. Hooks fire in the order features
were added, so later features can override earlier ones.

` : `
Features are initialized in a fixed catalog order, whatever order they
were added in.

`)
  }


  const ReadmeExplanation_sdk =
    optionalComponent(ctx$, target, 'ReadmeExplanation')

  if (ReadmeExplanation_sdk) {
    ReadmeExplanation_sdk['ReadmeExplanation']({ target })
  }


  // Entity state — only when the SDK actually has an entity op to show.
  if (hasEntityExample && lang.entityState) {
    Content(`### Entity state

`)
    Content(lang.entityState({
      model, ent: ex, op: primaryOp as string, idF,
      eName, eLower, arg: stateArg, matchIdF, idLit,
    }))
  }


  Content(`### Direct vs entity access

The entity interface handles URL construction, parameter placement,
and response parsing automatically. Use it for the operations each
entity declares.

`)

  Content(lang.direct)

})


export {
  ReadmeExplanation
}
