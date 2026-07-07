-- ProjectName SDK error

local ProjectNameError = {}
ProjectNameError.__index = ProjectNameError


function ProjectNameError.new(code, msg, ctx)
  local self = setmetatable({}, ProjectNameError)
  self.is_sdk_error = true
  self.sdk = "ProjectName"
  self.code = code or ""
  self.msg = msg or ""
  self.ctx = ctx
  self.result = nil
  self.spec = nil
  return self
end


function ProjectNameError:error()
  return self.msg
end


function ProjectNameError:__tostring()
  return self.msg
end


return ProjectNameError
