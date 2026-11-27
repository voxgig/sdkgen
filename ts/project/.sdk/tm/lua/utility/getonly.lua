-- ProjectName SDK utility: the GET-only guard, which the transport and the
-- secrets exchange both apply.

local ProjectNameError = require("core.error")

local GETONLY_ENV = "VOXGIG_GETONLY_GUARD"

-- A GET-only live run refuses any other method before it is sent. The error
-- names the path alone: the query can carry a credential.
local function getonly_refusal(fullurl, method)
  method = string.upper(tostring(method or ""))
  if method == "" then
    method = "GET"
  end
  if os.getenv(GETONLY_ENV) ~= "TRUE" or method == "GET" then
    return nil
  end
  local rest = fullurl
  local scheme = string.find(rest, "://", 1, true)
  if scheme then
    rest = string.gsub(string.sub(rest, scheme + 3), "^[^/?#]*", "")
  end
  local path = string.match(rest, "^[^?#]*")
  if path == "" then
    path = "/"
  end
  return ProjectNameError.new("fetch_getonly_block",
    "[GET-ONLY GUARD] blocked " .. method .. " " .. path)
end

return getonly_refusal
