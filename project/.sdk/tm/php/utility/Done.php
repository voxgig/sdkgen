<?php
declare(strict_types=1);

// ProjectName SDK utility: done

class ProjectNameDone
{
    public static function call(ProjectNameContext $ctx): array
    {
        if ($ctx->ctrl->explain) {
            $ctx->ctrl->explain = ($ctx->utility->clean)($ctx, $ctx->ctrl->explain);
            $er = $ctx->ctrl->explain['result'] ?? null;
            if (is_array($er)) {
                unset($ctx->ctrl->explain['result']['err']);
            }
        }
        if ($ctx->result && $ctx->result->ok) {
            return [$ctx->result->resdata, null];
        }
        return ($ctx->utility->make_error)($ctx, null);
    }
}
