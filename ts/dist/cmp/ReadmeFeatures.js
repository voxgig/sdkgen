"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeFeatures = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const FeatureDocs_1 = require("./FeatureDocs");
// The `## Features` section of a target README: one subsection per feature
// the SDK actually ships.
//
// WHY IT IS SHARED AND NOT PER-LANGUAGE. Every target activates features the
// same way — a `feature` entry in the client options — and the options and
// their defaults come from the model, so the substance is identical in all
// twenty-five languages. Only the literal syntax of the options map differs,
// and that is already shown once, in the Options section above. A per-target
// `ReadmeFeatures_<lang>.ts` may override this to add idiomatic snippets;
// none is required for the section to be correct.
const ReadmeFeatures = (0, jostraca_1.cmp)(function ReadmeFeatures(props) {
    const { target, ctx$ } = props;
    const { model } = ctx$;
    const override = (0, utility_1.requirePath)(ctx$, `./cmp/${target.name}/ReadmeFeatures_${target.name}`, { ignore: true });
    if (override) {
        override['ReadmeFeatures']({ target });
        return;
    }
    const features = (0, FeatureDocs_1.featureDocs)(model);
    if (0 === features.length) {
        return;
    }
    (0, jostraca_1.Content)(`## Features

This SDK ships ${features.length} optional features. Each is **inactive until you
switch it on**, so an SDK you have not configured behaves exactly as if none of
them existed — no retries, no cache, no logging, no measurable overhead.

Activate a feature by name in the client options, alongside the options shown
above:

| Feature | What it does |
|---|---|
`);
    for (const f of features) {
        (0, jostraca_1.Content)(`| [\`${f.name}\`](#${f.name}) | ${f.title} |
`);
    }
    (0, jostraca_1.Content)(`
`);
    const wrapping = features.filter((f) => f.wraps).map((f) => '`' + f.name + '`');
    if (1 < wrapping.length) {
        if ((0, FeatureDocs_1.honoursActivationOrder)(target)) {
            (0, jostraca_1.Content)(`> **Order matters for ${wrapping.join(', ')}.** These wrap the
> transport, so each one wraps whatever is already installed: the order you
> activate them in IS the nesting order. Activating them as an ordered list
> rather than a map is what fixes that order.

`);
        }
        else {
            (0, jostraca_1.Content)(`> **${wrapping.join(', ')} wrap the transport**, so each one wraps
> whatever is already installed. This SDK composes them in a fixed catalog
> order, not the order you activate them in, and takes \`feature\` as a map.

`);
        }
    }
    for (const f of features) {
        (0, jostraca_1.Content)(`### ${f.name}

${f.title}.

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
        (0, jostraca_1.Content)(`Set \`feature.${f.name}.active\` to enable it${0 < f.options.length ? ', then override any of the options above' : ''}.

`);
        if (f.wraps) {
            (0, jostraca_1.Content)(`\`${f.name}\` wraps the transport, so its position among the other
transport features decides what it sees. A feature activated later wraps one
activated earlier.

`);
        }
    }
});
exports.ReadmeFeatures = ReadmeFeatures;
//# sourceMappingURL=ReadmeFeatures.js.map