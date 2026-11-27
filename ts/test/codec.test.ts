
import { test, describe } from 'node:test'
import { ok, deepStrictEqual, strictEqual } from 'node:assert'

import { readFileSync, existsSync } from 'node:fs'
import Path from 'node:path'

import { transform } from 'sucrase'

import * as struct from '@voxgig/struct'

import { CLEAN_DEFAULTS } from './featureharness'
import { CODEC_CASES, CodecCase } from './codeccases'


// The shipped ts and js body codecs, run for real: what each sends for a
// form or multipart body, how a raw response is read to a bound, and what a
// binary handle runs. CODEC_TM points the suite at another scaffold tree.

const TM = process.env.CODEC_TM || Path.resolve(__dirname, '..', 'project', '.sdk', 'tm')

const OPTSPEC = { maxBuffer: 16777216, clean: CLEAN_DEFAULTS }


// A loader for one target's src tree: relative imports resolve inside it and
// share one module cache, so a class is the same class everywhere.
function loader(lang: string): (rel: string) => any {
  const cache: Record<string, any> = {}
  const root = Path.join(TM, lang, 'src')

  const load = (file: string): any => {
    if (null != cache[file]) {
      return cache[file].exports
    }
    const mod: any = { exports: {} }
    cache[file] = mod
    const code = transform(readFileSync(file, 'utf8'), {
      transforms: ['typescript', 'imports'],
      filePath: file,
    }).code
    const req = (p: string) => {
      if (/(^|\/)types$/.test(p)) return {}
      if (/(^|\/)Schema$/.test(p)) return { OPTSPEC }
      if (!p.startsWith('.')) return require(p)
      const base = Path.resolve(Path.dirname(file), p)
      const found = [base + '.' + lang, Path.join(base, 'index.' + lang)].find(existsSync)
      if (null == found) throw new Error('codec test: no module ' + p + ' from ' + file)
      return load(found)
    }
    new Function('exports', 'require', 'module', '__dirname', '__filename', code)(
      mod.exports, req, mod, Path.dirname(file), file)
    return mod.exports
  }

  return (rel: string) => load(Path.join(root, rel + '.' + lang))
}


function runtime(lang: string): any {
  const load = loader(lang)
  const mod = (name: string) => load('utility/' + name)
  return {
    binary: mod('BinaryUtility'),
    form: mod('codec/FormCodec'),
    multipart: mod('codec/MultipartCodec'),
    raw: mod('codec/RawCodec'),
    handle: mod('codec/HandleCodec'),
    point: mod('MakePointUtility'),
    body: mod('PrepareBodyUtility'),
    headers: mod('PrepareHeadersUtility'),
    request: mod('TransformRequestUtility'),
    fetchdef: mod('MakeFetchDefUtility'),
    result: mod('ResultBodyUtility'),
    clean: mod('CleanUtility'),
  }
}

const LANGS = ['ts', 'js']

const RT: Record<string, any> = Object.fromEntries(LANGS.map((lang) => [lang, runtime(lang)]))


function codedError(code: string, msg: string): Error {
  return Object.assign(new Error(msg), { code })
}


function makeCtx(rt: any, kase: { op?: string, body?: any, response?: any, data?: any,
  match?: any, ctrl?: any, action?: string, options?: any }): any {
  const op = kase.op || 'create'
  const input = ['create', 'update', 'patch'].includes(op) ? 'data' : 'match'
  const point: any = {
    method: 'create' === op ? 'POST' : 'load' === op ? 'GET' : 'PUT',
    parts: ['episode'], args: {}, params: [], alias: {},
    select: null == kase.action ? {} : { $action: kase.action },
    transform: { req: '`reqdata`', res: '`body`' },
  }
  if (null != kase.body) point.body = kase.body
  if (null != kase.response) point.response = kase.response

  const ctx: any = {
    out: {},
    op: { name: op, entity: 'episode', input, points: [point] },
    point,
    ctrl: kase.ctrl || {},
    options: { headers: {}, ...(kase.options || {}) },
    client: { options: () => ({ headers: { 'content-type': 'application/json' } }) },
    match: {},
    data: {},
    reqmatch: 'match' === input ? (kase.match ?? kase.data ?? {}) : (kase.match ?? {}),
    reqdata: 'data' === input ? (kase.data ?? {}) : {},
    result: { status: 200, headers: {} },
    error: codedError,
  }
  ctx.utility = {
    struct,
    makeError: (_c: any, err: any) => { throw err },
    makeUrl: () => 'http://api.test/episode',
    transformRequest: rt.request.transformRequest,
    clean: rt.clean.clean,
    multipartBoundary: () => 'BOUNDARY',
    codec: {
      form: rt.form.encodeForm,
      multipart: rt.multipart.encodeMultipart,
      raw: rt.raw.readRaw,
    },
  }
  return ctx
}


// The source a case names, built by the target's own constructor.
function sourceOf(rt: any, spec: any): any {
  if (null == spec || 'object' !== typeof spec) {
    return spec
  }
  if (Array.isArray(spec)) {
    return spec.map((s) => sourceOf(rt, s))
  }
  if ('string' === typeof spec.$source) {
    const data = Buffer.from(spec.$source, 'latin1')
    return true === spec.blob ?
      rt.binary.binary.bytes(new Blob([data], { type: spec.type || '' }), { name: spec.name }) :
      rt.binary.binary.bytes(new Uint8Array(data), { name: spec.name, type: spec.type })
  }
  if ('string' === typeof spec.$bytes) {
    return new Uint8Array(Buffer.from(spec.$bytes, 'latin1'))
  }
  return Object.fromEntries(Object.keys(spec).map((k) => [k, sourceOf(rt, spec[k])]))
}


// makePoint's own checks, then the request as makeSpec and makeFetchDef build it.
async function send(rt: any, kase: CodecCase): Promise<{ type?: string, body?: string } | Error> {
  const ctx = makeCtx(rt, { ...kase, data: sourceOf(rt, kase.data), match: sourceOf(rt, kase.match) })
  try {
    const refused = rt.binary.bytesRefused(ctx) ?? rt.binary.liftSources(ctx)
    if (refused) return refused
    ctx.spec = { method: ctx.point.method, headers: rt.headers.prepareHeaders(ctx) }
    ctx.spec.body = rt.body.prepareBody(ctx)
    const def = rt.fetchdef.makeFetchDef(ctx)
    const raw = def.body
    const body = null == raw ? undefined : raw instanceof Blob ?
      Buffer.from(await raw.arrayBuffer()).toString('latin1') :
      'string' === typeof raw ? raw : Buffer.from(raw).toString('latin1')
    return { type: def.headers['content-type'], body }
  }
  catch (err: any) {
    return err
  }
}


describe('codec: the request body, by the point\'s kind', () => {
  for (const lang of LANGS) {
    for (const kase of CODEC_CASES.filter((c) => 'request' === c.side)) {
      test(lang + ': ' + kase.name, async () => {
        const out: any = await send(RT[lang], kase)
        if (null != kase.error) {
          ok(out instanceof Error, 'expected ' + kase.error + ', got ' + JSON.stringify(out))
          strictEqual((out as any).code, kase.error, (out as any).message)
          return
        }
        ok(!(out instanceof Error), String(out?.message) + ' ' + String(out?.code))
        strictEqual(out.type, kase.type)
        strictEqual(out.body, kase.wire)
      })
    }
  }
})


// A transport response as the shipped Response class holds one.
function response(body: any, headers: Record<string, string> = {}): any {
  const lower: Record<string, string> = {}
  for (const k of Object.keys(headers)) lower[k.toLowerCase()] = headers[k]
  return {
    status: 200,
    body,
    headers: { get: (k: string) => lower[k.toLowerCase()], forEach: (f: any) => Object.keys(lower).forEach((k) => f(lower[k], k)) },
    json: async () => { throw new Error('a raw body is never parsed as JSON') },
  }
}


function streamOf(chunks: string[], read: { n: number }): ReadableStream {
  let i = 0
  return new ReadableStream({
    pull(ctl) {
      if (i < chunks.length) {
        read.n++
        ctl.enqueue(new Uint8Array(Buffer.from(chunks[i++], 'latin1')))
      }
      else {
        ctl.close()
      }
    },
  })
}


describe('codec: a raw response is read to maxBuffer', () => {
  for (const lang of LANGS) {
    const rt = RT[lang]

    const read = async (rs: any, res: any, options: any = {}, ctrl: any = {}) => {
      const ctx = makeCtx(rt, { op: 'load', response: rs, options, ctrl })
      ctx.response = res
      await rt.result.resultBody(ctx)
      return ctx
    }

    test(lang + ': text comes back under $body', async () => {
      const ctx = await read({ kind: 'raw', media: 'text/vtt' },
        response(streamOf(['WEBVTT\n\n', '00:01 cafÃ©'], { n: 0 }), { 'content-length': '22' }))
      strictEqual(ctx.result.err, undefined)
      deepStrictEqual(ctx.result.body, { $body: 'WEBVTT\n\n00:01 café' })
    })

    test(lang + ': a declared length past the bound is refused unread', async () => {
      const seen = { n: 0 }
      const ctx = makeCtx(rt, { op: 'load', response: { kind: 'raw', media: 'text/plain' },
        options: { maxBuffer: 8 } })
      ctx.response = response(streamOf(['0123456789'], seen), { 'Content-Length': '10' })
      let err: any
      try { await rt.result.resultBody(ctx) } catch (e) { err = e }
      strictEqual(err?.code, 'response_too_large')
      strictEqual(seen.n, 0, 'the body was read')
      ok(/10 bytes exceeds maxBuffer \(8 bytes\)/.test(err.message), err.message)
    })

    test(lang + ': an undeclared length is counted as it arrives', async () => {
      const ctx = makeCtx(rt, { op: 'load', response: { kind: 'raw', media: 'text/plain' },
        options: { maxBuffer: 8 } })
      ctx.response = response(streamOf(['01234', '56789', 'abcde'], { n: 0 }))
      let err: any
      try { await rt.result.resultBody(ctx) } catch (e) { err = e }
      strictEqual(err?.code, 'response_too_large')
      ok(/longer than maxBuffer \(8 bytes\)/.test(err.message), err.message)
    })

    test(lang + ': the bound is inclusive', async () => {
      const ctx = await read({ kind: 'raw', media: 'text/plain' },
        response(streamOf(['01234567'], { n: 0 })), { maxBuffer: 8 })
      deepStrictEqual(ctx.result.body, { $body: '01234567' })
    })

    test(lang + ': a binary handle read takes the bytes, the record none', async () => {
      const transfer: any = { slot: 'audio', direction: 'read' }
      const ctx = await read({ kind: 'raw', media: 'audio/wav', binary: true },
        response(streamOf(['RIFF\u0000ÿ'], { n: 0 })), {}, { transfer })
      strictEqual(ctx.result.body, undefined)
      deepStrictEqual(Array.from(transfer.bytes), [0x52, 0x49, 0x46, 0x46, 0, 0xff])
    })

    test(lang + ': bytes past the bound are binary_too_large', async () => {
      const ctx = makeCtx(rt, { op: 'load', response: { kind: 'raw', media: 'audio/wav', binary: true },
        options: { maxBuffer: 4 }, ctrl: { transfer: { slot: 'audio', direction: 'read' } } })
      ctx.response = response(streamOf(['RIFF', 'data'], { n: 0 }))
      let err: any
      try { await rt.result.resultBody(ctx) } catch (e) { err = e }
      strictEqual(err?.code, 'binary_too_large')
    })

    test(lang + ': a binary route through a plain operation is refused before it is sent', () => {
      const ctx = makeCtx(rt, { op: 'load', action: 'audio',
        response: { kind: 'raw', media: 'audio/wav', binary: true } })
      const err: any = rt.binary.bytesRefused(ctx)
      strictEqual(err?.code, 'binary_sink_required')
      ok(err.message.includes('binary(\'audio\').bytes()'), err.message)
      strictEqual(rt.binary.bytesRefused(makeCtx(rt, { op: 'load', ctrl: { transfer: {} },
        response: { kind: 'raw', media: 'audio/wav', binary: true } })), undefined)
    })

    test(lang + ': a JSON response is read as before', async () => {
      const ctx = makeCtx(rt, { op: 'load', response: { kind: 'json', media: 'application/json' } })
      ctx.response = { ...response('x'), json: async () => ({ id: 'e1' }) }
      await rt.result.resultBody(ctx)
      deepStrictEqual(ctx.result.body, { id: 'e1' })
    })
  }
})


describe('codec: the binary handle runs the entity\'s own operation', () => {
  const SLOTS = {
    '': { action: '', read: 'load' },
    audio: { action: 'audio', read: 'load', write: 'update' },
    cover: { action: 'cover', write: 'create' },
  }

  for (const lang of LANGS) {
    const rt = RT[lang]

    const entity = () => {
      const calls: any[] = []
      const ent: any = {
        name: 'episode',
        calls,
        _entctx: { error: codedError },
        async load(match: any, ctrl: any) {
          calls.push(['load', match, ctrl])
          ctrl.transfer.bytes = new Uint8Array([1, 2, 3])
          return ent
        },
        async update(data: any, ctrl: any) { calls.push(['update', data, ctrl]); return ent },
        async create(data: any, ctrl: any) { calls.push(['create', data, ctrl]); return ent },
      }
      return ent
    }

    test(lang + ': bytes() is a load of the slot\'s action, resolving to the bytes', async () => {
      const ent = entity()
      const got = await new rt.handle.BinaryHandle(ent, SLOTS, 'audio').bytes(undefined, { explain: {} })
      deepStrictEqual(Array.from(got), [1, 2, 3])
      deepStrictEqual(ent.calls[0][1], { $action: 'audio' })
      deepStrictEqual(ent.calls[0][2].transfer.direction, 'read')
      ok(null != ent.calls[0][2].explain, 'the caller\'s control is passed on')
    })

    test(lang + ': the unnamed slot is the plain load', async () => {
      const ent = entity()
      await new rt.handle.BinaryHandle(ent, SLOTS).bytes()
      deepStrictEqual(ent.calls[0][1], {})
    })

    test(lang + ': put() sends the source as the raw body and resolves to the entity', async () => {
      const ent = entity()
      const src = rt.binary.binary.bytes(new Uint8Array([9]))
      strictEqual(await new rt.handle.BinaryHandle(ent, SLOTS, 'audio').put(src), ent)
      deepStrictEqual(ent.calls[0][0], 'update')
      strictEqual(ent.calls[0][1].$body, src)
      strictEqual(ent.calls[0][1].$action, 'audio')
      strictEqual(ent.calls[0][2].transfer.direction, 'write')
      await new rt.handle.BinaryHandle(ent, SLOTS, 'cover').put(src)
      strictEqual(ent.calls[1][0], 'create')
    })

    for (const [method, args] of [['save', ['/tmp/x']], ['stream', []], ['open', []]] as const) {
      test(lang + ': ' + method + '() needs the binary feature', async () => {
        let err: any
        try { await (new rt.handle.BinaryHandle(entity(), SLOTS, 'audio') as any)[method](...args) }
        catch (e) { err = e }
        strictEqual(err?.code, 'binary_feature_inactive')
      })
    }

    test(lang + ': a range needs the binary feature', async () => {
      let err: any
      try { await new rt.handle.BinaryHandle(entity(), SLOTS, 'audio').bytes({ range: { start: 0 } }) }
      catch (e) { err = e }
      strictEqual(err?.code, 'binary_feature_inactive')
    })

    test(lang + ': an unknown slot and a missing direction are refused', async () => {
      let err: any
      try { await new rt.handle.BinaryHandle(entity(), SLOTS, 'nope').bytes() } catch (e) { err = e }
      strictEqual(err?.code, 'binary_slot_unknown')
      err = undefined
      try { await new rt.handle.BinaryHandle(entity(), SLOTS, 'cover').bytes() } catch (e) { err = e }
      strictEqual(err?.code, 'binary_slot_direction')
      err = undefined
      try { await new rt.handle.BinaryHandle(entity(), SLOTS).put(new Uint8Array(1)) } catch (e) { err = e }
      strictEqual(err?.code, 'binary_slot_direction')
    })
  }
})


describe('codec: bodies are described in every diagnostic', () => {
  for (const lang of LANGS) {
    const rt = RT[lang]

    test(lang + ': an encoded multipart body, and a source, never their bytes', async () => {
      const kase = CODEC_CASES.find((c) => 'multipart: a file part, a list and a text field' === c.name)!
      const ctx = makeCtx(rt, { ...kase, data: sourceOf(rt, kase.data) })
      rt.binary.liftSources(ctx)
      ctx.spec = { method: 'POST', headers: rt.headers.prepareHeaders(ctx) }
      ctx.spec.body = rt.body.prepareBody(ctx)
      ctx.options.__derived__ = { clean: rt.clean.makeCleanConfig(CLEAN_DEFAULTS) }

      const out = JSON.stringify(rt.clean.clean(ctx, { spec: ctx.spec, sources: ctx.sources }))
      ok(!out.includes('RIFF'), out)
      ok(!out.includes('Pilot'), out)
      const desc = rt.clean.clean(ctx, ctx.spec).body
      deepStrictEqual(desc, { binary$: 'bytes', size: ctx.spec.body.byteLength,
        type: 'multipart/form-data; boundary=BOUNDARY' })
      deepStrictEqual(JSON.parse(JSON.stringify(ctx.sources.file)),
        { binary$: 'bytes', size: 8, type: 'audio/wav' })
    })
  }
})


describe('codec: core opens no file', () => {
  // The multipart boundary reads the operating system's random source, which
  // is the one file core may open.
  test('no perl codec utility opens a file', () => {
    for (const rel of ['utility/binary.pm', 'utility/prepare_body.pm', 'utility/make_point.pm',
      'utility/codec/form.pm', 'utility/codec/multipart.pm', 'utility/codec/raw.pm',
      'utility/codec/handle.pm']) {
      const src = readFileSync(Path.join(TM, 'perl', rel), 'utf8')
        .replace(/open\(my \$fh, '<:raw', '\/dev\/urandom'\)/g, '')
      ok(!/\b(sys)?open(dir)?\s*\(|\bopen\s+my\b|IO::File|File::Slurp|Path::Tiny|-[ef]\s+\$/
        .test(src), 'perl ' + rel + ' opens a file')
    }
  })

  test('no lua codec utility opens a file', () => {
    for (const rel of ['utility/binary.lua', 'utility/prepare_body.lua', 'utility/make_point.lua',
      'utility/codec/form.lua', 'utility/codec/multipart.lua', 'utility/codec/raw.lua',
      'utility/codec/handle.lua']) {
      const src = readFileSync(Path.join(TM, 'lua', rel), 'utf8')
        .replace(/io\.open\("\/dev\/urandom", "rb"\)/g, '')
      ok(!/\bio\.(open|lines|input)\b|\bos\.(remove|rename)\b|require\(?\s*["']lfs["']/.test(src),
        'lua ' + rel + ' opens a file')
    }
  })

  test('no ts or js utility imports fs', () => {
    for (const lang of LANGS) {
      for (const rel of ['BinaryUtility', 'PrepareBodyUtility', 'MakePointUtility',
        'codec/FormCodec', 'codec/MultipartCodec', 'codec/RawCodec', 'codec/HandleCodec']) {
        const src = readFileSync(Path.join(TM, lang, 'src', 'utility', rel + '.' + lang), 'utf8')
        ok(!/['"](node:)?fs(\/promises)?['"]/.test(src), lang + ' ' + rel + ' imports fs')
      }
    }
  })

  // C# has no import to scan: System.IO is implicit, and Stream lives in it.
  test('no csharp codec source touches a file', () => {
    for (const rel of ['core/BinarySource.cs', 'utility/Binary.cs', 'utility/PrepareBody.cs',
      'utility/MakePoint.cs', 'utility/codec/FormCodec.cs', 'utility/codec/MultipartCodec.cs',
      'utility/codec/RawCodec.cs', 'utility/codec/HandleCodec.cs']) {
      const src = readFileSync(Path.join(TM, 'csharp', rel), 'utf8')
      ok(!/\b(File|FileInfo|FileStream|Directory|DirectoryInfo)\s*[.(]/.test(src) &&
        !/\bnew\s+(FileStream|FileInfo|StreamReader)\b/.test(src), 'csharp ' + rel + ' touches a file')
    }
  })

  test('no swift codec source touches a file', () => {
    for (const rel of ['core/BinarySource.swift', 'utility/Binary.swift', 'utility/Prepare.swift',
      'utility/Make.swift', 'utility/codec/FormCodec.swift', 'utility/codec/MultipartCodec.swift',
      'utility/codec/RawCodec.swift', 'utility/codec/HandleCodec.swift']) {
      const src = readFileSync(Path.join(TM, 'swift', 'Sources', 'ProjectNameSDK', rel), 'utf8')
      ok(!/\b(FileManager|FileHandle|InputStream)\b|contentsOfFile|fileURLWithPath|(Data|String)\(contentsOf/.test(src),
        'swift ' + rel + ' touches a file')
    }
  })

  test('no rb codec, lift or handle source reaches the filesystem', () => {
    for (const rel of ['binary', 'prepare_body', 'make_point', 'codec/form_codec',
      'codec/multipart_codec', 'codec/raw_codec', 'codec/handle_codec']) {
      const src = readFileSync(Path.join(TM, 'rb', 'utility', rel + '.rb'), 'utf8')
      ok(!/(^|[^.\w])(File|IO|Dir|Pathname|Kernel|URI)\.(open|read|new|binread|foreach)\b|require\s+['"](fileutils|pathname|open-uri)['"]/m
        .test(src), 'rb ' + rel + ' reaches the filesystem')
    }
  })

  test('no php codec, lift or handle source reaches the filesystem', () => {
    for (const rel of ['Binary', 'PrepareBody', 'MakePoint', 'codec/FormCodec',
      'codec/MultipartCodec', 'codec/RawCodec', 'codec/HandleCodec']) {
      const src = readFileSync(Path.join(TM, 'php', 'utility', rel + '.php'), 'utf8')
      ok(!/\b(fopen|file_get_contents|file_put_contents|readfile|file|opendir|scandir|tmpfile|tempnam|SplFileObject|SplFileInfo)\s*\(/
        .test(src), 'php ' + rel + ' reaches the filesystem')
    }
  })

  test('no ocaml codec, lift or handle source reaches the filesystem', () => {
    for (const rel of ['sdk_binary', 'codec/form_codec', 'codec/multipart_codec',
      'codec/raw_codec', 'codec/handle_codec']) {
      const src = readFileSync(Path.join(TM, 'ocaml', rel + '.ml'), 'utf8')
      ok(!/\b(open_in\w*|open_out\w*|In_channel|Out_channel|Unix|Filename|Sys\.(file_exists|readdir|is_directory|remove|rename))\b/
        .test(src), 'ocaml ' + rel + ' reaches the filesystem')
    }
  })

  test('no rust codec, lift or body step reaches the filesystem', () => {
    for (const rel of ['binary', 'prepare_body', 'make_point', 'codec/form', 'codec/multipart',
      'codec/raw', 'codec/handle']) {
      const src = readFileSync(Path.join(TM, 'rust', 'utility', rel + '.rs'), 'utf8')
      ok(!/\bstd::fs\b|\bfs::|File::(open|create)|OpenOptions/.test(src), 'rust ' + rel + ' opens a file')
    }
  })

  test('no zig codec, lift or body step reaches the filesystem', () => {
    for (const rel of ['core/binary', 'utility/codec/form', 'utility/codec/multipart',
      'utility/codec/raw', 'utility/codec/handle']) {
      const src = readFileSync(Path.join(TM, 'zig', rel + '.zig'), 'utf8')
      ok(!/\bstd\.fs\b|\bIo\.Dir\b|\bopenFile\b|\bcreateFile\b/.test(src), 'zig ' + rel + ' opens a file')
    }
  })

  test('no elixir or clojure codec source names the filesystem', () => {
    const scans: [string, string[], RegExp][] = [
      ['elixir', ['lib/projectname/binary.ex', 'lib/projectname/codec/form.ex',
        'lib/projectname/codec/multipart.ex', 'lib/projectname/codec/raw.ex',
        'lib/projectname/codec/handle.ex'], /\bFile\.(?!Stream\b)|:file\.|\bPath\./],
      ['clojure', ['src/sdk/binary.clj', 'src/sdk/codec/form.clj', 'src/sdk/codec/multipart.clj',
        'src/sdk/codec/raw.clj', 'src/sdk/codec/handle.clj'],
      /clojure\.java\.io|java\.io\.File\b|java\.nio\.file|\bslurp\b|FileInputStream/],
    ]
    for (const [lang, files, fsre] of scans) {
      for (const rel of files) {
        const src = readFileSync(Path.join(TM, lang, rel), 'utf8')
        ok(!fsre.test(src), lang + ' ' + rel + ' names the filesystem')
      }
    }
  })
})


// Go has no module named fs: a file is reached through os, io/fs, io/ioutil
// or path/filepath, and none of them may be imported by the core codec path.
describe('codec: core opens no file, in go', () => {
  test('no go codec, lift or prepareBody source imports a filesystem package', () => {
    const files = ['core/binary.go', 'utility/binary.go', 'utility/prepare_body.go',
      'utility/make_point.go', 'utility/codec/form_codec.go', 'utility/codec/multipart_codec.go',
      'utility/codec/raw_codec.go', 'utility/codec/handle_codec.go']
    for (const rel of files) {
      const src = readFileSync(Path.join(TM, 'go', rel), 'utf8')
      ok(!/^\s*(\w+\s+)?"(os|io\/fs|io\/ioutil|path\/filepath)"\s*$/m.test(src),
        'go ' + rel + ' imports a filesystem package')
    }
  })
})


// Python opens a file with the open builtin, or through os, io, pathlib or
// shutil: the core codec path names none of them.
describe('codec: core opens no file, in py', () => {
  test('no py codec, lift or prepare_body source opens a file', () => {
    const files = ['core/binary.py', 'utility/binary.py', 'utility/prepare_body.py',
      'utility/make_point.py', 'utility/codec/form_codec.py', 'utility/codec/multipart_codec.py',
      'utility/codec/raw_codec.py', 'utility/codec/handle_codec.py']
    for (const rel of files) {
      const src = readFileSync(Path.join(TM, 'py', 'pkg', rel), 'utf8')
      ok(!/^\s*(import|from)\s+(os|io|pathlib|shutil)\b/m.test(src),
        'py ' + rel + ' imports a filesystem module')
      ok(!/(^|[^.\w])open\(/m.test(src.replace(/def open\(/g, '')),
        'py ' + rel + ' calls open()')
    }
  })
})

