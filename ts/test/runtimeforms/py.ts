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
  types: { column: 'py' },
  // The porter's, from here on.
  uncompared: { returns: 'the runtime annotates the returns of the operations and data_get/match_get only; the others are cited where a fact rests on them' },
  cite: {
    'ref.facts.none': { file: 'src/cmp/py/fragment/EntityLoadOp.fragment.py', quote: 'def load(self, reqmatch=None, ctrl=None) -> EntyClass:' },
    'ref.facts.lits.false': { file: MAIN, quote: 'return {"ok": False, "err": utility.clean(self._rootctx, err)}' },
    'ref.facts.lits.true': { file: MAIN, quote: '"ok": body_err is None and status >= 200 and status < 300,', unquoted: { True: 'ok is the bool the status test computes; True is not spelled' } },
    'ref.facts.entity[0].copy': { value: true, file: "src/cmp/py/fragment/Entity.fragment.py", quote: "return vs.clone(self._data)" },
    'facts.recordType': { file: ENTITY, quote: ['def data_get(self) -> EntityName:', 'return vs.clone(self._data)'], unquoted: { dict: 'EntityName is a TypedDict, so a dict at run time' } },
    'ref.facts.container': { file: MAIN, quote: 'extend = options.get("extend") if isinstance(options, dict) else None' },
    'ref.facts.ctor[0]': {
      file: 'src/cmp/py/Main_py.ts', quote: ['File({ name: \'__init__.\' + target.ext }, () => {', 'from ${model.const.Name.toLowerCase()}_sdk.feature.base_feature import ${model.const.Name}BaseFeature'],
      also: [{ file: MAIN, quote: 'class ProjectNameSDK' }],
    },
    'ref.facts.client[1].kind': { value: "utility", file: MAIN, quote: 'return ProjectNameUtility.copy(self._utility)' },
    'ref.facts.direct.returns': { file: MAIN, quote: ['def direct(self, fetchargs=None):', 'return {"ok": False, "err": utility.clean(self._rootctx, err)}', 'if isinstance(fetched, dict):'] },
    'ref.facts.prepare.returns': { file: 'tm/py/pkg/utility/make_fetch_def.py', quote: ['"url": url,', '"method": spec.method,'], unquoted: { dict: 'the fetch definition is a dict literal' } },
    'ref.facts.prepare.fails': { value: "style", file: MAIN, quote: 'raise ctx.make_error("spec_method_allow",' },
    'ref.facts.body.values': { value: "`bytes`, `bytearray`, `memoryview`, a `str` or a file object",
      file: 'tm/py/pkg/utility/fetcher.py',
      quote: ['if isinstance(body, str):\n        return body.encode("utf-8")', 'if isinstance(body, (bytearray, memoryview)):', 'if isinstance(body, bytes) or hasattr(body, "read"):'],
    },
    'ref.facts.body.once': { value: "a file object", file: 'tm/py/pkg/utility/media.py', quote: 'if body is not None and callable(getattr(body, "read", None)):\n        return body.read()' },
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort\w*|signal)\b|AbortController|WithContext|context\.Context|cancel_request|sendAsync/i, files: ['tm/py/pkg/utility/fetcher.py'] } },
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
