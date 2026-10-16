<?php
// VENDORED: @voxgig/plugin sdk-20261016-0845-0 (php/src/Export.php)
// Source: https://github.com/voxgig/plugin @ caa404b2dfa206d77db6c2869e5b31c2a3202b2d  [tag: sdk-20261016-0845-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.

/**
 * Exports (§11).
 *
 * An instance publishes values for other plugins and for the application.
 * Read with `host.exports('retry$fast/client')`.
 *
 * THE UNQUALIFIED ALIAS IS THE INTERESTING PART. `retry/client` resolves
 * to the UNTAGGED instance if one exists; if not, and exactly one tagged
 * instance exports that key, it resolves to that one; if two do, it is
 * `plugin_export_ambiguous` - deliberately diverging from seneca's silent
 * last-wins, because with multi-instance as a headline feature an
 * ambiguous alias is a defect waiting for production.
 */

declare(strict_types=1);

namespace Voxgig\Plugin;

/**
 * @param array<int,array<string,mixed>> $exported
 * @return mixed
 */
function resolve_export(string $spec, array $exported)
{
    $cut = strrpos($spec, '/');
    if (false === $cut) {
        fail_with('plugin_export_ambiguous', 'export spec needs a key: ' . $spec,
                  ['spec' => $spec]);
    }
    $head = substr($spec, 0, $cut);
    $key = substr($spec, $cut + 1);

    // A fully qualified ref: exactly one answer or none.
    $want = canon($head);
    foreach ($exported as $e) {
        if ($e['ref'] === $want && $e['key'] === $key) {
            return $e['value'];
        }
    }

    // An alias: the name, not a ref. Look at every instance of it.
    $byname = [];
    foreach ($exported as $e) {
        if (refname($e['ref']) === $head && $e['key'] === $key) {
            $byname[] = $e;
        }
    }
    if (empty($byname)) {
        return null;
    }

    foreach ($byname as $e) {
        if ('' === parse_ref($e['ref'])['tag']) {
            return $e['value'];
        }
    }

    if (1 === count($byname)) {
        return $byname[0]['value'];
    }

    $refs = Util::sortstrings(array_map(static function ($e) {
        return $e['ref'];
    }, $byname));
    fail_with('plugin_export_ambiguous',
              'alias ' . $spec . ' matches ' . count($refs) . ' instances: '
              . implode(', ', $refs),
              ['spec' => $spec, 'refs' => $refs]);
}
