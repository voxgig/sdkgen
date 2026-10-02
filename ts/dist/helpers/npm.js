"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.npmCommand = npmCommand;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const PROCESS_HOST = {
    platform: process.platform,
    env: process.env,
    execPath: process.execPath,
    exists: (path) => node_fs_1.default.existsSync(path),
};
// On Windows npm and npx are batch files, which node spawns only through a
// shell that re-parses every argument. Their JS entries run under this node
// instead, so no shell starts and each argument reaches npm as given.
function npmCommand(tool, args, host = PROCESS_HOST) {
    if ('win32' !== host.platform) {
        return { file: tool, args };
    }
    const cli = npmCli(host);
    const entry = 'npm' === tool ? cli : node_path_1.default.win32.join(node_path_1.default.win32.dirname(cli), 'npx-cli.js');
    return { file: host.execPath, args: [entry, ...args] };
}
// npm sets npm_execpath to its own npm-cli.js; yarn and pnpm set it to theirs.
function npmCli(host) {
    const launcher = host.env.npm_execpath;
    const candidates = [
        ...('string' === typeof launcher && 'npm-cli.js' === node_path_1.default.win32.basename(launcher)
            ? [launcher] : []),
        node_path_1.default.win32.join(node_path_1.default.win32.dirname(host.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    ];
    const found = candidates.find((path) => host.exists(path));
    if (null == found) {
        throw new Error('npm-cli.js was not found (looked for ' + candidates.join(', ') +
            '), so npm cannot be run without a shell');
    }
    return found;
}
//# sourceMappingURL=npm.js.map