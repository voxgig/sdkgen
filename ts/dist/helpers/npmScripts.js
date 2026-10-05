"use strict";
// npm runs a script through sh on POSIX and cmd.exe on Windows, which has no
// single quotes, sh variable expansion, inline assignment or `rm`. These say
// the same things through node itself, inside double quotes neither shell
// expands.
Object.defineProperty(exports, "__esModule", { value: true });
exports.npmScriptRm = npmScriptRm;
exports.npmScriptEnv = npmScriptEnv;
exports.npmScriptTestSome = npmScriptTestSome;
function npmScriptRm(paths) {
    return 'node -e "for (const p of process.argv.slice(1)) ' +
        'require(\'fs\').rmSync(p, { recursive: true, force: true })" ' + paths.join(' ');
}
function npmScriptEnv(name, value) {
    return `--import "data:text/javascript,process.env.${name}='${value}'"`;
}
// The pattern comes from `npm run test-some --pattern=<regexp>`, or from
// TEST_PATTERN; without one, every test runs.
function npmScriptTestSome(nodeArgs, glob) {
    const args = [
        ...nodeArgs.map((arg) => `'${arg}'`),
        '...(p ? [\'--test-name-pattern=\' + p] : [])',
        '\'--test\'',
        `'${glob}'`,
    ];
    return 'node -e "const p = process.env.npm_config_pattern || process.env.TEST_PATTERN; ' +
        'const r = require(\'child_process\').spawnSync(process.execPath, [' + args.join(', ') +
        '], { stdio: \'inherit\' }); process.exit(r.status ?? 1)"';
}
//# sourceMappingURL=npmScripts.js.map