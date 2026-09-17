// VENDORED: @voxgig/plugin sdk-20260917-1242-0 (c/src/graph.h)
// Source: https://github.com/voxgig/plugin @ 721de3a1bb5ac879b5c118dd9fc55c474a8730c4  [tag: sdk-20260917-1242-0]
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
