
// The body codec contract as data: a point's body, the request data, and the
// content type and bytes that must be sent, with the multipart boundary fixed
// to BOUNDARY. Bytes are written as latin1 strings. In `data`, `{ $source }`
// is a source built by the target's constructor (`blob: true` from a Blob),
// and `{ $bytes }` plain bytes.

type CodecCase = {
  name: string
  side: 'request'
  op?: string
  body: any
  data: any
  match?: any
  type?: string
  wire?: string
  error?: string
}


const MULTIPART = {
  kind: 'multipart', media: 'multipart/form-data', fields: [
    { name: 'file', binary: true, media: 'audio/wav' },
    { name: 'tags', list: true },
    { name: 'title' },
  ],
}

const FORM = {
  kind: 'form', media: 'application/x-www-form-urlencoded', fields: [
    { name: 'ids', join: ',' },
    { name: 'name' },
    { name: 'tags', list: true },
  ],
}

const MP_TYPE = 'multipart/form-data; boundary=BOUNDARY'

const RIFF = 'RIFF\u0000\u00ff\r\n'


function part(head: string, content: string): string {
  return '--BOUNDARY\r\n' + head + '\r\n\r\n' + content + '\r\n'
}

const END = '--BOUNDARY--\r\n'


const CODEC_CASES: CodecCase[] = [
  {
    name: 'form: declared fields in model order, then the rest in code point order',
    side: 'request', body: FORM,
    data: { zeta: 'z', name: 'a b&c', tags: ['x', 'y'], ids: [1, 2, 3], extra: true },
    type: 'application/x-www-form-urlencoded',
    wire: 'ids=1%2C2%2C3&name=a+b%26c&tags=x&tags=y&extra=true&zeta=z',
  },
  {
    name: 'form: UTF-8, then every byte outside the unreserved set escaped',
    side: 'request', body: FORM,
    data: { name: 'caf\u00e9 *-._~/' },
    type: 'application/x-www-form-urlencoded',
    wire: 'name=caf%C3%A9+*-._%7E%2F',
  },
  {
    name: 'form: null is omitted, a map is JSON',
    side: 'request', body: FORM,
    data: { name: null, meta: { k: 1 } },
    type: 'application/x-www-form-urlencoded',
    wire: 'meta=%7B%22k%22%3A1%7D',
  },
  {
    name: 'form: no data is an empty body',
    side: 'request', body: FORM, data: {},
    type: 'application/x-www-form-urlencoded',
    wire: '',
  },
  {
    name: 'form: a source in a field not declared binary is refused',
    side: 'request', body: FORM,
    data: { name: { $source: 'x' } },
    error: 'binary_source_refused',
  },
  {
    name: 'multipart: a file part, a list and a text field',
    side: 'request', body: MULTIPART,
    data: {
      title: 'Pilot', tags: ['a', 'b'],
      file: { $source: RIFF, name: '/home/me/pilot.wav', type: 'audio/wav' },
    },
    type: MP_TYPE,
    wire: part('Content-Disposition: form-data; name="file"; filename="pilot.wav"\r\n' +
      'Content-Type: audio/wav', RIFF) +
      part('Content-Disposition: form-data; name="tags"', 'a') +
      part('Content-Disposition: form-data; name="tags"', 'b') +
      part('Content-Disposition: form-data; name="title"', 'Pilot') + END,
  },
  {
    name: 'multipart: a quote, a line break or a backslash in a name cannot break out',
    side: 'request', body: MULTIPART,
    data: {
      'a"b\r\nX-Evil: 1\\': 'v',
      file: { $source: 'x', name: 'we"ird\r\n.wav' },
    },
    type: MP_TYPE,
    wire: part('Content-Disposition: form-data; name="file"; filename="we%22ird%0D%0A.wav"\r\n' +
      'Content-Type: audio/wav', 'x') +
      part('Content-Disposition: form-data; name="a%22b%0D%0AX-Evil: 1%5C"', 'v') + END,
  },
  {
    name: 'multipart: a file name is its base name, from either separator',
    side: 'request', body: MULTIPART,
    data: { file: { $source: 'x', name: 'C:\\Users\\me\\take two.wav', type: 'audio/x-wav' } },
    type: MP_TYPE,
    wire: part('Content-Disposition: form-data; name="file"; filename="take two.wav"\r\n' +
      'Content-Type: audio/x-wav', 'x') + END,
  },
  {
    name: 'multipart: a withheld name sends no filename, and the field\'s type',
    side: 'request', body: MULTIPART,
    data: { file: { $source: 'x' } },
    type: MP_TYPE,
    wire: part('Content-Disposition: form-data; name="file"\r\nContent-Type: audio/wav', 'x') + END,
  },
  {
    name: 'multipart: a name that is all path is withheld',
    side: 'request', body: MULTIPART,
    data: { file: { $source: 'x', name: '/tmp/' } },
    type: MP_TYPE,
    wire: part('Content-Disposition: form-data; name="file"\r\nContent-Type: audio/wav', 'x') + END,
  },
  {
    name: 'multipart: a part with no declared type is application/octet-stream',
    side: 'request',
    body: { kind: 'multipart', media: 'multipart/form-data', fields: [{ name: 'doc', binary: true }] },
    data: { doc: { $bytes: '%PDF' } },
    type: MP_TYPE,
    wire: part('Content-Disposition: form-data; name="doc"\r\nContent-Type: application/octet-stream',
      '%PDF') + END,
  },
  {
    name: 'multipart: a path-shaped string is content, never a path',
    side: 'request', body: MULTIPART,
    data: { file: '/etc/passwd' },
    type: MP_TYPE,
    wire: part('Content-Disposition: form-data; name="file"\r\nContent-Type: audio/wav',
      '/etc/passwd') + END,
  },
  {
    name: 'multipart: a media type with a line break is refused',
    side: 'request', body: MULTIPART,
    data: { file: { $source: 'x', type: 'audio/wav\r\nX-Evil: 1' } },
    error: 'binary_source_refused',
  },
  {
    name: 'multipart: a source outside a binary field is refused',
    side: 'request', body: MULTIPART,
    data: { title: { $source: 'x' } },
    error: 'binary_source_refused',
  },
  {
    name: 'multipart: a source nested in other data is refused',
    side: 'request', body: MULTIPART,
    data: { meta: { inner: [{ $source: 'x' }] } },
    error: 'binary_source_refused',
  },
  {
    name: 'multipart: a source in the match is refused',
    side: 'request', body: MULTIPART,
    data: {}, match: { id: { $source: 'x' } },
    error: 'binary_source_refused',
  },
  {
    name: 'multipart: a list of files is a part each',
    side: 'request',
    body: { kind: 'multipart', media: 'multipart/form-data', fields: [{ name: 'files', binary: true, list: true }] },
    data: { files: [{ $source: 'one', name: 'a.txt', type: 'text/plain' }, { $bytes: 'two' }] },
    type: MP_TYPE,
    wire: part('Content-Disposition: form-data; name="files"; filename="a.txt"\r\n' +
      'Content-Type: text/plain', 'one') +
      part('Content-Disposition: form-data; name="files"\r\nContent-Type: application/octet-stream',
        'two') + END,
  },
  {
    name: 'multipart: a Blob source keeps its name and type',
    side: 'request', body: MULTIPART,
    data: { file: { $source: RIFF, blob: true, name: 'b.wav', type: 'audio/wave' } },
    type: MP_TYPE,
    wire: part('Content-Disposition: form-data; name="file"; filename="b.wav"\r\n' +
      'Content-Type: audio/wave', RIFF) + END,
  },
  {
    name: 'multipart: numbers and booleans as text, a map as JSON',
    side: 'request', body: MULTIPART,
    data: { title: 7, live: false, meta: { a: [1] } },
    type: MP_TYPE,
    wire: part('Content-Disposition: form-data; name="title"', '7') +
      part('Content-Disposition: form-data; name="live"', 'false') +
      part('Content-Disposition: form-data; name="meta"', '{"a":[1]}') + END,
  },
  {
    name: 'multipart: no parts is the closing delimiter alone',
    side: 'request', body: MULTIPART, data: {},
    type: MP_TYPE,
    wire: END,
  },
  {
    name: 'raw: a source is sent as its bytes',
    side: 'request', op: 'update',
    body: { kind: 'raw', media: 'audio/wav', binary: true },
    data: { $body: { $source: RIFF, type: 'audio/wav' } },
    type: 'audio/wav',
    wire: RIFF,
  },
  {
    name: 'raw: text is sent as the string it is',
    side: 'request', op: 'update',
    body: { kind: 'raw', media: 'text/vtt' },
    data: { $body: 'WEBVTT' },
    type: 'text/vtt',
    wire: 'WEBVTT',
  },
  {
    name: 'json: a source is refused',
    side: 'request',
    body: { kind: 'json', media: 'application/json' },
    data: { title: 'x', file: { $source: 'x' } },
    error: 'binary_source_refused',
  },
]


export type {
  CodecCase,
}



// A model with every kind of body point, for generating an SDK that drives
// them: a multipart create carrying a file, a form action, raw text read and
// written, raw bytes read and written by action, and an entity whose own
// load answers bytes.
const CODEC_MODEL = `
main: kit: entity: episode: {
  alias: field: {}
  name: "episode"
  id: { field: "id", name: "id" }
  field: {
    id:    { name: "id",    kind: "field", type: "\`$STRING\`", required: true }
    title: { name: "title", kind: "field", type: "\`$STRING\`" }
  }
  fields: {
    "id": { h: 'Id', n: "id", r: true, t: "\`$STRING\`" }
    "title": { h: 'Title', n: "title", r: false, t: "\`$STRING\`" }
  }
  op: {
    load: {
      name: "load"
      points: [
        {
          g: { params: [ { k: "param", n: "id", or: "id", r: true, t: "\`$STRING\`", ex: "e01" } ] }
          m: "GET", o: "/episode/{id}", s: [{ lit: "episode" }, { var: "id" }]
          t: { req: "\`reqdata\`", res: "\`body\`" }
        }
        {
          g: { params: [ { k: "param", n: "id", or: "id", r: true, t: "\`$STRING\`", ex: "e01" } ] }
          m: "GET", o: "/episode/{id}/audio", s: [{ lit: "episode" }, { var: "id" }, { lit: "audio" }]
          q: { "$action": "audio", exist: ["id"] }
          rs: { kind: "raw", media: "audio/wav", binary: true }
          t: { req: "\`reqdata\`", res: "\`body\`" }
        }
        {
          g: { params: [ { k: "param", n: "id", or: "id", r: true, t: "\`$STRING\`", ex: "e01" } ] }
          m: "GET", o: "/episode/{id}/transcript", s: [{ lit: "episode" }, { var: "id" }, { lit: "transcript" }]
          q: { "$action": "transcript", exist: ["id"] }
          rs: { kind: "raw", media: "text/vtt" }
          t: { req: "\`reqdata\`", res: "\`body\`" }
        }
      ]
    }
    create: {
      name: "create"
      points: [
        {
          g: {}, m: "POST", o: "/episode", s: [{ lit: "episode" }]
          rb: { kind: "multipart", media: "multipart/form-data", fields: [
            { name: "audio", binary: true, media: "audio/wav" }
            { name: "tags", list: true }
            { name: "title" }
          ] }
          t: { req: "\`reqdata\`", res: "\`body\`" }
        }
        {
          g: { params: [ { k: "param", n: "id", or: "id", r: true, t: "\`$STRING\`", ex: "e01" } ] }
          m: "POST", o: "/episode/{id}/note", s: [{ lit: "episode" }, { var: "id" }, { lit: "note" }]
          q: { "$action": "note", exist: ["id"] }
          rb: { kind: "form", media: "application/x-www-form-urlencoded", fields: [
            { name: "ids", join: "," }
            { name: "note" }
            { name: "topics", list: true }
          ] }
          t: { req: "\`reqdata\`", res: "\`body\`" }
        }
      ]
    }
    update: {
      name: "update"
      points: [
        {
          g: { params: [ { k: "param", n: "id", or: "id", r: true, t: "\`$STRING\`", ex: "e01" } ] }
          m: "PUT", o: "/episode/{id}", s: [{ lit: "episode" }, { var: "id" }]
          t: { req: "\`reqdata\`", res: "\`body\`" }
        }
        {
          g: { params: [ { k: "param", n: "id", or: "id", r: true, t: "\`$STRING\`", ex: "e01" } ] }
          m: "PUT", o: "/episode/{id}/audio", s: [{ lit: "episode" }, { var: "id" }, { lit: "audio" }]
          q: { "$action": "audio", exist: ["id"] }
          rb: { kind: "raw", media: "audio/wav", binary: true }
          t: { req: "\`reqdata\`", res: "\`body\`" }
        }
        {
          g: { params: [ { k: "param", n: "id", or: "id", r: true, t: "\`$STRING\`", ex: "e01" } ] }
          m: "PUT", o: "/episode/{id}/transcript", s: [{ lit: "episode" }, { var: "id" }, { lit: "transcript" }]
          q: { "$action": "transcript", exist: ["id"] }
          rb: { kind: "raw", media: "text/vtt" }
          t: { req: "\`reqdata\`", res: "\`body\`" }
        }
      ]
    }
  }
}

main: kit: entity: artwork: {
  alias: field: {}
  name: "artwork"
  id: { field: "id", name: "id" }
  field: {
    id: { name: "id", kind: "field", type: "\`$STRING\`", required: true }
  }
  fields: {
    "id": { h: 'Id', n: "id", r: true, t: "\`$STRING\`" }
  }
  op: {
    load: {
      name: "load"
      points: [ {
        g: { params: [ { k: "param", n: "id", or: "id", r: true, t: "\`$STRING\`", ex: "a01" } ] }
        m: "GET", o: "/artwork/{id}", s: [{ lit: "artwork" }, { var: "id" }]
        rs: { kind: "raw", media: "image/png", binary: true }
        t: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
    update: {
      name: "update"
      points: [ {
        g: { params: [ { k: "param", n: "id", or: "id", r: true, t: "\`$STRING\`", ex: "a01" } ] }
        m: "PUT", o: "/artwork/{id}", s: [{ lit: "artwork" }, { var: "id" }]
        rb: { kind: "raw", media: "image/png", binary: true }
        t: { req: "\`reqdata\`", res: "\`body\`" }
      } ]
    }
  }
}

main: kit: flow: BasicEpisodeFlow: { entity: "episode", kind: "basic", name: "BasicEpisodeFlow", step: [] }

main: kit: flow: BasicArtworkFlow: { entity: "artwork", kind: "basic", name: "BasicArtworkFlow", step: [] }
`


export {
  CODEC_CASES,
  CODEC_MODEL,
}
