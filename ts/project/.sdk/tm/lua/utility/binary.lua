-- ProjectName SDK utility: binary

local vs = require("utility.struct.struct")
local media = require("utility.media")

local M = {}

local MAXDEPTH = 32
local NULLMARK = "__NULL__"


-- File content a caller hands the SDK. A string is the only carrier of
-- bytes here, so a source is a table of its own type, which tells file
-- content from any other string: nothing here reads a path.
local BinarySource = {}
BinarySource.__index = BinarySource
M.BinarySource = BinarySource


-- A source serialised anywhere is described, never copied.
local function describe(self)
  return { ["binary$"] = "bytes", size = #self.data, type = self.type }
end

BinarySource.to_record = describe
BinarySource.__tojson = function(self)
  return require("dkjson").encode(describe(self))
end
BinarySource.__tostring = function(self)
  return "BinarySource " .. tostring(#self.data) .. " bytes"
end


function M.is_source(value)
  return getmetatable(value) == BinarySource
end


-- The one source core builds: `client.binary.bytes(data, { name =, type = })`.
M.binary = {
  bytes = function(data, opts)
    opts = type(opts) == "table" and opts or {}
    local self = setmetatable({ kind = "bytes" }, BinarySource)
    self.data = data == nil and "" or tostring(data)
    if type(opts.name) == "string" then
      self.name = opts.name
    end
    if type(opts.type) == "string" and opts.type ~= "" then
      self.type = opts.type
    end
    return self
  end,
}


local function sorted_keys(tbl)
  local keys = {}
  for k in pairs(tbl) do
    keys[#keys + 1] = k
  end
  table.sort(keys, function(a, b)
    if type(a) == type(b) then
      return a < b
    end
    return type(a) == "number"
  end)
  return keys
end


-- The path of the first source in a value, or nil.
local function source_at(value, path, depth, seen)
  if type(value) ~= "table" or MAXDEPTH <= depth or seen[value] then
    return nil
  end
  if M.is_source(value) then
    return path
  end
  seen[value] = true
  for _, key in ipairs(sorted_keys(value)) do
    local kp = type(key) == "number" and tostring(key - 1) or tostring(key)
    local found = source_at(value[key], path == "" and kp or path .. "." .. kp, depth + 1, seen)
    if found ~= nil then
      return found
    end
  end
  return nil
end


-- The data keys whose values are file content: a multipart or form body's
-- binary fields, and the whole of a raw body.
function M.binary_names(point)
  local body = vs.getprop(point, "body")
  local kind = vs.getprop(body, "kind")
  if kind == "raw" then
    return { media.RAW_BODY }
  end
  local names = {}
  if kind == "multipart" or kind == "form" then
    local fields = vs.getprop(body, "fields")
    for _, field in ipairs(type(fields) == "table" and fields or {}) do
      if type(field) == "table" and field.binary == true and type(field.name) == "string" then
        names[#names + 1] = field.name
      end
    end
  end
  return names
end


-- Moves the values of binary fields out of the request data, before a hook,
-- a transform, validation or clean reads it. A source anywhere else is
-- refused: answers the error, else nil.
function M.lift_sources(ctx)
  if ctx.sources ~= nil then
    return nil
  end

  local lifted = {}
  local reqdata = ctx.reqdata
  if type(reqdata) == "table" then
    local copy = nil
    for _, name in ipairs(M.binary_names(ctx.point)) do
      if reqdata[name] ~= nil then
        if copy == nil then
          copy = {}
          for k, v in pairs(reqdata) do
            copy[k] = v
          end
        end
        lifted[name] = copy[name]
        copy[name] = nil
      end
    end
    reqdata = copy or reqdata
  end

  local stray = source_at(reqdata, "", 0, {}) or source_at(ctx.reqmatch, "", 0, {})
  if stray ~= nil then
    return ctx:make_error("binary_source_refused", 'A binary source was passed in "' ..
      stray .. '", which is not a field the operation declares binary.')
  end

  ctx.reqdata = reqdata
  ctx.sources = lifted
  return nil
end


-- A response the model declares to be bytes is read only through the
-- entity's binary handle, never into its data.
function M.bytes_refused(ctx)
  local response = vs.getprop(ctx.point, "response")
  if vs.getprop(response, "kind") ~= "raw" or vs.getprop(response, "binary") ~= true
      or (ctx.ctrl ~= nil and ctx.ctrl.transfer ~= nil) then
    return nil
  end
  local action = vs.getprop(vs.getprop(ctx.point, "select"), "$action")
  local call = action == nil and "binary()" or "binary('" .. tostring(action) .. "')"
  local op = ctx.op or {}
  return ctx:make_error("binary_sink_required", 'Operation "' .. tostring(op.name) ..
    '" on entity "' .. tostring(op.entity) .. '" answers bytes, which never enter the ' ..
    "entity's data: read them with entity:" .. call .. ":bytes().")
end


local function absent(value)
  return value == nil or value == NULLMARK
end


-- A plain value as the text of a form pair or a multipart part.
function M.item_text(value)
  local t = type(value)
  if t == "string" then
    return value
  end
  if t == "number" then
    if value % 1 == 0 and value == value and value ~= math.huge and value ~= -math.huge then
      return string.format("%d", value)
    end
    return tostring(value)
  end
  if t == "boolean" then
    return tostring(value)
  end
  return vs.jsonify(value, { indent = 0 })
end


-- The values a form or multipart body carries, in wire order: the fields the
-- model declares, in its order, then any other key of the data, in code point
-- order. An array repeats its field per item, or is one value joined by the
-- field's `join`; an absent or null value sends nothing.
function M.body_items(body, data, lifted)
  local fields = {}
  local declared = {}
  local fdefs = vs.getprop(body, "fields")
  for _, field in ipairs(type(fdefs) == "table" and fdefs or {}) do
    if type(field) == "table" and type(field.name) == "string" then
      fields[#fields + 1] = field
      declared[field.name] = field
    end
  end
  local plain = type(data) == "table" and not M.is_source(data) and data or {}
  lifted = lifted or {}

  local names = {}
  for _, field in ipairs(fields) do
    if plain[field.name] ~= nil or lifted[field.name] ~= nil then
      names[#names + 1] = field.name
    end
  end
  local rest = {}
  for key in pairs(plain) do
    if type(key) == "string" and declared[key] == nil then
      rest[#rest + 1] = key
    end
  end
  table.sort(rest)
  for _, key in ipairs(rest) do
    names[#names + 1] = key
  end

  local items = {}
  for _, name in ipairs(names) do
    local field = declared[name] or { name = name }
    local value = lifted[name]
    if value == nil then
      value = plain[name]
    end
    local file = field.binary == true
    if not absent(value) then
      if type(value) == "table" and not M.is_source(value) and vs.islist(value) then
        local present = {}
        for _, item in ipairs(value) do
          if not absent(item) then
            present[#present + 1] = item
          end
        end
        if not file and type(field.join) == "string" then
          local texts = {}
          for i, item in ipairs(present) do
            texts[i] = M.item_text(item)
          end
          items[#items + 1] = { name = name, field = field, binary = file,
            value = table.concat(texts, field.join) }
        else
          for _, item in ipairs(present) do
            items[#items + 1] = { name = name, field = field, binary = file, value = item }
          end
        end
      else
        items[#items + 1] = { name = name, field = field, binary = file, value = value }
      end
    end
  end
  return items
end


return M
