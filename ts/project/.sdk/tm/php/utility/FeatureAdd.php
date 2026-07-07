<?php
declare(strict_types=1);

// ProjectName SDK utility: feature_add

class ProjectNameFeatureAdd
{
    public static function call(ProjectNameContext $ctx, mixed $f): void
    {
        $ctx->client->features[] = $f;
    }
}
