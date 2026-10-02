<?php
declare(strict_types=1);

// ProjectName SDK utility: media

// The media types a point declares: `response` (the model's `rs`) for the
// Accept header, and `body` (the model's `rb`) for the request body.
class ProjectNameMedia
{
    // The data key holding a raw request body. Like `$action`, it can never
    // be a declared argument name.
    public const RAW_BODY = '$body';

    public static function isJsonMedia(mixed $media): bool
    {
        $m = strtolower(trim(explode(';', is_string($media) ? $media : '')[0]));
        return 'application/json' === $m || 'text/json' === $m || str_ends_with($m, '+json');
    }

    // The declared JSON type alone, else every declared type in the model's
    // order; null when no success response declares a body.
    public static function acceptOf(mixed $point): ?string
    {
        $res = \Voxgig\Struct\Struct::getprop($point, 'response');
        $media = \Voxgig\Struct\Struct::getprop($res, 'media');
        if (!is_string($media) || '' === $media) {
            return null;
        }
        if ('json' === \Voxgig\Struct\Struct::getprop($res, 'kind')) {
            return $media;
        }
        $types = [$media];
        $alts = \Voxgig\Struct\Struct::getprop($res, 'alternatives');
        foreach (is_array($alts) ? $alts : [] as $alt) {
            $m = \Voxgig\Struct\Struct::getprop($alt, 'media');
            if (is_string($m) && '' !== $m) {
                $types[] = $m;
            }
        }
        return implode(', ', $types);
    }

    public static function isRawRequest(mixed $point): bool
    {
        return 'raw' === \Voxgig\Struct\Struct::getprop(\Voxgig\Struct\Struct::getprop($point, 'body'), 'kind');
    }

    private static function hasHeader(array $headers, string $name): bool
    {
        foreach (array_keys($headers) as $key) {
            if (is_string($key) && strtolower($key) === $name) {
                return true;
            }
        }
        return false;
    }

    // A caller's accept wins. A declared request type replaces each JSON
    // content-type, the SDK default, and leaves any other the caller set.
    public static function headers(mixed $point, array $headers): array
    {
        $accept = self::acceptOf($point);
        if (null !== $accept && !self::hasHeader($headers, 'accept')) {
            $headers['accept'] = $accept;
        }

        $body = \Voxgig\Struct\Struct::getprop($point, 'body');
        $kind = \Voxgig\Struct\Struct::getprop($body, 'kind');
        $media = \Voxgig\Struct\Struct::getprop($body, 'media');
        if (('raw' === $kind || 'json' === $kind) && is_string($media) && '' !== $media) {
            foreach (array_keys($headers) as $key) {
                if (is_string($key) && 'content-type' === strtolower($key) &&
                    self::isJsonMedia($headers[$key])) {
                    unset($headers[$key]);
                }
            }
            if (!self::hasHeader($headers, 'content-type')) {
                $headers['content-type'] = $media;
            }
        }

        return $headers;
    }

    // A string of bytes or text, or a stream, sent as it is.
    public static function rawBody(mixed $reqdata): mixed
    {
        return is_array($reqdata) ? ($reqdata[self::RAW_BODY] ?? null) : null;
    }
}
