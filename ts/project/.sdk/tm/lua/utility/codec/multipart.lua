-- ProjectName SDK body codec: multipart

local vs = require("utility.struct.struct")
local binary = require("utility.binary")

local MULTIPART_MEDIA = "multipart/form-data"
local OCTET_MEDIA = "application/octet-stream"
local CRLF = "\r\n"

local M = {}


-- Random bits from the operating system's source; math.random is not one.
function M.multipart_boundary(_ctx)
  local fh = io.open("/dev/urandom", "rb")
  if fh == nil then
    error("multipart: no random source for a boundary", 0)
  end
  local bytes = fh:read(16)
  fh:close()
  return (string.gsub(bytes, ".", function(c) return string.format("%02x", string.byte(c)) end))
end


-- Inside a quoted header parameter nothing may end the quote or the line.
local QUOTED = { ["\\"] = "%5C", ['"'] = "%22", ["\r"] = "%0D", ["\n"] = "%0A" }

local function quoted(text)
  return (string.gsub(text, '[\\"\r\n]', QUOTED))
end


-- A local path never leaves: only its last segment, and nothing for an empty one.
local function base_name(name)
  if type(name) ~= "string" then
    return nil
  end
  local base = string.match(name, "([^/\\]*)$")
  if base == nil or base == "" then
    return nil
  end
  return base
end


local function file_part(ctx, name, field, value)
  local content, filename, ptype = value, nil, nil
  if binary.is_source(value) then
    content, filename, ptype = value.data, base_name(value.name), value.type
  end
  if type(content) == "userdata" or type(content) == "function" then
    return nil, ctx:make_error("binary_feature_inactive", 'The multipart field "' .. name ..
      '" holds a stream, which needs the binary feature: pass bytes, a Blob or a source.')
  end
  if ptype == nil then
    ptype = type(field.media) == "string" and field.media or OCTET_MEDIA
  end
  return { filename = filename, type = ptype, content = binary.item_text(content) }, nil
end


local function text_part(field, value)
  return { type = type(field.media) == "string" and field.media or nil,
    content = binary.item_text(value) }
end


-- Answers ({ type, body }, nil) or (nil, error).
function M.encode_multipart(ctx, data, lifted)
  local body = vs.getprop(ctx.point, "body")
  local boundary = ctx.utility.multipart_boundary(ctx)
  local out = {}

  for _, item in ipairs(binary.body_items(body, data, lifted)) do
    local part, err
    if item.binary then
      part, err = file_part(ctx, item.name, item.field, item.value)
      if err ~= nil then
        return nil, err
      end
    else
      part = text_part(item.field, item.value)
    end

    if type(part.type) == "string" and string.find(part.type, "[\r\n]") then
      return nil, ctx:make_error("binary_source_refused", 'The media type of the multipart field "' ..
        item.name .. '" contains a line break.')
    end

    out[#out + 1] = "--" .. boundary .. CRLF ..
      'Content-Disposition: form-data; name="' .. quoted(item.name) .. '"' ..
      (part.filename == nil and "" or '; filename="' .. quoted(part.filename) .. '"') .. CRLF ..
      (part.type == nil and "" or "Content-Type: " .. part.type .. CRLF) .. CRLF ..
      part.content .. CRLF
  end

  out[#out + 1] = "--" .. boundary .. "--" .. CRLF

  local declared = vs.getprop(body, "media")
  declared = string.match(string.match(type(declared) == "string" and declared or "", "^[^;]*"),
    "^%s*(.-)%s*$")
  local mtype = (declared == "" and MULTIPART_MEDIA or declared) .. "; boundary=" .. boundary
  return { type = mtype, body = table.concat(out) }, nil
end


return M
