// How the ts runtime writes things: class methods in the Main, EntityBase
// and Entity fragments, the operations as async methods.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/ts/fragment/Entity${o}Op.fragment.ts`)
const MAIN = 'src/cmp/ts/fragment/Main.fragment.ts'
const BASE = 'src/cmp/ts/fragment/EntityBase.fragment.ts'
const MEDIA = 'tm/ts/src/utility/MediaUtility.ts'

const forms: Forms = {
  files: {
    client: [MAIN, 'src/cmp/ts/MainEntity_ts.ts'],
    entity: [BASE, 'src/cmp/ts/fragment/Entity.fragment.ts'],
    ops: OPS,
  },
  // A method, or a class property with an initialiser at the class body's indent
  // (`name = ''`), which is a field: read without a call.
  decl: (name) => new RegExp(`^(?:[ \\t]+(?:static\\s+|async\\s+\\*?\\s*)*${name}(?=\\()|  ${name}(?=\\s*(?::[^=\\n(]+)?=\\s))`, 'm'),
  bare: true,
  // A field is written `name: type`; anything else is a call.
  sigName: (sig) => /^[\w$]+\s*:/.test(sig) && !sig.includes('(') ? (/^[\w$]+/.exec(sig) as RegExpExecArray)[0]
    : ((/([\w{}$-]+)\s*\(/.exec(sig.replace(/^[^(]*?(->|\.)(?=[\w{}]+\s*\()/, '')) || [])[1] || ''),
  receiver: /^this\s*:/,
  param: (p) => {
    const m = /^(?:\.\.\.)?(\w+)\??\s*(?::\s*([^=]+?))?\s*(?:=.*)?$/.exec(p.trim())
    return null == m ? { name: '', type: '' } : { name: m[1], type: (m[2] || '').trim() }
  },
  optional: (p) => /^\w+\?/.test(p) || /=/.test(p),
  returns: (after) => (/^\s*:\s*([^{]+)/.exec(after) || [])[1] || '',
  entityCtor: 'constructor',
  public: {
    client: /^  (?:static |async \*?)?((?!constructor\b)[a-z]\w*)\(/gm,
    entity: /^  (?:static |async \*?)?((?!constructor\b)[a-z]\w*)(?:\(|\s*(?::[^=\n(]+)?=\s)/gm,
  },
  undocumented: {
    graphql: 'a GraphQL request through the pipeline; no reference page documents it (old pages neither)',
    toJSON: 'the serialised form JSON.stringify uses; not part of the documented API',
    toString: 'the printed form; not part of the documented API',
    markDeleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance; not documented by the old pages',
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
  types: { column: 'ts' },

  // The porter's, from here on.
  namesWhy: 'the page names a parameter by what it holds and every match or data type as `object`; ts passes them by position',
  renames: { reqmatch: 'match', reqdata: 'data', testoptsarg: 'testopts', sdkoptsarg: 'sdkopts' },
  typeNames: Object.fromEntries([
    ...['List', 'Load', 'Remove'].map((o) => [`EntityName${o}Match`, 'object']),
    ...['Create', 'Update', 'Patch'].map((o) => [`EntityName${o}Data`, 'object']),
    ['Control', 'object'], ['any', 'object'], ['Partial<D>', 'object'], ['Record<string,any>', 'object'],
  ]),
  cite: {
    // Cited ahead of the provider (brief 7): a later declaration must equal the pinned value.
    'ref.facts.streamSignal': { value: true, file: 'src/cmp/ts/fragment/EntityBase.fragment.ts', quote: ['ctrl.signal = callopts.signal', 'if (signal && signal.aborted) { return }'] },
    'ref.facts.entity[1].copy': { value: true, file: 'src/cmp/ts/fragment/EntityBase.fragment.ts', quote: 'let out = struct.clone(this._match)' },
    'ref.facts.client[0].copy': { value: true, file: "src/cmp/ts/fragment/Main.fragment.ts", quote: "return this._utility.struct.clone(this._options)" },
    // Decision 13: utility() runs struct.clone on a class instance, which clone
    // hands back by reference (a non-plain object is copied, not cloned): the live object.
    'ref.facts.client[1].copy': { value: false, file: 'src/cmp/ts/fragment/Main.fragment.ts', quote: 'return this._utility.struct.clone(this._utility)', also: [{ file: 'tm/ts/src/utility/StructUtility.ts', quote: ["'Object' !== v.constructor.name &&", "return (refs.push(v), '`$REF:' + (refs.length - 1) + '`')"] }, { file: 'tm/ts/src/utility/Utility.ts', quote: 'class Utility {' }] },
    'ref.facts.entity[5].copy': { value: true, file: "src/cmp/ts/fragment/EntityBase.fragment.ts", quote: "return this._utility.struct.merge([{}, this._entopts])" },
    'ref.facts.direct.abortCode': { file: 'tm/ts/src/utility/MakeRequestUtility.ts', quote: "const abort = ctx.error('request_aborted', 'request aborted')" },
    'ref.facts.none': { file: 'src/cmp/ts/fragment/EntityBase.fragment.ts', quote: 'return undefined' },
    'ref.facts.direct.okFalse': { file: MAIN, quote: 'return { ok: false, err: utility.clean(this._rootctx, fetchdef) }' },
    'ref.facts.entity[0].copy': { value: true, file: "src/cmp/ts/fragment/EntityBase.fragment.ts", quote: "let out = struct.clone(this._data)" },
    'facts.collection': { value: "array", file: OPS[1], quote: 'async list(this: any, reqmatch?: EntityNameListMatch, ctrl?: Control): Promise<EntyClass[]>' },
    'ref.facts.container': {
      file: 'tm/ts/src/utility/MakeOptionsUtility.ts',
      quote: 'const layer = (b: any) => null != b && \'object\' === typeof b && !Array.isArray(b) ? b : {}',
    },
    'ref.facts.valueType.OBJECT': {
      file: 'tm/ts/src/utility/MakeOptionsUtility.ts',
      quote: 'const layer = (b: any) => null != b && \'object\' === typeof b && !Array.isArray(b) ? b : {}',
    },
    'ref.facts.client[0].returns': {
      file: MAIN, quote: 'return this._utility.struct.clone(this._options)',
      also: [{ file: 'tm/ts/src/utility/MakeOptionsUtility.ts', quote: 'const layer = (b: any) => null != b && \'object\' === typeof b && !Array.isArray(b) ? b : {}' }],
    },
    'ref.facts.client[1].kind': { value: "utility", file: MAIN, quote: 'return this._utility.struct.clone(this._utility)' },
    'ref.facts.client[1].returns': {
      file: MAIN, quote: 'return this._utility.struct.clone(this._utility)',
      unquoted: { object: 'a clone of the Utility instance' },
    },
    'ref.facts.direct.returns': {
      file: MAIN, quote: ['async direct(fetchargs?: any): Promise<DirectResult>', '{ ok: boolean, status: number, headers: any, data: any, err?: any }'],
    },
    'ref.facts.direct.signal': { file: 'tm/ts/src/Control.ts', quote: 'signal?: AbortSignal' },
    'ref.facts.prepare.returns': {
      file: MAIN, quote: ['async prepare(fetchargs?: any)', 'return ctx.error(\'spec_method_allow\'', 'return makeFetchDef(ctx)'],
      also: [{ file: 'tm/ts/src/utility/MakeFetchDefUtility.ts', quote: ['    url,\n    method: spec.method,\n    headers: spec.headers,', 'fetchdef.body ='] },
        { file: 'tm/ts/src/Context.ts', quote: 'return new ProjectNameError(code, msg, this)' }],
      unquoted: {
        Error: 'ctx.error returns a ProjectNameError, which extends Error',
        Promise: 'prepare is an async method, so it returns a Promise; its declaration spells no return type',
      },
    },
    'ref.facts.prepare.fails': { value: "value", file: MAIN, quote: 'return ctx.error(\'spec_method_allow\'' },
    'ref.facts.body.values': { value: "a `Buffer`, `Uint8Array`, `ArrayBuffer`, `Blob`, stream or string",
      file: MEDIA, quote: ['return value instanceof ArrayBuffer || ArrayBuffer.isView(value) ||', '(\'undefined\' !== typeof Blob && value instanceof Blob) || isStream(value)', 'return new Uint8Array(chunk)'],
      also: [{ file: 'tm/ts/src/utility/MakeFetchDefUtility.ts', quote: 'fetchdef.body = isRawValue(body) || (\'object\' !== typeof body && !isJsonRequest(ctx.point)) ?' }],
      unquoted: {
        Buffer: 'a Node Buffer is a Uint8Array, which ArrayBuffer.isView accepts',
      },
    },
    'ref.facts.body.once': { value: "a stream", file: 'tm/ts/src/utility/MakeRequestUtility.ts', quote: '// A stream can be read once; read it now, so that a retry sends the same bytes.' },
    'ref.facts.cancel': { value: true, file: 'tm/ts/src/utility/MakeFetchDefUtility.ts', quote: 'fetchdef.signal = ctx.ctrl.signal' },
    'ref.facts.testMock': { value: "generated", file: "src/cmp/ts/fragment/Config.fragment.ts", quote: "const fc = FEATURE_CLASS[fn] || BaseFeature" },
  },
  // What the table states besides names, parameters and returns.
  testDecl: 'test',
  stream: {
    file: "src/cmp/ts/fragment/EntityBase.fragment.ts",
    construct: "async *stream(this: any, action: string", starts: "on iteration",
    run: "const failed = await this._streamSteps(ctx)",
    draw: "for await (const item of result.stream())",
    runs: "as the caller iterates", items: "as the caller iterates",
  },
}

export { forms }
