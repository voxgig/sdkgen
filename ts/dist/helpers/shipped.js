"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.packageRoot = packageRoot;
exports.schemaFile = schemaFile;
exports.scaffoldFolder = scaffoldFolder;
const node_path_1 = __importDefault(require("node:path"));
function packageRoot() {
    return node_path_1.default.resolve(__dirname, '..', '..');
}
function schemaFile() {
    return node_path_1.default.join(packageRoot(), 'model', 'sdkgen.aontu');
}
// The bundled scaffold — the `.sdk` of `ts/project`, which is itself an
// sdkgen package.
function scaffoldFolder() {
    return node_path_1.default.join(packageRoot(), 'project', '.sdk');
}
//# sourceMappingURL=shipped.js.map