-- ProjectName SDK utility: clean
--
-- Everything that leaves the pipeline passes through clean; inside it data
-- stays raw, so a hook can still read the header it must add to. The lua
-- port of tm/ts/src/utility/CleanUtility.ts.

local json = require("dkjson")

local MAXDEPTH = 32
local CIRCULAR = "[circular]"

-- The schema's own default, for a context that reaches clean before any
-- options exist (the raw template tree has no generated schema to read).
local DEFAULT_KEYS = "key,secret,token,password,passwd,authorization,cookie,credential,signature"

local B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"


local function base64(text)
  local out = {}
  local size = #text
  local index = 1

  while index <= size do
    local rest = size - index + 1
    local a = string.byte(text, index)
    local b = string.byte(text, index + 1) or 0
    local c = string.byte(text, index + 2) or 0
    local word = (a << 16) | (b << 8) | c

    local chunk = {}
    for shift = 18, 0, -6 do
      local at = (word >> shift) & 0x3f
      chunk[#chunk + 1] = string.sub(B64_ALPHABET, at + 1, at + 1)
    end

    if rest == 1 then
      chunk[3] = "="
      chunk[4] = "="
    elseif rest == 2 then
      chunk[4] = "="
    end

    out[#out + 1] = table.concat(chunk)
    index = index + 3
  end

  return table.concat(out)
end


-- encodeURIComponent: everything but the RFC 3986 unreserved set and !*'().
local function percent_encode(text)
  return (string.gsub(text, "[^%w%-_%.~!%*'%(%)]", function(c)
    return string.format("%%%02X", string.byte(c))
  end))
end


local function json_escape(text)
  local ok, encoded = pcall(json.encode, text)
  if ok and type(encoded) == "string" and #encoded >= 2 then
    return string.sub(encoded, 2, -2)
  end
  return text
end


local function trim(s)
  return (string.match(s, "^%s*(.-)%s*$"))
end


local function normkey(key)
  return (string.gsub(string.lower(tostring(key)), "[-_]", ""))
end


local function splitkeys(keys)
  local out = {}
  if keys == nil then
    return out
  end
  for part in string.gmatch(tostring(keys), "[^,]+") do
    local k = normkey(trim(part))
    if k ~= "" then
      out[#out + 1] = k
    end
  end
  return out
end


local function splitvalues(values)
  local out = {}
  if type(values) == "table" then
    for _, v in ipairs(values) do
      if type(v) == "string" then
        out[#out + 1] = v
      end
    end
    return out
  end
  if values == nil then
    return out
  end
  for part in string.gmatch(tostring(values), "[^,]+") do
    local v = trim(part)
    if v ~= "" then
      out[#out + 1] = v
    end
  end
  return out
end


local function count(val, dflt)
  local n = tonumber(val)
  if n == nil or n < 0 then
    return dflt
  end
  return math.floor(n)
end


local function make_clean_config(cleanopts)
  local opts = type(cleanopts) == "table" and cleanopts or {}
  return {
    active = opts.active ~= false,
    keys = splitkeys(opts.keys == nil and DEFAULT_KEYS or opts.keys),
    values = {},
    mask = type(opts.mask) == "string" and opts.mask or "[redacted]",
    hint = count(opts.hint, 0),
    min = math.max(1, count(opts.min, 4)),
  }
end


-- A context without options (make_error accepts a bare one) still masks by
-- the schema defaults.
local function clean_config(ctx)
  if type(ctx) == "table" and type(ctx.options) == "table" then
    local derived = ctx.options["__derived__"]
    if type(derived) == "table" and type(derived.clean) == "table"
      and type(derived.clean.values) == "table"
    then
      return derived.clean
    end
  end

  local ok, schema = pcall(require, "schema")
  local spec = nil
  if ok and type(schema) == "table" and type(schema.OPTSPEC) == "table" then
    spec = schema.OPTSPEC.clean
  end
  return make_clean_config(spec)
end


local function contains(list, value)
  for _, v in ipairs(list) do
    if v == value then
      return true
    end
  end
  return false
end


-- The encoded forms a value travels in.
local function forms(value)
  local out = { value }
  for _, form in ipairs({ base64(value), percent_encode(value), json_escape(value) }) do
    if form ~= "" and not contains(out, form) then
      out[#out + 1] = form
    end
  end
  return out
end


local function clean_add_util(ctx, value)
  local cfg = clean_config(ctx)
  if type(value) ~= "string" or #value < cfg.min then
    return
  end
  local changed = false
  for _, form in ipairs(forms(value)) do
    if #form >= cfg.min and not contains(cfg.values, form) then
      cfg.values[#cfg.values + 1] = form
      changed = true
    end
  end
  if changed then
    table.sort(cfg.values, function(a, b) return #a > #b end)
  end
end


local function mask_value(cfg, value)
  if 0 < cfg.hint and #value > 2 * cfg.hint then
    return cfg.mask .. string.sub(value, -cfg.hint)
  end
  return cfg.mask
end


local function replace_all(text, needle, repl)
  local out = {}
  local start = 1
  while true do
    local i, j = string.find(text, needle, start, true)
    if i == nil then
      break
    end
    out[#out + 1] = string.sub(text, start, i - 1)
    out[#out + 1] = repl
    start = j + 1
  end
  out[#out + 1] = string.sub(text, start)
  return table.concat(out)
end


local function clean_string(cfg, text)
  local out = text
  for _, value in ipairs(cfg.values) do
    if string.find(out, value, 1, true) ~= nil then
      out = replace_all(out, value, mask_value(cfg, value))
    end
  end
  return out
end


local function sensitive_key(cfg, key)
  if key == nil or type(key) == "number" then
    return false
  end
  local nk = normkey(key)
  for _, k in ipairs(cfg.keys) do
    if string.find(nk, k, 1, true) ~= nil then
      return true
    end
  end
  return false
end


-- A masked plain-data copy: an object's own record (to_record) honoured,
-- functions dropped, cycles cut, and nothing shared with the live value,
-- whose spec must stay raw.
local function snapshot(cfg, val, key, depth, seen)
  local t = type(val)

  if val == nil then
    return nil
  end

  if t == "string" then
    if sensitive_key(cfg, key) then
      return mask_value(cfg, val)
    end
    return clean_string(cfg, val)
  end

  if t == "function" or t == "thread" or t == "userdata" then
    return nil
  end

  if t ~= "table" then
    if sensitive_key(cfg, key) then
      return cfg.mask
    end
    return val
  end

  if MAXDEPTH <= depth or seen[val] then
    return CIRCULAR
  end

  if sensitive_key(cfg, key) then
    return cfg.mask
  end

  seen[val] = true

  local mt = getmetatable(val)
  if mt ~= nil and type(mt.to_record) == "function" then
    local record = mt.to_record(val)
    if type(record) == "table" and record ~= val then
      local out = snapshot(cfg, record, key, depth + 1, seen)
      seen[val] = nil
      return out
    end
  end

  local out = {}
  for k, v in pairs(val) do
    local cv = snapshot(cfg, v, k, depth + 1, seen)
    if cv ~= nil then
      out[k] = cv
    end
  end

  seen[val] = nil
  return out
end


-- An SDK error is cleaned in place, since it is about to be returned.
local function clean_util(ctx, val)
  local cfg = clean_config(ctx)

  if cfg.active == false then
    return val
  end

  if type(val) == "string" then
    return clean_string(cfg, val)
  end

  if type(val) == "table" and val.is_sdk_error == true then
    for k, v in pairs(val) do
      if type(v) == "string" then
        if k ~= "msg" and sensitive_key(cfg, k) then
          val[k] = mask_value(cfg, v)
        else
          val[k] = clean_string(cfg, v)
        end
      elseif type(v) == "table" then
        val[k] = snapshot(cfg, v, k, 1, {})
      end
    end
    return val
  end

  return snapshot(cfg, val, nil, 0, {})
end


local function clean_key_util(ctx, key)
  return sensitive_key(clean_config(ctx), key)
end


return {
  clean = clean_util,
  clean_add = clean_add_util,
  clean_key = clean_key_util,
  make_clean_config = make_clean_config,
  splitvalues = splitvalues,
}
