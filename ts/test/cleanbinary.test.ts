import { test, describe } from 'node:test'
import { strictEqual, deepStrictEqual, ok } from 'node:assert'

import Path from 'node:path'
import { Readable } from 'node:stream'
import { inspect } from 'node:util'

import * as struct from '@voxgig/struct'

import { CLEAN_DEFAULTS, sandboxLoad } from './featureharness'


// ADR-004: a body of bytes never reaches a diagnostic. The shipped ts and js
// utilities, run for real, with a marker inside the bytes that is searched
// for in everything that leaves.

const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')

const MARK = 'ZZ-FILE-CANARY-7d1c9e4a'
const CONTENT = 'RIFF\u0000\u0001' + MARK + '\u0002ÿdata'
const SIZE = Buffer.from(CONTENT, 'latin1').length

function bytes(): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(SIZE)
  out.set(Buffer.from(CONTENT, 'latin1'))
  return out
}


// Every value ts and js accept as a raw body, with what must describe it.
const CARRIERS: Record<string, { make: () => any, desc: any }> = {
  'a Uint8Array': { make: () => bytes(), desc: { binary$: 'bytes', size: SIZE } },
  'a Buffer': { make: () => Buffer.from(bytes()), desc: { binary$: 'bytes', size: SIZE } },
  'an ArrayBuffer': { make: () => bytes().buffer, desc: { binary$: 'bytes', size: SIZE } },
  'a DataView': { make: () => new DataView(bytes().buffer), desc: { binary$: 'bytes', size: SIZE } },
  'a Blob': {
    make: () => new Blob([bytes()], { type: 'audio/wav' }),
    desc: { binary$: 'bytes', size: SIZE, type: 'audio/wav' },
  },
  'a web stream': { make: () => new Blob([bytes()]).stream(), desc: { binary$: 'stream' } },
  'a node stream holding a chunk': {
    make: () => { const s = new Readable({ read() { } }); s.push(Buffer.from(bytes())); return s },
    desc: { binary$: 'stream' },
  },
  'an async iterable': {
    make: () => (async function* () { yield bytes() })(),
    desc: { binary$: 'stream' },
  },
}


function isByte(v: any): boolean {
  return 'number' === typeof v && Number.isInteger(v) && 0 <= v && v <= 255
}


// Every place the marker survives, in any form bytes travel in: text, a list
// of byte values, bytes keyed by index, or a container that was not copied out.
function carried(val: any, mark = MARK): string[] {
  const needle = Buffer.from(mark, 'latin1')
  const found: string[] = []
  const seen = new Set<any>()

  const walk = (v: any, path: string) => {
    if (null == v) {
      return
    }
    if ('string' === typeof v) {
      if (v.includes(mark)) found.push(path + ': text')
      return
    }
    if ('object' !== typeof v || seen.has(v)) {
      return
    }
    seen.add(v)

    if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
      found.push(path + ': a byte container')
      return
    }
    if (v instanceof Blob) {
      found.push(path + ': a Blob')
      return
    }
    if (v instanceof ReadableStream || 'function' === typeof v[Symbol.asyncIterator]) {
      found.push(path + ': a stream')
      return
    }

    if (Array.isArray(v)) {
      if (0 < v.length && v.every(isByte) && -1 !== Buffer.from(v).indexOf(needle)) {
        found.push(path + ': a list of byte values')
      }
      v.forEach((item, i) => walk(item, path + '[' + i + ']'))
      return
    }

    const keys = Object.keys(v)
    if (0 < keys.length && keys.every((k, i) => String(i) === k && isByte(v[k])) &&
      -1 !== Buffer.from(keys.map((k) => v[k])).indexOf(needle)) {
      found.push(path + ': bytes keyed by index')
    }
    for (const k of keys) walk(v[k], path + '.' + k)
  }

  walk(val, '$')
  return found
}


function loadClean(lang: string): any {
  return sandboxLoad(Path.join(TM, lang, 'src', 'utility', 'CleanUtility.' + lang), {
    '../types': {},
    '../Schema': { OPTSPEC: { clean: CLEAN_DEFAULTS } },
    './MediaUtility': sandboxLoad(Path.join(TM, lang, 'src', 'utility', 'MediaUtility.' + lang), {}),
  })
}


function loadPipeline(lang: string): { cleanmod: any, makeError: any, done: any } {
  const cleanmod = loadClean(lang)
  const { makeError } = sandboxLoad(
    Path.join(TM, lang, 'src', 'utility', 'MakeErrorUtility.' + lang), {
      '../types': {},
      '../Result': { Result: class { } },
      './CleanUtility': cleanmod,
      './StructUtility': { clone: struct.clone, delprop: struct.delprop },
    })
  const { done } = sandboxLoad(Path.join(TM, lang, 'src', 'utility', 'DoneUtility.' + lang), {
    '../types': {}, './CleanUtility': cleanmod })
  return { cleanmod, makeError, done }
}


function ctxWith(mod: any, over?: any): any {
  return {
    options: { __derived__: { clean: mod.makeCleanConfig({ ...CLEAN_DEFAULTS, ...(over || {}) }) } },
  }
}


// A raw upload point, as the generated config carries the model's `rb`.
const BINARY_POINT = { body: { kind: 'raw', media: 'audio/wav', binary: true } }
const TEXT_POINT = { body: { kind: 'raw', media: 'text/vtt' } }


for (const lang of ['ts', 'js']) {

  describe('clean: bytes are described, never copied (' + lang + ')', () => {

    test('the detector sees a leak: with clean off the marker shows', () => {
      const mod = loadClean(lang)
      const ctx = ctxWith(mod, { active: false })
      for (const [name, carrier] of Object.entries(CARRIERS)) {
        const out = mod.clean(ctx, { spec: { body: carrier.make() } })
        ok(0 < carried(out).length, name + ': the detector is blind to it')
      }
      ok(0 < carried({ body: [...bytes()] }).length, 'a list of byte values')
      ok(0 < carried({ body: { ...bytes() } }).length, 'bytes keyed by index')
      ok(0 < carried({ body: 'x' + MARK }).length, 'text')
    })


    for (const [name, carrier] of Object.entries(CARRIERS)) {
      test(name + ' is replaced by what describes it', () => {
        const mod = loadClean(lang)
        const ctx = ctxWith(mod)
        const out = mod.clean(ctx, {
          spec: { method: 'PUT', headers: { 'content-type': 'audio/wav' }, body: carrier.make() },
          note: 'kept',
        })
        deepStrictEqual(carried(out), [])
        deepStrictEqual(out.spec.body, carrier.desc)
        strictEqual(out.spec.method, 'PUT')
        strictEqual(out.note, 'kept')
        strictEqual(Object.getPrototypeOf(out.spec.body), Object.prototype)
      })
    }


    test('bytes are described wherever they sit, and the live value is untouched', () => {
      const mod = loadClean(lang)
      const ctx = ctxWith(mod)
      const live = bytes()
      const val = { a: [{ deep: live }], b: { c: Buffer.from(bytes()) }, n: 1 }
      const out = mod.clean(ctx, val)
      deepStrictEqual(carried(out), [])
      deepStrictEqual(out, {
        a: [{ deep: { binary$: 'bytes', size: SIZE } }],
        b: { c: { binary$: 'bytes', size: SIZE } },
        n: 1,
      })
      strictEqual(val.a[0].deep, live)
      strictEqual(live.length, SIZE)
      deepStrictEqual(mod.clean(ctx, bytes()), { binary$: 'bytes', size: SIZE })
    })


    test('a property of an Error that holds bytes is described in place', () => {
      const mod = loadClean(lang)
      const ctx = ctxWith(mod)
      const err: any = new Error('upload failed')
      err.body = bytes()
      err.spec = { body: Buffer.from(bytes()) }
      strictEqual(mod.clean(ctx, err), err)
      deepStrictEqual(carried({ ...err }), [])
      deepStrictEqual(err.body, { binary$: 'bytes', size: SIZE })
      deepStrictEqual(err.spec.body, { binary$: 'bytes', size: SIZE })
    })


    test('a body the model marks binary is described whatever carries it', () => {
      const mod = loadClean(lang)
      const body = CONTENT
      const spec = { method: 'PUT', headers: { 'content-type': 'audio/wav' }, body }
      const ctx = { ...ctxWith(mod), point: BINARY_POINT, spec, reqdata: { id: 'e1', $body: body } }
      const desc = { binary$: 'bytes', size: Buffer.byteLength(body, 'utf8'), type: 'audio/wav' }

      const out = mod.clean(ctx, {
        spec, fetchdef: { url: 'http://h/p', body }, reqdata: ctx.reqdata, other: 'unrelated',
      })
      deepStrictEqual(carried(out), [])
      deepStrictEqual(out.spec.body, desc)
      deepStrictEqual(out.fetchdef.body, desc)
      deepStrictEqual(out.reqdata, { id: 'e1', $body: desc })
      strictEqual(out.other, 'unrelated')
      strictEqual(spec.body, body)

      // The declared type goes on typed bytes too, when they are that body.
      const typed = bytes()
      const tctx = { ...ctxWith(mod), point: BINARY_POINT, spec: { body: typed }, reqdata: { $body: typed } }
      deepStrictEqual(mod.clean(tctx, tctx.spec).body, { binary$: 'bytes', size: SIZE, type: 'audio/wav' })
    })


    test('a raw body the model does not mark binary is text, and stays', () => {
      const mod = loadClean(lang)
      const body = 'WEBVTT\n\n00:00.000 --> 00:01.000\nhello'
      const spec = { method: 'PUT', headers: { 'content-type': 'text/vtt' }, body }
      const ctx = { ...ctxWith(mod), point: TEXT_POINT, spec, reqdata: { $body: body } }
      strictEqual(mod.clean(ctx, spec).body, body)

      // And a JSON point's record is data, as it always was.
      const jctx = { ...ctxWith(mod), point: { body: { kind: 'json', media: 'application/json' } },
        spec: { body: { name: 'n1' } } }
      deepStrictEqual(mod.clean(jctx, jctx.spec).body, { name: 'n1' })
    })
  })


  describe('clean: a failed upload keeps its bytes out of what it throws (' + lang + ')', () => {

    for (const [name, carrier] of Object.entries(CARRIERS)) {
      test('makeError: ' + name, () => {
        const { cleanmod, makeError } = loadPipeline(lang)
        const body = carrier.make()
        const explain: any = {}
        const ctx: any = {
          ...ctxWith(cleanmod),
          op: { name: 'update' },
          ctrl: { throw: true, explain },
          point: BINARY_POINT,
          reqdata: { id: 'e1', $body: body },
          spec: { method: 'PUT', url: 'http://h/episode/e1/audio',
            headers: { 'content-type': 'audio/wav' }, body },
          result: { ok: false, status: 500, statusText: 'Server Error',
            err: new Error('request: 500: Server Error') },
        }

        let thrown: any = null
        try {
          makeError(ctx)
        }
        catch (e: any) {
          thrown = e
        }

        strictEqual(thrown?.name, 'Error')
        strictEqual(thrown.status, 500)
        deepStrictEqual(carried(thrown.spec), [])
        deepStrictEqual(carried({ ...thrown }), [])
        deepStrictEqual(thrown.spec.body, { ...carrier.desc, type: 'audio/wav' })
        ok(!JSON.stringify(thrown.spec).includes(MARK))
        ok(!inspect(thrown, { depth: 8 }).includes(MARK))
        ok(JSON.stringify(thrown.spec).length < 400, 'the spec is a description, not a payload')
        // The live request is what the transport sends, and stays whole.
        strictEqual(ctx.spec.body, body)
      })
    }


    test('makeError: a string holding the bytes', () => {
      const { cleanmod, makeError } = loadPipeline(lang)
      const ctx: any = {
        ...ctxWith(cleanmod),
        op: { name: 'update' },
        ctrl: { throw: true },
        point: BINARY_POINT,
        reqdata: { id: 'e1', $body: CONTENT },
        spec: { method: 'PUT', headers: { 'content-type': 'audio/wav' }, body: CONTENT },
        result: { ok: false, status: 413, err: new Error('request: 413: Too Large') },
      }
      let thrown: any = null
      try {
        makeError(ctx)
      }
      catch (e: any) {
        thrown = e
      }
      deepStrictEqual(carried(thrown.spec), [])
      deepStrictEqual(thrown.spec.body,
        { binary$: 'bytes', size: Buffer.byteLength(CONTENT, 'utf8'), type: 'audio/wav' })
    })


    test('done: the explain record describes the body in the spec and in the fetch definition', () => {
      const { cleanmod, done } = loadPipeline(lang)
      const body = bytes()
      const spec = { method: 'PUT', headers: { 'content-type': 'audio/wav' }, body }
      const result: any = { ok: true, status: 204, resdata: { id: 'e1' } }
      const explain: any = { spec, fetchdef: { url: 'http://h/p', method: 'PUT', body }, result }
      const ctx: any = {
        ...ctxWith(cleanmod), point: BINARY_POINT, spec, reqdata: { $body: body },
        result, ctrl: { explain }, utility: { struct, makeError: (c: any) => c.result.err },
      }
      deepStrictEqual(done(ctx), { id: 'e1' })
      deepStrictEqual(carried(explain), [])
      const desc = { binary$: 'bytes', size: SIZE, type: 'audio/wav' }
      deepStrictEqual(explain.spec.body, desc)
      deepStrictEqual(explain.fetchdef.body, desc)
      strictEqual(spec.body, body)
    })
  })
}
