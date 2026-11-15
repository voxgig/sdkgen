import { canonToType, indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'call',
  async: false,
  result: 'wrapped',
  collection: '`VList`',
  record: '({var}.asNative as? Entity)?.data()',
  unwrap: 'asNative as? Entity',
  prints: 'record',
}

// The fixed API the reference page documents: Main.fragment.swift,
// EntityBase.fragment.swift, Entity.fragment.swift, the Entity*Op fragments
// and MainEntity_swift.
const refFacts: RefFacts = {
  entityBy: 'class',
  noun: 'Methods',
  none: 'nil',
  setArg: 'a `Value`',
  keys: 'member',
  maps: 'maps',
  container: 'VMap',
  valueType: { STRING: 'String', OBJECT: 'VMap', ANY: 'Value' },
  ctor: ['let client = {ctor}(options)'],
  test: [{
    sig: '{client}.testSDK(_ testopts: VMap?, _ sdkopts: VMap?) -> {client}',
    call: 'let client = {client}.testSDK(nil, nil)', args: true,
  }],
  accessor: { sig: '{accessor}(_ entopts: VMap? = nil) -> ProjectNameEntityBase', arg: 'entopts', param: 'entopts' },
  op: {
    list: 'list(_ reqmatch: VMap?, _ ctrl: VMap?) throws -> Value',
    load: 'load(_ reqmatch: VMap?, _ ctrl: VMap?) throws -> Value',
    create: 'create(_ reqdata: VMap?, _ ctrl: VMap?) throws -> Value',
    update: 'update(_ reqdata: VMap?, _ ctrl: VMap?) throws -> Value',
    patch: 'patch(_ reqdata: VMap?, _ ctrl: VMap?) throws -> Value',
    remove: 'remove(_ reqmatch: VMap?, _ ctrl: VMap?) throws -> Value',
  },
  client: [
    { kind: 'options', sig: 'optionsMap() -> VMap', copy: true },
    { kind: 'utility', sig: 'getUtility() -> Utility' },
    { kind: 'direct', sig: 'direct(_ fetchargs: VMap?) -> VMap' },
    { kind: 'prepare', sig: 'prepare(_ fetchargs: VMap?) throws -> VMap' },
  ],
  entity: [
    { kind: 'dataArg', sig: 'data(_ newdata: Value?) -> Value', copy: true },
    { kind: 'matchArg', sig: 'matchv(_ newmatch: Value?) -> Value' },
    { kind: 'make', sig: 'make() -> Entity' },
    { kind: 'streamIterator', sig: 'stream(_ action: String, _ args: VMap? = nil, _ callopts: VMap? = nil) throws -> AsyncStream<Value>', runs: 'call' },
    { kind: 'name', sig: 'getName() -> String' },
  ],
  direct: { returns: 'VMap', okFalse: 'false' },
  prepare: { returns: 'VMap', fails: 'style' },
  body: { values: 'a `String`, or `Data` or `[UInt8]` as a `.native` value' },
  cancel: false,
}

// A double-quoted Swift string literal.
const str = (s: string): string => '"' + s
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')
  .replace(/\n/g, '\\n')
  .replace(/\r/g, '\\r')
  .replace(/\t/g, '\\t') + '"'

const name = (r: Ref): string => r.name

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: '.int(1)', NUMBER: '.double(1.0)', BOOLEAN: '.bool(true)', ARRAY: '.list([])', OBJECT: '.map(VMap())', NULL: '.null',
} as Record<string, string>)[e.type] ?? `.string(${str(e.text)})`

// Every value is a `Value`: a map is `.map` of its pairs, and a record is read
// off the entity a returned value holds.
const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return `.string(${str(e.text)})`
    case 'env': return `.string(\n    ProcessInfo.processInfo.environment[${str(e.name)}] ?? "")`
    case 'record': return `${name(e.of)}.data()`
    case 'field': return `(${name(e.of)}.asNative as? Entity)?.data().asMap?.entries[${str(e.field)}] ?? .null`
    case 'fields': return `${name(e.of)}.data()`
    case 'map': return 0 === e.entries.length ? '.map(VMap())' : '.map([' + e.entries.map(pair).join(', ') + '])'
  }
}

const pair = (en: Entry): string => `(${str(en.key)}, ${expr(en.value)})`

// A call's argument: none, a map on one line, or a map laid out a member per
// line where it carries types or a closing note.
const argOf = (s: Extract<Stmt, { k: 'call' }>): string => {
  if (null == s.arg) return 'nil'
  if (0 === s.arg.length) return 'VMap()'
  const laid = s.wide && (null != s.note || s.arg.some((en) => null != en.type))
  if (!laid) return 'VMap([' + s.arg.map(pair).join(', ') + '])'
  const lines = s.arg.map((en, i) => '    ' + pair(en) + (i < (s.arg as Entry[]).length - 1 ? ',' : '') +
    (null == en.type ? '' : '  // ' + canonToType(en.type, 'swift')))
  return 'VMap([\n' + [...lines, ...(null == s.note ? [] : ['    // ' + s.note])].join('\n') + '\n])'
}


const Syntax: SyntaxType = {
  fence: 'swift',
  facts,

  // ProcessInfo, which an option read from the environment needs, is Foundation's.
  imports: (desc, used) => [...(used.env ? ['import Foundation'] : []), `import ${desc.layout.module}`],

  // A map-valued option is built as its own VMap first.
  client: (s, desc) => {
    if (0 === s.options.length) return [`let client = ${desc.layout.ctor}()`]
    const out: string[] = []
    for (const en of s.options) {
      if ('map' === en.value.k) {
        out.push(`let ${en.key} = VMap()`)
        for (const sub of en.value.entries) out.push(`${en.key}.entries[${str(sub.key)}] = ${expr(sub.value)}`)
      }
    }
    out.push('let options = VMap()')
    for (const en of s.options) {
      out.push(`options.entries[${str(en.key)}] = ${'map' === en.value.k ? `.map(${en.key})` : expr(en.value)}`)
    }
    out.push(`let client = ${desc.layout.ctor}(options)`)
    return out
  },

  call: (s) => {
    const call = `try client.${s.entity.sym.accessor}().${(facts.method as any)[s.op]}(${argOf(s)}, nil)`
    return [null == s.bind ? `_ = ${call}` : `let ${name(s.bind)} = ${call}`]
  },

  each: (s, inner) => [
    `for ${name(s.item)} in ${name(s.of)}.asList?.items ?? [] {`,
    ...indentLines(inner(s.body), '    '),
    '}',
  ],

  // The entity is taken out of the value it is returned in, under the same name.
  print: (s) => 'record' === s.what.k || 'fields' === s.what.k
    ? [`if let ${name(s.what.of)} = ${name(s.what.of)}.asNative as? Entity {`,
      `    print(${name(s.what.of)}.data())`, '}']
    : [`print(${expr(s.what)})`],

  attempt: (s, inner) => [
    'do {',
    ...indentLines(inner(s.body), '    '),
    '}',
    'catch {',
    `    print("${s.what} failed: \\(error)")`,
    '}',
  ],

  comment: (text) => '// ' + text,

  expr: (e) => expr(e),

  ref: {
    facts: refFacts,
    type: (t) => canonToType(t, 'swift'),
    key: (container, path) => container + path.map((k) => `[${str(k)}]`).join(''),
    instance: (e) => [`let ${e.sym.var} = client.${e.sym.accessor}()`],
    read: (value, key) => `${value}.entries[${str(key)}]`,
  },
}


export {
  Syntax
}
