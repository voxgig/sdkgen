// VENDORED: @voxgig/plugin sdk-20260908-1556-0 (c/src/graph.h)
// Source: https://github.com/voxgig/plugin @ 48392f5e2b6d1434ee9b1a4a9a11f4480aaeb46a  [tag: sdk-20260908-1556-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
/* Whole-graph resolution (§11.4) — a pure function of the registry that
 * answers which instances can be live, and for each blocked one THE
 * SPECIFIC requirement that is unmet, and why. See graph.c. */

#ifndef VOXGIG_PLUGIN_GRAPH_H
#define VOXGIG_PLUGIN_GRAPH_H

#include "types.h"
#include "value.h"

/* [{ref, pos, provides?, requires?}] -> {resolved: [ref], blocked: [...]} */
Value *resolvegraph(Value *nodes);

#endif
