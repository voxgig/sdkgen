"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureDocs = featureDocs;
exports.renderValue = renderValue;
exports.sentinelName = sentinelName;
exports.honoursActivationOrder = honoursActivationOrder;
const applicability_1 = require("../helpers/applicability");
const jostraca_1 = require("jostraca");
const types_1 = require("../types");
// `transport` says how a feature attaches, and that is the whole of the
// ordering story:
//   wrap  wraps the transport chain — activation order IS nesting order
//   base  installs the base transport others wrap (test)
//   none  pipeline hooks only; order does not affect it
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
// Every feature the model declares active, in a stable order, with its
// options and their defaults.
// With a target, also drops features that do not APPLY to it: a target
// README must not document a feature that target has no implementation
// for. Without one (the repo-level README) every active feature is listed.
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
            // A name in both is documented by its DEFAULT; `config.optspec`
            // only sharpened its type (netsim's `latency`, a number that is
            // also a { min, max } map), and a reader wants the default.
            .filter((k) => null == opts[k])
            .sort()
            .map((k) => ({ name: k, type: sentinelName(extra[k]) }));
        return {
            name: f.name,
            Name: f.Name || f.name,
            title: f.title || '',
            transport: f.transport || 'none',
            wraps: isWrapping(f),
            options,
            extras,
        };
    })
        .sort((a, b) => a.name.localeCompare(b.name));
}
// Targets that compose transport features in a FIXED catalog order rather
// than the order the caller activates them in.
//
// Every other target derives `__derived__.featureorder` from the options and
// adds features in that order, so an ordered activation list is what fixes
// nesting. lean has no featureorder at all — SdkFeatures.featureNames is a
// fixed array — and its resolveFeatureOpts accepts only a map, silently
// replacing a list with an empty one. Telling a lean reader to activate
// features as an ordered list would therefore disable every feature they
// asked for.
//
// Verify with: grep -rl featureorder tm/<target>
const FIXED_ORDER_TARGETS = ['lean'];
function honoursActivationOrder(target) {
    return !FIXED_ORDER_TARGETS.includes(target?.name);
}
//# sourceMappingURL=FeatureDocs.js.map