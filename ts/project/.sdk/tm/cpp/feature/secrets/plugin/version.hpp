// VENDORED: @voxgig/plugin sdk-20260917-1242-0 (cpp/src/version.hpp)
// Source: https://github.com/voxgig/plugin @ 721de3a1bb5ac879b5c118dd9fc55c474a8730c4  [tag: sdk-20260917-1242-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
/* Versions and ranges (§11.2).
 *
 * TWO FIELDS AND ONE PREDICATE. A capability declares `version`, a
 * concrete version. A requirement declares `range`. A requirement is
 * satisfied when the names match, the `match` passes, and the
 * provider's `version` falls inside the requirement's `range`. That is
 * the whole rule — there is no third field and no second comparison. */

#ifndef VOXGIG_PLUGIN_VERSION_HPP
#define VOXGIG_PLUGIN_VERSION_HPP

#include "types.hpp"
#include "value.hpp"

namespace plugin {

/* A parsed range is {lo:[3], hi:[3]} — the shape `version/range` asserts
 * directly, so it is a Value rather than a struct. */
V parserange(const V& range);
/* [major, minor, patch]. */
V parseversion(const V& version);

/* The one satisfaction predicate: lo <= version < hi. */
bool satisfies(const V& version, const V& range);
/* The same, tolerant of a missing version — a bare ref carries none, so
 * `graph` and `depend` ask this rather than raising. */
bool satisfiesq(const V& version, const V& range);

int vercmp(const V& a, const V& b);

}  // namespace plugin

#endif
