/* Copyright (c) 2026 Voxgig Ltd, MIT License */

import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual, throws } from 'node:assert'

import { spawnSync } from 'node:child_process'
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import Path from 'node:path'

import {
  assess, npmFailure, npmTrustScript, parseArgs, parseTrustList, run,
} from '../dist/admin/npm-trust'

import type { NpmPort, TrustEntry } from '../dist/admin/npm-trust'


const REPO = 'acme/demo-sdk'
const PKG = '@acme/demo-sdk'
const PUB = { pkg: PKG, file: 'publish-ts.yml' }
const ARGS = ['--repository', REPO, '--publish', `${PKG}=publish-ts.yml`]
const CREATE = `create ${PKG} ${REPO} publish-ts.yml`

const TRUSTED: TrustEntry = {
  id: 'a1', type: 'github', file: 'publish-ts.yml', repository: REPO,
  permissions: ['createPackage'],
}


// The shape of `npm trust list --json`: a blank line, then one pretty-printed
// object per configuration.
function npmListOutput(entries: TrustEntry[]): string {
  return entries.map((e) => '\n' + JSON.stringify(e, null, 2) + '\n').join('') + '\n'
}


function exec(argv: string[], registered: TrustEntry[]) {
  const calls: string[] = []
  const npm: NpmPort = {
    list(pkg) { calls.push('list ' + pkg); return registered },
    create(pkg, repository, file) { calls.push(`create ${pkg} ${repository} ${file}`) },
    revoke(pkg, id) { calls.push(`revoke ${pkg} ${id}`) },
  }
  const lines: string[] = []
  const code = run(parseArgs(argv), npm, (line) => lines.push(line))
  return { code, calls, lines }
}


describe('admin npm-trust', () => {

  test('reads the arguments a generated script passes', () => {
    deepStrictEqual(parseArgs([...ARGS, '--otp', '123456']), {
      repository: REPO, publish: [PUB], mode: 'setup', replace: false, otp: '123456',
    })
    strictEqual(parseArgs([...ARGS, '--check']).mode, 'check')
    strictEqual(parseArgs([...ARGS, '--dry-run', '--replace']).mode, 'dry-run')
  })


  test('refuses arguments npm trust would reject or misread', () => {
    for (const bad of [
      ['--publish', `${PKG}=publish-ts.yml`],
      ['--repository', 'acme', '--publish', `${PKG}=publish-ts.yml`],
      ['--repository', REPO],
      ['--repository', REPO, '--publish', `${PKG}=.github/workflows/publish-ts.yml`],
      ['--repository', REPO, '--publish', `${PKG}=publish-ts.txt`],
      ['--repository', REPO, '--publish', PKG],
      ['--repository', REPO, '--publish', 'Not A Package=publish-ts.yml'],
      [...ARGS, '--publish', `${PKG}=publish-js.yml`],
      [...ARGS, '--repository', 'evil/repo'],
      [...ARGS, '--check', '--dry-run'],
      [...ARGS, '--check', '--replace'],
      [...ARGS, '--otp'],
      [...ARGS, '--force'],
    ]) {
      throws(() => parseArgs(bad), Error, 'accepted: ' + bad.join(' '))
    }
  })


  test('reads the object stream npm prints, an array, or nothing', () => {
    const other = { ...TRUSTED, id: 'b2', file: 'release.yml' }
    const awkward = { ...TRUSTED, file: 'a}b{"c.yml' }

    deepStrictEqual(parseTrustList(npmListOutput([TRUSTED, other])), [TRUSTED, other])
    deepStrictEqual(parseTrustList(npmListOutput([awkward])), [awkward])
    deepStrictEqual(parseTrustList(JSON.stringify([TRUSTED])), [TRUSTED])
    deepStrictEqual(parseTrustList('\n\n'), [])
    throws(() => parseTrustList('{ "id": "a1"'), /could not read/)
  })


  test('only the configuration the workflow needs counts as trusted', () => {
    strictEqual(assess(PUB, REPO, [TRUSTED]).match, TRUSTED)
    strictEqual(assess(PUB, 'ACME/Demo-SDK', [TRUSTED]).match, TRUSTED)

    const unscoped = { id: 'a1', type: 'github', file: 'publish-ts.yml', repository: REPO }
    strictEqual(assess(PUB, REPO, [unscoped]).match, unscoped)

    for (const near of [
      { ...TRUSTED, file: 'publish.yml' },
      { ...TRUSTED, repository: 'acme/other' },
      { ...TRUSTED, environment: 'npm' },
      { ...TRUSTED, permissions: ['createStagedPackage'] },
      { ...TRUSTED, type: 'gitlab' },
    ]) {
      const found = assess(PUB, REPO, [near])
      strictEqual(found.match, undefined, 'matched: ' + JSON.stringify(near))
      deepStrictEqual(found.extra, [near])
    }
  })


  test('sets up only what is missing', () => {
    const fresh = exec(ARGS, [])
    strictEqual(fresh.code, 0)
    deepStrictEqual(fresh.calls, ['list ' + PKG, CREATE])

    const again = exec(ARGS, [TRUSTED])
    strictEqual(again.code, 0)
    deepStrictEqual(again.calls, ['list ' + PKG])
  })


  test('creates nothing beside another trusted publisher unless replacing it', () => {
    const stale = { ...TRUSTED, id: 'old', file: 'release.yml' }

    const kept = exec(ARGS, [stale])
    strictEqual(kept.code, 1)
    deepStrictEqual(kept.calls, ['list ' + PKG])
    ok(kept.lines.some((l) => l.includes('--replace revokes it')), kept.lines.join('\n'))
    ok(kept.lines.some((l) => l.includes('NOT trusted')), kept.lines.join('\n'))

    const replaced = exec([...ARGS, '--replace'], [stale])
    strictEqual(replaced.code, 0)
    deepStrictEqual(replaced.calls, ['list ' + PKG, `revoke ${PKG} old`, CREATE])

    const extra = exec([...ARGS, '--replace'], [stale, TRUSTED])
    strictEqual(extra.code, 0)
    deepStrictEqual(extra.calls, ['list ' + PKG, `revoke ${PKG} old`])

    const unrevocable = exec([...ARGS, '--replace'], [{ ...stale, id: undefined }])
    strictEqual(unrevocable.code, 1)
    deepStrictEqual(unrevocable.calls, ['list ' + PKG])
  })


  test('--check reports drift and changes nothing', () => {
    strictEqual(exec([...ARGS, '--check'], [TRUSTED]).code, 0)

    for (const registered of [[], [TRUSTED, { ...TRUSTED, id: 'x', environment: 'npm' }]]) {
      const res = exec([...ARGS, '--check'], registered)
      strictEqual(res.code, 1, res.lines.join('\n'))
      deepStrictEqual(res.calls, ['list ' + PKG])
    }
  })


  test('--dry-run never contacts npm', () => {
    const res = exec([...ARGS, '--dry-run'], [TRUSTED])
    strictEqual(res.code, 0)
    deepStrictEqual(res.calls, [])
    deepStrictEqual(res.lines, [
      `${PKG}: npm trust github ${PKG} --repository ${REPO} --file publish-ts.yml --allow-publish`,
    ])
  })


  test('explains the npm failures a maintainer can fix', () => {
    ok(npmFailure('npm trust list', 'npm error code EOTP').includes('--otp'))
    ok(npmFailure('npm trust list',
      'npm error code E401\nnpm error 401 Unauthorized - Bearer token authorization is required')
      .includes('npm login'))
    ok(npmFailure('npm trust list', 'npm error code E404').includes('first version'))
  })


  test('the generated script runs the module with the values it was given', {
    skip: 'win32' === process.platform && 'symlinks and bash',
  }, () => {
    const root = mkdtempSync(Path.join(tmpdir(), 'sdkgen-npm-trust-'))
    try {
      const admin = Path.join(root, '.sdk', 'admin')
      const script = Path.join(admin, 'setup-npm-trust.sh')
      mkdirSync(admin, { recursive: true })
      writeFileSync(script, npmTrustScript(REPO, [
        PUB, { pkg: '@acme/demo-js-sdk', file: 'publish-js.yml' },
      ]))
      chmodSync(script, 0o755)

      const missing = spawnSync('bash', [script, '--dry-run'], { encoding: 'utf8' })
      strictEqual(missing.status, 1)
      ok(missing.stderr.includes('Install or update the .sdk dependencies'), missing.stderr)

      const scope = Path.join(root, '.sdk', 'node_modules', '@voxgig')
      mkdirSync(scope, { recursive: true })
      symlinkSync(Path.resolve(__dirname, '..'), Path.join(scope, 'sdkgen'), 'dir')

      const res = spawnSync('bash', [script, '--dry-run'], { encoding: 'utf8' })
      strictEqual(res.status, 0, res.stderr)
      deepStrictEqual(res.stdout.trim().split('\n'), [
        `${PKG}: npm trust github ${PKG} --repository ${REPO} --file publish-ts.yml --allow-publish`,
        '@acme/demo-js-sdk: npm trust github @acme/demo-js-sdk --repository ' +
        `${REPO} --file publish-js.yml --allow-publish`,
      ])

      const moved = spawnSync('bash', [script, '--repository', 'evil/repo', '--dry-run'],
        { encoding: 'utf8' })
      strictEqual(moved.status, 2, 'a caller replaced the generated repository')
      ok(moved.stderr.includes('given twice'), moved.stderr)

      writeFileSync(script, npmTrustScript("acme/x'$(touch pwned)'", [
        { pkg: "@acme/y'$(touch pwned)'", file: 'publish-ts.yml' },
      ]))
      const hostile = spawnSync('bash', [script, '--dry-run'], { cwd: root, encoding: 'utf8' })
      strictEqual(hostile.status, 2, hostile.stdout)
      ok(!existsSync(Path.join(root, 'pwned')), 'a quote in a model value ran a command')

      writeFileSync(script, npmTrustScript(null, [PUB]))
      const elsewhere = spawnSync('bash', [script, '--dry-run'], { encoding: 'utf8' })
      strictEqual(elsewhere.status, 1)
      ok(elsewhere.stderr.includes('github.com'), elsewhere.stderr)
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
