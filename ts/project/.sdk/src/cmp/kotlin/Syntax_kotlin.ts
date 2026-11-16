import { canonToType, indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


// An operation returns `Any?`: the entity, or for a list a List of entities.
// The record is read off the entity once the value is cast to SdkEntity, the
// interface the generated entity classes implement (core/Interfaces.kt).
const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'call',
  async: false,
  result: 'throw',
  collection: 'list',
  record: 'data()',
  arity: 2,
  prints: 'record',
}

const MAP = 'MutableMap<String, Any?>'

// The fixed API the reference page documents: Main.fragment.kt, its
// SdkClient base (core/SdkClient.kt), MainEntity_kotlin, EntityBase.fragment.kt
// and the Entity*Op fragments.
const refFacts: RefFacts = {
  entityBy: 'Name',
  noun: 'Methods',
  none: 'null',
  keys: 'member',
  maps: 'maps',
  container: MAP,
  valueType: { STRING: 'String', OBJECT: 'Map', ANY: 'Any?' },
  ctor: ['val client = {ctor}(options)'],
  test: [
    { sig: '{client}.testSDK(): {client}', call: 'val client = {client}.testSDK()', args: false },
    {
      sig: `{client}.testSDK(testopts: ${MAP}?, sdkopts: ${MAP}?): {client}`,
      call: 'val client = {client}.testSDK(null, null)', args: true,
    },
  ],
  testMock: 'generated',
  accessor: { sig: `{accessor}(entopts: ${MAP}?): SdkEntity`, arg: 'entopts', param: 'entopts' },
  op: {
    list: `list(reqmatch: ${MAP}?, ctrl: ${MAP}?): Any?`,
    load: `load(reqmatch: ${MAP}?, ctrl: ${MAP}?): Any?`,
    create: `create(reqdata: ${MAP}?, ctrl: ${MAP}?): Any?`,
    update: `update(reqdata: ${MAP}?, ctrl: ${MAP}?): Any?`,
    patch: `patch(reqdata: ${MAP}?, ctrl: ${MAP}?): Any?`,
    remove: `remove(reqmatch: ${MAP}?, ctrl: ${MAP}?): Any?`,
  },
  client: [
    { kind: 'options', sig: `optionsMap(): ${MAP}`, copy: true },
    { kind: 'utility', sig: 'getUtility(): Utility', copy: true },
    { kind: 'direct', sig: `direct(fetchargs: ${MAP}?): ${MAP}` },
    { kind: 'prepare', sig: `prepare(fetchargs: ${MAP}?): ${MAP}` },
  ],
  entity: [
    { kind: 'data', sig: 'data(vararg args: Any?): Any?', copy: true },
    { kind: 'match', sig: 'match(vararg args: Any?): Any?', copy: true },
    { kind: 'make', sig: 'make(): Entity' },
    { kind: 'streamLazy', sig: `stream(action: String, args: ${MAP}?, callopts: ${MAP}?): Sequence<Any?>`, runs: 'call' },
    { kind: 'name', sig: 'name: String', field: true },
  ],
  direct: { returns: MAP, okFalse: 'false' },
  prepare: { returns: MAP, fails: 'style' },
  body: { values: 'a `ByteArray`, a `String` or an `InputStream`', once: 'an `InputStream`' },
  cancel: false,
  streamSignal: true,
  streamSignalForm: 'a function of no arguments, a `Function0`, that returns `true` once the stream is to end',
}

// A Kotlin string literal: `$` would start a template.
const str = (s: string): string => JSON.stringify(s).replace(/\$/g, '\\$')

const name = (r: Ref): string => r.name

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: '1L', NUMBER: '1.0', BOOLEAN: 'true', ARRAY: 'listOf<Any?>()', OBJECT: 'mapOf<String, Any?>()', NULL: 'null',
} as Record<string, string>)[e.type] ?? str(e.text)

// The record of an entity. A list's item is cast from `Any?` where it is
// read; a value an operation returned is cast where it is bound (below).
const data = (r: Ref): string => 'item' === r.role ? `(${name(r)} as SdkEntity).data()` : `${name(r)}.data()`
const field = (r: Ref, f: string): string => `(${data(r)} as Map<*, *>)[${str(f)}]`

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return str(e.text)
    case 'env': return `System.getenv(${str(e.name)})`
    case 'record': return data(e.of)
    case 'field': return field(e.of, e.field)
    case 'fields': return 'listOf(' + e.fields.map((f) => field(e.of, f)).join(', ') + ')'
    case 'map': return `mutableMapOf<String, Any?>(${e.entries.map(pair).join(', ')})`
  }
}

const pair = (en: Entry): string => `${str(en.key)} to ${expr(en.value)}`

// Whether the statements read the record a bound value holds.
const refers = (e: Expr, r: Ref): boolean => 'map' === e.k ? e.entries.some((en) => refers(en.value, r))
  : (('record' === e.k || 'field' === e.k || 'fields' === e.k) && e.of.name === r.name)
const reads = (stmts: Stmt[], r: Ref): boolean => stmts.some((s) => {
  if ('print' === s.k) return refers(s.what, r)
  if ('call' === s.k) return (s.arg || []).some((en) => refers(en.value, r))
  if ('each' === s.k || 'attempt' === s.k) return reads(s.body, r)
  return false
})

// A map laid out a member per line; a map member one level down is laid out
// the same way, deeper ones stay on their member's line.
const members = (entries: Entry[], pad: string, depth = 0): string[] =>
  entries.flatMap((en) => 'map' === en.value.k && 0 === depth && 0 < en.value.entries.length
    ? [`${pad}${str(en.key)} to mutableMapOf<String, Any?>(`, ...members(en.value.entries, pad + '    ', depth + 1), `${pad}),`]
    : [`${pad}${pair(en)},`])

// A call's argument: none, a map on one line, or a map laid out a member per
// line, each member's type after it, closed by a note.
const argOf = (s: Extract<Stmt, { k: 'call' }>): string => {
  if (null == s.arg) return 'null'
  const laid = s.wide && (null != s.note || s.arg.some((en) => null != en.type))
  if (!laid) return expr({ k: 'map', entries: s.arg })
  const lines = s.arg.map((en, i) => '    ' + pair(en) + (i < (s.arg as Entry[]).length - 1 ? ',' : '') +
    (null == en.type ? '' : '  // ' + canonToType(en.type, 'kotlin')))
  return `mutableMapOf<String, Any?>(\n${[...lines, ...(null == s.note ? [] : ['    // ' + s.note])].join('\n')}\n)`
}


const Syntax: SyntaxType = {
  interface: '3.3',
  fence: 'kotlin',
  facts,

  // The client class, and SdkEntity: always in the tutorial, whose imports
  // the reference examples (which print none) cast with; at the root only
  // where a record is read.
  imports: (desc, used, place) => [
    `import ${desc.layout.module}.${desc.layout.client}`,
    ...('tutorial' === place || used.print || used.field ? [`import ${desc.layout.module}.SdkEntity`] : []),
  ],

  client: (s, desc) => [
    0 === s.options.length
      ? `val client = ${desc.layout.ctor}()`
      : `val client = ${desc.layout.ctor}(mutableMapOf<String, Any?>(\n${members(s.options, '    ').join('\n')}\n))`,
  ],

  // An operation returns `Any?`: a list is cast to a List so that it can be
  // iterated, and an entity to SdkEntity where the block reads its record.
  call: (s, _desc, sc) => {
    const call = `client.${s.entity.sym.accessor}(null).${(facts.method as any)[s.op]}(${argOf(s)}, null)`
    if (null == s.bind) return [call]
    const cast = 'many' === s.bind.role ? ' as List<*>' : (reads(sc.stmts, s.bind) ? ' as SdkEntity' : '')
    return [`val ${name(s.bind)} = ${call}${cast}`]
  },

  each: (s, inner) => [
    `for (${name(s.item)} in ${name(s.of)}) {`,
    ...indentLines(inner(s.body), '    '),
    '}',
  ],

  print: (s) => [`println(${expr(s.what)})`],

  attempt: (s, inner) => [
    'try {',
    ...indentLines(inner(s.body), '    '),
    '}',
    'catch (err: RuntimeException) {',
    `    println("${s.what} failed: " + err.message)`,
    '}',
  ],

  comment: (text) => '// ' + text,

  expr: (e) => expr(e),

  ref: {
    facts: refFacts,
    type: (t) => canonToType(t, 'kotlin'),
    key: (container, path) => container + path.map((k) => `[${str(k)}]`).join(''),
    instance: (e) => [`val ${e.sym.var} = client.${e.sym.accessor}(null)`],
    read: (value, key, truth) => `${value}[${str(key)}]` + (truth ? ' == true' : ''),
  },

}


export {
  Syntax
}
