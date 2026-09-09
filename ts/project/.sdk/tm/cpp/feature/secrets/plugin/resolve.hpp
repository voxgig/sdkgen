// VENDORED: @voxgig/plugin sdk-20260908-1556-0 (cpp/src/resolve.hpp)
// Source: https://github.com/voxgig/plugin @ 48392f5e2b6d1434ee9b1a4a9a11f4480aaeb46a  [tag: sdk-20260908-1556-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
/* Dynamic resolution (§10.2) — name to candidate module ids.
 *
 * PURE. It returns the ids a host WOULD try, in order; it does not load
 * anything. That separation is what lets the corpus pin resolution in
 * every language including those with no dynamic loading at all — cpp
 * among them — and it is why §15.4 puts real module loading in per-port
 * integration tests rather than here. */

#ifndef VOXGIG_PLUGIN_RESOLVE_HPP
#define VOXGIG_PLUGIN_RESOLVE_HPP

#include "types.hpp"
#include "value.hpp"

namespace plugin {

V resolvecandidates(const V& name, const V& sources);
V resolvefrom(const V& from);

}  // namespace plugin

#endif
