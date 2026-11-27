-- ProjectName SDK body codec: handle

local media = require("utility.media")

-- An entity's named bytes. Each call is one run of the entity's own
-- operation on the slot's point; in core only whole, in-memory bodies move.
-- A slot, as the entity component derived it from the model, is the action
-- whose points move its bytes ('' for the entity's own) and the operations
-- that read and write them: `{ action, read?, write? }`. A refusal is
-- answered as `nil, err`, as an operation answers one.
local BinaryHandle = {}
BinaryHandle.__index = BinaryHandle


function BinaryHandle.new(entity, slots, slot)
  local self = setmetatable({}, BinaryHandle)
  self._entity = entity
  self._slot = slot == nil and "" or tostring(slot)
  self._def = slots[self._slot]
  return self
end


function BinaryHandle:name()
  return self._slot
end


local function merged(ctrl, transfer)
  local out = {}
  for k, v in pairs(type(ctrl) == "table" and ctrl or {}) do
    out[k] = v
  end
  out.transfer = transfer
  return out
end


function BinaryHandle:_error(code, msg)
  return self._entity._entctx:make_error(code, msg)
end


function BinaryHandle:_inactive(what)
  return nil, self:_error("binary_feature_inactive", 'The binary slot "' .. self._slot ..
    '" of entity "' .. self._entity:get_name() .. '" cannot ' .. what ..
    " without the binary feature; in core it answers bytes() and put().")
end


function BinaryHandle:_direction(way)
  local def = self._def
  local name = self._entity:get_name()
  if def == nil then
    return nil, self:_error("binary_slot_unknown", 'Entity "' .. name ..
      '" has no binary slot "' .. self._slot .. '".')
  end
  if def[way] == nil then
    return nil, self:_error("binary_slot_direction", 'The binary slot "' .. self._slot ..
      '" of entity "' .. name .. '" cannot be ' .. (way == "read" and "read" or "written") .. ".")
  end
  return def, nil
end


function BinaryHandle:_select(def)
  if def.action == "" then
    return {}
  end
  return { ["$action"] = def.action }
end


-- The whole body, within maxBuffer.
function BinaryHandle:bytes(opts, ctrl)
  if type(opts) == "table" and opts.range ~= nil then
    return self:_inactive("read a range")
  end
  local def, err = self:_direction("read")
  if err ~= nil then
    return nil, err
  end
  local transfer = { slot = self._slot, direction = "read" }
  local _, operr = self._entity[def.read](self._entity, self:_select(def), merged(ctrl, transfer))
  if operr ~= nil then
    return nil, operr
  end
  return transfer.bytes or "", nil
end


-- Sends in-memory content as the slot's body; answers the entity.
function BinaryHandle:put(source, ctrl)
  local def, err = self:_direction("write")
  if err ~= nil then
    return nil, err
  end
  local data = self:_select(def)
  data[media.RAW_BODY] = source
  local _, operr = self._entity[def.write](self._entity, data,
    merged(ctrl, { slot = self._slot, direction = "write" }))
  if operr ~= nil then
    return nil, operr
  end
  return self._entity, nil
end


function BinaryHandle:save()
  return self:_inactive("save")
end


function BinaryHandle:stream()
  return self:_inactive("stream")
end


function BinaryHandle:open()
  return self:_inactive("open")
end


return BinaryHandle
