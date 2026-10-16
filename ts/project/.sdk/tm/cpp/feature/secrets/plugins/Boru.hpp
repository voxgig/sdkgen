// VENDORED: @voxgig/sekreto sdk-20261016-0845-0 (cpp/plugins/Boru.hpp)
// Source: https://github.com/voxgig/sekreto @ ee837130bf444ca46a5a46181bdd6743e118898c  [tag: sdk-20261016-0845-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
// A boru vault, read through its CLI or over its wire protocol.
//
// A PLUGIN, not a built-in: this kind opens a socket, signs a request or
// spawns a process, so a chain that does not name it links none of that.
// The calling project includes this header and passes what it declares to
// the Sekreto constructor (docs/design/plugin-providers.md).

#ifndef SEKRETO_PLUGINS_BORU_HPP
#define SEKRETO_PLUGINS_BORU_HPP

#include "../sekreto/Provider.hpp"

namespace sekreto {

/// The `boru` provider kind, as a voxgig/plugin definition.
Definition boru();

/// Does this boru failure mean "no such secret" rather than "I could not
/// answer"?
bool borumiss(const std::string& why);

}  // namespace sekreto

#endif
