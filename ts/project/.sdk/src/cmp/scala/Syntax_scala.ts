import { canonToType, indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, SdkDescription, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'

import { scalaLit, scalaObjectLit } from './utility_scala'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'call',
  async: false,
  result: 'throw',
  collection: '`ArrayList`',
  record: '{var}.data()',
  arity: 2,
  prints: 'record',
}

// The fixed API the reference page documents: Main.fragment.scala and
// core/SdkClient.scala (the client), EntityBase.fragment.scala and
// core/Contracts.scala (the entity), the Entity*Op fragments and
// MainEntity_scala (the accessor).
const refFacts: RefFacts = {
  entityBy: 'Name',
  noun: 'Methods',
  none: 'null',
  keys: 'member',
  maps: 'maps',
  container: 'java.util.Map[String, Object]',
  valueType: { STRING: 'String', OBJECT: 'Map', ANY: 'Object' },
  ctor: ['val client = new {ctor}(options)'],
  ctorAlts: [{ call: 'val client = new {ctor}()', kind: 'defaults' }],
  test: [
    { sig: '{client}.testSDK(): {client}', call: 'val client = {client}.testSDK()', args: false },
    {
      sig: '{client}.testSDK(testopts: java.util.Map[String, Object], sdkopts: java.util.Map[String, Object]): {client}',
      call: 'val client = {client}.testSDK(null, null)', args: true,
    },
  ],
  testMock: 'generated',
  accessor: { sig: '{accessor}(entopts: java.util.Map[String, Object]): SdkEntity', arg: 'entopts', param: 'entopts' },
  op: {
    list: 'list(reqmatch: java.util.Map[String, Object], ctrl: java.util.Map[String, Object]): Object',
    load: 'load(reqmatch: java.util.Map[String, Object], ctrl: java.util.Map[String, Object]): Object',
    create: 'create(reqdata: java.util.Map[String, Object], ctrl: java.util.Map[String, Object]): Object',
    update: 'update(reqdata: java.util.Map[String, Object], ctrl: java.util.Map[String, Object]): Object',
    patch: 'patch(reqdata: java.util.Map[String, Object], ctrl: java.util.Map[String, Object]): Object',
    remove: 'remove(reqmatch: java.util.Map[String, Object], ctrl: java.util.Map[String, Object]): Object',
  },
  client: [
    { kind: 'options', sig: 'optionsMap(): java.util.Map[String, Object]', copy: true },
    { kind: 'utility', sig: 'getUtility(): Utility', copy: true },
    { kind: 'direct', sig: 'direct(fetchargs: java.util.Map[String, Object]): java.util.Map[String, Object]' },
    { kind: 'prepare', sig: 'prepare(fetchargs: java.util.Map[String, Object]): java.util.Map[String, Object]' },
  ],
  entity: [
    { kind: 'data', sig: 'data(args: Object*): Object', copy: true },
    { kind: 'match', sig: 'matchArgs(args: Object*): Object', copy: true },
    { kind: 'make', sig: 'make(): Entity' },
    {
      kind: 'streamSync',
      sig: 'stream(action: String, args: java.util.Map[String, Object], callopts: java.util.Map[String, Object]): Iterator[Object]',
      runs: 'call',
    },
    { kind: 'name', sig: 'getName(): String' },
  ],
  direct: { returns: 'java.util.Map[String, Object]', okFalse: 'java.lang.Boolean.FALSE' },
  prepare: { returns: 'java.util.Map[String, Object]', fails: 'style' },
  body: { values: 'an `Array[Byte]`, a `java.io.InputStream` or a `String`', once: 'a `java.io.InputStream`' },
  cancel: false,
  streamSignal: true,
}

const MAP = 'java.util.Map'
const NEW_MAP = 'new java.util.LinkedHashMap[String, Object]()'

const str = (s: string): string => JSON.stringify(s)

const name = (r: Ref): string => r.name

// The literal table the scala generator's own examples use.
const lit = (e: Extract<Expr, { k: 'lit' }>): string => scalaLit(e.type, e.text)

const data = (r: Ref): string => `${name(r)}.data()`

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return str(e.text)
    case 'env': return `System.getenv(${str(e.name)})`
    case 'record': return data(e.of)
    case 'field': return `${data(e.of)}.asInstanceOf[${MAP}[String, Object]].get(${str(e.field)})`
    case 'fields': return e.fields.map((f) => `${data(e.of)}.asInstanceOf[${MAP}[String, Object]].get(${str(f)})`).join(' + " " + ')
    case 'map': return mapOf(held(e.entries).map(pair))
  }
}

const pair = (en: Entry): string => `${str(en.key)}, ${expr(en.value)}`

// A value a map of Object holds directly: an operation's argument map, or a
// put. A nested map's own values are inferred and need no box.
const boxed = (e: Expr): string => 'lit' === e.k ? scalaObjectLit(e.type, e.text) : expr(e)
const objPair = (en: Entry): string => `${str(en.key)}, ${boxed(en.value)}`

// Map.of rejects a null value (NullPointerException), so a member whose
// value is the null literal is left out of a Map.of map.
const held = (entries: Entry[]): Entry[] => entries.filter((en) => 'null' !== expr(en.value))

// Map.of has an overload per pair count up to ten; Map.ofEntries takes any.
const many = (n: number): boolean => 10 < n
const mapOf = (pairs: string[]): string => many(pairs.length)
  ? `${MAP}.ofEntries(` + pairs.map((p) => `${MAP}.entry(${p})`).join(', ') + ')'
  : `${MAP}.of(` + pairs.join(', ') + ')'

// A call's argument: none, a map on one line, or a map laid out a member per
// line where it carries types or a closing note.
const argOf = (s: Extract<Stmt, { k: 'call' }>): string => {
  if (null == s.arg) return 'null'
  const arg = held(s.arg)
  const laid = s.wide && (null != s.note || arg.some((en) => null != en.type))
  if (!laid) return mapOf(arg.map(objPair))
  const wrapped = many(arg.length)
  const lines = arg.map((en, i) => '    ' + (wrapped ? `${MAP}.entry(${objPair(en)})` : objPair(en)) +
    (i < arg.length - 1 ? ',' : '') +
    (null == en.type ? '' : '  // ' + canonToType(en.type, 'scala')))
  return `${MAP}.${wrapped ? 'ofEntries' : 'of'}(\n` + [...lines, ...(null == s.note ? [] : ['    // ' + s.note])].join('\n') + '\n)'
}

// An operation returns Object: a list is cast to a list of entities, any
// other result to the entity, before its record is read.
const cast = (s: Extract<Stmt, { k: 'call' }>, desc: SdkDescription): string => {
  const ent = (desc.layout.names || {}).entity
  return 'many' === (s.bind as Ref).role ? `.asInstanceOf[java.util.List[${ent}]]` : `.asInstanceOf[${ent}]`
}


const Syntax: SyntaxType = {
  fence: 'scala',
  facts,

  // The entity contract is imported where a call's result is cast to it.
  imports: (desc, used) => [
    `import ${desc.layout.module}.${desc.layout.client}`,
    ...(0 < used.entities.length ? [`import ${desc.layout.module}.${(desc.layout.names || {}).entity}`] : []),
  ],

  // A map-valued option is built as its own map first.
  client: (s, desc) => {
    if (0 === s.options.length) return [`val client = new ${desc.layout.ctor}()`]
    const out: string[] = []
    for (const en of s.options) {
      if ('map' === en.value.k) {
        out.push(`val ${en.key} = ${NEW_MAP}`)
        for (const sub of en.value.entries) out.push(`${en.key}.put(${str(sub.key)}, ${boxed(sub.value)})`)
      }
    }
    out.push(`val options = ${NEW_MAP}`)
    for (const en of s.options) out.push(`options.put(${str(en.key)}, ${'map' === en.value.k ? en.key : boxed(en.value)})`)
    out.push(`val client = new ${desc.layout.ctor}(options)`)
    return out
  },

  call: (s, desc) => {
    const call = `client.${s.entity.sym.accessor}(null).${(facts.method as any)[s.op]}(${argOf(s)}, null)`
    return [null == s.bind ? call : `val ${name(s.bind)} = ${call}${cast(s, desc)}`]
  },

  each: (s, inner) => {
    const body = inner(s.body)
    return 1 === body.length
      ? [`${name(s.of)}.forEach(${name(s.item)} => ${body[0]})`]
      : [`${name(s.of)}.forEach(${name(s.item)} => {`, ...indentLines(body, '    '), '})']
  },

  print: (s) => [`println(${expr(s.what)})`],

  attempt: (s, inner) => [
    'try {',
    ...indentLines(inner(s.body), '    '),
    '}',
    'catch {',
    `    case err: RuntimeException => println("${s.what} failed: " + err.getMessage)`,
    '}',
  ],

  comment: (text) => '// ' + text,

  expr: (e) => expr(e),

  ref: {
    facts: refFacts,
    type: (t) => canonToType(t, 'scala'),
    key: (container, path) => container + path.map((k) => `[${str(k)}]`).join(''),
    instance: (e) => [`val ${e.sym.var} = client.${e.sym.accessor}(null)`],
    // A truth test compares the boxed TRUE with the Object a map returns
    // (Object == true does not compile), as ReadmeHowto_scala writes it.
    read: (value, key, truth) => (truth ? 'java.lang.Boolean.TRUE == ' : '') + `${value}.get(${str(key)})`,
  },
}


export {
  Syntax
}
