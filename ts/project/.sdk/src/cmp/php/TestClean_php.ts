import {
  cmp,
  File,
  Content,
  isAuthSuppressed,
  isHttpBasicAuth,
  resolveAuthIn,
  resolveAuthName,
} from '@voxgig/sdkgen'


// The canary sweep, as TestClean_ts emits it: every credential slot holds a
// distinctive value, every diagnostic feature this SDK ships is switched on
// with a capturing sink, a real operation runs through every outcome, and
// every string that leaves is searched for the canaries and their forms; a
// second sweep does the same for a body of bytes. Clean off MUST show both.
const TestClean = cmp(function TestClean(props: any) {
  const { model } = props.ctx$
  const { target } = props

  const auth = {
    suppressed: isAuthSuppressed(model),
    where: resolveAuthIn(model),
    name: 'header' === resolveAuthIn(model)
      ? resolveAuthName(model).toLowerCase() : resolveAuthName(model),
    basic: isHttpBasicAuth(model),
  }

  File({ name: 'CleanTest.' + target.ext }, () => Content(render(model.const.Name, auth)))
})


function phpstr(s: string): string {
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
}


function render(Name: string, auth: {
  suppressed: boolean, where: string, name: string, basic: boolean
}): string {
  const lower = Name.toLowerCase()

  return `<?php
declare(strict_types=1);

// ${Name} SDK clean test
//
// The canary sweep: every credential slot holds a distinctive value, every
// diagnostic feature this SDK ships is switched on with a capturing sink, a
// real operation runs through every outcome, and every string that leaves
// is searched for the canaries and their encoded forms; a second sweep does
// the same for a body of bytes. With clean off the canary MUST show.

require_once __DIR__ . '/../${lower}_sdk.php';

use PHPUnit\\Framework\\TestCase;

class CleanTest extends TestCase
{
    // Generated: the credential's wire placement is fixed when the SDK is
    // built.
    private const AUTH = [
        'suppressed' => ${auth.suppressed ? 'true' : 'false'},
        'where' => ${phpstr(auth.where)},
        'name' => ${phpstr(auth.name)},
        'basic' => ${auth.basic ? 'true' : 'false'},
    ];

    private const CANARY = [
        'apikey' => 'CANARY-APIKEY-k9x2m7q4p1',
        'secret' => 'CANARY-SECRET-w3e8r5t2y6',
        'header' => 'CANARY-HEADER-z1x4c7v0b3',
        'value' => 'CANARY-VALUE-n5m8b2v9c4',
        'config' => 'CANARY-CONFIG-h6j3k8l2m5',
    ];

    private const MASK = '[redacted]';

    // The marker a body of bytes carries.
    private const CONTENT = 'CANARY-CONTENT-b7n3v9x1c5';

    // Every form a canary can travel in.
    private static function forms(): array
    {
        $out = [];
        foreach (self::CANARY as $v) {
            $out[] = $v;
            $out[] = base64_encode($v);
            $out[] = rawurlencode($v);
        }
        $out[] = base64_encode(self::CANARY['apikey'] . ':' . self::CANARY['secret']);
        return $out;
    }

    // Header maps keep the caller's spelling; the assertion should not care.
    private static function header(mixed $map, string $name): mixed
    {
        if (is_object($map)) {
            $map = get_object_vars($map);
        }
        if (!is_array($map)) {
            return null;
        }
        foreach ($map as $k => $v) {
            if (strtolower((string)$k) === strtolower($name)) {
                return $v;
            }
        }
        return null;
    }

    private static function leaks(string $text): array
    {
        $found = [];
        foreach (self::forms() as $f) {
            if (str_contains($text, $f)) {
                $found[] = $f;
            }
        }
        return $found;
    }

    // The forms bytes travel in once copied: a string prints as its text,
    // and a dump of one shows its byte values (which print_r and var_export
    // key by index), hex or base64.
    private static function content_leaks(string $text): array
    {
        $flat = preg_replace('/\\s+/', '', $text) ?? $text;
        $values = preg_replace(['/\\[\\d+\\]=>/', '/\\b\\d+=>/'], [',', ''], $flat) ?? $flat;
        $found = [];
        if (str_contains($text, self::CONTENT)) {
            $found[] = 'text';
        }
        if (str_contains($values, implode(',', unpack('C*', self::CONTENT)))) {
            $found[] = 'byte values';
        }
        if (str_contains(strtolower($flat), bin2hex(self::CONTENT))) {
            $found[] = 'hex';
        }
        if (str_contains($flat, base64_encode(self::CONTENT))) {
            $found[] = 'base64';
        }
        return $found;
    }

    // Every way a caller renders a value: json and print_r for all of them,
    // var_export where it walks the whole graph (a record, an error), and
    // the error's own message and string form.
    public static function surfaces(string $name, mixed $val): array
    {
        // Xdebug's develop mode writes every frame's arguments onto the
        // exception at the throw; that is a debugger's view, like err.ctx.
        for ($e = $val instanceof \\Throwable ? $val : null; null !== $e; $e = $e->getPrevious()) {
            if (property_exists($e, 'xdebug_message')) {
                unset($e->xdebug_message);
            }
        }

        $out = [];
        $push = function (string $kind, callable $fn) use (&$out, $name): void {
            try {
                $text = $fn();
                if (is_string($text)) {
                    $out[] = ['name' => $name . ':' . $kind, 'text' => $text];
                }
            } catch (\\Throwable $_e) {
                // A renderer that refuses the value is not a surface.
            }
        };
        $push('json', fn () => json_encode($val, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $push('print_r', fn () => print_r($val, true));
        if (is_array($val) || $val instanceof \\Throwable) {
            $push('var_export', fn () => var_export($val, true));
        }
        if ($val instanceof \\Throwable) {
            $push('message', fn () => $val->getMessage());
            $push('string', fn () => (string)$val);
        }
        return $out;
    }

    private static function response(int $status, mixed $data, array $headers = []): array
    {
        $h = ['content-type' => 'application/json'];
        foreach ($headers as $k => $v) {
            $h[strtolower((string)$k)] = $v;
        }
        return [
            'status' => $status,
            'statusText' => $status < 400 ? 'OK' : 'ERR',
            'headers' => $h,
            'json' => function () use ($data) { return $data; },
            'body' => json_encode($data),
        ];
    }

    // Each scenario is a transport answering the [response, err] pair the
    // fetcher contract names.
    private static function scenarios(): array
    {
        return [
            'ok' => function (string $_url, array $_fetchdef): array {
                return [self::response(200, ['id' => 'i1', 'name' => 'n1'],
                    ['x-session-token' => 'RESP-TOKEN-a1b2c3d4e5']), null];
            },
            'notfound' => function (string $_url, array $_fetchdef): array {
                return [self::response(404, ['error' => 'no such record']), null];
            },
            'server' => function (string $_url, array $_fetchdef): array {
                return [self::response(500, ['error' => 'boom']), null];
            },
            // A transport failure quotes the URL, query credential included.
            'transport' => function (string $url, array $_fetchdef): array {
                return [null, new \\RuntimeException('socket hang up (URL was: "' . $url . '")')];
            },
            // The SDK's own error, its code quoting a registered value.
            'coded' => function (string $_url, array $_fetchdef): array {
                return [null, new ${Name}Error('denied_' . self::CANARY['apikey'], 'coded failure')];
            },
            // A body that is not JSON: the fetcher answers no parsed body.
            'notjson' => function (string $_url, array $_fetchdef): array {
                return [[
                    'status' => 200,
                    'statusText' => 'OK',
                    'headers' => [],
                    'json' => function () { return null; },
                    'body' => '<html>',
                ], null];
            },
        ];
    }

    // True when this SDK was generated with the named feature.
    private static function has_feature(string $name): bool
    {
        $config = ${Name}Config::shared_config();
        $f = $config['feature'] ?? [];
        return is_array($f) && isset($f[$name]);
    }

    // Captures the serialised context from inside the pipeline: what a hook
    // author would hand to a logger. It also keeps the operation context,
    // the one place the explain record can be read back from.
    // What the watchers capture, kept out of the SDK's object graph: with
    // clean off, var_export of an error walks into the watcher, and text it
    // held would be rendered again on every later capture.
    public static array $captures = [];

    private static function capture_feature(\\ArrayObject $sinks): ${Name}BaseFeature
    {
        $key = count(self::$captures);
        self::$captures[$key] = $sinks;
        return new class ($key) extends ${Name}BaseFeature {
            public mixed $last = null;

            public function __construct(private int $sinkkey)
            {
                parent::__construct();
                $this->name = 'capture';
                $this->version = '0.0.1';
                $this->active = true;
            }

            private function take(string $name, mixed $val): void
            {
                $sinks = CleanTest::$captures[$this->sinkkey];
                foreach (CleanTest::surfaces($name, $val) as $s) {
                    $sinks[] = $s;
                }
            }

            public function PrePoint(${Name}Context $ctx): void
            {
                $this->last = $ctx;
            }

            public function PreRequest(${Name}Context $ctx): void
            {
                $this->take('ctx@PreRequest', $ctx);
            }

            public function PreResponse(${Name}Context $ctx): void
            {
                $this->take('ctx@PreResponse', $ctx);
            }

            // The SDK's own error as a hook reads it, which an observability
            // feature logs.
            public function PreUnexpected(${Name}Context $ctx): void
            {
                $this->take('ctx@PreUnexpected', $ctx);
                if ($ctx->ctrl->err instanceof ${Name}Error) {
                    $this->take('ctrl.err@PreUnexpected', $ctx->ctrl->err);
                }
            }
        };
    }

    // Captures the request data as a hook would log it, before the spec
    // exists and after: the other place a raw body sits, and the only one a
    // stream does.
    private static function reqdata_feature(\\ArrayObject $sinks): ${Name}BaseFeature
    {
        $key = count(self::$captures);
        self::$captures[$key] = $sinks;
        return new class ($key) extends ${Name}BaseFeature {
            public function __construct(private int $sinkkey)
            {
                parent::__construct();
                $this->name = 'reqdata';
                $this->version = '0.0.1';
                $this->active = true;
            }

            private function take(string $name, ${Name}Context $ctx): void
            {
                $sinks = CleanTest::$captures[$this->sinkkey];
                foreach (CleanTest::surfaces($name, ($ctx->utility->clean)($ctx, $ctx->reqdata)) as $s) {
                    $sinks[] = $s;
                }
            }

            public function PreSpec(${Name}Context $ctx): void
            {
                $this->take('reqdata@PreSpec', $ctx);
            }

            public function PreRequest(${Name}Context $ctx): void
            {
                $this->take('reqdata@PreRequest', $ctx);
            }
        };
    }

    // A feature that throws from inside the pipeline, quoting the request
    // it saw: an error make_error never handled.
    // Its PreUnexpected variant throws where that hook fires: make_error.
    private static function throw_feature(bool $response = true, bool $unexpected = false): ${Name}BaseFeature
    {
        return new class ($response, $unexpected) extends ${Name}BaseFeature {
            public function __construct(private bool $response, private bool $unexpected)
            {
                parent::__construct();
                $this->name = 'throwhook';
                $this->version = '0.0.1';
                $this->active = true;
            }

            public function PreResponse(${Name}Context $ctx): void
            {
                if ($this->response) {
                    throw new \\RuntimeException('hook saw ' . json_encode($ctx->spec));
                }
            }

            public function PreUnexpected(${Name}Context $ctx): void
            {
                if ($this->unexpected) {
                    throw new \\RuntimeException('hook saw ' . json_encode($ctx->spec));
                }
            }
        };
    }

    // A feature that throws a foreign exception whose string code, as some
    // drivers set one, quotes a registered value.
    private static function coded_throw_feature(string $failcode): ${Name}BaseFeature
    {
        return new class ($failcode) extends ${Name}BaseFeature {
            public function __construct(private string $failcode)
            {
                parent::__construct();
                $this->name = 'codedhook';
                $this->version = '0.0.1';
                $this->active = true;
            }

            public function PreResponse(${Name}Context $ctx): void
            {
                throw new class ('coded hook failure', $this->failcode) extends \\RuntimeException {
                    public function __construct(string $msg, string $code)
                    {
                        parent::__construct($msg);
                        $this->code = $code;
                    }
                };
            }
        };
    }

    // A feature whose stream fails while the caller iterates it, quoting a
    // credential.
    private static function stream_throw_feature(string $key): ${Name}BaseFeature
    {
        return new class ($key) extends ${Name}BaseFeature {
            public function __construct(private string $key)
            {
                parent::__construct();
                $this->name = 'streamthrow';
                $this->version = '0.0.1';
                $this->active = true;
            }

            public function PreDone(${Name}Context $ctx): void
            {
                $key = $this->key;
                $ctx->result->stream = function () use ($key): \\Generator {
                    throw new \\RuntimeException('stream saw ' . $key);
                    yield null;
                };
            }
        };
    }

    // A stream that succeeds, so the pipeline's terminal step never runs.
    private static function stream_ok_feature(): ${Name}BaseFeature
    {
        return new class () extends ${Name}BaseFeature {
            public function __construct()
            {
                parent::__construct();
                $this->name = 'streamok';
                $this->version = '0.0.1';
                $this->active = true;
            }

            public function PreDone(${Name}Context $ctx): void
            {
                $data = $ctx->result->resdata;
                $items = is_array($data) && array_is_list($data) ? $data : (null === $data ? [] : [$data]);
                $ctx->result->stream = function () use ($items): \\Generator {
                    yield from $items;
                };
            }
        };
    }

    // Offline, as every generated suite is: the test OPTION resolves a
    // required server variable to test-<name>, and installs no transport.
    private static function offline(array $opts): array
    {
        return array_merge($opts, ['test' => ['active' => true]]);
    }

    // A client the sweep cannot build leaves nothing swept: a harness error,
    // not a leak.
    private static function construct(array $opts): ${Name}SDK
    {
        try {
            return new ${Name}SDK(self::offline($opts));
        } catch (\\Throwable $e) {
            throw new \\RuntimeException('clean harness: the client could not be constructed, ' .
                'so nothing was swept: ' . $e->getMessage(), 0, $e);
        }
    }

    private static function make_sdk(
        callable $respond, \\ArrayObject $sinks, ?array $cleanopts = null, array $extra = [],
        ?array $auth = null
    ): array
    {
        $capture = function (string $name) use ($sinks): callable {
            return function (mixed $rec) use ($name, $sinks): void {
                foreach (self::surfaces($name, $rec) as $s) {
                    $sinks[] = $s;
                }
            };
        };

        $feature = [];
        if (self::has_feature('log')) {
            $feature['log'] = ['active' => true, 'logger' => $capture('log')];
        }
        if (self::has_feature('debug')) {
            $feature['debug'] = ['active' => true, 'onEntry' => $capture('debug')];
        }
        if (self::has_feature('audit')) {
            $feature['audit'] = ['active' => true, 'sink' => $capture('audit')];
        }
        if (self::has_feature('telemetry')) {
            $feature['telemetry'] = ['active' => true, 'exporter' => $capture('telemetry')];
        }
        if (self::has_feature('cost')) {
            $feature['cost'] = ['active' => true, 'sink' => $capture('cost')];
        }
        if (self::has_feature('metrics')) {
            $feature['metrics'] = ['active' => true];
        }
        if (self::has_feature('clienttrack')) {
            $feature['clienttrack'] = ['active' => true];
        }

        $watcher = self::capture_feature($sinks);

        $opts = [
            'apikey' => self::CANARY['apikey'],
            'secret' => self::CANARY['secret'],
            'headers' => ['X-Custom-Token' => self::CANARY['header']],
            'clean' => array_merge(['values' => self::CANARY['value']], $cleanopts ?? []),
            'extend' => array_merge([$watcher], $extra),
            'utility' => [
                'fetcher' => function (${Name}Context $_ctx, string $url, array $fetchdef) use ($respond): array {
                    return $respond($url, $fetchdef);
                },
            ],
        ];
        if (0 < count($feature)) {
            $opts['feature'] = $feature;
        }
        if (null !== $auth) {
            $opts['auth'] = $auth;
        }

        return [self::construct($opts), $watcher];
    }

    // An entity accessor is a capitalised client method whose result answers
    // get_name(), as the feature corpus runner finds them.
    private static function accessors(object $plain): array
    {
        $found = [];
        foreach (get_class_methods($plain) as $m) {
            if (!preg_match('/^[A-Z]/', $m)) {
                continue;
            }
            try {
                $ent = $plain->$m();
            } catch (\\Throwable $_e) {
                continue;
            }
            if (!is_object($ent) || !method_exists($ent, 'get_name')) {
                continue;
            }
            $found[$ent->get_name()] = $m;
        }
        ksort($found);
        return $found;
    }

    // The first operation that completes against a plain 200: with no
    // arguments, else with every path parameter its points declare filled
    // in.
    private static function usable_op(): ?array
    {
        $plain = self::construct([
            'apikey' => self::CANARY['apikey'],
            'utility' => [
                'fetcher' => function (${Name}Context $_ctx, string $_url, array $_fetchdef): array {
                    return [self::response(200, ['id' => 'i1']), null];
                },
            ],
        ]);

        $found = self::accessors($plain);

        $rank = ['list' => 0, 'load' => 1];
        $entities = ${Name}Config::shared_config()['entity'] ?? [];
        foreach ($found as $entname => $accessor) {
            $ent = $plain->$accessor();
            $ops = array_values(array_filter(['list', 'load', 'create', 'update', 'patch', 'remove'],
                function (string $op) use ($ent): bool {
                    return method_exists($ent, $op);
                }));
            usort($ops, function (string $a, string $b) use ($rank): int {
                return ($rank[$a] ?? 2) <=> ($rank[$b] ?? 2);
            });
            foreach ($ops as $op) {
                $filled = [];
                foreach ((array)($entities[$entname]['op'][$op]['points'] ?? []) as $point) {
                    foreach ((array)($point['args']['params'] ?? []) as $p) {
                        if (is_string($p['name'] ?? null)) {
                            $filled[$p['name']] = 'p1';
                        }
                    }
                }
                foreach ([[], $filled] as $match) {
                    try {
                        $plain->$accessor()->$op($match, []);
                        return ['accessor' => $accessor, 'op' => $op, 'match' => $match];
                    } catch (\\Throwable $_e) {
                        continue;
                    }
                }
            }
        }
        return null;
    }

    // The first operation with a point that sends a raw body the model marks
    // binary, with every path parameter of that point filled in.
    private static function binary_op(): ?array
    {
        $plain = self::construct(['apikey' => self::CANARY['apikey']]);
        $entities = ${Name}Config::shared_config()['entity'] ?? [];
        foreach (self::accessors($plain) as $entname => $accessor) {
            $ops = (array)($entities[$entname]['op'] ?? []);
            ksort($ops);
            foreach ($ops as $op => $opdef) {
                if (!method_exists($plain->$accessor(), (string)$op)) {
                    continue;
                }
                foreach ((array)($opdef['points'] ?? []) as $point) {
                    $body = $point['body'] ?? null;
                    if (!is_array($body) || 'raw' !== ($body['kind'] ?? null)
                        || true !== ($body['binary'] ?? null)) {
                        continue;
                    }
                    $match = [];
                    foreach ((array)($point['args']['params'] ?? []) as $p) {
                        if (is_string($p['name'] ?? null)) {
                            $match[$p['name']] = 'p1';
                        }
                    }
                    if (null !== ($point['select']['$action'] ?? null)) {
                        $match['$action'] = $point['select']['$action'];
                    }
                    return ['accessor' => $accessor, 'op' => (string)$op, 'match' => $match,
                        'media' => $body['media'] ?? null];
                }
            }
        }
        return null;
    }

    // Every value this SDK accepts as a raw body. A stream is read once, so
    // each run is handed its own.
    private static function carriers(string $path): array
    {
        return [
            'string' => fn () => self::CONTENT,
            'stream' => function () {
                $stream = fopen('php://memory', 'r+b');
                fwrite($stream, self::CONTENT);
                rewind($stream);
                return $stream;
            },
            'file' => fn () => fopen($path, 'rb'),
        ];
    }

    private static function drive(
        object $sdk, object $watcher, array $target, array $ctrl, \\ArrayObject $sinks, array $data = []
    ): array
    {
        // What the caller passed and keeps; an array, so the call cannot
        // change it, but it is searched like the record the watcher reads.
        $held = $ctrl['explain'] ?? null;
        $accessor = $target['accessor'];
        $op = $target['op'];
        $entity = $sdk->$accessor();
        $out = null;
        $err = null;
        try {
            $out = $entity->$op(array_merge($target['match'], $data), $ctrl);
        } catch (\\Throwable $e) {
            $err = $e;
        }

        if (null !== $err) {
            foreach (self::surfaces('error', $err) as $s) {
                $sinks[] = $s;
            }
        }
        if (null !== $out) {
            foreach (self::surfaces('result', $out) as $s) {
                $sinks[] = $s;
            }
        }
        // Raw, as a caller copying the match into another query reads it.
        foreach (self::surfaces('match', $entity->match_get()) as $s) {
            $sinks[] = $s;
        }

        $explain = null;
        $last = $watcher->last;
        if (null !== $last && is_array($last->ctrl->explain)) {
            $explain = $last->ctrl->explain;
            foreach (self::surfaces('explain', $explain) as $s) {
                $sinks[] = $s;
            }
        }
        if (null !== $held && $held !== $explain) {
            foreach (self::surfaces('explain:held', $held) as $s) {
                $sinks[] = $s;
            }
        }

        return [$err, $explain];
    }

    public function test_no_credential_leaves_the_sdk_in_any_form(): void
    {
        $this->with_trace_args(fn () => $this->sweep());
    }

    private function with_trace_args(callable $run): void
    {
        // PHP records a frame's arguments unless the ini says otherwise, and
        // they hold every context the failing frames were handed: clean strips
        // them, which the sweep sees only with them recorded. A production ini
        // switches them off, so the sweep switches them on.
        $args = ini_set('zend.exception_ignore_args', '0');
        // Frameworks turn every notice into an exception (PHPUnit 8 did too);
        // one thrown mid-pipeline must still leave clean.
        set_error_handler(static function (int $no, string $str, string $file, int $line): bool {
            throw new \\ErrorException($str, 0, $no, $file, $line);
        });
        try {
            $run();
        } finally {
            restore_error_handler();
            if (false !== $args) {
                ini_set('zend.exception_ignore_args', $args);
            }
        }
    }

    private const VARIANTS = [
        'throw' => [],
        'explain' => ['explain' => ['on' => true]],
        'nothrow' => ['throw' => false, 'explain' => ['on' => true]],
    ];

    private function sweep(): void
    {
        $target = self::usable_op();
        if (null === $target) {
            $this->markTestSkipped('no operation of this SDK completes against a plain 200; nothing to sweep');
        }

        $sinks = new \\ArrayObject();
        $errors = [];
        $explains = [];

        foreach (self::scenarios() as $sname => $respond) {
            foreach (self::VARIANTS as $vname => $ctrl) {
                [$sdk, $watcher] = self::make_sdk($respond, $sinks);
                [$err, $explain] = self::drive($sdk, $watcher, $target, $ctrl, $sinks);
                $key = $sname . '/' . $vname;
                if (null !== $err) {
                    $errors[$key] = $err;
                }
                if (null !== $explain) {
                    $explains[$key] = $explain;
                }
                foreach (self::surfaces('sdk', $sdk) as $s) {
                    $sinks[] = $s;
                }
            }
        }

        // A name given at run time replaces the declared one: the match leaves
        // out whichever name prepare_auth placed.
        [$sdk, $watcher] = self::make_sdk(self::scenarios()['ok'], $sinks, null, [], ['name' => 'zzcred']);
        self::drive($sdk, $watcher, $target, [], $sinks);

        // A credential mistyped as a map is rejected by validation, whose
        // message quotes the value it rejected.
        $rejected = null;
        try {
            new ${Name}SDK(self::offline([
                'apikey' => ['value' => self::CANARY['apikey']],
                'clean' => ['values' => self::CANARY['value']],
            ]));
        } catch (\\Throwable $e) {
            $rejected = $e;
        }
        $this->assertNotNull($rejected, 'a credential mistyped as a map should be rejected');
        foreach (self::surfaces('rejected', $rejected) as $s) {
            $sinks[] = $s;
        }

        // An error a feature hook throws, quoting the request, skips make_error.
        // PreUnexpected fires only in make_error, which the variant throwing
        // there alone reaches through a 404.
        foreach ([['ok', self::throw_feature()], ['ok', self::throw_feature(true, true)],
            ['notfound', self::throw_feature(false, true)]] as [$sname, $hook]) {
            [$hooked, $hwatcher] = self::make_sdk(self::scenarios()[$sname], $sinks, null, [$hook]);
            [$hookerr, $_hexplain] = self::drive($hooked, $hwatcher, $target, ['explain' => ['on' => true]], $sinks);
            $this->assertNotNull($hookerr, 'the throwing hook should fail the operation');
        }

        // Iterating a stream runs inside the same catch path as the operation,
        // and the explain record is cleaned however it ends. The caller's copy
        // is its own, so the record is read back as the watcher saw it.
        foreach ([['stream', [self::stream_throw_feature(self::CANARY['apikey'])]],
            ['stream-ok', [self::stream_ok_feature()]], ['stream-plain', []]] as [$name, $extra]) {
            [$streamed, $swatcher] = self::make_sdk(self::scenarios()['ok'], $sinks, null, $extra);
            $streamerr = null;
            try {
                $accessor = $target['accessor'];
                foreach ($streamed->$accessor()->stream($target['op'], ['reqmatch' => $target['match']],
                    ['ctrl' => ['explain' => ['on' => true]]]) as $_item) {
                }
            } catch (\\Throwable $e) {
                $streamerr = $e;
            }
            $this->assertSame('stream' === $name, null !== $streamerr, $name . ': only the failing stream throws');
            if (null !== $streamerr) {
                foreach (self::surfaces($name, $streamerr) as $s) {
                    $sinks[] = $s;
                }
            }
            $explain = $swatcher->last->ctrl->explain ?? [];
            $this->assertGreaterThan(1, count((array)$explain), $name . ': the explain record was not filled');
            foreach (self::surfaces($name . ':explain', $explain) as $s) {
                $sinks[] = $s;
            }
        }

        // A registered value used as a property name is masked; names that
        // mask alike are all kept.
        $named = ($hooked->get_utility()->clean)($hooked->get_root_ctx(),
            [self::CANARY['header'] => 1, self::CANARY['value'] => 2, 'plain' => 3]);
        $this->assertSame([self::MASK => 1, self::MASK . '#1' => 2, 'plain' => 3], $named);
        foreach (self::surfaces('named', $named) as $s) {
            $sinks[] = $s;
        }

        // A foreign exception a hook throws, its string code quoting the key.
        [$codedhook, $cwatcher] = self::make_sdk(self::scenarios()['ok'], $sinks, null,
            [self::coded_throw_feature('denied_' . self::CANARY['apikey'])]);
        [$codederr, $_cexplain] = self::drive($codedhook, $cwatcher, $target, [], $sinks);
        $this->assertNotNull($codederr, 'the coded hook should fail the operation');

        // The generated config's own clean block is read beside the caller's,
        // and is not changed by it.
        $config = ['options' => ['clean' => ['keys' => 'zzsens', 'values' => self::CANARY['config']]]];
        $util = $hooked->get_utility();
        $built = ($util->make_options)(new ${Name}Context([
            'utility' => $util,
            'config' => $config,
            'options' => ['clean' => ['values' => self::CANARY['value']]],
        ], null));
        $cfgctx = new ${Name}Context(['options' => $built], null);
        $seeded = ($util->clean)($cfgctx, 'config ' . self::CANARY['config'] . ' caller ' . self::CANARY['value']);
        $sinks[] = ['name' => 'config-clean', 'text' => (string)$seeded];
        $this->assertSame('config ' . self::MASK . ' caller ' . self::MASK, $seeded);
        $this->assertSame(['my_zzsens' => self::MASK, 'other' => 'y'],
            ($util->clean)($cfgctx, ['my_zzsens' => 'x', 'other' => 'y']));
        $this->assertSame(['keys' => 'zzsens', 'values' => self::CANARY['config']],
            $config['options']['clean']);

        // With no clean option at all, the schema defaults still apply.
        $respond404 = self::scenarios()['notfound'];
        $bwatcher = self::capture_feature($sinks);
        $bare = self::construct([
            'apikey' => self::CANARY['apikey'],
            'secret' => self::CANARY['secret'],
            'headers' => ['X-Custom-Token' => self::CANARY['header']],
            'extend' => [$bwatcher],
            'utility' => [
                'fetcher' => function (${Name}Context $_ctx, string $url, array $fetchdef) use ($respond404): array {
                    return $respond404($url, $fetchdef);
                },
            ],
        ]);
        [$bareerr, $_bexplain] = self::drive($bare, $bwatcher, $target, ['explain' => ['on' => true]], $sinks);
        $this->assertNotNull($bareerr, 'the 404 should fail');

        // A feature's name is not a field name: only the sensitive names
        // inside its settings register. An entity block, of per-entity
        // settings or seeded records keyed by entity name and id, is not read,
        // and nor are rbac's rules, keyed by entity and operation names.
        $featured = self::construct([
            'apikey' => self::CANARY['apikey'],
            'feature' => [
                'zzsecrets' => ['active' => false, 'kind' => 'PLAINSETTING-q8w2e4r6'],
                'zzfeat' => ['active' => false, 'apitoken' => 'FEATTOKEN-z9y8x7w6'],
                'rbac' => ['active' => false, 'rules' => ['zztoken.load' => 'PLAINRULE-k7j5h3g1']],
                'test' => ['active' => false, 'entity' => [
                    'zztoken' => ['ZZTOKEN01' => ['note' => 'PLAINRECORD-t5r3e1w9']]]],
            ],
            'entity' => ['zztoken' => ['alias' => ['zzkey' => 'PLAINALIAS-m2n4b6v8']]],
        ]);
        $fclean = $featured->get_utility()->clean;
        $fplain = $fclean($featured->get_root_ctx(), 'kind PLAINSETTING-q8w2e4r6');
        $ftoken = $fclean($featured->get_root_ctx(), 'token FEATTOKEN-z9y8x7w6');
        $frecord = $fclean($featured->get_root_ctx(), 'record PLAINRECORD-t5r3e1w9');
        $falias = $fclean($featured->get_root_ctx(), 'alias PLAINALIAS-m2n4b6v8');
        $frule = $fclean($featured->get_root_ctx(), 'rule PLAINRULE-k7j5h3g1');

        $leaked = [];
        $excerpt = '';
        foreach ($sinks as $s) {
            $found = self::leaks($s['text']);
            if (0 < count($found)) {
                $leaked[] = $s['name'] . ' [' . implode(', ', $found) . ']';
                if ('' === $excerpt) {
                    // Where the first leak sits, so a failure names its path.
                    $at = strpos($s['text'], $found[0]);
                    $excerpt = "\\n" . $s['name'] . ' near the leak: ' .
                        substr($s['text'], max(0, $at - 600), 700);
                }
            }
        }

        // The one line the generator's compile lane reads.
        fwrite(STDERR, sprintf("clean: swept %d surface(s), %d leak(s)\\n",
            count($sinks), count($leaked)));

        $this->assertSame([], $leaked, 'credential leaked through: ' . implode('; ', $leaked) . $excerpt);

        // The positive half: the slot the credential travelled in is masked,
        // and an unregistered token in a response header is masked by name.
        $notfound = $errors['notfound/throw'] ?? null;
        $this->assertInstanceOf(${Name}Error::class, $notfound, 'the 404 scenario must throw');
        $this->assertSame(404, $notfound->status);
        $spec = $notfound->spec;
        if (!self::AUTH['suppressed']) {
            if ('query' === self::AUTH['where']) {
                $this->assertSame(self::MASK,
                    self::header(self::header($spec, 'query'), self::AUTH['name']));
            } elseif ('cookie' === self::AUTH['where']) {
                $this->assertStringContainsString(self::MASK,
                    (string)self::header(self::header($spec, 'headers'), 'cookie'));
            } else {
                $this->assertStringEndsWith(self::MASK,
                    (string)self::header(self::header($spec, 'headers'), self::AUTH['name']));
            }
        }
        $this->assertSame(self::MASK, self::header(self::header($spec, 'headers'), 'x-custom-token'));

        $coded = $errors['coded/throw'] ?? null;
        $this->assertInstanceOf(${Name}Error::class, $coded, 'the coded scenario must throw');
        $this->assertSame('denied_' . self::MASK, $coded->sdk_code);
        $this->assertSame('denied_' . self::MASK, $codederr->getCode());

        $this->assertSame('kind PLAINSETTING-q8w2e4r6', $fplain);
        $this->assertSame('token ' . self::MASK, $ftoken);
        $this->assertSame('record PLAINRECORD-t5r3e1w9', $frecord);
        $this->assertSame('alias PLAINALIAS-m2n4b6v8', $falias);
        $this->assertSame('rule PLAINRULE-k7j5h3g1', $frule);

        $explained = $explains['ok/explain'] ?? [];
        $this->assertNotNull($explained['result'] ?? null, 'the explain record should carry the result');
        $this->assertSame(self::MASK,
            self::header(self::header($explained['result'], 'headers'), 'x-session-token'));
    }

    public function test_the_sweep_can_see_a_leak_clean_switched_off_shows_the_credential(): void
    {
        $this->without_trace_args(fn () => $this->leak_control());
    }

    private function without_trace_args(callable $run): void
    {
        // With clean off nothing strips the trace arguments, and var_export
        // renders the whole context through them: 43 MB of text on a
        // 31-operation API (#292). The control proves the sweep sees a raw
        // value, which the arguments are not needed for.
        $args = ini_set('zend.exception_ignore_args', '1');
        try {
            $run();
        } finally {
            if (false !== $args) {
                ini_set('zend.exception_ignore_args', $args);
            }
        }
    }

    private function leak_control(): void
    {
        $target = self::usable_op();
        if (null === $target) {
            $this->markTestSkipped('no operation of this SDK completes against a plain 200; nothing to sweep');
        }

        $sinks = new \\ArrayObject();
        [$sdk, $watcher] = self::make_sdk(self::scenarios()['notfound'], $sinks, ['active' => false]);
        [$err, $_explain] = self::drive($sdk, $watcher, $target, [], $sinks);
        $this->assertNotNull($err);

        // Explaining a failure must not cost it its error.
        $discard = new \\ArrayObject();
        [$esdk, $ewatcher] = self::make_sdk(self::scenarios()['notfound'], $discard, ['active' => false]);
        [$explained, $_eexplain] = self::drive($esdk, $ewatcher, $target, ['explain' => ['on' => true]], $discard);
        $this->assertSame($err->getMessage(), $explained?->getMessage(), 'with clean off, explain lost the error');

        $leaked = 0;
        foreach ($sinks as $s) {
            if (0 < count(self::leaks($s['text']))) {
                $leaked++;
            }
        }
        $this->assertGreaterThan(0, $leaked, 'with clean off, nothing showed the canary: the sweep is blind');

        if (!self::AUTH['suppressed']) {
            $text = (string)json_encode($err instanceof ${Name}Error ? $err->spec : null);
            $this->assertTrue(
                str_contains($text, self::CANARY['apikey'])
                || str_contains($text, base64_encode(self::CANARY['apikey'] . ':' . self::CANARY['secret'])),
                'the raw spec should carry the credential when clean is off');
        }
    }

    public function test_no_body_of_bytes_leaves_the_sdk_in_any_form(): void
    {
        $this->with_trace_args(fn () => $this->content_sweep());
    }

    private function content_sweep(): void
    {
        $target = self::binary_op();
        if (null === $target) {
            $this->markTestSkipped('no operation of this SDK sends a binary body; nothing to sweep');
        }

        $sinks = new \\ArrayObject();
        $given = [];
        $sent = [];
        $errors = [];
        $explains = [];

        $path = (string)tempnam(sys_get_temp_dir(), 'clean');
        file_put_contents($path, self::CONTENT);
        try {
            $carriers = self::carriers($path);
            foreach ($carriers as $carrier => $make) {
                foreach (array_slice(self::scenarios(), 0, 4, true) as $sname => $respond) {
                    foreach (self::VARIANTS as $vname => $ctrl) {
                        $key = $carrier . '/' . $sname . '/' . $vname;
                        // The transport is where the bytes are meant to arrive, whole.
                        $seen = function (string $url, array $fetchdef) use ($respond, $key, &$sent): array {
                            $sent[$key] = $fetchdef['body'] ?? null;
                            return $respond($url, $fetchdef);
                        };
                        [$sdk, $watcher] = self::make_sdk($seen, $sinks, null, [self::reqdata_feature($sinks)]);
                        $given[$key] = $make();
                        [$err, $explain] = self::drive($sdk, $watcher, $target, $ctrl, $sinks,
                            ['$body' => $given[$key]]);
                        if (null !== $err) {
                            $errors[$key] = $err;
                        }
                        if (null !== $explain) {
                            $explains[$key] = $explain;
                        }
                        foreach (self::surfaces('sdk', $sdk) as $s) {
                            $sinks[] = $s;
                        }
                    }
                }
            }

            $leaked = [];
            foreach ($sinks as $s) {
                $found = self::content_leaks($s['text']);
                if (0 < count($found)) {
                    $leaked[] = $s['name'] . ' [' . implode(', ', $found) . ']';
                }
            }

            // The one line the generator's compile lane reads.
            fwrite(STDERR, sprintf("clean: content swept %d surface(s), %d leak(s)\\n",
                count($sinks), count($leaked)));

            $this->assertSame(0, count($leaked),
                'a body of bytes leaked through: ' . implode('; ', array_unique($leaked)));

            // The request itself is untouched: what the transport was handed
            // is the body.
            foreach (array_keys($carriers) as $carrier) {
                $body = $sent[$carrier . '/notfound/throw'] ?? null;
                $this->assertSame(self::CONTENT, is_resource($body) ? stream_get_contents($body) : $body,
                    $carrier . ': the transport was not handed the body');
            }

            // The positive half: where the body was, what describes it now
            // is. A stream is read into the spec before the first attempt, so
            // there it is bytes.
            $desc = ['binary$' => 'bytes', 'size' => strlen(self::CONTENT), 'type' => $target['media']];
            $stream = ['binary$' => 'stream', 'type' => $target['media']];
            foreach (array_keys($carriers) as $carrier) {
                $failed = $errors[$carrier . '/notfound/throw'] ?? null;
                $this->assertInstanceOf(${Name}Error::class, $failed, $carrier . ': the 404 scenario must throw');
                $this->assertSame($desc, $failed->spec['body'] ?? null, $carrier . ': the thrown spec');
                $explained = $explains[$carrier . '/ok/explain'] ?? [];
                $this->assertSame($desc, $explained['spec']['body'] ?? null, $carrier . ': the explain record');
                $this->assertSame($desc, $explained['fetchdef']['body'] ?? null,
                    $carrier . ': the explained fetch definition');

                // The request data holds what the caller gave: a stream is a
                // stream there, and an equal string is the body wherever it
                // sits.
                $ctx = $failed->ctx();
                $body = $given[$carrier . '/notfound/throw'];
                $held = ($ctx->utility->clean)($ctx, ['reqdata' => $ctx->reqdata, 'copy' => self::CONTENT]);
                $this->assertSame(is_string($body) ? $desc : $stream, $held['reqdata']['$body'] ?? null,
                    $carrier . ': the request data');
                $this->assertSame($desc, $held['copy'] ?? null, $carrier . ': an equal string');
                $this->assertSame($body, $ctx->reqdata['$body'] ?? null, $carrier . ': the live request data');
            }
        } finally {
            foreach ($given as $body) {
                if (is_resource($body)) {
                    fclose($body);
                }
            }
            unlink($path);
        }
    }

    public function test_the_sweep_can_see_a_body_clean_switched_off_shows_the_bytes(): void
    {
        $this->without_trace_args(fn () => $this->content_control());
    }

    private function content_control(): void
    {
        $target = self::binary_op();
        if (null === $target) {
            $this->markTestSkipped('no operation of this SDK sends a binary body; nothing to sweep');
        }

        $path = (string)tempnam(sys_get_temp_dir(), 'clean');
        file_put_contents($path, self::CONTENT);
        try {
            foreach (self::carriers($path) as $carrier => $make) {
                $sinks = new \\ArrayObject();
                [$sdk, $watcher] = self::make_sdk(self::scenarios()['notfound'], $sinks, ['active' => false]);
                $body = $make();
                [$err, $_explain] = self::drive($sdk, $watcher, $target, [], $sinks, ['$body' => $body]);
                if (is_resource($body)) {
                    fclose($body);
                }
                $this->assertNotNull($err, $carrier . ': the 404 scenario must throw');

                $leaked = 0;
                foreach ($sinks as $s) {
                    if (0 < count(self::content_leaks($s['text']))) {
                        $leaked++;
                    }
                }
                $this->assertGreaterThan(0, $leaked,
                    $carrier . ': with clean off, nothing showed the bytes: the sweep is blind');
            }
        } finally {
            unlink($path);
        }
    }
}
`
}


export {
  TestClean
}
