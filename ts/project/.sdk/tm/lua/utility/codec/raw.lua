-- ProjectName SDK body codec: raw

local vs = require("utility.struct.struct")
local media = require("utility.media")
local schema = require("schema")

local M = {}

local DEFAULT_MAX = 16777216


function M.max_buffer(ctx)
  for _, from in ipairs({ ctx.options or {}, schema.OPTSPEC or {} }) do
    local val = vs.getprop(from, "maxBuffer")
    if type(val) == "number" and 0 <= val then
      return math.floor(val)
    end
  end
  return DEFAULT_MAX
end


local function too_large(ctx, code, max, declared)
  return ctx:make_error(code, "response: body " .. (declared == nil and "is longer than" or
    "of " .. string.format("%d", declared) .. " bytes exceeds") ..
    " maxBuffer (" .. string.format("%d", max) .. " bytes)")
end


-- The whole body, refused past the bound: by its declared length before a
-- byte is read, else by the count as it arrives. A body is a string, or a
-- function answering the next chunk and nil at the end.
-- Answers (bytes, nil) or (nil, error).
function M.read_bounded(ctx, response, max, code)
  local body = response.body
  local length = string.match(media.header_value(response.headers, "content-length"), "^%s*(%d+)%s*$")
  if length ~= nil and max < tonumber(length) then
    return nil, too_large(ctx, code, max, tonumber(length))
  end

  local next_chunk
  if type(body) == "function" then
    next_chunk = body
  else
    local whole = type(body) == "string" and body or ""
    next_chunk = function()
      local c = whole
      whole = nil
      return c
    end
  end

  local chunks = {}
  local count = 0
  while true do
    local chunk = next_chunk()
    if chunk == nil then
      break
    end
    chunk = tostring(chunk)
    count = count + #chunk
    if max < count then
      return nil, too_large(ctx, code, max, nil)
    end
    chunks[#chunks + 1] = chunk
  end
  return table.concat(chunks), nil
end


-- A raw success body: text into the record under `$body`; bytes only into a
-- binary handle's read, never into the record. Answers an error, else nil.
function M.read_raw(ctx)
  local response = ctx.response
  local result = ctx.result
  local transfer = ctx.ctrl ~= nil and ctx.ctrl.transfer or nil
  local max = M.max_buffer(ctx)

  if vs.getpath(ctx.point, "response.binary") == true then
    result.body = nil
    if type(transfer) == "table" and transfer.direction == "read" then
      local bytes, err = M.read_bounded(ctx, response, max, "binary_too_large")
      if err ~= nil then
        return err
      end
      transfer.bytes = bytes
    end
    return nil
  end

  local text, err = M.read_bounded(ctx, response, max, "response_too_large")
  if err ~= nil then
    return err
  end
  result.body = { [media.RAW_BODY] = text }
  return nil
end


return M
