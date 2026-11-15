// How the py runtime writes things: methods of the client and entity classes.
import type { Forms } from './forms'

const MAIN = 'src/cmp/py/fragment/Main.fragment.py'
const ENTITY = 'src/cmp/py/fragment/Entity.fragment.py'
const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/py/fragment/Entity${o}Op.fragment.py`)

const forms: Forms = {
  files: {
    client: ['src/cmp/py/fragment/Main.fragment.py', 'src/cmp/py/MainEntity_py.ts'],
    entity: ['src/cmp/py/fragment/Entity.fragment.py'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]+def ${name}(?=\\()`, 'm'),
  receiver: /^(self|cls)$/,
  param: (p) => {
    const m = /^\**(\w+)\s*(?::\s*([^=]+?))?\s*(?:=.*)?$/.exec(p.trim())
    return null == m ? { name: '', type: '' } : { name: m[1], type: (m[2] || '').trim() }
  },
  optional: (p) => /=/.test(p),
  returns: (after) => (/^\s*->\s*([^:]+):/.exec(after) || [])[1] || '',
  entityCtor: '__init__',
  ctorDecl: '__init__',
  public: {
    client: /^    def ([a-z]\w*)\(/gm,
    entity: /^    def ([a-z]\w*)\(/gm,
  },
  undocumented: {
    options: 'a property over the same options options_map() copies',
    get_root_ctx: 'the pipeline\'s root context, for features; not part of the documented API',
    mark_deleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance; not documented by the old pages',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it (old pages neither)',
  },
  members: {
    options: 'options_map', utility: 'get_utility', direct: 'direct', prepare: 'prepare',
    dataGet: 'data_get', dataSet: 'data_set', matchGet: 'match_get', matchSet: 'match_set',
    make: 'make', name: 'get_name', stream: 'stream',
  },
  streamKind: (d) => /\byield\b/.test(d.rest.split(/\n    def /)[0]) ? 'streamGenerator' : 'stream',
  style: { exception: 'raise', raises: /\braise\b/ },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', accessor: '${entity.Name}' },
  // How a call is written: `.` for every member; the class called is its constructor.
  calls: { on: { instance: ['.'], type: ['.'] } },
  types: { column: 'py' },
  // The porter's, from here on.
  uncompared: { returns: 'the runtime annotates the returns of the operations and data_get/match_get only; the others are cited where a fact rests on them' },
  cite: {
    // Cited ahead of the provider (brief 7): a later declaration must equal the pinned value.
    'ref.facts.entity[2].copy': { value: true, file: 'src/cmp/py/fragment/Entity.fragment.py', quote: 'return vs.clone(self._match)' },
    'ref.facts.client[0].copy': { value: true, file: "src/cmp/py/fragment/Main.fragment.py", quote: "out = vs.clone(self.options)" },
    // Decision 13: the getter returns what the copy function builds, a new object.
    'ref.facts.client[1].copy': { value: true, file: "src/cmp/py/fragment/Main.fragment.py", quote: "return ProjectNameUtility.copy(self._utility)", also: [{ file: "tm/py/pkg/core/utility_type.py", quote: ["    def copy(cls, src):\n        u = cls()"] }] },
    'ref.facts.none': { file: 'src/cmp/py/fragment/EntityLoadOp.fragment.py', quote: 'def load(self, reqmatch=None, ctrl=None) -> EntyClass:' },
    'ref.facts.direct.okFalse': { file: MAIN, quote: 'return {"ok": False, "err": utility.clean(self._rootctx, err)}' },
    'ref.facts.entity[0].copy': { value: true, file: "src/cmp/py/fragment/Entity.fragment.py", quote: "return vs.clone(self._data)" },
    'facts.recordType': { file: ENTITY, quote: ['def data_get(self) -> EntityName:', 'return vs.clone(self._data)'], unquoted: { dict: 'EntityName is a TypedDict, so a dict at run time' } },
    'ref.facts.container': { file: MAIN, quote: 'extend = options.get("extend") if isinstance(options, dict) else None' },
    'ref.facts.ctor[0]': {
      file: 'src/cmp/py/Main_py.ts', quote: ['File({ name: \'__init__.\' + target.ext }, () => {', 'from ${model.const.Name.toLowerCase()}_sdk.feature.base_feature import ${model.const.Name}BaseFeature'],
      also: [{ file: MAIN, quote: 'class ProjectNameSDK' }],
    },
    'ref.facts.client[1].kind': { value: "utility", file: MAIN, quote: 'return ProjectNameUtility.copy(self._utility)' },
    'ref.facts.direct.returns': { file: MAIN, quote: ['def direct(self, fetchargs=None):', 'return {"ok": False, "err": utility.clean(self._rootctx, err)}'], unquoted: { dict: 'the result is a dict literal; Python does not spell its type' } },
    'ref.facts.prepare.returns': { file: 'tm/py/pkg/utility/make_fetch_def.py', quote: ['"url": url,', '"method": spec.method,'], unquoted: { dict: 'the fetch definition is a dict literal' } },
    'ref.facts.prepare.fails': { value: "style", file: MAIN, quote: 'raise ctx.make_error("spec_method_allow",' },
    'ref.facts.body.values': { value: "`bytes`, `bytearray`, `memoryview`, a `str` or a file object",
      file: 'tm/py/pkg/utility/fetcher.py',
      quote: ['if isinstance(body, str):\n        return body.encode("utf-8")', 'if isinstance(body, (bytearray, memoryview)):', 'if isinstance(body, bytes) or hasattr(body, "read"):'],
    },
    'ref.facts.body.once': { value: "a file object", file: 'tm/py/pkg/utility/media.py', quote: 'if body is not None and callable(getattr(body, "read", None)):\n        return body.read()' },
    // Searched over the whole py runtime: a region it leaves out is quoted, with the reason.
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort(?!\(\))\w*|signal|signalled\??)\b|AbortController|isCancelled|CancellationToken|WithContext|context\.Context/i, except: [
      { file: "src/cmp/py/fragment/Entity.fragment.py", quote: ["#   - `ctrl` (pipeline control) and `signal` (cancellation) honoured.", "signal = callopts.get(\"signal\")", "def aborted():", "if signal is None:", "if callable(signal):", "return bool(signal())", "return bool(getattr(signal, \"aborted\", False))", "for item in stream_fn():\n                    if aborted():", "for item in items:\n                    if aborted():"],
        why: "the stream reads callopts.signal between the items it hands over (ref.facts.streamSignal); no operation reads it", fact: "ref.facts.streamSignal" },
      { file: "tm/py/pkg/feature/cost_feature.py", quote: ["# supersedes it loses precision to catastrophic cancellation.", "# `piped` is set by PrePoint, so its absence is the signal."],
        why: "the cost feature's comments: floating-point 'catastrophic cancellation', and 'the signal' as an English word" },
      { file: "tm/py/pkg/feature/secrets/voxgig_sekreto/plugins/minivault.py", quote: ["# ended at `Abort trap: 6` on the first vault case.", "# loader would resolve it to /usr/lib and abort."],
        why: "the secrets feature's own client for fetching a secret (its HTTP, TLS or process calls), which no operation's request goes through" },
      { file: "tm/py/pkg/feature/timeout_feature.py", quote: ["# Annotate the fetch definition so a real transport can cancel the", "# request itself (Python-idiomatic analog of an abort signal)."],
        why: "the timeout feature's own deadline on the transport, which ends a request by time; no caller can cancel an operation through it" },
      { file: "tm/py/pkg/utility/make_point.py", quote: ["# where `ctx.out.point instanceof Error` aborts the operation)."],
        why: "a feature (rbac) that places an error before the request stops the operation itself; no caller cancels through it" },
      { file: "tm/py/pkg/utility/voxgig_struct/voxgig_struct.py", quote: ["so transform/validate injectors can signal \"no value at this slot\""],
        why: "the vendored struct library's comment on its own error handling" },
    ] } },
    // The stream reads callopts.signal between items, which no operation does: cited ahead of a provider.
    'ref.facts.streamSignal': { value: true, file: "src/cmp/py/fragment/Entity.fragment.py", quote: ["signal = callopts.get(\"signal\")", "if aborted():"] },
    'ref.facts.testMock': { value: "generated", file: "src/cmp/py/Main_py.ts", quote: "return _FEATURES[\"base\"]()" },
  },
  exceptions: {
    'optional:opMatched list': 'the runtime defaults the match, and a nested entity\'s list needs its parent: the page shows it required, beside the sentence naming the members (stage 3, ref-10)',
    'returns:entity dataGet': 'EntityName is a TypedDict, so a dict; the page names the dict, as the old page did',
    'returns:entity matchGet': 'EntityName is a TypedDict, so a dict; the page names the dict, as the old page did',
  },
  // What the table states besides names, parameters and returns.
  testDecl: 'test',
  on: (d) => '__init__' === d.name || /(^|\n)[ \t]*@(classmethod|staticmethod)\b[^\n]*\n$/.test(d.before) ? 'type' : 'instance',
  stream: {
    file: "src/cmp/py/fragment/Entity.fragment.py",
    construct: "def stream(self, action, args=None, callopts=None):", starts: "on iteration",
    run: "failed = self._stream_steps(ctx)",
    draw: "for item in stream_fn():",
    runs: "as the caller iterates", items: "as the caller iterates",
  },
}

export { forms }
