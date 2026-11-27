<?php
declare(strict_types=1);

// ProjectName SDK utility: result_body

require_once __DIR__ . '/Media.php';

class ProjectNameResultBody
{
    public const PREVIEW_LENGTH = 160;

    public static function call(ProjectNameContext $ctx): ?ProjectNameResult
    {
        $response = $ctx->response;
        $result = $ctx->result;
        $raw = is_array($ctx->utility?->codec) ? ($ctx->utility->codec['raw'] ?? null) : null;
        if ($result && $response && is_callable($raw) &&
            'raw' === \Voxgig\Struct\Struct::getpath($ctx->point, 'response.kind') &&
            null === $result->err && null === $response->err && $result->status < 400) {
            $raw($ctx);
            return $result;
        }
        if ($result && $response && $response->json_func && $response->body) {
            $result->body = ($response->json_func)();
        }
        if ($result && $response && $response->unreadable) {
            $sent = null !== $ctx->spec ? $ctx->spec->headers : null;
            $result->err = self::unreadable($ctx, $result->status, $result->headers,
                $response->body, $sent, $result->err);
        }
        return $result;
    }

    // A body that is not JSON. An HTTP failure keeps its own error, with the
    // response described; otherwise the code tells a wrong content type from
    // malformed JSON.
    public static function unreadable(ProjectNameContext $ctx, int $status, mixed $headers,
        mixed $text, mixed $sent, mixed $failed): mixed
    {
        $type = ProjectNameMedia::headerValue($headers, 'content-type');
        $agent = (string)($ctx->utility->clean)($ctx, ProjectNameMedia::headerValue($sent, 'user-agent'));
        if ('' === $agent) {
            $agent = 'transport default';
        }
        $detail = "HTTP {$status}, content-type " . ('' === $type ? 'none' : $type) .
            ", user-agent {$agent}";
        // Only text is quoted: bytes are a file's, by the model or by their type.
        if (null !== $text && !ProjectNameMedia::isBinaryResponse($ctx->point, $type)) {
            $detail .= ', body: ' . self::preview($ctx, $text);
        }

        if (null !== $failed) {
            if (is_string($failed)) {
                return "{$failed} ({$detail})";
            }
            if ($failed instanceof ProjectNameError) {
                return $ctx->make_error($failed->sdk_code, "{$failed->msg} ({$detail})");
            }
            if ($failed instanceof \Throwable) {
                return new \RuntimeException("{$failed->getMessage()} ({$detail})", 0, $failed);
            }
            return $failed;
        }

        if ('' === $type || false !== stripos($type, 'json')) {
            return $ctx->make_error('response_json_invalid',
                "response: body is not valid JSON ({$detail})");
        }
        return $ctx->make_error('response_content_type',
            "response: expected JSON, got {$type} ({$detail})");
    }

    // Cleaned whole: a secret the bound would split could leave its prefix.
    private static function preview(ProjectNameContext $ctx, mixed $text): string
    {
        $flat = trim((string)preg_replace('/\s+/', ' ', (string)$text));
        $flat = (string)($ctx->utility->clean)($ctx, $flat);
        $chars = preg_split('//u', $flat, -1, PREG_SPLIT_NO_EMPTY);
        if (false === $chars) {
            $chars = str_split($flat);
        }
        return count($chars) > self::PREVIEW_LENGTH
            ? implode('', array_slice($chars, 0, self::PREVIEW_LENGTH)) . '...' : $flat;
    }
}
