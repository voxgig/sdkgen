"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readOverride = readOverride;
exports.runOutput = runOutput;
exports.runPlace = runPlace;
exports.runFolder = runFolder;
const node_path_1 = __importDefault(require("node:path"));
const utility_1 = require("../utility");
// The run override for each target: the `external` build option, with
// SDKGEN_EXTERNAL merged over it. `named` lists the targets the variable names.
function readOverride(declared, raw, targets) {
    const base = declared || {};
    if (null == raw || '' === raw.trim()) {
        return { override: base, named: [] };
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (err) {
        throw new utility_1.SdkGenError('SDKGEN_EXTERNAL is not valid JSON: ' + (err?.message || err) +
            '\n  Expected an object keyed by item name, for example:' +
            '\n    {"seneca-provider":{"path":"../..","sdkrel":".sdksrc/acme-sdk","enclosing":true}}' +
            '\n  Got: ' + raw.slice(0, 200));
    }
    if (null == parsed || 'object' !== typeof parsed || Array.isArray(parsed)) {
        throw new utility_1.SdkGenError('SDKGEN_EXTERNAL must be a JSON OBJECT keyed by item name, for example:' +
            '\n    {"seneca-provider":{"path":"../..","sdkrel":".sdksrc/acme-sdk","enclosing":true}}' +
            '\n  Got: ' + raw.slice(0, 200));
    }
    // A misspelled name would otherwise change nothing and still be logged as
    // an override.
    const unknown = Object.keys(parsed).filter((name) => !targets.includes(name)).sort();
    if (0 < unknown.length) {
        throw new utility_1.SdkGenError('SDKGEN_EXTERNAL names ' + unknown.join(', ') + ', which ' +
            (1 === unknown.length ? 'is not a target' : 'are not targets') + ' of this model' +
            '\n  Its targets are: ' + [...targets].sort().join(', '));
    }
    const override = { ...base };
    for (const name of Object.keys(parsed)) {
        override[name] = { ...(base[name] || {}), ...(parsed[name] || {}) };
    }
    return { override, named: Object.keys(parsed).sort() };
}
// A target's output for this run, as a shallow copy: the override's path
// replaces the declared one, root placement included.
function runOutput(output, ov) {
    const out = { ...(output || {}) };
    if (null != ov?.path && '' !== ov.path) {
        out.path = ov.path;
        delete out.root;
    }
    if (null != ov?.sdkrel && '' !== ov.sdkrel) {
        out.sdkrel = ov.sdkrel;
    }
    return out;
}
// Where this run writes a target: the override's path, else the place fact
// of a prepared model. A target with no `output` claims no place: in tree.
function runPlace(target, ov) {
    if (null != ov?.path && '' !== ov.path) {
        return 'external';
    }
    const place = target?.fact?.place;
    return 'root' === place || 'external' === place ? place : 'folder';
}
function runFolder(target, name, project, ov) {
    const place = runPlace(target, ov);
    return 'root' === place ? node_path_1.default.resolve(project) :
        'external' === place ? node_path_1.default.resolve(project, String(runOutput(target?.output, ov).path)) :
            node_path_1.default.resolve(project, name);
}
//# sourceMappingURL=placement.js.map