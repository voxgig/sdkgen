// How the zig runtime writes things: pub fns of the client and entity
// structs, an entity's data and match on the core Entity interface.
import type { Forms } from './forms'

const MAIN = 'src/cmp/zig/fragment/Main.fragment.zig'
const ENTITY = 'src/cmp/zig/fragment/Entity.fragment.zig'
const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/zig/fragment/Entity${o}Op.fragment.zig`)

const forms: Forms = {
  files: {
    client: ['src/cmp/zig/fragment/Main.fragment.zig', 'src/cmp/zig/MainEntity_zig.ts'],
    entity: ['src/cmp/zig/fragment/Entity.fragment.zig', 'tm/zig/core/types.zig'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]*pub fn ${name}(?=\\()`, 'm'),
  receiver: /^self\s*:/,
  param: (p) => {
    const m = /^(\w+)\s*:\s*(.+)$/.exec(p.trim())
    return null == m ? { name: '', type: '' } : { name: m[1], type: m[2].trim() }
  },
  optional: () => false,
  returns: (after) => after.replace(/\s\{.*$/, '').trim(),
  opName: /^pub fn ([a-z]\w*)\(self: \*EntyClass/gm,
  entityCtor: 'new',
  public: {
    client: /^\s*pub fn ([a-z]\w*)\(/gm,
    entity: /^    pub fn ([a-z]\w*)\(self: (?:\*EntyClass|Entity\b)/gm,
  },
  undocumented: {
    new_with: 'a constructor that also takes extra features; the old page did not document it',
    get_root_ctx: 'the pipeline\'s root context, for features; not part of the documented API',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it (old pages neither)',
    mark_deleted: 'set by remove itself; the entity reports it through is_deleted',
    is_deleted: 'whether remove succeeded on this instance; not documented by the old pages',
    makeEnt: 'the core Entity interface\'s make, which the record accessor\'s asEntity() reaches; the page documents no make for zig',
  },
  members: {
    options: 'options_map', utility: 'get_utility', direct: 'direct', prepare: 'prepare',
    data: 'data', match: 'matchv', name: 'get_name', stream: 'stream',
  },
  streamKind: (d) => /^StreamResult$/.test(d.returns) ? 'streamList' : 'unknown',
  style: { exception: 'throw', raises: /$^/, union: (d) => /^\w*Result$/.test(d.returns) },
  record: (rec) => {
    const m = /(\w+)\(([^()]*)\)$/.exec(rec)
    return null == m ? { name: rec } : { name: m[1], arity: '' === m[2] ? 0 : m[2].split(',').length }
  },
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: 'new', accessor: '${method}' },
  types: { column: null, reason: 'the code generator has no zig column in canonToType: every field is a Value, so the page\'s type words are the provider\'s own' },

  // The porter's, from here on.
  renames: { fetchargs_in: 'fetchargs', testopts_in: 'testopts', sdkopts_in: 'sdkopts' },
  typeNames: { '*@import("../entity/${mod}.zig").${cls}': '*EntyClass' },
  namesWhy: 'zig passes by position; the runtime suffixes a parameter it rebinds with _in, and the accessor\'s return is spelled through the generator',
  cite: {
    'ref.facts.lits.false': { value: 'false', file: MAIN, quote: '.{ "ok", h.vbool(false) },' },
    'ref.facts.lits.true': { value: 'true', file: MAIN, quote: '.{ "ok", h.vbool(200 <= status and status < 300) },', unquoted: { true: 'ok is the bool the status test computes; true is not spelled' } },
    'ref.facts.entity[0].copy': { value: true, file: "src/cmp/zig/fragment/Entity.fragment.zig", quote: "return h.clone(self.data);" },
    'facts.collection': { value: "slice", file: ENTITY, quote: 'pub const EntListResult = union(enum) {\n    ok: []*EntyClass,' },
    'facts.ok': { file: ENTITY, quote: '.ok => EntResult{ .ok = self },' },
    'facts.err': { file: ENTITY, quote: '.err => |e| EntResult{ .err = e },' },
    'ref.facts.none': { file: MAIN, quote: '.options = h.vnull(),' },
    'ref.facts.container': { file: MAIN, quote: 'pub fn new(options: Value) *ProjectNameSDK {' },
    'ref.facts.ctor[0]': { file: 'src/cmp/zig/fragment/Root.fragment.zig', quote: ['const sdk = @import("core/sdk.zig");', '// SDK graph (core -> config -> features/utility/entities) so `@import("sdk")`'] },
    'ref.facts.ctor[1]': { file: 'src/cmp/zig/fragment/Root.fragment.zig', quote: 'pub const h = helpers;', unquoted: { sdk: 'the module root, which the line before imports as sdk' } },
    'ref.facts.client[1].kind': { value: "utility", file: MAIN, quote: 'return Utility.copy(self.sdkUtility);' },
    'ref.facts.prepare.fails': { value: "note", file: MAIN, quote: 'pub fn prepare(self: *ProjectNameSDK, fetchargs_in: Value) E!Value {' },
    'ref.facts.body.values': { value: "a string value holding the bytes",
      file: 'tm/zig/core/utility.zig',
      quote: ['.string, .integer, .float, .number_string, .bool => is_json_request(ctx.point),', 'h.setp(fetchdef, "body", body);'],
    },
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort\w*|signal)\b|AbortController|WithContext|context\.Context|cancel_request|sendAsync/i, files: ['tm/zig/core/utility.zig'] } },
    'notes.member:prepare': { value: "On failure it returns the error of its error union, for `try` or `catch`.", file: MAIN, quote: 'pub fn prepare(self: *ProjectNameSDK, fetchargs_in: Value) E!Value {', also: [{ file: 'tm/zig/core/error.zig', quote: 'pub const E = error{Sdk};' }],
      unquoted: { try: 'a Zig keyword for a call to an error-union function', catch: 'a Zig keyword for a call to an error-union function' } },
    'notes.member:streamList': { value: "Under `throw: false` in `callopts.ctrl`, a failed stream is `.ok` with\nwhatever data the failure left; otherwise `.err` holds the branded error.",
      file: ENTITY,
      quote: ['// What make_error or done hands back, as a stream: the error, or under\n    // `throw: false` the data there is.', '.err => |e| return .{ .err = e },', 'return .{ .ok = sf.call(sf.ctx) };', 'const given = h.to_map(h.getp(stream_opts, "ctrl"));'],
      unquoted: { 'callopts.ctrl': 'the option path; stream reads the ctrl key of its callopts (stream_opts) with getp' },
    },
  },
  // What the table states besides names, parameters and returns.
  testDecl: 'test_sdk',
  on: (d) => /^\(self\s*:/.test(d.rest) ? 'instance' : (/^[ \t]+/.test(d.head) ? 'type' : 'module'),
  fails: (d) => /Result$/.test(d.returns) ? 'error union ' + d.returns : '',
  failure: { shows: 'Result', call: '.err' },
  stream: {
    file: "src/cmp/zig/fragment/Entity.fragment.zig",
    construct: "return .{ .ok = sf.call(sf.ctx) };", starts: "at call",
    run: "const point = utility.make_point(ctx) catch return streamItems(self.opError(ctx));",
    draw: "return .{ .ok = sf.call(sf.ctx) };",
    runs: "before it returns", items: "before it returns",
  },
}

export { forms }
