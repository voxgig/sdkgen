-- ProjectName SDK validate feature
--
-- Payload validation against the model's own field types (the lua port of
-- tm/ts/src/feature/validate/ValidateFeature.ts).
--
-- The specs are NOT written here and not written in the model either: every
-- entity field already carries a canonical type sentinel (`$STRING`,
-- `$INTEGER`, the `$ONE` union for an OpenAPI multi-type), which is the same
-- vocabulary vs.validate speaks. The generator maps them once
-- (helpers/canonSpec) and emits `schema.ENTITYSPEC`, so a field whose type
-- changes in the API spec changes what this feature enforces with no edit
-- anywhere.
--
-- WHAT IS CHECKED
--   outbound (PreSpec)  the payload the caller asked to send, against
--                       spec.op[opname] -- the operation's request shape.
--   inbound  (PreDone)  each record the operation returned, against
--                       spec.data -- the entity's own field types.
--
-- WHAT IS NOT. The model carries no array element types, no nested object
-- schemas, no enums, formats or bounds, so this checks the shape the model
-- knows and nothing more.
--
-- Short-circuit mechanism: the failure error is placed in `ctx.out["spec"]`;
-- `make_spec` recognises an SDK error there and returns it as the operation
-- error before the request is built -- the same seam rbac uses one stage
-- earlier through `ctx.out["point"]`.

local BaseFeature = require("feature.base_feature")
local schema = require("schema")
local vs = require("utility.struct.struct")

-- Built rather than written, so the backticks cannot be lost in an edit.
local OPEN = string.char(96) .. "$OPEN" .. string.char(96)

local ValidateFeature = {}
ValidateFeature.__index = ValidateFeature
setmetatable(ValidateFeature, { __index = BaseFeature })


-- The spec tree with every `$OPEN` marker removed, so an undeclared key is
-- an error rather than a pass. Rebuilt rather than mutated: schema.ENTITYSPEC
-- is parsed once at require and shared by every client in the process.
--
-- The source metatable is CARRIED OVER: dkjson marks an array with
-- `__jsontype`, and a `$ONE` union that lost the mark would be read back as a
-- map and stop being a union at all.
local function close_spec(node)
  if type(node) ~= "table" then
    return node
  end

  local out = {}
  for k, v in pairs(node) do
    if k ~= OPEN then
      out[k] = close_spec(v)
    end
  end

  return setmetatable(out, getmetatable(node))
end


-- A RESULT RECORD AS DATA.
--
-- make_result turns every record of a LIST into an entity instance
-- (`entity:make()` then `ent:data_set(entry)`), so what reaches PreDone for a
-- list is wrappers, not records -- and a wrapper checked against a field spec
-- fails on every required field while its actual data goes unchecked. A load
-- returns the record itself, so this has to handle both.
local function unwrap(record)
  if type(record) == "table" and type(record.data_get) == "function" then
    local data = record:data_get()
    if data ~= nil then
      return data
    end
  end
  return record
end


function ValidateFeature.new()
  local self = setmetatable(BaseFeature.new(), ValidateFeature)
  self.version = "0.0.1"
  self.name = "validate"
  self.active = true
  self.client = nil
  self.options = nil
  self.spec = {}
  self.request = true
  self.response = false
  self.mode = "throw"
  return self
end


function ValidateFeature:init(ctx, options)
  self.client = ctx.client
  self.options = options or {}
  self.active = self.options["active"] == true

  -- DEFAULTS ARE APPLIED HERE, not by the option spec. The model's
  -- `config.options` documents them and types them; it does not inject them,
  -- because each feature entry in the spec is optional and struct fills in
  -- nothing through an optional union. So every feature resolves its own.
  self.request = self.options["request"] ~= false
  self.response = self.options["response"] == true

  -- FAIL CLOSED. Only the exact string "report" selects report mode, so a
  -- typo (`mode = "thow"`) still rejects rather than silently turning
  -- enforcement off -- the failure nobody would notice. The option spec
  -- rejects the typo outright; this is what happens if it ever does not.
  self.mode = self.options["mode"] == "report" and "report" or "throw"

  -- `strict` is applied ONCE, here, by rebuilding the spec tree without the
  -- `$OPEN` markers -- rather than per call, which would clone a spec for
  -- every request an SDK ever makes.
  if self.options["strict"] == true then
    self.spec = close_spec(schema.ENTITYSPEC)
  else
    self.spec = schema.ENTITYSPEC
  end
end


function ValidateFeature:PreSpec(ctx)
  if not self.active or not self.request then
    return
  end

  local opname = self:_opname(ctx)
  local espec = self:_entity_spec(ctx)
  local opspec = nil
  if type(espec) == "table" and type(espec["op"]) == "table" then
    opspec = espec["op"][opname]
  end

  if opspec == nil then
    return
  end

  local errs = self:_check(ctx, self:_payload(ctx, opname), opspec, "request")
  if #errs == 0 or self.mode == "report" then
    return
  end

  local err = ctx:make_error("validate_failed",
    'Invalid ' .. opname .. ' request for entity "' .. self:_entname(ctx) ..
    '": ' .. table.concat(errs, "; "))
  ctx.out["spec"] = err
  return err
end


-- Inbound. PreDone rather than PreResult: the records are extracted from the
-- response body by make_result, which runs between the two, so at PreResult
-- there is nothing to check but the envelope.
--
-- HOOK ORDER MATTERS HERE, and the default order is not the one you want.
-- PreDone hooks fire in feature ADD order, which defaults to `test` first and
-- then names sorted -- and `validate` sorts last, after audit, cost, debug,
-- metrics and telemetry. Those observers therefore record the operation as a
-- success before this hook has looked at it. Activating features as an
-- ORDERED LIST fixes it.
function ValidateFeature:PreDone(ctx)
  if not self.active or not self.response then
    return
  end

  local espec = self:_entity_spec(ctx)
  if type(espec) ~= "table" or espec["data"] == nil then
    return
  end

  local result = ctx.result
  if result == nil or result.resdata == nil then
    return
  end

  -- A list op returns many records and a load returns one; both are checked
  -- against the same record spec, because they are the same entity.
  local records = {}
  if type(result.resdata) == "table" and #result.resdata > 0 then
    records = result.resdata
  else
    records = { result.resdata }
  end

  local errs = {}
  for _, record in ipairs(records) do
    if record ~= nil then
      -- A NON-OBJECT IS A FAILURE, not something to skip. A load that
      -- answered 42 where the entity's spec wants a record must not pass this
      -- feature silently -- struct rejects it with the field it could not
      -- find.
      for _, e in ipairs(self:_check(ctx, unwrap(record), espec["data"], "response")) do
        table.insert(errs, e)
      end
    end
  end

  if #errs == 0 or self.mode == "report" then
    return
  end

  local err = ctx:make_error("validate_failed",
    'Invalid response for entity "' .. self:_entname(ctx) .. '": ' ..
    table.concat(errs, "; "))

  -- BOTH, and `ok` is the load-bearing half: `done` returns `resdata`
  -- whenever `result.ok` is true and never looks at `err`, so setting the
  -- error alone would hand the caller the very records that failed the spec.
  result.ok = false
  result.err = err

  -- AND THE DATA GOES. The load/update paths copy `result.resdata` into the
  -- entity's own state on any non-nil value, BEFORE `done` raises -- so
  -- rejecting the operation while leaving the records in place would leave
  -- the caller holding an entity populated from a payload this feature had
  -- just declared invalid.
  result.resdata = nil

  return err
end


-- The payload an operation is about to send.
--
-- TWO SLOTS, AND THE OP PICKS. A body op (create/update/patch) carries the
-- caller's argument in `reqdata` over the entity's `data`; a match op
-- (load/list/remove) carries it in `reqmatch` over `match`. That is what the
-- entity operations pass to the context and what make_point reads -- so
-- reading `reqdata` for every op would check a `load({id=...})` against the
-- entity's STALE stored match and reject it for the id the caller had just
-- supplied.
function ValidateFeature:_payload(ctx, opname)
  local body = opname == "create" or opname == "update" or opname == "patch"

  local base = body and ctx.data or ctx.match
  local req = body and ctx.reqdata or ctx.reqmatch

  local out = {}
  for _, src in ipairs({ base or {}, req or {} }) do
    if type(src) == "table" then
      for k, v in pairs(src) do
        out[k] = v
      end
    end
  end

  -- `$action` SELECTS A CUSTOM ENDPOINT; it is not a field of the record.
  -- make_point reads it off this same argument and the request transformer
  -- drops it before the body is built, so a spec built from the API's own
  -- fields will never name it -- and under `strict` every custom-action call
  -- would be rejected for the one key that made it reachable.
  out["$action"] = nil

  return out
end


function ValidateFeature:_entity_spec(ctx)
  if type(self.spec) ~= "table" then
    return nil
  end
  return self.spec[self:_entname(ctx)]
end


function ValidateFeature:_opname(ctx)
  if ctx.op ~= nil and type(ctx.op.name) == "string" then
    return ctx.op.name
  end
  return ""
end


function ValidateFeature:_entname(ctx)
  local entity = ""
  if ctx.entity ~= nil then
    if type(ctx.entity.get_name) == "function" then
      entity = ctx.entity:get_name()
    elseif type(ctx.entity.name) == "string" then
      entity = ctx.entity.name
    end
  end
  if entity == "" and ctx.op ~= nil and type(ctx.op.entity) == "string" then
    entity = ctx.op.entity
  end
  return entity
end


-- One validate call. Errors are COLLECTED, never raised: vs.validate raises
-- on the first failure unless given an `errs` table, and a caller fixing a
-- payload wants every problem with it, not the first one.
function ValidateFeature:_check(ctx, data, spec, direction)
  local errs = {}

  local ok, e = pcall(function()
    vs.validate(data, spec, { errs = errs })
  end)

  -- A spec this port cannot run at all (rather than a payload that fails it)
  -- must not take the operation down with it: report it like any other
  -- failure and let `mode` decide.
  if not ok and #errs == 0 then
    table.insert(errs, tostring(e))
  end

  local messages = {}
  for _, m in ipairs(errs) do
    table.insert(messages, tostring(m))
  end

  if #messages > 0 and type(self.options["onInvalid"]) == "function" then
    -- A callback receiving every failure, whatever `mode` does with it, so a
    -- client can log or count invalid payloads without changing what the SDK
    -- returns.
    pcall(self.options["onInvalid"], {
      entity = self:_entname(ctx),
      op = self:_opname(ctx),
      direction = direction,
      errs = messages,
      data = data,
    })
  end

  return messages
end


return ValidateFeature
