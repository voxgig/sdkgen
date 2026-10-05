"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeQuick = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const optional_1 = require("../helpers/optional");
const ReadmeQuick = (0, component_1.cmp)(function ReadmeQuick(props) {
    const { target, ctx$ } = props;
    (0, jostraca_1.Content)(`
## Tutorial: your first API call

This tutorial walks through creating a client, listing entities, and
loading a specific record.

`);
    const ReadmeQuick_sdk = (0, optional_1.optionalComponent)(ctx$, target, 'ReadmeQuick');
    if (ReadmeQuick_sdk) {
        ReadmeQuick_sdk['ReadmeQuick']({ target });
    }
});
exports.ReadmeQuick = ReadmeQuick;
//# sourceMappingURL=ReadmeQuick.js.map