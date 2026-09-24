/* Copyright (c) 2024-2025 Voxgig Ltd, MIT License */


import { test, describe } from 'node:test'
import assert from 'node:assert'

import { readdirSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import { KINDS } from '../dist/action/kind.js'

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
      compile(`model/${file}`, Path.join(REPO, 'ts', 'model', file))
    })
  }

})


describe('target-compile', () => {

  const targets = readdirSync(TARGET_DIR)
    .filter((f: string) => f.endsWith('.aontu'))
    .sort()

  assert.ok(0 < targets.length, `no target models found in ${TARGET_DIR}`)

  for (const file of targets) {
    test(`target/${file} generates without errors`, () => {
      compile(`target/${file}`, Path.join(TARGET_DIR, file))
    })
  }

})


describe('target-publish-overridable', () => {

  const targets = readdirSync(TARGET_DIR)
    .filter((f: string) => f.endsWith('.aontu'))
    .sort()

  for (const file of targets) {
    const tname = file.replace(/\.aontu$/, '')
    const tkey = aontuKey(tname)
    const path = Path.join(TARGET_DIR, file)
    const src = readFileSync(path, 'utf8')

    test(`target/${file} lets a project override its publish values`, () => {
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


describe('schema covers every core kind', () => {

  const KIND_PROBE: Record<string, string> = {
    target: "ext: 1\n  comment: line: '#'\n  module: name: 'x'",
    feature: "title: 1",
  }

  // Edition constraints are owned and tested by @voxgig/docgen. Its installed
  // model includes that schema; sdkgen does not depend on the edition renderer.
  const EXTERNAL_SCHEMA: Record<string, string> = { edition: '@voxgig/docgen/model/docgen.aontu' }

  for (const kind of Object.keys(KINDS)) {
    assert.ok(KIND_PROBE[kind] || EXTERNAL_SCHEMA[kind], `No schema owner for ${kind}`)
    if (EXTERNAL_SCHEMA[kind]) continue
    test(`main: kit: ${kind}: & constrains its items`, () => {
      const probe = KIND_PROBE[kind]

      assert.ok(null != probe,
        `no probe for the '${kind}' kind — a new kind needs one here, ` +
        'or this guard passes vacuously for it')

      const src = [
        `@'${Path.join(REPO, 'ts', 'model', 'sdkgen.aontu')}'`,
        `main: kit: ${kind}: probe: {`,
        '  ' + probe,
        '}',
      ].join('\n')

      // The `path` has to EXIST and be a DIFFERENT file from the schema.
      // Both mistakes make this guard pass for the wrong reason, and both
      // were made writing it: a made-up filename throws ENOENT, and naming
      // the schema itself throws `source includes itself` — either way
      // "compiling failed" is true no matter what the schema says.
      const { errors } = compileModel(
        src, Path.join(TARGET_DIR, 'go.aontu'))

      assert.ok(0 < errors.length,
        `the base schema does not constrain main.kit.${kind} — a definition ` +
        'with a wrong-typed field unified cleanly, so nothing in ' +
        '`package check` is checking this kind')
    })
  }

})


test('package schema self-references resolve from the checked model', () => {
  const root = mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-self-schema-'))
  try {
    mkdirSync(Path.join(root, '.sdk/model/edition'), { recursive: true })
    mkdirSync(Path.join(root, 'model'))
    writeFileSync(Path.join(root, 'package.json'), JSON.stringify({
      name: '@test/edition-schema', exports: { './model/*': './model/*' },
    }))
    writeFileSync(Path.join(root, 'model/doc.aontu'), 'main: kit: doc: edition: &: active: boolean')
    const file = Path.join(root, '.sdk/model/edition/summary.aontu')
    const include = '@"@test/edition-schema/model/doc.aontu"\n'
    const valid = include + 'main: kit: doc: edition: summary: active: true'
    writeFileSync(file, valid)
    assert.deepEqual(compileModel(valid, file).errors, [])
    const invalid = include + 'main: kit: doc: edition: summary: active: "wrong type"'
    assert.ok(compileModel(invalid, file).errors.length > 0)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
