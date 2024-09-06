"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePath = void 0;
const node_path_1 = __importDefault(require("node:path"));
const resolvePath = (ctx$, path) => {
    const fullpath = node_path_1.default.join(ctx$.folder, '..', 'dist', path);
    return fullpath;
};
exports.resolvePath = resolvePath;
//# sourceMappingURL=utility.js.map