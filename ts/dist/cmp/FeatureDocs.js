"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureDocs = featureDocs;
exports.codeList = codeList;
exports.renderValue = renderValue;
exports.sentinelName = sentinelName;
exports.honoursActivationOrder = honoursActivationOrder;
const applicability_1 = require("../helpers/applicability");
const facts_1 = require("../helpers/facts");
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
function isWrapping(feat) {
    return 'wrap' === feat.transport;
}
// A struct.validate sentinel as a reader's word for it: '`$FUNCTION`' ->
// 'function'. A union renders its members, so netsim's latency reads
// 'number | map'. Anything unrecognised renders verbatim rather than being
// dropped — a doc table that silently omits an option is the failure this
// whole path exists to fix.
function sentinelName(v) {
    if (Array.isArray(v)) {
        const members = v.slice(1).map((m) => sentinelName(m))
            .filter((m) => 'one' !== m);
        return 0 === members.length ? 'any' : members.join(' | ');
    }
    if ('string' !== typeof v) {
        return 'any';
    }
    const bare = v.replace(/[`$]/g, '').trim().toLowerCase();
    return '' === bare ? 'any' : bare;
}
function renderValue(v) {
    if (null == v) {
        return '';
    }
    if (Array.isArray(v)) {
        return '[' + v.map((x) => renderValue(x)).join(', ') + ']';
    }
    if ('object' === typeof v) {
        const keys = Object.keys(v);
        return 0 === keys.length ? '{}' :
            '{' + keys.map((k) => k + ': ' + renderValue(v[k])).join(', ') + '}';
    }
    if ('string' === typeof v) {
        return `'${v}'`;
    }
    return String(v);
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
            value: renderValue(opts[k]),
        }));
        const extra = (f.config && f.config.optspec) || {};
        const extras = Object.keys(extra)
            .filter((k) => null == opts[k])
            .sort()
            .map((k) => ({ name: k, type: sentinelName(extra[k]) }));
        return {
            name: f.name,
            Name: f.Name || f.name,
            title: f.title || '',
            transport: f.transport || 'none',
            wraps: isWrapping(f),
            on: true === (0, facts_1.fact)(f, 'on'),
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