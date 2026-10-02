-- ProjectName SDK helpers

local vs = require("utility.struct.struct")

local helpers = {}


function helpers.to_map(v)
  if type(v) == "table" then
    return v
  end
  return nil
end


function helpers.to_int(v)
  if type(v) == "number" then
    return math.floor(v)
  end
  return -1
end


function helpers.get_ctx_prop(m, key)
  if m == nil then
    return nil
  end
  return m[key]
end


-- The arguments a point declares in one location, query or header, each as
-- { name, wire, val }: the name it travels under and the value this call
-- passes in its match or else its data. Unlike a path parameter, the entity's
-- stored match and data never supply one.
function helpers.call_args(ctx, kind)
  local out = {}
  local defs = ctx.point ~= nil and vs.getpath(ctx.point, "args." .. kind) or nil
  if type(defs) ~= "table" then
    return out
  end
  for _, ad in ipairs(defs) do
    local name = vs.getprop(ad, "name")
    if type(name) == "string" and name ~= "" then
      local wire = vs.getprop(ad, "orig")
      if type(wire) ~= "string" or wire == "" then
        wire = name
      end
      local val = vs.getprop(ctx.reqmatch or {}, name)
      if val == nil then
        val = vs.getprop(ctx.reqdata or {}, name)
      end
      out[#out + 1] = { name = name, wire = wire, val = val }
    end
  end
  return out
end


return helpers
