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

// A signature as the page writes it: `name (p : t) (q : u) : r`, `name () : r`
// for a callable taking unit, `name : t` for a field. A module qualifier
// (`{module}.make0 ()`) is dropped.
const sigParts = (sig: string): { name: string, params: string[], returns: string } => {
  const s = sig.trim().replace(/^[\w{}]+\.(?=[\w{}$])/, '')
  const name = (/^([\w{}$]+)/.exec(s) || ['', ''])[1]
  let rest = s.slice(name.length)
  const params: string[] = []
  for (let g = /^\s*\(((?:[^()]|\([^()]*\))*)\)/.exec(rest); null != g; g = /^\s*\(((?:[^()]|\([^()]*\))*)\)/.exec(rest)) {
    if ('' !== g[1].trim()) params.push(g[1].trim())
    rest = rest.slice(g[0].length)
  }
  return { name, params, returns: ((/^\s*:\s*(.+)$/.exec(rest) || [])[1] || '').trim() }
}

const CLIENT = 'src/cmp/ocaml/Main_ocaml.ts'
const RUNTIME = 'tm/ocaml/sdk_runtime.ml'

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
    if (null != field) return { ...arrows(field[1].replace(/\s+/g, ' ')), field: !/->/.test(field[1]) }
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
  // The Seq walks a list run_op has already produced (Entity_ocaml.ts).
  streamKind: (d) => /\bSeq\.t$/.test(d.returns) ? 'streamSync' : 'stream',
  style: { exception: 'raise', raises: /\braise\b/ },
  record: (rec) => ({ name: (/(e_\w+)/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'entity_obj', client: 'sdk_client', sdk: 'Sdk_client', ctor: 'make', accessor: '${fn}' },
  types: { column: null, reason: 'the code generator has no ocaml column in canonToType (every type maps to any); the page\'s type words are the provider\'s own' },
  // The porter's, from here on.
  sigName: (sig) => sigParts(sig).name,
  sigParams: (sig) => sigParts(sig).params,
  sigReturns: (sig) => sigParts(sig).returns,
  // What the table states besides names, parameters and returns.
  testDecl: 'test',
  on: (d) => /^\s*mutable /.test(d.head) ? 'instance' : 'module',
  expect: { e_name: { field: true }, e_deleted: { field: true }, e_data: { field: true }, e_load: { field: false }, test: { on: 'module' } },
  stream: {
    file: "src/cmp/ocaml/Entity_ocaml.ts",
    construct: "seq_of raw);", starts: "on iteration",
    run: "ignore (run_op ctx (fun () -> ()));\n      let signal",
    draw: "| Some fn -> fn ()",
    runs: "before it returns", items: "before it returns",
  },
  // direct's `ok` on a failure, cited ahead of the provider: a port declares ref.facts.direct.okFalse as this value.
  cite: {
    'ref.facts.direct.okFalse': { value: "Bool false", file: "tm/ocaml/sdk_features.ml", quote: "jo [(\"ok\", Bool false);" },
    'facts.recordType': { file: 'tm/ocaml/sdk_types.ml', quote: 'mutable e_data_get : unit -> value;' },
    'ref.facts.none': { file: CLIENT, quote: 'let make0 () : sdk_client = make Noval' },
    'ref.facts.container': { file: CLIENT, quote: 'let make (options : value) : sdk_client =' },
    'ref.facts.ctor[0]': { value: 'open Voxgig_struct', file: CLIENT, quote: 'open Voxgig_struct' },
    'ref.facts.ctor[1]': { value: 'open Sdk_helpers', file: 'src/cmp/ocaml/Entity_ocaml.ts', quote: 'open Sdk_helpers' },
    'ref.facts.ctor[2]': { value: 'open Sdk_types', file: CLIENT, quote: 'open Sdk_types' },
    'ref.facts.ctorAlts[0].call': { file: CLIENT, quote: 'let make0 () : sdk_client = make Noval' },
    'ref.facts.ctorAlts[0].kind': { value: 'defaults', file: CLIENT, quote: ['(* No-argument convenience constructor. *)', 'let make0 () : sdk_client = make Noval'] },
    'ref.facts.entity[0].copy': { value: true, file: 'src/cmp/ocaml/Entity_ocaml.ts', quote: 'ent.e_data_get <- (fun () -> utility.u_feature_hook entctx "GetData"; clone ent.e_data);' },
    'ref.facts.prepare.fails': { value: 'style', file: 'tm/ocaml/sdk_features.ml', quote: 'raise (Sdk_error_exc (ctx_make_error ctx "spec_method_allow"' },
    'ref.facts.body.values': { value: 'a `Str` holding the bytes', file: RUNTIME,
      quote: ['(* A map or a list is JSON, and so is a scalar on a point that declares\n          a JSON body. Anything else goes as given. *)', '| (Str _ | Num _ | Bool _) as b when is_json_request ctx.c_point ->', '| b -> setp fetchdef "body" b);'] },
    // Searched over the whole ocaml runtime: a region it leaves out is quoted, with the reason.
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort(?!\(\))\w*|signal|signalled\??)\b|AbortController|isCancelled|CancellationToken|WithContext|context\.Context/i, except: [
      { file: "src/cmp/ocaml/Entity_ocaml.ts", quote: ["* and signal (a 0-arity fn -> Bool; iteration stops when it returns true). *)", "let signal = getp callopts \"signal\" in", "let aborted () = match signal with Func _ -> call_json signal = Bool true | _ -> false in", "| x :: rest -> if aborted () then Seq.Nil else Seq.Cons (x, seq_of rest) in"],
        why: "the stream reads callopts.signal between the items it hands over (ref.facts.streamSignal); no operation reads it", fact: "ref.facts.streamSignal" },
      { file: "tm/ocaml/feature/secrets/plugins/tls_stubs.c", quote: ["*      callback, so a verification error aborts the handshake; belt and", "* NULL callback means a verification failure aborts the handshake rather", "/* Belt and braces. SSL_VERIFY_PEER already aborts on a bad chain, but a"],
        why: "the secrets feature's own client for fetching a secret (its HTTP, TLS or process calls), which no operation's request goes through" },
      { file: "tm/ocaml/feature/secrets/sekreto/secret.ml", quote: ["silence rather than aborting the lines after it. *)"],
        why: "the secrets feature's own client for fetching a secret (its HTTP, TLS or process calls), which no operation's request goes through" },
      { file: "tm/ocaml/sdk_features.ml", quote: ["or never. `piped` is set by PrePoint, so its absence is the signal. *)"],
        why: "an English word in a comment" },
    ] } },
    // The stream reads callopts.signal between items, which no operation does: cited ahead of a provider.
    'ref.facts.streamSignal': { value: true, file: "src/cmp/ocaml/Entity_ocaml.ts", quote: ["let signal = getp callopts \"signal\" in", "| x :: rest -> if aborted () then Seq.Nil else Seq.Cons (x, seq_of rest) in"] },
    'notes.operations': { value: 'Each operation takes its match or data, then a control map, `ctrl`,\nboth by position: pass `Noval` for either to give none.',
      file: 'src/cmp/ocaml/EntityOperation_ocaml.ts', quote: ['  return `  ent.${field} <- (fun ${arg} ctrl ->', '      let ${arg} = if is_nullish ${arg} then empty_map () else ${arg} in', 'cs_ctrl = (match ctrl with Noval | Null -> None | c -> Some c);'] },
    'notes.member:streamSync': { value: 'Its arguments are the name of the operation, its match, and `callopts`.', file: 'tm/ocaml/sdk_types.ml', quote: ['(* stream action args callopts -> a lazy Seq over result items. *)', 'mutable e_stream : string -> value -> value -> value Seq.t;'] },
    'notes.member:name': { value: '`e_name` is a field of the entity, read without a call.', file: 'tm/ocaml/sdk_types.ml', quote: ['and entity_obj = {', 'mutable e_name : string;'] },
  },
}

export { forms }
