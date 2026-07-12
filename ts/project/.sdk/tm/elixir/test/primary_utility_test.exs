# ProjectName SDK primary-utility test
#
# Directly exercises the request-shaping utilities (make_url, param,
# prepare_*, make_options) through the client's utility object. API-agnostic.

defmodule ProjectName.PrimaryUtilityTest do
  use ExUnit.Case

  alias Voxgig.Struct, as: S
  alias ProjectName.Helpers, as: H
  alias ProjectName.{Context, Utility, Spec, Result}

  defp client, do: ProjectName.test()

  defp ctx(client, opname \\ "load") do
    Context.new(S.jm(["opname", opname]), ProjectName.get_root_ctx(client))
  end

  test "make_url substitutes path params and appends query" do
    c = client()
    ctx = ctx(c)

    S.setprop(ctx, "spec",
      Spec.new(H.deep(%{
        "base" => "http://h",
        "path" => "planet/{id}",
        "params" => %{"id" => "P1"},
        "query" => %{"q" => "x"}
      })))

    S.setprop(ctx, "result", Result.new(nil))

    {url, err} = Utility.make_url(ctx)
    assert err == nil
    assert String.contains?(url, "planet/P1")
    assert String.contains?(url, "q=x")
    assert S.getprop(S.getprop(ctx, "result"), "resmatch") != nil
  end

  test "param resolves reqmatch over match, then data" do
    c = client()
    ctx = ctx(c)
    S.setprop(ctx, "reqmatch", H.deep(%{"id" => "R1"}))
    S.setprop(ctx, "match", H.deep(%{"id" => "M1", "k" => "mk"}))
    S.setprop(ctx, "reqdata", H.deep(%{"d" => "rd"}))
    S.setprop(ctx, "data", H.deep(%{"d" => "dd", "only" => "od"}))

    assert Utility.param(ctx, "id") == "R1"
    assert Utility.param(ctx, "k") == "mk"
    assert Utility.param(ctx, "d") == "rd"
    assert Utility.param(ctx, "only") == "od"
    assert Utility.param(ctx, "missing") == nil
  end

  test "prepare_method maps op names to HTTP verbs" do
    c = client()
    assert Utility.prepare_method(ctx(c, "create")) == "POST"
    assert Utility.prepare_method(ctx(c, "update")) == "PUT"
    assert Utility.prepare_method(ctx(c, "load")) == "GET"
    assert Utility.prepare_method(ctx(c, "list")) == "GET"
    assert Utility.prepare_method(ctx(c, "remove")) == "DELETE"
  end

  test "prepare_query keeps reqmatch keys not declared as point params" do
    c = client()
    ctx = ctx(c)
    S.setprop(ctx, "point", H.deep(%{"params" => ["id"]}))
    S.setprop(ctx, "reqmatch", H.deep(%{"id" => "x", "extra" => "y"}))
    q = Utility.prepare_query(ctx)
    assert S.getprop(q, "extra") == "y"
    assert S.getprop(q, "id") == nil
  end

  test "prepare_params resolves declared params" do
    c = client()
    ctx = ctx(c)
    S.setprop(ctx, "point", H.deep(%{"args" => %{"params" => [%{"name" => "id"}]}}))
    S.setprop(ctx, "reqmatch", H.deep(%{"id" => "P9"}))
    p = Utility.prepare_params(ctx)
    assert S.getprop(p, "id") == "P9"
  end

  test "prepare_auth sets an authorization header when an apikey is present" do
    c = ProjectName.new(H.deep(%{"apikey" => "secret"}))
    ctx = ctx(c)
    spec = Spec.new(H.deep(%{"headers" => %{}}))
    S.setprop(ctx, "spec", spec)
    {_spec, err} = Utility.prepare_auth(ctx)
    assert err == nil
    assert S.getprop(S.getprop(spec, "headers"), "authorization") == "secret"
  end

  test "prepare_auth omits the header when no apikey" do
    c = ProjectName.new()
    ctx = ctx(c)
    spec = Spec.new(H.deep(%{"headers" => %{"authorization" => "stale"}}))
    S.setprop(ctx, "spec", spec)
    {_spec, err} = Utility.prepare_auth(ctx)
    assert err == nil
    assert S.getprop(S.getprop(spec, "headers"), "authorization") == nil
  end

  test "make_options derives a clean key regex" do
    c = ProjectName.test()
    opts = ProjectName.options_map(c)
    assert S.getpath(opts, "__derived__.clean.keyre") == "key|token|id"
  end

  test "make_error formats a namespaced message and raises by default" do
    c = client()
    ctx = ctx(c, "load")

    err =
      assert_raise ProjectName.Error, fn ->
        Utility.make_error(ctx, Context.make_error(ctx, "boom", "kaboom"))
      end

    assert String.contains?(err.msg, "load")
    assert String.contains?(err.msg, "kaboom")
    assert err.code == "boom"
  end

  test "make_error returns bare resdata when throw_err is disabled" do
    c = client()
    ctx = ctx(c, "load")
    S.setprop(S.getprop(ctx, "ctrl"), "throw_err", false)
    result = Result.new(H.deep(%{"resdata" => %{"x" => 1}}))
    S.setprop(ctx, "result", result)
    out = Utility.make_error(ctx, Context.make_error(ctx, "boom", "kaboom"))
    assert S.ismap(out)
    assert S.getprop(out, "x") == 1
  end
end
