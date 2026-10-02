/* Copyright (c) 2026 Voxgig Ltd, MIT License */

import { test, describe } from 'node:test'
import { deepStrictEqual, match, strictEqual, throws } from 'node:assert'

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import Path from 'node:path'

import { npmCommand } from '../dist/helpers/npm'
import type { NpmHost } from '../dist/helpers/npm'
import { npmFetchArgs, npmFetchCommand } from '../dist/action/package'


const NODE = 'C:\\Program Files\\nodejs\\node.exe'
const BUNDLED = 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js'
const LAUNCHER = 'C:\\Users\\dev\\AppData\\Roaming\\npm\\node_modules\\npm\\bin\\npm-cli.js'


function windows(env: Record<string, string>, present: string[]): NpmHost {
  return { platform: 'win32', env, execPath: NODE, exists: (p) => present.includes(p) }
}


describe('npm command', () => {

  test('elsewhere npm is spawned by name, with the arguments untouched', () => {
    const host: NpmHost = {
      platform: 'linux', env: {}, execPath: '/usr/bin/node', exists: () => false,
    }
    deepStrictEqual(npmCommand('npm', ['install', 'a@latest'], host),
      { file: 'npm', args: ['install', 'a@latest'] })
    deepStrictEqual(npmCommand('npx', ['--yes', 'npm@latest'], { ...host, platform: 'darwin' }),
      { file: 'npx', args: ['--yes', 'npm@latest'] })
  })


  test('on windows the fetch runs npm-cli.js under node, with no batch file', () => {
    deepStrictEqual(npmFetchCommand('@voxgig/sdkgen', windows({}, [BUNDLED])), {
      file: NODE,
      args: [BUNDLED, ...npmFetchArgs('@voxgig/sdkgen')],
    })
  })


  test('on windows the npm that launched the process is preferred', () => {
    deepStrictEqual(
      npmCommand('npm', ['install'], windows({ npm_execpath: LAUNCHER }, [LAUNCHER, BUNDLED])),
      { file: NODE, args: [LAUNCHER, 'install'] })
    deepStrictEqual(
      npmCommand('npx', ['--yes', 'npm@latest'], windows({ npm_execpath: LAUNCHER }, [LAUNCHER])),
      {
        file: NODE,
        args: ['C:\\Users\\dev\\AppData\\Roaming\\npm\\node_modules\\npm\\bin\\npx-cli.js',
          '--yes', 'npm@latest'],
      })
  })


  test('on windows a launcher that is not npm is passed over', () => {
    for (const other of [
      'C:\\Users\\dev\\AppData\\Roaming\\npm\\node_modules\\yarn\\bin\\yarn.js',
      'C:\\Users\\dev\\AppData\\Local\\pnpm\\pnpm.cjs',
      'C:\\Users\\dev\\AppData\\Roaming\\npm\\node_modules\\npm\\bin\\npx-cli.js',
    ]) {
      deepStrictEqual(
        npmCommand('npm', ['install'], windows({ npm_execpath: other }, [other, BUNDLED])),
        { file: NODE, args: [BUNDLED, 'install'] }, other)
    }
  })


  test('on windows a missing npm-cli.js is an error naming where it looked', () => {
    throws(() => npmCommand('npm', ['install'], windows({ npm_execpath: LAUNCHER }, [])),
      (err: any) => {
        match(err.message, /npm-cli\.js was not found/)
        strictEqual(err.message.includes(LAUNCHER) && err.message.includes(BUNDLED), true)
        return true
      })
  })


  // A real spawn of what is built: a stand-in npm-cli.js reports the argv it
  // was given, so the package spec is seen arriving as one argument.
  test('the package spec reaches npm as one argument, shell characters and all', () => {
    const dir = mkdtempSync(Path.join(tmpdir(), 'sdkgen-npm-'))
    try {
      const cli = Path.join(dir, 'npm-cli.js')
      writeFileSync(cli, 'console.log(JSON.stringify(process.argv.slice(2)))\n')
      const host: NpmHost = {
        platform: 'win32', env: { npm_execpath: cli }, execPath: process.execPath,
        exists: existsSync,
      }
      for (const spec of ['@acme/x', 'x & echo injected', 'x | y > %TEMP%\\z ^ "q"']) {
        const npm = npmFetchCommand(spec, host)
        strictEqual(npm.file, process.execPath)
        const argv = JSON.parse(execFileSync(npm.file, npm.args, { encoding: 'utf8' }))
        deepStrictEqual(argv, npmFetchArgs(spec), spec)
      }
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })


  // The command built for THIS machine, run: on a windows runner this is
  // the path that fails with spawn EINVAL when npm.cmd is spawned directly.
  test('the command built for this machine runs npm', () => {
    for (const env of [process.env, { ...process.env, npm_execpath: '' }]) {
      const npm = npmCommand('npm', ['--version'],
        { platform: process.platform, env, execPath: process.execPath, exists: existsSync })
      const version = execFileSync(npm.file, npm.args, { encoding: 'utf8' }).trim()
      match(version, /^\d+\.\d+\.\d+/)
    }
  })
})
