# ProjectName SDK validate feature
#
# Payload validation against the model's own field types. The ruby port of
# tm/ts/src/feature/validate/ValidateFeature.ts.
#
# The specs are NOT written here and not written in the model either: every
# entity field already carries a canonical type sentinel ("$STRING",
# "$INTEGER", the "$ONE" union for an OpenAPI multi-type), which is the same
# vocabulary VoxgigStruct.validate speaks. The generator maps them once
# (helpers/canonSpec) and emits ProjectNameSchema::ENTITYSPEC, so a field
# whose type changes in the API spec changes what this feature enforces with
# no edit anywhere.
#
# WHAT IS CHECKED
#   outbound (PreSpec)  the payload the caller asked to send, against
#                       spec["op"][opname] - the operation's request shape.
#   inbound  (PreDone)  each record the operation returned, against
#                       spec["data"] - the entity's own field types.
#
# WHAT IS NOT. The model carries no array element types, no nested object
# schemas, no enums, formats or bounds, so this checks the shape the model
# knows and nothing more.

require_relative 'base_feature'
require_relative '../schema'
require_relative '../utility/struct/voxgig_struct'

class ProjectNameValidateFeature < ProjectNameBaseFeature
  # Built rather than written, so the backticks cannot be lost in an edit.
  OPEN = 96.chr + "$OPEN" + 96.chr

  def initialize
    super
    @version = "0.0.1"
    @name = "validate"
    # Inactive until init (feature_init only fires init when active).
    @active = false
    @client = nil
    @options = {}
    @spec = {}
    @request = true
    @response = false
    @mode = "throw"
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options.is_a?(Hash) ? options : {}
    @active = @options["active"] == true

    # DEFAULTS ARE APPLIED HERE, not by the option spec. The model's
    # config.options documents them and types them; it does not inject them,
    # because each feature entry in the spec is optional and struct fills in
    # nothing through an optional union.
    @request = @options["request"] != false
    @response = @options["response"] == true

    # FAIL CLOSED. Only the exact string "report" selects report mode, so a
    # typo (mode: "thow") still rejects rather than silently turning
    # enforcement off. The option spec rejects the typo outright; this is what
    # happens if it ever does not.
    @mode = @options["mode"] == "report" ? "report" : "throw"

    # `strict` is applied ONCE, here, by rebuilding the spec tree without the
    # `$OPEN` markers - rather than per call, which would clone a spec for
    # every request an SDK ever makes.
    @spec = @options["strict"] == true ?
      _close(ProjectNameSchema::ENTITYSPEC) : ProjectNameSchema::ENTITYSPEC
  end

  # Outbound. make_spec short-circuits on a ctx.out["spec"] that is already
  # set, so assigning the error here rejects the operation before the request
  # is built - the same seam rbac uses one stage earlier.
  def PreSpec(ctx)
    return unless @active && @request

    opname = _opname(ctx)
    espec = _entity_spec(ctx)
    ops = espec.is_a?(Hash) ? espec["op"] : nil
    opspec = ops.is_a?(Hash) ? ops[opname] : nil

    return if opspec.nil?

    errs = _check(ctx, _payload(ctx, opname), opspec, "request")
    return if errs.empty? || @mode == "report"

    err = ctx.make_error("validate_failed",
      "Invalid #{opname} request for entity \"#{_entname(ctx)}\": #{errs.join('; ')}")
    ctx.out["spec"] = err
    err
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
  # ORDERED ARRAY fixes it.
  def PreDone(ctx)
    return unless @active && @response

    espec = _entity_spec(ctx)
    return unless espec.is_a?(Hash)

    dataspec = espec["data"]
    return if dataspec.nil?

    result = ctx.result
    return if result.nil? || result.resdata.nil?

    # A list op returns many records and a load returns one; both are checked
    # against the same record spec, because they are the same entity.
    records = result.resdata.is_a?(Array) ? result.resdata : [result.resdata]

    errs = []
    records.each do |record|
      next if record.nil?

      # A NON-OBJECT IS A FAILURE, not something to skip. A load that answered
      # 42 where the entity's spec wants a record must not pass this feature
      # silently - struct rejects it with the field it could not find.
      errs.concat(_check(ctx, _unwrap(record), dataspec, "response"))
    end

    return if errs.empty? || @mode == "report"

    err = ctx.make_error("validate_failed",
      "Invalid response for entity \"#{_entname(ctx)}\": #{errs.join('; ')}")

    # BOTH, and `ok` is the load-bearing half: done returns resdata whenever
    # result.ok is true and never looks at err, so setting the error alone
    # would hand the caller the very records that failed the spec.
    result.ok = false
    result.err = err

    # AND THE DATA GOES. The load/update paths copy result.resdata into the
    # entity's own state on any non-nil value, BEFORE done raises - so
    # rejecting the operation while leaving the records in place would leave
    # the caller holding an entity populated from a payload this feature had
    # just declared invalid.
    result.resdata = nil

    err
  end

  # The payload an operation is about to send.
  #
  # TWO SLOTS, AND THE OP PICKS. A body op (create/update/patch) carries the
  # caller's argument in reqdata over the entity's data; a match op
  # (load/list/remove) carries it in reqmatch over match. That is what the
  # entity operations pass to make_context and what make_point reads - so
  # reading reqdata for every op would check a load({id}) against the entity's
  # STALE stored match and reject it for the id the caller had just supplied.
  def _payload(ctx, opname)
    body = ["create", "update", "patch"].include?(opname)

    base = body ? ctx.data : ctx.match
    req = body ? ctx.reqdata : ctx.reqmatch

    out = {}
    out.merge!(base) if base.is_a?(Hash)
    out.merge!(req) if req.is_a?(Hash)

    # `$action` SELECTS A CUSTOM ENDPOINT; it is not a field of the record.
    # make_point reads it off this same argument and the request transformer
    # drops it before the body is built, so a spec built from the API's own
    # fields will never name it - and under `strict` every custom-action call
    # would be rejected for the one key that made it reachable.
    out.delete("$action")

    out
  end

  def _entity_spec(ctx)
    return nil unless @spec.is_a?(Hash)
    @spec[_entname(ctx)]
  end

  def _opname(ctx)
    name = ctx.op.nil? ? nil : ctx.op.name
    name.is_a?(String) ? name : ""
  end

  def _entname(ctx)
    name = ctx.entity.nil? ? nil : ctx.entity.name
    return name if name.is_a?(String) && !name.empty?

    entname = ctx.op.nil? ? nil : ctx.op.entity
    entname.is_a?(String) ? entname : ""
  end

  # One validate call. Errors are COLLECTED, never raised: struct raises on the
  # first failure unless given an errs array, and a caller fixing a payload
  # wants every problem with it, not the first one.
  def _check(ctx, data, spec, direction)
    errs = []

    begin
      VoxgigStruct.validate(data, spec, { "errs" => errs })
    rescue StandardError => e
      # A spec this port cannot run at all (rather than a payload that fails
      # it) must not take the operation down with it: report it like any other
      # failure and let `mode` decide.
      errs << e.message if errs.empty?
    end

    errs = errs.map(&:to_s)

    if !errs.empty?
      on_invalid = @options["onInvalid"]
      if on_invalid.respond_to?(:call)
        begin
          on_invalid.call({
            "entity" => _entname(ctx),
            "op" => _opname(ctx),
            "direction" => direction,
            "errs" => errs,
            "data" => data,
          })
        rescue StandardError
          nil
        end
      end
    end

    errs
  end

  # A RESULT RECORD AS DATA.
  #
  # make_result turns every record of a LIST into an entity instance, so what
  # reaches PreDone for a list is wrappers, not records - and a wrapper checked
  # against a field spec fails on every required field while its actual data
  # goes unchecked. A load returns the record itself, so this handles both.
  def _unwrap(record)
    if record.respond_to?(:data)
      begin
        data = record.data
      rescue StandardError
        return record
      end
      return data unless data.nil?
    end
    record
  end

  # The spec tree with every `$OPEN` marker removed, so an undeclared key is an
  # error rather than a pass. Rebuilt rather than mutated: ENTITYSPEC is a
  # module constant shared by every client in the process.
  def _close(node)
    return node.map { |n| _close(n) } if node.is_a?(Array)

    if node.is_a?(Hash)
      out = {}
      node.each { |k, v| out[k] = _close(v) unless k == OPEN }
      return out
    end

    node
  end
end
