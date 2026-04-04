"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeExplanation = void 0;
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
const utility_1 = require("../utility");
const ReadmeExplanation = (0, jostraca_1.cmp)(function ReadmeExplanation(props) {
    const { target, ctx$ } = props;
    const { model } = ctx$;
    const feature = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.feature`);
    (0, jostraca_1.Content)(`
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

`);
    // Target-specific error description
    if (target.name === 'go') {
        (0, jostraca_1.Content)(`If any stage returns an error, the pipeline short-circuits and the
error is returned to the caller. An unexpected panic triggers the
\`PreUnexpected\` hook.

`);
    }
    else {
        (0, jostraca_1.Content)(`If any stage returns an error, the pipeline short-circuits and the
error is returned to the caller.

An unexpected exception triggers the \`PreUnexpected\` hook before
propagating.

`);
    }
    // Features and hooks
    (0, jostraca_1.Content)(`### Features and hooks

`);
    if (target.name === 'go') {
        (0, jostraca_1.Content)(`Features are the extension mechanism. A feature implements the
\`Feature\` interface and provides hooks \u2014 functions keyed by pipeline
stage names.

`);
    }
    else {
        (0, jostraca_1.Content)(`Features are the extension mechanism. A feature is an object with a
\`hooks\` map. Each hook key is a pipeline stage name, and the value is
a function that receives the context.

`);
    }
    (0, jostraca_1.Content)(`The SDK ships with built-in features:

`);
    (0, jostraca_1.each)(feature, (feat) => {
        if (!feat.active)
            return;
        const purpose = feat.title || feat.Name;
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
    if (target.name === 'go') {
        (0, jostraca_1.Content)(`Entity instances are stateful. After a successful \`Load\`, the entity
stores the returned data and match criteria internally.

\`\`\`go
moon := client.Moon(nil)
moon.Load(map[string]any{"planet_id": "earth", "id": "luna"}, nil)

// moon.Data() now returns the loaded moon data
// moon.Match() returns the last match criteria
\`\`\`

Call \`Make()\` to create a fresh instance with the same configuration
but no stored state.

`);
    }
    else {
        (0, jostraca_1.Content)(`Entity instances are stateful. After a successful \`load\`, the entity
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

`);
    }
    // Direct vs entity access
    (0, jostraca_1.Content)(`### Direct vs entity access

The entity interface handles URL construction, parameter placement,
and response parsing automatically. Use it for standard CRUD operations.

`);
    if (target.name === 'go') {
        (0, jostraca_1.Content)(`\`Direct()\` gives full control over the HTTP request. Use it for
non-standard endpoints, bulk operations, or any path not modelled as
an entity. \`Prepare()\` builds the request without sending it \u2014 useful
for debugging or custom transport.

`);
    }
    else {
        (0, jostraca_1.Content)(`The \`direct\` method gives full control over the HTTP request. Use it
for non-standard endpoints, bulk operations, or any path not modelled
as an entity. The \`prepare\` method is useful for debugging \u2014 it
shows exactly what \`direct\` would send.

`);
    }
});
exports.ReadmeExplanation = ReadmeExplanation;
//# sourceMappingURL=ReadmeExplanation.js.map