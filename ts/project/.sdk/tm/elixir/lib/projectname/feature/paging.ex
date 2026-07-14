# ProjectName SDK paging feature
#
# Pagination support for list operations. On the way out (PreRequest) it
# stamps page/limit (or a cursor) into the request query; on the way back
# (PreResult) it reads the server's pagination signals — a `Link: rel="next"`
# header, `X-Page`/`X-Next-Page`/`X-Total-Count` headers, or
# `next`/`cursor`/`nextCursor`/`hasMore` fields in the body — and records them
# on `ctx.result.paging`. A per-call cursor/page supplied via ctrl paging
# takes priority (used by auto-iteration). Parameter names
# (`pageParam`/`limitParam`/`cursorParam`), `startPage` and page size
# (`limit`) are configurable.

defmodule ProjectName.Feature.Paging do
  alias Voxgig.Struct, as: S
  alias ProjectName.Feature, as: F

  @next_re ~r/<([^>]+)>\s*;\s*rel="?next"?/i

  def new do
    f = F.base("paging")
    F.install(f, "init", fn ctx, opts -> init(f, ctx, opts) end)
    F.install(f, "PreRequest", fn ctx -> pre_request(f, ctx) end)
    F.install(f, "PreResult", fn ctx -> pre_result(f, ctx) end)
    f
  end

  def init(f, ctx, options) do
    F.init_common(f, ctx, options)
    nil
  end

  defp pre_request(f, ctx) do
    if F.active?(f) and is_list_op(f, ctx) do
      spec = S.getprop(ctx, "spec")

      if spec != nil do
        query =
          case S.getprop(spec, "query") do
            nil ->
              q = S.jm([])
              S.setprop(spec, "query", q)
              q

            q ->
              q
          end

        opts = F.opts(f)
        page_param = por(S.getprop(opts, "pageParam"), "page")
        limit_param = por(S.getprop(opts, "limitParam"), "limit")
        cursor_param = por(S.getprop(opts, "cursorParam"), "cursor")

        # A per-call cursor/page from ctrl takes priority (auto-iteration).
        ctrl = S.getprop(ctx, "ctrl")
        paging = if ctrl != nil, do: S.getprop(ctrl, "paging"), else: nil
        paging = if S.ismap(paging), do: paging, else: S.jm([])

        cond do
          S.getprop(paging, "cursor") != nil ->
            S.setprop(query, cursor_param, S.getprop(paging, "cursor"))

          S.getprop(query, page_param) == nil ->
            page = S.getprop(paging, "page")
            page = if page == nil, do: por(S.getprop(opts, "startPage"), 1), else: page
            S.setprop(query, page_param, page)

          true ->
            nil
        end

        limit = S.getprop(opts, "limit")

        if limit != nil and S.getprop(query, limit_param) == nil do
          S.setprop(query, limit_param, limit)
        end
      end
    end

    nil
  end

  defp pre_result(f, ctx) do
    if F.active?(f) and is_list_op(f, ctx) do
      result = S.getprop(ctx, "result")

      if result != nil do
        headers = S.getprop(result, "headers")
        headers = if headers == nil, do: S.jm([]), else: headers
        body = S.getprop(result, "body")

        page = num(F.header_get(headers, "x-page"))
        total_count = num(F.header_get(headers, "x-total-count"))
        next_page = num(F.header_get(headers, "x-next-page"))

        # Link: <...>; rel="next"
        link = F.header_get(headers, "link")

        next_from_link =
          if link != nil do
            case Regex.run(@next_re, to_string(link)) do
              [_, url] -> url
              _ -> nil
            end
          else
            nil
          end

        {next_val, cursor_val, has_more} =
          if S.ismap(body) do
            n =
              case S.getprop(body, "next") do
                nil -> next_from_link
                bnext -> por(next_from_link, bnext)
              end

            c =
              cond do
                S.getprop(body, "nextCursor") != nil -> S.getprop(body, "nextCursor")
                S.getprop(body, "cursor") != nil -> S.getprop(body, "cursor")
                true -> nil
              end

            hm =
              case S.getprop(body, "hasMore") do
                v when is_boolean(v) -> v
                _ -> false
              end

            {n, c, hm}
          else
            {next_from_link, nil, false}
          end

        has_more =
          has_more or next_val != nil or cursor_val != nil or next_page != nil

        paging =
          S.jm([
            "page", page,
            "totalCount", total_count,
            "nextPage", next_page,
            "next", next_val,
            "cursor", cursor_val,
            "hasMore", has_more
          ])

        S.setprop(result, "paging", paging)
        S.setprop(S.getprop(f, "client"), "_paging", S.jm(["last", paging]))
      end
    end

    nil
  end

  defp is_list_op(f, ctx) do
    ops = opt_list(S.getprop(F.opts(f), "ops"), ["list"])
    op = S.getprop(ctx, "op")
    opname = if op != nil, do: S.getprop(op, "name"), else: nil
    opname in ops
  end

  # Parse a numeric header value: int when integral, float otherwise, nil when
  # not a full number (mirrors Python float()/int() with ValueError -> None).
  defp num(val) do
    if val == nil do
      nil
    else
      s = String.trim(to_string(val))

      case Float.parse(s) do
        {n, ""} -> if n == trunc(n), do: trunc(n), else: n
        _ -> nil
      end
    end
  end

  # Python `v or default`: falsy = nil, false, 0, 0.0, "".
  defp por(v, d) do
    if v == nil or v == false or v == 0 or v == "", do: d, else: v
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
