<?php
declare(strict_types=1);

// ProjectName SDK utility: make_context

require_once __DIR__ . '/../core/Context.php';

class ProjectNameMakeContext
{
    public static function call(array $ctxmap, ?ProjectNameContext $basectx): ProjectNameContext
    {
        return new ProjectNameContext($ctxmap, $basectx);
    }
}
