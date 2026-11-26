<?php
declare(strict_types=1);

// ProjectName SDK utility: prepare_body

require_once __DIR__ . '/Media.php';

class ProjectNamePrepareBody
{
    public static function call(ProjectNameContext $ctx): mixed
    {
        if ($ctx->op->input === 'data') {
            if (ProjectNameMedia::isRawRequest($ctx->point)) {
                return ProjectNameMedia::rawBody($ctx->reqdata);
            }
            $body = ($ctx->utility->transform_request)($ctx);
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
