<?php
declare(strict_types=1);

// ProjectName SDK utility: prepare_headers

require_once __DIR__ . '/Param.php';
require_once __DIR__ . '/Media.php';

class ProjectNamePrepareHeaders
{
    public static function call(ProjectNameContext $ctx): array
    {
        $options = $ctx->client->options_map();
        $headers = \Voxgig\Struct\Struct::getprop($options, 'headers');
        $out = $headers ? \Voxgig\Struct\Struct::clone($headers) : [];
        if (!is_array($out)) {
            $out = [];
        }
        $out = ProjectNameMedia::headers($ctx->point, $out);
        // A header argument replaces a default of the same name, whatever its
        // case.
        foreach (ProjectNameParam::callArgs($ctx, 'header') as [$name, $orig, $val]) {
            if (null !== $val) {
                $wire = strtolower($orig);
                foreach (array_keys($out) as $key) {
                    if (is_string($key) && strtolower($key) === $wire) {
                        unset($out[$key]);
                    }
                }
                $out[$wire] = \Voxgig\Struct\Struct::stringify($val);
            }
        }
        return $out;
    }
}
