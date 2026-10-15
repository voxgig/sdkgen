
import { test, describe } from 'node:test'
import { ok, strictEqual, deepStrictEqual } from 'node:assert'

import { readFileSync, readdirSync } from 'node:fs'
import Path from 'node:path'

import { transform } from 'sucrase'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')


// Load a shipped template module. Type-only imports (`../types`) vanish in
// the transpile; value imports of sibling templates are shimmed, since the
// point is to exercise THIS file, not its neighbours.
function loadTemplate(rel: string, shims: Record<string, any> = {}): any {
  const file = Path.join(TM, rel)
  const js = transform(readFileSync(file, 'utf8'), {
    transforms: ['typescript', 'imports'],
    filePath: file,
  }).code

  const req = (p: string) => {
    for (const key of Object.keys(shims)) {
      if (p === key || p.endsWith(key)) {
        return shims[key]
      }
    }
    return require(p)
  }

  const mod: any = { exports: {} }
  const fn = new Function('exports', 'require', 'module', '__dirname', '__filename', js)
  fn(mod.exports, req, mod, Path.dirname(file), file)
  return mod.exports
}


const { makeResult } = loadTemplate('ts/src/utility/MakeResultUtility.ts')

const { done } = loadTemplate('ts/src/utility/DoneUtility.ts', {
  '../types': {},
  './CleanUtility': { clean: (_c: any, v: any) => v },
})


// A stand-in for the generated entity class: stateful, with the `data()` and
// `deleted()` surface the real EntityBase fragment emits.
function makeEntity(name = 'planet') {
  const ent: any = {
    Name: name,
    _data: {},
    _deleted: false,
    data(d?: any) {
      if (null != d) { ent._data = d }
      return ent._data
    },
    deleted() { return true === ent._deleted },
    make: () => makeEntity(name),
  }
  return ent
}


// A context shaped the way the generated pipeline builds one.
function makeCtx(opname: string, resdata: any, entity?: any) {
  return {
    out: {},
    ctrl: {},
    op: { name: opname, entity: 'planet' },
    entity: null === entity ? null : (entity || makeEntity()),
    spec: { step: '' },
    result: { ok: true, resdata },
    utility: {
      transformResponse: () => { },
      makeError: () => { throw new Error('makeError must not run on the ok path') },
      struct: { delprop: (o: any, k: string) => { delete o[k] } },
    },
    error: (code: string) => ({ code }),
  }
}


describe('list result shaping', () => {

  test('makeResult wraps each list record in an entity instance', () => {
    const made: any[] = []
    const records = [{ id: 'mercury' }, { id: 'venus' }]

    const ctx: any = {
      out: {}, ctrl: {},
      op: { name: 'list', entity: 'planet' },
      entity: { make: () => ({ data: (d: any) => made.push(d) }) },
      spec: { step: '' },
      result: { ok: true, resdata: records },
      utility: { transformResponse: () => { } },
      error: (code: string) => ({ code }),
    }

    const out: any = makeResult(ctx)

    strictEqual(out.resdata.length, 2, 'list lost records')
    strictEqual(made.length, 2, 'list records were not wrapped as entities')
    deepStrictEqual(made, records, 'the wrapped entities did not absorb the records')
  })


  // Callers iterate a list result unconditionally, so an absent or empty list
  // must still be an array.
  test('an absent or empty list normalises to an empty array', () => {
    for (const resdata of [[], null, undefined]) {
      const ctx: any = {
        out: {}, ctrl: {},
        op: { name: 'list', entity: 'planet' },
        entity: { make: () => ({ data: () => { } }) },
        spec: { step: '' },
        result: { ok: true, resdata },
        utility: { transformResponse: () => { } },
        error: (code: string) => ({ code }),
      }
      deepStrictEqual((makeResult(ctx) as any).resdata, [],
        'list resdata ' + JSON.stringify(resdata) + ' did not normalise')
    }
  })
})


describe('done', () => {

  function doneCtx(ok: boolean, resdata: any) {
    return {
      ctrl: {},
      op: { name: 'load' },
      result: { ok, resdata },
      utility: {
        makeError: () => 'ERROR',
        struct: { delprop: (o: any, k: string) => { delete o[k] } },
      },
    }
  }


  test('returns the result data on the ok path', () => {
    const record = { id: 'earth' }
    deepStrictEqual(done(doneCtx(true, record) as any), record)
  })


  test('delegates to makeError when the result is not ok', () => {
    strictEqual(done(doneCtx(false, undefined) as any), 'ERROR')
  })
})


describe('error contract', () => {

  const { makeError } = loadTemplate('ts/src/utility/MakeErrorUtility.ts', {
    '../types': {},
    './CleanUtility': {
      clean: (_c: any, v: any) => v,
      setMessage: (e: any, text: string) => { e.message = text },
    },
    './StructUtility': {
      clone: (v: any) => JSON.parse(JSON.stringify(v)),
      delprop: (o: any, k: string) => { delete o[k] },
    },
  })


  // A minimal context whose `error()` builds the real generated error class
  // shape (status defaulting to -1, notFound derived from it).
  function errorCtx(status: any) {
    class SdkError extends Error {
      code: string
      status = -1
      get notFound(): boolean { return 404 === this.status }
      constructor(code: string, msg: string) { super(msg); this.code = code }
    }

    return {
      op: { name: 'load' },
      ctrl: { throw: true },
      spec: {},
      result: { status, statusText: 'Not Found', ok: false },
      utility: { clean: (_c: any, v: any) => v },
      error: (code: string, msg: string) => new SdkError(code, msg),
    }
  }


  function thrown(ctx: any): any {
    try {
      makeError(ctx as any)
    }
    catch (err: any) {
      return err
    }
    return null
  }


  test('the status is on the error itself', () => {
    const err = thrown(errorCtx(404))

    ok(null != err, 'makeError did not throw')
    strictEqual(err.status, 404, 'err.status was not promoted')
    strictEqual(err.notFound, true, 'err.notFound did not derive from the status')

    strictEqual(err.result.status, 404)
  })


  test('a non-404 is not notFound', () => {
    const err = thrown(errorCtx(500))
    strictEqual(err.status, 500)
    strictEqual(err.notFound, false)
  })


  test('a request with no response reports -1', () => {
    const err = thrown(errorCtx(undefined))
    strictEqual(err.status, -1)
    strictEqual(err.notFound, false)
  })
})


// Each target's error answers the not-found question from its own status, in
// that language's idiom. The probe lane in generatedcompile.test.ts runs it
// on a real 404 and on an unsent request.
describe('not-found predicate', () => {

  const SDK = Path.resolve(TM, '..')

  const PREDICATE: Record<string, [string, string]> = {
    c: ['tm/c/core/error.c',
      'bool pn_error_not_found(const PNError* e) { return e && 404 == e->status;'],
    clojure: ['tm/clojure/src/sdk/core.clj', '(defn not-found? [e] (= 404 (err-status e)))'],
    cpp: ['tm/cpp/core/types.hpp', 'bool notFound() const { return 404 == status; }'],
    csharp: ['src/cmp/csharp/fragment/SdkError.fragment.cs', 'public bool NotFound => 404 == Status;'],
    elixir: ['tm/elixir/lib/projectname/error.ex',
      'def not_found?(%__MODULE__{} = e), do: 404 == status(e)'],
    go: ['tm/go/core/error.go', 'func (e *ProjectNameError) NotFound() bool { return 404 == e.Status'],
    java: ['src/cmp/java/fragment/SdkError.fragment.java',
      'public boolean notFound() { return 404 == this.status;'],
    js: ['src/cmp/js/fragment/SdkError.fragment.js', 'get notFound() { return 404 === this.status }'],
    kotlin: ['src/cmp/kotlin/fragment/SdkError.fragment.kt',
      'val notFound: Boolean get() = 404 == this.status'],
    lua: ['tm/lua/core/error.lua', 'function ProjectNameError:not_found() return 404 == self.status'],
    ocaml: ['src/cmp/ocaml/SdkError_ocaml.ts', 'let not_found (e : t) : bool = 404 = status e'],
    perl: ['tm/perl/core/error.pm', 'sub not_found { return 404 == ($_[0]->{status} // -1)'],
    php: ['tm/php/core/Error.php',
      'public function notFound(): bool { return 404 === $this->status;'],
    py: ['tm/py/pkg/core/error.py', 'def not_found(self): return 404 == self.status'],
    rb: ['tm/rb/core/error.rb', 'def not_found? 404 == @status'],
    rust: ['src/cmp/rust/fragment/SdkError.fragment.rs',
      'pub fn not_found(&self) -> bool { 404 == self.status'],
    scala: ['tm/scala/core/SdkError.scala', 'def notFound: Boolean = 404 == this.status'],
    swift: ['src/cmp/swift/fragment/SdkError.fragment.swift',
      'public var notFound: Bool { 404 == status }'],
    ts: ['src/cmp/ts/fragment/SdkError.fragment.ts',
      'get notFound(): boolean { return 404 === this.status }'],
    zig: ['tm/zig/core/error.zig',
      'pub fn not_found(self: *const ProjectNameError) bool { return 404 == self.status;'],
  }

  const flat = (text: string) => text.replace(/\s+/g, ' ')

  test('every SDK target defines it', () => {
    const consumers = ['go-cli', 'go-mcp', 'py-data']
    const targets = readdirSync(TM).filter((name) => !consumers.includes(name)).sort()
    deepStrictEqual(Object.keys(PREDICATE).sort(), targets)
  })

  for (const [target, [file, source]] of Object.entries(PREDICATE)) {
    test(target + ': 404 == status', () => {
      ok(flat(readFileSync(Path.join(SDK, file), 'utf8')).includes(flat(source)),
        target + ': ' + file + ' does not define the predicate as ' + source)
    })
  }
})
