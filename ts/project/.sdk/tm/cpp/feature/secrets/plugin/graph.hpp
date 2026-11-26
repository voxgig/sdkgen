// VENDORED: @voxgig/plugin sdk-20261125-1959-0 (cpp/src/graph.hpp)
// Source: https://github.com/voxgig/plugin @ 8605cdc5e68a691130ae9b585baf8c0091a66351  [tag: sdk-20261125-1959-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
/* Whole-graph resolution (§11.4) — a pure function of the registry that
 * answers which instances can be live, and for each blocked one THE
 * SPECIFIC requirement that is unmet, and why. See graph.cpp. */

#ifndef VOXGIG_PLUGIN_GRAPH_HPP
#define VOXGIG_PLUGIN_GRAPH_HPP

#include "types.hpp"
#include "value.hpp"

namespace plugin {

/* [{ref, pos, provides?, requires?}] -> {resolved: [ref], blocked: [...]} */
V resolvegraph(const V& nodes);

}  // namespace plugin

#endif
