// THE PACKAGE MANIFEST — `sdkgen-package.json`.
//
// A manifest is a CLAIM, and a claim nobody checks is worse than no claim:
// `package add` would install the items it lists until it hit one that is not
// there, leaving the project half-installed. So the validator compares the
// claim against the trees on disk in both directions, and the bundled
// scaffold's own manifest is pinned to its directory listings by the guard at
// the bottom of this file — the same discipline every other closed set in
// `ts/test/` gets.

import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import {
  MANIFEST, SCHEMA, manifestPath, readManifest, validateManifest,
} from '../dist/helpers/manifest.js'
import { definitionNames } from '../dist/helpers/definition.js'
import { KINDS } from '../dist/action/kind.js'

import { SCAFFOLD, PROJECT } from './actionharness'


// A throwaway package root: `<dir>/sdkgen-package.json` beside `<dir>/.sdk`.
function makePackage(
  manifest: any,
  build: (sdk: string) => void = () => { },
): string {
  const dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-manifest-'))
  const sdk = Path.join(dir, '.sdk')

  Fs.mkdirSync(sdk, { recursive: true })

  if (null != manifest) {
    Fs.writeFileSync(Path.join(dir, MANIFEST),
      'string' === typeof manifest ? manifest : JSON.stringify(manifest))
  }

  build(sdk)

  return dir
}


function def(sdk: string, kind: string, name: string) {
  const dir = Path.join(sdk, 'model', kind)
  Fs.mkdirSync(dir, { recursive: true })
  Fs.writeFileSync(Path.join(dir, name + '.aontu'), '\n')
}


function tree(sdk: string, ...rel: string[]) {
  Fs.mkdirSync(Path.join(sdk, ...rel), { recursive: true })
}


// Errors only — the warnings have their own tests, and mixing them makes a
// failure message about the wrong thing.
function errors(found: any[]): string[] {
  return found.filter((f: any) => 'error' === f.level).map((f: any) => f.point)
}


// Read a manifest that the test WROTE, so its absence is a bug in the test
// rather than a case under examination.
function manifestOf(sdkfolder: string): any {
  const read = readManifest(Fs, sdkfolder)
  ok(null == read.err, 'the fixture manifest did not parse: ' + read.err)
  ok(null != read.manifest, 'no manifest at ' + read.file)
  return read.manifest
}


describe('readManifest', () => {

  test('the manifest is a SIBLING of .sdk, not a child', () => {
    // The package root is the parent of `.sdk` — which is where
    // `resolveSource` already probes, so the manifest sits at the path the
    // ref already pointed at. Getting this backwards would make every
    // manifest invisible while every test that writes one still passes.
    const p = manifestPath(Path.join('/pkg', '.sdk'))
    strictEqual(Path.normalize(p), Path.normalize(Path.join('/pkg', MANIFEST)))
  })


  test('absent is not an error', () => {
    // A bare `.sdk`-shaped folder is a legal direct-ref source and is what
    // every existing consumer fixture is. Reporting its absence as a failure
    // would break them all.
    const dir = makePackage(null)
    try {
      const read = readManifest(Fs, Path.join(dir, '.sdk'))
      strictEqual(read.manifest, undefined)
      strictEqual(read.err, undefined)
      ok(read.file.endsWith(MANIFEST), 'no path to report: ' + read.file)
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })


  test('present-but-broken is DISTINCT from absent', () => {
    // Collapsing the two is what would let a typo in a package's own JSON
    // silently downgrade `package add` into a no-op.
    const dir = makePackage('{ "name": "x", }')
    try {
      const read = readManifest(Fs, Path.join(dir, '.sdk'))
      strictEqual(read.manifest, undefined)
      ok(null != read.err, 'a malformed manifest read as simply absent')
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })


  test('a JSON scalar is not a manifest', () => {
    // `"hello"` and `[1,2]` parse fine and then fail much later, on a
    // property access that reads undefined.
    for (const body of ['"hello"', '[1,2]', 'null', '7']) {
      const dir = makePackage(body)
      try {
        const read = readManifest(Fs, Path.join(dir, '.sdk'))
        ok(null != read.err, body + ' was accepted as a manifest object')
      }
      finally {
        Fs.rmSync(dir, { recursive: true, force: true })
      }
    }
  })
})


describe('validateManifest', () => {

  test('a well-formed package validates clean', () => {
    const dir = makePackage(
      {
        sdkgen: { package: 1 }, name: '@acme/sdkgen-iot',
        provides: { target: ['iotgo'], feature: ['circuitbreaker'] },
      },
      (sdk) => {
        def(sdk, 'target', 'iotgo')
        def(sdk, 'feature', 'circuitbreaker')
        tree(sdk, 'src', 'cmp', 'iotgo')
        tree(sdk, 'tm', 'iotgo')
      })

    try {
      const sdk = Path.join(dir, '.sdk')
      const found = validateManifest(Fs, sdk, manifestOf(sdk), KINDS)

      deepStrictEqual(found, [], 'a valid package produced findings')
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })


  test('a claim with nothing behind it is an ERROR', () => {
    // The whole point. `package add` would install the items listed before
    // this one and then throw, leaving the project half-installed.
    const dir = makePackage(
      {
        sdkgen: { package: 1 }, name: '@acme/sdkgen-iot',
        provides: { target: ['ghost'] },
      })

    try {
      const sdk = Path.join(dir, '.sdk')
      const found = validateManifest(Fs, sdk, manifestOf(sdk), KINDS)

      deepStrictEqual(errors(found), [
        'manifest-item-missing', 'manifest-item-missing',
        'manifest-item-missing',
      ], 'the definition, the components and the templates are all missing')

      ok(found.every((f: any) => f.note.includes('ghost')),
        'a finding did not name the item it is about')
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })


  test('a target needs its component and template trees, not just a model', () => {
    // A model file alone looks complete and installs nothing usable:
    // components are dispatched by the convention `cmp/<t>/Main_<t>`.
    const dir = makePackage(
      {
        sdkgen: { package: 1 }, name: '@acme/sdkgen-iot',
        provides: { target: ['iotgo'] },
      },
      (sdk) => {
        def(sdk, 'target', 'iotgo')
        tree(sdk, 'tm', 'iotgo')
      })

    try {
      const sdk = Path.join(dir, '.sdk')
      const found = validateManifest(Fs, sdk, manifestOf(sdk), KINDS)

      deepStrictEqual(errors(found), ['manifest-item-missing'])
      ok(found[0].note.includes('src/cmp/iotgo'),
        'the missing tree was not named: ' + found[0].note)
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })


  test('a FEATURE needs only its definition', () => {
    // Deliberately not its per-target source: a feature package ships
    // overlays only for the targets it supports, and declaring that coverage
    // is `targetsSupported`'s job. Requiring source for every target would
    // make a correct feature package unpublishable.
    const dir = makePackage(
      {
        sdkgen: { package: 1 }, name: '@acme/sdkgen-cb',
        provides: { feature: ['circuitbreaker'] },
      },
      (sdk) => def(sdk, 'feature', 'circuitbreaker'))

    try {
      const sdk = Path.join(dir, '.sdk')
      deepStrictEqual(
        validateManifest(Fs, sdk, manifestOf(sdk), KINDS), [])
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })


  test('something on disk that nobody claims is a WARNING', () => {
    // It works — it is just undiscoverable, which is nearly always a
    // forgotten manifest edit rather than a broken package. Warning, not
    // error: refusing to install the rest of a package over it would be a
    // worse outcome than saying so.
    const dir = makePackage(
      {
        sdkgen: { package: 1 }, name: '@acme/sdkgen-iot',
        provides: { target: ['iotgo'] },
      },
      (sdk) => {
        def(sdk, 'target', 'iotgo')
        tree(sdk, 'src', 'cmp', 'iotgo')
        tree(sdk, 'tm', 'iotgo')
        def(sdk, 'feature', 'forgotten')
      })

    try {
      const sdk = Path.join(dir, '.sdk')
      const found = validateManifest(Fs, sdk, manifestOf(sdk), KINDS)

      deepStrictEqual(errors(found), [], 'an unclaimed extra failed the package')
      deepStrictEqual(found.map((f: any) => f.point),
        ['manifest-item-unclaimed'])
      ok(found[0].note.includes('forgotten'))
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })


  test('an unknown kind names the ones that exist', () => {
    const dir = makePackage({
      sdkgen: { package: 1 }, name: '@acme/sdkgen-iot',
      provides: { widget: ['thing'] },
    })

    try {
      const sdk = Path.join(dir, '.sdk')
      const found = validateManifest(Fs, sdk, manifestOf(sdk), KINDS)

      deepStrictEqual(errors(found), ['manifest-unknown-kind'])
      ok(found[0].note.includes('feature') && found[0].note.includes('target'),
        'the error did not say which kinds exist: ' + found[0].note)
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })


  test('a malformed manifest reports ONCE, not a cascade', () => {
    // With no `provides` there is nothing to compare, so continuing would
    // invent findings about `undefined` and bury the one that matters.
    const dir = makePackage({ name: '@acme/sdkgen-iot' })

    try {
      const sdk = Path.join(dir, '.sdk')
      const found = validateManifest(Fs, sdk, manifestOf(sdk), KINDS)

      deepStrictEqual(errors(found).sort(),
        ['manifest-provides-missing', 'manifest-unversioned'])
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })


  test('a manifest from the FUTURE is refused, saying both versions', () => {
    // Forward-incompatible only: a later schema may use fields this
    // generator would misread. "Too new, upgrade sdkgen" is actionable;
    // "invalid" is not.
    const dir = makePackage({
      sdkgen: { package: SCHEMA + 1 }, name: '@acme/sdkgen-iot', provides: {},
    })

    try {
      const sdk = Path.join(dir, '.sdk')
      const found = validateManifest(Fs, sdk, manifestOf(sdk), KINDS)

      deepStrictEqual(errors(found), ['manifest-schema-too-new'])
      ok(found[0].note.includes(String(SCHEMA + 1)) &&
        found[0].note.includes(String(SCHEMA)),
        'the error named only one of the two versions: ' + found[0].note)
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })


  test('`provides: {}` is a deliberate, valid claim', () => {
    const dir = makePackage({
      sdkgen: { package: 1 }, name: '@acme/sdkgen-empty', provides: {},
    })

    try {
      const sdk = Path.join(dir, '.sdk')
      deepStrictEqual(
        validateManifest(Fs, sdk, manifestOf(sdk), KINDS), [])
    }
    finally {
      Fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})


// THE BUNDLED SCAFFOLD IS THE FIRST PACKAGE (design §2).
//
// Dogfooding, the migration path, and — through the guard below — the reason
// the manifest cannot drift from the scaffold: adding a target without
// listing it fails here.
describe('the bundled manifest', () => {

  test('validates against its own scaffold', () => {
    const found = validateManifest(
      Fs, SCAFFOLD, manifestOf(SCAFFOLD), KINDS)

    deepStrictEqual(found, [],
      'the shipped manifest disagrees with the shipped scaffold:\n  ' +
      found.map((f: any) => f.note).join('\n  '))
  })


  test('provides EXACTLY what the scaffold ships', () => {
    // The validator above catches a claim with nothing behind it and an
    // unclaimed extra, which is the same set — stated directly here so a
    // failure reads as a diff of two lists rather than as a pile of findings.
    const manifest: any = manifestOf(SCAFFOLD)

    for (const kind of ['target', 'feature']) {
      deepStrictEqual(
        [...(manifest.provides[kind] ?? [])].sort(),
        definitionNames(Fs, SCAFFOLD, kind),
        kind + ': project/sdkgen-package.json disagrees with ' +
        'project/.sdk/model/' + kind + '/ — add or remove the ' + kind +
        ' there too')
    }
  })


  test('its version tracks the npm package', () => {
    // Stamped by `npm run embed-version`, not hand-edited: they ship as one
    // artifact, and `package update @voxgig/sdkgen` acts on the difference.
    const manifest: any = manifestOf(SCAFFOLD)
    const pkg = JSON.parse(Fs.readFileSync(
      Path.resolve(__dirname, '..', 'package.json'), 'utf8'))

    strictEqual(manifest.version, pkg.version,
      'run `npm run embed-version` (or bump both) — the scaffold and the ' +
      'npm package ship together and must not claim different versions')
  })


  test('it is where a consumer will look for it', () => {
    // `project/`, not `project/.sdk/` — a package root is the PARENT of the
    // `.sdk` folder, so a consumer resolving
    // `node_modules/@voxgig/sdkgen/project/<t>` finds it beside the scaffold.
    ok(Fs.existsSync(Path.join(PROJECT, MANIFEST)),
      'the bundled manifest is not at project/' + MANIFEST)
  })
})
