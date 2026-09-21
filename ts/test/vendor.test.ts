import { test, describe, before, after } from 'node:test'
import { ok, strictEqual, match, doesNotMatch } from 'node:assert'

import { spawnSync } from 'node:child_process'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'


// build/vendor.js resolves everything from its own location, so a copy of
// it under a scratch root runs against that root's routes, manifest and
// scaffold - and a local git repository stands in for upstream, so the
// online path needs no network and the offline path is a bad URL away.

const TAG = 'sdk-20260101-0000-0'

type World = {
  root: string
  upstream: string
  routes: any
}


function git(dir: string, args: string[]) {
  const res = spawnSync('git', [
    '-c', 'user.name=vendor-test', '-c', 'user.email=vendor@test',
    '-c', 'commit.gpgsign=false', '-C', dir, ...args,
  ], { encoding: 'utf8' })
  ok(0 === res.status, 'git ' + args.join(' ') + ' failed:\n' + res.stderr)
  return res.stdout
}


function makeWorld(): World {
  const root = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-vendor-'))

  Fs.mkdirSync(Path.join(root, 'build'))
  Fs.copyFileSync(
    Path.resolve(__dirname, '..', 'build', 'vendor.js'),
    Path.join(root, 'build', 'vendor.js'))
  Fs.mkdirSync(Path.join(root, 'vendor'))
  Fs.mkdirSync(Path.join(root, 'test'))
  Fs.mkdirSync(Path.join(root, 'project', '.sdk'), { recursive: true })

  const upstream = Path.join(root, 'upstream')
  Fs.mkdirSync(Path.join(upstream, 'src'), { recursive: true })
  Fs.writeFileSync(Path.join(upstream, 'src', 'a.ts'), 'export const a = 1\n')
  Fs.writeFileSync(Path.join(upstream, 'src', 'b.ts'), 'export const b = 2\n')
  git(upstream, ['init', '-q'])
  git(upstream, ['add', '.'])
  git(upstream, ['commit', '-q', '-m', 'upstream'])
  git(upstream, ['tag', TAG])

  const routes = {
    tag: TAG,
    repo: { omni: { url: 'file://' + Path.join(root, 'nowhere'), local: upstream } },
    lang: { ts: { comment: '//' } },
    route: [{
      lib: 'omni', port: 'ts', lang: 'ts',
      file: { 'src/a.ts': 'tm/ts/vendor/a.ts', 'src/b.ts': 'tm/ts/vendor/b.ts' },
    }],
  }

  return { root, upstream, routes }
}


function writeRoutes(w: World) {
  Fs.writeFileSync(Path.join(w.root, 'vendor', 'routes.json'),
    JSON.stringify(w.routes, null, 2))
}


function vendor(w: World, ...args: string[]) {
  writeRoutes(w)
  const res = spawnSync(process.execPath, [Path.join(w.root, 'build', 'vendor.js'), ...args],
    { cwd: w.root, encoding: 'utf8' })
  return { status: res.status, out: res.stdout + res.stderr }
}


function vendored(w: World, rel: string): boolean {
  return Fs.existsSync(Path.join(w.root, 'project', '.sdk', rel))
}


describe('vendor.js', () => {

  let w: World

  before(() => {
    w = makeWorld()
    const run = vendor(w)
    ok(0 === run.status, 'the first write run failed:\n' + run.out)
    ok(vendored(w, 'tm/ts/vendor/a.ts') && vendored(w, 'tm/ts/vendor/b.ts'))
  })

  after(() => {
    Fs.rmSync(w.root, { recursive: true, force: true })
  })


  test('a clean tree checks clean, online', () => {
    const run = vendor(w, '--check')
    strictEqual(run.status, 0, run.out)
    match(run.out, /vendor --check: clean/)
  })


  test('a destination dropped from a route is reported, then removed', () => {
    const file = { ...w.routes.route[0].file }
    delete w.routes.route[0].file['src/b.ts']

    try {
      const check = vendor(w, '--check')
      strictEqual(check.status, 1, check.out)
      match(check.out, /DROPPED tm\/ts\/vendor\/b\.ts/)

      const write = vendor(w)
      strictEqual(write.status, 0, write.out)
      match(write.out, /removed tm\/ts\/vendor\/b\.ts/)
      strictEqual(vendored(w, 'tm/ts/vendor/b.ts'), false,
        'the dropped destination is still in the scaffold')
      ok(vendored(w, 'tm/ts/vendor/a.ts'), 'the routed destination went too')

      const manifest = JSON.parse(
        Fs.readFileSync(Path.join(w.root, 'test', 'vendored.json'), 'utf8'))
      strictEqual(manifest.library['omni/ts'].file['tm/ts/vendor/b.ts'], undefined)

      const clean = vendor(w, '--check')
      strictEqual(clean.status, 0, clean.out)
    }
    finally {
      w.routes.route[0].file = file
      const restore = vendor(w)
      ok(0 === restore.status, restore.out)
    }
  })


  test('a filtered run leaves a dropped destination alone', () => {
    const file = { ...w.routes.route[0].file }
    delete w.routes.route[0].file['src/b.ts']

    try {
      const check = vendor(w, '--check', '--lib=omni')
      doesNotMatch(check.out, /DROPPED/)
      ok(vendored(w, 'tm/ts/vendor/b.ts'))
    }
    finally {
      w.routes.route[0].file = file
      writeRoutes(w)
    }
  })


  describe('offline', () => {

    before(() => {
      // No local checkout and an unreachable URL: the check has only the
      // two committed files to go on.
      w.routes.repo.omni.local = Path.join(w.root, 'absent')
    })

    after(() => {
      w.routes.repo.omni.local = w.upstream
      writeRoutes(w)
    })


    test('an unchanged route checks clean', () => {
      const run = vendor(w, '--check')
      match(run.out, /cannot clone/, 'the check did not go offline')
      strictEqual(run.status, 0, run.out)
    })


    test('a route version the manifest does not carry is drift', () => {
      w.routes.route[0].version = '9.9.9'
      try {
        const run = vendor(w, '--check')
        strictEqual(run.status, 1, run.out)
        match(run.out, /MANIFEST omni\/ts does not match routes .*version/)
      }
      finally {
        delete w.routes.route[0].version
      }
    })


    test('a destination added to a route and never vendored is drift', () => {
      w.routes.route[0].file['src/c.ts'] = 'tm/ts/vendor/c.ts'
      try {
        const run = vendor(w, '--check')
        strictEqual(run.status, 1, run.out)
        match(run.out, /destination never vendored: tm\/ts\/vendor\/c\.ts/)
      }
      finally {
        delete w.routes.route[0].file['src/c.ts']
      }
    })


    test('a moved tag is drift', () => {
      const tag = w.routes.tag
      w.routes.tag = 'sdk-20260102-0000-0'
      try {
        const run = vendor(w, '--check')
        strictEqual(run.status, 1, run.out)
        match(run.out, /does not match routes .*tag /)
      }
      finally {
        w.routes.tag = tag
      }
    })


    test('a local edit still fails the hash', () => {
      const abs = Path.join(w.root, 'project', '.sdk', 'tm', 'ts', 'vendor', 'a.ts')
      const orig = Fs.readFileSync(abs, 'utf8')
      Fs.writeFileSync(abs, orig + '// edited\n')
      try {
        const run = vendor(w, '--check')
        strictEqual(run.status, 1, run.out)
        match(run.out, /DRIFT   tm\/ts\/vendor\/a\.ts/)
      }
      finally {
        Fs.writeFileSync(abs, orig)
      }
    })
  })
})
