"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeRefFeatures = void 0;
const jostraca_1 = require("jostraca");
const FeatureDocs_1 = require("./FeatureDocs");
// The feature reference, appended to every REFERENCE.md.
//
// REFERENCE.md is otherwise generated per-language, because the constructor
// signature, op spelling and code fence differ. Feature CONFIGURATION does
// not: the option names and defaults are model facts, identical in every
// target. So this section is written once and appended to all of them, rather
// than copied into twenty-five ReadmeRef_<lang>.ts files where it would drift.
//
// Covers what a reference has to cover and a README does not: every option
// with its default, what the feature does at runtime, and the considerations
// — ordering, interaction, and cost — that decide whether to switch it on.
const ReadmeRefFeatures = (0, jostraca_1.cmp)(function ReadmeRefFeatures(props) {
    const { target, ctx$ } = props;
    const { model } = ctx$;
    const features = (0, FeatureDocs_1.featureDocs)(model, target);
    if (0 === features.length) {
        return;
    }
    // Emitted INSIDE the per-language `## Features` section, after its summary
    // table and activation snippet, so these are subsections of it rather than
    // a competing heading.
    (0, jostraca_1.Content)(`
### Configuring features

Each feature is inactive until switched on, and an SDK with no feature
configured does no feature work at all. Every option below keeps its default
unless you name it.

${(0, FeatureDocs_1.honoursActivationOrder)(target) ?
        'The array form of \\`feature\\` is significant: several features wrap the\ntransport, and the order you list them in is the order they nest.' :
        'This SDK takes \\`feature\\` as a map and composes the transport-wrapping\nfeatures in a fixed catalog order, so activation order does not change\nnesting here.'}

`);
    const wrapping = features.filter((f) => f.wraps);
    const hooked = features.filter((f) => !f.wraps);
    if (0 < wrapping.length) {
        (0, jostraca_1.Content)(`#### Ordering

${wrapping.map((f) => '`' + f.name + '`').join(', ')} wrap the transport. Each
wraps whatever is already installed${(0, FeatureDocs_1.honoursActivationOrder)(target) ?
            ', so **activation order is nesting order**:\na feature activated later sits OUTSIDE one activated earlier, and sees the call\nfirst.' :
            '. This SDK fixes that order in its own\ncatalog rather than taking it from the caller.'}

${(features.some((f) => 'cost' === f.name) && features.some((f) => 'cache' === f.name)) ?
            `That decides behaviour, not just sequence. \\\`cost\\\` activated before \\\`cache\\\`
sits inside it, so a response served from the cache never reaches \\\`cost\\\` and is
correctly charged nothing; reverse them and every cache hit is billed for money
that was never spent.
` : `That decides behaviour, not just sequence: a feature that short-circuits the
call, such as a cache serving a hit, stops every feature nested inside it from
ever seeing that call.
`}
${hooked.map((f) => '`' + f.name + '`').join(', ')} attach to pipeline hooks
rather than the transport, so their order does not affect what they observe.

`);
    }
    for (const f of features) {
        (0, jostraca_1.Content)(`#### \`${f.name}\`

${f.title}.

`);
        (0, jostraca_1.Content)(`**Configuration**

`);
        // THE TABLE IS THE MODEL'S OPTIONS, AND THE MODEL IS INCOMPLETE. Several
        // features accept runtime-only options the model never declares — cost
        // reads `actor` and `sink`, audit reads `sink` — so a table derived from
        // `config.options` cannot list them. Deriving from a second hand-written
        // list would reintroduce exactly the drift this module exists to avoid,
        // so the honest fix is upstream: declare them in the feature model. Until
        // then, say so rather than imply the table is exhaustive.
        if (0 < f.options.length) {
            (0, jostraca_1.Content)(`| Option | Default |
|---|---|
`);
            for (const o of f.options) {
                (0, jostraca_1.Content)(`| \`${o.name}\` | \`${o.value}\` |
`);
            }
            (0, jostraca_1.Content)(`
`);
        }
        else {
            (0, jostraca_1.Content)(`\`active\` only — this feature takes no further options.

`);
        }
        (0, jostraca_1.Content)(`Options above are those the model carries a default for. A feature may
also accept callback options — a \`sink\` to receive each record, for
instance — which have no default and are covered in the full feature
reference.

**Usage**

Set \`feature.${f.name}.active\` to true in the client options${0 < f.options.length ?
            ', and override any option above in the same entry' : ''}. Every option keeps
its default unless you name it.

**Considerations**

`);
        if (f.wraps) {
            (0, jostraca_1.Content)(`- Wraps the transport: its place in the activation order decides what it
  sees. See [Ordering](#ordering) above.
`);
        }
        else {
            (0, jostraca_1.Content)(`- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
`);
        }
        if ('base' === f.transport) {
            (0, jostraca_1.Content)(`- Installs the BASE transport that the wrapping features wrap, so it must be
  activated before them.
`);
        }
        (0, jostraca_1.Content)(`- Inactive by default: leaving it out costs nothing at runtime.

`);
    }
});
exports.ReadmeRefFeatures = ReadmeRefFeatures;
//# sourceMappingURL=ReadmeRefFeatures.js.map