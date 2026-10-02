import Fs from 'node:fs'
import Path from 'node:path'


// The parts of the running process that decide how npm is run.
type NpmHost = {
  platform: string
  env: Record<string, string | undefined>
  execPath: string
  exists: (path: string) => boolean
}

type NpmCommand = {
  file: string
  args: string[]
}


const PROCESS_HOST: NpmHost = {
  platform: process.platform,
  env: process.env,
  execPath: process.execPath,
  exists: (path: string) => Fs.existsSync(path),
}


// On Windows npm and npx are batch files, which node spawns only through a
// shell that re-parses every argument. Their JS entries run under this node
// instead, so no shell starts and each argument reaches npm as given.
function npmCommand(
  tool: 'npm' | 'npx', args: string[], host: NpmHost = PROCESS_HOST,
): NpmCommand {
  if ('win32' !== host.platform) {
    return { file: tool, args }
  }

  const cli = npmCli(host)
  const entry = 'npm' === tool ? cli : Path.win32.join(Path.win32.dirname(cli), 'npx-cli.js')
  return { file: host.execPath, args: [entry, ...args] }
}


// npm sets npm_execpath to its own npm-cli.js; yarn and pnpm set it to theirs.
function npmCli(host: NpmHost): string {
  const launcher = host.env.npm_execpath
  const candidates = [
    ...('string' === typeof launcher && 'npm-cli.js' === Path.win32.basename(launcher)
      ? [launcher] : []),
    Path.win32.join(Path.win32.dirname(host.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ]

  const found = candidates.find((path) => host.exists(path))
  if (null == found) {
    throw new Error('npm-cli.js was not found (looked for ' + candidates.join(', ') +
      '), so npm cannot be run without a shell')
  }
  return found
}


export type {
  NpmCommand,
  NpmHost,
}

export {
  npmCommand,
}
