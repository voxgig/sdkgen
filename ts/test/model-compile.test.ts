/* Copyright (c) 2024-2025 Voxgig Ltd, MIT License */

// The mirror test guards that model/ and ts/model/ are byte-identical; it
// does NOT check that the model is valid. This test compiles the canonical
// top-level aontu model through Aontu and fails if generation reports any
// errors — so a broken edit to model/sdkgen.aontu is caught here rather than
// downstream when a consumer SDK tries to generate.

import { test, describe } from 'node:test'
import assert from 'node:assert'

import { readFileSync } from 'node:fs'
import Path from 'node:path'

import { Aontu } from 'aontu'


const REPO = Path.resolve(__dirname, '..', '..')
const MODEL_FILES = ['sdkgen.aontu']


describe('model-compile', () => {

  for (const file of MODEL_FILES) {
    test(`model/${file} generates without errors`, () => {
      const path = Path.join(REPO, 'model', file)
      const src = readFileSync(path, 'utf8')

      const errs: any[] = []
      const aontu = new Aontu()
      const model = aontu.generate(src, { path, errs })

      assert.strictEqual(
        errs.length, 0,
        `model/${file} generated ${errs.length} error(s): ` +
        errs.map((e: any) => `[${e.why}] ${e.msg}`).join(' | '))

      assert.ok(model, `model/${file} produced no model`)
    })
  }

})
