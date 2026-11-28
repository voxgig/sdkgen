# ProjectName SDK cache feature
#
# Response caching for safe (read) requests, per client: see the features
# reference for the key, the write invalidation and the Cache-Control rules.

defmodule ProjectName.Feature.Cache do
  alias Voxgig.Struct, as: S
  alias ProjectName.Helpers, as: H
  alias ProjectName.Feature, as: F

  def new do
    f = F.base("cache")
    F.install(f, "init", fn ctx, opts -> init(f, ctx, opts) end)
    f
  end

  def init(f, ctx, options) do
    active = F.init_common(f, ctx, options)

    if active do
      S.setprop(f, "store", S.jm([]))
      S.setprop(f, "secret", :crypto.strong_rand_bytes(32))

      utility = S.getprop(ctx, "utility")
      inner = S.getprop(utility, "fetcher")
      S.setprop(utility, "fetcher", fn fctx, url, fd -> through(f, fctx, url, fd, inner) end)
    end

    nil
  end

  defp through(f, ctx, url, fetchdef, inner) do
    opts = F.opts(f)
    store = S.getprop(f, "store")

    method =
      if S.ismap(fetchdef) and S.getprop(fetchdef, "method") != nil do
        String.upcase(to_string(S.getprop(fetchdef, "method")))
      else
        "GET"
      end

    methods = opt_list(S.getprop(opts, "methods"), ["GET"])

    cond do
      method in methods ->
        lookup(f, opts, store, method, ctx, url, fetchdef, inner)

      method in ["GET", "HEAD"] ->
        inner.(ctx, url, fetchdef)

      true ->
        try do
          inner.(ctx, url, fetchdef)
        after
          invalidate(f, url)
        end
    end
  end

  defp lookup(f, opts, store, method, ctx, url, fetchdef, inner) do
    headers = if S.ismap(fetchdef), do: S.getprop(fetchdef, "headers"), else: nil
    key = method <> " " <> url <> " " <> digest(S.getprop(f, "secret"), headers)
    now = F.now(f)
    hit = S.getprop(store, key)

    if hit != nil and S.getprop(hit, "expiry") > now do
      track(f, "hit")
      {replay(S.getprop(hit, "snapshot")), nil}
    else
      {res, err} = inner.(ctx, url, fetchdef)

      cond do
        # A body that declares another type than JSON passes by, unread.
        err == nil and cacheable(res) and not json?(res) ->
          track(f, "bypass")
          {res, err}

        err == nil and cacheable(res) ->
          snap = snapshot(res)
          ttl = lifetime(S.getprop(snap, "headers"), case S.getprop(opts, "ttl") do nil -> 5000; v -> v end)

          if ttl <= 0 do
            track(f, "bypass")
            {replay(snap), nil}
          else
            S.delprop(store, key)
            evict(f)
            S.setprop(store, key, S.jm(["expiry", now + ttl, "scope", scope(url), "snapshot", snap]))
            track(f, "miss")
            {replay(snap), nil}
          end

        true ->
          track(f, "bypass")
          {res, err}
      end
    end
  end

  defp header_text(nil), do: nil
  defp header_text(v) when is_binary(v), do: v
  defp header_text(v) when is_float(v) and v == trunc(v), do: Integer.to_string(trunc(v))
  defp header_text(v), do: to_string(v)

  defp digest(secret, headers) do
    pairs =
      if S.ismap(headers) do
        H.entries(headers)
        |> Enum.flat_map(fn {k, v} ->
          case header_text(v) do
            nil -> []
            text -> [{String.downcase(to_string(k)), text}]
          end
        end)
        |> Enum.sort()
      else
        []
      end

    text = Enum.map_join(pairs, "", fn {k, v} -> k <> ":" <> v <> "\n" end)
    Base.encode16(:crypto.mac(:hmac, :sha256, secret, text), case: :lower)
  end

  defp invalidate(f, url) do
    store = S.getprop(f, "store")
    path = scope(url)
    collection = parent(path)

    H.entries(store)
    |> Enum.filter(fn {_k, e} ->
      entry = S.getprop(e, "scope")
      under?(entry, path) or entry == collection
    end)
    |> Enum.each(fn {k, _e} -> S.delprop(store, k) end)
  end

  # The configured ttl capped by the response's Cache-Control; zero when the
  # response may not be stored.
  defp lifetime(headers, ttl) do
    control =
      if S.ismap(headers) do
        Enum.find_value(H.entries(headers), "", fn {k, v} ->
          if String.downcase(to_string(k)) == "cache-control", do: String.downcase(header_text(v) || "")
        end)
      else
        ""
      end

    directives = control |> String.split(",") |> Enum.map(&String.trim/1)

    if Enum.any?(directives, &(&1 in ["no-store", "private", "no-cache"])) do
      0
    else
      Enum.reduce(directives, ttl, fn d, life ->
        case Regex.run(~r/^max-age\s*=\s*"?(\d+)"?$/, d) do
          [_, secs] -> min(life, String.to_integer(secs) * 1000)
          _ -> life
        end
      end)
    end
  end

  defp scope(url) do
    [base | _] = String.split(to_string(url), ["?", "#"], parts: 2)
    String.replace(base, ~r{/+$}, "")
  end

  defp parent(scope) do
    root =
      case :binary.match(scope, "://") do
        :nomatch ->
          0

        {at, 3} ->
          case :binary.match(scope, "/", scope: {at + 3, byte_size(scope) - at - 3}) do
            :nomatch -> nil
            {slash, 1} -> slash
          end
      end

    case root do
      nil ->
        scope

      root ->
        cut =
          case :binary.matches(scope, "/") do
            [] -> 0
            found -> found |> List.last() |> elem(0)
          end

        binary_part(scope, 0, max(cut, root))
    end
  end

  defp under?(scope, prefix) do
    scope == prefix or String.starts_with?(scope, prefix <> "/")
  end

  # A body the transport could not read as JSON passes through, for the operation to report.
  defp cacheable(res) do
    if not S.ismap(res) or S.getprop(res, "unreadable") == true do
      false
    else
      status = S.getprop(res, "status")

      if not (is_number(status) and not is_boolean(status)) do
        false
      else
        status >= 200 and status < 300
      end
    end
  end

  defp json?(res) do
    headers = S.getprop(res, "headers")

    type =
      if S.ismap(headers) do
        Enum.find_value(H.entries(headers), "", fn {k, v} ->
          if String.downcase(to_string(k)) == "content-type", do: to_string(v)
        end)
      else
        ""
      end

    type == "" or ProjectName.Utility.json_media?(type)
  end

  defp snapshot(res) do
    jf = S.getprop(res, "json")

    data =
      if S.isfunc(jf) do
        try do
          jf.()
        rescue
          _ -> nil
        end
      else
        nil
      end

    headers = S.jm([])
    raw = S.getprop(res, "headers")

    if S.ismap(raw) do
      Enum.each(H.entries(raw), fn {k, v} ->
        S.setprop(headers, String.downcase(to_string(k)), v)
      end)
    end

    S.jm([
      "status", S.getprop(res, "status"),
      "statusText", S.getprop(res, "statusText"),
      "data", data,
      "headers", headers
    ])
  end

  defp replay(snap) do
    data = S.getprop(snap, "data")
    headers = S.getprop(snap, "headers")
    headers = if headers == nil, do: S.jm([]), else: S.clone(headers)

    S.jm([
      "status", S.getprop(snap, "status"),
      "statusText", S.getprop(snap, "statusText"),
      "body", "not-used",
      "json", fn -> data end,
      "headers", headers
    ])
  end

  defp evict(f) do
    store = S.getprop(f, "store")
    mx = case S.getprop(F.opts(f), "max") do nil -> 256; v -> v end
    do_evict(store, mx)
  end

  defp do_evict(store, mx) do
    if S.size(store) >= mx do
      # keysof is SORTED order; evicting the first key removes the "oldest".
      case S.keysof(store) do
        [] -> nil
        [oldest | _] ->
          S.delprop(store, oldest)
          do_evict(store, mx)
      end
    end
  end

  defp track(f, kind) do
    client = S.getprop(f, "client")
    track = F.track_node(client, "_cache", S.jm(["hit", 0, "miss", 0, "bypass", 0]))
    S.setprop(track, kind, S.getprop(track, kind) + 1)
  end

  # Struct list node -> plain Elixir list; nil/empty -> default.
  defp opt_list(v, default) do
    cond do
      v == nil -> default
      S.islist(v) and S.isempty(v) -> default
      S.islist(v) -> Enum.map(0..(S.size(v) - 1), fn i -> S.getelem(v, i) end)
      true -> default
    end
  end
end
