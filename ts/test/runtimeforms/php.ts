// How the php runtime writes things: public methods of the client and entity
// classes, a parameter as `?type $name = default`, a return after `):`.
import type { Forms } from './forms'

const MAIN = 'src/cmp/php/fragment/Main.fragment.php'
const ENTITY = 'src/cmp/php/fragment/Entity.fragment.php'
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
  // How a call is written: `->` on an object, `::` on the class; `new` runs __construct.
  calls: { on: { instance: ['->'], type: ['::'] } },
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
  // The porter's part.
  renames: { args: ['data', 'match'] },
  namesWhy: 'PHP passes these by position; the runtime names the setter argument $args, the page names what it holds',
  // direct's `ok` on a failure, cited ahead of the provider: a port declares ref.facts.direct.okFalse as this value.
  cite: {
    // The porter's citations.
    'facts.collection': { value: 'array', file: 'tm/php/utility/MakeResult.php', quote: ['$entities = [];', '$entities[] = $ent;', '$result->resdata = $entities;'] },
    'facts.recordType': { file: ENTITY, quote: '@return EntityName|array The current EntityName data as an assoc-array.' },
    'ref.facts.none': { value: 'null', file: 'src/cmp/php/fragment/EntityLoadOp.fragment.php', quote: 'public function load(?array $reqmatch = null, $ctrl = null): mixed' },
    'ref.facts.container': { file: MAIN, quote: 'public function __construct(array $options = [])' },
    // The file a caller requires: the name Main_php writes, required by its own directory as the SDK's files require theirs.
    'ref.facts.ctor[0]': { file: 'src/cmp/php/Main_php.ts', quote: 'File({ name: phpSdkFile(model) }, () => {',
      also: [{ file: MAIN, quote: "require_once __DIR__ . '/utility/struct/Struct.php';" }] },
    'ref.facts.client[0].copy': { value: true, file: MAIN, quote: '$out = Struct::clone($this->options);' },
    'ref.facts.client[1].kind': { value: 'utility', file: MAIN, quote: 'public function get_utility()\n    {\n        return ProjectNameUtility::copy($this->_utility);' },
    // Decision 13: the getter returns what the copy function builds, a new object.
    'ref.facts.client[1].copy': { value: true, file: MAIN, quote: 'return ProjectNameUtility::copy($this->_utility);', also: [{ file: 'tm/php/core/UtilityType.php', quote: ['public static function copy(ProjectNameUtility $src): ProjectNameUtility\n    {\n        $u = new ProjectNameUtility();'] }] },
    'ref.facts.client[1].returns': { file: 'tm/php/core/UtilityType.php', quote: 'public static function copy(ProjectNameUtility $src): ProjectNameUtility', also: [{ file: MAIN, quote: 'return ProjectNameUtility::copy($this->_utility);' }] },
    'ref.facts.entity[0].returns': { file: ENTITY, quote: '@return EntityName|array The current EntityName data as an assoc-array.' },
    'ref.facts.entity[0].copy': { value: true, file: ENTITY, quote: 'return Struct::clone($this->_data);' },
    'ref.facts.entity[2].returns': { file: ENTITY, quote: '@return array The current match filter (any subset of EntityName fields).' },
    'ref.facts.entity[2].copy': { value: true, file: ENTITY, quote: 'return Struct::clone($this->_match);' },
    'ref.facts.direct.returns': { file: MAIN, quote: ['private function op_denied(string $op): array', '$out = [\n                "ok" => null === $body_err && $status >= 200 && $status < 300,', 'return $out;'] },
    // What prepare returns is the fetch definition: built as an array literal, and taken as `array $fetchdef` by the transport it is made for.
    'ref.facts.prepare.returns': { file: 'tm/php/utility/MakeFetchDef.php', quote: "$fetchdef = ['url' => $url, 'method' => $spec->method, 'headers' => $spec->headers];",
      also: [{ file: MAIN, quote: ['[$fetchdef, $fd_err] = ($utility->make_fetch_def)($ctx);', 'return $fetchdef;'] },
        { file: 'tm/php/utility/Fetcher.php', quote: 'public static function call(ProjectNameContext $ctx, string $fullurl, array $fetchdef)' }] },
    'ref.facts.prepare.fails': { value: 'style', file: MAIN, quote: '// an {ok, err, ...} dict. prepare() now raises on error, so catch it', also: [{ file: 'tm/php/utility/MakeError.php', quote: 'throw $sdk_err;' }] },
    'ref.facts.body.values': { value: 'a string of bytes or text, or a stream', file: 'tm/php/utility/Media.php', quote: '// A string of bytes or text, or a stream, sent as it is. A stream can be' },
    'ref.facts.body.once': { value: 'a stream', file: 'tm/php/utility/Media.php', quote: ['// A string of bytes or text, or a stream, sent as it is. A stream can be', '// read once, so it is read here, before the first attempt, and a retry'] },
    // Searched over the whole php runtime: a region it leaves out is quoted, with the reason.
    'ref.facts.cancel': { value: false, absent: { pattern: /\b(cancel\w*|abort(?!\(\))\w*|signal|signalled\??)\b|AbortController|isCancelled|CancellationToken|WithContext|context\.Context/i, except: [
      { file: ENTITY, quote: ['*   - `ctrl` (pipeline control) and `signal` (cancellation) honoured.', "$signal = $callopts['signal'] ?? null;", '$aborted = function () use ($signal): bool {', 'if ($signal === null) {', 'if (is_callable($signal)) {\n                return (bool)$signal();', 'if (is_object($signal) && isset($signal->aborted)) {\n                return (bool)$signal->aborted;', "foreach ($streamfn() as $item) {\n                    if ($aborted()) {", 'foreach ($items as $item) {\n                if ($aborted()) {'],
        why: 'the stream reads callopts.signal between the items it hands over (ref.facts.streamSignal); no operation reads it', fact: 'ref.facts.streamSignal' },
      { file: 'tm/php/feature/CostFeature.php', quote: ['// supersedes it loses precision to catastrophic cancellation.', '// `piped` is set by PrePoint, so its absence is the signal.'],
        why: "the cost feature's comments: floating-point 'catastrophic cancellation', and 'the signal' as an English word" },
      { file: 'tm/php/feature/SecretsFeature.php', quote: "// MISS vs ERROR is the caller's to signal: anything but a string is",
        why: "the secrets feature's comment: 'to signal' as an English verb" },
      { file: 'tm/php/feature/TimeoutFeature.php', quote: ['// synchronous, so an in-flight request cannot be raced/aborted the way the\n// TS implementation cancels a fetch via AbortController. Instead the', '// attaching an abort signal).'],
        why: 'the timeout feature says, in its comments, that a php request cannot be aborted, and annotates the fetch definition with a timeout instead: the absence itself' },
    ] } },
    // Cited ahead of the provider (brief 7): a later declaration must equal the pinned value.
    // The read, then the early end on both paths (the streaming feature's generator, the materialised items).
    'ref.facts.streamSignal': { value: true, file: 'src/cmp/php/fragment/Entity.fragment.php', quote: ["$signal = $callopts['signal'] ?? null;",
      'foreach ($streamfn() as $item) {\n                    if ($aborted()) {\n                        return;',
      'foreach ($items as $item) {\n                if ($aborted()) {\n                    return;'] },
    'ref.facts.accessor.cached': { value: true, file: 'src/cmp/php/MainEntity_php.ts', quote: ['if ($data === null) {\n            if ($this->_${field} === null) {', 'return $this->_${field};'] },
    'ref.facts.direct.okFalse': { value: "false", file: "src/cmp/php/fragment/Main.fragment.php", quote: "return [\"ok\" => false, \"err\" => $err];" },
    // The test client's mock without the test feature, cited ahead: the factory's fallback, its default branch.
    'ref.facts.testMock': { value: "generated", file: "src/cmp/php/Main_php.ts", quote: "default:\n                return new ${model.const.Name}BaseFeature();" },
  },
}

export { forms }
