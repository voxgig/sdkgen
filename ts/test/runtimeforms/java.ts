// How the java runtime writes things: public methods of ProjectNameSDK and
// its SdkClient base, and of the entity and its EntityBase; the type ahead of
// the name. Java has no default arguments: an argument that may be left out
// is an overload, so a declaration is matched by its parameter count.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/java/fragment/Entity${o}Op.fragment.java`)
const MODS = '(?:public |static |final |synchronized |abstract )+'

const forms: Forms = {
  files: {
    client: ['src/cmp/java/fragment/Main.fragment.java', 'tm/java/core/SdkClient.java', 'src/cmp/java/MainEntity_java.ts'],
    entity: ['src/cmp/java/fragment/EntityBase.fragment.java', 'src/cmp/java/fragment/Entity.fragment.java'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]*${MODS}(?:[\\w.<>?,\\[\\]$\\{\\}]+(?:<[^>]*>)?\\s+)?${name}(?=\\()`, 'm'),
  param: (p) => {
    const m = /^(?:final\s+)?(.*\S)\s+(\w+)$/.exec(p.trim())
    return null == m ? { name: '', type: '' } : { name: m[2], type: m[1] }
  },
  optional: (p) => /\.\.\./.test(p),
  returns: (_after, _before, head) => (new RegExp(`^[ \\t]*${MODS}(.*?)\\s+[\\w$\\{\\}.]+$`).exec(head) || [])[1] || '',
  entityCtor: 'EntyClass',
  opName: /^  public Object ([a-z]\w*)\(/gm,
  public: {
    client: /^  public (?:static |final |synchronized )*[^=(\n]*?\s([a-z]\w*)\(/gm,
    entity: /^  public (?:static |final |synchronized )*[^=(\n]*?\s([a-z]\w*)\(/gm,
  },
  undocumented: {
    getRootCtx: 'the pipeline\'s root context, for features',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it',
    markDeleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance',
  },
  members: {
    options: 'optionsMap', utility: 'getUtility', direct: 'direct', prepare: 'prepare',
    data: 'data', match: 'match', make: 'make', name: 'getName', stream: 'stream',
  },
  streamKind: (d) => /^Stream</.test(d.returns) ? 'streamLazy' : 'stream',
  style: { exception: 'throw', raises: /\bthrow\b/ },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'ProjectNameSDK', accessor: '${accessor}' },
  types: { column: 'java' },
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, uncompared, cite and exceptions.
  // What the table states besides names, parameters and returns.
  testDecl: 'testSDK',
  expect: { testSDK: { on: 'type' } },
  stream: {
    file: "src/cmp/java/fragment/EntityBase.fragment.java",
    construct: "Iterator<Object> guarded = new Iterator<Object>() {", starts: "on iteration",
    run: "Object materialised = runOp(ctx, () -> {});",
    draw: "item = ready ? src.next() : null;",
    runs: "before it returns", items: "as the caller iterates",
  },
  // direct's `ok` on a failure, cited ahead of the provider: a port declares ref.facts.direct.okFalse as this value.
  cite: {
    // Cited ahead of the provider (brief 7): a later declaration must equal the pinned value.
    'ref.facts.streamSignal': { value: true, file: 'src/cmp/java/fragment/EntityBase.fragment.java', quote: ['Object signalObj = callopts.get("signal");', 'if (ended || (signal != null && signal.getAsBoolean())) {'] },
    'ref.facts.direct.okFalse': { value: "false", file: "tm/java/core/SdkClient.java", quote: "out.put(\"ok\", false);" },
  },
}

export { forms }
