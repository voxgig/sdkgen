import { canonToType, indentLines, javaMap } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'call',
  async: false,
  result: 'throw',
  collection: '`List`',
  record: 'data()',
  arity: 2,
  prints: 'record',
}

// The fixed API the reference page documents: Main.fragment.java,
// tm/java/core/SdkClient.java, EntityBase.fragment.java, Entity.fragment.java,
// the Entity*Op fragments and MainEntity_java.
const refFacts: RefFacts = {
  entityBy: 'class',
  noun: 'Methods',
  none: 'null',
  keys: 'member',
  maps: 'maps',
  container: 'Map<String, Object>',
  valueType: { STRING: 'String', OBJECT: 'Map<String, Object>', ANY: 'Object' },
  ctor: ['{client} client = new {ctor}(options);'],
  ctorAlts: [{ call: 'new {ctor}()', kind: 'defaults' }],
  test: [
    { sig: 'static {client} testSDK()', call: '{client} client = {client}.testSDK();', args: false },
    { sig: 'static {client} testSDK(Map<String, Object> testopts, Map<String, Object> sdkopts)', call: '{client} client = {client}.testSDK(null, null);', args: true },
  ],
  testMock: 'generated',
  accessor: { sig: 'SdkEntity {accessor}(Map<String, Object> entopts)', arg: 'entopts', param: 'entopts' },
  op: {
    list: 'Object list(Map<String, Object> reqmatch, Map<String, Object> ctrl)',
    load: 'Object load(Map<String, Object> reqmatch, Map<String, Object> ctrl)',
    create: 'Object create(Map<String, Object> reqdata, Map<String, Object> ctrl)',
    update: 'Object update(Map<String, Object> reqdata, Map<String, Object> ctrl)',
    patch: 'Object patch(Map<String, Object> reqdata, Map<String, Object> ctrl)',
    remove: 'Object remove(Map<String, Object> reqmatch, Map<String, Object> ctrl)',
  },
  client: [
    { kind: 'options', sig: 'Map<String, Object> optionsMap()', copy: true },
    { kind: 'utility', sig: 'Utility getUtility()', copy: true },
    { kind: 'direct', sig: 'Map<String, Object> direct(Map<String, Object> fetchargs)' },
    { kind: 'prepare', sig: 'Map<String, Object> prepare(Map<String, Object> fetchargs)' },
  ],
  entity: [
    { kind: 'data', sig: 'Object data(Object... args)', copy: true },
    { kind: 'match', sig: 'Object match(Object... args)', copy: true },
    { kind: 'make', sig: 'Entity make()' },
    { kind: 'streamLazy', sig: 'Stream<Object> stream(String action, Map<String, Object> args, Map<String, Object> callopts)', runs: 'call' },
    { kind: 'name', sig: 'String getName()' },
  ],
  direct: { returns: 'Map<String, Object>', okFalse: 'false' },
  prepare: { returns: 'Map<String, Object>', fails: 'style' },
  body: { values: 'a `byte[]`, a `String` or an `InputStream`', once: 'an `InputStream`' },
  cancel: false,
  // The examples bind an operation's result as Object or SdkEntity, which
  // declare no deleted(): EntityBase, which every entity class extends, does.
  deleted: '((EntityBase) {var}).deleted()',
  streamSignal: true,
}

const str = (s: string): string => JSON.stringify(s)

const name = (r: Ref): string => r.name

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: '1L', NUMBER: '1.0', BOOLEAN: 'true', ARRAY: 'List.of()', OBJECT: 'Map.of()', NULL: 'null',
} as Record<string, string>)[e.type] ?? str(e.text)

// An operation returns Object. A result the block reads is bound as an
// SdkEntity, cast once; a list's item, an Object, is cast where it is read.
const entity = (r: Ref): string => 'item' === r.role ? `((SdkEntity) ${name(r)})` : name(r)

// Whether the statements read the value bound to `n`.
const exprReads = (e: Expr, n: string): boolean => 'map' === e.k ? e.entries.some((en) => exprReads(en.value, n))
  : (('record' === e.k || 'field' === e.k || 'fields' === e.k) && n === e.of.name)
const reads = (stmts: Stmt[], n: string): boolean => stmts.some((s) => {
  if ('print' === s.k) return exprReads(s.what, n)
  if ('call' === s.k) return (s.arg || []).some((en) => exprReads(en.value, n))
  if ('each' === s.k || 'attempt' === s.k) return reads(s.body, n)
  return false
})
const data = (r: Ref): string => `${entity(r)}.data()`
const field = (r: Ref, f: string): string => `((Map<?, ?>) ${data(r)}).get(${str(f)})`

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return str(e.text)
    case 'env': return `System.getenv(${str(e.name)})`
    case 'record': return data(e.of)
    case 'field': return field(e.of, e.field)
    case 'fields': return e.fields.map((f) => field(e.of, f)).join(' + " " + ')
    case 'map': return mapOf(e.entries)
  }
}

const pair = (en: Entry): string => `${str(en.key)}, ${expr(en.value)}`

// Map.of on one line; Map.ofEntries past the pairs Map.of takes.
const mapOf = (entries: Entry[]): string => {
  const m = javaMap(entries.length)
  return m.open + entries.map((en) => m.pair(pair(en))).join(', ') + ')'
}

// A call's argument: none, a map on one line, or a map laid out a member per
// line where it carries types or a closing note.
const argOf = (s: Extract<Stmt, { k: 'call' }>): string => {
  if (null == s.arg) return 'null'
  const laid = s.wide && (null != s.note || s.arg.some((en) => null != en.type))
  if (!laid) return mapOf(s.arg)
  const m = javaMap(s.arg.length)
  const n = s.arg.length
  const lines = s.arg.map((en, i) => '    ' + m.pair(pair(en)) + (i < n - 1 ? ',' : '') +
    (null == en.type ? '' : '  // ' + canonToType(en.type, 'java')))
  return m.open + '\n' + [...lines, ...(null == s.note ? [] : ['    // ' + s.note])].join('\n') + '\n)'
}


const Syntax: SyntaxType = {
  fence: 'java',
  facts,

  imports: (desc, used) => [
    'import java.util.List;',
    'import java.util.Map;',
    `import ${desc.layout.module}.${(desc.layout.names || {}).core}.${desc.layout.client};`,
    ...(0 < used.entities.length ? [`import ${desc.layout.module}.${(desc.layout.names || {}).core}.SdkEntity;`] : []),
  ],

  // A map-valued option is built as its own map just before it is put.
  client: (s, desc) => {
    if (0 === s.options.length) return [`${desc.layout.client} client = new ${desc.layout.ctor}();`]
    const out: string[] = ['Map<String, Object> options = new java.util.LinkedHashMap<>();']
    for (const en of s.options) {
      if ('map' === en.value.k) {
        out.push(`Map<String, Object> ${en.key} = new java.util.LinkedHashMap<>();`)
        for (const sub of en.value.entries) out.push(`${en.key}.put(${str(sub.key)}, ${expr(sub.value)});`)
      }
      out.push(`options.put(${str(en.key)}, ${'map' === en.value.k ? en.key : expr(en.value)});`)
    }
    out.push(`${desc.layout.client} client = new ${desc.layout.ctor}(options);`)
    return out
  },

  call: (s, _desc, sc) => {
    const call = `client.${s.entity.sym.accessor}(null).${(facts.method as any)[s.op]}(${argOf(s)}, null)`
    if (null == s.bind) return [call + ';']
    if ('many' === s.bind.role) return [`List<?> ${name(s.bind)} = (List<?>) ${call};`]
    if (reads(sc.stmts, name(s.bind))) return [`SdkEntity ${name(s.bind)} = (SdkEntity) ${call};`]
    return [`Object ${name(s.bind)} = ${call};`]
  },

  each: (s, inner) => [
    `for (Object ${name(s.item)} : ${name(s.of)}) {`,
    ...indentLines(inner(s.body), '    '),
    '}',
  ],

  print: (s) => [`System.out.println(${expr(s.what)});`],

  attempt: (s, inner) => [
    'try {',
    ...indentLines(inner(s.body), '    '),
    '}',
    'catch (RuntimeException err) {',
    `    System.out.println(${str(s.what + ' failed: ')} + err.getMessage());`,
    '}',
  ],

  comment: (text) => '// ' + text,

  expr: (e) => expr(e),

  ref: {
    facts: refFacts,
    type: (t) => canonToType(t, 'java'),
    key: (container, path) => container + path.map((k) => `[${str(k)}]`).join(''),
    instance: (e) => [`SdkEntity ${e.sym.var} = client.${e.sym.accessor}(null);`],
    read: (value, key, truth) => truth ? `Boolean.TRUE.equals(${value}.get(${str(key)}))` : `${value}.get(${str(key)})`,
  },
}


export {
  Syntax
}
