const assert = require('node:assert/strict')
const Http = require('node:http')
const { DemoSDK } = require(process.argv[2] + '/DemoSDK')

// A list of about 17 MB, served whole, and once cut off a megabyte in.
const items = Array.from({ length: 28000 }, (_, i) =>
  ({ id: 'item' + i, name: 'Item ' + i + ' ☃', tags: ['a', 'b', 'c'], note: 'x'.repeat(500) }))
const body = Buffer.from(JSON.stringify(items))

async function main() {
  let cut = false
  const server = Http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json', 'content-length': String(body.length) })
    if (!cut) return res.end(body)
    res.write(body.subarray(0, 1024 * 1024))
    setTimeout(() => req.socket.destroy(), 50)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const sdk = new DemoSDK({ base: 'http://127.0.0.1:' + server.address().port, apikey: 'x' })
  try {
    const list = await sdk.Planet().list({})
    assert.equal(list.length, items.length)
    console.log('whole: ' + list.length + ' items from ' + body.length + ' bytes')

    cut = true
    const failed = await sdk.Planet().list({}).then(() => null, (err) => err)
    assert.ok(null != failed, 'a body cut short was read as a list')
    assert.equal(failed.code, 'response_body_read', String(failed && failed.message))
    console.log('cut: ' + failed.code)
  }
  finally {
    server.closeAllConnections()
    server.close()
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
