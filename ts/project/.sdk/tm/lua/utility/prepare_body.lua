-- ProjectName SDK utility: prepare_body

local vs = require("utility.struct.struct")
local media = require("utility.media")

-- A list, load or remove routed to a method with a body sends the match
-- fields that body declares, never a path parameter, and never a header,
-- cookie or query argument the body does not also declare as a field.
local function match_body(ctx, fields)
  local point = ctx.point
  local routed = {}
  local params = vs.getprop(point, "params")
  if type(params) == "table" then
    for _, name in ipairs(params) do
      routed[name] = true
    end
  end
  for _, kind in ipairs({ "params", "header", "cookie", "query" }) do
    local defs = vs.getpath(point, "args." .. kind)
    if type(defs) == "table" then
      for _, ad in ipairs(defs) do
        local name = vs.getprop(ad, "name")
        if name ~= nil and (kind == "params" or vs.getprop(ad, "field") ~= true) then
          routed[name] = true
        end
      end
    end
  end

  local body = {}
  for _, name in ipairs(fields) do
    local val = vs.getprop(ctx.reqmatch or {}, name)
    if val ~= nil and name ~= "$action" and not routed[name] then
      body[name] = val
    end
  end
  return body
end

local function prepare_body_util(ctx)
  local op = ctx.op

  if op.input == "data" then
    if media.is_raw_request(ctx.point) then
      return media.raw_body(ctx.reqdata)
    end
    local body = ctx.utility.transform_request(ctx)
    return body
  end

  local fields = ctx.point ~= nil and vs.getprop(ctx.point, "fields") or nil
  if type(fields) == "table" and 0 < #fields then
    return match_body(ctx, fields)
  end

  return nil
end

return prepare_body_util
