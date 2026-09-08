// VENDORED: @voxgig/plugin sdk-20260908-1556-0 (c/src/resolve.h)
// Source: https://github.com/voxgig/plugin @ 48392f5e2b6d1434ee9b1a4a9a11f4480aaeb46a  [tag: sdk-20260908-1556-0]
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
