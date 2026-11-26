"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeQuick = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const types_1 = require("../types");
const utility_1 = require("../utility");
const optional_1 = require("../helpers/optional");
const opShape_1 = require("../helpers/opShape");
const text_1 = require("../helpers/text");
const ReadmeQuick = (0, component_1.cmp)(function ReadmeQuick(props) {
    const { target, ctx$ } = props;
    const placement = (0, utility_1.credentialPlacement)(ctx$.model);
    // The entity each language's quick start takes: the first active one.
    const entity = Object.values((0, types_1.getModelPath)(ctx$.model, `main.${types_1.KIT}.entity`, { required: false }) || {})
        .find((e) => e && e.active !== false);
    const ops = null == entity ? [] : (0, opShape_1.entityOps)(entity);
    (0, jostraca_1.Content)(`
## Tutorial: your first API call

This tutorial walks through ${(0, text_1.seriesList)(['creating a client',
        ...(ops.includes('list') ? ['listing entities'] : []),
        ...(ops.includes('load') ? ['loading a specific record'] : [])])}.${'' === placement ? '' : ' ' + placement}

`);
    const ReadmeQuick_sdk = (0, optional_1.optionalComponent)(ctx$, target, 'ReadmeQuick');
    if (ReadmeQuick_sdk) {
        ReadmeQuick_sdk['ReadmeQuick']({ target });
    }
});
exports.ReadmeQuick = ReadmeQuick;
//# sourceMappingURL=ReadmeQuick.js.map