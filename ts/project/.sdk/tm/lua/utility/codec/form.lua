-- ProjectName SDK body codec: form

local vs = require("utility.struct.struct")
local binary = require("utility.binary")

local FORM_MEDIA = "application/x-www-form-urlencoded"

local M = {}


-- application/x-www-form-urlencoded byte serialisation: alphanumerics and
-- `*-._` as they are, a space as `+`, every other byte as %HH.
function M.form_escape(bytes)
  return (string.gsub(bytes, "[^A-Za-z0-9%*%-%._]", function(c)
    if c == " " then
      return "+"
    end
    return string.format("%%%02X", string.byte(c))
  end))
end


local function form_value(ctx, name, value)
  local content = binary.is_source(value) and value.data or value
  if type(content) == "userdata" or type(content) == "function" then
    return nil, ctx:make_error("binary_source_refused", 'The form field "' .. name ..
      '" holds a Blob or a stream, which a form body cannot carry: pass its bytes.')
  end
  return binary.item_text(content), nil
end


-- Answers ({ type, body }, nil) or (nil, error).
function M.encode_form(ctx, data, lifted)
  local body = vs.getprop(ctx.point, "body")
  local pairs_out = {}

  for _, item in ipairs(binary.body_items(body, data, lifted)) do
    local value, err = form_value(ctx, item.name, item.value)
    if err ~= nil then
      return nil, err
    end
    pairs_out[#pairs_out + 1] = M.form_escape(item.name) .. "=" .. M.form_escape(value)
  end

  local mtype = vs.getprop(body, "media")
  if type(mtype) ~= "string" or mtype == "" then
    mtype = FORM_MEDIA
  end
  return { type = mtype, body = table.concat(pairs_out, "&") }, nil
end


return M
