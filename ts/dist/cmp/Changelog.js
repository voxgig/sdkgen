"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Changelog = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const packageMeta_1 = require("../helpers/packageMeta");
const types_1 = require("../types");
const Changelog = (0, component_1.cmp)(function Changelog(props) {
    const { ctx$ } = props;
    const { model } = ctx$;
    const name = model.Name || model.name;
    // Written once, so the first entry is the version the targets start at; a
    // heading with no number when they start at different ones.
    const versions = new Set();
    (0, jostraca_1.each)((0, types_1.getModelPath)(model, `main.${types_1.KIT}.target`) || {}, (t) => {
        if (false !== t.active)
            versions.add((0, packageMeta_1.packageVersion)(model, t.name));
    });
    const first = 1 < versions.size ? 'Initial release' :
        `[${[...versions][0] || (0, packageMeta_1.packageVersion)(model, '')}]`;
    (0, jostraca_1.File)({ name: 'CHANGELOG.md', exclude: true }, () => {
        (0, jostraca_1.Content)(`# Changelog

All notable changes to the generated ${name} SDK are documented here.
This project follows [Keep a Changelog](https://keepachangelog.com) and
[Semantic Versioning](https://semver.org).

## [Unreleased]

## ${first}

- Initial generated release of the ${name} SDK (TypeScript, Python, PHP, Go,
  Ruby, and Lua, plus CLI and MCP surfaces), generated from the upstream
  OpenAPI specification by @voxgig/sdkgen.
`);
    });
});
exports.Changelog = Changelog;
//# sourceMappingURL=Changelog.js.map