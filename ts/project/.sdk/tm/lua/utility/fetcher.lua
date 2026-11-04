-- ProjectName SDK utility: fetcher

local vs = require("utility.struct.struct")
local json = require("dkjson")
local ProjectNameError = require("core.error")
local tls = require("utility.tls")

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

-- Inflate, in Lua: luasocket decodes no Content-Encoding, and a server may
-- compress its answer unasked. Canonical Huffman decoding a bit at a time, as
-- zlib's puff.c does, so no C library is needed.
local LBASE = { 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258 }
local LEXT = { 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
  3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0 }
local DBASE = { 1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577 }
local DEXT = { 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
  7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13 }
local CLORDER = { 16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15 }

-- The canonical code for code lengths lens[0..n-1].
local function huffman(lens, n)
  local count, offs, symbol = {}, {}, {}
  for len = 0, 15 do count[len] = 0 end
  for sym = 0, n - 1 do count[lens[sym]] = count[lens[sym]] + 1 end
  offs[1] = 0
  for len = 1, 14 do offs[len + 1] = offs[len] + count[len] end
  for sym = 0, n - 1 do
    local len = lens[sym]
    if len ~= 0 then
      symbol[offs[len]] = sym
      offs[len] = offs[len] + 1
    end
  end
  return { count = count, symbol = symbol }
end

local FIXED_LEN, FIXED_DIST
do
  local lens = {}
  for sym = 0, 287 do
    lens[sym] = sym < 144 and 8 or sym < 256 and 9 or sym < 280 and 7 or 8
  end
  FIXED_LEN = huffman(lens, 288)
  local dists = {}
  for sym = 0, 29 do dists[sym] = 5 end
  FIXED_DIST = huffman(dists, 30)
end

local function inflate_raw(data, pos)
  local size = #data
  local bitbuf, bitcnt = 0, 0
  local out, n = {}, 0

  local function bits(need)
    while bitcnt < need do
      if pos > size then error("inflate: the data ends early", 0) end
      bitbuf = bitbuf | (string.byte(data, pos) << bitcnt)
      pos = pos + 1
      bitcnt = bitcnt + 8
    end
    local val = bitbuf & ((1 << need) - 1)
    bitbuf = bitbuf >> need
    bitcnt = bitcnt - need
    return val
  end

  local function decode(h)
    local code, first, index = 0, 0, 0
    for len = 1, 15 do
      code = code | bits(1)
      local count = h.count[len]
      if code - count < first then
        return h.symbol[index + (code - first)]
      end
      index = index + count
      first = (first + count) << 1
      code = code << 1
    end
    error("inflate: an invalid code", 0)
  end

  local function codes(lencode, distcode)
    while true do
      local sym = decode(lencode)
      if sym < 256 then
        n = n + 1
        out[n] = sym
      elseif sym == 256 then
        return
      else
        sym = sym - 257
        if sym >= 29 then error("inflate: an invalid length", 0) end
        local len = LBASE[sym + 1] + bits(LEXT[sym + 1])
        local dsym = decode(distcode)
        if dsym >= 30 then error("inflate: an invalid distance", 0) end
        local dist = DBASE[dsym + 1] + bits(DEXT[dsym + 1])
        if dist > n then error("inflate: a distance too far back", 0) end
        for _ = 1, len do
          n = n + 1
          out[n] = out[n - dist]
        end
      end
    end
  end

  repeat
    local last = bits(1)
    local kind = bits(2)
    if kind == 0 then
      -- A stored block starts on a byte boundary: what is left of this byte goes.
      bitbuf, bitcnt = 0, 0
      if pos + 3 > size then error("inflate: the data ends early", 0) end
      local a, b, c, d = string.byte(data, pos, pos + 3)
      local len = a | (b << 8)
      if len ~= (~(c | (d << 8)) & 0xffff) then
        error("inflate: a stored block length is corrupt", 0)
      end
      pos = pos + 4
      if pos + len - 1 > size then error("inflate: the data ends early", 0) end
      for i = pos, pos + len - 1 do
        n = n + 1
        out[n] = string.byte(data, i)
      end
      pos = pos + len
    elseif kind == 1 then
      codes(FIXED_LEN, FIXED_DIST)
    elseif kind == 2 then
      local nlen = bits(5) + 257
      local ndist = bits(5) + 1
      local ncode = bits(4) + 4
      if nlen > 286 or ndist > 30 then error("inflate: too many codes", 0) end
      local lens = {}
      for i = 0, 18 do lens[i] = 0 end
      for i = 1, ncode do lens[CLORDER[i]] = bits(3) end
      local lencode = huffman(lens, 19)
      local all = {}
      local index = 0
      while index < nlen + ndist do
        local sym = decode(lencode)
        if sym < 16 then
          all[index] = sym
          index = index + 1
        else
          local len, rep = 0, 0
          if sym == 16 then
            if index == 0 then error("inflate: a repeat with nothing before it", 0) end
            len = all[index - 1]
            rep = 3 + bits(2)
          elseif sym == 17 then
            rep = 3 + bits(3)
          else
            rep = 11 + bits(7)
          end
          if index + rep > nlen + ndist then error("inflate: too many lengths", 0) end
          for _ = 1, rep do
            all[index] = len
            index = index + 1
          end
        end
      end
      if all[256] == 0 then error("inflate: no end-of-block code", 0) end
      local litlens, distlens = {}, {}
      for i = 0, nlen - 1 do litlens[i] = all[i] end
      for i = 0, ndist - 1 do distlens[i] = all[nlen + i] end
      codes(huffman(litlens, nlen), huffman(distlens, ndist))
    else
      error("inflate: an invalid block type", 0)
    end
  until last == 1

  local parts = {}
  for i = 1, n, 4096 do
    parts[#parts + 1] = string.char(table.unpack(out, i, math.min(i + 4095, n)))
  end
  return table.concat(parts)
end

-- A gzip or deflate body decoded; deflate is zlib-wrapped, or raw as some
-- servers send it.
local function decode_body(body, encoding)
  if encoding == "gzip" or encoding == "x-gzip" then
    local a, b, method, flags = string.byte(body, 1, 4)
    if a ~= 0x1f or b ~= 0x8b or method ~= 8 then
      error("not gzip data", 0)
    end
    local pos = 11
    if flags & 4 ~= 0 then
      local lo, hi = string.byte(body, pos, pos + 1)
      pos = pos + 2 + (lo | ((hi or 0) << 8))
    end
    if flags & 8 ~= 0 then pos = (string.find(body, "\0", pos, true) or #body) + 1 end
    if flags & 16 ~= 0 then pos = (string.find(body, "\0", pos, true) or #body) + 1 end
    if flags & 2 ~= 0 then pos = pos + 2 end
    return inflate_raw(body, pos)
  end
  local cmf, flg = string.byte(body, 1, 2)
  if cmf ~= nil and flg ~= nil and cmf & 0x0f == 8 and ((cmf << 8) | flg) % 31 == 0 then
    return inflate_raw(body, 3)
  end
  return inflate_raw(body, 1)
end

local function send_once(fullurl, fetchdef)
  -- Use LuaSocket or similar for real HTTP requests.
  -- This is the default live implementation.
  local http_ok, http = pcall(require, "socket.http")
  local ltn12_ok, ltn12 = pcall(require, "ltn12")

  if not http_ok or not ltn12_ok then
    return nil, "HTTP library not available (install luasocket)"
  end

  local method = fetchdef["method"] or "GET"
  local body_str = fetchdef["body"]
  local headers = fetchdef["headers"] or {}

  if type(body_str) ~= "string" then
    body_str = nil
  end

  if body_str ~= nil then
    headers["content-length"] = tostring(#body_str)
  end

  -- Default User-Agent — many CDNs reject requests with no UA. Set the
  -- project's agent (main.kit.http.useragent) unless the caller set one.
  local has_ua = false
  for k, _ in pairs(headers) do
    if string.lower(k) == "user-agent" then
      has_ua = true
      break
    end
  end
  if not has_ua then
    headers["User-Agent"] = "PROJECTUSERAGENT"
  end

  -- An https connection is verified before any byte of the request is sent.
  local create, refused = tls.create(fullurl)
  if refused ~= nil then
    return nil, refused
  end

  local response_body = {}
  local res, code, response_headers = http.request({
    url = fullurl,
    method = method,
    headers = headers,
    source = body_str and ltn12.source.string(body_str) or nil,
    sink = ltn12.sink.table(response_body),
    redirect = false,
    create = create,
  })

  if not res then
    return nil, code
  end

  local body = table.concat(response_body)
  local resp_headers = {}
  if type(response_headers) == "table" then
    for k, v in pairs(response_headers) do
      resp_headers[string.lower(k)] = v
    end
  end

  local encoding = string.lower(tostring(resp_headers["content-encoding"] or ""))
  encoding = string.match(encoding, "^%s*(.-)%s*$")
  if body ~= "" and (encoding == "gzip" or encoding == "x-gzip" or encoding == "deflate") then
    local decoded_ok, decoded = pcall(decode_body, body, encoding)
    if not decoded_ok then
      return nil, "response body is not valid " .. encoding .. " data: " .. tostring(decoded)
    end
    body = decoded
  end

  local json_body = nil
  local unreadable = false
  if string.find(body, "%S") then
    local decoded, pos, err = json.decode(body)
    if err ~= nil or string.find(body, "%S", pos) then
      unreadable = true
    else
      json_body = decoded
    end
  end

  local status_text = "OK"
  if code >= 400 then
    status_text = "Error"
  end

  return {
    status = code,
    statusText = status_text,
    headers = resp_headers,
    json = function() return json_body end,
    body = body,
    unreadable = unreadable,
  }, nil
end


local REDIRECT_STATUS = { [301] = true, [302] = true, [303] = true, [307] = true, [308] = true }
local REDIRECT_MAX = 5
local CREDENTIAL_HEADERS = { authorization = true, cookie = true, ["proxy-authorization"] = true }

local function origin(u)
  local parsed = require("socket.url").parse(u) or {}
  local scheme = string.lower(parsed.scheme or "")
  return scheme .. "://" .. string.lower(parsed.host or "") .. ":" ..
    tostring(parsed.port or (scheme == "https" and 443 or 80))
end

-- luasocket follows no 308 and refuses a relative Location from https, so a
-- GET or HEAD follows a redirect here, unless the fetch definition says
-- "manual", each hop passing the GET-only guard first; past REDIRECT_MAX hops
-- the last 3xx is the answer. Another origin is not sent the credentials.
local function default_http_fetch(fullurl, fetchdef)
  local method = string.upper(tostring(fetchdef["method"] or "GET"))
  local follow = (method == "GET" or method == "HEAD") and fetchdef["redirect"] ~= "manual"
  local url = fullurl
  local hops = 0
  while true do
    local refused = getonly_refusal(url, fetchdef["method"])
    if refused then
      return nil, refused
    end
    local res, err = send_once(url, fetchdef)
    local location = res ~= nil and res.headers ~= nil and res.headers["location"] or nil
    if not follow or type(location) ~= "string" or hops >= REDIRECT_MAX
        or not REDIRECT_STATUS[res.status] then
      return res, err
    end
    local nexturl = string.gsub(require("socket.url").absolute(url, (string.gsub(location, "%s", ""))), "#.*$", "")
    if origin(nexturl) ~= origin(url) then
      local headers = {}
      for k, v in pairs(fetchdef["headers"] or {}) do
        if not CREDENTIAL_HEADERS[string.lower(k)] then
          headers[k] = v
        end
      end
      local copy = {}
      for k, v in pairs(fetchdef) do
        copy[k] = v
      end
      copy["headers"] = headers
      fetchdef = copy
    end
    url = nexturl
    hops = hops + 1
  end
end


local function fetcher_util(ctx, fullurl, fetchdef)
  if ctx.client.mode ~= "live" then
    return nil, ctx:make_error("fetch_mode_block",
      'Request blocked by mode: "' .. ctx.client.mode ..
      '" (URL was: "' .. fullurl .. '")')
  end

  local options = ctx.client:options_map()
  if vs.getpath(options, "feature.test.active") == true then
    return nil, ctx:make_error("fetch_test_block",
      'Request blocked as test feature is active' ..
      ' (URL was: "' .. fullurl .. '")')
  end

  local sys_fetch = vs.getpath(options, "system.fetch")

  if sys_fetch == nil then
    return default_http_fetch(fullurl, fetchdef)
  end

  if type(sys_fetch) == "function" then
    return sys_fetch(fullurl, fetchdef)
  end

  return nil, ctx:make_error("fetch_invalid", "system.fetch is not a valid function")
end

return fetcher_util
