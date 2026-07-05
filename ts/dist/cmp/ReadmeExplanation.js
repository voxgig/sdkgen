"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeExplanation = void 0;
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
const utility_1 = require("../utility");
const opShape_1 = require("../helpers/opShape");
const opExample_1 = require("../helpers/opExample");
const naming_1 = require("../helpers/naming");
function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
const DEFAULT_LANG = {
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
};
const LANGS = {
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
};
const ReadmeExplanation = (0, jostraca_1.cmp)(function ReadmeExplanation(props) {
    const { target, ctx$ } = props;
    const { model } = ctx$;
    const feature = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.feature`);
    const lang = LANGS[target.name] || DEFAULT_LANG;
    // Derive a real example entity from the model (the same way the sibling
    // Readme components do) so the entity-state example never references a
    // phantom entity.
    const entity = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.entity`, { only_active: false, required: false });
    const ex = Object.values(entity || {}).find((e) => e && e.active !== false);
    const eName = ex ? (ex.Name || (ex.name[0].toUpperCase() + ex.name.slice(1))) : 'Entity';
    // Sanitise against the target's reserved words (a `Delete` entity must not
    // bind `const delete = ...`).
    const eLower = (0, naming_1.safeVarName)(eName.toLowerCase(), target.name);
    const lname = target.name;
    // The entity's id-like key field name, or null when it has none (a
    // response-wrapped spec can model an entity with no id). Drives whether the
    // state example keys on an id at all.
    const idF = (0, opShape_1.entityIdField)(ex);
    // The entity's PRIMARY op — an op it actually exposes (never a hardcoded
    // `load` a create-only entity lacks).
    const primaryOp = (0, opShape_1.entityPrimaryOp)(ex) || 'load';
    const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp;
    // Type-correct example id literal (numeric when the id param is integer-typed),
    // derived from the OP's param type so an id carried only in the match compiles.
    const idLit = (0, opExample_1.idLiteral)(ex, primaryOp, idF);
    // Language-correct call argument for the primary op: a match for load/remove,
    // a required-field body for create/update, nothing for list.
    let stateArg;
    if ('list' === primaryOp) {
        stateArg = 'go' === target.name ? 'nil' : '';
    }
    else if (isMatchOp) {
        stateArg = (0, opExample_1.matchArg)(lname, idF, idLit);
    }
    else {
        stateArg = (0, opExample_1.dataArg)(lname, ex, primaryOp, idF);
    }
    // Only a match op keys the `.match()` comment on `{ id: ... }`.
    const matchIdF = isMatchOp ? idF : null;
    (0, jostraca_1.Content)(`
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

`);
    // Features and hooks
    (0, jostraca_1.Content)(`### Features and hooks

`);
    (0, jostraca_1.Content)(lang.featureKind);
    (0, jostraca_1.Content)(`The SDK ships with built-in features:

`);
    (0, jostraca_1.each)(feature, (feat) => {
        if (!feat.active)
            return;
        if (!feat.Name)
            (0, jostraca_1.names)(feat, feat.name);
        const purpose = feat.title || feat.Name || feat.name;
        (0, jostraca_1.Content)(`- **${feat.Name}Feature**: ${purpose}
`);
    });
    (0, jostraca_1.Content)(`
Features are initialized in order. Hooks fire in the order features
were added, so later features can override earlier ones.

`);
    // Target-specific explanation
    const ReadmeExplanation_sdk = (0, utility_1.requirePath)(ctx$, `./cmp/${target.name}/ReadmeExplanation_${target.name}`, { ignore: true });
    if (ReadmeExplanation_sdk) {
        ReadmeExplanation_sdk['ReadmeExplanation']({ target });
    }
    // Entity state
    (0, jostraca_1.Content)(`### Entity state

`);
    (0, jostraca_1.Content)(lang.entityState(eName, eLower, primaryOp, stateArg, matchIdF, idLit));
    // Direct vs entity access
    (0, jostraca_1.Content)(`### Direct vs entity access

The entity interface handles URL construction, parameter placement,
and response parsing automatically. Use it for standard CRUD operations.

`);
    (0, jostraca_1.Content)(lang.direct);
});
exports.ReadmeExplanation = ReadmeExplanation;
//# sourceMappingURL=ReadmeExplanation.js.map