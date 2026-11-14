import { indentLines } from '@voxgig/sdkgen'
import { canonKey } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Scope, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'bare',
  async: false,
  result: 'raise',
  collection: 'vector',
  record: '((:data-get {var}))',
  prints: 'record',
}

// The fixed API the reference page documents: what sdk.api re-exports
// (Main_clojure), the entity map's keyword functions and the operations
// (Entity.fragment.clj). sdk.api does not re-export get-utility, so the
// utility member is not documented.
const refFacts: RefFacts = {
  entityBy: 'Name',
  noun: 'Functions',
  entityNoun: 'Members',
  heading: '{module}',
  none: 'nil',
  keys: 'bare',
  maps: 'maps',
  container: 'voxgig.struct',
  valueType: { STRING: 'string', OBJECT: 'map', ANY: 'any' },
  ctor: ["(require '[{module} :as {client}]", "         '[voxgig.struct :as vs])", '', '(def client ({ctor} options))'],
  test: [{ sig: '({client}/test-sdk testopts sdkopts)', call: '(def client ({client}/test-sdk nil nil))', args: true }],
  accessor: { sig: '({accessor} client data)', arg: 'data' },
  op: {
    list: '(list ent reqmatch ctrl) -> vector',
    load: '(load ent reqmatch ctrl) -> entity',
    create: '(create ent reqdata ctrl) -> entity',
    update: '(update ent reqdata ctrl) -> entity',
    patch: '(patch ent reqdata ctrl) -> entity',
    remove: '(remove ent reqmatch ctrl) -> entity',
  },
  client: [
    { kind: 'options', sig: '({client}/options-map client) -> map' },
    { kind: 'direct', sig: '({client}/direct client fetchargs) -> map' },
    { kind: 'prepare', sig: '({client}/prepare client fetchargs) -> map' },
  ],
  entity: [
    { kind: 'dataGet', sig: '((:data-get ent)) -> map' },
    { kind: 'dataSet', sig: '((:data-set ent) data)' },
    { kind: 'matchGet', sig: '((:match-get ent)) -> map' },
    { kind: 'matchSet', sig: '((:match-set ent) match)' },
    { kind: 'make', sig: '((:make ent)) -> entity' },
    { kind: 'streamLazy', sig: '(stream ent action args callopts) -> seq' },
    { kind: 'name', sig: '((:get-name ent)) -> string' },
  ],
  direct: { returns: 'map' },
  prepare: { returns: 'map', fails: 'style' },
  body: { values: 'a byte array, a `String` or an `InputStream`', once: 'an `InputStream`' },
  cancel: false,
}

// Field types as the old reference named them; clojure emits no typed models.
const TYPES: Record<string, string> = {
  STRING: 'string', INTEGER: 'long', NUMBER: 'double', BOOLEAN: 'boolean', ARRAY: 'vector', OBJECT: 'map',
}

const str = (s: string): string => '"' + String(s)
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')
  .replace(/\n/g, '\\n')
  .replace(/\t/g, '\\t')
  .replace(/\r/g, '\\r') + '"'

const name = (r: Ref): string => r.name

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: '1', NUMBER: '1', BOOLEAN: 'true', ARRAY: '(vs/jt)', OBJECT: '(vs/jm)', NULL: 'nil',
} as Record<string, string>)[e.type] ?? str(e.text)

const record = (r: Ref): string => `((:data-get ${name(r)}))`

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return str(e.text)
    case 'env': return `(System/getenv ${str(e.name)})`
    case 'record': return record(e.of)
    case 'field': return `(vs/getprop ${record(e.of)} ${str(e.field)})`
    case 'fields': return e.fields.map((f) => `(vs/getprop ${record(e.of)} ${str(f)})`).join(' ')
    case 'map': return `(vs/jm ${e.entries.map(pair).join(' ')})`
  }
}

const pair = (en: Entry): string => `${str(en.key)} ${expr(en.value)}`

const callExpr = (s: Extract<Stmt, { k: 'call' }>): string =>
  `(${s.entity.sym.alias}/${(facts.method as any)[s.op]} (${s.entity.sym.accessor} client nil) ${null == s.arg ? 'nil' : expr({ k: 'map', entries: s.arg })} nil)`

// A line comment runs to the end of its line, so an argument that carries
// one (a member's type, a closing note) is laid out one member per line.
const commented = (s: Extract<Stmt, { k: 'call' }>): boolean =>
  s.wide && null != s.arg && (null != s.note || s.arg.some((en) => null != en.type))

const callLines = (s: Extract<Stmt, { k: 'call' }>): string[] => {
  const head = `(${s.entity.sym.alias}/${(facts.method as any)[s.op]} (${s.entity.sym.accessor} client nil)`
  const members = (s.arg as Entry[]).map((en) => `    ${pair(en)}` + (null == en.type ? '' : '  ;; ' + (TYPES[canonKey(en.type)] ?? 'any')))
  return [head, '  (vs/jm', ...members, ...(null == s.note ? [] : ['    ;; ' + s.note]), '    )', '  nil)']
}

// A binding that only the loop right after it reads is written as the loop's
// binding: `(doseq [item (list ...)] ...)`. The fused call is recorded in the
// scope for the loop's printer.
const FUSED = 'fused\u0000'
const fusesWith = (s: Extract<Stmt, { k: 'call' }>, sc: Scope): boolean => {
  if (null == s.bind) return false
  const i = sc.stmts.indexOf(s)
  const next = sc.stmts[i + 1]
  return 0 <= i && null != next && 'each' === next.k && next.of === s.bind &&
    !sc.stmts.slice(i + 2).some((x) => JSON.stringify(x).includes('"name":"' + s.bind!.name + '"'))
}

// A form's closing paren goes on the last line of what it encloses.
const close = (lines: string[], n = 1): string[] =>
  lines.map((l, i) => i === lines.length - 1 ? l + ')'.repeat(n) : l)


const Syntax: SyntaxType = {
  fence: 'clojure',
  facts,

  // Every entity namespace the section calls is required, ahead of it.
  imports: (desc, used) => [
    `(require '[${desc.layout.module} :as ${desc.layout.client}]`,
    ...desc.entities.filter((e) => used.entities.includes(e.name)).map((e) => `         '[${e.sym.module} :as ${e.sym.alias}]`),
    "         '[voxgig.struct :as vs])",
  ],

  // One option whose value is a map of maps (the features) is laid out one
  // member per line, as a map of maps is written; otherwise on one line.
  client: (s, desc) => {
    const only = 1 === s.options.length ? s.options[0] : null
    if (null != only && 'map' === only.value.k && only.value.entries.some((en) => 'map' === en.value.k)) {
      return [
        '(def client',
        `  (${desc.layout.ctor}`,
        `    (vs/jm ${str(only.key)}`,
        '      (vs/jm',
        ...only.value.entries.map((en) => `        ${pair(en)}`),
        '        ))))',
      ]
    }
    return [`(def client (${desc.layout.ctor} ${0 === s.options.length ? 'nil' : expr({ k: 'map', entries: s.options })}))`]
  },

  call: (s, _desc, sc) => {
    if (fusesWith(s, sc)) {
      sc.local.add(FUSED + name(s.bind as Ref) + FUSED + callExpr(s))
      return []
    }
    if (commented(s)) {
      const lines = callLines(s)
      return null == s.bind ? close(lines, 0)
        : [`(def ${name(s.bind)}`, ...close(indentLines(lines, '  '))]
    }
    return [null == s.bind ? callExpr(s) : `(def ${name(s.bind)} ${callExpr(s)})`]
  },

  each: (s, inner, sc) => {
    const key = FUSED + name(s.of) + FUSED
    const fused = [...sc.local].find((x) => x.startsWith(key))
    return [
      `(doseq [${name(s.item)} ${null == fused ? name(s.of) : fused.slice(key.length)}]`,
      ...close(indentLines(inner(s.body), '  ')),
    ]
  },

  print: (s) => [`(println ${expr(s.what)})`],

  // A bound result scopes what follows it: a list's binding is the doseq that
  // walks it, a load's a let around the rest.
  attempt: (s, inner) => {
    const [first, ...rest] = s.body
    let form: string[]
    if ('call' === first.k && null != first.bind) {
      const each = rest.find((x) => 'each' === x.k && x.of === first.bind) as Extract<Stmt, { k: 'each' }> | undefined
      form = null != each && 1 === rest.length
        ? [`(doseq [${name(each.item)} ${callExpr(first)}]`, ...close(indentLines(inner(each.body), '  '))]
        : [`(let [${name(first.bind)} ${callExpr(first)}]`, ...close(indentLines(inner(rest), '  '))]
    }
    else {
      form = inner(s.body)
    }
    return [
      '(try',
      ...indentLines(form, '  '),
      '  (catch Exception err',
      `    (println "${s.what} failed:" (.getMessage err))))`,
    ]
  },

  comment: (text) => ';; ' + text,

  expr: (e) => expr(e),

  ref: {
    facts: refFacts,
    type: (t) => TYPES[canonKey(t)] ?? 'any',
    key: (container, path) => 0 === path.length ? container : path.join('.'),
    instance: (e) => [`(require '[${e.sym.module} :as ${e.sym.alias}])`, '', `(def ${e.sym.var} (${e.sym.accessor} client nil))`],
    read: (value, key) => `(vs/getprop ${value} ${str(key)})`,
  },
}


export {
  Syntax
}
