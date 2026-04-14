<?php
declare(strict_types=1);

// ProjectName SDK utility: make_options

class ProjectNameMakeOptions
{
    private static function to_array_deep(mixed $val): mixed
    {
        if (is_object($val)) {
            $val = (array)$val;
        }
        if (is_array($val)) {
            foreach ($val as $k => $v) {
                if (is_object($v) || is_array($v)) {
                    $val[$k] = self::to_array_deep($v);
                }
            }
        }
        return $val;
    }

    public static function call(ProjectNameContext $ctx): array
    {
        $options = $ctx->options ?? [];

        $custom_utils = \Voxgig\Struct\Struct::getprop($options, 'utility');
        if ((is_array($custom_utils) || is_object($custom_utils)) && $ctx->utility) {
            foreach ((array)$custom_utils as $k => $v) {
                $ctx->utility->custom[$k] = $v;
            }
        }

        // Preserve system.fetch before clone (closures can't be deep-cloned).
        $sys_fetch = null;
        if (is_array($options) && isset($options['system']) && is_array($options['system']) && isset($options['system']['fetch'])) {
            $sys_fetch = $options['system']['fetch'];
            unset($options['system']['fetch']);
        }

        $opts = \Voxgig\Struct\Struct::clone($options);

        // Restore on original options.
        if ($sys_fetch !== null) {
            $options['system']['fetch'] = $sys_fetch;
        }
        $opts = self::to_array_deep($opts);
        if (!is_array($opts)) {
            $opts = [];
        }

        // Remove stale clone of fetch (clone may drop or corrupt closures).
        if (isset($opts['system']['fetch'])) {
            unset($opts['system']['fetch']);
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
            'entity' => ['`$CHILD`' => ['`$OPEN`' => true, 'active' => false, 'alias' => (object)[]]],
            'feature' => ['`$CHILD`' => ['`$OPEN`' => true, 'active' => false]],
            'utility' => (object)[],
            'system' => (object)[],
            'test' => ['active' => false, 'entity' => ['`$OPEN`' => true]],
            'clean' => ['keys' => 'key,token,id'],
        ];

        $merged = \Voxgig\Struct\Struct::merge([(object)[], $cfgopts, $opts]);
        $validated = \Voxgig\Struct\Struct::validate($merged, $optspec);
        $opts = self::to_array_deep($validated);
        if (!is_array($opts)) {
            $opts = [];
        }

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
