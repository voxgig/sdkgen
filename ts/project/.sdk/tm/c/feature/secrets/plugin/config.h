// VENDORED: @voxgig/plugin sdk-20260917-1242-0 (c/src/config.h)
// Source: https://github.com/voxgig/plugin @ 721de3a1bb5ac879b5c118dd9fc55c474a8730c4  [tag: sdk-20260917-1242-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
/* The declarative document (§9): normalization, and the ten-level
 * precedence ladder. See config.c for why the two functions are split. */

#ifndef VOXGIG_PLUGIN_CONFIG_H
#define VOXGIG_PLUGIN_CONFIG_H

#include "types.h"
#include "value.h"

/* {instance: {ref -> entry}, order: [ref], default: {name -> entry}} */
Value *normalizeconfig(Value *input);

/* §9.3's ten levels, and §9.4's merge directives. */
Value *resolveoptions(Value *input);

/* §9.4: validated WHEN THE SHAPE ENTERS THE CATALOG, not when a
 * document exercises the key — so a malformed shape fails once, and in
 * the same place everywhere. `declare/shape` pins the timing. */
void checkshape(Value *shape);

#endif
