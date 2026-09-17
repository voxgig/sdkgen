/* Copyright (c) 2026 Voxgig Ltd, MIT License */

// Tag-pinned vendoring: execute ts/vendor/routes.json.
//
// For each route, file CONTENT is read with `git show <tag>:<path>` — never
// from a working tree — so a dirty or moved local checkout cannot leak local
// edits into a vendored copy. The local sibling checkout is preferred as the
// git DATABASE when it can resolve the tag; otherwise the repo is cloned
// (--depth 1 --branch <tag>) into vendor/.cache/.
//
// Each vendored file gets a three-line provenance header in that language's
// comment syntax, the declared `adapt` rewrites (a missing `from` fails the
// run — an adaptation that no longer applies is a resync surprise, not a
// no-op), and a sha256 over LF-normalized content recorded in
// ts/test/vendored.json, which test/vendored.test.ts holds the tree to.
//
//   node build/vendor.js               # execute every route
//   node build/vendor.js --check      # verify only; exit 1 on any drift
//   node build/vendor.js --audit      # what upstream has that no route takes
//   node build/vendor.js --lib=omni --lang=ts   # filter routes
//
// THE ROUTE MAP IS EXPLICIT, FILE BY FILE, and that is a deliberate
// trade: a glob would vendor whatever upstream happened to add, into a
// tree whose trim groups and relative imports are hand-reasoned. The cost
// is that upstream ADDING a file is invisible — a resync refreshes the
// files already listed and takes nothing new, silently. sekreto's mini
// vault landed in 22 ports and reached no SDK for exactly that reason.
//
// `--audit` is the answer to that: for every route it lists what exists
// upstream, at the tag, in a directory the route already draws from, and
// which no route names. Build and documentation files are expected to be
// unrouted, so `routes.json` carries an `ignore` list; anything else is
// reported, and a clean audit means "nothing new to decide about".
//
// REMOVAL is handled on the other side. A file this tool stops producing
// is not deleted by the route map going quiet — it just stops being
// tracked, and lingers in the template tree being shipped into every SDK.
// So orphans are computed GLOBALLY (routes share destination directories:
// clojure's plugin and sekreto routes both write into
// `feature/secrets/voxgig`), reported by --check, and deleted by a write
// run.
//
// Routes not selected by a filter keep their existing manifest entries, so
// the rollout can land one library or language at a time.

const { execFileSync } = require('node:child_process')
const Crypto = require('node:crypto')
const Fs = require('node:fs')
const Os = require('node:os')
const Path = require('node:path')

const ROOT = Path.resolve(__dirname, '..')
const ROUTES = Path.join(ROOT, 'vendor', 'routes.json')
const MANIFEST = Path.join(ROOT, 'test', 'vendored.json')
const SDK = Path.join(ROOT, 'project', '.sdk')
const CACHE = Path.join(ROOT, 'vendor', '.cache')

function main() {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const audit = args.includes('--audit')
  const libsel = args.filter((a) => a.startsWith('--lib=')).map((a) => a.slice(6))
  const langsel = args.filter((a) => a.startsWith('--lang=')).map((a) => a.slice(7))

  const routes = JSON.parse(Fs.readFileSync(ROUTES, 'utf8'))
  const tag = routes.tag

  const manifest = Fs.existsSync(MANIFEST) ?
    JSON.parse(Fs.readFileSync(MANIFEST, 'utf8')) : { library: {} }
  manifest.tag = manifest.tag || tag

  const selected = routes.route.filter((r) =>
    (0 === libsel.length || libsel.includes(r.lib)) &&
    (0 === langsel.length || langsel.includes(r.lang)))

  if (0 === selected.length) {
    fail('no route matches the given filters')
  }

  // Resolve each needed repo once: a git dir that can answer for the tag,
  // and the commit the tag names.
  const repodir = {}
  const repocommit = {}
  for (const lib of new Set(selected.map((r) => r.lib))) {
    const spec = routes.repo[lib]
    if (null == spec) fail('routes.json names no repo for library: ' + lib)
    const dir = resolveRepo(lib, spec, tag, check)
    repodir[lib] = dir
    repocommit[lib] = null == dir ? null :
      gitq(dir, ['rev-parse', tag + '^{commit}']).trim()
  }

  if (audit) {
    return runaudit(routes, selected, repodir, tag)
  }

  let drift = 0

  for (const route of selected) {
    const dir = repodir[route.lib]
    const commit = repocommit[route.lib]
    const lang = routes.lang[route.lang]
    if (null == lang) fail('routes.json defines no lang entry for: ' + route.lang)

    const key = route.lib + '/' + route.port

    // OFFLINE check: no repo to recompute from, so hold the tree to the
    // COMMITTED manifest - every listed file must exist and hash-match.
    // A local edit still fails; only upstream drift detection degrades.
    if (check && null == dir) {
      const have = manifest.library[key]
      if (null == have) {
        console.error('MANIFEST ' + key + ' has no entry to verify offline')
        drift++
        continue
      }
      for (const [dest, spec] of Object.entries(have.file)) {
        const abs = Path.join(SDK, dest)
        if (!Fs.existsSync(abs)) {
          console.error('MISSING ' + dest)
          drift++
          continue
        }
        const disk = Fs.readFileSync(abs).toString('binary').replace(/\r\n/g, '\n')
        const sha = Crypto.createHash('sha256')
          .update(Buffer.from(disk, 'binary')).digest('hex')
        if (sha !== spec.sha256) {
          console.error('DRIFT   ' + dest)
          drift++
        }
      }
      continue
    }
    const entry = {
      repo: routes.repo[route.lib].url,
      commit,
      version: route.version,
      tag,
      file: {},
    }

    for (const [src, dest] of Object.entries(route.file)) {
      let content
      try {
        content = git(dir, ['show', tag + ':' + src])
      }
      catch (e) {
        fail(key + ': upstream file not at tag: ' + src)
      }
      content = content.replace(/\r\n/g, '\n')

      const applied = []
      for (const adapt of route.adapt || []) {
        if (!new RegExp(adapt.match).test(dest)) continue
        if (!content.includes(adapt.from)) {
          if (adapt.optional) continue
          fail(key + ' ' + dest + ': adapt `' + adapt.from + '` not found in ' +
            src + ' at ' + tag + ' — upstream moved; update routes.json')
        }
        content = content.split(adapt.from).join(adapt.to)
        applied.push({ from: adapt.from, to: adapt.to })
      }

      // A language with no LINE comment (ocaml) declares `commentend`, and
      // every header line is closed with it. Empty for the other languages,
      // so their headers are byte-identical to before.
      const c = lang.comment
      const e = lang.commentend || ''
      const header =
        c + ' VENDORED: @voxgig/' + route.lib + ' ' + route.version + ' (' + src + ')' + e + '\n' +
        c + ' Source: ' + routes.repo[route.lib].url + ' @ ' + commit + '  [tag: ' + tag + ']' + e + '\n' +
        c + ' License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.' + e + '\n'

      // A language whose files MUST open with a fixed line (php's `<?php`)
      // declares it as `prologue`; the header goes immediately after it.
      // The guard reads the same offset from the same declaration.
      let out
      if (null != lang.prologue && content.startsWith(lang.prologue)) {
        const nl = content.indexOf('\n') + 1
        out = content.slice(0, nl) + header + content.slice(nl)
      }
      else {
        out = header + content
      }
      const sha256 = Crypto.createHash('sha256').update(out).digest('hex')

      const abs = Path.join(SDK, dest)
      const rec = { sha256, upstream: src }
      if (0 < applied.length) rec.adapt = applied
      entry.file[dest] = rec

      if (check) {
        if (!Fs.existsSync(abs)) {
          console.error('MISSING ' + dest)
          drift++
        }
        else {
          const disk = Fs.readFileSync(abs).toString('binary').replace(/\r\n/g, '\n')
          if (Crypto.createHash('sha256')
            .update(Buffer.from(disk, 'binary')).digest('hex') !== sha256) {
            console.error('DRIFT   ' + dest)
            drift++
          }
        }
      }
      else {
        Fs.mkdirSync(Path.dirname(abs), { recursive: true })
        Fs.writeFileSync(abs, out)
        console.log('vendored ' + dest)
      }
    }

    if (check) {
      const have = manifest.library[key]
      if (null == have || JSON.stringify(have) !== JSON.stringify(sorted(entry))) {
        console.error('MANIFEST ' + key + ' does not match routes at ' + tag)
        drift++
      }
    }
    else {
      manifest.library[key] = sorted(entry)
    }
  }

  // A MANIFEST SECTION NO ROUTE PRODUCES ANY MORE.
  //
  // Entries are written per key and were never pruned, so REMOVING a route —
  // which is what migrating a target out of the scaffold does — left its
  // section behind claiming files that are no longer in the tree. The guard
  // then failed as "vendored file is missing", which reads as a deleted
  // template rather than as a stale manifest, and the fix looks like putting
  // the file back.
  //
  // Only meaningful on an UNFILTERED run: `--lib`/`--lang` deliberately leave
  // every unselected route's entry alone (see the header note), so a filtered
  // run cannot tell "not selected" from "no longer exists".
  const wholeRun = 0 === libsel.length && 0 === langsel.length
  const produced = new Set(routes.route.map((r) => r.lib + '/' + r.port))
  const stale = !wholeRun ? [] :
    Object.keys(manifest.library).filter((k) => !produced.has(k))

  // Same wholeRun condition as the stale sections above, and for the same
  // reason: a filtered run cannot tell "not selected" from "no longer
  // produced", and this one DELETES.
  const orphan = !wholeRun ? [] : orphans(routes)

  if (check) {
    for (const key of stale) {
      console.error('MANIFEST ' + key + ' has no route — stale section, run `make vendor`')
      drift++
    }

    for (const rel of orphan) {
      console.error('ORPHAN  ' + rel + ' — vendored, but no route produces it')
      drift++
    }

    if (0 < drift) {
      console.error('\nvendor --check: ' + drift + ' problem(s). Run `make vendor` ' +
        'for an intentional resync; a local edit to vendored code needs a marked ' +
        'PATCH block and an upstream issue instead.')
      process.exit(1)
    }
    console.log('vendor --check: clean (' + selected.length + ' route(s))')
    return
  }

  manifest.tag = tag
  for (const key of stale) {
    delete manifest.library[key]
    console.log('pruned ' + key + ' (no route)')
  }
  // A vendored file the routes stopped producing is DELETED, not left to
  // rot: it is a template, so every SDK generated from here would go on
  // shipping it. This is the one place the tool removes a file, which is
  // why it is bounded by the declared `dir` list and by wholeRun.
  for (const rel of orphan) {
    Fs.unlinkSync(Path.join(SDK, rel))
    console.log('removed ' + rel + ' (no route produces it)')
  }
  manifest.library = Object.fromEntries(
    Object.entries(manifest.library).sort(([a], [b]) => a.localeCompare(b)))
  manifest.note = manifest.note ||
    'Generated by build/vendor.js from vendor/routes.json. See test/vendored.test.ts.'
  Fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n')
  console.log('wrote test/vendored.json (' + selected.length + ' route(s) at ' + tag + ')')
}

// UPSTREAM ADDED SOMETHING NO ROUTE TAKES.
//
// Only directories a route ALREADY draws from are looked in: a library
// gaining a whole new port is a routing decision, not a resync surprise,
// and walking the whole repo would report every file in it. So the
// question this answers is narrow and the one that goes wrong quietly —
// "upstream put a new file next to files we vendor, and we did not
// notice".
//
// Everything is read with `git ls-tree` at the TAG, never from a working
// tree, for the same reason the vendoring itself is.
function runaudit(routes, selected, repodir, tag) {
  const ignore = (routes.ignore || []).map((p) => new RegExp(p))
  const routed = new Set()
  for (const r of routes.route) {
    for (const src of Object.keys(r.file)) routed.add(r.lib + ':' + src)
  }

  let found = 0
  for (const route of selected) {
    const dir = repodir[route.lib]
    if (null == dir) {
      console.error('SKIP  ' + route.lib + '/' + route.lang + ': no repo for ' + tag)
      continue
    }

    const srcdirs = new Set(
      Object.keys(route.file).map((src) => Path.posix.dirname(src)))

    const seen = new Set()
    for (const d of srcdirs) {
      const listed = gitq(dir, ['ls-tree', '-r', '--name-only', tag, '--', d + '/'])
        .split('\n').map((l) => l.trim()).filter(Boolean)
      for (const f of listed) {
        // Only the routed directories themselves, not their subtrees: a
        // subdirectory a route does not draw from is a routing decision.
        if (!srcdirs.has(Path.posix.dirname(f))) continue
        if (routed.has(route.lib + ':' + f)) continue
        if (ignore.some((re) => re.test(f))) continue
        seen.add(f)
      }
    }

    if (0 < seen.size) {
      found += seen.size
      console.log(route.lib + '/' + route.lang + '  (' + seen.size + ')')
      for (const f of [...seen].sort()) console.log('    ' + f)
    }
  }

  if (0 === found) {
    console.log('vendor --audit: nothing unrouted (' + selected.length + ' route(s) at ' + tag + ')')
    return
  }

  console.log('')
  console.log('vendor --audit: ' + found + ' upstream file(s) no route takes, at ' + tag + '.')
  console.log('Each is a DECISION, not a defect: add it to routes.json (and to a')
  console.log('feature plugin group, if it is a trimmable provider kind), or add a')
  console.log('pattern to routes.ignore to say it is deliberately not vendored.')
  process.exitCode = 1
}


// VENDORED FILES NO ROUTE PRODUCES ANY MORE.
//
// Computed across EVERY route, not per route, because destination
// directories are shared: clojure's `feature/secrets/voxgig` holds
// plugin.clj from the plugin route and sekreto.clj from the sekreto one,
// and a per-route sweep would call each the other's orphan and delete it.
//
// Scoped to the declared `dir` list, which is exactly the set of
// directories whose contents are vendored outright - verified across all
// 70 routes: every file in a routed dir is produced by some route.
function orphans(routes) {
  const produced = new Set()
  const dirs = new Set()
  for (const r of routes.route) {
    for (const dest of Object.values(r.file)) produced.add(dest)
    for (const d of r.dir || []) dirs.add(d)
  }

  const out = []
  for (const d of [...dirs].sort()) {
    const abs = Path.join(SDK, d)
    if (!Fs.existsSync(abs)) continue
    for (const name of Fs.readdirSync(abs).sort()) {
      const rel = Path.posix.join(d, name)
      if (!Fs.statSync(Path.join(abs, name)).isFile()) continue
      if (!produced.has(rel)) out.push(rel)
    }
  }
  return out
}


// A git dir that resolves the tag: the local sibling checkout when it can,
// else a shallow clone into the cache. The tag is resolved in the chosen
// dir before anything is read, and content is only ever read via `git show`,
// so a dirty worktree changes nothing.
function resolveRepo(lib, spec, tag, check) {
  const local = null == spec.local ? null :
    spec.local.replace(/^~(?=\/)/, Os.homedir())

  if (null != local && Fs.existsSync(Path.join(local, '.git'))) {
    try {
      gitq(local, ['rev-parse', '--verify', tag + '^{commit}'])
      return local
    }
    catch (e) {
      console.error('note: local checkout ' + local + ' does not have tag ' +
        tag + '; falling back to a clone')
    }
  }

  const cached = Path.join(CACHE, lib)
  if (Fs.existsSync(Path.join(cached, '.git'))) {
    try {
      gitq(cached, ['rev-parse', '--verify', tag + '^{commit}'])
      return cached
    }
    catch (e) { /* stale cache; re-clone below */ }
  }

  // --check clones too: its job is CI verification, and a fresh CI
  // checkout has neither the sibling repos nor a warm cache. OFFLINE is
  // the one case that degrades: the caller falls back to verifying the
  // committed manifest against the tree (hashes still fail on any local
  // edit); only the routes-vs-upstream recomputation needs the repo.
  Fs.rmSync(cached, { recursive: true, force: true })
  Fs.mkdirSync(CACHE, { recursive: true })
  try {
    execFileSync('git', ['clone', '--depth', '1', '--branch', tag, spec.url, cached],
      { stdio: check ? 'pipe' : 'inherit' })
  }
  catch (e) {
    if (check) {
      console.error('note: cannot clone ' + spec.url + ' (offline?); ' +
        lib + ' falls back to manifest-vs-tree verification only')
      return null
    }
    throw e
  }
  return cached
}

function git(dir, args) {
  return execFileSync('git', ['-C', dir, ...args],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function gitq(dir, args) {
  return execFileSync('git', ['-C', dir, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

function sorted(entry) {
  return {
    repo: entry.repo,
    commit: entry.commit,
    version: entry.version,
    tag: entry.tag,
    file: Object.fromEntries(
      Object.entries(entry.file).sort(([a], [b]) => a.localeCompare(b))),
  }
}

function fail(msg) {
  console.error('vendor: ' + msg)
  process.exit(1)
}

main()
