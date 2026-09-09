// VENDORED: @voxgig/plugin sdk-20260908-1556-0 (cpp/src/version.hpp)
// Source: https://github.com/voxgig/plugin @ 48392f5e2b6d1434ee9b1a4a9a11f4480aaeb46a  [tag: sdk-20260908-1556-0]
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
