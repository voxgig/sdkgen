"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SdkGenError = exports.requirePath = exports.resolvePath = void 0;
const node_path_1 = __importDefault(require("node:path"));
// TODO: move to @voxgig/util as duplicated with @voxgig/sdkgen
const resolvePath = (ctx$, path) => {
    const fullpath = node_path_1.default.join(ctx$.folder, '.sdk', 'dist', path);
    return fullpath;
};
exports.resolvePath = resolvePath;
const requirePath = (ctx$, path, flags) => {
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
};
exports.requirePath = requirePath;
class SdkGenError extends Error {
    constructor(...args) {
        super(...args);
        this.name = 'SdkGenError';
    }
}
exports.SdkGenError = SdkGenError;
//# sourceMappingURL=utility.js.map