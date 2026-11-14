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
  decl: (name) => new RegExp(`^[ \\t]+(?:static\\s+|async\\s+\\*?\\s*)*${name}(?=\\()`, 'm'),
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
    entity: /^  (?:static |async \*?)?((?!constructor\b)[a-z]\w*)\(/gm,
  },
  undocumented: {
    graphql: 'a GraphQL request through the pipeline; no reference page documents it (old pages neither)',
    toJSON: 'the serialised form JSON.stringify uses; not part of the documented API',
    toString: 'the printed form; not part of the documented API',
    markDeleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance; not documented by the old pages',
  },
  members: {
    options: 'options', utility: 'utility', direct: 'direct', prepare: 'prepare', tester: 'tester',
    data: 'data', match: 'match', make: 'make', client: 'client', entopts: 'entopts', stream: 'stream',
  },
  streamKind: (d) => /async\s*\*/.test(d.head) ? 'streamIterator' : 'stream',
  async: (d) => /\basync\b/.test(d.head),
  style: { exception: 'throw', raises: /\bthrow\b/ },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'constructor', accessor: '${entity.Name}' },
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
      unquoted: { object: 'a clone of the options, which makeOptions builds as an object' },
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
        Promise: 'prepare is an async method, so it resolves a Promise',
        Error: 'ctx.error returns a ProjectNameError, which extends Error',
      },
    },
    'ref.facts.prepare.fails': { value: "value", file: MAIN, quote: 'return ctx.error(\'spec_method_allow\'' },
    'ref.facts.body.values': { value: "a `Buffer`, `Uint8Array`, `ArrayBuffer`, `Blob`, stream or string",
      file: MEDIA, quote: ['return value instanceof ArrayBuffer || ArrayBuffer.isView(value) ||', '(\'undefined\' !== typeof Blob && value instanceof Blob) || isStream(value)'],
      also: [{ file: 'tm/ts/src/utility/MakeFetchDefUtility.ts', quote: 'fetchdef.body = isRawValue(body) || (\'object\' !== typeof body && !isJsonRequest(ctx.point)) ?' }],
      unquoted: {
        Buffer: 'a Node Buffer is a Uint8Array, which ArrayBuffer.isView accepts',
        Uint8Array: 'a typed array, which ArrayBuffer.isView accepts',
      },
    },
    'ref.facts.body.once': { value: "a stream", file: 'tm/ts/src/utility/MakeRequestUtility.ts', quote: '// A stream can be read once; read it now, so that a retry sends the same bytes.' },
    'ref.facts.cancel': { value: true, file: 'tm/ts/src/utility/MakeFetchDefUtility.ts', quote: 'fetchdef.signal = ctx.ctrl.signal' },
  },
}

export { forms }
