// How the php runtime writes things: public methods of the client and entity
// classes, a parameter as `?type $name = default`, a return after `):`.
import type { Forms } from './forms'

const OPS = ['Load', 'List', 'Create', 'Update', 'Patch', 'Remove'].map((o) => `src/cmp/php/fragment/Entity${o}Op.fragment.php`)

const forms: Forms = {
  files: {
    client: ['src/cmp/php/fragment/Main.fragment.php', 'src/cmp/php/MainEntity_php.ts'],
    entity: ['src/cmp/php/fragment/Entity.fragment.php'],
    ops: OPS,
  },
  decl: (name) => new RegExp(`^[ \\t]*public (?:static )?function ${name}(?=\\()`, 'm'),
  param: (p) => {
    const m = /^(?:(\??[\w\\]+)\s+)?&?\$(\w+)/.exec(p.trim())
    return null == m ? { name: '', type: '' } : { name: m[2], type: m[1] || '' }
  },
  optional: (p) => /=/.test(p),
  returns: (after) => (/^\s*:\s*([\w\\?|]+)/.exec(after) || [])[1] || '',
  entityCtor: '__construct',
  public: {
    client: /^    public (?:static )?function ((?!__)[a-z]\w*)\(/gm,
    entity: /^    public (?:static )?function ((?!__)[a-z]\w*)\(/gm,
  },
  undocumented: {
    jsonSerialize: 'the JSON form (JsonSerializable)',
    get_root_ctx: 'the pipeline\'s root context, for features',
    graphql: 'a GraphQL request through the pipeline; no reference page documents it',
    markDeleted: 'set by remove itself; the entity reports it through deleted',
    deleted: 'whether remove succeeded on this instance',
  },
  members: {
    options: 'options_map', utility: 'get_utility', direct: 'direct', prepare: 'prepare',
    dataGet: 'data_get', dataSet: 'data_set', matchGet: 'match_get', matchSet: 'match_set',
    make: 'make', name: 'get_name', stream: 'stream',
  },
  streamKind: (d) => /Generator/.test(d.returns) ? 'streamGenerator' : 'stream',
  style: { exception: 'throw', raises: /\bthrow\b/ },
  record: (rec) => ({ name: (/(\w+)\(\)$/.exec(rec) || [])[1] || rec }),
  tokens: { Class: 'EntyClass', client: 'ProjectNameSDK', sdk: 'ProjectName', ctor: '__construct', accessor: '${accessor}' },
  types: { column: 'php' },
  // The porter's: sigName, sigParams, sigReturns, renames, typeNames, uncompared, cite and exceptions.
  // What the table states besides names, parameters and returns.
  testDecl: 'test',
  expect: { test: { on: 'type' } },
  stream: {
    file: "src/cmp/php/fragment/Entity.fragment.php",
    construct: "public function stream(string $action", starts: "on iteration",
    run: "$failed = $this->_stream_steps($ctx);",
    draw: "foreach ($streamfn() as $item) {",
    runs: "as the caller iterates", items: "as the caller iterates",
  },
  // direct's `ok` on a failure, cited ahead of the provider: a port declares ref.facts.direct.okFalse as this value.
  cite: {
    // Cited ahead of the provider (brief 7): a later declaration must equal the pinned value.
    'ref.facts.streamSignal': { value: true, file: 'src/cmp/php/fragment/Entity.fragment.php', quote: ["$signal = $callopts['signal'] ?? null;", '$aborted = function () use ($signal): bool {'] },
    'ref.facts.accessor.cached': { value: true, file: 'src/cmp/php/MainEntity_php.ts', quote: ['if ($data === null) {\n            if ($this->_${field} === null) {', 'return $this->_${field};'] },
    'ref.facts.direct.okFalse': { value: "false", file: "src/cmp/php/fragment/Main.fragment.php", quote: "return [\"ok\" => false, \"err\" => $err];" },
  },
}

export { forms }
