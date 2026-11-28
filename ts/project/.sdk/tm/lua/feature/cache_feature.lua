-- ProjectName SDK cache feature
--
-- Response caching for safe (read) requests, per client: see the features
-- reference for the key, the write invalidation and the Cache-Control
-- rules.

-- Lua has no HMAC: SipHash-2-4 under a random per-client key separates
-- header sets within one store without holding a header value. It is not a
-- cryptographic commitment.

local BaseFeature = require("feature.base_feature")
local media = require("utility.media")

local CacheFeature = {}
CacheFeature.__index = CacheFeature
setmetatable(CacheFeature, { __index = BaseFeature })

local UNSTORED = { ["no-store"] = true, ["private"] = true, ["no-cache"] = true }


local function rotl(x, b)
  return (x << b) | (x >> (64 - b))
end


local function sipround(v0, v1, v2, v3)
  v0 = v0 + v1; v1 = rotl(v1, 13); v1 = v1 ~ v0; v0 = rotl(v0, 32)
  v2 = v2 + v3; v3 = rotl(v3, 16); v3 = v3 ~ v2
  v0 = v0 + v3; v3 = rotl(v3, 21); v3 = v3 ~ v0
  v2 = v2 + v1; v1 = rotl(v1, 17); v1 = v1 ~ v2; v2 = rotl(v2, 32)
  return v0, v1, v2, v3
end


local function siphash24(key, data)
  local k0, k1 = string.unpack("<i8<i8", key)
  local v0 = 0x736f6d6570736575 ~ k0
  local v1 = 0x646f72616e646f6d ~ k1
  local v2 = 0x6c7967656e657261 ~ k0
  local v3 = 0x7465646279746573 ~ k1
  local len = #data
  local full = len - (len % 8)
  for i = 1, full, 8 do
    local m = string.unpack("<i8", data, i)
    v3 = v3 ~ m
    v0, v1, v2, v3 = sipround(v0, v1, v2, v3)
    v0, v1, v2, v3 = sipround(v0, v1, v2, v3)
    v0 = v0 ~ m
  end
  local b = len << 56
  for i = 0, (len % 8) - 1 do
    b = b | (string.byte(data, full + i + 1) << (8 * i))
  end
  v3 = v3 ~ b
  v0, v1, v2, v3 = sipround(v0, v1, v2, v3)
  v0, v1, v2, v3 = sipround(v0, v1, v2, v3)
  v0 = v0 ~ b
  v2 = v2 ~ 0xff
  for _ = 1, 4 do
    v0, v1, v2, v3 = sipround(v0, v1, v2, v3)
  end
  return v0 ~ v1 ~ v2 ~ v3
end


-- The system's random source where it has one; otherwise math.random, which
-- is not a cryptographic generator.
CacheFeature._siphash24 = siphash24


local function cache_secret()
  local f = io.open("/dev/urandom", "rb")
  local bytes = f and f:read(16) or ""
  if f then
    f:close()
  end
  while #bytes < 16 do
    bytes = bytes .. string.char(math.random(0, 255))
  end
  return bytes
end


local function header_text(v)
  if v == nil then
    return nil
  end
  if math.type(v) == "float" and v == math.floor(v) then
    return string.format("%d", math.tointeger(v))
  end
  return tostring(v)
end


-- The configured ttl capped by the response's Cache-Control; zero when the
-- response may not be stored.
local function cache_lifetime(headers, ttl)
  local control = ""
  for k, v in pairs(headers or {}) do
    if type(k) == "string" and string.lower(k) == "cache-control" then
      control = string.lower(header_text(v) or "")
    end
  end
  local life = ttl
  for part in string.gmatch(control .. ",", "([^,]*),") do
    local directive = string.match(part, "^%s*(.-)%s*$")
    if UNSTORED[directive] then
      return 0
    end
    local secs = string.match(directive, '^max%-age%s*=%s*"?(%d+)"?$')
    if secs ~= nil then
      life = math.min(life, tonumber(secs) * 1000)
    end
  end
  return life
end


local function url_scope(url)
  local base = string.match(url, "^[^?#]*")
  return (string.gsub(base, "/+$", ""))
end


local function url_parent(scope)
  local root = 0
  local scheme = string.find(scope, "://", 1, true)
  if scheme ~= nil then
    root = string.find(scope, "/", scheme + 3, true)
    if root == nil then
      return scope
    end
    root = root - 1
  end
  local cut = 0
  for i = #scope, 1, -1 do
    if string.sub(scope, i, i) == "/" then
      cut = i - 1
      break
    end
  end
  return string.sub(scope, 1, math.max(cut, root))
end


local function scope_under(scope, prefix)
  return scope == prefix or string.sub(scope, 1, #prefix + 1) == prefix .. "/"
end


function CacheFeature.new()
  local self = setmetatable(BaseFeature.new(), CacheFeature)
  self.version = "0.0.1"
  self.name = "cache"
  self.active = true
  self.client = nil
  self.options = nil
  self.store = {}
  self.order = {}
  return self
end


function CacheFeature:init(ctx, options)
  self.client = ctx.client
  self.options = options or {}

  if options["active"] == true then
    self.active = true
  else
    self.active = false
  end

  if not self.active then
    return
  end

  self.store = {}
  self.order = {}
  self.secret = cache_secret()

  local cache_self = self
  local utility = ctx.utility
  local inner = utility.fetcher

  utility.fetcher = function(fctx, fullurl, fetchdef)
    return cache_self:_through(fctx, fullurl, fetchdef, inner)
  end
end


function CacheFeature:_through(ctx, fullurl, fetchdef, inner)
  local method = "GET"
  if fetchdef ~= nil and type(fetchdef["method"]) == "string" then
    method = string.upper(fetchdef["method"])
  end

  local methods = self.options["methods"] or { "GET" }
  local cacheable_method = false
  for _, m in ipairs(methods) do
    if m == method then
      cacheable_method = true
      break
    end
  end
  if not cacheable_method then
    if method == "GET" or method == "HEAD" then
      return inner(ctx, fullurl, fetchdef)
    end
    local out = table.pack(pcall(inner, ctx, fullurl, fetchdef))
    self:_invalidate(fullurl)
    if not out[1] then
      error(out[2], 0)
    end
    return table.unpack(out, 2, out.n)
  end

  local headers = fetchdef ~= nil and fetchdef["headers"] or nil
  local key = method .. " " .. fullurl .. " " .. self:_digest(headers)
  local now = self:_now()
  local hit = self.store[key]

  if hit ~= nil and hit.expiry > now then
    self:_track("hit")
    return self:_replay(hit.snapshot), nil
  end

  local res, err = inner(ctx, fullurl, fetchdef)

  -- A body that declares another type than JSON passes by, unread.
  if self:_cacheable(res, err) and not self:_json(res) then
    self:_track("bypass")
    return res, err
  end

  if self:_cacheable(res, err) then
    local snapshot = self:_snapshot(res)
    local ttl = cache_lifetime(snapshot.headers,
      self.options["ttl"] == nil and 5000 or self.options["ttl"])
    if ttl <= 0 then
      self:_track("bypass")
      return self:_replay(snapshot), nil
    end
    self:_drop(key)
    self:_evict()
    table.insert(self.order, key)
    self.store[key] = { expiry = now + ttl, scope = url_scope(fullurl), snapshot = snapshot }
    self:_track("miss")
    return self:_replay(snapshot), nil
  end

  self:_track("bypass")
  return res, err
end


function CacheFeature:_digest(headers)
  local pairs_ = {}
  if type(headers) == "table" then
    for k, v in pairs(headers) do
      local text = type(k) == "string" and header_text(v) or nil
      if text ~= nil then
        table.insert(pairs_, { string.lower(k), text })
      end
    end
  end
  table.sort(pairs_, function(a, b)
    if a[1] ~= b[1] then
      return a[1] < b[1]
    end
    return a[2] < b[2]
  end)
  local parts = {}
  for _, p in ipairs(pairs_) do
    table.insert(parts, p[1] .. ":" .. p[2] .. "\n")
  end
  return string.format("%016x", siphash24(self.secret, table.concat(parts)))
end


function CacheFeature:_invalidate(url)
  local path = url_scope(url)
  local collection = url_parent(path)
  local dropped = {}
  for key, entry in pairs(self.store) do
    if scope_under(entry.scope, path) or entry.scope == collection then
      table.insert(dropped, key)
    end
  end
  for _, key in ipairs(dropped) do
    self:_drop(key)
  end
end


function CacheFeature:_drop(key)
  if self.store[key] == nil then
    return
  end
  self.store[key] = nil
  for i = #self.order, 1, -1 do
    if self.order[i] == key then
      table.remove(self.order, i)
    end
  end
end


function CacheFeature:_cacheable(res, err)
  -- A body the transport could not read as JSON passes through, for the operation to report.
  if err ~= nil or res == nil or res["unreadable"] == true then
    return false
  end
  local status = res["status"]
  return type(status) == "number" and status >= 200 and status < 300
end


function CacheFeature:_json(res)
  local ctype = ""
  if type(res["headers"]) == "table" then
    for k, v in pairs(res["headers"]) do
      if type(k) == "string" and string.lower(k) == "content-type" then
        ctype = tostring(v)
      end
    end
  end
  return ctype == "" or media.is_json_media(ctype)
end


function CacheFeature:_snapshot(res)
  local data = nil
  local jf = res["json"]
  if type(jf) == "function" then
    local ok, v = pcall(jf)
    if ok then
      data = v
    end
  end
  local headers = {}
  if type(res["headers"]) == "table" then
    for k, v in pairs(res["headers"]) do
      if type(k) == "string" then
        headers[string.lower(k)] = v
      end
    end
  end
  return {
    status = res["status"],
    statusText = res["statusText"],
    data = data,
    headers = headers,
  }
end


function CacheFeature:_replay(snapshot)
  -- Fresh header copy per replay so pipeline consumers cannot mutate the
  -- cached snapshot.
  local headers = {}
  for k, v in pairs(snapshot.headers or {}) do
    headers[k] = v
  end
  return {
    status = snapshot.status,
    statusText = snapshot.statusText,
    body = "not-used",
    json = function() return snapshot.data end,
    headers = headers,
  }
end


-- FIFO eviction: drop the oldest stored entries until under `max`.
function CacheFeature:_evict()
  local max = self.options["max"] == nil and 256 or self.options["max"]
  while #self.order >= max do
    local oldest = table.remove(self.order, 1)
    if oldest == nil then
      break
    end
    self.store[oldest] = nil
  end
end


function CacheFeature:_now()
  local now = self.options["now"]
  if type(now) == "function" then
    return now()
  end
  return os.time() * 1000
end


function CacheFeature:_track(kind)
  local client = self.client
  if client._cache == nil then
    client._cache = { hit = 0, miss = 0, bypass = 0 }
  end
  client._cache[kind] = client._cache[kind] + 1
end


return CacheFeature
