import { describe, test } from 'node:test'
import { match, doesNotMatch, rejects, strictEqual } from 'node:assert'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import { spawnSync } from 'node:child_process'

import { Jostraca, Project } from 'jostraca'
import { memfs } from 'memfs'

import { Deploy } from '../dist/sdkgen.js'
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


async function render(target: Record<string, ModelTarget>): Promise<string> {
  const { fs, vol } = memfs({})
  await Jostraca().generate(
    { fs: () => fs, folder: '/deploy', model: { Name: 'Demo', main: { kit: { target } } }, log },
    () => Project({}, () => Deploy({})),
  )
  const files = vol.toJSON()
  const path = Object.keys(files).find((p) => p.endsWith('/Makefile'))
  return path ? String(files[path]) : ''
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
