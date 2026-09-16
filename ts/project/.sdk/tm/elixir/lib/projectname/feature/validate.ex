# ProjectName SDK validate feature
#
# Payload validation against the model's own field types (the elixir port of
# tm/ts/src/feature/validate/ValidateFeature.ts).
#
# The specs are NOT written here and not written in the model either: every
# entity field already carries a canonical type sentinel (`$STRING`,
# `$INTEGER`, the `$ONE` union for an OpenAPI multi-type), which is the same
# vocabulary S.validate speaks. The generator maps them once
# (helpers/canonSpec) and emits `ProjectName.Schema.entityspec`, so a field
# whose type changes in the API spec changes what this feature enforces with
# no edit anywhere.
#
# WHAT IS CHECKED
#   outbound (PreSpec)  the payload the caller asked to send, against
#                       spec.op[<opname>] - the operation's request shape.
#   inbound  (PreDone)  each record the operation returned, against
#                       spec.data - the entity's own field types.
#
# WHAT IS NOT. The model carries no array element types, no nested object
# schemas, no enums, formats or bounds, so this checks the shape the model
# knows and nothing more.
#
# Short-circuit mechanism: the failure error is placed in ctx.out["spec"],
# which make_spec_impl already surfaces as the operation's error (H.is_error)
# rather than using as a Spec - the same seam rbac uses one stage earlier
# through ctx.out["point"].

defmodule ProjectName.Feature.Validate do
  alias Voxgig.Struct, as: S
  alias ProjectName.Helpers, as: H
  alias ProjectName.{Feature, Context, Schema, EntityBase}

  # Built rather than written, so the backticks cannot be lost in an edit.
  @open <<96>> <> "$OPEN" <> <<96>>

  def new do
    f = Feature.base("validate")
    Feature.install(f, "init", fn ctx, opts -> init(f, ctx, opts) end)
    Feature.install(f, "PreSpec", fn ctx -> pre_spec(f, ctx) end)
    Feature.install(f, "PreDone", fn ctx -> pre_done(f, ctx) end)
    f
  end

  def init(f, ctx, options) do
    Feature.init_common(f, ctx, options)
    opts = Feature.opts(f)

    # DEFAULTS ARE APPLIED HERE, not by the option spec. The model's
    # `config.options` documents them and types them; it does not inject them,
    # because each feature entry in the spec is optional and struct fills in
    # nothing through an optional union. So every feature resolves its own.
    S.setprop(f, "request", S.getprop(opts, "request") != false)
    S.setprop(f, "response", S.getprop(opts, "response") == true)

    # FAIL CLOSED. Only the exact string "report" selects report mode, so a
    # typo (`mode: "thow"`) still rejects rather than silently turning
    # enforcement off - the failure nobody would notice. The option spec
    # rejects the typo outright; this is what happens if it ever does not.
    S.setprop(f, "mode", if(S.getprop(opts, "mode") == "report", do: "report", else: "throw"))

    # `strict` is applied ONCE, here, by rebuilding the spec tree without the
    # `$OPEN` markers - rather than per call, which would clone a spec for
    # every request an SDK ever makes.
    spec =
      if S.getprop(opts, "strict") == true do
        close_spec(Schema.entityspec())
      else
        Schema.entityspec()
      end

    S.setprop(f, "spec", spec)
    nil
  end

  defp pre_spec(f, ctx) do
    if Feature.active?(f) and S.getprop(f, "request") == true do
      opname = opname_of(ctx)
      espec = entity_spec(f, ctx)
      ops = if espec != nil, do: S.getprop(espec, "op"), else: nil
      opspec = if S.ismap(ops), do: S.getprop(ops, opname), else: nil

      if opspec != nil do
        errs = check(f, ctx, payload(ctx, opname), opspec, "request")

        if errs != [] and S.getprop(f, "mode") != "report" do
          err =
            Context.make_error(
              ctx,
              "validate_failed",
              "Invalid " <>
                opname <>
                " request for entity \"" <> entity_of(ctx) <> "\": " <> Enum.join(errs, "; ")
            )

          S.setprop(S.getprop(ctx, "out"), "spec", err)
          err
        end
      end
    end
  end

  # Inbound. PreDone rather than PreResult: the records are extracted from the
  # response body by make_result, which runs between the two, so at PreResult
  # there is nothing to check but the envelope.
  #
  # HOOK ORDER MATTERS HERE, and the default order is not the one you want.
  # PreDone hooks fire in feature ADD order, which defaults to `test` first and
  # then names sorted - and `validate` sorts last, after audit, cost, debug,
  # metrics and telemetry. Those observers therefore record the operation as a
  # success before this hook has looked at it. Activating features as an
  # ORDERED LIST fixes it.
  defp pre_done(f, ctx) do
    if Feature.active?(f) and S.getprop(f, "response") == true do
      espec = entity_spec(f, ctx)
      dataspec = if espec != nil, do: S.getprop(espec, "data"), else: nil
      result = S.getprop(ctx, "result")
      resdata = if result != nil, do: S.getprop(result, "resdata"), else: nil

      if dataspec != nil and resdata != nil do
        # A list op returns many records and a load returns one; both are
        # checked against the same record spec, because they are the same
        # entity.
        records =
          if S.islist(resdata) do
            n = S.size(resdata)
            if n == 0, do: [], else: Enum.map(0..(n - 1), fn i -> S.getelem(resdata, i) end)
          else
            [resdata]
          end

        errs =
          Enum.flat_map(records, fn record ->
            if record == nil do
              []
            else
              # A NON-OBJECT IS A FAILURE, not something to skip. A load that
              # answered 42 where the entity's spec wants a record must not
              # pass this feature silently - struct rejects it with the field
              # it could not find.
              check(f, ctx, unwrap(record), dataspec, "response")
            end
          end)

        if errs != [] and S.getprop(f, "mode") != "report" do
          err =
            Context.make_error(
              ctx,
              "validate_failed",
              "Invalid response for entity \"" <> entity_of(ctx) <> "\": " <> Enum.join(errs, "; ")
            )

          # BOTH, and `ok` is the load-bearing half: done returns resdata
          # whenever result.ok is true and never looks at err, so setting the
          # error alone would hand the caller the very records that failed the
          # spec.
          S.setprop(result, "ok", false)
          S.setprop(result, "err", err)

          # AND THE DATA GOES. The load/update paths copy resdata into the
          # entity's own state on any non-nil value, BEFORE done raises - so
          # rejecting the operation while leaving the records in place would
          # leave the caller holding an entity populated from a payload this
          # feature had just declared invalid.
          S.setprop(result, "resdata", nil)
          err
        end
      end
    end
  end

  # The payload an operation is about to send.
  #
  # TWO SLOTS, AND THE OP PICKS. A body op (create/update/patch) carries the
  # caller's argument in `reqdata` over the entity's `data`; a match op
  # (load/list/remove) carries it in `reqmatch` over `match`. That is what the
  # entity operations pass to Context.new and what make_point reads - so
  # reading `reqdata` for every op would check a `load(%{"id" => ...})`
  # against the entity's STALE stored match and reject it for the id the
  # caller had just supplied.
  defp payload(ctx, opname) do
    body = opname in ["create", "update", "patch"]
    base = S.getprop(ctx, if(body, do: "data", else: "match"))
    req = S.getprop(ctx, if(body, do: "reqdata", else: "reqmatch"))

    out = S.jm([])

    Enum.each([base, req], fn src ->
      if S.ismap(src) do
        Enum.each(H.entries(src), fn {k, v} -> S.setprop(out, k, v) end)
      end
    end)

    # `$action` SELECTS A CUSTOM ENDPOINT; it is not a field of the record.
    # make_point reads it off this same argument and the request transformer
    # drops it before the body is built, so a spec built from the API's own
    # fields will never name it - and under `strict` every custom-action call
    # would be rejected for the one key that made it reachable.
    S.delprop(out, "$action")

    out
  end

  defp entity_spec(f, ctx) do
    spec = S.getprop(f, "spec")
    if S.ismap(spec), do: S.getprop(spec, entity_of(ctx)), else: nil
  end

  defp entity_of(ctx) do
    name = Context.entity_name(S.getprop(ctx, "entity"))
    name = if name == "_", do: "", else: name

    if name == "" do
      op = S.getprop(ctx, "op")
      oe = if op != nil, do: S.getprop(op, "entity"), else: nil
      if is_binary(oe), do: oe, else: ""
    else
      name
    end
  end

  defp opname_of(ctx) do
    op = S.getprop(ctx, "op")
    nm = if op != nil, do: S.getprop(op, "name"), else: nil
    if is_binary(nm), do: nm, else: ""
  end

  # One validate call. Errors are COLLECTED, never raised: S.validate raises on
  # the first failure unless given an `errs` list, and a caller fixing a
  # payload wants every problem with it, not the first one.
  defp check(f, ctx, data, spec, direction) do
    errs = S.jt([])

    try do
      S.validate(data, spec, S.jm(["errs", errs]))
    rescue
      e ->
        # A spec this port cannot run at all (rather than a payload that fails
        # it) must not take the operation down with it: report it like any
        # other failure and let `mode` decide.
        if S.size(errs) == 0 do
          S.setprop(errs, S.size(errs), Exception.message(e))
        end
    end

    n = S.size(errs)
    msgs = if n == 0, do: [], else: Enum.map(0..(n - 1), fn i -> to_string(S.getelem(errs, i)) end)

    cb = S.getprop(Feature.opts(f), "onInvalid")

    if msgs != [] and is_function(cb, 1) do
      # A callback receiving every failure, whatever `mode` does with it, so a
      # client can log or count invalid payloads without changing what the SDK
      # returns.
      try do
        cb.(
          S.jm([
            "entity",
            entity_of(ctx),
            "op",
            opname_of(ctx),
            "direction",
            direction,
            "errs",
            errs,
            "data",
            data
          ])
        )
      rescue
        _e -> nil
      end
    end

    msgs
  end

  # A RESULT RECORD AS DATA.
  #
  # make_result turns every record of a LIST into an entity instance, so what
  # reaches PreDone for a list is wrappers, not records - and a wrapper checked
  # against a field spec fails on every required field while its actual data
  # goes unchecked. A load returns the record itself, so this handles both.
  defp unwrap(record) do
    if S.ismap(record) and S.getprop(record, "_module") != nil do
      data = EntityBase.data_get(record)
      if data != nil, do: data, else: record
    else
      record
    end
  end

  # The spec tree with every `$OPEN` marker removed, so an undeclared key is an
  # error rather than a pass. Rebuilt rather than mutated: Schema.entityspec is
  # a module attribute shared by every client in the process.
  defp close_spec(node) do
    cond do
      S.islist(node) ->
        n = S.size(node)

        S.jt(
          if n == 0,
            do: [],
            else: Enum.map(0..(n - 1), fn i -> close_spec(S.getelem(node, i)) end)
        )

      S.ismap(node) ->
        out = S.jm([])

        Enum.each(H.entries(node), fn {k, v} ->
          if k != @open, do: S.setprop(out, k, close_spec(v))
        end)

        out

      true ->
        node
    end
  end
end
