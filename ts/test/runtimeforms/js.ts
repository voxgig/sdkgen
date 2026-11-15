// How the js runtime writes things: class methods in the Main, EntityBase and
// Entity fragments, the operations as async methods; any parameter may be
// left out.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/js/fragment/Entity${o}Op.fragment.js`)

const forms: Forms = {
  files: {
    client: ['src/cmp/js/fragment/Main.fragment.js', 'src/cmp/js/MainEntity_js.ts'],
    entity: ['src/cmp/js/fragment/EntityBase.fragment.js', 'src/cmp/js/fragment/Entity.fragment.js'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]+(?:static\\s+|async\\s+\\*?\\s*)*${name}(?=\\()`, 'm'),
  param: (p) => ({ name: (/^(?:\.\.\.)?(\w+)/.exec(p.trim()) || ['', ''])[1], type: '' }),
  optional: () => true,
  returns: () => '',
  entityCtor: 'constructor',
  public: {
    client: /^  (?:static |async \*?)?((?!constructor\b)[a-z]\w*)\(/gm,
    entity: /^  (?:static |async \*?)?((?!constructor\b)[a-z]\w*)\(/gm,
  },
  undocumented: {
    graphql: 'a GraphQL request through the pipeline; no reference page documents it',
    toJSON: 'the serialised form JSON.stringify uses',
    toString: 'the printed form',
    markDeleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance',
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
  types: { column: 'js' },
  uncompared: { paramTypes: 'js declares no parameter types', returns: 'js declares no return types' },
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, cite and exceptions.
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
  // direct's `ok` on a failure, cited ahead of the provider: a port declares ref.facts.direct.okFalse as this value.
  cite: {
    // Cited ahead of the provider (brief 7): a later declaration must equal the pinned value.
    'ref.facts.streamSignal': { value: true, file: 'src/cmp/js/fragment/EntityBase.fragment.js', quote: ['ctrl.signal = callopts.signal', 'if (signal && signal.aborted) { return }'] },
    'ref.facts.direct.okFalse': { value: "false", file: "src/cmp/js/fragment/Main.fragment.js", quote: "return { ok: false, err: utility.clean(this._rootctx, fetchdef) }" },
    // The test client's mock without the test feature, cited ahead: the factory's fallback.
    'ref.facts.testMock': { value: "generated", file: "src/cmp/js/fragment/Config.fragment.js", quote: "const fc = FEATURE_CLASS[fn] || BaseFeature" },
  },
}

export { forms }
