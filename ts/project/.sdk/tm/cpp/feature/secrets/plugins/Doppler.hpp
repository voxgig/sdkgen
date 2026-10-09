// VENDORED: @voxgig/sekreto sdk-20261009-0906-0 (cpp/plugins/Doppler.hpp)
// Source: https://github.com/voxgig/sekreto @ 83396df4f1c3d579af17e152b7a55fdade307ab1  [tag: sdk-20261009-0906-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
// Doppler.
//
// A PLUGIN, not a built-in: this kind opens a socket, signs a request or
// spawns a process, so a chain that does not name it links none of that.
// The calling project includes this header and passes what it declares to
// the Sekreto constructor (docs/design/plugin-providers.md).

#ifndef SEKRETO_PLUGINS_DOPPLER_HPP
#define SEKRETO_PLUGINS_DOPPLER_HPP

#include "../sekreto/Provider.hpp"

namespace sekreto {

/// The `doppler` provider kind, as a voxgig/plugin definition.
Definition doppler();

}  // namespace sekreto

#endif
