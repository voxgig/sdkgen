"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureHook = void 0;
const jostraca_1 = require("jostraca");
const FeatureHook = (0, jostraca_1.cmp)(function FeatureHook(props, children) {
    const { ctx$: { model } } = props;
    const { feature } = model.main.sdk;
    const hook = {};
    (0, jostraca_1.names)(hook, props.name);
    // TODO: much better error reporting for invalid feature hook names
    (0, jostraca_1.each)(feature)
        // .map(feature => (console.log(props.name, feature), feature))
        .filter(feature => feature.active && feature.hook[props.name].active)
        .map(feature => (0, jostraca_1.each)(children, { call: true, args: feature }));
});
exports.FeatureHook = FeatureHook;
//# sourceMappingURL=FeatureHook.js.map