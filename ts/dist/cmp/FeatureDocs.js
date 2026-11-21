"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sentinelName = exports.renderValue = void 0;
exports.featureDocs = featureDocs;
exports.codeList = codeList;
exports.honoursActivationOrder = honoursActivationOrder;
const applicability_1 = require("../helpers/applicability");
const facts_1 = require("../helpers/facts");
const doctext_1 = require("../helpers/doctext");
Object.defineProperty(exports, "renderValue", { enumerable: true, get: function () { return doctext_1.renderValue; } });
Object.defineProperty(exports, "sentinelName", { enumerable: true, get: function () { return doctext_1.sentinelName; } });
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
function isWrapping(feat) {
    return 'wrap' === feat.transport;
}
function featureDocs(model, target) {
    const feature = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.feature`);
    return (0, jostraca_1.each)(feature)
        .filter((f) => false !== f.active && 'base' !== f.name)
        .filter((f) => null == target || (0, applicability_1.featureApplies)(f, target))
        .map((f) => {
        const opts = (f.config && f.config.options) || {};
        const options = Object.keys(opts).sort().map((k) => ({
            name: k,
            value: (0, doctext_1.renderValue)(opts[k]),
        }));
        const extra = (f.config && f.config.optspec) || {};
        const extras = Object.keys(extra)
            .filter((k) => null == opts[k])
            .sort()
            .map((k) => ({ name: k, type: (0, doctext_1.sentinelName)(extra[k]) }));
        return {
            name: f.name,
            Name: f.Name || f.name,
            title: f.title || '',
            transport: f.transport || 'none',
            wraps: isWrapping(f),
            on: true === (0, facts_1.fact)(f, 'on'),
            hooks: Object.keys(f.hook || {}).filter((h) => true === f.hook[h]?.active).sort(),
            options,
            extras,
        };
    })
        .sort((a, b) => a.name.localeCompare(b.name));
}
// `a`, `a` and `b`, `a`, `b` and `c`.
function codeList(names) {
    const code = names.map((n) => '`' + n + '`');
    return code.length < 2 ? code.join('') :
        code.slice(0, -1).join(', ') + ' and ' + code[code.length - 1];
}
const FIXED_ORDER_TARGETS = ['lean'];
function honoursActivationOrder(target) {
    return !FIXED_ORDER_TARGETS.includes(target?.name);
}
//# sourceMappingURL=FeatureDocs.js.map