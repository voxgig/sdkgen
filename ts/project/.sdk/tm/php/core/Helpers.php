<?php
declare(strict_types=1);

// ProjectName SDK helpers

class ProjectNameHelpers
{
    public static function to_map(mixed $v): ?array
    {
        return is_array($v) ? $v : null;
    }

    public static function to_int(mixed $v): int
    {
        return is_numeric($v) ? (int)$v : -1;
    }

    public static function get_ctx_prop(?array $m, string $key): mixed
    {
        if ($m === null) {
            return null;
        }
        return $m[$key] ?? null;
    }

    // php has one array type, so `[]` is how a caller writes an empty map,
    // and struct reads an empty array as a list. Where the spec wants a map,
    // an empty array becomes an empty object.
    public static function empty_maps(mixed $val, mixed $spec): mixed
    {
        if (!is_array($val)) {
            return $val;
        }
        $maps = self::spec_maps($spec);
        if (0 === count($val)) {
            return 0 < count($maps) ? (object)[] : $val;
        }
        if (array_is_list($val)) {
            return $val;
        }
        foreach ($maps as $map) {
            foreach ($val as $k => $v) {
                $sub = array_key_exists($k, $map) ? $map[$k] : ($map['`$CHILD`'] ?? null);
                if (null !== $sub) {
                    $val[$k] = self::empty_maps($v, $sub);
                }
            }
        }
        return $val;
    }

    // The map shapes a spec admits: a map, `$MAP`, or either of those as an
    // alternative of a `$NOF`.
    public static function spec_maps(mixed $spec): array
    {
        if ($spec instanceof \stdClass || '`$MAP`' === $spec) {
            return [[]];
        }
        if (!is_array($spec)) {
            return [];
        }
        if (!array_is_list($spec)) {
            return [$spec];
        }
        if ('`$NOF`' !== ($spec[0] ?? null)) {
            return [];
        }
        $out = [];
        foreach (array_slice($spec, 2) as $alt) {
            $out = array_merge($out, self::spec_maps($alt));
        }
        return $out;
    }
}
