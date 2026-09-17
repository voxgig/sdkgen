// VENDORED: @voxgig/plugin sdk-20260917-1242-0 (c/src/version.h)
// Source: https://github.com/voxgig/plugin @ 721de3a1bb5ac879b5c118dd9fc55c474a8730c4  [tag: sdk-20260917-1242-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
/* Versions and ranges (§11.2).
 *
 * TWO FIELDS AND ONE PREDICATE. A capability declares `version`, a
 * concrete version. A requirement declares `range`. A requirement is
 * satisfied when the names match, the `match` passes, and the
 * provider's `version` falls inside the requirement's `range`. That is
 * the whole rule — there is no third field and no second comparison. */

#ifndef VOXGIG_PLUGIN_VERSION_H
#define VOXGIG_PLUGIN_VERSION_H

#include <stdbool.h>

#include "types.h"
#include "value.h"

/* A parsed range is {lo:[3], hi:[3]} — the shape `version/range` asserts
 * directly, so it is a Value rather than a struct. */
Value *parserange(Value *range);
/* [major, minor, patch]. */
Value *parseversion(Value *version);

/* The one satisfaction predicate: lo <= version < hi. */
bool satisfies(Value *version, Value *range);
/* The same, tolerant of a missing version — a bare ref carries none, so
 * `graph` and `depend` ask this rather than raising. */
bool satisfiesq(Value *version, Value *range);

int vercmp(Value *a, Value *b);

#endif
