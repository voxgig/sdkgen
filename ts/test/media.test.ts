
import { test, describe } from 'node:test'
import { ok, deepStrictEqual, strictEqual } from 'node:assert'

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import Path from 'node:path'

import { memfs } from 'memfs'
import { transform } from 'sucrase'

import * as struct from '@voxgig/struct'

import { SdkGen, configDefinition, bodyNote, opRawBody } from '../dist/sdkgen'

import { STAGE, SCAFFOLD, makeLog, layeredFs, makeModel, makeRoot } from './generateharness'
import { MEDIA_MODEL } from './mediaprobes'


const TM = Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')


function loadTs(rel: string): any {
  const file = Path.join(TM, rel)
  const js = transform(readFileSync(file, 'utf8'), {
    transforms: ['typescript', 'imports'],
    filePath: file,
  }).code

  const req = (p: string) => '../types' === p ? {} : p.startsWith('.') ?
    loadTs(Path.relative(TM, Path.resolve(Path.dirname(file), p)) + '.ts') : require(p)

  const mod: any = { exports: {} }
  const fn = new Function('exports', 'require', 'module', '__dirname', '__filename', js)
  fn(mod.exports, req, mod, Path.dirname(file), file)
  return mod.exports
}


const STEPS = ['Param', 'PrepareHeaders', 'PrepareBody', 'TransformRequest', 'MakeFetchDef']

const PIPES: Record<string, any> = {
  ts: Object.assign({}, ...STEPS.map((s) => loadTs('ts/src/utility/' + s + 'Utility.ts'))),
  js: Object.assign({}, ...STEPS.map((s) =>
    require(Path.join(TM, 'js', 'src', 'utility', s + 'Utility.js')))),
}


const TRANSFORM = { req: '`reqdata`', res: '`body`' }

const CATAAS = {
  kind: 'json', media: 'application/json', alternatives: [
    { kind: 'raw', media: 'image/jpeg', binary: true },
    { kind: 'raw', media: 'image/png', binary: true },
    { kind: 'raw', media: 'text/html' },
  ],
}

const IMAGES = {
  kind: 'raw', media: 'image/jpeg', binary: true, alternatives: [
    { kind: 'raw', media: 'image/png', binary: true },
    { kind: 'raw', media: 'text/html' },
  ],
}

const UPLOAD = {
  kind: 'raw', media: 'application/pdf', binary: true, alternatives: [
    { kind: 'raw', media: 'image/png', binary: true },
  ],
}


// One point per case, as apidef writes it, made runtime config by
// configDefinition, the function every generated SDK's config comes from.
function point(opname: string, extra: any): any {
  const model = {
    const: { Name: 'Media' },
    main: {
      kit: {
        entity: {
          cat: {
            name: 'cat', fields: {},
            op: {
              [opname]: {
                name: opname, points: [{
                  m: 'create' === opname ? 'POST' : 'GET', o: '/cat/{id}',
                  s: [{ lit: 'cat' }, { var: 'id' }],
                  g: {
                    params: [{ k: 'param', n: 'id', or: 'id', r: true, t: '`$STRING`' }],
                    header: [
                      { k: 'header', n: 'accept', or: 'Accept', r: false, t: '`$STRING`' },
                      { k: 'header', n: 'content_type', or: 'Content-Type', r: false, t: '`$STRING`' },
                    ],
                  },
                  q: { exist: ['id'] },
                  t: TRANSFORM,
                  ...extra,
                }],
              },
            },
          },
        },
        config: { headers: {} },
        info: { servers: [{ url: 'https://api.test' }] },
      },
    },
  }
  return configDefinition(model as any).def.entity.cat.op[opname].points[0]
}


const DEFAULT_HEADERS = { 'content-type': 'application/json' }


// A call through the shipped templates, as makeSpec and makeRequest run them,
// stopping at the definition the fetcher would be given.
function call(lang: string, opname: string, pt: any, args: any, headers: any = DEFAULT_HEADERS) {
  const pipe = PIPES[lang]
  const input = 'create' === opname || 'update' === opname ? 'data' : 'match'

  const ctx: any = {
    out: {},
    op: { name: opname, input, points: [pt] },
    point: pt,
    client: { options: () => ({ headers: struct.clone(headers) }) },
    utility: {
      struct,
      transformRequest: pipe.transformRequest,
      makeUrl: () => 'https://api.test/cat/c1',
      makeError: (_c: any, err: any) => { throw err },
    },
    match: {},
    data: {},
    reqmatch: 'match' === input ? args : {},
    reqdata: 'data' === input ? args : {},
    result: {},
    error: (code: string, msg: string) => Object.assign(new Error(msg), { code }),
  }

  ctx.spec = { method: pt.method, headers: pipe.prepareHeaders(ctx) }
  ctx.spec.body = pipe.prepareBody(ctx)

  return pipe.makeFetchDef(ctx)
}


const BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a, 0xff])


describe('media: the config carries what a point declares', () => {

  test('rb and rs reach the runtime point as body and response', () => {
    const pt = point('create', { rb: UPLOAD, rs: CATAAS })
    deepStrictEqual(pt.body, UPLOAD)
    deepStrictEqual(pt.response, CATAAS)
  })

  test('a point without them carries neither', () => {
    const pt = point('load', {})
    strictEqual('body' in pt, false)
    strictEqual('response' in pt, false)
  })
})


describe('media: Accept follows the success response', () => {

  for (const lang of Object.keys(PIPES)) {

    test(lang + ': JSON beside images and HTML asks for JSON alone', () => {
      const def = call(lang, 'load', point('load', { rs: CATAAS }), { id: 'c1' })
      strictEqual(def.headers.accept, 'application/json')
    })

    test(lang + ': a JSON-only response asks for JSON', () => {
      const def = call(lang, 'load', point('load', { rs: { kind: 'json', media: 'application/json' } }),
        { id: 'c1' })
      strictEqual(def.headers.accept, 'application/json')
    })

    test(lang + ': a +json type is asked for as declared', () => {
      const def = call(lang, 'load',
        point('load', { rs: { kind: 'json', media: 'application/vnd.cat+json' } }), { id: 'c1' })
      strictEqual(def.headers.accept, 'application/vnd.cat+json')
    })

    test(lang + ': no JSON asks for every declared type, in order', () => {
      const def = call(lang, 'load', point('load', { rs: IMAGES }), { id: 'c1' })
      strictEqual(def.headers.accept, 'image/jpeg, image/png, text/html')
    })

    test(lang + ': no declared response body sends no Accept', () => {
      const def = call(lang, 'load', point('load', {}), { id: 'c1' })
      deepStrictEqual(def.headers, { 'content-type': 'application/json' })
    })

    test(lang + ': the client option wins, whatever its case', () => {
      const def = call(lang, 'load', point('load', { rs: CATAAS }), { id: 'c1' },
        { Accept: 'image/png' })
      deepStrictEqual(def.headers, { Accept: 'image/png' })
    })

    test(lang + ': a header argument wins', () => {
      const def = call(lang, 'load', point('load', { rs: CATAAS }), { id: 'c1', accept: 'text/html' })
      strictEqual(def.headers.accept, 'text/html')
    })
  }
})


describe('media: a raw request body is sent as given', () => {

  for (const lang of Object.keys(PIPES)) {

    test(lang + ': bytes go out unencoded, under the declared type', () => {
      const def = call(lang, 'create', point('create', { rb: UPLOAD, rs: CATAAS }),
        { id: 'c1', name: 'a.png', $body: BYTES })
      strictEqual(def.body, BYTES)
      deepStrictEqual(Buffer.from(def.body), BYTES)
      strictEqual(def.headers['content-type'], 'application/pdf')
      strictEqual(def.headers.accept, 'application/json')
      strictEqual(def.duplex, undefined)
    })

    test(lang + ': a content-type the client sets is kept', () => {
      const def = call(lang, 'create', point('create', { rb: UPLOAD }),
        { id: 'c1', $body: BYTES }, { 'Content-Type': 'image/png' })
      deepStrictEqual(def.headers, { 'Content-Type': 'image/png' })
    })

    test(lang + ': a caller content-type wins over a default beside it', () => {
      const def = call(lang, 'create', point('create', { rb: UPLOAD }),
        { id: 'c1', $body: BYTES }, { 'content-type': 'application/json', 'Content-Type': 'image/png' })
      deepStrictEqual(def.headers, { 'Content-Type': 'image/png' })
    })

    test(lang + ': a content-type header argument wins', () => {
      const def = call(lang, 'create', point('create', { rb: UPLOAD }),
        { id: 'c1', content_type: 'image/png', $body: BYTES })
      deepStrictEqual(def.headers, { 'content-type': 'image/png' })
      deepStrictEqual(Buffer.from(def.body), BYTES)
    })

    test(lang + ': typed arrays, ArrayBuffers and Blobs pass through', () => {
      const pt = point('create', { rb: UPLOAD })
      const u8 = new Uint8Array(BYTES)
      strictEqual(call(lang, 'create', pt, { $body: u8 }).body, u8)
      const ab = u8.buffer
      strictEqual(call(lang, 'create', pt, { $body: ab }).body, ab)
      const blob = new Blob([BYTES])
      strictEqual(call(lang, 'create', pt, { $body: blob }).body, blob)
    })

    test(lang + ': a stream passes through, half duplex', () => {
      const stream = new ReadableStream({ start(c) { c.enqueue(BYTES); c.close() } })
      const def = call(lang, 'create', point('create', { rb: UPLOAD }), { $body: stream })
      strictEqual(def.body, stream)
      strictEqual(def.duplex, 'half')
    })

    test(lang + ': text is sent as the string it is', () => {
      const def = call(lang, 'create', point('create', {
        rb: { kind: 'raw', media: 'text/plain', alternatives: [{ kind: 'raw', media: 'text/x-markdown' }] },
      }), { $body: '# Title' })
      strictEqual(def.body, '# Title')
      strictEqual(def.headers['content-type'], 'text/plain')
    })

    test(lang + ': without $body nothing is sent, and no field leaks', () => {
      const def = call(lang, 'create', point('create', { rb: UPLOAD }), { id: 'c1', name: 'a.png' })
      strictEqual(def.body, undefined)
      strictEqual('body' in def, false)
    })
  }
})


describe('media: every other body is JSON, as before', () => {

  for (const lang of Object.keys(PIPES)) {

    test(lang + ': no rb sends the data as JSON', () => {
      const def = call(lang, 'create', point('create', {}), { id: 'c1', name: 'Tom' })
      deepStrictEqual(JSON.parse(def.body), { id: 'c1', name: 'Tom' })
      deepStrictEqual(def.headers, { 'content-type': 'application/json' })
    })

    test(lang + ': a declared JSON type replaces the default', () => {
      const def = call(lang, 'create', point('create', {
        rb: { kind: 'json', media: 'application/merge-patch+json' },
      }), { id: 'c1', name: 'Tom' })
      deepStrictEqual(JSON.parse(def.body), { id: 'c1', name: 'Tom' })
      deepStrictEqual(def.headers, { 'content-type': 'application/merge-patch+json' })
    })

    test(lang + ': a multipart body stays JSON for now', () => {
      const def = call(lang, 'create', point('create', {
        rb: { kind: 'multipart', media: 'multipart/form-data', fields: [{ name: 'file', binary: true }] },
      }), { id: 'c1', name: 'Tom' })
      deepStrictEqual(JSON.parse(def.body), { id: 'c1', name: 'Tom' })
      deepStrictEqual(def.headers, { 'content-type': 'application/json' })
    })

    test(lang + ': a request with no point sets neither header', () => {
      const pipe = PIPES[lang]
      const ctx: any = {
        client: { options: () => ({ headers: { 'content-type': 'application/json' } }) },
        utility: { struct },
      }
      deepStrictEqual(pipe.prepareHeaders(ctx), { 'content-type': 'application/json' })
    })
  }
})


describe('media: the generator', () => {

  const op = (rb: any) => ({ points: [{ m: 'POST', o: '/x', rb }] })

  test('a raw body is found on an active point only', () => {
    deepStrictEqual(opRawBody(op(UPLOAD)), UPLOAD)
    strictEqual(opRawBody(op({ kind: 'json', media: 'application/json' })), undefined)
    strictEqual(opRawBody({ points: [{ a: false, rb: UPLOAD }] }), undefined)
  })

  test('the reference note names $body, the type, and the alternatives', () => {
    const note = bodyNote(op(UPLOAD), { values: 'bytes' })
    ok(note.includes('`$body`'), note)
    ok(note.includes('`application/pdf`'), note)
    ok(note.includes('`image/png`'), note)
  })

  test('a target that cannot send bytes says so', () => {
    const note = bodyNote(op(UPLOAD), { values: 'text', binary: false })
    ok(note.includes('cannot send'), note)
    strictEqual(bodyNote(op({ kind: 'raw', media: 'text/plain' }), { values: 'text', binary: false })
      .includes('cannot send'), false)
  })

  test('a multipart body is noted as sent as JSON', () => {
    ok(bodyNote(op({ kind: 'multipart', media: 'multipart/form-data' }), { values: 'x' })
      .includes('as JSON'))
    strictEqual(bodyNote(op({ kind: 'json', media: 'application/json' }), { values: 'x' }), '')
    strictEqual(bodyNote(op(undefined), { values: 'x' }), '')
  })
})


describe('media: every target documents a raw body', () => {

  test('the reference names $body for each raw create and update', async () => {
    const cmpdir = Path.join(SCAFFOLD, 'src', 'cmp')
    const targets = readdirSync(cmpdir)
      .filter((t) => existsSync(Path.join(cmpdir, t, 'ReadmeRef_' + t + '.ts')))
      .sort()
    ok(20 <= targets.length, 'expected every bundled target, got ' + targets.length)

    const { fs, vol } = memfs({})
    const sdkgen = SdkGen({ fs: layeredFs(fs), folder: STAGE, root: '', pino: makeLog() })
    const cwd = process.cwd()
    process.chdir(SCAFFOLD)
    try {
      await sdkgen.generate({ model: makeModel(targets, undefined, MEDIA_MODEL), root: makeRoot() })
    }
    finally {
      process.chdir(cwd)
    }

    const out = vol.toJSON() as Record<string, string>
    const missing: string[] = []
    for (const target of targets) {
      const ref = Object.entries(out).find(([p]) =>
        Path.relative(STAGE, p).split(Path.sep).join('/') === target + '/REFERENCE.md')
      const text = String(ref?.[1] ?? '')
      const notes = text.split('\n').filter((line) => line.includes('pass it as `$body`'))
      if (2 !== notes.length ||
        !notes.some((n) => n.includes('`application/pdf`') && n.includes('`image/png`')) ||
        !notes.some((n) => n.includes('`text/plain`'))) {
        missing.push(target + ': ' + JSON.stringify(notes))
      }
    }
    deepStrictEqual(missing, [])
  })
})
