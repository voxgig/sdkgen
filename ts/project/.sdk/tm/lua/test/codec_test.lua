-- ProjectName SDK body codec test
--
-- Every form, multipart and raw point this SDK has, driven through a real
-- entity operation against a local listener that decodes what arrives. The
-- cases come from the client's own config, so no case names an entity. The
-- listener is a second Lua process: the transport blocks this one.

local sdk = require("project-name-_sdk")

local PROBE = sdk.new({ base = "http://127.0.0.1:1" })
local CONFIG = PROBE:get_root_ctx().config


-- The interpreter running this suite, for the listener.
local function interpreter()
  if os.getenv("LUA") ~= nil then
    return os.getenv("LUA")
  end
  local i = -1
  while arg ~= nil and arg[i - 1] ~= nil do
    i = i - 1
  end
  local first = arg ~= nil and arg[i] or nil
  if type(first) == "string" and first:match("lua[%d%.]*$") then
    return first
  end
  return "lua"
end


local LISTENER = [[
local socket = require("socket")
local answer = dofile(arg[1])
local server = assert(socket.bind("127.0.0.1", 0))
local _, port = server:getsockname()
io.write(port, "\n")
io.flush()
server:settimeout(30)
local conn = assert(server:accept())
conn:settimeout(30)
local line = conn:receive("*l")
local headers = {}
while true do
  local h = conn:receive("*l")
  if h == nil or h == "" then break end
  local k, v = h:match("^([^:]+):%s*(.*)$")
  if k ~= nil then headers[k:lower()] = v end
end
local body = ""
local len = tonumber(headers["content-length"] or "0") or 0
if 0 < len then body = conn:receive(len) or "" end
local out = answer.body or ""
conn:send("HTTP/1.1 " .. (answer.status or 200) .. " OK\r\nContent-Type: " ..
  (answer.type or "application/json") .. "\r\nContent-Length: " .. #out ..
  "\r\nConnection: close\r\n\r\n" .. out)
conn:close()
local hex = function(s) return (s:gsub(".", function(c) return string.format("%02x", c:byte()) end)) end
io.write(hex(line or ""), "\n", hex(headers["content-type"] or ""), "\n", hex(body), "\n")
]]


local function unhex(s)
  return (s:gsub("%x%x", function(h) return string.char(tonumber(h, 16)) end))
end


local function lua_string(s)
  return string.format("%q", s)
end


-- One listener per request: it answers one connection with the given answer
-- and reports what arrived.
local function serve(answer)
  local script = os.tmpname()
  local f = assert(io.open(script, "w"))
  f:write(LISTENER)
  f:close()
  local afile = os.tmpname()
  f = assert(io.open(afile, "w"))
  f:write("return { status = ", tostring(answer.status or 200), ", type = ",
    lua_string(answer.type or "application/json"), ", body = ", lua_string(answer.body or ""), " }")
  f:close()
  local proc = assert(io.popen(interpreter() .. " " .. script .. " " .. afile, "r"))
  local port = proc:read("*l")
  assert(port ~= nil, "the listener did not start")
  return {
    base = "http://127.0.0.1:" .. port,
    arrived = function()
      local line = proc:read("*l")
      local ctype = proc:read("*l")
      local body = proc:read("*l")
      proc:close()
      os.remove(script)
      os.remove(afile)
      assert(line ~= nil, "nothing arrived")
      return { line = unhex(line), type = unhex(ctype or ""), body = unhex(body or "") }
    end,
  }
end


local function accessors(client)
  local out = {}
  for name in pairs(CONFIG.entity) do
    local accessor = name:gsub("_(%l)", string.upper):gsub("^%l", string.upper)
    local ok, ent = pcall(function() return client[accessor](client) end)
    if ok and type(ent) == "table" and ent.get_name ~= nil and ent:get_name() == name then
      out[name] = accessor
    end
  end
  return out
end


-- A value for each path parameter a point names.
local function params(point)
  local out = {}
  for _, part in ipairs(point.parts or {}) do
    local name = type(part) == "string" and part:match("^{(.+)}$") or nil
    if name ~= nil then
      out[name] = "p1"
    end
  end
  return out
end


local function action_of(point)
  return type(point.select) == "table" and point.select["$action"] or nil
end


local function merge(...)
  local out = {}
  for _, t in ipairs({ ... }) do
    for k, v in pairs(t) do
      out[k] = v
    end
  end
  return out
end


local function select_of(point)
  local action = action_of(point)
  return action == nil and {} or { ["$action"] = action }
end


local function content(name)
  return "file:" .. name .. "\0\255\r\n--"
end


-- The data a form or multipart point is sent, and the parts it must arrive as.
local function plan(client, body)
  local data, expect = {}, {}
  local form = body.kind == "form"
  for _, field in ipairs(body.fields or {}) do
    local name = field.name
    if field.binary == true then
      local ftype = (not form) and (field.media or "application/octet-stream") or nil
      data[name] = client.binary.bytes(content(name), { name = "/local/dir/" .. name .. ".bin", type = ftype })
      expect[#expect + 1] = form and { name = name, value = content(name) } or
        { name = name, file = content(name), filename = name .. ".bin", type = ftype }
    elseif field.list == true then
      data[name] = { "a", "b c" }
      expect[#expect + 1] = { name = name, value = "a" }
      expect[#expect + 1] = { name = name, value = "b c" }
    elseif type(field.join) == "string" then
      data[name] = { "a", "b" }
      expect[#expect + 1] = { name = name, value = "a" .. field.join .. "b" }
    else
      data[name] = 'v"' .. name .. "\r\n"
      expect[#expect + 1] = { name = name, value = 'v"' .. name .. "\r\n" }
    end
  end
  return data, expect
end


local function plain_find(s, needle, init)
  return string.find(s, needle, init, true)
end


local function multipart_parts(arrived)
  local boundary = arrived.type:match("boundary=([^;]+)")
  assert(boundary ~= nil, "no boundary in " .. arrived.type)
  local text = arrived.body
  local close = "--" .. boundary .. "--\r\n"
  assert(text:sub(-#close) == close, "the body does not close")
  local delim = "--" .. boundary
  local parts = {}
  local at = select(2, plain_find(text, delim, 1)) + 1
  while true do
    local nxt = plain_find(text, delim, at)
    if nxt == nil then break end
    local chunk = text:sub(at, nxt - 1)
    at = nxt + #delim
    local headend = plain_find(chunk, "\r\n\r\n", 1)
    local head = chunk:sub(3, headend - 1)
    local body = chunk:sub(headend + 4, -3)
    local name, filename, ctype
    for line in (head .. "\r\n"):gmatch("(.-)\r\n") do
      local n, rest = line:match('^Content%-Disposition: form%-data; name="([^"]*)"(.*)$')
      if n ~= nil then
        name = n
        filename = rest:match('^; filename="([^"]*)"$')
      end
      ctype = line:match("^Content%-Type: (.*)$") or ctype
    end
    assert(name ~= nil, "a part without a disposition: " .. head)
    parts[#parts + 1] = filename ~= nil and { name = name, file = body, filename = filename, type = ctype }
      or { name = name, value = body }
    if text:sub(at, at + 1) == "--" then break end
  end
  return parts
end


local function form_pairs(text)
  local out = {}
  for pair in text:gmatch("[^&]+") do
    local n, v = pair:match("^([^=]*)=?(.*)$")
    local dec = function(s)
      return (s:gsub("+", " "):gsub("%%(%x%x)", function(h) return string.char(tonumber(h, 16)) end))
    end
    out[#out + 1] = { name = dec(n), value = dec(v) }
  end
  return out
end


local function only(list, expect)
  local want = {}
  for _, e in ipairs(expect) do
    want[e.name] = true
  end
  local out = {}
  for _, g in ipairs(list) do
    if want[g.name] then
      out[#out + 1] = g
    end
  end
  return out
end


local function sorted(tbl)
  local keys = {}
  for k in pairs(tbl) do keys[#keys + 1] = k end
  table.sort(keys)
  return keys
end


local function cases()
  local out = {}
  local acc = accessors(PROBE)
  for _, ename in ipairs(sorted(CONFIG.entity)) do
    local accessor = acc[ename]
    local ops = accessor ~= nil and (CONFIG.entity[ename].op or {}) or {}
    for _, opname in ipairs(sorted(ops)) do
      for _, point in ipairs(ops[opname].points or {}) do
        local action = action_of(point)
        local label = ename .. "." .. opname .. (action == nil and "" or ":" .. action)
        local rb, rs = point.body, point.response
        local writes = opname == "create" or opname == "update" or opname == "patch"

        if type(rb) == "table" and writes and (rb.kind == "form" or rb.kind == "multipart") then
          out[#out + 1] = { name = label .. " sends a " .. rb.kind .. " body", run = function()
            local net = serve({ body = '{"id":"p1"}' })
            local client = sdk.new({ base = net.base })
            local data, expect = plan(client, rb)
            local ent = client[accessor](client)
            local _, err = ent[opname](ent, merge(params(point), select_of(point), data))
            local arrived = net.arrived()
            assert.is_nil(err)
            if rb.kind == "form" then
              assert.are.equal(rb.media, arrived.type)
              local want = {}
              for i, e in ipairs(expect) do want[i] = { name = e.name, value = e.value } end
              assert.are.same(want, only(form_pairs(arrived.body), expect))
            else
              assert.are.same(expect, only(multipart_parts(arrived), expect))
            end
          end }
        end

        if type(rb) == "table" and writes and rb.kind == "raw" then
          out[#out + 1] = { name = label .. " sends a raw " .. (rb.binary == true and "binary" or "text") ..
            " body", run = function()
            local net = serve({ body = '{"id":"p1"}' })
            local client = sdk.new({ base = net.base })
            local ent = client[accessor](client)
            ent:data_set(params(point))
            ent:match_set(params(point))
            if rb.binary == true then
              local got, err = ent:binary(action):put(client.binary.bytes(content(label), { type = rb.media }))
              local arrived = net.arrived()
              assert.is_nil(err)
              assert.are.equal(ent, got)
              assert.are.equal(content(label), arrived.body)
              assert.are.equal(rb.media, arrived.type)
            else
              local _, err = ent[opname](ent, merge(select_of(point), { ["$body"] = 'text "' .. label .. '"\n' }))
              local arrived = net.arrived()
              assert.is_nil(err)
              assert.are.equal('text "' .. label .. '"\n', arrived.body)
              assert.are.equal(rb.media, arrived.type)
            end
          end }
        end

        if type(rs) == "table" and opname == "load" and rs.kind == "raw" then
          out[#out + 1] = { name = label .. " reads a raw " .. (rs.binary == true and "binary" or "text") ..
            " body", run = function()
            if rs.binary == true then
              local net = serve({ type = rs.media, body = content(label) })
              local client = sdk.new({ base = net.base })
              local ent = client[accessor](client)
              ent:data_set(params(point))
              ent:match_set(params(point))
              local bytes, err = ent:binary(action):bytes()
              net.arrived()
              assert.is_nil(err)
              assert.are.equal(content(label), bytes)
              local _, refused = ent:load(merge(params(point), select_of(point)))
              assert.are.equal("binary_sink_required", type(refused) == "table" and refused.code or refused)
            else
              local net = serve({ type = rs.media, body = "caf\195\169 " .. label })
              local client = sdk.new({ base = net.base })
              local ent = client[accessor](client)
              local got, err = ent:load(merge(params(point), select_of(point)))
              net.arrived()
              assert.is_nil(err)
              assert.are.equal(ent, got)
              assert.are.equal("caf\195\169 " .. label, ent:data_get()["$body"])
            end
          end }
        end
      end
    end
  end
  return out
end


describe("codec", function()
  local CASES = cases()
  local ran, failed = 0, 0

  teardown(function()
    print("codec: ran " .. ran .. " case(s), " .. failed .. " failed")
  end)

  it("this SDK has a point to drive", function()
    assert.is_true(0 < #CASES, "no form, multipart or raw point was found")
  end)

  for _, kase in ipairs(CASES) do
    it(kase.name, function()
      ran = ran + 1
      local ok, err = pcall(kase.run)
      if not ok then
        failed = failed + 1
        error(err, 0)
      end
    end)
  end
end)
