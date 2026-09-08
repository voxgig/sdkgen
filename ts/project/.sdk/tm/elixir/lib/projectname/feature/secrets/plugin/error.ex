# VENDORED: @voxgig/plugin sdk-20260907-0029-0 (elixir/lib/voxgig_plugin/error.ex)
# Source: https://github.com/voxgig/plugin @ b48ae643eb0eb56c5ebe3198da98cecdf6a7f7fc  [tag: sdk-20260907-0029-0]
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
