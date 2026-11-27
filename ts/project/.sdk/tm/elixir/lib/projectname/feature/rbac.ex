# ProjectName SDK rbac feature
#
# Client-side role/permission enforcement. Before an operation resolves its
# endpoint, the required permission for that entity+operation is checked
# against the permissions the client holds; a disallowed call is
# short-circuited with an `rbac_denied` error placed in ctx.out["point"]
# (the pipeline's make_point surfaces it) and never touches the network.
# Required permissions come from `rules` (keyed by `<entity>.<op>:<action>`,
# `<entity>.<op>`, `<op>`, or `*`, most specific first); the default when no
# rule matches is controlled by `deny`
# (default: allow when unspecified). Held permissions are the `permissions`
# list (a `*` grants everything).

defmodule ProjectName.Feature.Rbac do
  alias Voxgig.Struct, as: S
  alias ProjectName.Helpers, as: H
  alias ProjectName.{Feature, Context}

  def new do
    f = Feature.base("rbac")
    Feature.install(f, "init", fn ctx, opts -> init(f, ctx, opts) end)
    Feature.install(f, "PrePoint", fn ctx -> pre_point(f, ctx) end)
    f
  end

  def init(f, ctx, options) do
    Feature.init_common(f, ctx, options)

    opts = Feature.opts(f)
    granted = S.jm([])
    perms = S.getprop(opts, "permissions")

    if S.islist(perms) do
      n = S.size(perms)

      if n > 0 do
        Enum.each(0..(n - 1), fn i ->
          perm = S.getelem(perms, i)
          S.setprop(granted, perm, true)
        end)
      end
    end

    S.setprop(f, "granted", granted)
    nil
  end

  defp pre_point(f, ctx) do
    if Feature.active?(f) do
      required = required(f, ctx)

      cond do
        required == nil ->
          # No rule: honour the default policy.
          if S.getprop(Feature.opts(f), "deny") == true do
            reject(f, ctx, "<default-deny>")
          end

          nil

        true ->
          granted = S.getprop(f, "granted")

          if S.getprop(granted, "*") == true or S.getprop(granted, required) == true do
            track(f, ctx, required, true)
          else
            reject(f, ctx, required)
          end
      end
    end

    nil
  end

  defp required(f, ctx) do
    rules = S.getprop(Feature.opts(f), "rules")
    rules = if S.ismap(rules), do: rules, else: S.jm([])
    Enum.find_value(H.op_keys(ctx), &S.getprop(rules, &1))
  end

  defp reject(f, ctx, required) do
    track(f, ctx, required, false)

    op = S.getprop(ctx, "op")
    nm = if op != nil, do: S.getprop(op, "name"), else: nil
    opname = if is_binary(nm) and nm != "", do: nm, else: "?"
    action = H.op_action(ctx)
    opname = if action == nil, do: opname, else: opname <> ":" <> action

    err =
      Context.make_error(
        ctx,
        "rbac_denied",
        "Permission \"" <> to_string(required) <> "\" required for operation \"" <> opname <> "\""
      )

    # Short-circuit endpoint resolution; the pipeline surfaces this error.
    S.setprop(S.getprop(ctx, "out"), "point", err)
    err
  end

  defp track(f, ctx, required, allowed) do
    client = S.getprop(f, "client")
    t = Feature.track_node(client, "_rbac", S.jm(["allowed", 0, "denied", 0, "last", nil]))

    key = if allowed, do: "allowed", else: "denied"
    S.setprop(t, key, S.getprop(t, key) + 1)

    op = S.getprop(ctx, "op")
    opname = if op != nil, do: S.getprop(op, "name"), else: nil
    S.setprop(t, "last",
      Feature.clean(ctx, S.jm(["required", required, "allowed", allowed, "op", opname] ++ action_kv(ctx))))
    nil
  end

  defp action_kv(ctx) do
    case H.op_action(ctx) do
      nil -> []
      action -> ["action", action]
    end
  end
end
