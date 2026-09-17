// VENDORED: @voxgig/sekreto sdk-20260917-1242-0 (cpp/plugins/Infisical.hpp)
// Source: https://github.com/voxgig/sekreto @ 108c4a914bee7b6534c30d1c68c25cd1b9377696  [tag: sdk-20260917-1242-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
// Infisical.
//
// A PLUGIN, not a built-in: this kind opens a socket, signs a request or
// spawns a process, so a chain that does not name it links none of that.
// The calling project includes this header and passes what it declares to
// the Sekreto constructor (docs/design/plugin-providers.md).

#ifndef SEKRETO_PLUGINS_INFISICAL_HPP
#define SEKRETO_PLUGINS_INFISICAL_HPP

#include "../sekreto/Provider.hpp"

namespace sekreto {

/// The `infisical` provider kind, as a voxgig/plugin definition.
Definition infisical();

}  // namespace sekreto

#endif
