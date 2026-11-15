// How the clojure runtime writes things: defn in the client namespace, which
// the generated sdk.api namespace re-exports; an entity's members as fns
// under keywords of the entity map; the operations as defn in the entity
// namespace.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/clojure/fragment/Entity${o}Op.fragment.clj`)

// `(name a b)` or `((:name ent) a b)` -> the name and its parameters.
const form = (sig: string): { name: string, params: string[] } => {
  const kw = /^\(\(:([\w-]+)\s+\w+\)\s*([^)]*)\)/.exec(sig.trim())
  if (null != kw) return { name: kw[1], params: kw[2].split(/\s+/).filter((x) => '' !== x) }
  const fn = /^\(([\w/{}.-]+)\s*([^)]*)\)/.exec(sig.trim())
  if (null == fn) return { name: '', params: [] }
  return { name: fn[1].replace(/^[\w{}.-]+\//, ''), params: fn[2].split(/\s+/).filter((x) => '' !== x) }
}

const forms: Forms = {
  files: {
    // The public client is what sdk.api re-exports (Main_clojure); the
    // functions themselves are in sdk.client.
    client: ['src/cmp/clojure/Main_clojure.ts', 'tm/clojure/src/sdk/client.clj', 'src/cmp/clojure/MainEntity_clojure.ts'],
    entity: ['src/cmp/clojure/fragment/Entity.fragment.clj'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`(?:\\(defn-?\\s+${name}\\s+|:${name}\\s+\\(fn\\s*)(?=\\[)`, 'm'),
  open: '[',
  split: 'space',
  param: (p) => ({ name: (/^[\w-]+$/.exec(p.trim()) || [''])[0], type: '' }),
  optional: () => false,
  returns: () => '',
  entityCtor: 'new-entity',
  public: {
    client: /^\(def ([a-z][\w-]*) client\//gm,
    entity: /^\(defn\s+([a-z][\w-]*)\s+\[|\s:([a-z][\w-]*)\s+\(fn\s*\[/gm,
  },
  undocumented: {
    graphql: 'a GraphQL request through the pipeline; no reference page documents it (old pages neither)',
    'mark-deleted': 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance; not documented by the old pages',
  },
  members: {
    options: 'options-map', direct: 'direct', prepare: 'prepare',
    dataGet: 'data-get', dataSet: 'data-set', matchGet: 'match-get', matchSet: 'match-set',
    make: 'make', name: 'get-name', stream: 'stream',
  },
  streamKind: (d) => /lazy-seq/.test(d.rest) ? 'streamLazy' : 'unknown',
  style: { exception: 'raise', raises: /\(throw\b/ },
  record: (rec) => ({ name: (/\(:([\w-]+)/.exec(rec) || [])[1] || rec }),
  sigName: (sig) => form(sig).name,
  sigParams: (sig) => form(sig).params,
  sigReturns: (sig) => ((/\)\s*->\s*(.+)$/.exec(sig.trim()) || [])[1] || '').trim(),
  tokens: { Class: 'EntyClass', client: 'api', sdk: 'ProjectName', ctor: 'make-sdk', accessor: '${cljAccessor(entity)}' },
  types: { column: null, any: ['NULL', 'ANY'], reason: 'the code generator has no clojure column in canonToType; the page\'s type words are the provider\'s own' },

  // The porter's, from here on.
  renames: { args: ['data', 'match'] },
  namesWhy: 'clojure passes by position; the runtime names the setter argument args',
  exceptions: {
    streamItems: 'WRONG: clojure: ref.facts.entity stream kind streamLazy ("return a lazy stream of its result items"); Entity.fragment.clj runs run-op and realises the streaming feature\'s items with vec and mapv before it returns; the lazy-seq walks the realised vector',
  },
  uncompared: { returns: 'the clojure runtime declares no types, so a signature\'s `-> x` is compared with nothing; the facts that rest on one are cited' },
  cite: {
    'ref.facts.none': { file: 'src/cmp/clojure/fragment/EntityLoadOp.fragment.clj', quote: ';; Load a single EntityName (reqmatch: id/query fields; nil = empty match).' },
    'ref.facts.lits.false': { value: 'false', file: 'tm/clojure/src/sdk/client.clj', quote: '(vs/jm "ok" false "err" (core/ucall (core/client-root-ctx client) :clean (:err pr)))' },
    'ref.facts.lits.true': { value: 'true', file: 'tm/clojure/src/sdk/client.clj', quote: 'out (vs/jm "ok" (and (nil? body-err) (>= status 200) (< status 300))', unquoted: { true: 'ok is the boolean the status test computes; true is not spelled' } },
    'ref.facts.entity[0].copy': { value: true, file: "src/cmp/clojure/fragment/Entity.fragment.clj", quote: "(vs/clone (deref (:_data ent)))" },
    'notes.members': { value: "State accessors are stored on the entity map and called via keyword lookup.", file: "src/cmp/clojure/fragment/Entity.fragment.clj", quote: [":data-get (fn [] (ent-data-get ent))"] },
    'notes.instance': { value: "The SDK utility object is reached through `sdk.client`, which `{module}`\ndoes not re-export: `(sdk.client/get-utility client)` returns a copy of it.", file: "tm/clojure/src/sdk/client.clj", quote: ["(ns sdk.client", "(defn get-utility [client] (core/get-utility client))"], also: [{ file: "tm/clojure/src/sdk/core.clj", quote: ["(defn get-utility [client] (utility-copy (:utility client)))"] }],
      unquoted: { '(sdk.client/get-utility client)': 'the call a caller writes to the defn the quote shows' } },
    'facts.collection': { value: "vector", file: OPS[1], quote: [';; Resolves to a vector of entities, one per record, as make-result builds', '(if (vs/islist items) (vec items) items)'] },
    'ref.facts.container': { file: 'tm/clojure/src/sdk/client.clj', quote: '[voxgig.struct :as vs]' },
    'ref.facts.ctor[0]': { file: 'src/cmp/clojure/Main_clojure.ts', quote: ['(ns sdk.api', '(:require [sdk.client :as client]${requires}))'] },
    'ref.facts.ctor[1]': { file: 'tm/clojure/src/sdk/client.clj', quote: '[voxgig.struct :as vs]' },
    'ref.facts.direct.returns': {
      file: 'tm/clojure/src/sdk/client.clj', quote: '(vs/jm "ok" false "err" (core/ucall ctx :clean fetch-err))',
      unquoted: { map: 'vs/jm builds a map' },
    },
    'ref.facts.prepare.returns': {
      file: 'tm/clojure/src/sdk/client.clj', quote: '(defn prepare [client fetchargs]',
      unquoted: { map: 'the fetch definition make-fetch-def builds, a voxgig.struct map' },
    },
    'ref.facts.prepare.fails': { value: "style", file: 'tm/clojure/src/sdk/client.clj', quote: '(core/sdk-throw (core/ctx-error ctx "spec_method_allow"' },
    'ref.facts.body.values': { value: "a byte array, a `String` or an `InputStream`",
      file: 'tm/clojure/src/sdk/core.clj',
      quote: [';; A byte array, an InputStream or a string, sent as it is. An InputStream is', '(or (bytes? body) (instance? java.io.InputStream body)) body'],
      unquoted: { String: 'a string, which the comment above raw-body names' },
    },
    'ref.facts.body.once': { value: "an `InputStream`", file: 'tm/clojure/src/sdk/core.clj', quote: ';; read here, once, before the first attempt, so that a retry sends the same' , also: [{ file: 'tm/clojure/src/sdk/core.clj', quote: '(if (instance? java.io.InputStream body) (.readAllBytes ^java.io.InputStream body) body)' }] },
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort\w*|signal)\b|AbortController|WithContext|context\.Context|cancel_request|sendAsync/i, files: ['tm/clojure/src/sdk/core.clj'] } },
  },
  // What the table states besides names, parameters and returns.
  testDecl: 'test-sdk',
  on: (d) => /^\s*:/.test(d.head) ? 'instance' : 'module',
  stream: {
    file: "src/cmp/clojure/fragment/Entity.fragment.clj",
    construct: "(letfn [(lz [xs] (lazy-seq", starts: "on iteration",
    run: "(run-op ctx (fn []))\n    (let [result (core/oget ctx :result)",
    draw: "(vec ((core/oget result :stream)))",
    runs: "before it returns", items: "before it returns",
  },
}

export { forms }
