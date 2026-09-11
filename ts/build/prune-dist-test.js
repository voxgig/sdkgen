#!/usr/bin/env node
/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */

// DELETE COMPILED TESTS WHOSE SOURCE IS GONE.
//
// `npm test` globs dist-test/**/*.test.js, and `tsc --build` never removes
// output for a source that has been deleted — so a removed test keeps
// running, against code that may also have been removed. Two did: the
// seneca-provider target moved to @voxgig/sdkgen-infrapack, its
// recordkey/seedrecord tests went with it, and their compiled output stayed
// behind reading a component path that no longer exists. They failed on
// every local run and could not pass, while CI stayed green because
// dist-test/ is gitignored — a suite that always fails teaches its readers
// to ignore it.
//
// Runs as part of `npm run build`. Deletes only files under dist-test/ whose
// matching test/*.ts is absent, so it cannot touch anything tsc still owns.

const Fs = require('node:fs')
const Path = require('node:path')

const TS = Path.join(__dirname, '..')
const SRC = Path.join(TS, 'test')
const OUT = Path.join(TS, 'dist-test')

function walk(dir, out = []) {
  if (!Fs.existsSync(dir)) {
    return out
  }
  for (const e of Fs.readdirSync(dir, { withFileTypes: true })) {
    const full = Path.join(dir, e.name)
    if (e.isDirectory()) {
      walk(full, out)
    }
    else {
      out.push(full)
    }
  }
  return out
}

function main() {
  const pruned = []

  for (const file of walk(OUT)) {
    const rel = Path.relative(OUT, file)

    // Only compiled output for a test source: `<name>.test.js`, its map, and
    // the .d.ts beside them. Anything else under dist-test/ is left alone.
    const m = rel.match(/^(.*\.test)\.(js|js\.map|d\.ts)$/)
    if (null == m) {
      continue
    }

    if (!Fs.existsSync(Path.join(SRC, m[1] + '.ts'))) {
      Fs.rmSync(file)
      pruned.push(rel)
    }
  }

  if (0 < pruned.length) {
    console.log('pruned ' + pruned.length +
      ' orphaned compiled test file(s) from dist-test/:')
    for (const p of [...new Set(pruned.map((p) => p.replace(/\.(js|js\.map|d\.ts)$/, '')))]) {
      console.log('  ' + p)
    }
  }
}

main()
