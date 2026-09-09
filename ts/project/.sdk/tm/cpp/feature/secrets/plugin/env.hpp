// VENDORED: @voxgig/plugin sdk-20260908-1556-0 (cpp/src/env.hpp)
// Source: https://github.com/voxgig/plugin @ 48392f5e2b6d1434ee9b1a4a9a11f4480aaeb46a  [tag: sdk-20260908-1556-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
/* Environment overrides (§9.5) — level 7 of the ladder. Pure: a
 * function over a string map and a ref set, so the corpus tests it
 * without touching a real environment. */

#ifndef VOXGIG_PLUGIN_ENV_HPP
#define VOXGIG_PLUGIN_ENV_HPP

#include <string>

#include "types.hpp"
#include "value.hpp"

namespace plugin {

/* `retry$fast` -> `RETRY__FAST`. Lossy on purpose; see env.cpp. */
std::string encoderef(const std::string& ref);

V applyenv(const V& input);

}  // namespace plugin

#endif
