// VENDORED: @voxgig/plugin sdk-20260917-1242-0 (c/src/resolve.h)
// Source: https://github.com/voxgig/plugin @ 721de3a1bb5ac879b5c118dd9fc55c474a8730c4  [tag: sdk-20260917-1242-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
/* Dynamic resolution (§10.2) — name to candidate module ids. Pure: it
 * returns the ids a host WOULD try, in order, and loads nothing. That
 * is what lets the corpus pin resolution in a language with no dynamic
 * loading at all. */

#ifndef VOXGIG_PLUGIN_RESOLVE_H
#define VOXGIG_PLUGIN_RESOLVE_H

#include "types.h"
#include "value.h"

Value *resolvecandidates(Value *name, Value *sources);
Value *resolvefrom(Value *from);

#endif
