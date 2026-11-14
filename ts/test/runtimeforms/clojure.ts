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
    options: 'options-map', utility: 'get-utility', direct: 'direct', prepare: 'prepare',
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
  uncompared: { returns: 'the clojure runtime declares no types, so a signature\'s `-> x` is compared with nothing; the facts that rest on one are cited' },
  cite: {
    'facts.collection': { file: OPS[1], quote: [';; Resolves to a vector of entities, one per record, as make-result builds', '(if (vs/islist items) (vec items) items)'] },
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
    'ref.facts.prepare.fails': { file: 'tm/clojure/src/sdk/client.clj', quote: '(core/sdk-throw (core/ctx-error ctx "spec_method_allow"' },
    'ref.facts.body.values': {
      file: 'tm/clojure/src/sdk/core.clj',
      quote: [';; A byte array, an InputStream or a string, sent as it is. An InputStream is', '(or (bytes? body) (instance? java.io.InputStream body)) body'],
      unquoted: { String: 'a string, which the comment above raw-body names' },
    },
    'ref.facts.body.once': { file: 'tm/clojure/src/sdk/core.clj', quote: ';; read here, once, before the first attempt, so that a retry sends the same' , also: [{ file: 'tm/clojure/src/sdk/core.clj', quote: '(if (instance? java.io.InputStream body) (.readAllBytes ^java.io.InputStream body) body)' }] },
    'ref.facts.cancel': { file: 'tm/clojure/src/sdk/core.clj', quote: '(def ^:private http-client (delay (http-client-for HttpClient$Redirect/NORMAL)))' },
  },
  exceptions: {
    'ref.facts.accessor.arg': 'WRONG: the accessor passes its argument on as the entity options (MainEntity_clojure.ts `(defn ${cljAccessor(entity)} [client data] (${cljEntityAlias(entity)}/make client data))`; Entity.fragment.clj:54 `(defn make [client data] (new-entity client data))` and :32 `(defn- new-entity [client entopts]`); the page says "Pass `nil` for no initial data."',
  },
}

export { forms }
