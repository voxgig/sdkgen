import { describe, test } from 'node:test'
import { match, doesNotMatch, ok, rejects, strictEqual } from 'node:assert'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import { spawnSync } from 'node:child_process'

import { Jostraca, Project } from 'jostraca'
import { memfs } from 'memfs'

import { Deploy, applyFacts } from '../dist/sdkgen.js'
import type { ModelTarget } from '../dist/types'


const noop = () => {}
const log: any = {
  info: noop, debug: noop, warn: noop, error: noop, trace: noop, fatal: noop,
  child() { return log },
}

const FILLER = 'BORU-DRY-RUN-FILLER-NOT-A-REAL-SECRET'
const canRunMake = 'win32' !== process.platform &&
  0 === spawnSync('make', ['--version']).status &&
  0 === spawnSync('/bin/bash', ['--version']).status


// A test reuses its target objects, and the fact pass writes into each.
async function render(target: Record<string, ModelTarget>, project: any = {}): Promise<string> {
  const { fs, vol } = memfs({})
  const placed = Object.fromEntries(Object.entries(structuredClone(target))
    .map(([name, t]: [string, any]) => [name, { output: { path: '', root: false }, ...t }]))
  const model = applyFacts({ ...project, Name: 'Demo', main: { kit: { target: placed } } })
  await Jostraca().generate(
    { fs: () => fs, folder: '/deploy', model, log },
    () => Project({}, () => Deploy({})),
  )
  const files = vol.toJSON()
  const path = Object.keys(files).find((p) => p.endsWith('/Makefile'))
  return path ? String(files[path]) : ''
}


// The Makefile's comment lines as one paragraph, so a wrap moves no assertion.
function prose(makefile: string): string {
  return makefile.split('\n').filter((l: string) => l.startsWith('# ')).map((l: string) => l.slice(2)).join(' ')
}


function dryRun(makefile: string, targets: string[], tsVersion?: string): string {
  const cwd = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-deploy-'))
  try {
    Fs.writeFileSync(Path.join(cwd, 'Makefile'), makefile)
    if (tsVersion) {
      Fs.mkdirSync(Path.join(cwd, 'ts'))
      Fs.writeFileSync(Path.join(cwd, 'ts', 'package.json'), JSON.stringify({ version: tsVersion }))
    }
    const result = spawnSync('make', targets.map((name) => 'tag-push-' + name), {
      cwd, encoding: 'utf8', timeout: 10000,
      env: { ...process.env, GITHUB_TOKEN: FILLER, GH_TOKEN: FILLER, MAKEFLAGS: '', MFLAGS: '' },
    })
    strictEqual(result.status, 0, result.stdout + result.stderr + (result.error || ''))
    return result.stdout
  }
  finally {
    Fs.rmSync(cwd, { recursive: true, force: true })
  }
}


describe('Deploy', () => {
  const cases: { title: string, target: Record<string, ModelTarget>, tags: string[], tsVersion?: string }[] = [
    {
      title: 'pending Python registry without TypeScript',
      target: { py: { name: 'py', publish: { version: '1.2.0', registry: { name: 'pypi', state: 'pending' } } } },
      tags: ['py/v1.2.0'],
    },
    {
      title: 'root-managed consumer tag without TypeScript',
      target: { 'go-cli': { name: 'go-cli', publish: { version: '2.3.4', tag: { via: 'root' } } } },
      tags: ['go-cli/v2.3.4'],
    },
    {
      title: 'aliased root-managed target uses its own version',
      target: {
        go: { name: 'go', publish: { version: '1.0.0' } },
        go2: { name: 'go2', origname: 'go', publish: { version: '2.0.0-rc.1+build.5', tag: { via: 'root' } } },
      },
      tags: ['go2/v2.0.0-rc.1+build.5'],
    },
    {
      title: 'mixed targets retain independent versions despite a TypeScript manifest',
      target: {
        ts: { name: 'ts', publish: { version: '9.0.0', registry: { name: 'npm', state: 'active' } } },
        py: { name: 'py', publish: { version: '1.2.0', registry: { name: 'pypi', state: 'pending' } } },
        rb: { name: 'rb', publish: { version: '3.4.0', registry: { name: 'gem', state: 'inactive' } } },
      },
      tags: ['py/v1.2.0', 'rb/v3.4.0'],
      tsVersion: '9.0.0',
    },
    {
      title: 'equal model versions retain lockstep tags',
      target: {
        ts: { name: 'ts', publish: { version: '1.2.0', registry: { name: 'npm', state: 'pending' } } },
        js: { name: 'js', publish: { version: '1.2.0', registry: { name: 'npm', state: 'pending' } } },
      },
      tags: ['ts/v1.2.0', 'js/v1.2.0'],
    },
    {
      title: 'omitted version uses the shared package default',
      target: { py: { name: 'py', publish: { registry: { name: 'pypi', state: 'pending' } } } },
      tags: ['py/v0.0.1'],
    },
  ]

  for (const entry of cases) {
    test(entry.title, async (t) => {
      const makefile = await render(entry.target)
      doesNotMatch(makefile, /require\('\.\/ts\/package\.json'\)/)
      for (const tag of entry.tags) {
        match(makefile, new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      }
      await t.test('executes the generated tag recipes in dry-run mode', {
        skip: canRunMake ? false : 'generated recipes require make and /bin/bash on POSIX',
      }, () => {
        const output = dryRun(makefile, entry.tags.map((tag) => tag.split('/')[0]), entry.tsVersion)
        for (const tag of entry.tags) {
          strictEqual(output.includes('push tag ' + tag + '; nothing pushed.'), true, output)
        }
      })
    })
  }

  test('preserves per-target publish routing and excludes inactive targets', async () => {
    const makefile = await render({
      go: { name: 'go', publish: { version: '1.2.0' } },
      ts: { name: 'ts', publish: { registry: { name: 'npm', state: 'active' } } },
      js: { name: 'js', publish: { registry: { name: 'npm', active: true } } },
      old: { name: 'old', active: false, publish: { tag: { via: 'root' } } },
    })
    for (const name of ['go', 'ts', 'js']) {
      match(makefile, new RegExp('\\$\\(MAKE\\) -C ' + name + ' publish'))
      doesNotMatch(makefile, new RegExp('^tag-push-' + name + ':', 'm'))
    }
    doesNotMatch(makefile, /deploy-old:|tag-push-old:/)
  })

  test('an active registry the port has no publish recipe for deploys the tag only', async () => {
    const makefile = await render({
      rust: { name: 'rust', publish: { version: '1.2.0', recipe: false, registry: { name: 'crates.io', active: true } } },
    })
    doesNotMatch(makefile, /-C rust publish/)
    match(makefile, /^tag-push-rust:/m)
    match(makefile, /crates\.io is active, but the rust port has no recipe that publishes there/)
  })

  // A registry-active deploy runs the port's own `publish` rule unless the
  // target model declares that the template has none that publishes.
  test('every bundled port deployed through its Makefile has the publish rule it runs', async () => {
    const scaffold = Path.resolve(__dirname, '..', 'project', '.sdk')
    const names = Fs.readdirSync(Path.join(scaffold, 'model', 'target'))
      .filter((f: string) => f.endsWith('.aontu') && !f.includes('-index')).map((f: string) => f.replace(/\.aontu$/, ''))
    for (const name of names) {
      const src = Fs.readFileSync(Path.join(scaffold, 'model', 'target', name + '.aontu'), 'utf8')
      const recipe = !/^\s*recipe: false$/m.test(src)
      const make = Path.join(scaffold, 'tm', name, 'Makefile')
      const rule = Fs.existsSync(make) && /^publish:/m.test(Fs.readFileSync(make, 'utf8'))
      ok(!recipe || rule, name + ' has no publish rule and does not declare `recipe: false`')
      const makefile = await render({
        [name]: { name, publish: { recipe, registry: { name: 'reg', active: true } } },
      })
      // go releases from its tag whatever the registry.
      strictEqual(new RegExp('-C ' + name + ' publish').test(makefile), recipe && 'go' !== name, name)
    }
  })

  test('the primary npm package is tagged as its workflow tags it, and the header says so', async () => {
    const makefile = await render({
      ts: { name: 'ts', publish: { version: '1.2.0', registry: { name: 'npm', state: 'pending' } } },
      js: { name: 'js', publish: { version: '1.2.0', registry: { name: 'npm', state: 'pending' } } },
    }, { name: 'demo' })
    match(makefile, /^tag-push-ts:\n\t@set -e; tag="v1\.2\.0"/m)
    match(makefile, /^tag-push-js:\n\t@set -e; tag="js\/v1\.2\.0"/m)
    match(prose(makefile), /Every port gets a git release tag <target>\/vX\.Y\.Z, except ts, tagged vX\.Y\.Z\./)
    const lines = makefile.split('\n')
    const from = lines.findIndex((l: string) => l.startsWith('# Every port'))
    const para = lines.slice(from, lines.indexOf('#', from))
    ok(0 < para.length && para.every((l: string) => l.length <= 74),
      'the tag paragraph runs past the width the rest of the header keeps:\n' + para.join('\n'))
  })

  test('a declared prefix names the tag, and a tag switched off gives deploy nothing to push', async () => {
    const makefile = await render({
      py: { name: 'py', publish: { version: '1.2.0', tag: { prefix: 'python' }, registry: { name: 'pypi', state: 'pending' } } },
      rb: { name: 'rb', publish: { version: '3.4.0', tag: { active: false }, registry: { name: 'gem', state: 'pending' } } },
    })
    match(makefile, /^tag-push-py:\n\t@set -e; tag="python\/v1\.2\.0"/m)
    doesNotMatch(makefile, /^tag-push-rb:/m)
    match(makefile, /deploy-rb: nothing to deploy — the model cuts no release tag for rb/)
    match(prose(makefile), /except py, tagged python\/vX\.Y\.Z, and rb, which gets none\./)
  })

  test('a registry named none is tag-only, its tag cut at the root', async () => {
    const makefile = await render({
      c: { name: 'c', publish: { version: '1.0.0', registry: { name: 'none', vault: { alias: 'none', env: 'NONE' } } } },
    })
    match(makefile, /^#\s+c\s+tag-only$/m)
    match(makefile, /deploy-c\s+tag-only/)
    match(makefile, /deploy-c: tag-only port — publishing the git tag\./)
    match(makefile, /^tag-push-c:/m)
    doesNotMatch(makefile, /none \(|publication is pending|NONE_ALIAS/)
  })

  test('an inactive registry is called inactive, not pending', async () => {
    const makefile = await render({
      rb: { name: 'rb', publish: { registry: { name: 'gem', state: 'inactive' } } },
    })
    match(makefile, /gem publication is inactive — publishing the git tag only/)
    doesNotMatch(makefile, /gem publication is pending|publish pending/)
  })

  test('does not emit a Makefile without active targets', async () => {
    strictEqual(await render({}), '')
    strictEqual(await render({ py: { name: 'py', active: false } }), '')
  })

  test('rejects invalid versions before emitting executable tag recipes', async () => {
    for (const version of [' ', '1.2.0\ninvalid', '$(touch injected)', '1.2.0"; false; #']) {
      await rejects(render({
        py: { name: 'py', publish: { version, registry: { name: 'pypi', state: 'pending' } } },
      }), /Deploy: invalid publish\.version for target "py"/)
    }
  })
})
