# VENDORED: @voxgig/sekreto sdk-20261009-0906-0 (ruby/lib/voxgig_sekreto.rb)
# Source: https://github.com/voxgig/sekreto @ 83396df4f1c3d579af17e152b7a55fdade307ab1  [tag: sdk-20261009-0906-0]
# License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
# frozen_string_literal: true

# voxgig_sekreto - one interface for secrets, wherever they live.
#
# THE CORE SURFACE: the chain, the four built-in provider kinds, and the
# means of adding a fifth.
#
# The built-ins are the kinds that read at most a local file - env,
# memory, dotenv, file. Everything that opens a socket, spawns a process
# or signs a request is a PLUGIN, is not required by this file, and is
# handed to `Sekreto` by the calling project:
#
#     require 'voxgig_sekreto'
#     require 'voxgig_sekreto/plugins/hashicorp'
#
#     secrets = VoxgigSekreto::Sekreto.new(
#       'plugins' => [VoxgigSekreto::Plugins::HASHICORP],
#       'providers' => [{ 'kind' => 'env' },
#                       { 'kind' => 'hashicorp', 'addr' => addr, 'token' => token }]
#     )
#
# or, for every kind at once, `VoxgigSekreto::Plugins::ALL` from
# `voxgig_sekreto/plugins`. See docs/design/plugin-providers.md.

require_relative 'voxgig_sekreto/sekreto'
require_relative 'voxgig_sekreto/addr'
require_relative 'voxgig_sekreto/providers'
