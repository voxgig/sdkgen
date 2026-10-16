// VENDORED: @voxgig/plugin sdk-20261016-0845-0 (cpp/src/graph.hpp)
// Source: https://github.com/voxgig/plugin @ caa404b2dfa206d77db6c2869e5b31c2a3202b2d  [tag: sdk-20261016-0845-0]
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
