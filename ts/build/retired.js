#!/usr/bin/env node

// Writes project/sdkgen-retired.json: for every file under .sdk/src/cmp/ that
// a release tag shipped and the working tree no longer does, the fingerprint
// of each released version of it. Doctor and every add read it to recognise
// an unchanged copy of a release without the project's copy record.
//
// Needs the release tags (v4.*) and their history, so it runs where a release
// is cut (`make publish`), not in CI. `--check` exits 1 when the committed
// list differs from what the history gives.

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const { fingerprint } = require('../dist/action/copies')
const { RETIRED_FILE } = require('../dist/helpers/manifest')

const TS = path.join(__dirname, '..')
const SDK = path.join(TS, 'project', '.sdk')
const PREFIX = 'ts/project/.sdk/'
const TREE = 'src/cmp/'
const OUT = path.join(TS, 'project', RETIRED_FILE)

const git = (args, input) => execFileSync('git', args,
  { cwd: path.join(TS, '..'), maxBuffer: 1 << 30, input })

const semver = (tag) => tag.slice(1).split('.').map(Number)
const older = (a, b) => {
  const [x, y] = [semver(a), semver(b)]
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] < y[i]
  }
  return false
}

function releaseTags() {
  return String(git(['tag', '--list', 'v*'])).split('\n')
    .filter((t) => /^v\d+\.\d+\.\d+$/.test(t))
    .sort((a, b) => older(a, b) ? -1 : older(b, a) ? 1 : 0)
}

function build() {
  const tags = releaseTags()
  const blobs = new Map()
  const shipped = new Map()

  for (const tag of tags) {
    const lines = String(git(['ls-tree', '-r', tag, '--', PREFIX + TREE])).split('\n')
    for (const line of lines) {
      const m = line.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/)
      if (null == m) continue
      const rel = m[2].slice(PREFIX.length)
      if (fs.existsSync(path.join(SDK, ...rel.split('/')))) continue
      if (!shipped.has(rel)) shipped.set(rel, new Set())
      shipped.get(rel).add(m[1])
      blobs.set(m[1], null)
    }
  }

  const ids = Array.from(blobs.keys())
  if (0 < ids.length) {
    const out = git(['cat-file', '--batch'], ids.join('\n') + '\n')
    let at = 0
    for (const id of ids) {
      const nl = out.indexOf(10, at)
      const size = Number(String(out.subarray(at, nl)).split(' ')[2])
      blobs.set(id, fingerprint(out.subarray(nl + 1, nl + 1 + size)))
      at = nl + 1 + size + 1
    }
  }

  const files = {}
  for (const rel of Array.from(shipped.keys()).sort()) {
    files[rel] = Array.from(new Set(Array.from(shipped.get(rel))
      .map((id) => blobs.get(id)))).sort()
  }

  return {
    sdkgen: { retired: 1 },
    releases: 0 === tags.length ? [] : [tags[0], tags[tags.length - 1]],
    files,
  }
}

const list = build()
const text = JSON.stringify(list, null, 1) + '\n'

if (process.argv.includes('--check')) {
  const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''
  if (have !== text) {
    console.error(RETIRED_FILE + ' differs from the release history; run npm run retired')
    process.exit(1)
  }
}
else {
  fs.writeFileSync(OUT, text)
  const prints = Object.values(list.files).reduce((n, p) => n + p.length, 0)
  console.log(RETIRED_FILE + ': ' + Object.keys(list.files).length + ' file(s), ' +
    prints + ' fingerprint(s), ' + Buffer.byteLength(text) + ' bytes, from ' +
    list.releases.join('..'))
}
