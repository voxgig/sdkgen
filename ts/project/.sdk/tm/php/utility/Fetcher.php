<?php
declare(strict_types=1);

// ProjectName SDK utility: fetcher

require_once __DIR__ . '/../core/Error.php';

class ProjectNameFetcher
{
    // Default User-Agent — many CDNs (notably Cloudflare) reject requests
    // with PHP's default UA (which file_get_contents doesn't even set),
    // returning 403 before the request reaches the origin. Set a Mozilla-
    // shaped UA so the SDK behaves like every other HTTP client by default.
    // Users can override by passing a User-Agent header in fetchdef.
    public const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; ProjectNameSDK/1.0)';

    // One cURL handle per process, reset between calls rather than closed:
    // curl_reset keeps the connection cache, so the next request to the
    // same host reuses the open connection.
    private static $curl = null;

    private static function curlHandle(string $fullurl)
    {
        if (self::$curl === null) {
            self::$curl = curl_init();
        } else {
            curl_reset(self::$curl);
        }
        curl_setopt(self::$curl, CURLOPT_URL, $fullurl);
        return self::$curl;
    }

    public const GETONLY_ENV = 'VOXGIG_GETONLY_GUARD';

    // A GET-only live run refuses any other method before it is sent, on
    // either transport below. The path alone: the query can carry a
    // credential, and nothing has cleaned this line.
    public static function getOnlyRefusal(string $fullurl, string $method): ?ProjectNameError
    {
        if (getenv(self::GETONLY_ENV) !== 'TRUE' || $method === 'GET') {
            return null;
        }
        $path = parse_url($fullurl, PHP_URL_PATH);
        $path = is_string($path) && $path !== '' ? $path : '/';
        fwrite(STDERR, "[GET-ONLY GUARD] blocked {$method} {$path}\n");
        return new ProjectNameError('fetch_getonly_block', "[GET-ONLY GUARD] blocked {$method} {$path}");
    }

    public const REDIRECT_STATUS = [301, 302, 303, 307, 308];
    public const REDIRECT_MAX = 5;

    // Neither transport below follows a redirect. A GET or HEAD follows one
    // here, unless the fetch definition says "manual", each hop passing the
    // GET-only guard first; past REDIRECT_MAX hops the last 3xx is the answer.
    // Another origin is not sent the request's credentials.
    public static function defaultHttpFetch(string $fullurl, array $fetchdef): array
    {
        $method_str = strtoupper($fetchdef['method'] ?? 'GET');
        $follow = in_array($method_str, ['GET', 'HEAD'], true) && ($fetchdef['redirect'] ?? null) !== 'manual';
        $url = $fullurl;
        for ($hops = 0; ; $hops++) {
            $refused = self::getOnlyRefusal($url, $method_str);
            if (null !== $refused) {
                return [null, $refused];
            }
            [$res, $err] = self::sendOnce($url, $method_str, $fetchdef);
            $location = is_array($res) ? ($res['headers']['location'] ?? null) : null;
            $next = $follow && is_string($location) && $hops < self::REDIRECT_MAX
                && in_array($res['status'], self::REDIRECT_STATUS, true)
                ? self::resolveLocation($url, $location) : null;
            if (null === $next) {
                return [$res, $err];
            }
            if (self::origin($next) !== self::origin($url)) {
                $fetchdef['headers'] = array_filter($fetchdef['headers'] ?? [],
                    fn($k) => !in_array(strtolower((string)$k), ['authorization', 'cookie', 'proxy-authorization'], true),
                    ARRAY_FILTER_USE_KEY);
            }
            $url = $next;
        }
    }

    // The Location resolved against the URL that answered with it (RFC 3986 5.2).
    public static function resolveLocation(string $base, string $loc): ?string
    {
        $loc = preg_replace('/#.*$/s', '', preg_replace('/\s+/', '', $loc));
        if (preg_match('/^[A-Za-z][A-Za-z0-9+.-]*:/', $loc)) {
            return $loc;
        }
        if (!preg_match('~^([^:/?#]+):(?://([^/?#]*))?([^?#]*)(\?[^#]*)?~', $base, $m)) {
            return null;
        }
        [$scheme, $auth, $path, $query] = [$m[1], $m[2] ?? '', $m[3] ?? '', $m[4] ?? ''];
        if (str_starts_with($loc, '//')) {
            return $scheme . ':' . $loc;
        }
        $path = '' === $path ? '/' : $path;
        $qat = strpos($loc, '?');
        $lpath = false === $qat ? $loc : substr($loc, 0, $qat);
        $lquery = false === $qat ? null : substr($loc, $qat);
        if ('' === $lpath) {
            $lpath = $path;
            $lquery = $lquery ?? $query;
        } elseif ('/' !== $lpath[0]) {
            $lpath = substr($path, 0, strrpos($path, '/') + 1) . $lpath;
        }
        $out = [];
        foreach (explode('/', $lpath) as $seg) {
            if ('..' === $seg) {
                if (1 < count($out)) {
                    array_pop($out);
                }
            } elseif ('.' !== $seg) {
                $out[] = $seg;
            }
        }
        if (preg_match('~(^|/)\.\.?$~', $lpath)) {
            $out[] = '';
        }
        return $scheme . '://' . $auth . implode('/', $out) . ($lquery ?? '');
    }

    private static function origin(string $url): string
    {
        $p = parse_url(strtolower($url));
        $scheme = $p['scheme'] ?? '';
        return $scheme . '://' . ($p['host'] ?? '') . ':' . ($p['port'] ?? ('https' === $scheme ? 443 : 80));
    }

    private static function sendOnce(string $fullurl, string $method_str, array $fetchdef): array
    {
        $body_str = $fetchdef['body'] ?? null;
        if (is_resource($body_str)) {
            $body_str = stream_get_contents($body_str);
        }
        $headers = $fetchdef['headers'] ?? [];

        $header_lines = [];
        $has_ua = false;
        foreach ($headers as $k => $v) {
            if (is_string($v)) {
                if (strcasecmp($k, 'user-agent') === 0) {
                    $has_ua = true;
                }
                $header_lines[] = "{$k}: {$v}";
            }
        }
        if (!$has_ua) {
            $header_lines[] = 'User-Agent: ' . self::DEFAULT_USER_AGENT;
        }

        // Prefer cURL when available — its header capture is reliable across
        // PHP versions, while file_get_contents + custom stream wrappers
        // don't propagate $http_response_header for user-defined wrappers
        // in PHP 8.3+.
        if (function_exists('curl_init')) {
            return self::curlFetch($fullurl, $method_str, $body_str, $header_lines);
        }

        $opts = [
            'http' => [
                'method' => $method_str,
                'ignore_errors' => true,
                'follow_location' => 0,
            ],
        ];

        if (is_string($body_str)) {
            $opts['http']['content'] = $body_str;
        }

        if (!empty($header_lines)) {
            $opts['http']['header'] = implode("\r\n", $header_lines);
        }

        $context = stream_context_create($opts);
        error_clear_last();
        $response_body = @file_get_contents($fullurl, false, $context);

        // A request that got no answer fails the operation. The stream
        // wrapper's warning names the URL, which is left out.
        if ($response_body === false) {
            $warning = error_get_last()['message'] ?? 'request failed';
            return [null, preg_replace('/^file_get_contents\(.*?\):\s*/', '', $warning)];
        }

        $status = 0;
        $status_text = '';
        $resp_headers = [];

        $response_headers = function_exists('http_get_last_response_headers')
            ? http_get_last_response_headers()
            : ($http_response_header ?? []);

        if (is_array($response_headers)) {
            foreach ($response_headers as $header) {
                if (preg_match('/^HTTP\/\S+\s+(\d+)\s+(.*)$/i', $header, $matches)) {
                    $status = (int)$matches[1];
                    $status_text = trim($matches[2]);
                } else {
                    $parts = explode(':', $header, 2);
                    if (count($parts) === 2) {
                        $resp_headers[strtolower(trim($parts[0]))] = trim($parts[1]);
                    }
                }
            }
        }

        $json_body = null;
        $unreadable = false;
        if (trim($response_body) !== '') {
            $decoded = json_decode($response_body, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $json_body = $decoded;
            } else {
                $unreadable = true;
            }
        }

        return [
            [
                'status' => $status,
                'statusText' => $status_text,
                'headers' => $resp_headers,
                'json' => function () use ($json_body) { return $json_body; },
                'body' => $response_body,
                'unreadable' => $unreadable,
            ],
            null,
        ];
    }

    private static function curlFetch(string $fullurl, string $method, $body_str, array $header_lines): array
    {
        $ch = self::curlHandle($fullurl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HEADER, false);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        if (!empty($header_lines)) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, $header_lines);
        }
        if (is_string($body_str)) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body_str);
        }

        $resp_headers = [];
        curl_setopt($ch, CURLOPT_HEADERFUNCTION,
            function ($_ch, $hdr) use (&$resp_headers) {
                $trimmed = trim($hdr);
                if ($trimmed !== '') {
                    $resp_headers[] = $trimmed;
                }
                return strlen($hdr);
            });

        $response_body = curl_exec($ch);
        if ($response_body === false) {
            $err = curl_error($ch) ?: 'curl_exec failed';
            return [
                [
                    'status' => 0,
                    'statusText' => 'Error',
                    'headers' => [],
                    'json' => function () { return null; },
                    'body' => '',
                ],
                $err,
            ];
        }

        $status = 0;
        $status_text = '';
        $resp_kv = [];
        foreach ($resp_headers as $h) {
            if (preg_match('/^HTTP\/\S+\s+(\d+)\s*(.*)$/i', $h, $m)) {
                $status = (int)$m[1];
                $status_text = trim($m[2]);
            } else {
                $parts = explode(':', $h, 2);
                if (count($parts) === 2) {
                    $resp_kv[strtolower(trim($parts[0]))] = trim($parts[1]);
                }
            }
        }

        $json_body = null;
        $unreadable = false;
        if ($response_body !== false && trim((string)$response_body) !== '') {
            $decoded = json_decode($response_body, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $json_body = $decoded;
            } else {
                $unreadable = true;
            }
        }

        return [
            [
                'status' => $status,
                'statusText' => $status_text,
                'headers' => $resp_kv,
                'json' => function () use ($json_body) { return $json_body; },
                'body' => (string)$response_body,
                'unreadable' => $unreadable,
            ],
            null,
        ];
    }

    public static function call(ProjectNameContext $ctx, string $fullurl, array $fetchdef): array
    {
        if ($ctx->client->mode !== 'live') {
            return [null, $ctx->make_error('fetch_mode_block',
                "Request blocked by mode: \"{$ctx->client->mode}\" (URL was: \"{$fullurl}\")")];
        }

        $options = $ctx->client->options_map();
        if (\Voxgig\Struct\Struct::getpath($options, 'feature.test.active') === true) {
            return [null, $ctx->make_error('fetch_test_block',
                "Request blocked as test feature is active (URL was: \"{$fullurl}\")")];
        }

        $sys_fetch = self::systemFetch($options);

        if (self::usesDefault($ctx)) {
            if (null !== $ctx->spec) {
                $ctx->spec->headers = self::sentHeaders($ctx->spec->headers);
            }
            return self::defaultHttpFetch($fullurl, $fetchdef);
        }
        if (is_callable($sys_fetch)) {
            return $sys_fetch($fullurl, $fetchdef);
        }

        return [null, $ctx->make_error('fetch_invalid', 'system.fetch is not a valid function')];
    }

    // getpath answers a missing path with the struct port's UNDEF sentinel:
    // one stdClass for the whole process, which setprop writes into when it
    // is handed as a parent. It must never be read, or kept, as a fetcher.
    public static function systemFetch(mixed $options): mixed
    {
        $fetch = \Voxgig\Struct\Struct::getpath($options, 'system.fetch');
        return $fetch === \Voxgig\Struct\Struct::undef() ? null : $fetch;
    }

    // An empty map or list for `system.fetch` names no fetcher either.
    public static function usesDefault(ProjectNameContext $ctx): bool
    {
        $sys_fetch = self::systemFetch($ctx->client->options_map());
        $is_empty_obj = ($sys_fetch instanceof \stdClass) && empty(get_object_vars($sys_fetch));
        $is_empty_arr = is_array($sys_fetch) && empty($sys_fetch);
        return $sys_fetch === null || $is_empty_obj || $is_empty_arr;
    }

    // The headers the default transport sends: the request's own, with its
    // agent when they name none. A request's headers travel by value, so the
    // transport cannot record the agent where the response is read.
    public static function sentHeaders(array $headers): array
    {
        foreach ($headers as $k => $v) {
            if (is_string($v) && strcasecmp((string)$k, 'user-agent') === 0) {
                return $headers;
            }
        }
        $headers['user-agent'] = self::DEFAULT_USER_AGENT;
        return $headers;
    }
}
