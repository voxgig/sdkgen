// How the lua runtime writes things: functions on the ProjectNameSDK and
// EntyClass tables (`:` for a method, `.` for a constructor), the returns
// documented by `---@return` lines; an operation returns `value, err`.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/lua/fragment/Entity${o}Op.fragment.lua`)

// The `---@return` lines directly above a declaration.
const docReturns = (before: string): string[] => {
  const lines = before.split('\n')
  lines.pop()
  const out: string[] = []
  while (0 < lines.length && /^---/.test(lines[lines.length - 1])) {
    const m = /^---@return\s+(\S+)/.exec(lines.pop() as string)
    if (null != m) out.unshift(m[1])
  }
  return out
}

const forms: Forms = {
  files: {
    client: ['src/cmp/lua/fragment/Main.fragment.lua', 'src/cmp/lua/MainEntity_lua.ts'],
    entity: ['src/cmp/lua/fragment/Entity.fragment.lua'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^function (?:ProjectNameSDK|EntyClass|\\$\\{model\\.const\\.Name\\}SDK)[.:]${name}(?=\\()`, 'm'),
  param: (p) => ({ name: (/^(\w+)/.exec(p.trim()) || ['', ''])[1], type: '' }),
  optional: () => true,
  returns: (_after, before) => docReturns(before).join(', '),
  entityCtor: 'new',
  public: {
    client: /^function ProjectNameSDK[.:]((?!new\b)[a-z]\w*)\(/gm,
    entity: /^function EntyClass[.:]((?!new\b)[a-z]\w*)\(/gm,
  },
  undocumented: {
    to_record: 'the table form the print helpers use',
    get_root_ctx: 'the pipeline\'s root context, for features',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it',
    mark_deleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance',
  },
  members: {
    options: 'options_map', utility: 'get_utility', direct: 'direct', prepare: 'prepare',
    dataGet: 'data_get', dataSet: 'data_set', matchGet: 'match_get', matchSet: 'match_set',
    make: 'make', name: 'get_name', stream: 'stream',
  },
  streamKind: (d) => /\n  return function\(\)/.test(d.rest.split(/\nfunction /)[0]) ? 'streamFunction' : 'stream',
  style: { exception: 'throw', raises: /\berror\(/, pair: (d) => /^\S+, string\?$/.test(d.returns) },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'new', accessor: '${entity.Name}' },
  types: { column: 'lua' },
  uncompared: { paramTypes: 'lua declares no parameter types' },
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, cite and exceptions.
  // What the table states besides names, parameters and returns.
  testDecl: 'test',
  on: (d) => /\.[\w\\]+$/.test(d.head) ? 'type' : 'instance',
  fails: (d) => 1 < d.returns.split(', ').length ? 'second value ' + d.returns.split(', ')[1] : '',
  failure: { shows: 'second value', call: 'err' },
  returnsFrom: () => 'comment',
  expect: { test: { on: 'type' }, new: { on: 'type' }, load: { on: 'instance' } },
  shows: {
    // The `---@return string? err` comment says string; the code returns a table.
    'an operation\'s second value on failure': {
      value: 'the `sdk_err` table, with `status` and `code`, not a string',
      file: 'tm/lua/utility/make_error.lua',
      quote: ['sdk_err.status = result.status or -1', 'sdk_err.code = ctx.utility.clean(ctx, err.code)', 'return nil, sdk_err'],
    },
  },
  stream: {
    file: "src/cmp/lua/fragment/Entity.fragment.lua",
    construct: "local co = coroutine.create(function()", starts: "on iteration",
    run: "local failed = self:_stream_steps(ctx)",
    draw: "for item in stream_fn() do",
    runs: "as the caller iterates", items: "as the caller iterates",
  },
}

export { forms }
