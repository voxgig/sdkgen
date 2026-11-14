import { indentLines } from '@voxgig/sdkgen'
import type { Entry, Expr, Ref, Scope, Stmt, Syntax as SyntaxType } from '@voxgig/sdkgen'


// As utility_zig's ZIG_RESERVED, copied: that module also holds helpers that read the model.
const RESERVED = new Set<string>([
  'addrspace', 'align', 'allowzero', 'and', 'anyframe', 'anytype', 'asm',
  'async', 'await', 'break', 'callconv', 'catch', 'comptime', 'const',
  'continue', 'defer', 'else', 'enum', 'errdefer', 'error', 'export',
  'extern', 'fn', 'for', 'if', 'inline', 'noalias', 'nosuspend', 'noinline',
  'opaque', 'or', 'orelse', 'packed', 'pub', 'resume', 'return',
  'linksection', 'struct', 'suspend', 'switch', 'test', 'threadlocal', 'try',
  'union', 'unreachable', 'usingnamespace', 'var', 'volatile', 'while',
])

const varName = (n: string): string => {
  const snake = n.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
  return RESERVED.has(snake) ? snake + '_' : snake
}

const str = (s: string): string => JSON.stringify(s)

const name = (r: Ref): string =>
  'created' === r.role ? 'created' : varName(r.entity.name) + ('many' === r.role ? 's' : '')

const lit = (e: Extract<Expr, { k: 'lit' }>): string => ({
  INTEGER: 'h.vnum(1)', NUMBER: 'h.vnum(1)', BOOLEAN: 'h.vbool(true)', ARRAY: 'h.olist()', OBJECT: 'h.omap()', NULL: 'h.vnull()',
} as Record<string, string>)[e.type] ?? `h.vstr(${str(e.text)})`

const data = (r: Ref): string => `${name(r)}.asEntity().data(null)`

const expr = (e: Expr): string => {
  switch (e.k) {
    case 'lit': return lit(e)
    case 'str': return `h.vstr(${str(e.text)})`
    case 'env': return `h.vstr(std.posix.getenv(${str(e.name)}) orelse "")`
    case 'record': return `h.stringify(${data(e.of)})`
    case 'field': return `h.getp(${data(e.of)}, ${str(e.field)})`
    case 'map': return `h.jo(&.{${e.entries.map(pair).join(', ')}})`
  }
}

const pair = (en: Entry): string => `.{ ${str(en.key)}, ${expr(en.value)} }`

const members = (entries: Entry[], pad: string): string[] =>
  entries.flatMap((en) => 'map' === en.value.k
    ? [`${pad}.{ ${str(en.key)}, h.jo(&.{`, ...members(en.value.entries, pad + '    '), `${pad}}) },`]
    : [`${pad}${pair(en)},`])

const callExpr = (s: Extract<Stmt, { k: 'call' }>): string =>
  `client.${varName(s.entity.name)}(h.vnull()).${s.op}(${null == s.arg ? 'h.vnull()' : expr({ k: 'map', entries: s.arg })}, h.vnull())`

const failed = (what: string): string => `std.debug.print("${what} failed: {s}\\n", .{e.msg})`

// A statement printed as a switch arm: the trailing `;` becomes the arm's `,`.
const arm = (line: string): string => line.replace(/;$/, ',')

// The switch is how zig handles the result union. Inside an attempt the
// switch is the attempt's; a call reached outside one is switched on here.
const INSIDE = 'attempt'


const Syntax: SyntaxType = {
  fence: 'zig',

  words: {
    op: (op) => '`' + op + '()`',
    many: 'a result whose `.ok` is a slice',
    one: 'a result whose `.ok` is the entity',
    fails: 'reports failure in `.err`',
    data: '`asEntity().data(null)`',
  },

  client: (s, desc) => [
    'const std = @import("std");',
    'const sdk = @import("sdk");',
    'const h = sdk.h;',
    '',
    0 === s.options.length
      ? `const client = sdk.${desc.Name}SDK.new(h.vnull());`
      : `const client = sdk.${desc.Name}SDK.new(h.jo(&.{\n${members(s.options, '    ').join('\n')}\n}));`,
  ],

  call: (s, _desc, sc: Scope) => {
    if (sc.local.has(INSIDE)) {
      return [callExpr(s)]
    }
    // Outside an attempt: the write's own switch. A bound result is kept for
    // what follows it, so the error arm leaves the function.
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

  print: (s, sc) => [`std.debug.print("{s}\\n", .{${Syntax.expr(s.what, sc)}});`],

  // The first statement is the call switched on; the rest is its .ok arm.
  attempt: (s, inner, sc) => {
    const [first, ...rest] = s.body
    sc.local.add(INSIDE)
    const scrutinee = inner([first])
    sc.local.delete(INSIDE)
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
}


export {
  Syntax
}
