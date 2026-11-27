# ProjectName SDK binary sources
#
# A binary is the only carrier of bytes and of text here, so file content a
# caller hands the SDK is marked by its own struct, built with bytes/2. A
# string is content, sent as it is: nothing here reads a path.

defmodule ProjectName.BinarySource do
  defstruct kind: "bytes", data: "", name: nil, type: nil

  def size(%__MODULE__{data: data}), do: byte_size(data)

  # A source serialised anywhere is described, never copied.
  def to_data(%__MODULE__{} = src) do
    desc = Voxgig.Struct.jm(["binary$", "bytes", "size", size(src)])
    if src.type != nil, do: Voxgig.Struct.setprop(desc, "type", src.type)
    desc
  end
end

defimpl Inspect, for: ProjectName.BinarySource do
  def inspect(src, _opts) do
    "#ProjectName.BinarySource<" <> Voxgig.Struct.jsonify(ProjectName.BinarySource.to_data(src),
      Voxgig.Struct.jm(["indent", 0])) <> ">"
  end
end

defimpl String.Chars, for: ProjectName.BinarySource do
  def to_string(src), do: inspect(src)
end

defmodule ProjectName.Binary do
  alias Voxgig.Struct, as: S
  alias ProjectName.Helpers, as: H
  alias ProjectName.{BinarySource, Context}

  @maxdepth 32

  @raw_body "$body"

  # The one source core builds: `data` is bytes or a string, `opts` a keyword
  # list or map with `name` and `type`; an empty type is no type.
  def bytes(data, opts \\ []) do
    name = opt(opts, :name)
    type = opt(opts, :type)

    %BinarySource{
      data: content(data),
      name: if(is_binary(name), do: name, else: nil),
      type: if(is_binary(type) and type != "", do: type, else: nil)
    }
  end

  defp opt(opts, key) when is_list(opts), do: Keyword.get(opts, key)

  defp opt(opts, key) do
    cond do
      S.ismap(opts) -> S.getprop(opts, Atom.to_string(key))
      is_map(opts) -> Map.get(opts, key, Map.get(opts, Atom.to_string(key)))
      true -> nil
    end
  end

  defp content(data) when is_binary(data), do: data
  defp content(data) when is_list(data), do: IO.iodata_to_binary(data)
  defp content(data), do: item_text(data)

  def source?(v), do: is_struct(v, BinarySource)

  # Streams move only through the binary feature.
  def stream?(v) do
    is_struct(v, Stream) or is_struct(v, File.Stream) or is_struct(v, IO.Stream) or
      is_function(v, 2)
  end

  # The path of the first source in a value, or nil.
  defp source_at(value, path, depth, seen) do
    cond do
      source?(value) ->
        path

      depth >= @maxdepth or value in seen ->
        nil

      S.ismap(value) or S.islist(value) ->
        walk(H.entries(value), path, depth, [value | seen])

      is_list(value) ->
        walk(Enum.with_index(value, fn v, i -> {i, v} end), path, depth, [value | seen])

      is_map(value) and not is_struct(value) ->
        walk(Enum.sort_by(value, fn {k, _} -> to_string(k) end), path, depth, [value | seen])

      true ->
        nil
    end
  end

  defp walk(pairs, path, depth, seen) do
    Enum.find_value(pairs, fn {k, v} ->
      key = to_string(k)
      source_at(v, if(path == "", do: key, else: path <> "." <> key), depth + 1, seen)
    end)
  end

  # The data keys whose values are file content: a multipart or form body's
  # binary fields, and the whole of a raw body.
  def binary_names(point) do
    body = S.getprop(point, "body")

    case S.getprop(body, "kind") do
      "raw" ->
        [@raw_body]

      kind when kind in ["multipart", "form"] ->
        for f <- items(S.getprop(body, "fields")),
            S.getprop(f, "binary") == true and is_binary(S.getprop(f, "name")),
            do: S.getprop(f, "name")

      _ ->
        []
    end
  end

  defp items(list), do: if(S.islist(list), do: Enum.map(H.entries(list), &elem(&1, 1)), else: [])

  # Moves the values of binary fields out of the request data, before a hook,
  # a transform, validation or clean reads it. A source anywhere else is
  # refused. Nil, or the error.
  def lift_sources(ctx) do
    if S.getprop(ctx, "sources") != nil do
      nil
    else
      names = binary_names(S.getprop(ctx, "point"))
      reqdata = S.getprop(ctx, "reqdata")
      present = if S.ismap(reqdata), do: Enum.filter(names, &S.haskey(reqdata, &1)), else: []

      reqdata =
        if present == [] do
          reqdata
        else
          copy = S.jm([])

          Enum.each(H.entries(reqdata), fn {k, v} ->
            if k not in present, do: S.setprop(copy, k, v)
          end)

          copy
        end

      lifted = Map.new(present, &{&1, S.getprop(S.getprop(ctx, "reqdata"), &1)})
      stray = source_at(reqdata, "", 0, []) || source_at(S.getprop(ctx, "reqmatch"), "", 0, [])

      if stray != nil do
        Context.make_error(ctx, "binary_source_refused",
          "A binary source was passed in \"" <> stray <>
            "\", which is not a field the operation declares binary.")
      else
        S.setprop(ctx, "reqdata", reqdata)
        S.setprop(ctx, "sources", lifted)
        nil
      end
    end
  end

  # A response the model declares to be bytes is read only through the
  # entity's binary handle, never into its data.
  def bytes_refused(ctx) do
    point = S.getprop(ctx, "point")
    response = S.getprop(point, "response")
    transfer = S.getprop(S.getprop(ctx, "ctrl"), "transfer")

    if S.getprop(response, "kind") != "raw" or S.getprop(response, "binary") != true or
         transfer != nil do
      nil
    else
      op = S.getprop(ctx, "op")
      action = S.getprop(H.to_map(S.getprop(point, "select")), "$action")
      mod = S.getprop(S.getprop(ctx, "entity"), "_module")
      slot = if action == nil, do: "", else: ", \"" <> to_string(action) <> "\""
      owner = if mod == nil, do: "Entity", else: inspect(mod)

      Context.make_error(ctx, "binary_sink_required",
        "Operation \"" <> to_string(S.getprop(op, "name")) <> "\" on entity \"" <>
          to_string(S.getprop(op, "entity")) <>
          "\" answers bytes, which never enter the entity's data: read them with " <>
          owner <> ".binary(entity" <> slot <> ") |> ProjectName.BinaryHandle.bytes().")
    end
  end

  # A plain value as the text of a form pair or a multipart part.
  def item_text(v) when is_binary(v), do: v
  def item_text(v) when is_boolean(v), do: to_string(v)
  def item_text(v) when is_integer(v), do: Integer.to_string(v)

  def item_text(v) when is_float(v) do
    if v == trunc(v) and abs(v) < 1.0e21,
      do: Integer.to_string(trunc(v)),
      else: :erlang.float_to_binary(v, [:short])
  end

  def item_text(v) when is_atom(v), do: Atom.to_string(v)

  def item_text(v) do
    if S.isnode(v), do: S.jsonify(v, S.jm(["indent", 0])), else: S.jsonify(H.deep(v), S.jm(["indent", 0]))
  end

  defp list_of(v) do
    cond do
      S.islist(v) -> Enum.map(H.entries(v), &elem(&1, 1))
      is_list(v) -> v
      true -> nil
    end
  end

  defp pairs_of(data) do
    cond do
      S.ismap(data) -> H.entries(data)
      is_map(data) and not is_struct(data) -> Enum.map(data, fn {k, v} -> {to_string(k), v} end)
      true -> []
    end
  end

  # The values a form or multipart body carries, in wire order: the fields
  # the model declares, in its order, then any other key of the data, in code
  # point order. A list repeats its field per item, or is one value joined by
  # the field's `join`; an absent or nil value sends nothing.
  def body_items(body, data, lifted) do
    fields = Enum.filter(items(S.getprop(body, "fields")), &is_binary(S.getprop(&1, "name")))
    declared = Enum.map(fields, &S.getprop(&1, "name"))
    plain = Map.new(pairs_of(data))

    names =
      Enum.filter(declared, &(Map.has_key?(plain, &1) or Map.has_key?(lifted, &1))) ++
        Enum.sort(Enum.reject(Map.keys(plain), &(&1 in declared)))

    Enum.flat_map(names, fn name ->
      field = Enum.find(fields, &(S.getprop(&1, "name") == name))
      value = if Map.has_key?(lifted, name), do: Map.get(lifted, name), else: Map.get(plain, name)
      file = S.getprop(field, "binary") == true
      join = S.getprop(field, "join")
      item = fn v -> %{name: name, field: field, value: v, binary: file} end

      case list_of(value) do
        _ when value == nil ->
          []

        nil ->
          [item.(value)]

        list ->
          present = Enum.reject(list, &is_nil/1)

          if not file and is_binary(join),
            do: [item.(Enum.map_join(present, join, &item_text/1))],
            else: Enum.map(present, item)
      end
    end)
  end
end
