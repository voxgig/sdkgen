"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Feature = void 0;
const jostraca_1 = require("jostraca");
const Feature = (0, jostraca_1.cmp)(function Feature(props) {
    const { target, feature, ctx$ } = props;
    (0, jostraca_1.Folder)({ name: 'src/' + feature.name }, () => {
        // TODO: Copy should just warn if from not found
        // Copy({ from: 'feature/' + feature.name + '/' + target.name })
    });
});
exports.Feature = Feature;
//# sourceMappingURL=Feature.js.map