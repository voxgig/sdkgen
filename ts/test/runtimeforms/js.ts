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
  // Any runtime parameter may be left out; a page signature marks one that
  // may with `?` (or a default), as the ts page does.
  optional: (p) => !/^\s*[\w$]+\s*:/.test(p) || /^\s*[\w$]+\?/.test(p) || /=/.test(p),
  returns: () => '',
  entityCtor: 'constructor',
  public: {
    client: /^  (?:static |async \*?)?((?!constructor\b)[a-z]\w*)\(/gm,
    entity: /^  (?:static |async \*?)?((?!constructor\b)[a-z]\w*)(?:\(|\s*=\s)/gm,
  },
  undocumented: {
    graphql: 'a GraphQL request through the pipeline; no reference page documents it',
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
  namesWhy: 'the page names a parameter by what it holds (as the ts page does); js passes them by position',
  renames: { reqmatch: 'match', reqdata: 'data', testoptsarg: 'testopts', sdkoptsarg: 'sdkopts' },
  exceptions: {
    'optional:entity streamIterator': 'js lets any argument be left out, but stream passes action on as the operation name (opname: action), so a call without it names no operation; the page shows it required, as the ts page does',
  },
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
      file: MAIN, quote: 'return this._utility.struct.clone(this._utility)',
      unquoted: { object: 'the Utility instance itself (clone hands a class instance back by reference)' },
    },
    'ref.facts.client[0].returns': {
      file: MAIN, quote: 'return this._utility.struct.clone(this._options)',
      also: [{ file: OPTIONS, quote: 'const layer = (b) => null != b && \'object\' === typeof b && !Array.isArray(b) ? b : {}' }],
    },
    'ref.facts.none': { file: BASE, quote: 'return undefined' },
    'facts.collection': { value: "array", file: 'tm/js/src/utility/MakeResultUtility.js', quote: ["if ('list' == op.name) {", 'result.resdata = []', 'result.resdata.push(ent)'] },
    'ref.facts.container': { file: OPTIONS, quote: 'const layer = (b) => null != b && \'object\' === typeof b && !Array.isArray(b) ? b : {}' },
    'ref.facts.valueType.OBJECT': { file: OPTIONS, quote: 'const layer = (b) => null != b && \'object\' === typeof b && !Array.isArray(b) ? b : {}' },
    'ref.facts.direct.returns': {
      file: MAIN, quote: ['async direct(fetchargs) {', 'ok: null == err && status >= 200 && status < 300,', '        status,\n        headers: fetched.headers,\n        data: json,'],
      unquoted: { Promise: 'direct is an async method, so it returns a Promise; js spells no return type' },
    },
    'ref.facts.direct.signal': {
      file: REQUEST, quote: ['if (true === fetchdef.signal?.aborted) {', 'throw fetchdef.signal.reason'],
      also: [{ file: FETCHDEF, quote: 'fetchdef.signal = ctx.ctrl.signal' },
        { file: BASE, quote: '//   - `ctrl` (pipeline control) and `signal` (AbortSignal) are honoured:' }],
    },
    'ref.facts.direct.abortCode': { file: REQUEST, quote: "const abort = ctx.error('request_aborted', 'request aborted')" },
    'ref.facts.prepare.returns': {
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
    'ref.facts.body.once': { value: "a stream", file: REQUEST, quote: '// A stream can be read once; read it now, so that a retry sends the same bytes.' },
    'ref.facts.cancel': { value: true, file: FETCHDEF, quote: 'fetchdef.signal = ctx.ctrl.signal' },
  },
}

export { forms }
