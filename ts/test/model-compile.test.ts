/* Copyright (c) 2024-2025 Voxgig Ltd, MIT License */

// The mirror test guards that model/ and ts/model/ are byte-identical; it
// does NOT check that the model is valid. This test compiles the canonical
// top-level aontu model through Aontu and fails if generation reports any
// errors — so a broken edit to model/sdkgen.aontu is caught here rather than
// downstream when a consumer SDK tries to generate.

import { test, describe } from 'node:test'
import assert from 'node:assert'

import { readdirSync, readFileSync } from 'node:fs'
import Path from 'node:path'

// THE RULES LIVE IN `src`, NOT HERE.
//
// This suite enforces them on the BUNDLED scaffold; `package check` enforces
// the same ones on anybody's package (see packagecheck.test.ts). They were
// written here first, and a second copy in `src` would have drifted from this
// one — so there is one copy and two callers.
import {
  PUBLISH_OVERRIDES,
  aontuKey,
  compileModel,
  slashComments,
} from '../dist/helpers/modelcheck.js'


const REPO = Path.resolve(__dirname, '..', '..')
const MODEL_FILES = ['sdkgen.aontu']

const PROJECT_MODEL = Path.join(REPO, 'ts', 'project', '.sdk', 'model')
const TARGET_DIR = Path.join(PROJECT_MODEL, 'target')


// Compile `src` under the parser a consumer actually uses, or fail the test.
// `compileModel` turns aontu's throw into a message with this file's name
// attached — which is what keeps a stray `//` from escaping as an opaque
// AontuError naming nothing.
function compile(label: string, path: string): any {
  const { model, errors } = compileModel(readFileSync(path, 'utf8'), path)

  assert.deepEqual(errors, [], `${label}: ${errors.join(' | ')}`)
  assert.ok(model, `${label} produced no model`)

  return model
}


function aontuFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? aontuFiles(Path.join(dir, e.name)) :
      e.name.endsWith('.aontu') ? [Path.join(dir, e.name)] : [])
}




describe('model-compile', () => {

  for (const file of MODEL_FILES) {
    test(`model/${file} generates without errors`, () => {
      compile(`model/${file}`, Path.join(REPO, 'model', file))
    })
  }

})


// The target models are copied verbatim into a consumer project by the
// scaffold, so a syntax error in one of them only surfaces when someone runs
// `voxgig-model` in that project — the model-compile test above covers
// model/sdkgen.aontu alone. Compile every target here. Note aontu accepts `#`
// comments ONLY: a `//` line is a parse error, and that is exactly how the
// go/go-cli/go-mcp/java/kotlin/scala/cpp targets shipped broken.
describe('target-compile', () => {

  const targets = readdirSync(TARGET_DIR)
    .filter((f: string) => f.endsWith('.aontu'))
    .sort()

  // A miswired path would make the loop below vacuously pass.
  assert.ok(0 < targets.length, `no target models found in ${TARGET_DIR}`)

  for (const file of targets) {
    test(`target/${file} generates without errors`, () => {
      compile(`target/${file}`, Path.join(TARGET_DIR, file))
    })
  }

})


// A project OVERRIDES publication values from its own model — `target add <t>`
// overwrites model/target/<t>.aontu, so anything set there is wiped on the
// next resync, and voxgig-solardemo-sdk lost its pinned npm package name that
// way. The override only works if the shipped target model leaves those keys
// UNSET: aontu resolves default-then-concrete to the concrete value, but
// concrete-then-concrete (and default-then-default) is a CONFLICT that fails
// the whole model. So the schema holds the default and the target file must
// not repeat it.
describe('target-publish-overridable', () => {

  const targets = readdirSync(TARGET_DIR)
    .filter((f: string) => f.endsWith('.aontu'))
    .sort()

  for (const file of targets) {
    const tname = file.replace(/\.aontu$/, '')
    // A hyphenated key has to be quoted in aontu, the way the shipped model
    // writes it (`main: kit: target: 'go-cli': ...`).
    const tkey = aontuKey(tname)
    const path = Path.join(TARGET_DIR, file)
    const src = readFileSync(path, 'utf8')

    test(`target/${file} lets a project override its publish values`, () => {
      // The same probe `package check` runs on anybody's target model.
      const { model, errors } = compileModel(
        [src, ...PUBLISH_OVERRIDES.map(
          ([k, v]) => `main: kit: target: ${tkey}: ${k}: ${v}`)].join('\n'),
        path)

      assert.deepEqual(
        errors, [],
        `${file}: a project override does not unify — the shipped target model ` +
        'sets a key the schema already defaults, so the two concrete values ' +
        'conflict. Remove it from the target model: ' + errors.join(' | '))

      const publish = model?.main?.kit?.target?.[tname]?.publish
      assert.strictEqual(publish?.tag?.active, false,
        `${file}: tag.active did not take the override`)
      assert.strictEqual(publish?.registry?.state, 'active',
        `${file}: registry.state did not take the override`)
      assert.strictEqual(publish?.registry?.package, '@acme/pinned',
        `${file}: registry.package did not take the override`)
    })

    // The other half: the target model must not re-declare a defaulted key,
    // which is what makes the override above possible.
    test(`target/${file} does not repeat a schema-defaulted publish key`, () => {
      const block = /^main: kit: target: \S+ publish: \{\n([\s\S]*?)^\}/m.exec(src)
      if (null == block) return

      const bad = ['state', 'package']
        .filter((k) => new RegExp(`^\\s*${k}\\s*:`, 'm').test(block[1]))
        .concat(/^\s*active\s*:/m.test(block[1]) ? ['active'] : [])

      assert.deepEqual(bad, [],
        `${file}: publish sets ${bad.join(', ')}, which the schema already ` +
        'defaults — a project can then no longer override it')
    })
  }

})


// target-compile above proves the targets parse; the feature and flow models
// beside them are fragments that only resolve once unified into a real project,
// so they cannot be compiled here. Check them for the one syntax mistake that
// costs a user their whole build: aontu takes `#` comments ONLY, and a `//`
// line is a parse error under the parser @voxgig/model configures.
describe('project-model-syntax', () => {

  const files = aontuFiles(PROJECT_MODEL)

  test('the scaffold has model files to check', () => {
    assert.ok(0 < files.length, `no .aontu files under ${PROJECT_MODEL}`)
  })

  test('no scaffolded model uses a slash comment', () => {
    const bad: string[] = []

    for (const file of files) {
      const rel = Path.relative(PROJECT_MODEL, file)

      for (const found of slashComments(readFileSync(file, 'utf8'))) {
        bad.push(`${rel}:${found.line}: ${found.text}`)
      }
    }

    assert.deepEqual(
      bad, [],
      'aontu accepts `#` comments only - these lines would fail to parse ' +
      'in a scaffolded project:\n  ' + bad.join('\n  '))
  })

})


// The consumer targets (go-cli / go-mcp consume the sibling Go SDK; py-data
// consumes the sibling Python SDK) are not SDKs themselves, so they switch
// every standard generation phase off and emit only Main (see Root.ts).
// `agentguide` is one of those phases: if its `active: false` entry is dropped
// from a target model, the Root's inclusive default silently re-enables it and
// these targets get a stray AGENTS.md that overwrites the one Main emits.
// Guard the intent here so a missing phase key fails a test rather than
// shipping.
describe('cli-targets-disable-agentguide', () => {

  for (const target of ['go-cli', 'go-mcp', 'py-data']) {
    test(`${target} switches the agentguide phase off`, () => {
      const model: any = compile(
        `target/${target}.aontu`, Path.join(TARGET_DIR, target + '.aontu'))

      const phase = model?.main?.kit?.target?.[target]?.phase
      assert.strictEqual(
        phase?.agentguide?.active, false,
        `${target}.aontu must set phase.agentguide.active = false`)
    })
  }

})
