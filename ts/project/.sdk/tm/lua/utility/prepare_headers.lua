-- ProjectName SDK utility: prepare_headers

local vs = require("utility.struct.struct")

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

  -- A header parameter travels as a header, under the name the definition
  -- gives it, and only from this call's own arguments.
  local hl = ctx.point ~= nil and vs.getpath(ctx.point, "args.header") or nil
  if type(hl) == "table" then
    for _, hd in ipairs(hl) do
      local name = vs.getprop(hd, "name")
      if type(name) == "string" and name ~= "" then
        local orig = vs.getprop(hd, "orig")
        if type(orig) ~= "string" or orig == "" then
          orig = name
        end
        local val = vs.getprop(ctx.reqmatch or {}, name)
        if val == nil then
          val = vs.getprop(ctx.reqdata or {}, name)
        end
        if val ~= nil then
          out[string.lower(orig)] = vs.stringify(val)
        end
      end
    end
  end

  return out
end

return prepare_headers_util
