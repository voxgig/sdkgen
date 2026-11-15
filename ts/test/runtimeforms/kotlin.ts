// How the kotlin runtime writes things: `fun` members of ProjectNameSDK, its
// SdkClient base and companion, and of the entity and its EntityBase; a
// member may be a property (`val`/`var`, no parameter list); a return after
// `): Type`.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/kotlin/fragment/Entity${o}Op.fragment.kt`)
const MODS = '(?:override |open |abstract |public |suspend |inline )*'

const forms: Forms = {
  files: {
    client: ['src/cmp/kotlin/fragment/Main.fragment.kt', 'tm/kotlin/core/SdkClient.kt', 'src/cmp/kotlin/MainEntity_kotlin.ts'],
    entity: ['src/cmp/kotlin/fragment/EntityBase.fragment.kt', 'src/cmp/kotlin/fragment/Entity.fragment.kt'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]*${MODS}(?:fun|val|var|class) ${name}(?=[(:\\s])`, 'm'),
  bare: true,
  param: (p) => {
    const m = /^(?:vararg\s+)?(\w+)\s*:\s*([^=]+?)\s*(?:=.*)?$/.exec(p.trim())
    return null == m ? { name: '', type: '' } : { name: m[1], type: m[2] }
  },
  optional: (p) => /=|^vararg\b/.test(p),
  // A class header's `: Base(...)` names its superclass, not a return.
  returns: (after, _before, head) => /\bclass\s/.test(head) ? '' : (/^\s*:\s*([^={]+)/.exec(after) || [])[1] || '',
  entityCtor: 'EntyClass',
  opName: /^  override fun ([a-z]\w*)\(/gm,
  public: {
    client: /^  (?:override |open )*(?:fun|val|var) ([a-z]\w*)|^    fun ([a-z]\w*)/gm,
    entity: /^  (?:override |open )*(?:fun|val|var) ([a-z]\w*)/gm,
  },
  undocumented: {
    testOptions: 'the helper testSDK uses to build test-mode options',
    mode: 'a property holding "live" or "test", which the constructors set',
    features: 'a property holding the installed features, for the pipeline',
    toString: 'the printed form',
    getRootCtx: 'the pipeline\'s root context, for features',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it',
    markDeleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance',
  },
  members: {
    options: 'optionsMap', utility: 'getUtility', direct: 'direct', prepare: 'prepare',
    data: 'data', match: 'match', make: 'make', name: 'name', stream: 'stream',
  },
  streamKind: (d) => /^Sequence</.test(d.returns) ? 'streamLazy' : 'stream',
  style: { exception: 'throw', raises: /\bthrow\b/ },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'ProjectNameSDK', accessor: '${accessor}' },
  types: { column: 'kotlin' },
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, uncompared, cite and exceptions.
  // What the table states besides names, parameters and returns.
  testDecl: 'testSDK',
  on: (d) => 'ProjectNameSDK' === d.name || 'EntyClass' === d.name || (/^    fun /.test(d.head) && /companion object \{/.test(d.before)) ? 'type' : 'instance',
  expect: { testSDK: { on: 'type' }, name: { field: true } },
  stream: {
    file: "src/cmp/kotlin/fragment/EntityBase.fragment.kt",
    construct: "return sequence {", starts: "on iteration",
    run: "val materialised = runOp(ctx) {}",
    draw: "if (source.hasNext() && !aborted()) source.next() else end",
    runs: "before it returns", items: "as the caller iterates",
  },
  // direct's `ok` on a failure, cited ahead of the provider: a port declares ref.facts.direct.okFalse as this value.
  cite: {
    'ref.facts.direct.okFalse': { value: "false", file: "tm/kotlin/core/SdkClient.kt", quote: "out[\"ok\"] = false" },
  },
}

export { forms }
