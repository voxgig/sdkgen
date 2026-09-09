// VENDORED: @voxgig/plugin sdk-20260908-1556-0 (cpp/src/config.hpp)
// Source: https://github.com/voxgig/plugin @ 48392f5e2b6d1434ee9b1a4a9a11f4480aaeb46a  [tag: sdk-20260908-1556-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
/* The declarative document (§9): normalization, and the ten-level
 * precedence ladder. See config.cpp for why the two functions are
 * split. */

#ifndef VOXGIG_PLUGIN_CONFIG_HPP
#define VOXGIG_PLUGIN_CONFIG_HPP

#include "types.hpp"
#include "value.hpp"

namespace plugin {

/* {instance: {ref -> entry}, order: [ref], default: {name -> entry}} */
V normalizeconfig(const V& input);

/* §9.3's ten levels, and §9.4's merge directives. */
V resolveoptions(const V& input);

/* §9.4: validated WHEN THE SHAPE ENTERS THE CATALOG, not when a
 * document exercises the key — so a malformed shape fails once, and in
 * the same place everywhere. `declare/shape` pins the timing. */
void checkshape(const V& shape);

}  // namespace plugin

#endif
