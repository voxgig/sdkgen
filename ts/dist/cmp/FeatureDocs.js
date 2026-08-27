"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureDocs = featureDocs;
exports.renderValue = renderValue;
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
function featureDocs(model) {
    const feature = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.feature`);
    return (0, jostraca_1.each)(feature)
        .filter((f) => false !== f.active && 'base' !== f.name)
        .map((f) => {
        const opts = (f.config && f.config.options) || {};
        const options = Object.keys(opts).sort().map((k) => ({
            name: k,
            value: renderValue(opts[k]),
        }));
        return {
            name: f.name,
            Name: f.Name || f.name,
            title: f.title || '',
            transport: f.transport || 'none',
            wraps: isWrapping(f),
            options,
        };
    })
        .sort((a, b) => a.name.localeCompare(b.name));
}
//# sourceMappingURL=FeatureDocs.js.map