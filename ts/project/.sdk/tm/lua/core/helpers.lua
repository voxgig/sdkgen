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


-- The name a point gives a parameter in the call, if it renames it.
function helpers.param_alias(point, key)
  local alias = point ~= nil and helpers.to_map(vs.getprop(point, "alias")) or nil
  local ak = alias ~= nil and vs.getprop(alias, key) or nil
  return type(ak) == "string" and ak or ""
end


-- The value the call or its entity gives a point's parameter, under its name
-- or the point's alias for it.
function helpers.param_value(ctx, point, key)
  local akey = helpers.param_alias(point, key)

  local val = vs.getprop(ctx.reqmatch, key)

  if val == nil then
    val = vs.getprop(ctx.match, key)
  end

  if val == nil and akey ~= "" then
    val = vs.getprop(ctx.reqmatch, akey)
  end

  if val == nil then
    val = vs.getprop(ctx.reqdata, key)
  end

  if val == nil then
    val = vs.getprop(ctx.data, key)
  end

  if val == nil and akey ~= "" then
    val = vs.getprop(ctx.reqdata, akey)
    if val == nil then
      val = vs.getprop(ctx.data, akey)
    end
  end

  return val
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


-- The caller's cookie pieces with every named cookie removed. A piece whose
-- &-parts are all pairs is the exploded form cookie_pair writes, and loses
-- only the pairs named; any other piece is one cookie, kept or dropped whole.
function helpers.cookie_keep(header, names)
  local function named(part)
    return names[part:match("^([^=]*)"):match("^%s*(.-)%s*$")] == true
  end
  local kept = {}
  for piece in string.gmatch(header .. ";", "([^;]*);") do
    local rest = {}
    local pairs_only = true
    for part in string.gmatch(piece .. "&", "([^&]*)&") do
      if not part:find("=", 1, true) then pairs_only = false end
    end
    if pairs_only then
      for part in string.gmatch(piece .. "&", "([^&]*)&") do
        if not named(part) then rest[#rest + 1] = part end
      end
    elseif not named(piece) then
      rest[#rest + 1] = piece
    end
    local cookie = table.concat(rest, "&"):match("^%s*(.-)%s*$")
    if cookie ~= "" then kept[#kept + 1] = cookie end
  end
  return kept
end


return helpers
