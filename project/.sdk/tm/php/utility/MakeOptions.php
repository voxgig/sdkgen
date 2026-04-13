<?php
declare(strict_types=1);

// ProjectName SDK utility: make_options

class ProjectNameMakeOptions
{
    public static function call(ProjectNameContext $ctx): array
    {
        $options = $ctx->options ?? [];

        $custom_utils = \Voxgig\Struct\Struct::getprop($options, 'utility');
        if (is_array($custom_utils) && $ctx->utility) {
            foreach ($custom_utils as $k => $v) {
                $ctx->utility->custom[$k] = $v;
            }
        }

        $opts = \Voxgig\Struct\Struct::clone($options);
        if (!is_array($opts)) {
            $opts = [];
        }

        $config = $ctx->config ?? [];
        $cfgopts = isset($config['options']) && is_array($config['options']) ? $config['options'] : [];

        $optspec = [
            'apikey' => '',
            'base' => 'http://localhost:8000',
            'prefix' => '',
            'suffix' => '',
            'auth' => ['prefix' => ''],
            'headers' => ['`$CHILD`' => '`$STRING`'],
            'allow' => [
                'method' => 'GET,PUT,POST,PATCH,DELETE,OPTIONS',
                'op' => 'create,update,load,list,remove,command,direct',
            ],
            'entity' => ['`$CHILD`' => ['`$OPEN`' => true, 'active' => false, 'alias' => []]],
            'feature' => ['`$CHILD`' => ['`$OPEN`' => true, 'active' => false]],
            'utility' => [],
            'system' => [],
            'test' => ['active' => false, 'entity' => ['`$OPEN`' => true]],
            'clean' => ['keys' => 'key,token,id'],
        ];

        $sys_fetch = \Voxgig\Struct\Struct::getpath($opts, 'system.fetch');

        $merged = \Voxgig\Struct\Struct::merge([[], $cfgopts, $opts]);
        $validated = \Voxgig\Struct\Struct::validate($merged, $optspec);
        $opts = is_array($validated) ? $validated : [];

        if ($sys_fetch) {
            if (!is_array($opts['system'] ?? null)) {
                $opts['system'] = [];
            }
            $opts['system']['fetch'] = $sys_fetch;
        }

        $clean_keys = \Voxgig\Struct\Struct::getpath($opts, 'clean.keys');
        if (!is_string($clean_keys)) {
            $clean_keys = 'key,token,id';
        }
        $parts = array_filter(array_map('trim', explode(',', $clean_keys)), function ($p) {
            return $p !== '';
        });
        $parts = array_map(function ($p) {
            return \Voxgig\Struct\Struct::escre($p);
        }, $parts);
        $keyre = implode('|', $parts);
        $derived = ['clean' => $keyre === '' ? [] : ['keyre' => $keyre]];
        $opts['__derived__'] = $derived;

        return $opts;
    }
}
