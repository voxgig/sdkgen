// VENDORED: @voxgig/sekreto sdk-20261016-0845-0 (cpp/plugins/Aws.hpp)
// Source: https://github.com/voxgig/sekreto @ ee837130bf444ca46a5a46181bdd6743e118898c  [tag: sdk-20261016-0845-0]
// License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
// AWS Secrets Manager and SSM Parameter Store.
//
// SIGV4 TRAVELS WITH THIS PLUGIN, and it is the sharpest instance of the
// whole split: the core of no port includes a hash function, and this is
// the only kind that needs one.
//
// A PLUGIN, not a built-in: this kind opens a socket, signs a request or
// spawns a process, so a chain that does not name it links none of that.
// The calling project includes this header and passes what it declares to
// the Sekreto constructor (docs/design/plugin-providers.md).

#ifndef SEKRETO_PLUGINS_AWS_HPP
#define SEKRETO_PLUGINS_AWS_HPP

#include "../sekreto/Provider.hpp"

namespace sekreto {

/// The `awssecrets` provider kind, as a voxgig/plugin definition.
Definition awssecrets();

/// The `awsparams` provider kind, as a voxgig/plugin definition.
Definition awsparams();

}  // namespace sekreto

#endif
