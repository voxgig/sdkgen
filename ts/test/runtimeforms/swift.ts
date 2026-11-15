// How the swift runtime writes things: public and open members of
// ProjectNameSDK, EntityBase and the entity class; a parameter as
// `label name: Type = default`; a return after `throws ->` or `->`, which may
// sit on the line after the parameter list.
import type { Forms } from './forms'
import { bracketed } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/swift/fragment/Entity${o}Op.fragment.swift`)

const forms: Forms = {
  files: {
    client: ['src/cmp/swift/fragment/Main.fragment.swift', 'src/cmp/swift/MainEntity_swift.ts'],
    entity: ['src/cmp/swift/fragment/Entity.fragment.swift', 'src/cmp/swift/fragment/EntityBase.fragment.swift'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]*(?:public |open |override |static |final )+(?:func |var |let )?${name}(?=[(:\\s])`, 'm'),
  bare: true,
  param: (p) => {
    const m = /^(?:\w+\s+)?(\w+)\s*:\s*([^=]+?)\s*(?:=.*)?$/.exec(p.trim())
    return null == m ? { name: '', type: '' } : { name: m[1], type: m[2] }
  },
  optional: (p) => /=/.test(p),
  returns: (_after, _before, _head, rest) => {
    const m = /^\s*(?:throws\s*)?->\s*((?:\$\{[^}]*\}|[^{\n])+)/.exec(rest) || /^\s*:\s*((?:\$\{[^}]*\}|[^={\n])+)/.exec(rest)
    return null == m ? '' : m[1].trim()
  },
  entityCtor: 'init',
  opName: /^public override func ([a-z]\w*)\(/gm,
  public: {
    client: /^  (?:public |open )(?:static |override )*(?:func|var|let) ([a-z]\w*)/gm,
    entity: /^  (?:public |open )(?:static |override )*(?:func|var|let) ([a-z]\w*)/gm,
  },
  undocumented: {
    mode: 'a property holding "live" or "test", which the constructors set',
    features: 'a property holding the installed features, for the pipeline',
    description: 'the printed form (CustomStringConvertible)',
    debugDescription: 'the debug form (CustomDebugStringConvertible)',
    customMirror: 'the mirror the debugger shows (CustomReflectable)',
    getRootCtx: 'the pipeline\'s root context, for features',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it',
    markDeleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance',
  },
  members: {
    options: 'optionsMap', utility: 'getUtility', direct: 'direct', prepare: 'prepare',
    data: 'data', match: 'matchv', make: 'make', name: 'getName', stream: 'stream',
  },
  streamKind: (d) => /^AsyncStream</.test(d.returns) ? 'streamIterator' : 'stream',
  // An operation returns the entity inside a Value and throws on failure.
  style: { exception: 'throw', raises: /\bthrow\b/, wrapped: (d) => /\bthrows\s*->\s*Value\b/.test(d.rest.slice(0, 200)) },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'init', accessor: '${entity.Name}' },
  types: { column: 'swift' },
  exceptions: {
  },
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, uncompared, cite and exceptions.
  // What the table states besides names, parameters and returns.
  testDecl: 'testSDK',
  fails: (d) => { const b = bracketed(d.rest, 0, '('); return null != b && /^\s*throws\b/.test(d.rest.slice(b.end)) ? 'throws' : '' },
  failure: { shows: 'throws', call: 'try' },
  expect: { testSDK: { on: 'type', fails: '' }, prepare: { fails: 'throws' }, stream: { fails: 'throws' }, direct: { fails: '' } },
  stream: {
    file: "src/cmp/swift/fragment/EntityBase.fragment.swift",
    construct: "return AsyncStream { continuation in", starts: "at call",
    run: "let materialised = try runOp(ctx, {})",
    draw: "items = streamFn()",
    runs: "before it returns", items: "before it returns",
  },
  // direct's `ok` on a failure, cited ahead of the provider: a port declares ref.facts.direct.okFalse as this value.
  cite: {
    'ref.facts.direct.okFalse': { value: "false", file: "src/cmp/swift/fragment/Main.fragment.swift", quote: "r.entries[\"ok\"] = .bool(false)" },
  },
}

export { forms }
