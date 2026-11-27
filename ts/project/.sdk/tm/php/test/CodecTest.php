<?php
declare(strict_types=1);

// Its own namespace keeps the suite's class out of the one entity classes share.
namespace ProjectNameCodecSuite;

// ProjectName SDK codec test
//
// Every form, multipart and raw point this SDK has, driven through a real
// entity operation against a local listener that decodes what arrives. The
// cases come from the client's own config, so no case names an entity. The
// listener is a child process: PHP serves nothing while it waits.

require_once __DIR__ . '/../projectname_sdk.php';

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ProjectNameConfig;
use ProjectNameError;
use ProjectNameSDK;

class CodecTest extends TestCase
{
    private static mixed $proc = null;
    private static array $pipes = [];
    private static string $base = '';
    private static int $ran = 0;
    private static int $failed = 0;
    private static int $seq = 0;

    // Each line on its stdin replaces the answer; each request it serves is
    // a line on its stdout, the body in base64, tagged with the answer's case.
    private const SERVER = <<<'SERVER'
        $srv = stream_socket_server('tcp://127.0.0.1:0');
        fwrite(STDOUT, explode(':', stream_socket_get_name($srv, false))[1] . "\n");
        fflush(STDOUT);
        $answer = [];
        for (;;) {
            $ready = [STDIN, $srv];
            $none = null;
            if (!stream_select($ready, $none, $none, 60)) {
                break;
            }
            if (in_array(STDIN, $ready, true)) {
                $line = fgets(STDIN);
                if (false === $line) {
                    break;
                }
                $answer = json_decode($line, true);
                continue;
            }
            $sock = stream_socket_accept($srv, 5);
            $first = explode(' ', trim((string)fgets($sock)));
            $headers = [];
            while (!in_array($hl = fgets($sock), ["\r\n", "\n", false], true)) {
                [$k, $v] = array_pad(explode(':', $hl, 2), 2, '');
                $headers[strtolower(trim($k))] = trim($v);
            }
            $length = (int)($headers['content-length'] ?? 0);
            $body = '';
            while (strlen($body) < $length && !feof($sock)) {
                $body .= fread($sock, $length - strlen($body));
            }
            $out = base64_decode($answer['body'] ?? '');
            fwrite($sock, 'HTTP/1.1 ' . ($answer['status'] ?? 200) . " OK\r\n" .
                'Content-Type: ' . ($answer['type'] ?? 'application/json') . "\r\n" .
                'Content-Length: ' . strlen($out) . "\r\nConnection: close\r\n\r\n" . $out);
            fclose($sock);
            fwrite(STDOUT, json_encode(['seq' => $answer['seq'] ?? 0, 'method' => $first[0] ?? '', 'url' => $first[1] ?? '',
                'headers' => $headers, 'body' => base64_encode($body)]) . "\n");
            fflush(STDOUT);
        }
        SERVER;

    public static function setUpBeforeClass(): void
    {
        self::$proc = proc_open([PHP_BINARY, '-r', self::SERVER], [0 => ['pipe', 'r'], 1 => ['pipe', 'w']],
            self::$pipes);
        self::$base = 'http://127.0.0.1:' . trim((string)fgets(self::$pipes[1]));
    }

    public static function tearDownAfterClass(): void
    {
        fwrite(STDOUT, 'codec: ran ' . self::$ran . ' case(s), ' . self::$failed . " failed\n");
        if (null !== self::$proc) {
            fclose(self::$pipes[0]);
            proc_terminate(self::$proc);
            proc_close(self::$proc);
        }
    }

    private static function answer(array $answer): void
    {
        $answer['body'] = base64_encode($answer['body'] ?? '');
        $answer['seq'] = self::$seq;
        fwrite(self::$pipes[0], json_encode($answer) . "\n");
        fflush(self::$pipes[0]);
    }

    // What reached the listener for this case; a record an earlier case
    // left unread is passed over.
    private function arrived(): array
    {
        do {
            $ready = [self::$pipes[1]];
            $none = null;
            $this->assertGreaterThan(0, (int)stream_select($ready, $none, $none, 10), 'nothing arrived');
            $got = json_decode((string)fgets(self::$pipes[1]), true);
        } while (($got['seq'] ?? -1) !== self::$seq);
        $got['body'] = base64_decode($got['body']);
        return $got;
    }

    // The client's entity accessors, by entity name.
    private static function accessors(ProjectNameSDK $client, array $config): array
    {
        $out = [];
        foreach (get_class_methods($client) as $m) {
            if (!preg_match('/^[A-Z]/', $m)) {
                continue;
            }
            try {
                $ent = $client->$m();
            } catch (\Throwable $e) {
                continue;
            }
            if (is_object($ent) && method_exists($ent, 'get_name') && isset($config['entity'][$ent->get_name()])) {
                $out[$ent->get_name()] = $m;
            }
        }
        return $out;
    }

    // A value for each path parameter a point names.
    private static function params(array $point): array
    {
        $out = [];
        foreach ($point['parts'] ?? [] as $part) {
            if (preg_match('/^\{(.+)\}$/', (string)$part, $m)) {
                $out[$m[1]] = 'p1';
            }
        }
        return $out;
    }

    private static function select(array $point): array
    {
        $action = $point['select']['$action'] ?? null;
        return null === $action ? [] : ['$action' => $action];
    }

    private static function content(string $name): string
    {
        return 'file:' . $name . "\x00\xFF\r\n--";
    }

    // The unnamed slot is reached with no name; an entity with no other takes none.
    private static function handle(object $ent, ?string $action): object
    {
        return null === $action ? $ent->binary() : $ent->binary($action);
    }

    // The data a form or multipart point is sent, and the parts it must arrive as.
    private static function plan(ProjectNameSDK $client, array $body): array
    {
        $data = [];
        $expect = [];
        foreach ($body['fields'] ?? [] as $field) {
            $name = $field['name'];
            if (true === ($field['binary'] ?? null)) {
                $type = 'form' === $body['kind'] ? null : ($field['media'] ?? 'application/octet-stream');
                $data[$name] = $client->binary()->bytes(self::content($name),
                    ['name' => "/local/dir/{$name}.bin", 'type' => $type]);
                $expect[] = 'form' === $body['kind'] ? ['name' => $name, 'value' => self::content($name)] :
                    ['name' => $name, 'file' => self::content($name), 'filename' => "{$name}.bin", 'type' => $type];
            } elseif (true === ($field['list'] ?? null)) {
                $data[$name] = ['a', 'b c'];
                $expect[] = ['name' => $name, 'value' => 'a'];
                $expect[] = ['name' => $name, 'value' => 'b c'];
            } elseif (is_string($field['join'] ?? null)) {
                $data[$name] = ['a', 'b'];
                $expect[] = ['name' => $name, 'value' => 'a' . $field['join'] . 'b'];
            } else {
                $data[$name] = "v\"{$name}\r\n";
                $expect[] = ['name' => $name, 'value' => "v\"{$name}\r\n"];
            }
        }
        return [$data, $expect];
    }

    private function multipart(array $arrived): array
    {
        $type = (string)($arrived['headers']['content-type'] ?? '');
        // preg_match rather than assertMatchesRegularExpression, which
        // PHPUnit 8 does not have.
        $this->assertSame(1, preg_match('/boundary=([^;]+)/', $type, $m), $type);
        $boundary = $m[1];
        $text = $arrived['body'];
        $this->assertStringEndsWith("--{$boundary}--\r\n", $text, 'the body does not close');
        $parts = [];
        foreach (array_slice(explode('--' . $boundary, $text), 1, -1) as $chunk) {
            $at = strpos($chunk, "\r\n\r\n");
            $head = substr($chunk, 2, $at - 2);
            $body = substr($chunk, $at + 4, -2);
            $this->assertSame(1, preg_match('/^Content-Disposition: form-data; name="([^"]*)"(?:; filename="([^"]*)")?\r?$/m',
                $head, $disp), 'a part without a disposition: ' . $head);
            $ctype = preg_match('/^Content-Type: (.*?)\r?$/m', $head, $cm) ? $cm[1] : null;
            $parts[] = isset($disp[2]) ? ['name' => $disp[1], 'file' => $body, 'filename' => $disp[2], 'type' => $ctype] :
                ['name' => $disp[1], 'value' => $body];
        }
        return $parts;
    }

    public static function cases(): array
    {
        $config = ProjectNameConfig::shared_config();
        $probe = new ProjectNameSDK(['base' => 'http://127.0.0.1:1']);
        $acc = self::accessors($probe, $config);
        $out = [];
        $entities = array_keys($config['entity'] ?? []);
        sort($entities);
        foreach ($entities as $ename) {
            $accessor = $acc[$ename] ?? null;
            if (null === $accessor) {
                continue;
            }
            $ops = $config['entity'][$ename]['op'] ?? [];
            $opnames = array_keys($ops);
            sort($opnames);
            foreach ($opnames as $opname) {
                foreach ($ops[$opname]['points'] ?? [] as $point) {
                    $action = $point['select']['$action'] ?? null;
                    $label = "{$ename}.{$opname}" . (null === $action ? '' : ":{$action}");
                    $rb = $point['body'] ?? [];
                    $rs = $point['response'] ?? [];
                    $writes = in_array($opname, ['create', 'update', 'patch'], true);
                    if (in_array($rb['kind'] ?? null, ['form', 'multipart'], true) && $writes) {
                        $out["{$label} sends a {$rb['kind']} body"] = ['send', $accessor, $opname, $point];
                    }
                    if ('raw' === ($rb['kind'] ?? null) && $writes) {
                        $out["{$label} sends a raw " . (true === ($rb['binary'] ?? null) ? 'binary' : 'text') . ' body'] =
                            ['raw', $accessor, $opname, $point];
                    }
                    if ('raw' === ($rs['kind'] ?? null) && 'load' === $opname) {
                        $out["{$label} reads a raw " . (true === ($rs['binary'] ?? null) ? 'binary' : 'text') . ' body'] =
                            ['read', $accessor, $opname, $point];
                    }
                }
            }
        }
        return $out;
    }

    public function test_this_sdk_has_a_point_to_drive(): void
    {
        $this->assertNotEmpty(self::cases(), 'no form, multipart or raw point was found');
    }

    // Both spellings: PHPUnit 8 and 9 read the annotation, later ones the
    // attribute.
    /** @dataProvider cases */
    #[DataProvider('cases')]
    public function test_codec(string $kind, string $accessor, string $opname, array $point): void
    {
        self::$ran++;
        self::$seq++;
        try {
            $this->run_case($kind, $accessor, $opname, $point, new ProjectNameSDK(['base' => self::$base]));
        } catch (\Throwable $err) {
            self::$failed++;
            throw $err;
        }
    }

    private function run_case(string $kind, string $accessor, string $opname, array $point, ProjectNameSDK $client): void
    {
        $action = $point['select']['$action'] ?? null;
        $label = "{$accessor}.{$opname}" . (null === $action ? '' : ":{$action}");
        $rb = $point['body'] ?? [];
        $rs = $point['response'] ?? [];

        if ('send' === $kind) {
            [$data, $expect] = self::plan($client, $rb);
            self::answer(['body' => json_encode(['id' => 'p1'])]);
            $client->$accessor()->$opname(array_merge(self::params($point), self::select($point), $data));
            $arrived = $this->arrived();
            $names = array_column($expect, 'name');
            if ('form' === $rb['kind']) {
                $this->assertSame($rb['media'], $arrived['headers']['content-type'] ?? null);
                $got = [];
                foreach (explode('&', $arrived['body']) as $pair) {
                    [$n, $v] = array_pad(explode('=', $pair, 2), 2, '');
                    $got[] = ['name' => urldecode($n), 'value' => urldecode($v)];
                }
                $got = array_values(array_filter($got, fn ($g) => in_array($g['name'], $names, true)));
                $this->assertSame($expect, $got);
            } else {
                $got = array_values(array_filter($this->multipart($arrived),
                    fn ($g) => in_array($g['name'], $names, true)));
                $this->assertSame($expect, $got);
            }
            return;
        }

        $ent = $client->$accessor();
        $ent->data_set(self::params($point));
        $ent->match_set(self::params($point));

        if ('raw' === $kind) {
            self::answer(['body' => json_encode(['id' => 'p1'])]);
            if (true === ($rb['binary'] ?? null)) {
                $got = self::handle($ent, $action)->put($client->binary()->bytes(self::content($label),
                    ['type' => $rb['media']]));
                $this->assertSame($ent, $got);
                $arrived = $this->arrived();
                $this->assertSame(self::content($label), $arrived['body']);
            } else {
                $ent->$opname(array_merge(self::select($point), ['$body' => "text \"{$label}\"\n"]));
                $arrived = $this->arrived();
                $this->assertSame("text \"{$label}\"\n", $arrived['body']);
            }
            $this->assertSame($rb['media'], $arrived['headers']['content-type'] ?? null);
            return;
        }

        if (true === ($rs['binary'] ?? null)) {
            self::answer(['type' => $rs['media'], 'body' => self::content($label)]);
            $this->assertSame(self::content($label), self::handle($ent, $action)->bytes());
            $this->arrived();
            $refused = null;
            try {
                $ent->load(array_merge(self::params($point), self::select($point)));
            } catch (ProjectNameError $err) {
                $refused = $err;
            }
            $this->assertSame('binary_sink_required', $refused?->sdk_code);
        } else {
            self::answer(['type' => $rs['media'], 'body' => "café {$label}"]);
            $this->assertSame($ent, $ent->load(array_merge(self::params($point), self::select($point))));
            $this->arrived();
            $this->assertSame("café {$label}", $ent->data_get()['$body'] ?? null);
        }
    }
}
