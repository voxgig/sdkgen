"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeRefFeatures = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const FeatureDocs_1 = require("./FeatureDocs");
const packageMeta_1 = require("../helpers/packageMeta");
const ReadmeRefFeatures = (0, component_1.cmp)(function ReadmeRefFeatures(props) {
    const { target, ctx$ } = props;
    const { model } = ctx$;
    const features = (0, FeatureDocs_1.featureDocs)(model, target);
    if (0 === features.length) {
        return;
    }
    const on = features.filter((f) => f.on).map((f) => f.name);
    const ordered = (0, FeatureDocs_1.honoursActivationOrder)({ name: (0, packageMeta_1.originName)(model, target.name) });
    const wrapping = features.filter((f) => f.wraps);
    const hooked = features.filter((f) => 'none' === f.transport);
    // Order decides nothing until one wrapping feature sits inside another.
    const nests = 1 < wrapping.length;
    // Emitted INSIDE the per-language `## Features` section, after its summary
    // table and activation snippet, so these are subsections of it rather than
    // a competing heading.
    (0, jostraca_1.Content)(`
### Configuring features

${0 === on.length ? `Each feature is inactive until switched on, and an SDK with no feature
configured does no feature work at all.` : `${(0, FeatureDocs_1.codeList)(on)} ${1 === on.length ? 'is' : 'are'} active by default${on.length < features.length ? '; every other feature is inactive until switched on' : ''}.`}
Every option below keeps its default unless you name it.

${!nests ? '' : (ordered ?
        'The array form of `feature` is significant: several features wrap the\ntransport, and the order you list them in is the order they nest.' :
        'This SDK takes `feature` as a map and composes the transport-wrapping\nfeatures in a fixed catalog order, so activation order does not change\nnesting here.') + '\n\n'}`);
    if (nests) {
        const hookedNames = hooked.map((f) => '`' + f.name + '`').join(', ');
        const hookedLine = 0 === hooked.length ? '' : '\n' + hookedNames + (1 === hooked.length ?
            ' attaches to pipeline hooks\nrather than the transport, so its order does not affect what it observes.\n' :
            ' attach to pipeline hooks\nrather than the transport, so their order does not affect what they observe.\n');
        (0, jostraca_1.Content)(`#### Ordering

${wrapping.map((f) => '`' + f.name + '`').join(', ')} wrap the transport. Each
wraps whatever is already installed${ordered ?
            ', so **activation order is nesting order**:\na feature activated later sits OUTSIDE one activated earlier, and sees the call\nfirst.' :
            '. This SDK fixes that order in its own\ncatalog rather than taking it from the caller.'}

${(features.some((f) => 'cost' === f.name) && features.some((f) => 'cache' === f.name)) ?
            `That decides behaviour, not just sequence. \\\`cost\\\` activated before \\\`cache\\\`
sits inside it, so a response served from the cache never reaches \\\`cost\\\` and is
correctly charged nothing; reverse them and every cache hit is billed for money
that was never spent.
` : `That decides behaviour, not just sequence: a feature that short-circuits the
call${features.some((f) => 'cache' === f.name) ? ', such as a cache serving a hit,' : ''} stops every feature nested inside it from
ever seeing that call.
`}${hookedLine}
`);
    }
    for (const f of features) {
        (0, jostraca_1.Content)(`#### \`${f.name}\`

${f.title}.

`);
        (0, jostraca_1.Content)(`**Configuration**

`);
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
        else if (0 === f.extras.length) {
            (0, jostraca_1.Content)(`\`active\` only — this feature takes no further options.

`);
        }
        if (0 < f.extras.length) {
            (0, jostraca_1.Content)(`| Option | Type |
|---|---|
`);
            for (const o of f.extras) {
                (0, jostraca_1.Content)(`| \`${o.name}\` | ${o.type} |
`);
            }
            (0, jostraca_1.Content)(`
These take no default: the feature behaves one way when you supply them and
another when you do not.

`);
        }
        (0, jostraca_1.Content)(`**Usage**

Set \`feature.${f.name}.active\` to true in the client options${0 < f.options.length ?
            ', and override any option above in the same entry' : ''}. Every option keeps
its default unless you name it.

**Considerations**

`);
        if (f.wraps) {
            (0, jostraca_1.Content)(nests ? `- Wraps the transport: its place in the activation order decides what it
  sees. See [Ordering](#ordering) above.
` : `- Wraps the transport.
`);
        }
        if ('base' === f.transport) {
            (0, jostraca_1.Content)(`- Installs the BASE transport that the wrapping features wrap, so it must be
  activated before them.
`);
        }
        if ('none' === f.transport) {
            (0, jostraca_1.Content)(`- Attaches to pipeline hooks, not the transport, so activation order does
  not change what it observes.
`);
        }
        else if (0 < f.hooks.length) {
            (0, jostraca_1.Content)(`- Also attaches to pipeline hooks.
`);
        }
        (0, jostraca_1.Content)(`- ${f.on ? `Active by default: set \`feature.${f.name}.active\` to false to switch it off.` :
            'Inactive by default: leaving it out costs nothing at runtime.'}

`);
    }
});
exports.ReadmeRefFeatures = ReadmeRefFeatures;
//# sourceMappingURL=ReadmeRefFeatures.js.map