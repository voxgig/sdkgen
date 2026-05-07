"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SdkGenError = void 0;
exports.resolvePath = resolvePath;
exports.requirePath = requirePath;
exports.isAuthActive = isAuthActive;
const node_path_1 = __importDefault(require("node:path"));
const apidef_1 = require("@voxgig/apidef");
function resolvePath(ctx$, path) {
    const fullpath = node_path_1.default.join(ctx$.folder, '.sdk', 'dist', path);
    return fullpath;
}
// True unless the model explicitly declares main.kit.config.auth.active: false.
// Used by templates to gate apikey-related code, docs, and examples for
// public APIs that need no authentication.
function isAuthActive(model) {
    const auth = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.config.auth`, { only_active: false, required: false });
    return null == auth || false !== auth.active;
}
function requirePath(ctx$, path, flags) {
    const fullpath = resolvePath(ctx$, path);
    const ignore = null == flags?.ignore ? false : flags.ignore;
    try {
        return require(fullpath);
    }
    catch (err) {
        if (ignore) {
            ctx$.log.warn({ point: 'require-missing', path, note: path });
        }
        else {
            throw err;
        }
    }
}
class SdkGenError extends Error {
    constructor(...args) {
        super(...args);
        this.name = 'SdkGenError';
    }
}
exports.SdkGenError = SdkGenError;
//# sourceMappingURL=utility.js.map