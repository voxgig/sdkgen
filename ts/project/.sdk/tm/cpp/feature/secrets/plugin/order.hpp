// VENDORED: @voxgig/plugin sdk-20260917-1242-0 (cpp/src/order.hpp)
// Source: https://github.com/voxgig/plugin @ 721de3a1bb5ac879b5c118dd9fc55c474a8730c4  [tag: sdk-20260917-1242-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
/* Ordering (§7) — constraints, then bands, then declaration position.
 * CONSTRAINTS BEAT BANDS so the correct tool wins when both are
 * present; a band chosen by trial and error to fix an ordering bug is a
 * bug wearing a number. See order.cpp. */

#ifndef VOXGIG_PLUGIN_ORDER_HPP
#define VOXGIG_PLUGIN_ORDER_HPP

#include "types.hpp"
#include "value.hpp"

namespace plugin {

/* [{ref, pos, order?}] plus an optional host pin -> [ref] */
V resolveorder(const V& bindings, const V& pin);

}  // namespace plugin

#endif
