"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Changelog = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const facts_1 = require("../helpers/facts");
const packageMeta_1 = require("../helpers/packageMeta");
const surface_1 = require("../helpers/surface");
const text_1 = require("../helpers/text");
const types_1 = require("../types");
// "TypeScript and Python, plus CLI and MCP surfaces": the SDK languages, then
// every other surface the project generates.
function releaseScope(targets) {
    const langs = targets.filter((t) => 'sdk' === (0, surface_1.surfaceOf)(t))
        .map((t) => (0, facts_1.fact)(t, 'title'));
    const others = [...new Set(targets.map((t) => (0, surface_1.surfaceOf)(t))
            .filter((surface) => '' !== surface && 'sdk' !== surface))]
        .map((surface) => surface_1.SURFACE_WORD[surface]);
    const surfaces = 0 === others.length ? '' : 1 === others.length ?
        'the ' + others[0] + ' surface' : (0, text_1.seriesList)(others) + ' surfaces';
    return 0 === langs.length ? surfaces :
        (0, text_1.seriesList)(langs) + ('' === surfaces ? '' : ', plus ' + surfaces);
}
// Breaks a list item at the width of the rest of the file.
function listItem(text, width = 76) {
    const lines = [];
    let line = '-';
    for (const word of text.split(' ')) {
        if (2 < line.length && width < line.length + 1 + word.length) {
            lines.push(line);
            line = ' ';
        }
        line += ' ' + word;
    }
    return [...lines, line].join('\n');
}
const Changelog = (0, component_1.cmp)(function Changelog(props) {
    const { ctx$ } = props;
    const { model } = ctx$;
    const name = model.Name || model.name;
    const targets = (0, surface_1.documentOrder)(model, (0, jostraca_1.each)((0, types_1.getModelPath)(model, `main.${types_1.KIT}.target`, { required: false }) || {})
        .filter((t) => false !== t.active));
    // Written once, so the first entry is the version the targets start at; a
    // heading with no number when they start at different ones.
    const versions = new Set();
    targets.forEach((t) => versions.add((0, packageMeta_1.packageVersion)(model, t.name)));
    const first = 1 < versions.size ? 'Initial release' :
        `[${[...versions][0] || (0, packageMeta_1.packageVersion)(model, '')}]`;
    const scope = releaseScope(targets);
    const definition = (0, text_1.definitionName)((0, facts_1.fact)(model.main[types_1.KIT], 'definitionKind'), true);
    (0, jostraca_1.File)({ name: 'CHANGELOG.md', exclude: true }, () => {
        (0, jostraca_1.Content)(`# Changelog

All notable changes to the generated ${name} SDK are documented here.
This project follows [Keep a Changelog](https://keepachangelog.com) and
[Semantic Versioning](https://semver.org).

## [Unreleased]

## ${first}

${listItem('Initial generated release of the ' + name + ' SDK' +
            ('' === scope ? '' : ' (' + scope + ')') +
            ', generated from the upstream ' + definition + ' by @voxgig/sdkgen.')}
`);
    });
});
exports.Changelog = Changelog;
//# sourceMappingURL=Changelog.js.map