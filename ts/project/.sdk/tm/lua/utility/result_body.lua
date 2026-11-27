-- ProjectName SDK utility: result_body

local vs = require("utility.struct.struct")
local unreadable_body = require("utility.unreadable_body")

local function result_body_util(ctx)
  local response = ctx.response
  local result = ctx.result

  local codec = ctx.utility ~= nil and ctx.utility.codec or nil
  local raw = type(codec) == "table" and codec.raw or nil
  if result ~= nil and response ~= nil and type(raw) == "function"
      and vs.getpath(ctx.point, "response.kind") == "raw"
      and result.err == nil and response.err == nil and (result.status or 0) < 400 then
    local err = raw(ctx)
    if err ~= nil then
      result.err = err
    end
    return result
  end

  if result ~= nil then
    if response ~= nil and response.json_func ~= nil and response.body ~= nil then
      local json_data = response.json_func()
      result.body = json_data
    end
    if response ~= nil and response.unreadable then
      local sent = ctx.spec ~= nil and ctx.spec.headers or nil
      result.err = unreadable_body(ctx, result.status, result.headers, response.body,
        sent, result.err)
    end
  end

  return result
end

return result_body_util
