-- ProjectName SDK utility: prepare_body

local vs = require("utility.struct.struct")
local media = require("utility.media")
local binary = require("utility.binary")

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

-- The encoded body, with its content type replacing any the headers carry:
-- a multipart boundary is the encoder's alone to choose.
local function encode_body(ctx, kind, data)
  local codec = ctx.utility.codec
  local encode = type(codec) == "table" and codec[kind] or nil
  if type(encode) ~= "function" then
    return nil, ctx:make_error("body_codec_missing",
      "This SDK was generated without a " .. kind .. " encoder.")
  end

  local encoded, err = encode(ctx, data, ctx.sources or {})
  if err ~= nil then
    return nil, err
  end

  local headers = ctx.spec ~= nil and ctx.spec.headers or nil
  if type(headers) == "table" then
    local drop = {}
    for key in pairs(headers) do
      if type(key) == "string" and string.lower(key) == "content-type" then
        drop[#drop + 1] = key
      end
    end
    for _, key in ipairs(drop) do
      headers[key] = nil
    end
    headers["content-type"] = encoded.type
  end
  return encoded.body, nil
end

-- Answers the body, or nil and an error for make_spec to raise.
local function prepare_body_util(ctx)
  local op = ctx.op

  if op.input == "data" then
    local refused = binary.lift_sources(ctx)
    if refused ~= nil then
      return nil, refused
    end

    if media.is_raw_request(ctx.point) then
      local raw = media.raw_body(ctx.sources)
      if binary.is_source(raw) then
        return raw.data
      end
      return raw
    end
    local body = ctx.utility.transform_request(ctx)
    local kind = vs.getpath(ctx.point, "body.kind")
    if kind == "form" or kind == "multipart" then
      return encode_body(ctx, kind, body)
    end
    return body
  end

  local fields = ctx.point ~= nil and vs.getprop(ctx.point, "fields") or nil
  if type(fields) == "table" and 0 < #fields then
    return match_body(ctx, fields)
  end

  return nil
end

return prepare_body_util
