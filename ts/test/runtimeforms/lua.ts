// How the lua runtime writes things: functions on the ProjectNameSDK and
// EntyClass tables (`:` for a method, `.` for a constructor), the returns
// documented by `---@return` lines; an operation returns `value, err`.
import type { Forms } from './forms'

const MAIN = 'src/cmp/lua/fragment/Main.fragment.lua'
const ENTITY = 'src/cmp/lua/fragment/Entity.fragment.lua'
const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/lua/fragment/Entity${o}Op.fragment.lua`)

// The `---@return` lines directly above a declaration: the first by its type,
// a later one by the name it gives the value. The comment types the second
// value `string?`; the code returns the `sdk_err` table (make_error.lua, cited
// in `shows`), so the page names that value by its name, `err`.
const docReturns = (before: string): string[] => {
  const lines = before.split('\n')
  lines.pop()
  const found: RegExpExecArray[] = []
  while (0 < lines.length && /^---/.test(lines[lines.length - 1])) {
    const m = /^---@return\s+(\S+)(?:\s+(\w+))?/.exec(lines.pop() as string)
    if (null != m) found.unshift(m)
  }
  return found.map((m, i) => 0 === i ? m[1] : (m[2] || m[1]))
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
  style: { exception: 'throw', raises: /\berror\(/, pair: (d) => /^\S+, err$/.test(d.returns) },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'new', accessor: '${entity.Name}' },
  types: { column: 'lua' },
  uncompared: {
    paramTypes: 'lua declares no parameter types',
    returns: 'the runtime documents a return with `---@return` on the operations only; the facts that rest on the others are cited',
  },
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, cite and exceptions.
  renames: { args: ['data', 'match'] },
  namesWhy: 'the page names the setter argument by what it sets; the runtime names it args',
  // What the table states besides names, parameters and returns.
  testDecl: 'test',
  on: (d) => /\.[\w\\]+$/.test(d.head) ? 'type' : 'instance',
  fails: (d) => 1 < d.returns.split(', ').length ? 'second value ' + d.returns.split(', ')[1] : '',
  failure: { shows: 'err', call: 'err' },
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
  // direct's `ok` on a failure, cited ahead of the provider: a port declares ref.facts.direct.okFalse as this value.
  cite: {
    'ref.facts.direct.okFalse': { value: "false", file: "src/cmp/lua/fragment/Main.fragment.lua", quote: "return { ok = false, err = err }, nil" },
    // The test client's mock without the test feature, cited ahead: the factory's fallback.
    'ref.facts.testMock': { value: "generated", file: "src/cmp/lua/fragment/Main.fragment.lua", quote: "return features_factory.base()" },
    // The pair as the code returns it: the error table second on a failure, nil second on success.
    'facts.pairForm': { value: 'value, err', file: 'tm/lua/utility/make_error.lua', quote: 'return nil, sdk_err',
      also: [{ file: ENTITY, quote: 'return self, nil' }] },
    'facts.noError': { file: ENTITY, quote: 'return self, nil' },
    'facts.collection': { value: 'array', file: 'tm/lua/utility/make_result.lua', quote: ['local entities = {}', 'table.insert(entities, ent)', 'result.resdata = entities'] },
    'ref.facts.none': { file: 'src/cmp/lua/MainEntity_lua.ts', quote: 'if data == nil then' },
    'ref.facts.container': { file: MAIN, quote: 'local out = vs.clone(self.options)\n  if type(out) == "table" then' },
    // The module Main_lua writes is the chunk Main.fragment.lua, which returns the client table: requiring it gives the table `new` is called on.
    'ref.facts.ctor[0]': { file: 'src/cmp/lua/Main_lua.ts', quote: "File({ name: luaSdkModule(model) + '.' + target.ext }",
      also: [{ file: MAIN, quote: 'return ProjectNameSDK\n' }],
      unquoted: {
        local: 'Lua\'s keyword for a local binding; the line binds the module the quoted chunk returns',
        require: 'Lua\'s module loader, which runs the quoted chunk and gives back what it returns; no runtime file requires the SDK module itself',
        sdk: 'the name the page binds the required module to, as the generated tests bind it (tm/lua/test/extend_test.lua:14, TestEntity_lua.ts); test files are not runtime files',
      } },
    'ref.facts.client[0].copy': { value: true, file: MAIN, quote: 'local out = vs.clone(self.options)' },
    'ref.facts.client[1].kind': { value: 'utility', file: MAIN, quote: 'function ProjectNameSDK:get_utility()\n  return Utility.copy(self._utility)' },
    'ref.facts.direct.returns': { file: MAIN, quote: ['local out = {\n      ok = body_err == nil and status >= 200 and status < 300,', 'return out, nil'],
      unquoted: { table: 'the result is a table constructor, `{ ok = ..., status = ..., headers = ..., data = ... }`' } },
    'ref.facts.prepare.returns': { value: 'table, err', file: MAIN, quote: ['local _, err = utility.prepare_auth(ctx)\n  if err ~= nil then\n    return nil, err\n  end', 'return utility.make_fetch_def(ctx)'],
      also: [{ file: 'tm/lua/utility/make_fetch_def.lua', quote: 'return fetchdef, nil' }] },
    'ref.facts.prepare.fails': { value: 'style', file: MAIN, quote: 'local _, err = utility.prepare_auth(ctx)\n  if err ~= nil then\n    return nil, err' },
    'ref.facts.entity[0].copy': { value: true, file: ENTITY, quote: 'return vs.clone(self._data)' },
    'ref.facts.entity[2].copy': { value: true, file: ENTITY, quote: 'return vs.clone(self._match)' },
    'ref.facts.body.values': { value: 'a string', file: 'tm/lua/utility/fetcher.lua', quote: 'if type(body_str) ~= "string" then\n    body_str = nil' },
    // Searched over the whole lua runtime: a region it leaves out is quoted, with the reason.
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort(?!\(\))\w*|signal|signalled\??)\b|AbortController|isCancelled|CancellationToken|WithContext|context\.Context/i, except: [
      { file: "src/cmp/lua/fragment/Entity.fragment.lua", quote: ["--   - `ctrl` (pipeline control) and `signal` (cancellation) honoured.", "local signal = callopts[\"signal\"]", "local function aborted()", "if signal == nil then", "if type(signal) == \"function\" then", "return signal() and true or false", "if type(signal) == \"table\" and signal.aborted ~= nil then", "return signal.aborted and true or false", "for item in stream_fn() do\n        if aborted() then", "for _, item in ipairs(items) do\n        if aborted() then"],
        why: "the stream reads callopts.signal between the items it hands over (ref.facts.streamSignal); no operation reads it", fact: "ref.facts.streamSignal" },
      { file: "tm/lua/feature/cost_feature.lua", quote: ["-- supersedes it loses precision to catastrophic cancellation", "-- is set by PrePoint, so its absence is the signal."],
        why: "the cost feature's comments: floating-point 'catastrophic cancellation', and 'the signal' as an English word" },
      { file: "tm/lua/feature/secrets/native/sekretonet.c", quote: ["#include <signal.h>", "* callback is what makes a verification error abort the handshake", "/* Belt and braces. SSL_VERIFY_PEER already aborts on a bad chain, but", "signal(SIGPIPE, SIG_IGN);"],
        why: "the secrets feature's own client for fetching a secret (its HTTP, TLS or process calls), which no operation's request goes through" },
      { file: "tm/lua/feature/secrets/sekreto/name.lua", quote: ["--- aborting the rest of the file."],
        why: "the secrets feature's own client for fetching a secret (its HTTP, TLS or process calls), which no operation's request goes through" },
      { file: "tm/lua/feature/timeout_feature.lua", quote: ["-- request cannot be raced or aborted the way the async targets do it."],
        why: "the timeout feature's own deadline on the transport, which ends a request by time; no caller can cancel an operation through it" },
      { file: "tm/lua/utility/make_point.lua", quote: ["-- in ctx.out[\"point\"] to abort the operation before any endpoint"],
        why: "a feature (rbac) that places an error before the request stops the operation itself; no caller cancels through it" },
      { file: "tm/lua/utility/make_spec.lua", quote: ["-- error in ctx.out[\"spec\"] to abort the operation before the request is"],
        why: "a feature (rbac) that places an error before the request stops the operation itself; no caller cancels through it" },
    ] } },
    // The stream reads callopts.signal between items, which no operation does: cited ahead of a provider.
    'ref.facts.streamSignal': { value: true, file: "src/cmp/lua/fragment/Entity.fragment.lua", quote: ["local signal = callopts[\"signal\"]", "if aborted() then"] },
    'notes.member:direct': { value: 'It also returns a second value, which is always `nil`: a failure is\nreported in the result, never in the second value.',
      file: MAIN, quote: ['return self:_op_denied("direct"), nil', 'return { ok = false, err = err }, nil', 'return out, nil'] },
    'notes.member:streamFunction': { value: 'Unlike an operation, it reports a failure by raising it with `error`\nfrom the returned function, as the caller iterates.',
      file: ENTITY, quote: ['return function()', 'error(item, 0)', 'error(err, 0)'] },
  },
}

export { forms }
