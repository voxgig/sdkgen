"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureHook = void 0;
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
const FeatureHook = (0, jostraca_1.cmp)(function FeatureHook(props, children) {
    const { ctx$: { model } } = props;
    const feature = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.feature`);
    // A feature need not implement every pipeline stage; only fire the hook
    // for features that declare it as active. Optional chaining guards
    // features whose `hook` map omits this stage entirely.
    (0, jostraca_1.each)(feature)
        .filter(feature => feature.active && feature.hook?.[props.name]?.active)
        .forEach(feature => (0, jostraca_1.each)(children, { call: true, args: feature }));
});
exports.FeatureHook = FeatureHook;
//# sourceMappingURL=FeatureHook.js.map