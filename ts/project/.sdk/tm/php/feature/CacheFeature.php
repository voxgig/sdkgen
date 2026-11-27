<?php
declare(strict_types=1);

// ProjectName SDK cache feature

require_once __DIR__ . '/BaseFeature.php';
require_once __DIR__ . '/../utility/Media.php';

// Response caching for safe (read) requests, per client: see the features
// reference for the key, the write invalidation and the Cache-Control rules.
// Mirrors ts/src/feature/cache/CacheFeature.ts.
class ProjectNameCacheFeature extends ProjectNameBaseFeature
{
    private const SAFE_METHODS = ['GET', 'HEAD'];
    private const UNSTORED = ['no-store', 'private', 'no-cache'];

    private mixed $client;
    private ?array $options;
    private array $store;
    private string $secret = '';

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'cache';
        $this->active = true;
        $this->client = null;
        $this->options = null;
        $this->store = [];
    }

    public function init(ProjectNameContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;
        $this->active = ($options['active'] ?? null) === true;

        if (!$this->active) {
            return;
        }

        $this->store = [];
        $this->secret = random_bytes(32);

        $utility = $ctx->utility;
        $inner = $utility->fetcher;

        $utility->fetcher = function (ProjectNameContext $ctx2, string $url, array $fetchdef) use ($inner): array {
            return $this->_through($ctx2, $url, $fetchdef, $inner);
        };
    }

    private function _through(ProjectNameContext $ctx, string $url, array $fetchdef, callable $inner): array
    {
        $method = strtoupper((string)($fetchdef['method'] ?? 'GET'));
        $methods = $this->options['methods'] ?? ['GET'];

        if (!is_array($methods) || !in_array($method, $methods, true)) {
            if (in_array($method, self::SAFE_METHODS, true)) {
                return $inner($ctx, $url, $fetchdef);
            }
            try {
                return $inner($ctx, $url, $fetchdef);
            } finally {
                $this->_invalidate($url);
            }
        }

        $key = $method . ' ' . $url . ' ' . $this->_digest($fetchdef['headers'] ?? null);
        $now = $this->_now();
        $hit = $this->store[$key] ?? null;

        if ($hit !== null && $hit['expiry'] > $now) {
            $this->_track('hit');
            return [$this->_replay($hit['snapshot']), null];
        }

        [$res, $err] = $inner($ctx, $url, $fetchdef);

        // A body that declares another type than JSON passes by, unread.
        if ($this->_cacheable($res, $err) && !$this->_json($res)) {
            $this->_track('bypass');
            return [$res, $err];
        }

        if ($this->_cacheable($res, $err)) {
            $snapshot = $this->_snapshot($res);
            $ttl = self::lifetime($snapshot['headers'],
                is_numeric($this->options['ttl'] ?? null) ? (float)$this->options['ttl'] : 5000.0);
            if ($ttl <= 0) {
                $this->_track('bypass');
                return [$this->_replay($snapshot), null];
            }
            unset($this->store[$key]);
            $this->_evict();
            $this->store[$key] = ['expiry' => $now + $ttl, 'scope' => self::scope($url), 'snapshot' => $snapshot];
            $this->_track('miss');
            return [$this->_replay($snapshot), null];
        }

        $this->_track('bypass');
        return [$res, $err];
    }

    private function _digest(mixed $headers): string
    {
        $pairs = [];
        if (is_array($headers)) {
            foreach ($headers as $name => $val) {
                if ($val !== null) {
                    $pairs[] = [strtolower((string)$name), is_scalar($val) ? (string)$val : json_encode($val)];
                }
            }
        }
        usort($pairs, fn($a, $b) => strcmp($a[0], $b[0]) ?: strcmp($a[1], $b[1]));
        $text = '';
        foreach ($pairs as [$name, $val]) {
            $text .= $name . ':' . $val . "\n";
        }
        return hash_hmac('sha256', $text, $this->secret);
    }

    private function _invalidate(string $url): void
    {
        $path = self::scope($url);
        $collection = self::parent($path);
        foreach ($this->store as $key => $entry) {
            if (self::under($entry['scope'], $path) || self::under($entry['scope'], $collection)) {
                unset($this->store[$key]);
            }
        }
    }

    // The configured ttl capped by the response's Cache-Control; zero when
    // the response may not be stored.
    private static function lifetime(array $headers, float $ttl): float
    {
        $control = '';
        foreach ($headers as $name => $val) {
            if (strtolower((string)$name) === 'cache-control') {
                $control = strtolower((string)$val);
            }
        }
        $life = $ttl;
        foreach (explode(',', $control) as $part) {
            $directive = trim($part);
            if (in_array($directive, self::UNSTORED, true)) {
                return 0.0;
            }
            if (preg_match('/^max-age\s*=\s*"?(\d+)"?$/', $directive, $age)) {
                $life = min($life, (float)$age[1] * 1000.0);
            }
        }
        return $life;
    }

    private static function scope(string $url): string
    {
        return rtrim(preg_split('/[?#]/', $url, 2)[0], '/');
    }

    private static function parent(string $scope): string
    {
        $scheme = strpos($scope, '://');
        $root = $scheme === false ? 0 : strpos($scope, '/', $scheme + 3);
        if ($root === false) {
            return $scope;
        }
        $cut = strrpos($scope, '/');
        return substr($scope, 0, max($cut === false ? 0 : $cut, $root));
    }

    private static function under(string $scope, string $prefix): bool
    {
        return $scope === $prefix || str_starts_with($scope, $prefix . '/');
    }

    private function _cacheable(mixed $res, mixed $err): bool
    {
        // A body the transport could not read as JSON passes through, for the operation to report.
        if ($err !== null || !is_array($res) || true === ($res['unreadable'] ?? false)) {
            return false;
        }
        $status = $res['status'] ?? null;
        return is_numeric($status) && (int)$status >= 200 && (int)$status < 300;
    }

    private function _json(array $res): bool
    {
        $type = ProjectNameMedia::headerValue($res['headers'] ?? null, 'content-type');
        return '' === $type || ProjectNameMedia::isJsonMedia($type);
    }

    private function _snapshot(array $res): array
    {
        $data = null;
        $jf = $res['json'] ?? null;
        if (is_callable($jf)) {
            try {
                $data = $jf();
            } catch (\Throwable $_e) {
                $data = null;
            }
        }
        $headers = is_array($res['headers'] ?? null) ? $res['headers'] : [];
        return [
            'status' => $res['status'] ?? null,
            'statusText' => $res['statusText'] ?? '',
            'data' => $data,
            'headers' => $headers,
        ];
    }

    private function _replay(array $snapshot): array
    {
        $data = $snapshot['data'];
        return [
            'status' => $snapshot['status'],
            'statusText' => $snapshot['statusText'],
            'body' => 'not-used',
            // Fresh closure per replay: the body is re-readable on every hit.
            'json' => function () use ($data) { return $data; },
            'headers' => $snapshot['headers'],
        ];
    }

    private function _evict(): void
    {
        $max = is_numeric($this->options['max'] ?? null) ? (int)$this->options['max'] : 256;
        while (count($this->store) >= $max) {
            $oldest = array_key_first($this->store);
            if ($oldest === null) {
                break;
            }
            unset($this->store[$oldest]);
        }
    }

    private function _now(): float
    {
        $now = $this->options['now'] ?? null;
        if (is_callable($now)) {
            return (float)$now();
        }
        return microtime(true) * 1000.0;
    }

    private function _track(string $kind): void
    {
        $client = $this->client;
        if (!isset($client->_cache)) {
            $client->_cache = ['hit' => 0, 'miss' => 0, 'bypass' => 0];
        }
        $client->_cache[$kind]++;
    }
}
