// VENDORED: @voxgig/plugin sdk-20260908-1556-0 (c/src/export.h)
// Source: https://github.com/voxgig/plugin @ 48392f5e2b6d1434ee9b1a4a9a11f4480aaeb46a  [tag: sdk-20260908-1556-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
/* Exports (§11). An instance publishes values for other plugins and for
 * the application. THE UNQUALIFIED ALIAS IS THE INTERESTING PART; see
 * export.c. */

#ifndef VOXGIG_PLUGIN_EXPORT_H
#define VOXGIG_PLUGIN_EXPORT_H

#include "types.h"
#include "value.h"

/* `retry$fast/client` or the alias `retry/client`, against a list of
 * {ref, key, value}. Answers NULL for "no such export", which is not an
 * error — `export/missing` pins that. */
Value *resolveexport(Value *spec, Value *exported);

#endif
