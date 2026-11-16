// How the js runtime writes things: class methods in the Main, EntityBase and
// Entity fragments, the operations as async methods; any parameter may be
// left out.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/js/fragment/Entity${o}Op.fragment.js`)
const MAIN = 'src/cmp/js/fragment/Main.fragment.js'
const BASE = 'src/cmp/js/fragment/EntityBase.fragment.js'
const MEDIA = 'tm/js/src/utility/MediaUtility.js'
const REQUEST = 'tm/js/src/utility/MakeRequestUtility.js'
const FETCHDEF = 'tm/js/src/utility/MakeFetchDefUtility.js'
const OPTIONS = 'tm/js/src/utility/MakeOptionsUtility.js'
const STRUCT = 'tm/js/src/utility/StructUtility.js'
const TIMEOUT = 'tm/js/src/feature/timeout/TimeoutFeature.js'

const forms: Forms = {
  files: {
    client: [MAIN, 'src/cmp/js/MainEntity_js.ts'],
    entity: [BASE, 'src/cmp/js/fragment/Entity.fragment.js'],
    ops: OPS,
  },
  // A method, or a class property with an initialiser at the class body's
  // indent (`name = ''`, EntityBase.fragment.js), which is a field: read
  // without a call.
  decl: (name) => new RegExp(`^(?:[ \\t]+(?:static\\s+|async\\s+\\*?\\s*)*${name}(?=\\()|  ${name}(?=\\s*=\\s))`, 'm'),
  // A declaration with no parameter list is read too: it is the field.
  bare: true,
  param: (p) => ({ name: (/^(?:\.\.\.)?(\w+)/.exec(p.trim()) || ['', ''])[1], type: '' }),
  // A runtime parameter may be left out, except stream's `action`, which it
  // reads unguarded as the operation name (`opname: action`); a page
  // signature marks one that may with `?` (or a default), as the ts page does.
  optional: (p) => /^\s*action\s*$/.test(p) ? false
    : !/^\s*[\w$]+\s*:/.test(p) || /^\s*[\w$]+\?/.test(p) || /=/.test(p),
  // Methods declare no return type; a field's string initialiser is its type.
  returns: (after) => /^\s*=\s*(['"`]).*\1\s*$/.test(after) ? 'string' : '',
  entityCtor: 'constructor',
  public: {
    client: /^  (?:static |async \*?)?((?!constructor\b)[a-z]\w*)\(/gm,
    entity: /^  (?:static |async \*?)?((?!constructor\b)[a-z]\w*)(?:\(|\s*=\s)/gm,
  },
  undocumented: {
    graphql: 'a GraphQL request over the prepare and fetch path direct uses, bypassing the feature pipeline; no reference page documents it',
    toJSON: 'the serialised form JSON.stringify uses',
    toString: 'the printed form',
    markDeleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance; the remove sentence names it through ref.facts.deleted',
    name_: 'the snake form of the entity name, which the code generator fills; the page documents `name`',
  },
  members: {
    options: 'options', utility: 'utility', direct: 'direct', prepare: 'prepare', tester: 'tester',
    data: 'data', match: 'match', make: 'make', client: 'client', entopts: 'entopts', stream: 'stream', name: 'name',
  },
  streamKind: (d) => /async\s*\*/.test(d.head) ? 'streamIterator' : 'stream',
  async: (d) => /\basync\b/.test(d.head),
  style: { exception: 'throw', raises: /\bthrow\b/ },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'constructor', accessor: '${entity.Name}' },
  // How a call is written: `new` for the client class, `.` for every member.
  calls: { on: { instance: ['.'], type: ['.'] } },
  types: { column: 'js' },
  uncompared: { paramTypes: 'js declares no parameter types', returns: 'js declares no return types' },

  // The porter's, from here on.
  // A field is written `name: type`; anything else is a call (as the ts forms).
  sigName: (sig) => /^[\w$]+\s*:/.test(sig) && !sig.includes('(') ? (/^[\w$]+/.exec(sig) as RegExpExecArray)[0]
    : ((/([\w{}$-]+)\s*\(/.exec(sig.replace(/^[^(]*?(->|\.)(?=[\w{}]+\s*\()/, '')) || [])[1] || ''),
  // A field's type, compared with its initialiser; a call's is never written.
  sigReturns: (sig) => /^[\w$]+\s*:/.test(sig) && !sig.includes('(') ? sig.replace(/^[\w$]+\s*:\s*/, '').trim() : '',
  namesWhy: 'the page names a parameter by what it holds (as the ts page does); js passes them by position',
  renames: { reqmatch: 'match', reqdata: 'data', testoptsarg: 'testopts', sdkoptsarg: 'sdkopts' },
  // What the table states besides names, parameters and returns.
  testDecl: 'test',
  expect: { test: { on: 'type' } },
  stream: {
    file: "src/cmp/js/fragment/EntityBase.fragment.js",
    construct: "async *stream(action, args, callopts)", starts: "on iteration",
    run: "const failed = await this._streamSteps(ctx)",
    draw: "for await (const item of result.stream())",
    runs: "as the caller iterates", items: "as the caller iterates",
  },
  cite: {
    // Cited ahead of the provider (brief 7): a later declaration must equal the pinned value.
    'ref.facts.streamSignal': { value: true, file: BASE, quote: ['ctrl.signal = callopts.signal', 'if (signal && signal.aborted) { return }'] },
    'ref.facts.direct.okFalse': { value: "false", file: MAIN, quote: "return { ok: false, err: utility.clean(this._rootctx, fetchdef) }" },
    // The test client's mock without the test feature, cited ahead: the factory's fallback.
    'ref.facts.testMock': { value: "generated", file: "src/cmp/js/fragment/Config.fragment.js", quote: "const fc = FEATURE_CLASS[fn] || BaseFeature" },

    // The getters: data, match and entopts make a new object; options a deep clone of plain data.
    'ref.facts.entity[0].copy': { value: true, file: BASE, quote: 'let out = struct.clone(this._data)' },
    'ref.facts.entity[1].copy': { value: true, file: BASE, quote: 'let out = struct.clone(this._match)' },
    'ref.facts.entity[5].copy': { value: true, file: BASE, quote: 'return this._utility.struct.merge([{}, this._entopts])' },
    'ref.facts.client[0].copy': { value: true, file: MAIN, quote: 'return this._utility.struct.clone(this._options)' },
    // Decision 13: utility() runs struct.clone on a Utility instance, which
    // clone hands back by reference (a non-plain object is not copied).
    'ref.facts.client[1].copy': { value: false, file: MAIN, quote: 'return this._utility.struct.clone(this._utility)',
      also: [{ file: 'tm/js/src/utility/StructUtility.js', quote: ["'Object' !== v.constructor.name &&", "return (refs.push(v), '`$REF:' + (refs.length - 1) + '`')"] },
        { file: 'tm/js/src/utility/Utility.js', quote: 'class Utility {' }] },
    'ref.facts.client[1].kind': { value: "utility", file: MAIN, quote: 'return this._utility.struct.clone(this._utility)' },
    'ref.facts.client[1].returns': {
      value: 'object', file: MAIN, quote: 'return this._utility.struct.clone(this._utility)',
      unquoted: { object: 'the Utility instance itself (clone hands a class instance back by reference)' },
    },
    // The options map: absent, `{}`; validated as a map, which the struct
    // library tests as a non-array of typeof `object`.
    'ref.facts.client[0].returns': {
      value: 'object', file: MAIN, quote: ['return this._utility.struct.clone(this._options)', 'this._options = this._utility.makeOptions(this._rootctx)'],
      also: [{ file: OPTIONS, quote: ['let opts = struct.clone(options || {})', 'opts = validate(opts, optspec)'] },
        { file: STRUCT, quote: ["const S_object = 'object'", 'return null != val && S_object == typeof val && !Array.isArray(val)'] }],
    },
    // The struct library's none is undefined; an argument left undefined is
    // taken as none (the test client's options, an accessor's entopts).
    'ref.facts.none': {
      value: 'undefined', file: STRUCT, quote: ['const NONE = undefined', 'function getdef(val, alt) {', 'if (NONE === val) {'],
      also: [{ file: MAIN, quote: 'const sdkopts = getdef(clone(sdkoptsarg), {})' }, { file: BASE, quote: 'entopts = entopts || {}' }],
    },
    'facts.collection': { value: "array", file: 'tm/js/src/utility/MakeResultUtility.js', quote: ["if ('list' == op.name) {", 'result.resdata = []', 'result.resdata.push(ent)'] },
    'ref.facts.container': {
      value: 'object', file: OPTIONS, quote: ['let opts = struct.clone(options || {})', 'opts = validate(opts, optspec)'],
      also: [{ file: STRUCT, quote: ["const S_object = 'object'", 'return null != val && S_object == typeof val && !Array.isArray(val)'] }],
    },
    // An option holding a map: the feature option is tested as typeof
    // `object`; the validator rejects a non-map where its spec has a map.
    'ref.facts.valueType.OBJECT': {
      value: 'object', file: OPTIONS, quote: ": null != opts.feature && 'object' === typeof opts.feature",
      also: [{ file: STRUCT, quote: ['} else if (!ismap(tval)) {', "inj.errs.push(_invalidTypeMsg(slice(inj.path, -1), S_object, typify(tval), tval), 'V0220')", "const S_object = 'object'"] }],
    },
    'ref.facts.direct.returns': {
      value: 'Promise<{ ok, status, headers, data }>',
      file: MAIN, quote: ['async direct(fetchargs) {', 'ok: null == err && status >= 200 && status < 300,', '        status,\n        headers: fetched.headers,\n        data: json,'],
      unquoted: { Promise: 'direct is an async method, so it returns a Promise; js spells no return type' },
    },
    // The signal fetch is given: read for `aborted` and `reason`, listened to
    // for `abort`, and swapped for an AbortController's own by the timeout.
    'ref.facts.direct.signal': {
      value: 'AbortSignal', file: REQUEST, quote: ['if (true === fetchdef.signal?.aborted) {', 'throw fetchdef.signal.reason'],
      also: [{ file: FETCHDEF, quote: 'fetchdef.signal = ctx.ctrl.signal' },
        { file: TIMEOUT, quote: ['const caller = fetchdef.signal', 'controller = new globalThis.AbortController()', 'fetchdef = { ...fetchdef, signal: controller.signal }', "caller.addEventListener('abort', follow, { once: true })"] },
        { file: 'tm/js/src/utility/FetcherUtility.js', quote: 'const response = await fetch(fullurl, fetchdef)' }],
      unquoted: { AbortSignal: 'js spells no type: what the runtime reads (aborted, reason, the abort event) and puts in its place (an AbortController\'s signal) is the AbortSignal interface, which fetch takes as its signal' },
    },
    'ref.facts.direct.abortCode': { value: 'request_aborted', file: REQUEST, quote: "const abort = ctx.error('request_aborted', 'request aborted')" },
    'ref.facts.prepare.returns': {
      value: 'Promise<{ url, method, headers, body } | Error>',
      file: MAIN, quote: ['async prepare(fetchargs) {', 'return ctx.error(\'spec_method_allow\'', 'return makeFetchDef(ctx)'],
      also: [{ file: FETCHDEF, quote: ['    url,\n    method: spec.method,\n    headers: spec.headers,', 'fetchdef.body ='] },
        { file: 'tm/js/src/Context.js', quote: 'return new ProjectNameError(code, msg, this)' }],
      unquoted: {
        Error: 'ctx.error returns a ProjectNameError, which extends Error',
        Promise: 'prepare is an async method, so it returns a Promise; js spells no return type',
      },
    },
    'ref.facts.prepare.fails': { value: "value", file: MAIN, quote: 'return ctx.error(\'spec_method_allow\'' },
    'ref.facts.body.values': { value: "a `Buffer`, `Uint8Array`, `ArrayBuffer`, `Blob`, stream or string",
      file: MEDIA, quote: ['return value instanceof ArrayBuffer || ArrayBuffer.isView(value) ||', '(\'undefined\' !== typeof Blob && value instanceof Blob) || isStream(value)', 'return new Uint8Array(chunk)'],
      also: [{ file: FETCHDEF, quote: 'fetchdef.body = isRawValue(body) || (\'object\' !== typeof body && !isJsonRequest(ctx.point)) ?' }],
      unquoted: {
        Buffer: 'a Node Buffer is a Uint8Array, which ArrayBuffer.isView accepts',
      },
    },
    'ref.facts.body.once': { value: "a stream", file: REQUEST, quote: ['if (isStream(fetchdef.body)) {', 'fetchdef.body = await readStream(fetchdef.body)'] },
    'ref.facts.cancel': { value: true, file: FETCHDEF, quote: 'fetchdef.signal = ctx.ctrl.signal' },
  },
}

export { forms }
