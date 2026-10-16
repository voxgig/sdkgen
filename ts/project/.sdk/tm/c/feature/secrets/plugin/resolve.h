// VENDORED: @voxgig/plugin sdk-20261016-0845-0 (c/src/resolve.h)
// Source: https://github.com/voxgig/plugin @ caa404b2dfa206d77db6c2869e5b31c2a3202b2d  [tag: sdk-20261016-0845-0]
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
