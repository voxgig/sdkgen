// The c transport's TLS, live: a probe that fetches one URL through the SDK's
// own client, and a server that answers it over TLS.


// One line per request it reads, so a handshake the client refused leaves
// none at all.
const TLS_SERVER = `
const https = require('node:https')
const fs = require('node:fs')
const [cert, key, log] = process.argv.slice(2)
fs.writeFileSync(log, '')
const server = https.createServer({ cert: fs.readFileSync(cert), key: fs.readFileSync(key) },
  (req, res) => {
    fs.appendFileSync(log, req.method + ' ' + req.url + '\\n')
    res.setHeader('content-type', 'application/json')
    res.end('{"over":"tls"}')
  })
server.on('tlsClientError', () => {})
server.listen(0, '127.0.0.1', () => console.log('listening ' + server.address().port))
`


const TLS_PROBE = String.raw`
#include "api.h"

#include <stdio.h>

int main(int argc, char** argv) {
  if (argc < 2) return 2;
  DemoSDK* sdk = demo_sdk_new(NULL);
  PNError* err = NULL;
  voxgig_value* res = http_fetch(sdk_get_root_ctx(sdk), argv[1],
    cmap(2, "method", v_str("GET"), "headers", v_map()), &err);
  if (err) printf("tls-probe: %s: %s\n", err->code, err->msg);
  else printf("tls-probe: %lld %s\n", (long long)to_int(getp(res, "status")), get_str(res, "body"));
  return 0;
}
`


// A server that answers over TLS and then closes the connection without
// close_notify, as some servers do: the body has no length, so the close is
// what ends it.
const TLS_EOF_SERVER = String.raw`
const tls = require('node:tls')
const fs = require('node:fs')
const [cert, key] = process.argv.slice(2)
const server = tls.createServer({ cert: fs.readFileSync(cert), key: fs.readFileSync(key) }, (socket) => {
  let seen = ''
  socket.on('error', () => {})
  socket.on('data', (chunk) => {
    seen += chunk
    if (!seen.includes('\r\n\r\n')) return
    socket.write('HTTP/1.1 200 OK\r\ncontent-type: application/json\r\nconnection: close\r\n\r\n' +
      '{"over":"tls"}', () => socket.destroy())
  })
})
server.on('tlsClientError', () => {})
server.listen(0, '127.0.0.1', () => console.log('listening ' + server.address().port))
`


// The lua SDK's direct() against TLS_BASE: the data it read, or its error.
const TLS_EOF_LUA_PROBE = String.raw`
local sdk = require("demo_sdk")
local client = sdk.new({ base = os.getenv("TLS_BASE") })
local res = client:direct({ path = "p" })
if res.ok then
  print("tls-eof: ok " .. tostring(type(res.data) == "table" and res.data.over or res.data))
else
  local err = res.err
  print("tls-eof: failed " .. tostring(type(err) == "table" and (err.msg or err.message) or err))
end
`


export {
  TLS_EOF_LUA_PROBE,
  TLS_EOF_SERVER,
  TLS_PROBE,
  TLS_SERVER,
}
