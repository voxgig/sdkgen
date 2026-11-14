import { indentLines, uses } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RuntimeFacts, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'bare',
  async: false,
  result: 'raise',
  collection: 'vector',
  record: '((:data-get entity))',
  prints: 'record',
}

const str = (s: string): string => '"' + String(s)
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')
  .replace(/\n/g, '\\n')
  .replace(/\t/g, '\\t')
  .replace(/\r/g, '\\r') + '"'

const name = (r: Ref): string =>
  'created' === r.role ? 'created' : ('many' === r.role ? r.entity.sym.vars : r.entity.sym.var)

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

// A form's closing paren goes on the last line of what it encloses.
const close = (lines: string[], n = 1): string[] =>
  lines.map((l, i) => i === lines.length - 1 ? l + ')'.repeat(n) : l)


const Syntax: SyntaxType = {
  fence: 'clojure',
  facts,

  client: (s, desc, sc) => {
    // Every entity namespace the section calls is required here, ahead of it.
    const used = uses(sc.section).entities
    const syms = desc.entities.filter((e) => used.includes(e.name)).map((e) => e.sym)
    return [
      `(require '[${desc.layout.module} :as ${desc.layout.client}]`,
      ...syms.map((m) => `         '[${m.module} :as ${m.alias}]`),
      "         '[voxgig.struct :as vs])",
      '',
      `(def client (${desc.layout.ctor} ${0 === s.options.length ? 'nil' : expr({ k: 'map', entries: s.options })}))`,
    ]
  },

  call: (s) => [null == s.bind ? callExpr(s) : `(def ${name(s.bind)} ${callExpr(s)})`],

  each: (s, inner) => [
    `(doseq [${name(s.item)} ${name(s.of)}]`,
    ...close(indentLines(inner(s.body), '  ')),
  ],

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
}


export {
  Syntax
}
