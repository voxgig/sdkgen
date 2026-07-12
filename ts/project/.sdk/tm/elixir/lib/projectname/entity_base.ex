# ProjectName SDK generic entity behaviour
#
# Shared construction and data/match operations for every entity. The
# per-entity modules add the op functions (load/list/...) and pass their own
# module in so `make/1` can spawn a fresh instance. Construction and data
# hooks are fired directly (no jostraca marker needed — these are fixed).

defmodule ProjectName.EntityBase do
  alias Voxgig.Struct, as: S
  alias ProjectName.Helpers, as: H
  alias ProjectName.{Context, Utility}

  def construct(module, client, name, entopts \\ nil) do
    entopts = if S.ismap(entopts), do: entopts, else: S.jm([])

    if S.getprop(entopts, "active") == false do
      :ok
    else
      S.setprop(entopts, "active", true)
    end

    ent = S.jm([])
    S.setprop(ent, "_module", module)
    S.setprop(ent, "_name", name)
    S.setprop(ent, "_client", client)
    S.setprop(ent, "_utility", ProjectName.get_utility(client))
    S.setprop(ent, "_entopts", entopts)
    S.setprop(ent, "_data", S.jm([]))
    S.setprop(ent, "_match", S.jm([]))

    entctx =
      Context.new(S.jm(["entity", ent, "entopts", entopts]), ProjectName.get_root_ctx(client))

    S.setprop(ent, "_entctx", entctx)

    Utility.feature_hook(entctx, "PostConstructEntity")
    ent
  end

  def get_name(ent), do: S.getprop(ent, "_name")

  def make(ent) do
    module = S.getprop(ent, "_module")
    client = S.getprop(ent, "_client")
    entopts0 = S.getprop(ent, "_entopts")
    opts = S.jm([])
    Enum.each(H.entries(entopts0), fn {k, v} -> S.setprop(opts, k, v) end)
    apply(module, :new, [client, opts])
  end

  def data_set(ent, args) do
    if args != nil do
      S.setprop(ent, "_data", H.or_(H.to_map(S.clone(args)), S.jm([])))
      Utility.feature_hook(S.getprop(ent, "_entctx"), "SetData")
    end

    ent
  end

  def data_get(ent) do
    Utility.feature_hook(S.getprop(ent, "_entctx"), "GetData")
    S.clone(S.getprop(ent, "_data"))
  end

  def match_set(ent, args) do
    if args != nil do
      S.setprop(ent, "_match", H.or_(H.to_map(S.clone(args)), S.jm([])))
      Utility.feature_hook(S.getprop(ent, "_entctx"), "SetMatch")
    end

    ent
  end

  def match_get(ent) do
    Utility.feature_hook(S.getprop(ent, "_entctx"), "GetMatch")
    S.clone(S.getprop(ent, "_match"))
  end
end
