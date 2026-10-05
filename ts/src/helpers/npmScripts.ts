
// npm runs a script through sh on POSIX and cmd.exe on Windows, which has no
// single quotes, sh variable expansion, inline assignment or `rm`. These say
// the same things through node itself, inside double quotes neither shell
// expands.

function npmScriptRm(paths: string[]): string {
  return 'node -e "for (const p of process.argv.slice(1)) ' +
    'require(\'fs\').rmSync(p, { recursive: true, force: true })" ' + paths.join(' ')
}


function npmScriptEnv(name: string, value: string): string {
  return `--import "data:text/javascript,process.env.${name}='${value}'"`
}


// The pattern comes from `npm run test-some --pattern=<regexp>`, or from
// TEST_PATTERN; without one, every test runs.
function npmScriptTestSome(nodeArgs: string[], glob: string): string {
  const args = [
    ...nodeArgs.map((arg) => `'${arg}'`),
    '...(p ? [\'--test-name-pattern=\' + p] : [])',
    '\'--test\'',
    `'${glob}'`,
  ]
  return 'node -e "const p = process.env.npm_config_pattern || process.env.TEST_PATTERN; ' +
    'const r = require(\'child_process\').spawnSync(process.execPath, [' + args.join(', ') +
    '], { stdio: \'inherit\' }); process.exit(r.status ?? 1)"'
}


export {
  npmScriptRm,
  npmScriptEnv,
  npmScriptTestSome,
}
