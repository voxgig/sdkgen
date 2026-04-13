<?php
declare(strict_types=1);

// ProjectName SDK utility: prepare_body

class ProjectNamePrepareBody
{
    public static function call(ProjectNameContext $ctx): mixed
    {
        if ($ctx->op->input === 'data') {
            return ($ctx->utility->transform_request)($ctx);
        }
        return null;
    }
}
