# VENDORED: @voxgig/plugin sdk-20261125-1959-0 (elixir/lib/voxgig_plugin/error.ex)
# Source: https://github.com/voxgig/plugin @ 8605cdc5e68a691130ae9b585baf8c0091a66351  [tag: sdk-20261125-1959-0]
# License: MIT (c) voxgig - see repository LICENSE. Do not edit: resync from upstream.
defmodule Voxgig.Plugin.Error do
  @moduledoc """
  Every error carries a section 12 code. Ports compare by CODE and never by
  message: wording is a port's own business, and pinning the words would
  make every translation a corpus change. The FORMAT, however, is pinned -
  a parseable message is what makes a log searchable across twenty
  languages.
  """
  defexception [:code, :text, :details, :message]
end
