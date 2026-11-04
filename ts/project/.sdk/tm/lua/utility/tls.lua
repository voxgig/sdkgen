-- ProjectName SDK utility: tls
--
-- What an https request trusts. luasec's own https defaults to verify = "none",
-- which accepts any certificate for any host, so a request here builds its own
-- connection instead: (1) the chain is verified against the system trust
-- store, which SSL_CERT_FILE and SSL_CERT_DIR name as they do for OpenSSL, and
-- with none found the request is refused, never sent unverified; (2) the host
-- name is verified, an IP literal as an address; (3) SNI is sent for a name;
-- (4) PROJECTENV_CA_BUNDLE adds roots beside the system's. Nothing turns this
-- off: a caller that needs another policy supplies options.system.fetch.

local M = {}

-- Bundles, then hashed directories, where systems keep their trusted roots.
local CA_FILES = {
  "/etc/ssl/certs/ca-certificates.crt",
  "/etc/pki/tls/certs/ca-bundle.crt",
  "/etc/ssl/ca-bundle.pem",
  "/etc/pki/tls/cacert.pem",
  "/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem",
  "/etc/ssl/cert.pem",
  "/usr/local/etc/ssl/cert.pem",
  "/usr/local/share/certs/ca-root-nss.crt",
  "/opt/homebrew/etc/openssl@3/cert.pem",
  "/usr/local/etc/openssl@3/cert.pem",
}

local CA_DIRS = {
  "/etc/ssl/certs",
  "/etc/pki/tls/certs",
  "/system/etc/security/cacerts",
}

local SAN = "2.5.29.17"

-- OpenSSL reports a TLS close without close_notify as "unexpected eof while
-- reading", where every other target reads it as the end of the body.
local OPTIONS = { "all", "no_sslv2", "no_sslv3", "no_tlsv1", "ignore_unexpected_eof" }


local function readable(path)
  local f = io.open(path, "r")
  if f == nil then
    return false
  end
  local ok = f:read(0) ~= nil
  f:close()
  return ok
end

local function present(path)
  return os.rename(path, path) == true
end

local function setting(name)
  local value = os.getenv(name)
  if value == nil or value == "" then
    return nil
  end
  return value
end


-- The system trust store: what the environment names, or else the first
-- bundle or directory found.
local function trust_store()
  local file, dir = setting("SSL_CERT_FILE"), setting("SSL_CERT_DIR")
  if file ~= nil or dir ~= nil then
    if file ~= nil and not readable(file) then
      return nil, nil, "SSL_CERT_FILE names a file that cannot be read: " .. file
    end
    if dir ~= nil and not present(dir) then
      return nil, nil, "SSL_CERT_DIR names a directory that does not exist: " .. dir
    end
    return file, dir
  end
  for _, path in ipairs(CA_FILES) do
    if readable(path) then
      return path, nil
    end
  end
  for _, path in ipairs(CA_DIRS) do
    if present(path) then
      return nil, path
    end
  end
  return nil, nil, "no system trust store was found to verify the server; " ..
    "SSL_CERT_FILE or SSL_CERT_DIR names one"
end


local function options(ssl)
  local known = type(ssl.config) == "table" and ssl.config.options or nil
  if type(known) ~= "table" then
    return nil
  end
  local out = {}
  for _, name in ipairs(OPTIONS) do
    if known[name] then
      table.insert(out, name)
    end
  end
  return out
end


local function unbracket(host)
  return (string.gsub(string.lower(host), "^%[(.*)%]$", "%1"))
end

local function is_address(host)
  return string.find(host, "^%d+%.%d+%.%d+%.%d+$") ~= nil or string.find(host, ":", 1, true) ~= nil
end

-- A DNS name against one certificate name: a wildcard stands for the whole
-- left-most label, and never for a label of a public suffix alone.
local function name_matches(pattern, host)
  pattern = string.lower(pattern)
  if pattern == host then
    return true
  end
  if string.sub(pattern, 1, 2) ~= "*." then
    return false
  end
  local rest = string.sub(pattern, 2)
  if select(2, string.gsub(rest, "%.", "")) < 2 then
    return false
  end
  local label, tail = string.match(host, "^([^.]+)(%..+)$")
  return label ~= nil and tail == rest
end

-- Whether the certificate names the host: its subject alternative names, or
-- its common name where it carries no DNS name.
local function certifies(cert, host)
  host = unbracket(host)
  local ext = cert:extensions() or {}
  local san = ext[SAN] or {}
  if is_address(host) then
    for _, ip in ipairs(san.iPAddress or {}) do
      if string.lower(ip) == host then
        return true
      end
    end
    return false
  end
  local dns = san.dNSName or {}
  if #dns == 0 then
    for _, entry in ipairs(cert:subject() or {}) do
      if entry.name == "commonName" then
        table.insert(dns, entry.value)
      end
    end
  end
  for _, name in ipairs(dns) do
    if name_matches(name, host) then
      return true
    end
  end
  return false
end


-- A verified context, or the reason none can be made.
local function context(ssl)
  local cafile, capath, missing = trust_store()
  if missing ~= nil then
    return nil, missing
  end
  local ctx, err = ssl.newcontext({
    mode = "client",
    protocol = "any",
    options = options(ssl),
    verify = "peer",
    cafile = cafile,
    capath = capath,
  })
  if ctx == nil then
    return nil, "the system trust store cannot be loaded: " .. tostring(err)
  end
  local bundle = setting("PROJECTENV_CA_BUNDLE")
  if bundle ~= nil then
    local ok = readable(bundle) and require("ssl.context").locations(ctx, bundle, nil)
    if not ok then
      return nil, "the CA bundle PROJECTENV_CA_BUNDLE names cannot be read: " .. bundle
    end
  end
  return ctx
end


-- socket.http's `create` for an https URL: a connection verified before any
-- byte of the request is written. Nil and the reason when it cannot verify.
function M.create(fullurl)
  if string.find(string.lower(fullurl), "^https:") == nil then
    return nil
  end
  local ok, ssl = pcall(require, "ssl")
  local sock_ok, socket = pcall(require, "socket")
  if not ok or not sock_ok or type(ssl) ~= "table" then
    return nil, "TLS: an https request needs luasec (ssl) installed"
  end
  local ctx, err = context(ssl)
  if ctx == nil then
    return nil, "TLS: " .. err
  end
  local https_ok, https = pcall(require, "ssl.https")
  local timeout = https_ok and type(https) == "table" and https.TIMEOUT or 60

  return function()
    local conn = { sock = socket.try(socket.tcp()) }
    local settimeout = getmetatable(conn.sock).__index.settimeout
    function conn:settimeout()
      return settimeout(self.sock, timeout)
    end
    function conn:connect(host, port)
      socket.try(self.sock:connect(host, port))
      self.sock = socket.try(ssl.wrap(self.sock, ctx))
      if not is_address(unbracket(host)) then
        self.sock:sni(host)
      end
      self.sock:settimeout(timeout)
      socket.try(self.sock:dohandshake())
      local cert = self.sock:getpeercertificate()
      if cert == nil or not certifies(cert, host) then
        self.sock:close()
        socket.try(nil, "certificate verify failed: the certificate does not name " .. host)
      end
      for name, method in pairs(getmetatable(self.sock).__index) do
        if type(method) == "function" then
          self[name] = function(c, ...) return method(c.sock, ...) end
        end
      end
      return 1
    end
    return conn
  end
end


return M
