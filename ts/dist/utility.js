"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SdkGenError = void 0;
exports.resolvePath = resolvePath;
exports.requirePath = requirePath;
exports.isAuthActive = isAuthActive;
exports.resolveAuthPrefix = resolveAuthPrefix;
const node_path_1 = __importDefault(require("node:path"));
const apidef_1 = require("@voxgig/apidef");
function resolvePath(ctx$, path) {
    const fullpath = node_path_1.default.join(ctx$.folder, '.sdk', 'dist', path);
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
//# sourceMappingURL=utility.js.map