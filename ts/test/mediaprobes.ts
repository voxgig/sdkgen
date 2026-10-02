// The media types a point declares, driven through a generated SDK: each probe
// calls the operations its cases name, and what reaches the wire is compared
// here, once, for every target.

type MediaCase = {
  name: string
  entity: string
  op: string
  input: Record<string, any>
  // Client `headers` option for this case alone.
  headers?: Record<string, string>
  // The raw body, passed as `$body`: bytes from hex, or text.
  bodyHex?: string
  bodyText?: string
  expect: {
    method: string
    path: string
    // null: no Accept header at all.
    accept: string | null
    contentType?: string
    bodyHex?: string
    json?: Record<string, any>
  }
}

type MediaRecord = {
  case: number
  method: string
  path: string
  headers: Record<string, string>
  bodyHex: string
}


const point = (method: string, path: string, extra: string) => {
  const segs = path.split('/').filter((s) => '' !== s)
  const params = segs.filter((s) => s.startsWith('{')).map((s) => s.slice(1, -1))
  return `{
        g: { params: [${params.map((p) =>
    `{ k: "param", n: "${p}", or: "${p}", r: true, t: "\`$STRING\`", ex: "${p}01" }`).join(' ')}] }
        m: "${method}", o: "${path}"
        s: [${segs.map((s) => s.startsWith('{') ?
    `{ var: "${s.slice(1, -1)}" }` : `{ lit: "${s}" }`).join(', ')}]
        t: { req: "\`reqdata\`", res: "\`body\`" }
        ${extra}
      }`
}

const entity = (name: string, ops: Record<string, string>) => `
main: kit: entity: ${name}: {
  alias: field: {}
  name: "${name}"
  id: { field: "id", name: "id" }
  field: {
    id:    { name: "id",    kind: "field", type: "\`$STRING\`", required: true }
    title: { name: "title", kind: "field", type: "\`$STRING\`" }
  }
  fields: {
    "id": { h: 'Id', n: "id", r: true, t: "\`$STRING\`" }
    "title": { h: 'Title', n: "title", r: false, t: "\`$STRING\`" }
  }
  op: {${Object.entries(ops).map(([op, pt]) => `
    ${op}: { name: "${op}", points: [ ${pt} ] }`).join('')}
  }
}

main: kit: flow: Basic${name.charAt(0).toUpperCase() + name.slice(1)}Flow: {
  entity: "${name}", kind: "basic", name: "Basic${name.charAt(0).toUpperCase() + name.slice(1)}Flow"
  step: []
}
`

const JSON_RS = 'rs: { kind: "json", media: "application/json" }'

// cataas: JPEG, PNG, HTML and JSON, which the server picks between by Accept.
const CATAAS_RS = `rs: { kind: "json", media: "application/json", alternatives: [
          { kind: "raw", media: "image/jpeg", binary: true }
          { kind: "raw", media: "image/png", binary: true }
          { kind: "raw", media: "text/html" }
        ] }`

const MEDIA_MODEL =
  entity('cat', {
    load: point('GET', '/cat/{id}', CATAAS_RS),
    list: point('GET', '/cat', JSON_RS),
    create: point('POST', '/cat', `rb: { kind: "raw", media: "application/pdf", binary: true,
          alternatives: [ { kind: "raw", media: "image/png", binary: true } ] }
        ${JSON_RS}`),
    update: point('PUT', '/cat/{id}', 'rb: { kind: "raw", media: "text/plain" }'),
    remove: point('DELETE', '/cat/{id}', ''),
  }) +
  entity('picture', {
    load: point('GET', '/picture/{id}', `rs: { kind: "raw", media: "image/jpeg", binary: true,
          alternatives: [ { kind: "raw", media: "image/png", binary: true } ] }`),
    update: point('PATCH', '/picture/{id}', 'rb: { kind: "json", media: "application/merge-patch+json" }'),
  })


const BYTES = '89504e470d0a1a0a00ff'
const TEXT = '# Café ☕\n'

const MEDIA_CASES: MediaCase[] = [
  {
    name: 'JSON beside images and HTML asks for JSON alone',
    entity: 'cat', op: 'load', input: { id: 'c01' },
    expect: { method: 'GET', path: '/cat/c01', accept: 'application/json' },
  },
  {
    name: 'a JSON-only response asks for JSON',
    entity: 'cat', op: 'list', input: {},
    expect: { method: 'GET', path: '/cat', accept: 'application/json' },
  },
  {
    name: 'no JSON asks for every declared type, in order',
    entity: 'picture', op: 'load', input: { id: 'p01' },
    expect: { method: 'GET', path: '/picture/p01', accept: 'image/jpeg, image/png' },
  },
  {
    name: 'no declared response body sends no Accept',
    entity: 'cat', op: 'remove', input: { id: 'c01' },
    expect: { method: 'DELETE', path: '/cat/c01', accept: null },
  },
  {
    name: 'the client accept option wins',
    entity: 'cat', op: 'load', input: { id: 'c01' }, headers: { accept: 'image/png' },
    expect: { method: 'GET', path: '/cat/c01', accept: 'image/png' },
  },
  {
    name: 'binary bytes go out unencoded, under the declared type',
    entity: 'cat', op: 'create', input: { title: 'a.pdf' }, bodyHex: BYTES,
    expect: {
      method: 'POST', path: '/cat', accept: 'application/json',
      contentType: 'application/pdf', bodyHex: BYTES,
    },
  },
  {
    name: 'a content-type option that is not JSON is kept',
    entity: 'cat', op: 'create', input: {}, headers: { 'content-type': 'image/png' }, bodyHex: BYTES,
    expect: {
      method: 'POST', path: '/cat', accept: 'application/json',
      contentType: 'image/png', bodyHex: BYTES,
    },
  },
  {
    name: 'text goes out as its UTF-8 bytes',
    entity: 'cat', op: 'update', input: { id: 'c01' }, bodyText: TEXT,
    expect: {
      method: 'PUT', path: '/cat/c01', accept: null,
      contentType: 'text/plain', bodyHex: Buffer.from(TEXT, 'utf8').toString('hex'),
    },
  },
  {
    name: 'a declared JSON type replaces the default',
    entity: 'picture', op: 'update', input: { id: 'p01', title: 'Mars' },
    expect: {
      method: 'PATCH', path: '/picture/p01', accept: null,
      contentType: 'application/merge-patch+json', json: { title: 'Mars' },
    },
  },
  {
    name: 'a body with no declared type is JSON, as before',
    entity: 'planet', op: 'create', input: { title: 'Mars' },
    expect: {
      method: 'POST', path: '/planet', accept: null,
      contentType: 'application/json', json: { title: 'Mars' },
    },
  },
]


const MEDIA_RAN = /media-probe: ran (\d+) cases/


function baseMedia(type: string | undefined): string {
  return String(type ?? '').split(';')[0].trim().toLowerCase()
}


// What a case sent, against what it should have: an empty list when they agree.
function mediaFailures(cases: MediaCase[], records: MediaRecord[]): string[] {
  const out: string[] = []

  cases.forEach((c, i) => {
    const sent = records.filter((r) => i === r.case)
    if (1 !== sent.length) {
      out.push(i + ' ' + c.name + ': expected one request, got ' + sent.length)
      return
    }
    const r = sent[0]
    const fail = (what: string, got: any, want: any) =>
      out.push(i + ' ' + c.name + ': ' + what + ' was ' + JSON.stringify(got) +
        ', expected ' + JSON.stringify(want))

    if (c.expect.method !== r.method.toUpperCase()) fail('method', r.method, c.expect.method)
    if (c.expect.path !== r.path) fail('path', r.path, c.expect.path)

    // A transport's own default, such as fetch's, asks for anything.
    const accept = '*/*' === r.headers.accept ? null : r.headers.accept ?? null
    if (c.expect.accept !== accept) fail('accept', accept, c.expect.accept)

    if (null != c.expect.contentType &&
      c.expect.contentType !== baseMedia(r.headers['content-type'])) {
      fail('content-type', r.headers['content-type'], c.expect.contentType)
    }

    if (null != c.expect.bodyHex && c.expect.bodyHex !== r.bodyHex) {
      fail('body', r.bodyHex, c.expect.bodyHex)
    }

    if (null != c.expect.json) {
      let json: any
      try { json = JSON.parse(Buffer.from(r.bodyHex, 'hex').toString('utf8')) }
      catch (_e) { json = undefined }
      for (const [key, value] of Object.entries(c.expect.json)) {
        if (value !== json?.[key]) fail('JSON body ' + key, json, c.expect.json)
      }
    }
  })

  return out
}


// A case's request, as a record: the case comes from the `/c<N>` the probe
// put in front of every route.
function mediaRecord(method: string, url: string, headers: Record<string, any>,
  bodyHex: string): MediaRecord {
  const path = new URL(url, 'http://media.test').pathname
  const m = /^\/c(\d+)(\/.*)$/.exec(path)
  const lower: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers || {})) {
    lower[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v)
  }
  return {
    case: null == m ? -1 : Number(m[1]),
    method: String(method || 'GET'),
    path: null == m ? path : m[2],
    headers: lower,
    bodyHex: String(bodyHex || '').toLowerCase(),
  }
}


// A probe without a live transport prints each request as a line of its own.
function mediaPrinted(out: string): MediaRecord[] {
  return out.split(/\r?\n/)
    .filter((line) => line.startsWith('MEDIA-REQUEST '))
    .map((line) => {
      const r = JSON.parse(line.slice('MEDIA-REQUEST '.length))
      return mediaRecord(r.method, r.url, r.headers, r.bodyHex)
    })
}


// Records every request it is sent, and answers JSON: a list for a
// collection route, else a record.
const MEDIA_SERVER = `
const http = require('node:http')
const fs = require('node:fs')
const log = process.argv[2]
const server = http.createServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    fs.appendFileSync(log, JSON.stringify({
      method: req.method, url: req.url, headers: req.headers,
      bodyHex: Buffer.concat(chunks).toString('hex'),
    }) + '\\n')
    const list = 'GET' === req.method && /^\\/c\\d+\\/[^/]+$/.test(req.url.split('?')[0])
    const body = JSON.stringify(list ? [] : { id: 'x01', title: 'x' })
    res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) })
    res.end(body)
  })
})
server.listen(0, '127.0.0.1', () => console.log('listening ' + server.address().port))
`


const NODE_PROBE = `
const cases = require('./media-cases.json')
const { SDK } = require('SDK_MODULE')

const base = process.env.MEDIA_BASE

;(async () => {
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]
    const client = new SDK({ base: base + '/c' + i, ...(c.headers ? { headers: c.headers } : {}) })
    const input = { ...c.input }
    if (null != c.bodyHex) input.$body = Buffer.from(c.bodyHex, 'hex')
    if (null != c.bodyText) input.$body = c.bodyText
    const accessor = c.entity.charAt(0).toUpperCase() + c.entity.slice(1)
    try {
      await client[accessor]()[c.op](input)
    }
    catch (err) {
      console.log('media-probe: case ' + i + ': ' + err.message)
    }
  }
  console.log('media-probe: ran ' + cases.length + ' cases')
})()
`


const MEDIA_PROBES: Record<string, string> = {
  node: NODE_PROBE,
}


export {
  MEDIA_CASES,
  MEDIA_MODEL,
  MEDIA_PROBES,
  MEDIA_RAN,
  MEDIA_SERVER,
  mediaFailures,
  mediaPrinted,
  mediaRecord,
}

export type { MediaCase, MediaRecord }
