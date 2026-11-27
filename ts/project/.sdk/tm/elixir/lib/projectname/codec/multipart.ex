# ProjectName SDK multipart codec: multipart/form-data.

defmodule ProjectName.Codec.Multipart do
  alias Voxgig.Struct, as: S
  alias ProjectName.{Binary, BinarySource, Context}

  @multipart_media "multipart/form-data"
  @octet_media "application/octet-stream"
  @crlf "\r\n"

  def boundary(_ctx), do: Base.encode16(:crypto.strong_rand_bytes(16), case: :lower)

  # Inside a quoted header parameter nothing may end the quote or the line.
  def quoted(text) do
    text
    |> String.replace("\\", "%5C")
    |> String.replace("\"", "%22")
    |> String.replace("\r", "%0D")
    |> String.replace("\n", "%0A")
  end

  # A local path never leaves: only its last segment, and nothing for an
  # empty one.
  def base_name(name) when is_binary(name) do
    case name |> String.split(["/", "\\"]) |> List.last() do
      "" -> nil
      base -> base
    end
  end

  def base_name(_name), do: nil

  defp file_part(ctx, name, field, value) do
    {content, filename, type} =
      if is_struct(value, BinarySource),
        do: {value.data, base_name(value.name), value.type},
        else: {value, nil, nil}

    if Binary.stream?(content) do
      Context.make_error(ctx, "binary_feature_inactive", "The multipart field \"" <> name <>
        "\" holds a stream, which needs the binary feature: pass bytes, a Blob or a source.")
    else
      %{
        name: name,
        filename: filename,
        type: type || S.getprop(field, "media") || @octet_media,
        content: Binary.item_text(content)
      }
    end
  end

  defp text_part(name, field, value),
    do: %{name: name, filename: nil, type: S.getprop(field, "media"), content: Binary.item_text(value)}

  # %{"type", "body"}, or the error. The body is the bytes of every part.
  def encode(ctx, data, lifted) do
    body = S.getprop(S.getprop(ctx, "point"), "body")
    b = S.getprop(S.getprop(ctx, "utility"), "multipart_boundary").(ctx)

    parts =
      Enum.reduce_while(Binary.body_items(body, data, lifted), [], fn item, acc ->
        part =
          if item.binary,
            do: file_part(ctx, item.name, item.field, item.value),
            else: text_part(item.name, item.field, item.value)

        cond do
          is_exception(part) ->
            {:halt, part}

          is_binary(part.type) and String.contains?(part.type, ["\r", "\n"]) ->
            {:halt,
             Context.make_error(ctx, "binary_source_refused",
               "The media type of the multipart field \"" <> item.name <> "\" contains a line break.")}

          true ->
            head =
              "--" <> b <> @crlf <> "Content-Disposition: form-data; name=\"" <> quoted(part.name) <> "\"" <>
                if(part.filename == nil, do: "", else: "; filename=\"" <> quoted(part.filename) <> "\"") <>
                @crlf <> if(part.type == nil, do: "", else: "Content-Type: " <> part.type <> @crlf) <> @crlf

            {:cont, [acc, head, part.content, @crlf]}
        end
      end)

    if is_exception(parts) do
      parts
    else
      media = S.getprop(body, "media")
      declared = if is_binary(media), do: media |> String.split(";") |> hd() |> String.trim(), else: ""

      %{
        "type" => if(declared == "", do: @multipart_media, else: declared) <> "; boundary=" <> b,
        "body" => IO.iodata_to_binary([parts, "--", b, "--", @crlf])
      }
    end
  end
end
