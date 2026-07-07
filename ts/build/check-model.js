#!/usr/bin/env node

// Compile the canonical top-level aontu model through Aontu and fail if
// generation reports any error (or throws). This is the fast standalone gate
// used by `make check-model`; the equivalent Node test lives at
// ts/test/model-compile.test.js. Run from the ts/ package root so `aontu`
// resolves from node_modules.

const fs = require('fs')
const path = require('path')

const { Aontu } = require('aontu')

const MODEL_FILES = ['sdkgen.aontu']

let failed = false

for (const file of MODEL_FILES) {
  // The canonical model lives at the repo top level (../model), not ts/model.
  const modelPath = path.join(__dirname, '..', '..', 'model', file)
  const src = fs.readFileSync(modelPath, 'utf8')

  const errs = []
  try {
    const model = new Aontu().generate(src, { path: modelPath, errs })
    if (0 < errs.length || null == model) {
      failed = true
      console.error(
        `MODEL ERROR: model/${file} generated ${errs.length} error(s): ` +
        errs.map((e) => `[${e.why}] ${e.msg}`).join(' | '))
    }
  } catch (e) {
    failed = true
    console.error(`MODEL ERROR: model/${file} failed to generate: ${e.message}`)
  }
}

if (failed) {
  process.exit(1)
}

console.log('model compiles')
