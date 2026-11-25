import { test } from 'node:test'
import Assert from 'node:assert/strict'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import { spawnSync } from 'node:child_process'
import { repositoryStatus } from '../dist/admin/status'

const git = (cwd: string, ...args: string[]) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  Assert.equal(r.status, 0, r.stderr)
}

test('admin status reports actual target trees, missing outputs, and inactive targets without modifying files', () => {
  const root = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdk admin status '))
  try {
    Fs.mkdirSync(Path.join(root, '.sdk/model'), { recursive: true })
    Fs.mkdirSync(Path.join(root, 'typescript output'))
    Fs.mkdirSync(Path.join(root, 'docs'))
    Fs.writeFileSync(Path.join(root, 'typescript output/README.md'), '# Example\n')
    Fs.writeFileSync(Path.join(root, 'docs/index.html'), 'Documentation')
    const file = Path.join(root, '.sdk/model/sdk.json')
    const model = { name: 'example', main: { kit: {
      target: { ts: { output: { path: 'typescript output' }, publish: { version: '1.2.3', registry: { state: 'pending' } } }, go: { active: false } },
      doc: { edition: { website: { kind: 'github-pages', output: { path: 'docs' } }, summary: { kind: 'summary', output: { path: 'SUMMARY.md' } } } },
    } } }
    Fs.writeFileSync(file, JSON.stringify(model))
    git(root, 'init', '--initial-branch=main')
    git(root, 'add', '.')
    git(root, '-c', 'user.name=SDK Test', '-c', 'user.email=sdk@example.test', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'fixture')
    Fs.appendFileSync(Path.join(root, 'typescript output/README.md'), 'Changed\n')
    const before = Fs.readFileSync(file)
    const report = repositoryStatus(root)
    Assert.equal(report.repository.branch, 'main')
    Assert.equal(report.repository.state, 'modified')
    Assert.equal(report.repository.upstream, null)
    Assert.equal(report.targets.find(t => t.name === 'ts')?.state, 'modified')
    Assert.equal(report.targets.find(t => t.name === 'ts')?.version, '1.2.3')
    Assert.equal(report.targets.find(t => t.name === 'go')?.active, false)
    Assert.equal(report.targets.find(t => t.name === 'go')?.state, 'missing')
    Assert.equal(report.editions.find(e => e.name === 'summary')?.present, false)
    Assert.equal(report.editions.find(e => e.name === 'website')?.present, true)
    Assert.deepEqual(Fs.readFileSync(file), before)
    const cli = spawnSync(process.execPath, [Path.resolve(__dirname, '../dist/admin/status.js'), root, '--json'], { encoding: 'utf8' })
    Assert.equal(cli.status, 0, cli.stderr)
    Assert.equal(JSON.parse(cli.stdout).targets.length, 2)
  } finally { Fs.rmSync(root, { recursive: true, force: true }) }
})

test('admin status handles a new scaffold and reports malformed compiled models', () => {
  const root = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdk-admin-new-'))
  try {
    Fs.mkdirSync(Path.join(root, '.sdk/model'), { recursive: true })
    Assert.equal(repositoryStatus(root).model.compiled, false)
    Assert.equal(repositoryStatus(root).targets.length, 0)
    Fs.writeFileSync(Path.join(root, '.sdk/model/sdk.json'), '{ invalid')
    const result = spawnSync(process.execPath, [Path.resolve(__dirname, '../dist/admin/status.js'), root, '--json'], { encoding: 'utf8' })
    Assert.equal(result.status, 1)
    Assert.match(JSON.parse(result.stdout).model.error, /Invalid compiled model/)
  } finally { Fs.rmSync(root, { recursive: true, force: true }) }
})

test('admin status places each target as generate would, the run override included', () => {
  const root = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdk-admin-place-'))
  try {
    Fs.mkdirSync(Path.join(root, '.sdk/model'), { recursive: true })
    Fs.mkdirSync(Path.join(root, 'ts'))
    Fs.mkdirSync(Path.join(root, 'out-ts'))
    const model = { name: 'example', main: { kit: {
      phase: { top: { active: false } },
      target: { ts: { output: { path: '' } }, py: { output: { path: '', root: true } } },
    } } }
    Fs.writeFileSync(Path.join(root, '.sdk/model/sdk.json'), JSON.stringify(model))

    const plain = repositoryStatus(root, {})
    const ts = plain.targets.find(t => t.name === 'ts')
    Assert.equal(plain.model.compiled, true, String(plain.model.error))
    Assert.equal(ts?.place, 'folder')
    Assert.equal(ts?.path, Path.join(root, 'ts'))
    Assert.equal(ts?.stale, null)
    Assert.equal(plain.targets.find(t => t.name === 'py')?.place, 'root')
    Assert.equal(plain.targets.find(t => t.name === 'py')?.path, Path.resolve(root))

    const moved = repositoryStatus(root, { SDKGEN_EXTERNAL: JSON.stringify({ ts: { path: 'out-ts' } }) })
    const away = moved.targets.find(t => t.name === 'ts')
    Assert.deepEqual(moved.override.targets, ['ts'])
    Assert.equal(away?.place, 'external')
    Assert.equal(away?.path, Path.join(root, 'out-ts'))
    Assert.equal(away?.present, true)
    Assert.equal(away?.stale, Path.join(root, 'ts'))

    const bad = repositoryStatus(root, { SDKGEN_EXTERNAL: '{ nope' })
    Assert.match(String(bad.override.error), /SDKGEN_EXTERNAL is not valid JSON/)
    const cli = spawnSync(process.execPath, [Path.resolve(__dirname, '../dist/admin/status.js'), root],
      { encoding: 'utf8', env: { ...process.env, SDKGEN_EXTERNAL: JSON.stringify({ ts: { path: 'out-ts' } }) } })
    Assert.equal(cli.status, 0, cli.stderr)
    Assert.match(cli.stdout, /Override: SDKGEN_EXTERNAL places ts for this run/)
    Assert.match(cli.stdout, /stale in-tree folder /)
  } finally { Fs.rmSync(root, { recursive: true, force: true }) }
})
