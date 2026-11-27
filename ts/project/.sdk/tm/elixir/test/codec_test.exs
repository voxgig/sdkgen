# Every form, multipart and raw point this SDK has, driven through a real
# entity operation against a local listener that decodes what arrives. The
# cases come from the client's own config, so no case names an entity.

defmodule ProjectName.CodecTest do
  use ExUnit.Case, async: false

  alias Voxgig.Struct, as: S
  alias ProjectName.{Binary, BinaryHandle}

  # Each case: {label, kind, entity, opname, action}, read from the config as
  # this file compiles; the config's nodes do not outlive the compiler.
  @cases (fn ->
            alias ProjectName.Helpers, as: H
            ents = fn node -> if S.isnode(node), do: H.entries(node), else: [] end
            sorted = fn node -> Enum.sort_by(ents.(node), &elem(&1, 0)) end
            writes = ["create", "update", "patch"]

            for {ename, ent} <- sorted.(S.getprop(ProjectName.Config.make_config(), "entity")),
                {opname, op} <- sorted.(S.getprop(ent, "op")),
                {_, point} <- ents.(S.getprop(op, "points")),
                {kind, side} <- [encoded: "body", rawsend: "body", rawread: "response"],
                code <- [S.getprop(S.getprop(point, side), "kind")],
                (kind == :encoded and code in ["form", "multipart"] and opname in writes) or
                  (kind == :rawsend and code == "raw" and opname in writes) or
                  (kind == :rawread and code == "raw" and opname == "load") do
              action = S.getprop(S.getprop(point, "select"), "$action")
              label = ename <> "." <> opname <> if(action == nil, do: "", else: ":" <> action)
              {label, kind, ename, opname, action}
            end
          end).()

  setup_all do
    {:ok, net} = Agent.start(fn -> %{answer: %{}, arrivals: [], ran: 0, passed: 0} end)
    {:ok, listen} = :gen_tcp.listen(0, [:binary, active: false, reuseaddr: true, ip: {127, 0, 0, 1}])
    {:ok, port} = :inet.port(listen)
    spawn(fn -> serve(listen, net) end)

    on_exit(fn ->
      %{ran: ran, passed: passed} = Agent.get(net, & &1)
      IO.puts("codec: ran #{ran} case(s), #{ran - passed} failed")
      :gen_tcp.close(listen)
      Agent.stop(net)
    end)

    %{net: net, base: "http://127.0.0.1:#{port}"}
  end

  test "this SDK has a point to drive" do
    assert @cases != [], "no form, multipart or raw point was found"
  end

  for {label, kind, ename, opname, action} <- @cases do
    test "#{label} #{kind}", %{net: net, base: base} do
      Agent.update(net, &%{&1 | answer: %{}, arrivals: [], ran: &1.ran + 1})

      run(unquote(kind), unquote(ename), unquote(opname), unquote(action), unquote(label), net, base)
      Agent.update(net, &%{&1 | passed: &1.passed + 1})
    end
  end

  # ---- the cases -----------------------------------------------------------

  defp entries(node), do: if(S.isnode(node), do: ProjectName.Helpers.entries(node), else: [])

  defp point_of(ename, opname, action) do
    S.getpath(ProjectName.Config.shared_config(), "entity." <> ename <> ".op." <> opname <> ".points")
    |> entries()
    |> Enum.map(&elem(&1, 1))
    |> Enum.find(&(S.getprop(S.getprop(&1, "select"), "$action") == action))
  end

  defp entity(base, ename) do
    client = ProjectName.new(S.jm(["base", base]))
    Code.ensure_loaded(ProjectName)
    accessor = String.to_atom(ename)
    assert function_exported?(ProjectName, accessor, 2), "no accessor for " <> ename
    ent = apply(ProjectName, accessor, [client, nil])
    {ent, S.getprop(ent, "_module")}
  end

  # A value for each path parameter a point names.
  defp params(point) do
    for {_, part} <- entries(S.getprop(point, "parts")),
        m = Regex.run(~r/^\{(.+)\}$/, to_string(part)),
        m != nil,
        do: {Enum.at(m, 1), "p1"}
  end

  defp jmap(pairs), do: S.jm(Enum.flat_map(pairs, fn {k, v} -> [k, v] end))

  defp select(nil), do: []
  defp select(action), do: [{"$action", action}]

  defp content(name), do: "file:" <> name <> <<0, 0xFF>> <> "\r\n--"

  defp handle(mod, ent, nil), do: apply(mod, :binary, [ent])
  defp handle(mod, ent, slot), do: apply(mod, :binary, [ent, slot])

  # The data a form or multipart point is sent, and the parts it must arrive as.
  defp plan(body) do
    form = S.getprop(body, "kind") == "form"

    entries(S.getprop(body, "fields"))
    |> Enum.map(&elem(&1, 1))
    |> Enum.reduce({[], []}, fn field, {data, expect} ->
      name = S.getprop(field, "name")

      cond do
        S.getprop(field, "binary") == true ->
          type = if form, do: nil, else: S.getprop(field, "media") || "application/octet-stream"
          src = Binary.bytes(content(name), name: "/local/dir/" <> name <> ".bin", type: type)

          {data ++ [{name, src}],
           expect ++
             [if(form, do: {name, content(name)}, else: {name, content(name), name <> ".bin", type})]}

        S.getprop(field, "list") == true ->
          {data ++ [{name, S.jt(["a", "b c"])}], expect ++ [{name, "a"}, {name, "b c"}]}

        is_binary(S.getprop(field, "join")) ->
          {data ++ [{name, S.jt(["a", "b"])}], expect ++ [{name, "a" <> S.getprop(field, "join") <> "b"}]}

        true ->
          {data ++ [{name, "v\"" <> name <> "\r\n"}], expect ++ [{name, "v\"" <> name <> "\r\n"}]}
      end
    end)
  end

  defp run(:encoded, ename, opname, action, _label, net, base) do
    point = point_of(ename, opname, action)
    rb = S.getprop(point, "body")
    {data, expect} = plan(rb)
    answer(net, "application/json", ~s({"id":"p1"}))
    {ent, mod} = entity(base, ename)
    apply(mod, String.to_atom(opname), [ent, jmap(params(point) ++ select(action) ++ data)])
    arrived = arrived(net)
    names = Enum.map(expect, &elem(&1, 0))

    got =
      if S.getprop(rb, "kind") == "form" do
        assert header(arrived, "content-type") == S.getprop(rb, "media")
        URI.query_decoder(arrived.body) |> Enum.to_list()
      else
        multipart(arrived)
      end

    assert Enum.filter(got, &(elem(&1, 0) in names)) == expect
  end

  defp run(:rawsend, ename, opname, action, label, net, base) do
    point = point_of(ename, opname, action)
    rb = S.getprop(point, "body")
    answer(net, "application/json", ~s({"id":"p1"}))
    {ent, mod} = entity(base, ename)
    apply(mod, :data_set, [ent, jmap(params(point))])
    apply(mod, :match_set, [ent, jmap(params(point))])

    if S.getprop(rb, "binary") == true do
      got = BinaryHandle.put(handle(mod, ent, action), Binary.bytes(content(label), type: S.getprop(rb, "media")))
      assert got == ent
      assert arrived(net).body == content(label)
    else
      text = "text \"" <> label <> "\"\n"
      apply(mod, String.to_atom(opname), [ent, jmap(select(action) ++ [{"$body", text}])])
      assert arrived(net).body == text
    end

    assert header(arrived(net), "content-type") == S.getprop(rb, "media")
  end

  defp run(:rawread, ename, opname, action, label, net, base) do
    point = point_of(ename, opname, action)
    rs = S.getprop(point, "response")
    {ent, mod} = entity(base, ename)
    apply(mod, :data_set, [ent, jmap(params(point))])
    apply(mod, :match_set, [ent, jmap(params(point))])
    reqmatch = jmap(params(point) ++ select(action))

    if S.getprop(rs, "binary") == true do
      answer(net, S.getprop(rs, "media"), content(label))
      assert BinaryHandle.bytes(handle(mod, ent, action)) == content(label)
      err = assert_raise ProjectName.Error, fn -> apply(mod, String.to_atom(opname), [ent, reqmatch]) end
      assert err.code == "binary_sink_required"
    else
      answer(net, S.getprop(rs, "media"), "café " <> label)
      got = apply(mod, String.to_atom(opname), [ent, reqmatch])
      assert got == ent
      assert S.getprop(apply(mod, :data_get, [ent]), "$body") == "café " <> label
    end
  end

  # ---- decoding --------------------------------------------------------------

  defp multipart(arrived) do
    type = header(arrived, "content-type")
    [_, boundary] = Regex.run(~r/boundary=([^;]+)/, type) || flunk("no boundary in " <> type)
    assert String.ends_with?(arrived.body, "--" <> boundary <> "--\r\n"), "the body does not close"

    arrived.body
    |> String.split("--" <> boundary)
    |> Enum.slice(1..-2)
    |> Enum.map(fn chunk ->
      [head, body] = :binary.split(chunk, "\r\n\r\n")
      head = binary_part(head, 2, byte_size(head) - 2)
      body = binary_part(body, 0, byte_size(body) - 2)

      disp =
        Regex.run(~r/^Content-Disposition: form-data; name="([^"]*)"(?:; filename="([^"]*)")?\r?$/m, head) ||
          flunk("a part without a disposition: " <> inspect(head))

      ctype = case Regex.run(~r/^Content-Type: ([^\r\n]*)/m, head), do: (nil -> nil; [_, t] -> t)

      case disp do
        [_, name] -> {name, body}
        [_, name, filename] -> {name, body, filename, ctype}
      end
    end)
  end

  defp header(arrived, name), do: Map.get(arrived.headers, name)

  # ---- the listener ----------------------------------------------------------

  defp answer(net, type, body), do: Agent.update(net, &%{&1 | answer: %{type: type, body: body}})

  defp arrived(net) do
    case Agent.get(net, & &1.arrivals) do
      [] -> flunk("nothing arrived")
      list -> List.last(list)
    end
  end

  defp serve(listen, net) do
    with {:ok, sock} <- :gen_tcp.accept(listen) do
      [head | rest] = :binary.split(read_head(sock, ""), "\r\n\r\n")
      [request | lines] = String.split(head, "\r\n")
      [method, path | _] = String.split(request, " ") ++ ["", ""]

      headers =
        for line <- lines, [k, v] <- [String.split(line, ":", parts: 2)], into: %{},
          do: {String.downcase(k), String.trim(v)}

      body = read_body(Enum.join(rest), sock, String.to_integer(Map.get(headers, "content-length", "0")))

      answer =
        Agent.get_and_update(net, fn st ->
          {st.answer, %{st | arrivals: st.arrivals ++ [%{method: method, path: path, headers: headers, body: body}]}}
        end)

      out = Map.get(answer, :body, "")

      :gen_tcp.send(sock, "HTTP/1.1 200 OK\r\nContent-Type: #{Map.get(answer, :type, "application/json")}\r\n" <>
        "Content-Length: #{byte_size(out)}\r\nConnection: close\r\n\r\n" <> out)

      :gen_tcp.close(sock)
      serve(listen, net)
    end
  end

  defp read_head(sock, acc) do
    if String.contains?(acc, "\r\n\r\n") do
      acc
    else
      case :gen_tcp.recv(sock, 0, 5000) do
        {:ok, data} -> read_head(sock, acc <> data)
        _ -> acc
      end
    end
  end

  defp read_body(got, sock, length) do
    if byte_size(got) >= length do
      got
    else
      case :gen_tcp.recv(sock, 0, 5000) do
        {:ok, data} -> read_body(got <> data, sock, length)
        _ -> got
      end
    end
  end
end
