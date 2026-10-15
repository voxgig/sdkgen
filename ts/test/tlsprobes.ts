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


export {
  TLS_PROBE,
  TLS_SERVER,
}
