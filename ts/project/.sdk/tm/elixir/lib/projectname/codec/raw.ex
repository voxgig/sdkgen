# ProjectName SDK raw codec: a success body read whole, to the maxBuffer bound.

defmodule ProjectName.Codec.Raw do
  alias Voxgig.Struct, as: S
  alias ProjectName.Context

  @default_max 16_777_216

  def max_buffer(ctx) do
    [S.getprop(S.getprop(ctx, "options"), "maxBuffer"), S.getprop(ProjectName.Schema.optspec(), "maxBuffer")]
    |> Enum.find(@default_max, &(is_number(&1) and &1 >= 0))
    |> trunc()
  end

  defp too_large(ctx, code, max, declared) do
    Context.make_error(ctx, code, "response: body " <>
      if(declared == nil, do: "is longer than", else: "of #{declared} bytes exceeds") <>
      " maxBuffer (#{max} bytes)")
  end

  defp declared_length(headers) do
    found =
      Enum.find_value(ProjectName.Helpers.entries(headers), fn {k, v} ->
        if String.downcase(to_string(k)) == "content-length", do: String.trim(to_string(v))
      end)

    if is_binary(found) and Regex.match?(~r/^\d+$/, found), do: String.to_integer(found), else: nil
  end

  # The transport's bytes where it kept them apart from the text it decoded;
  # a body that arrives in chunks is an enumerable of binaries.
  defp body_of(response) do
    read = S.getprop(response, "bytes_func")
    if is_function(read, 0), do: read.(), else: S.getprop(response, "body")
  end

  # {:ok, bytes} or {:error, err}: refused by the declared length before a
  # byte is pulled, else by the count as it arrives.
  def read_bounded(ctx, response, max, code) do
    declared = declared_length(S.getprop(response, "headers"))

    if declared != nil and declared > max do
      {:error, too_large(ctx, code, max, declared)}
    else
      body = body_of(response)
      chunks = if is_binary(body) or body == nil, do: [body || ""], else: body

      Enum.reduce_while(chunks, {:ok, [], 0}, fn chunk, {:ok, acc, count} ->
        bytes = if is_binary(chunk), do: chunk, else: to_string(chunk)
        count = count + byte_size(bytes)

        if count > max,
          do: {:halt, {:error, too_large(ctx, code, max, nil)}},
          else: {:cont, {:ok, [acc, bytes], count}}
      end)
      |> case do
        {:ok, acc, _count} -> {:ok, IO.iodata_to_binary(acc)}
        err -> err
      end
    end
  end

  # Text into the record under `$body`; bytes only into a binary handle's
  # read, never into the record.
  def read(ctx) do
    response = S.getprop(ctx, "response")
    result = S.getprop(ctx, "result")
    transfer = S.getprop(S.getprop(ctx, "ctrl"), "transfer")
    max = max_buffer(ctx)

    if S.getprop(S.getprop(S.getprop(ctx, "point"), "response"), "binary") == true do
      S.setprop(result, "body", nil)

      if S.getprop(transfer, "direction") == "read" do
        case read_bounded(ctx, response, max, "binary_too_large") do
          {:ok, bytes} -> S.setprop(transfer, "bytes", bytes)
          {:error, err} -> S.setprop(result, "err", err)
        end
      end
    else
      case read_bounded(ctx, response, max, "response_too_large") do
        {:ok, bytes} -> S.setprop(result, "body", S.jm(["$body", ProjectName.Utility.lossy_text(bytes)]))
        {:error, err} -> S.setprop(result, "err", err)
      end
    end

    result
  end
end
