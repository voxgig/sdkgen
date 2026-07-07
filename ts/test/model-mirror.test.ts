/* Copyright (c) 2024-2025 Voxgig Ltd, MIT License */

// The aontu model is canonical at top-level model/ and mirrored into
// ts/model/ (for npm) — see AGENTS.md. npm can only ship files under the
// package root (ts/), so the copy is physically duplicated. This test fails
// if they drift; run `make sync-model` to re-sync from the canonical model/.

import { test, describe } from 'node:test'
import assert from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'


const REPO = Path.resolve(__dirname, '..', '..')
const MODEL_FILES = ['sdkgen.aontu']


describe('model-mirror', () => {

  for (const file of MODEL_FILES) {
    test(`ts/model/${file} matches canonical model/${file}`, () => {
      const canonical = readFileSync(Path.join(REPO, 'model', file), 'utf8')
      const tsMirror = readFileSync(Path.join(REPO, 'ts', 'model', file), 'utf8')
      assert.strictEqual(
        tsMirror, canonical,
        `ts/model/${file} drifted from model/${file} — run: make sync-model`)
    })
  }

})
