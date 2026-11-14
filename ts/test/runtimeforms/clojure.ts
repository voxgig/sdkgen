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
    client: ['src/cmp/clojure/Main_clojure.ts', 'tm/clojure/src/sdk/client.clj'],
    entity: ['src/cmp/clojure/fragment/Entity.fragment.clj'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`(?:\\(defn\\s+${name}\\s+|:${name}\\s+\\(fn\\s*)(?=\\[)`, 'm'),
  open: '[',
  split: 'space',
  optional: () => false,
  returns: () => '',
  public: {
    client: /^\(def ([a-z][\w-]*) client\//gm,
    entity: /(?:^\(defn\s+|\s:)([a-z][\w-]*)\s+(?:\(fn\s*)?\[/gm,
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
  sigReturns: () => '',
  tokens: { Class: 'EntyClass', client: 'api', sdk: 'ProjectName', ctor: 'make-sdk' },
  types: { column: null, any: ['NULL', 'ANY'] },
}

export { forms }
