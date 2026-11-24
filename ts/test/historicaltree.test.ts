import { test, describe, after } from 'node:test'
import { deepStrictEqual } from 'node:assert'

import { spawnSync } from 'node:child_process'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { COPY_FLOOR } from '../dist/action/doctor.js'


const ROOT = Path.resolve(__dirname, '..')
const REPO = Path.resolve(ROOT, '..')
const TSC = Path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')
const CMP = 'project/.sdk/src/cmp'

// The oldest release the language pack declares it runs on.
const PACK_FLOOR = '4.43.0'

const WORK = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-history-'))

after(() => Fs.rmSync(WORK, { recursive: true, force: true }))


// `npm` is a script on POSIX and `npm.cmd` on Windows, so it needs a shell.
function npm(args: string[], cwd: string = WORK): string | undefined {
  const res = spawnSync('npm', args, {
    cwd, encoding: 'utf8', shell: true, timeout: 120000, maxBuffer: 64 * 1024 * 1024,
  })
  return 0 === res.status ? res.stdout.trim() : undefined
}


function untar(tgz: string, into: string): boolean {
  Fs.mkdirSync(into, { recursive: true })
  return 0 === spawnSync('tar', ['-xzf', tgz, '-C', into]).status
}


// The component tree a release shipped: from its tag where this checkout has
// it, else from the registry.
function releasedTree(version: string): string | undefined {
  const into = Path.join(WORK, version)
  const tagged = spawnSync('git', ['archive', 'v' + version, 'ts/' + CMP],
    { cwd: REPO, maxBuffer: 256 * 1024 * 1024 })

  if (0 === tagged.status) {
    Fs.mkdirSync(into, { recursive: true })
    if (0 === spawnSync('tar', ['-x', '-C', into], { input: tagged.stdout }).status) {
      return Path.join(into, 'ts', CMP)
    }
  }

  const tgz = npm(['pack', '@voxgig/sdkgen@' + version, '--silent'])
  return null != tgz && untar(Path.join(WORK, tgz.split('\n').pop() as string), into) ?
    Path.join(into, 'package', CMP) : undefined
}


// The newest release the latest create-sdkgen scaffold's pin admits.
function scaffoldPin(): string | undefined {
  const tgz = npm(['pack', '@voxgig/create-sdkgen@latest', '--silent'])
  const into = Path.join(WORK, 'create-sdkgen')

  if (null == tgz || !untar(Path.join(WORK, tgz.split('\n').pop() as string), into)) {
    return undefined
  }

  const manifest = JSON.parse(Fs.readFileSync(
    Path.join(into, 'package', 'project', 'standard', '.sdk', 'package.json'), 'utf8'))
  const range = manifest.devDependencies?.['@voxgig/sdkgen'] ??
    manifest.dependencies?.['@voxgig/sdkgen']
  const found = null == range ? undefined :
    npm(['view', '@voxgig/sdkgen@' + JSON.stringify(range), 'version', '--json'])

  if (null == found) {
    return undefined
  }

  const versions = [].concat(JSON.parse(found))
  return versions[versions.length - 1]
}


// As a project's own build checks it, with @voxgig/sdkgen resolved to this
// checkout.
function compileErrors(tree: string): string[] {
  const config = Path.join(Path.dirname(tree), 'tsconfig.history.json')

  Fs.writeFileSync(config, JSON.stringify({
    compilerOptions: {
      target: 'ES2021', module: 'node16', moduleResolution: 'node16',
      strict: true, noEmit: true, skipLibCheck: true, esModuleInterop: true,
      typeRoots: [Path.join(ROOT, 'node_modules', '@types')], types: ['node'],
      paths: {
        '@voxgig/sdkgen': [Path.join(ROOT, 'src', 'sdkgen.ts')],
        '*': [Path.join(ROOT, 'node_modules', '*')],
      },
    },
    include: [Path.join(tree, '**', '*.ts')],
    exclude: [Path.join(tree, '**', 'fragment', '**')],
  }))

  const res = spawnSync(process.execPath, [TSC, '-p', config],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

  return (res.stdout + res.stderr).split('\n').filter((line: string) => /error TS\d+/.test(line))
}


describe('released component trees build against this checkout', () => {

  const lanes: [string, () => string | undefined][] = [
    ['the copy floor', () => COPY_FLOOR],
    ['the language pack floor', () => PACK_FLOOR],
    ['the scaffold pin', scaffoldPin],
  ]

  for (const [lane, versionOf] of lanes) {
    test(lane, (t: any) => {
      const version = versionOf()
      const tree = null == version ? undefined : releasedTree(version)

      if (null == tree) {
        t.skip(lane + ': neither a release tag nor the npm registry is reachable here')
        return
      }

      t.diagnostic(lane + ': @voxgig/sdkgen ' + version)
      deepStrictEqual(compileErrors(tree).slice(0, 10), [],
        'components copied from ' + version + ' no longer build')
    })
  }
})
