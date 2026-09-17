// VENDORED: @voxgig/plugin sdk-20260917-1242-0 (c/src/export.h)
// Source: https://github.com/voxgig/plugin @ 721de3a1bb5ac879b5c118dd9fc55c474a8730c4  [tag: sdk-20260917-1242-0]
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
