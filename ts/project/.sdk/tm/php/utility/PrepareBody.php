<?php
declare(strict_types=1);

// ProjectName SDK utility: prepare_body

require_once __DIR__ . '/Media.php';
require_once __DIR__ . '/Binary.php';

class ProjectNamePrepareBody
{
    // A refusal is answered as the body; make_spec raises it.
    public static function call(ProjectNameContext $ctx): mixed
    {
        if ($ctx->op->input === 'data') {
            $refused = ProjectNameBinaryUtility::liftSources($ctx);
            if (null !== $refused) {
                return $refused;
            }
            if (ProjectNameMedia::isRawRequest($ctx->point)) {
                return self::rawSource($ctx);
            }
            $body = ($ctx->utility->transform_request)($ctx);
            $kind = \Voxgig\Struct\Struct::getpath($ctx->point, 'body.kind');
            if ('form' === $kind || 'multipart' === $kind) {
                return self::encode($ctx, $kind, \Voxgig\Struct\Struct::undef() === $body ? null : $body);
            }
            // A reference that resolves to nothing transforms to struct's
            // no-value sentinel, and an empty array is no body either: php
            // cannot tell an empty map from an empty list. The shared corpus
            // pins the missing-reference case to null.
            if (\Voxgig\Struct\Struct::undef() === $body) {
                return null;
            }
            return (is_array($body) && 0 === count($body)) ? null : $body;
        }
        $fields = \Voxgig\Struct\Struct::getprop($ctx->point, 'fields');
        if (is_array($fields) && 0 < count($fields)) {
            return self::matchBody($ctx, $fields);
        }
        return null;
    }

    // A source is sent as its bytes. A stream can be read once, so it is
    // read here, before the first attempt, and a retry sends the same bytes.
    private static function rawSource(ProjectNameContext $ctx): mixed
    {
        $raw = ($ctx->sources ?? [])[ProjectNameMedia::RAW_BODY] ?? null;
        if (ProjectNameBinaryUtility::isSource($raw)) {
            return $raw->data;
        }
        return is_resource($raw) ? stream_get_contents($raw) : $raw;
    }

    // The encoded body, with its content type replacing any the headers
    // carry: a multipart boundary is the encoder's alone to choose.
    private static function encode(ProjectNameContext $ctx, string $kind, mixed $data): mixed
    {
        $codec = is_array($ctx->utility->codec) ? $ctx->utility->codec : [];
        $encode = $codec[$kind] ?? null;
        if (!is_callable($encode)) {
            return $ctx->make_error('body_codec_missing', "This SDK was generated without a {$kind} encoder.");
        }

        $encoded = $encode($ctx, $data, $ctx->sources ?? []);
        if ($encoded instanceof ProjectNameError) {
            return $encoded;
        }

        if (null !== $ctx->spec) {
            foreach (array_keys($ctx->spec->headers) as $key) {
                if ('content-type' === strtolower((string)$key)) {
                    unset($ctx->spec->headers[$key]);
                }
            }
            $ctx->spec->headers['content-type'] = $encoded['type'];
        }
        return $encoded['body'];
    }

    // A list, load or remove routed to a method with a body sends the match
    // fields that body declares, never a path parameter, and never a header,
    // cookie or query argument the body does not also declare as a field.
    // With none given it is still a JSON object, which an empty array is not.
    private static function matchBody(ProjectNameContext $ctx, array $fields): array|\stdClass
    {
        $point = $ctx->point;
        $params = \Voxgig\Struct\Struct::getprop($point, 'params');
        $routed = is_array($params) ? $params : [];
        foreach (['params', 'header', 'cookie', 'query'] as $kind) {
            $defs = \Voxgig\Struct\Struct::getpath($point, 'args.' . $kind);
            foreach (is_array($defs) ? $defs : [] as $ad) {
                if ('params' === $kind || true !== \Voxgig\Struct\Struct::getprop($ad, 'field')) {
                    $routed[] = \Voxgig\Struct\Struct::getprop($ad, 'name');
                }
            }
        }
        $body = [];
        foreach ($fields as $name) {
            $val = \Voxgig\Struct\Struct::getprop($ctx->reqmatch ?? [], $name);
            if (null !== $val && '$action' !== $name && !in_array($name, $routed, true)) {
                $body[$name] = $val;
            }
        }
        return 0 === count($body) ? new \stdClass() : $body;
    }
}
