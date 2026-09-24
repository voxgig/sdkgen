"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUBLISH_OVERRIDES = exports.ANCHOR_RE = exports.ANCHOR = void 0;
exports.aontuKey = aontuKey;
exports.compileModel = compileModel;
exports.includeLine = includeLine;
exports.publishOverrideProbe = publishOverrideProbe;
exports.slashComments = slashComments;
exports.strictAontu = strictAontu;
exports.unquoted = unquoted;
const aontu_1 = require("aontu");
const node_module_1 = require("node:module");
const node_path_1 = __importDefault(require("node:path"));
const shipped_1 = require("./shipped");
// The provenance anchor. The literal line a shipped definition carries so the
// stamp has somewhere to hang (helpers/stdrep), and therefore the one thing
// a package's definition must not lose.
const ANCHOR = "base: 'BASE'";
exports.ANCHOR = ANCHOR;
const ANCHOR_RE = /^[ \t]*base: 'BASE'[ \t]*$/m;
exports.ANCHOR_RE = ANCHOR_RE;
// An aontu map key that is safe unquoted. Everything else — a hyphen
// (`go-cli`), a dot (`go.v2`), a leading digit (`2go`) — has to be quoted or
// the file does not parse, and the ITEM name grammar admits all three.
const BARE_KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function aontuKey(name) {
    return BARE_KEY_RE.test(name) ? name : "'" + name + "'";
}
function unquoted(line) {
    return line.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '');
}
function code(line) {
    return unquoted(line).split('#')[0];
}
function slashComments(text) {
    const found = [];
    String(text).split('\n').forEach((line, i) => {
        if (/(^|\s)(\/\/|\/\*)/.test(code(line))) {
            found.push({ line: i + 1, text: line.trim() });
        }
    });
    return found;
}
function strictAontu(options) {
    const aontu = new aontu_1.Aontu(options);
    aontu.lang.jsonic.options({ comment: { def: { slash: null, multi: null } } });
    return aontu;
}
// An `@` include line for a path, quoted so a path containing a quote or a
// backslash — a Windows path, or the pathological ones the provenance tests
// exercise — cannot end the string early.
function includeLine(file) {
    return "@'" + String(file).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}
function tidy(msg) {
    const lines = String(msg)
        .replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", 'g'), '')
        .split('\n');
    const cut = lines.findIndex((l) => /^\s*-->/.test(l));
    return (cut < 0 ? lines : lines.slice(0, cut))
        .map((l) => l.trim())
        .filter((l) => '' !== l)
        .join(' ');
}
function compileModel(src, path, opts) {
    const errs = [];
    const text = true === opts?.schema ?
        includeLine((0, shipped_1.schemaFile)()) + '\n' + src : src;
    try {
        const localRequire = Object.assign((0, node_module_1.createRequire)(node_path_1.default.resolve(path)), { main: require.main });
        const options = { require: localRequire };
        const aontu = false === opts?.strict ? new aontu_1.Aontu(options) : strictAontu(options);
        const model = aontu.generate(text, { path, errs });
        return {
            model,
            errors: errs.map((e) => tidy((null == e.why ? '' : '[' + e.why + '] ') + (e.msg ?? String(e)))),
            why: whyOf(errs),
        };
    }
    catch (err) {
        return {
            errors: [tidy(err.message ?? String(err))],
            why: whyOf('function' === typeof err?.errs ? err.errs() : []),
        };
    }
}
function whyOf(errs) {
    return errs.map((e) => e?.why).filter((w) => 'string' === typeof w);
}
const PUBLISH_OVERRIDES = [
    ['publish: version', "'9.9.9'", "'8.8.8'"],
    ['publish: tag: active', 'false', 'true'],
    ['publish: registry: state', "'active'", "'inactive'"],
    ['publish: registry: active', 'true', 'false'],
    ['publish: registry: package', "'@acme/pinned'", "'@acme/other'"],
];
exports.PUBLISH_OVERRIDES = PUBLISH_OVERRIDES;
// The probe: unify the target model with a project that sets each of them,
// once per sentinel set. EITHER conflicting means the key is pinned.
function publishOverrideProbe(src, path, tname) {
    const key = aontuKey(tname);
    const run = (pick) => compileModel([src, ...PUBLISH_OVERRIDES.map((o) => 'main: kit: target: ' + key + ': ' + o[0] + ': ' + pick(o))]
        .join('\n'), path);
    const first = run((o) => o[1]);
    const second = run((o) => o[2]);
    return {
        model: first.model ?? second.model,
        errors: [...first.errors, ...second.errors],
        why: [...first.why, ...second.why],
    };
}
//# sourceMappingURL=modelcheck.js.map