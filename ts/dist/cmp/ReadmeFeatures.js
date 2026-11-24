"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeFeatures = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const optional_1 = require("../helpers/optional");
const FeatureDocs_1 = require("./FeatureDocs");
const ReadmeFeatures = (0, component_1.cmp)(function ReadmeFeatures(props) {
    const { target, ctx$ } = props;
    const { model } = ctx$;
    const override = (0, optional_1.optionalComponent)(ctx$, target, 'ReadmeFeatures');
    if (override) {
        override['ReadmeFeatures']({ target });
        return;
    }
    const features = (0, FeatureDocs_1.featureDocs)(model, target);
    if (0 === features.length) {
        return;
    }
    const on = features.filter((f) => f.on).map((f) => f.name);
    const off = features.length - on.length;
    const one = 1 === features.length;
    const state = 0 === on.length ?
        `${one ? 'It is' : 'Each is'} **inactive until you switch it on**, so an SDK you have not
configured behaves exactly as if ${one ? 'it did not exist' : 'none of them existed'}, with no measurable overhead.` :
        `${(0, FeatureDocs_1.codeList)(on)} ${1 === on.length ?
            'is **on by default** and runs until you switch it off.' :
            'are **on by default** and run until you switch them off.'}${0 === off ? '' : 1 === off ?
            '\nThe other is **inactive until you switch it on**.' :
            '\nThe others are **inactive until you switch them on**.'}`;
    (0, jostraca_1.Content)(`## Features

This SDK ships ${features.length} optional feature${one ? '' : 's'}.
${state}

Activate a feature by name in the \`feature\` client option:

| Feature | What it does |
|---|---|
`);
    for (const f of features) {
        (0, jostraca_1.Content)(`| [\`${f.name}\`](#${f.name}) | ${f.titleCell} |
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
                (0, jostraca_1.Content)(`| \`${o.name}\` | ${o.code} |
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