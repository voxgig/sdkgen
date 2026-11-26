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
        return null;
    }
}
