-- ProjectName SDK utility: prepare_headers

local vs = require("utility.struct.struct")
local helpers = require("core.helpers")
local media = require("utility.media")

local function prepare_headers_util(ctx)
  local options = ctx.client:options_map()
  local headers = vs.getprop(options, "headers")

  local out = {}
  if headers ~= nil then
    local cloned = vs.clone(headers)
    if type(cloned) == "table" then
      out = cloned
    end
  end
  out = media.media_headers(ctx.point, out)

  -- A header argument replaces a default of the same name, whatever its case.
  for _, arg in ipairs(helpers.call_args(ctx, "header")) do
    if arg.val ~= nil then
      local wire = string.lower(arg.wire)
      for key in pairs(out) do
        if type(key) == "string" and string.lower(key) == wire then
          out[key] = nil
        end
      end
      out[wire] = vs.stringify(arg.val)
    end
  end

  -- A cookie argument travels in the cookie header as name=value, after any
  -- cookies the caller's headers already send.
  local cookies = {}
  for _, arg in ipairs(helpers.call_args(ctx, "cookie")) do
    if arg.val ~= nil then
      cookies[#cookies + 1] = arg.wire .. "=" .. vs.stringify(arg.val)
    end
  end
  if #cookies > 0 then
    local sent = {}
    for key, val in pairs(out) do
      if type(key) == "string" and string.lower(key) == "cookie" then
        if type(val) == "string" and val ~= "" then
          sent[#sent + 1] = val
        end
        out[key] = nil
      end
    end
    for _, cookie in ipairs(cookies) do
      sent[#sent + 1] = cookie
    end
    out["cookie"] = table.concat(sent, "; ")
  end

  return out
end

return prepare_headers_util
