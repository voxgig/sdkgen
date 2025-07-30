"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SdkGenError = void 0;
exports.resolvePath = resolvePath;
exports.requirePath = requirePath;
const node_path_1 = __importDefault(require("node:path"));
function resolvePath(ctx$, path) {
    const fullpath = node_path_1.default.join(ctx$.folder, '.sdk', 'dist', path);
    return fullpath;
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