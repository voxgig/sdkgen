// How the scala runtime writes things: `def` members of ProjectNameSDK, its
// SdkClient base and companion object, and of the entity and its EntityBase;
// a member may be written with no parameter list (`def toString: String`) or
// be a `val`/`var`; a return after `): Type`.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/scala/fragment/Entity${o}Op.fragment.scala`)

const forms: Forms = {
  files: {
    client: ['src/cmp/scala/fragment/Main.fragment.scala', 'tm/scala/core/SdkClient.scala', 'src/cmp/scala/MainEntity_scala.ts'],
    entity: ['src/cmp/scala/fragment/EntityBase.fragment.scala', 'src/cmp/scala/fragment/Entity.fragment.scala'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]*(?:override |final )*(?:def|val|var|class) ${name}(?=[(:\\s=])`, 'm'),
  bare: true,
  param: (p) => {
    const m = /^(\w+)\s*:\s*([^=]+?)\s*(?:=.*)?$/.exec(p.trim())
    return null == m ? { name: '', type: '' } : { name: m[1], type: m[2] }
  },
  optional: (p) => /=|\*$/.test(p),
  returns: (after) => (/^\s*:\s*([^={]+)/.exec(after) || [])[1] || '',
  entityCtor: 'EntyClass',
  opName: /^  override def ([a-z]\w*)\(/gm,
  public: {
    client: /^  (?:override )?(?:def|val|var) ((?!this\b)[a-z]\w*)/gm,
    entity: /^  (?:override )?(?:def|val|var) ([a-z]\w*)/gm,
  },
  undocumented: {
    mode: 'a property holding "live" or "test", which the constructors set',
    features: 'a property holding the installed features, for the pipeline',
    toString: 'the printed form',
    getRootCtx: 'the pipeline\'s root context, for features',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it',
    testOptions: 'the helper testSDK uses to build test-mode options',
    markDeleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance',
  },
  members: {
    options: 'optionsMap', utility: 'getUtility', direct: 'direct', prepare: 'prepare',
    data: 'data', match: 'matchArgs', make: 'make', name: 'getName', stream: 'stream',
  },
  streamKind: (d) => /^Iterator\[/.test(d.returns) ? 'streamSync' : 'stream',
  style: { exception: 'throw', raises: /\bthrow\b/ },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'ProjectNameSDK', accessor: '${accessor}' },
  types: { column: 'scala' },
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, uncompared, cite and exceptions.
  // What the table states besides names, parameters and returns.
  testDecl: 'testSDK',
  // A def with no parameter list is still a method; only val and var are fields.
  field: (d) => /\b(val|var)\s/.test(d.head),
  on: (d) => 'ProjectNameSDK' === d.name || 'EntyClass' === d.name || /\nobject \w+ \{/.test(d.before) ? 'type' : 'instance',
  expect: { testSDK: { on: 'type' } },
  stream: {
    file: "src/cmp/scala/fragment/EntityBase.fragment.scala",
    construct: "new Iterator[Object] {", starts: "on iteration",
    run: "val materialised = runOp(ctx, () => {})",
    draw: "item = if (ready) source.next() else null",
    runs: "before it returns", items: "as the caller iterates",
  },
}

export { forms }
