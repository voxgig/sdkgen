"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG_REPR_VALUES = exports.CONFIG_DATA_THRESHOLD = exports.SdkGenError = void 0;
exports.resolvePath = resolvePath;
exports.requirePath = requirePath;
exports.isAuthActive = isAuthActive;
exports.resolveAuthPrefix = resolveAuthPrefix;
exports.isConfigData = isConfigData;
exports.configRepr = configRepr;
const node_path_1 = __importDefault(require("node:path"));
const apidef_1 = require("@voxgig/apidef");
// Where a per-target component is loaded from: `<project>/.sdk/dist/<path>`.
//
// `ctx$.folder` is jostraca's OUTPUT folder, which is the project for an
// ordinary target but the destination repo for one generating out of tree
// (`output: path`). Components always live in the project that owns the
// model, never in the place its files land, so an external pass sets
// `ctx$.cmpfolder` and this prefers it. Without that, generating out of tree
// looks for `<destination>/.sdk/dist/cmp/...` and fails to resolve.
function resolvePath(ctx$, path) {
    const base = null == ctx$.cmpfolder ? ctx$.folder : ctx$.cmpfolder;
    const fullpath = node_path_1.default.join(base, '.sdk', 'dist', path);
    return fullpath;
}
// True unless the model declares auth off. Templates use this to gate
// apikey-related code, docs, and examples for public APIs that need no
// authentication. Two opt-outs, in priority order:
//   1. main.kit.info.auth: false        (user-facing, set in api-info.aontu)
//   2. main.kit.config.auth.active: false
function isAuthActive(model) {
    const info = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.info`, { only_active: false, required: false });
    if (info && false === info.auth)
        return false;
    const auth = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.config.auth`, { only_active: false, required: false });
    return null == auth || false !== auth.active;
}
// The credential prefix for the Authorization header value, resolved in
// priority order:
//   1. main.kit.config.auth.prefix   (per-SDK user override)
//   2. main.kit.info.security.prefix (spec-derived, set by apidef from the
//      API's securityScheme — e.g. 'OAuth' for Statuspage)
//   3. 'Bearer'                      (conventional fallback)
// '' is a valid resolved value: it means a raw credential with no prefix
// (e.g. an apiKey scheme in a custom header). Config generators for every
// language target must use this instead of hardcoding 'Bearer'.
function resolveAuthPrefix(model) {
    const auth = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.config.auth`, { only_active: false, required: false });
    if (null != auth && null != auth.prefix)
        return String(auth.prefix);
    const security = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.info.security`, { only_active: false, required: false });
    if (null != security && null != security.prefix)
        return String(security.prefix);
    return 'Bearer';
}
function requirePath(ctx$, path, flags) {
    const fullpath = resolvePath(ctx$, path);
    const ignore = null == flags?.ignore ? false : flags.ignore;
    // When `ignore` is set, only swallow a genuine "module not found"
    // resolution failure. A module that resolves but throws while loading
    // (syntax error, runtime bug, or a missing *nested* dependency) must
    // propagate — otherwise the optional component silently renders nothing
    // and the real failure is invisible.
    if (ignore) {
        try {
            require.resolve(fullpath);
        }
        catch (err) {
            ctx$.log.warn({ point: 'require-missing', path, note: path });
            return undefined;
        }
    }
    return require(fullpath);
}
class SdkGenError extends Error {
    constructor(...args) {
        super(...args);
        this.name = 'SdkGenError';
    }
}
exports.SdkGenError = SdkGenError;
// CONFIG REPRESENTATION (design rung L1, threshold from design Q7).
//
// Above a size threshold the API model is emitted as DATA - a JSON string
// constant parsed once - rather than as a composite literal. Below it the
// literal stays, because for a small model the literal is smaller, simpler,
// faster to load and far easier to debug, and a symbol table would be pure
// complexity.
//
// The threshold is on the JSON, not the emitted source, because the emitted
// source size varies by language while the model does not. It is measured in
// UTF-8 BYTES rather than string length: `.length` counts UTF-16 code units,
// so a CJK-heavy model would read as roughly a third of its real size and
// stay on the expensive literal path well past the point where it hurts.
//
// Measured on the real gitlab model (923.5 KB of JSON), Go, cold cache,
// recompiling only the config package:
//
//                       composite literal   JSON string constant
//   compile+link wall        30.80 s              0.34 s     91x faster
//   peak compiler RSS         2.49 GB             0.06 GB    39x less
//   binary                    7.44 MB             3.51 MB    2.1x smaller
//
// The reader side is unchanged either way: make_config returns the same map,
// so nothing downstream can tell which representation it got.
const CONFIG_DATA_THRESHOLD = 256 * 1024;
exports.CONFIG_DATA_THRESHOLD = CONFIG_DATA_THRESHOLD;
// Should this model be emitted as data rather than as a literal?
//
// `repr` is the per-SDK override from `main.kit.config.repr`: 'auto' (the
// default) decides by size, 'data' and 'literal' pin it. The override is what
// lets a small fixture exercise the data path - by size alone no test model
// comes near the threshold, so the branch every large SDK depends on would
// never be generated, compiled or run in CI.
const CONFIG_REPR_VALUES = ['auto', 'data', 'literal'];
exports.CONFIG_REPR_VALUES = CONFIG_REPR_VALUES;
function isConfigData(configJson, repr) {
    // An unknown value is REJECTED, not ignored. The aontu declaration
    // documents the closed set but does not enforce it here, and silently
    // treating `repr: 'date'` as `auto` would quietly restore the compile cost
    // this exists to remove - the failure mode being a slow build nobody
    // connects to a typo.
    if (null != repr && '' !== repr && !CONFIG_REPR_VALUES.includes(repr)) {
        throw new SdkGenError('sdkgen: main.kit.config.repr must be one of ' +
            CONFIG_REPR_VALUES.join(', ') + ' (got: ' + repr + ')', {});
    }
    if ('data' === repr) {
        return true;
    }
    if ('literal' === repr) {
        return false;
    }
    return CONFIG_DATA_THRESHOLD < Buffer.byteLength(configJson, 'utf8');
}
// The chosen representation, as a word - for generation logs and for the
// per-SDK reporting the fleet regen needs, so a model crossing the threshold
// is visible rather than showing up as an unexplained whole-file diff.
function configRepr(configJson, repr) {
    return isConfigData(configJson, repr) ? 'data' : 'literal';
}
//# sourceMappingURL=utility.js.map