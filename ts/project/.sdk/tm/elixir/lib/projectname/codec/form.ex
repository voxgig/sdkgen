# ProjectName SDK form codec: application/x-www-form-urlencoded.

defmodule ProjectName.Codec.Form do
  alias Voxgig.Struct, as: S
  alias ProjectName.{Binary, BinarySource, Context}

  @form_media "application/x-www-form-urlencoded"

  # Alphanumerics and `*-._` as they are, a space as `+`, every other byte as
  # %HH.
  def escape(bytes) do
    for <<byte <- bytes>>, into: "" do
      cond do
        byte in ?0..?9 or byte in ?A..?Z or byte in ?a..?z or byte in [?*, ?-, ?., ?_] ->
          <<byte>>

        byte == ?\s ->
          "+"

        true ->
          "%" <> String.upcase(Base.encode16(<<byte>>))
      end
    end
  end

  defp value(ctx, name, v) do
    content = if is_struct(v, BinarySource), do: v.data, else: v

    if Binary.stream?(content) do
      Context.make_error(ctx, "binary_source_refused", "The form field \"" <> name <>
        "\" holds a Blob or a stream, which a form body cannot carry: pass its bytes.")
    else
      Binary.item_text(content)
    end
  end

  # %{"type", "body"}, or the error.
  def encode(ctx, data, lifted) do
    body = S.getprop(S.getprop(ctx, "point"), "body")

    pairs =
      Enum.reduce_while(Binary.body_items(body, data, lifted), [], fn item, acc ->
        case value(ctx, item.name, item.value) do
          %ProjectName.Error{} = err -> {:halt, err}
          text -> {:cont, [escape(item.name) <> "=" <> escape(text) | acc]}
        end
      end)

    media = S.getprop(body, "media")

    case pairs do
      %ProjectName.Error{} = err ->
        err

      _ ->
        %{
          "type" => if(is_binary(media) and media != "", do: media, else: @form_media),
          "body" => pairs |> Enum.reverse() |> Enum.join("&")
        }
    end
  end
end
