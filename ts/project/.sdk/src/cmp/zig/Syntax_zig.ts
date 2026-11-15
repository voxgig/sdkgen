import { canonKey, indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, RefFacts, RuntimeFacts, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


const facts: RuntimeFacts = {
  method: { list: 'list', load: 'load', create: 'create', update: 'update', patch: 'patch', remove: 'remove' },
  named: 'call',
  async: false,
  result: 'union',
  collection: 'slice',
  record: 'asEntity().data(null)',
  ok: '.ok',
  err: '.err',
  unusedError: true,
  arity: 2,
  prints: 'record',
}

// The fixed API the reference page documents: Main.fragment.zig,
// Entity.fragment.zig and core/types.zig (the Entity interface).
const refFacts: RefFacts = {
  entityBy: 'class',
  noun: 'Methods',
  none: 'h.vnull()',
  setArg: 'a map',
  keys: 'bare',
  maps: 'maps',
  container: 'Value',
  valueType: { STRING: 'string', OBJECT: 'map', ANY: 'any' },
  ctor: ['const sdk = @import("{module}");', 'const h = sdk.h;', '', 'const client = sdk.{client}.new(options);'],
  test: [{ sig: 'test_sdk(testopts: Value, sdkopts: Value) *{client}', call: 'const client = sdk.test_sdk(h.vnull(), h.vnull());', args: true }],
  accessor: { sig: '{accessor}(entopts: Value) *{Class}', arg: 'entopts', param: 'entopts' },
  op: {
    list: 'list(reqmatch: Value, ctrl: Value) EntListResult',
    load: 'load(reqmatch: Value, ctrl: Value) EntResult',
    create: 'create(reqdata: Value, ctrl: Value) EntResult',
    update: 'update(reqdata: Value, ctrl: Value) EntResult',
    patch: 'patch(reqdata: Value, ctrl: Value) EntResult',
    remove: 'remove(reqmatch: Value, ctrl: Value) EntResult',
  },
  client: [
    { kind: 'options', sig: 'options_map() Value', copy: true },
    { kind: 'utility', sig: 'get_utility() *Utility', copy: true },
    { kind: 'direct', sig: 'direct(fetchargs: Value) Value' },
    { kind: 'prepare', sig: 'prepare(fetchargs: Value) E!Value' },
  ],
  entity: [
    { kind: 'dataArg', sig: 'data(args: ?Value) Value', copy: true },
    { kind: 'matchArg', sig: 'matchv(args: ?Value) Value', copy: true },
    { kind: 'streamList', sig: 'stream(action: []const u8, args: Value, callopts: Value) StreamResult', runs: 'call' },
    { kind: 'name', sig: 'get_name() []const u8' },
  ],
  direct: { returns: 'Value', okFalse: 'false' },
  prepare: { returns: 'E!Value', fails: 'note' },
  body: { values: 'a string value holding the bytes' },
  cancel: false,
  deleted: '{var}.deleted',
  testMock: 'always',
}

const str = (s: string): string => JSON.stringify(s)

const name = (r: Ref): string => r.name

// Zig emits no typed models (everything is a Value), so the reference names a
// field's type as the old page did, by the zig type its canonical type maps to.
const zigType = (t: any): string => ({
  STRING: '[]const u8', INTEGER: 'i64', NUMBER: 'f64', BOOLEAN: 'bool', ARRAY: 'Value (array)', OBJECT: 'Value (object)',
} as Record<string, string>)[canonKey(t)] ?? 'Value'

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: 'h.vnum(1)', NUMBER: 'h.vnum(1)', BOOLEAN: 'h.vbool(true)', ARRAY: 'h.olist()', OBJECT: 'h.omap()', NULL: 'h.vnull()',
} as Record<string, string>)[e.type] ?? `h.vstr(${str(e.text)})`

const data = (r: Ref): string => `${name(r)}.asEntity().data(null)`

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return `h.vstr(${str(e.text)})`
    // Zig 0.16 has no free-standing getenv: the process environment belongs
    // to the global Io, where the runtime reads it too (feature/proxy.zig).
    case 'env': return `h.vstr(std.Io.Threaded.global_single_threaded.environ.process_environ.getAlloc(h.A(), ${str(e.name)}) catch "")`
    case 'record': return `h.stringify(${data(e.of)})`
    case 'field': return `h.getp(${data(e.of)}, ${str(e.field)})`
    case 'fields': return e.fields.map((f) => `h.stringify(h.getp(${data(e.of)}, ${str(f)}))`).join(', ')
    case 'map': return `h.jo(&.{${e.entries.map(pair).join(', ')}})`
  }
}

const pair = (en: Entry): string => `.{ ${str(en.key)}, ${expr(en.value)} }`

// A map two levels down stays on its member's line; a member's type, where it
// has one, follows it.
const members = (entries: Entry[], pad: string, depth = 0): string[] =>
  entries.flatMap((en) => 'map' === en.value.k && 0 === depth
    ? [`${pad}.{ ${str(en.key)}, h.jo(&.{`, ...members(en.value.entries, pad + '    ', depth + 1), `${pad}}) },`]
    : [`${pad}${pair(en)},` + (null == en.type ? '' : ' // ' + zigType(en.type))])

// A write's data with types or a note is laid out a member per line.
const argOf = (s: Extract<Stmt, { k: 'call' }>): string => {
  if (null == s.arg) return 'h.vnull()'
  if (!(s.wide && (null != s.note || s.arg.some((en) => null != en.type)))) return expr({ k: 'map', entries: s.arg })
  return 'h.jo(&.{\n' + [...members(s.arg, '    '), ...(null == s.note ? [] : ['    // ' + s.note])].join('\n') + '\n})'
}

const callExpr = (s: Extract<Stmt, { k: 'call' }>): string =>
  `client.${s.entity.sym.accessor}(h.vnull()).${(facts.method as any)[s.op]}(${argOf(s)}, h.vnull())`

const failed = (what: string): string => `std.debug.print("${what} failed: {s}\\n", .{e.msg})`

// A statement printed as a switch arm: the trailing `;` becomes the arm's `,`.
const arm = (line: string): string => line.replace(/;$/, ',')


const Syntax: SyntaxType = {
  fence: 'zig',
  facts,

  imports: (desc) => [
    'const std = @import("std");',
    `const ${desc.layout.module} = @import("${desc.layout.module}");`,
    `const h = ${desc.layout.module}.h;`,
  ],

  client: (s, desc) => [
    0 === s.options.length
      ? `const client = ${desc.layout.module}.${desc.layout.ctor}(h.vnull());`
      : `const client = ${desc.layout.module}.${desc.layout.ctor}(h.jo(&.{\n${members(s.options, '    ').join('\n')}\n}));`,
  ],

  // The switch is how zig handles the result union. Inside an attempt the
  // switch is the attempt's; a call outside one is switched on here, and a
  // bound result is kept for what follows, so the error arm leaves.
  call: (s, _desc, _sc, cx) => {
    if (cx.inAttempt) return [callExpr(s)]
    if (null != s.bind) {
      return [
        `const ${name(s.bind)} = switch (${callExpr(s)}) {`,
        '    .ok => |e| e,',
        `    .err => |e| return ${failed(s.op)},`,
        '};',
      ]
    }
    return [
      `switch (${callExpr(s)}) {`,
      '    .ok => {},',
      `    .err => |e| ${failed(s.op)},`,
      '}',
    ]
  },

  each: (s, inner) => [
    `for (${name(s.of)}) |${name(s.item)}| {`,
    ...indentLines(inner(s.body), '    '),
    '}',
  ],

  print: (s) => 'fields' === s.what.k
    ? [`std.debug.print("${s.what.fields.map(() => '{s}').join(' ')}\\n", .{${expr(s.what)}});`]
    : [`std.debug.print("{s}\\n", .{${expr(s.what)}});`],

  // The first statement is the call switched on; the rest is its .ok arm.
  attempt: (s, inner) => {
    const [first, ...rest] = s.body
    const scrutinee = inner([first])
    const bound = 'call' === first.k && null != first.bind ? `|${name(first.bind)}| ` : ''
    const body = inner(rest)
    const ok = 1 === body.length
      ? [`    .ok => ${bound}${arm(body[0])}`]
      : [`    .ok => ${bound}{`, ...indentLines(body, '        '), '    },']
    return [
      `switch (${scrutinee.join('\n')}) {`,
      ...ok,
      `    .err => |e| ${failed(s.what)},`,
      '}',
    ]
  },

  comment: (text) => '// ' + text,

  expr: (e) => expr(e),

  ref: {
    facts: refFacts,
    type: zigType,
    key: (_container, path) => path.join('.'),
    instance: (e) => [`const ${e.sym.var} = client.${e.sym.accessor}(h.vnull());`],
    read: (value, key, truth) => truth ? `h.get_bool(${value}, ${str(key)}) orelse false` : `h.getp(${value}, ${str(key)})`,
  },

  notes: {
    'member:prepare': 'On failure it returns the error of its error union, for `try` or `catch`.',
    'member:streamList': 'Under `throw: false` in `callopts.ctrl`, a failed stream is `.ok` with\nwhatever data the failure left; otherwise `.err` holds the branded error.',
  },
}


export {
  Syntax
}
