# ProjectName SDK binary handle: an entity's named bytes.
#
# Each call is one run of the entity's own operation on the slot's point; in
# core only whole, in-memory bodies move. A slot is the action whose points
# move its bytes ("" for the entity's own) and the operations that read and
# write them: %{"action", "read", "write"}.

defmodule ProjectName.BinaryHandle do
  alias Voxgig.Struct, as: S
  alias ProjectName.Context

  defstruct [:entity, :slot, :def]

  def new(entity, slots, slot \\ nil) do
    slot = if slot == nil, do: "", else: to_string(slot)
    %__MODULE__{entity: entity, slot: slot, def: Map.get(slots, slot)}
  end

  def name(%__MODULE__{slot: slot}), do: slot

  # The whole body, within maxBuffer.
  def bytes(%__MODULE__{} = h, opts \\ nil, ctrl \\ nil) do
    if range(opts) != nil, do: raise(inactive(h, "read a range"))
    d = direction(h, "read")
    transfer = S.jm(["slot", h.slot, "direction", "read"])
    call(h, d["read"], select(d), ctrl, transfer)
    S.getprop(transfer, "bytes") || ""
  end

  # Sends in-memory content as the slot's body; resolves to the entity.
  def put(%__MODULE__{} = h, source, ctrl \\ nil) do
    d = direction(h, "write")
    transfer = S.jm(["slot", h.slot, "direction", "write"])
    reqdata = select(d)
    S.setprop(reqdata, "$body", source)
    call(h, d["write"], reqdata, ctrl, transfer)
    h.entity
  end

  def save(%__MODULE__{} = h, _a \\ nil, _b \\ nil), do: raise(inactive(h, "save"))
  def stream(%__MODULE__{} = h, _a \\ nil, _b \\ nil), do: raise(inactive(h, "stream"))
  def open(%__MODULE__{} = h, _a \\ nil, _b \\ nil), do: raise(inactive(h, "open"))

  defp range(opts) when is_list(opts), do: Keyword.get(opts, :range)
  defp range(opts) when is_map(opts) and not is_struct(opts), do: Map.get(opts, :range, Map.get(opts, "range"))
  defp range(opts), do: if(S.ismap(opts), do: S.getprop(opts, "range"), else: nil)

  defp select(d), do: if(d["action"] == "", do: S.jm([]), else: S.jm(["$action", d["action"]]))

  # The caller's control, with the transfer beside its own keys.
  defp call(h, opname, arg, ctrl, transfer) do
    out = S.jm([])

    cond do
      S.ismap(ctrl) -> Enum.each(ProjectName.Helpers.entries(ctrl), fn {k, v} -> S.setprop(out, k, v) end)
      is_map(ctrl) -> Enum.each(ctrl, fn {k, v} -> S.setprop(out, to_string(k), v) end)
      true -> :ok
    end

    S.setprop(out, "transfer", transfer)
    mod = S.getprop(h.entity, "_module")
    apply(mod, String.to_existing_atom(opname), [h.entity, arg, out])
  end

  defp direction(h, way) do
    cond do
      h.def == nil ->
        raise error(h, "binary_slot_unknown", "Entity \"" <> entname(h) <> "\" has no binary slot \"" <> h.slot <> "\".")

      h.def[way] == nil ->
        raise error(h, "binary_slot_direction", "The binary slot \"" <> h.slot <> "\" of entity \"" <>
          entname(h) <> "\" cannot be " <> if(way == "read", do: "read", else: "written") <> ".")

      true ->
        h.def
    end
  end

  defp inactive(h, what) do
    error(h, "binary_feature_inactive", "The binary slot \"" <> h.slot <> "\" of entity \"" <> entname(h) <>
      "\" cannot " <> what <> " without the binary feature; in core it answers bytes() and put().")
  end

  defp entname(h), do: to_string(S.getprop(h.entity, "_name"))

  defp error(h, code, msg), do: Context.make_error(S.getprop(h.entity, "_entctx"), code, msg)
end
