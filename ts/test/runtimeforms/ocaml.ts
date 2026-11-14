// How the ocaml runtime writes things: the client is the `let` functions
// Main_ocaml.ts emits, with `(name : type)` parameters; an entity is the
// entity_obj record of sdk_types.ml, every member a field typed with arrows.
// EntityOperation_ocaml.ts binds each operation to its field (ocamlOpField),
// so the field is what tells the operations apart.
import type { Forms } from './forms'

const RECORD = 'tm/ocaml/sdk_types.ml#and entity_obj = {#\n}'

// An arrow type split at its top level: the parameters, then the return.
const arrows = (t: string): { params: string[], returns: string } => {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < t.length; i++) {
    if ('(' === t[i]) depth++
    else if (')' === t[i]) depth--
    if (0 === depth && '-' === t[i] && '>' === t[i + 1]) {
      parts.push(cur.trim())
      cur = ''
      i++
    }
    else cur += t[i]
  }
  parts.push(cur.trim())
  const returns = parts.pop() as string
  return { params: parts.filter((p) => 'unit' !== p), returns }
}

const forms: Forms = {
  files: {
    client: ['src/cmp/ocaml/Main_ocaml.ts', 'src/cmp/ocaml/MainEntity_ocaml.ts'],
    entity: [RECORD, 'src/cmp/ocaml/Entity_ocaml.ts'],
    ops: [RECORD, 'src/cmp/ocaml/fragment/RunOp.fragment.ml'],
  },
  opSource: () => [RECORD],
  opMethod: (op, src) => new RegExp(`^\\s*mutable e_${op}\\s*:`, 'm').test(src[0].text) ? 'e_' + op : null,
  decl: (name) => new RegExp(`^(?:\\s*mutable ${name}(?=\\s*:)|let (?:rec )?${name}(?=\\s))`, 'm'),
    declReader: (after) => {
    const field = /^\s*:\s*([^;]+);/.exec(after)
    if (null != field) return arrows(field[1].replace(/\s+/g, ' '))
    const head = /^((?:\s*\((?:[^()]|\([^()]*\))*\))*)\s*(?::\s*([^=]+?))?\s*=/.exec(after)
    if (null == head) return null
    const groups = [...head[1].matchAll(/\(((?:[^()]|\([^()]*\))*)\)/g)].map((m) => m[1].trim()).filter((p) => '' !== p)
    return { params: groups, returns: head[2] || '' }
  },
  param: (p) => {
    const m = /^(\w+)\s*:\s*(.+)$/.exec(p.trim())
    return null == m ? { name: '', type: p.trim() } : { name: m[1], type: m[2].trim() }
  },
  optional: (p) => /^\?/.test(p.trim()),
  returns: () => '',
  entityCtor: 'make',
  public: {
    client: /^let ((?!rec\b)[a-z]\w*|\$\{fn\})\s/gm,
    entity: /^\s*mutable (e_\w+)\s*:/gm,
  },
  undocumented: {
    entity: 'looks an entity up by name, for the generated tests (Some/None)',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it',
    e_client: 'a field: the client the entity belongs to',
    e_utility: 'a field: the utility the entity runs with',
    e_entopts: 'a field: the entity options',
    e_data: 'a field behind e_data_get',
    e_match: 'a field behind e_match_get',
    e_entctx: 'a field: the entity\'s pipeline context',
    e_deleted: 'a field: whether e_remove succeeded on this instance',
    e_mark_deleted: 'set by e_remove itself',
  },
  members: {
    direct: 'direct', prepare: 'prepare',
    dataGet: 'e_data_get', dataSet: 'e_data_set', matchGet: 'e_match_get', matchSet: 'e_match_set',
    make: 'e_make', name: 'e_name', stream: 'e_stream',
  },
  streamKind: (d) => /\bSeq\.t$/.test(d.returns) ? 'streamLazy' : 'stream',
  style: { exception: 'raise', raises: /\braise\b/ },
  record: (rec) => ({ name: (/(e_\w+)/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'entity_obj', client: 'sdk_client', sdk: 'Sdk_client', ctor: 'make', accessor: '${fn}' },
  types: { column: null, reason: 'the code generator has no ocaml column in canonToType (every type maps to any); the page\'s type words are the provider\'s own' },
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, uncompared, cite and exceptions.
}

export { forms }
