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
    // The whole body as JSON, whatever its type.
    jsonValue?: any
    // Keys the JSON body must not hold.
    absent?: string[]
    // Header values, by lowercased name.
    headers?: Record<string, string>
    // Pieces the cookie header must hold.
    cookies?: string[]
    query?: Record<string, string>
  }
}

type MediaRecord = {
  case: number
  method: string
  path: string
  query: Record<string, string>
  headers: Record<string, string>
  bodyHex: string
}


const point = (method: string, path: string, extra: string, req = '`reqdata`', args = '') => {
  const segs = path.split('/').filter((s) => '' !== s)
  const params = segs.filter((s) => s.startsWith('{')).map((s) => s.slice(1, -1))
  return `{
        g: { params: [${params.map((p) =>
    `{ k: "param", n: "${p}", or: "${p}", r: true, t: "\`$STRING\`", ex: "${p}01" }`).join(' ')}] ${args} }
        m: "${method}", o: "${path}"
        s: [${segs.map((s) => s.startsWith('{') ?
    `{ var: "${s.slice(1, -1)}" }` : `{ lit: "${s}" }`).join(', ')}]
        t: { req: "${req}", res: "\`body\`" }
        ${extra}
      }`
}

const entity = (name: string, ops: Record<string, string>, more: string[] = []) => `
main: kit: entity: ${name}: {
  alias: field: {}
  name: "${name}"
  id: { field: "id", name: "id" }
  field: {
    id:    { name: "id",    kind: "field", type: "\`$STRING\`", required: true }
    title: { name: "title", kind: "field", type: "\`$STRING\`" }${more.map((f) => `
    ${f}: { name: "${f}", kind: "field", type: "\`$STRING\`" }`).join('')}
  }
  fields: {
    "id": { h: 'Id', n: "id", r: true, t: "\`$STRING\`" }
    "title": { h: 'Title', n: "title", r: false, t: "\`$STRING\`" }${more.map((f) => `
    "${f}": { h: '${f}', n: "${f}", r: false, t: "\`$STRING\`" }`).join('')}
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

const arg = (kind: string, name: string, orig: string) =>
  `{ k: "${kind}", n: "${name}", or: "${orig}", t: "\`$STRING\`" }`

// A header, a cookie and a query argument that share a name with a field of
// the entity, each beside one that does not.
const ROUTED_ARGS = `
        header: [${arg('header', 'locale', 'X-Locale')} ${arg('header', 'trace', 'X-Trace')}]
        cookie: [${arg('cookie', 'theme', 'theme')} ${arg('cookie', 'session_id', 'SESSIONID')}]
        query: [${arg('query', 'lang', 'lang')} ${arg('query', 'verbose', 'verbose')}]`

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
    update: point('PUT', '/picture/{id}', 'rb: { kind: "json", media: "application/merge-patch+json" }',
      undefined, ROUTED_ARGS),
    patch: point('PATCH', '/picture/{id}', 'rb: { kind: "json", media: "application/merge-patch+json" }'),
    // A request transform that selects one field, so the body is that field's value.
    create: point('POST', '/picture', 'rb: { kind: "json", media: "application/json" }',
      '`reqdata.payload`'),
  }, ['locale', 'theme', 'lang'])


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
      method: 'PUT', path: '/picture/p01', accept: null,
      contentType: 'application/merge-patch+json', json: { title: 'Mars' },
    },
  },
  {
    name: 'a patch goes out as a PATCH, with only the fields given',
    entity: 'picture', op: 'patch', input: { id: 'p01', title: 'Phobos' },
    expect: {
      method: 'PATCH', path: '/picture/p01', accept: null,
      contentType: 'application/merge-patch+json', json: { title: 'Phobos' },
    },
  },
  {
    name: 'an argument that is also a field goes out in the body too',
    entity: 'picture', op: 'update',
    input: {
      id: 'p01', title: 'Mars', locale: 'en', theme: 'dark', lang: 'fr',
      trace: 't1', session_id: 's1', verbose: 'yes',
    },
    expect: {
      method: 'PUT', path: '/picture/p01', accept: null,
      contentType: 'application/merge-patch+json',
      json: { title: 'Mars', locale: 'en', theme: 'dark', lang: 'fr' },
      absent: ['trace', 'session_id', 'verbose'],
      headers: { 'x-locale': 'en', 'x-trace': 't1' },
      cookies: ['theme=dark', 'SESSIONID=s1'],
      query: { lang: 'fr', verbose: 'yes' },
    },
  },
  {
    name: 'a JSON body that is a list goes out as a JSON array',
    entity: 'picture', op: 'create', input: { payload: ['red', 'dusty'] },
    expect: {
      method: 'POST', path: '/picture', accept: null,
      contentType: 'application/json', jsonValue: ['red', 'dusty'],
    },
  },
  {
    name: 'a JSON body that is a string goes out as a JSON string',
    entity: 'picture', op: 'create', input: { payload: 'a moon' },
    expect: {
      method: 'POST', path: '/picture', accept: null,
      contentType: 'application/json', jsonValue: 'a moon',
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

    if (undefined !== c.expect.jsonValue) {
      const text = Buffer.from(r.bodyHex, 'hex').toString('utf8')
      let value: any
      try { value = JSON.parse(text) }
      catch (_e) { value = undefined }
      if (JSON.stringify(value) !== JSON.stringify(c.expect.jsonValue)) {
        fail('body text', text, JSON.stringify(c.expect.jsonValue))
      }
    }

    if (null != c.expect.json || null != c.expect.absent) {
      let json: any
      try { json = JSON.parse(Buffer.from(r.bodyHex, 'hex').toString('utf8')) }
      catch (_e) { json = undefined }
      for (const [key, value] of Object.entries(c.expect.json || {})) {
        if (value !== json?.[key]) fail('JSON body ' + key, json, c.expect.json)
      }
      for (const key of c.expect.absent || []) {
        if (null == json || 'object' !== typeof json || key in json) {
          fail('JSON body without ' + key, json, c.expect.absent)
        }
      }
    }

    for (const [name, value] of Object.entries(c.expect.headers || {})) {
      if (value !== r.headers[name]) fail('header ' + name, r.headers[name], value)
    }

    const cookies = String(r.headers.cookie ?? '').split(';').map((piece) => piece.trim())
    for (const piece of c.expect.cookies || []) {
      if (!cookies.includes(piece)) fail('cookie ' + piece, r.headers.cookie, c.expect.cookies)
    }

    for (const [name, value] of Object.entries(c.expect.query || {})) {
      if (value !== r.query[name]) fail('query ' + name, r.query[name], value)
    }
  })

  return out
}


// A case's request, as a record: the case comes from the `/c<N>` the probe
// put in front of every route.
function mediaRecord(method: string, url: string, headers: Record<string, any>,
  bodyHex: string): MediaRecord {
  const parsed = new URL(url, 'http://media.test')
  const path = parsed.pathname
  const m = /^\/c(\d+)(\/.*)$/.exec(path)
  const lower: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers || {})) {
    lower[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v)
  }
  return {
    case: null == m ? -1 : Number(m[1]),
    method: String(method || 'GET'),
    path: null == m ? path : m[2],
    query: Object.fromEntries(parsed.searchParams),
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


const GO_PROBE = String.raw`package sdktest

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"testing"

	sdk "GOMODULE"
)

func TestMediaProbe(t *testing.T) {
	data, err := os.ReadFile("../media-cases.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []map[string]any
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	base := os.Getenv("MEDIA_BASE")
	for i, c := range cases {
		opts := map[string]any{"base": fmt.Sprintf("%s/c%d", base, i)}
		if h, ok := c["headers"].(map[string]any); ok {
			opts["headers"] = h
		}
		client := sdk.NewDemoSDK(opts)
		input := map[string]any{}
		if in, ok := c["input"].(map[string]any); ok {
			for k, v := range in {
				input[k] = v
			}
		}
		if h, ok := c["bodyHex"].(string); ok {
			b, _ := hex.DecodeString(h)
			input["$body"] = b
		}
		if s, ok := c["bodyText"].(string); ok {
			input["$body"] = s
		}
		var ent sdk.DemoEntity
		switch c["entity"] {
		case "cat":
			ent = client.Cat(nil)
		case "picture":
			ent = client.Picture(nil)
		case "planet":
			ent = client.Planet(nil)
		}
		var cerr error
		switch c["op"] {
		case "load":
			_, cerr = ent.Load(input, nil)
		case "list":
			_, cerr = ent.List(input, nil)
		case "create":
			_, cerr = ent.Create(input, nil)
		case "update":
			_, cerr = ent.Update(input, nil)
		case "patch":
			_, cerr = ent.Patch(input, nil)
		case "remove":
			_, cerr = ent.Remove(input, nil)
		}
		if cerr != nil {
			fmt.Printf("media-probe: case %d: %v\n", i, cerr)
		}
	}
	fmt.Printf("media-probe: ran %d cases\n", len(cases))
}
`


// Without a live transport (py's needs requests), MEDIA_SEAM prints each
// request instead of sending it.
const PY_PROBE = String.raw`
import json, os
from demo_sdk import DemoSDK

with open('media-cases.json', encoding='utf-8') as f:
    cases = json.load(f)
base = os.environ['MEDIA_BASE']
seam = 'MEDIA_SEAM' in os.environ


def printer(url, fetchdef):
    body = fetchdef.get('body')
    if hasattr(body, 'read'):
        body = body.read()
    if isinstance(body, str):
        body = body.encode('utf-8')
    print('MEDIA-REQUEST ' + json.dumps({
        'url': url, 'method': fetchdef.get('method'), 'headers': fetchdef.get('headers'),
        'bodyHex': bytes(body or b'').hex()}))
    return {'status': 200, 'statusText': 'OK', 'headers': {},
            'json': lambda: {'id': 'x01'}, 'body': '{}'}, None


for i, c in enumerate(cases):
    opts = {'base': base + '/c' + str(i)}
    if c.get('headers'):
        opts['headers'] = c['headers']
    if seam:
        opts['system'] = {'fetch': printer}
    client = DemoSDK(opts)
    data = dict(c['input'])
    if 'bodyHex' in c:
        data['$body'] = bytes.fromhex(c['bodyHex'])
    if 'bodyText' in c:
        data['$body'] = c['bodyText']
    ent = getattr(client, c['entity'].capitalize())()
    try:
        getattr(ent, c['op'])(data)
    except Exception as e:
        print('media-probe: case %d: %s' % (i, e))
print('media-probe: ran %d cases' % len(cases))
`


const RB_PROBE = String.raw`
require 'json'
require_relative 'Demo_sdk'

cases = JSON.parse(File.read('media-cases.json'))
base = ENV['MEDIA_BASE']
cases.each_with_index do |c, i|
  opts = { 'base' => "#{base}/c#{i}" }
  opts['headers'] = c['headers'] if c['headers']
  client = DemoSDK.new(opts)
  data = c['input'].dup
  data['$body'] = [c['bodyHex']].pack('H*') if c['bodyHex']
  data['$body'] = c['bodyText'] if c['bodyText']
  ent = client.send(c['entity'].capitalize)
  begin
    ent.send(c['op'], data)
  rescue StandardError => e
    puts "media-probe: case #{i}: #{e.message}"
  end
end
puts "media-probe: ran #{cases.length} cases"
`


const PHP_PROBE = String.raw`<?php
require_once __DIR__ . '/demo_sdk.php';
$cases = json_decode(file_get_contents('media-cases.json'), true, 512, JSON_THROW_ON_ERROR);
$base = getenv('MEDIA_BASE');
foreach ($cases as $i => $c) {
    $opts = ['base' => $base . '/c' . $i];
    if (isset($c['headers'])) {
        $opts['headers'] = $c['headers'];
    }
    $client = new DemoSDK($opts);
    $data = $c['input'];
    if (isset($c['bodyHex'])) {
        $data['$body'] = hex2bin($c['bodyHex']);
    }
    if (isset($c['bodyText'])) {
        $data['$body'] = $c['bodyText'];
    }
    $accessor = ucfirst($c['entity']);
    try {
        $client->$accessor()->{$c['op']}($data);
    } catch (Throwable $e) {
        echo 'media-probe: case ' . $i . ': ' . $e->getMessage() . "\n";
    }
}
echo 'media-probe: ran ' . count($cases) . " cases\n";
`


const PERL_PROBE = String.raw`
use strict;
use warnings;
use lib 'lib';
use JSON::PP;
use DemoSDK;

open my $fh, '<', 'media-cases.json' or die $!;
my $cases = decode_json(do { local $/; <$fh> });
my $base = $ENV{MEDIA_BASE};
for my $i (0 .. $#$cases) {
  my $c = $cases->[$i];
  my $opts = { base => "$base/c$i" };
  $opts->{headers} = $c->{headers} if $c->{headers};
  my $client = DemoSDK->new($opts);
  my %data = %{ $c->{input} };
  $data{'$body'} = pack('H*', $c->{bodyHex}) if defined $c->{bodyHex};
  $data{'$body'} = $c->{bodyText} if defined $c->{bodyText};
  my $accessor = ucfirst $c->{entity};
  my $op = $c->{op};
  eval { $client->$accessor->$op(\%data); 1 } or print "media-probe: case $i: $@\n";
}
print 'media-probe: ran ' . scalar(@$cases) . " cases\n";
`


// lua's live transport needs luasocket; without it MEDIA_SEAM prints.
const LUA_PROBE = String.raw`
local json = require("dkjson")
local sdk = require("demo_sdk")

local f = assert(io.open("media-cases.json", "rb"))
local cases = json.decode(f:read("a"))
f:close()
local base = os.getenv("MEDIA_BASE")
local seam = os.getenv("MEDIA_SEAM") ~= nil

local function hex(s)
  return (s:gsub(".", function(c) return string.format("%02x", c:byte()) end))
end

local function unhex(h)
  return (h:gsub("..", function(cc) return string.char(tonumber(cc, 16)) end))
end

local function printer(url, fetchdef)
  local body = fetchdef.body
  print("MEDIA-REQUEST " .. json.encode({
    url = url, method = fetchdef.method, headers = fetchdef.headers,
    bodyHex = type(body) == "string" and hex(body) or "",
  }))
  return { status = 200, statusText = "OK", headers = {},
    json = function() return { id = "x01" } end, body = "{}" }, nil
end

for i, c in ipairs(cases) do
  local n = i - 1
  local opts = { base = base .. "/c" .. n }
  if c.headers then opts.headers = c.headers end
  if seam then opts.system = { fetch = printer } end
  local client = sdk.new(opts)
  local data = {}
  for k, v in pairs(c.input) do data[k] = v end
  if c.bodyHex then data["$body"] = unhex(c.bodyHex) end
  if c.bodyText then data["$body"] = c.bodyText end
  local accessor = c.entity:sub(1, 1):upper() .. c.entity:sub(2)
  local ok, res, err = pcall(function()
    local ent = client[accessor](client)
    return ent[c.op](ent, data)
  end)
  if not ok then
    print("media-probe: case " .. n .. ": " .. tostring(res))
  elseif err ~= nil then
    print("media-probe: case " .. n .. ": " .. tostring(err))
  end
end
print("media-probe: ran " .. #cases .. " cases")
`


const JAVA_PROBE = String.raw`
import java.nio.file.*;
import java.util.*;
import voxgig.demosdk.core.*;
import voxgig.demosdk.utility.Json;

public class MediaProbe {
  @SuppressWarnings("unchecked")
  public static void main(String[] args) throws Exception {
    var cases = (List<Map<String, Object>>) Json.parse(Files.readString(Path.of("media-cases.json")));
    String base = System.getenv("MEDIA_BASE");
    for (int i = 0; i < cases.size(); i++) {
      var c = cases.get(i);
      Map<String, Object> opts = new LinkedHashMap<>();
      opts.put("base", base + "/c" + i);
      if (c.get("headers") != null) opts.put("headers", c.get("headers"));
      var client = new DemoSDK(opts);
      Map<String, Object> data = new LinkedHashMap<>((Map<String, Object>) c.get("input"));
      if (c.get("bodyHex") != null) data.put("$body", HexFormat.of().parseHex((String) c.get("bodyHex")));
      if (c.get("bodyText") != null) data.put("$body", c.get("bodyText"));
      try {
        SdkEntity ent = switch ((String) c.get("entity")) {
          case "cat" -> client.cat(null);
          case "picture" -> client.picture(null);
          default -> client.planet(null);
        };
        switch ((String) c.get("op")) {
          case "load" -> ent.load(data, null);
          case "list" -> ent.list(data, null);
          case "create" -> ent.create(data, null);
          case "update" -> ent.update(data, null);
          case "patch" -> ent.patch(data, null);
          default -> ent.remove(data, null);
        }
      }
      catch (Exception e) {
        System.out.println("media-probe: case " + i + ": " + e.getMessage());
      }
    }
    System.out.println("media-probe: ran " + cases.size() + " cases");
  }
}
`


const KOTLIN_PROBE = String.raw`package voxgig.demosdk.sdktest

import java.io.File

import org.junit.jupiter.api.Test

import voxgig.demosdk.core.DemoSDK
import voxgig.demosdk.core.SdkEntity
import voxgig.demosdk.utility.Json

class MediaProbe {

  @Suppress("UNCHECKED_CAST")
  @Test
  fun mediaProbe() {
    val cases = Json.parse(File("media-cases.json").readText()) as List<Map<String, Any?>>
    val base = System.getenv("MEDIA_BASE")
    for ((i, c) in cases.withIndex()) {
      val opts = linkedMapOf<String, Any?>("base" to base + "/c" + i)
      if (c["headers"] != null) opts["headers"] = c["headers"]
      val client = DemoSDK(opts)
      val data = LinkedHashMap(c["input"] as Map<String, Any?>)
      (c["bodyHex"] as String?)?.let { h ->
        data["\$body"] = ByteArray(h.length / 2) { h.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
      }
      (c["bodyText"] as String?)?.let { data["\$body"] = it }
      try {
        val ent: SdkEntity = when (c["entity"]) {
          "cat" -> client.cat(null)
          "picture" -> client.picture(null)
          else -> client.planet(null)
        }
        when (c["op"]) {
          "load" -> ent.load(data, null)
          "list" -> ent.list(data, null)
          "create" -> ent.create(data, null)
          "update" -> ent.update(data, null)
          "patch" -> ent.patch(data, null)
          else -> ent.remove(data, null)
        }
      } catch (e: Exception) {
        println("media-probe: case " + i + ": " + e.message)
      }
    }
    println("media-probe: ran " + cases.size + " cases")
  }
}
`


const SCALA_PROBE = String.raw`
import java.nio.file.{Files, Paths}
import java.util.{LinkedHashMap, List => JList, Map => JMap}
import voxgig.demosdk.core.{DemoSDK, SdkEntity}
import voxgig.demosdk.utility.Json

object MediaProbeMain {
  def main(args: Array[String]): Unit = {
    val cases = Json.parse(new String(Files.readAllBytes(Paths.get("media-cases.json")), "UTF-8"))
      .asInstanceOf[JList[JMap[String, Object]]]
    val base = System.getenv("MEDIA_BASE")
    for (i <- 0 until cases.size()) {
      val c = cases.get(i)
      val opts = new LinkedHashMap[String, Object]()
      opts.put("base", base + "/c" + i)
      if (c.get("headers") != null) opts.put("headers", c.get("headers"))
      val client = new DemoSDK(opts)
      val data = new LinkedHashMap[String, Object](c.get("input").asInstanceOf[JMap[String, Object]])
      c.get("bodyHex") match {
        case h: String => data.put("$body", h.grouped(2).map(Integer.parseInt(_, 16).toByte).toArray)
        case _ =>
      }
      c.get("bodyText") match {
        case t: String => data.put("$body", t)
        case _ =>
      }
      try {
        val ent: SdkEntity = c.get("entity") match {
          case "cat" => client.cat(null)
          case "picture" => client.picture(null)
          case _ => client.planet(null)
        }
        c.get("op") match {
          case "load" => ent.load(data, null)
          case "list" => ent.list(data, null)
          case "create" => ent.create(data, null)
          case "update" => ent.update(data, null)
          case "patch" => ent.patch(data, null)
          case _ => ent.remove(data, null)
        }
      }
      catch {
        case e: Exception => println("media-probe: case " + i + ": " + e.getMessage)
      }
    }
    println("media-probe: ran " + cases.size() + " cases")
  }
}
`


const CSHARP_PROBE = String.raw`
using DemoSdk;
using System.Text.Json;

public static class MediaProbe
{
    static object? Value(JsonElement e) => e.ValueKind switch
    {
        JsonValueKind.Object => e.EnumerateObject().ToDictionary(p => p.Name, p => Value(p.Value)),
        JsonValueKind.Array => e.EnumerateArray().Select(Value).ToList(),
        JsonValueKind.String => e.GetString(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Null => null,
        _ => throw new Exception("unexpected fixture value"),
    };

    public static void Main()
    {
        using var fixture = JsonDocument.Parse(File.ReadAllText("media-cases.json"));
        var cases = (List<object?>)Value(fixture.RootElement)!;
        var mbase = Environment.GetEnvironmentVariable("MEDIA_BASE");
        for (var i = 0; i < cases.Count; i++)
        {
            var c = (Dictionary<string, object?>)cases[i]!;
            var opts = new Dictionary<string, object?> { ["base"] = mbase + "/c" + i };
            if (c.TryGetValue("headers", out var h) && h != null) opts["headers"] = h;
            var client = new DemoSDK(opts);
            var data = new Dictionary<string, object?>((Dictionary<string, object?>)c["input"]!);
            if (c.TryGetValue("bodyHex", out var hex) && hex is string hs) data["$body"] = Convert.FromHexString(hs);
            if (c.TryGetValue("bodyText", out var text) && text is string ts) data["$body"] = ts;
            try
            {
                var ent = (string)c["entity"]! switch
                {
                    "cat" => client.Cat(),
                    "picture" => client.Picture(),
                    _ => client.Planet(),
                };
                switch ((string)c["op"]!)
                {
                    case "load": ent.Load(data); break;
                    case "list": ent.List(data); break;
                    case "create": ent.Create(data); break;
                    case "update": ent.Update(data); break;
                    case "patch": ent.Patch(data); break;
                    default: ent.Remove(data); break;
                }
            }
            catch (Exception e)
            {
                Console.WriteLine($"media-probe: case {i}: {e.Message}");
            }
        }
        Console.WriteLine($"media-probe: ran {cases.Count} cases");
    }
}
`


const SWIFT_PROBE = String.raw`import Foundation
import XCTest
@testable import DemoSdk

final class MediaProbeTest: XCTestCase {
  func testMediaProbe() throws {
    let env = ProcessInfo.processInfo.environment
    let text = try String(contentsOfFile: env["MEDIA_CASES"] ?? "media-cases.json", encoding: .utf8)
    let cases = try JSON.parse(text).asList?.items ?? []
    let base = env["MEDIA_BASE"] ?? ""
    for (i, c) in cases.enumerated() {
      let opts = VMap()
      opts.entries["base"] = .string(base + "/c" + String(i))
      let headers = gp(c, "headers")
      if !isNil(headers) { opts.entries["headers"] = headers }
      let client = DemoSDK(opts)
      let data = VMap()
      for (k, v) in gp(c, "input").asMap?.entries ?? [:] { data.entries[k] = v }
      if let hex = gp(c, "bodyHex").asString {
        var bytes = [UInt8]()
        var idx = hex.startIndex
        while idx < hex.endIndex {
          let next = hex.index(idx, offsetBy: 2)
          bytes.append(UInt8(hex[idx..<next], radix: 16)!)
          idx = next
        }
        data.entries["$body"] = .nat(Data(bytes))
      }
      if let t = gp(c, "bodyText").asString { data.entries["$body"] = .string(t) }
      do {
        let ent: DemoEntityBase
        switch gp(c, "entity").asString {
        case "cat": ent = client.Cat(nil)
        case "picture": ent = client.Picture(nil)
        default: ent = client.Planet(nil)
        }
        switch gp(c, "op").asString {
        case "load": _ = try ent.load(data, nil)
        case "list": _ = try ent.list(data, nil)
        case "create": _ = try ent.create(data, nil)
        case "update": _ = try ent.update(data, nil)
        case "patch": _ = try ent.patch(data, nil)
        default: _ = try ent.remove(data, nil)
        }
      } catch {
        print("media-probe: case \(i): \(error)")
      }
    }
    print("media-probe: ran \(cases.count) cases")
  }
}
`


const ELIXIR_PROBE = String.raw`
defmodule Demo.MediaProbeTest do
  use ExUnit.Case

  alias Voxgig.Struct, as: S

  test "media probe" do
    cases = Demo.Json.parse(File.read!("media-cases.json"))
    base = System.get_env("MEDIA_BASE")
    n = S.size(cases)

    Enum.each(0..(n - 1), fn i ->
      c = S.getelem(cases, i)
      opts = S.jm(["base", base <> "/c" <> Integer.to_string(i)])
      headers = S.getprop(c, "headers")
      if headers != nil, do: S.setprop(opts, "headers", headers)
      client = Demo.new(opts)
      data = S.clone(S.getprop(c, "input"))
      hex = S.getprop(c, "bodyHex")
      if hex != nil, do: S.setprop(data, "$body", Base.decode16!(hex, case: :lower))
      text = S.getprop(c, "bodyText")
      if text != nil, do: S.setprop(data, "$body", text)

      try do
        {ent, mod} =
          case S.getprop(c, "entity") do
            "cat" -> {Demo.cat(client), Demo.Entity.Cat}
            "picture" -> {Demo.picture(client), Demo.Entity.Picture}
            _ -> {Demo.planet(client), Demo.Entity.Planet}
          end

        apply(mod, String.to_atom(S.getprop(c, "op")), [ent, data])
      rescue
        e -> IO.puts("media-probe: case #{i}: #{Exception.message(e)}")
      end
    end)

    IO.puts("media-probe: ran #{n} cases")
  end
end
`


const CLOJURE_PROBE = String.raw`
(require '[sdk.api :as api]
         '[sdk.core :as core]
         '[voxgig.struct :as vs]
         '[sdk.entity.cat :as e-cat]
         '[sdk.entity.picture :as e-picture]
         '[sdk.entity.planet :as e-planet])

(def cases (core/json-parse (slurp "media-cases.json")))
(def base (System/getenv "MEDIA_BASE"))

(defn- unhex [^String h]
  (byte-array (map (fn [i] (unchecked-byte (Integer/parseInt (subs h (* 2 i) (+ 2 (* 2 i))) 16)))
                   (range (quot (count h) 2)))))

(doseq [i (range (vs/size cases))]
  (let [c (vs/getelem cases i)
        opts (vs/jm "base" (str base "/c" i))
        _ (when-let [h (vs/getprop c "headers")] (.put ^java.util.Map opts "headers" h))
        client (api/make-sdk opts)
        data (vs/clone (vs/getprop c "input"))]
    (when-let [h (vs/getprop c "bodyHex")] (.put ^java.util.Map data "$body" (unhex h)))
    (when-let [t (vs/getprop c "bodyText")] (.put ^java.util.Map data "$body" t))
    (try
      (let [entity (vs/getprop c "entity")
            op (vs/getprop c "op")
            ent (case entity
                  "cat" (api/cat client nil)
                  "picture" (api/picture client nil)
                  (api/planet client nil))
            f (case [entity op]
                ["cat" "load"] e-cat/load
                ["cat" "list"] e-cat/list
                ["cat" "create"] e-cat/create
                ["cat" "update"] e-cat/update
                ["cat" "remove"] e-cat/remove
                ["picture" "load"] e-picture/load
                ["picture" "update"] e-picture/update
                ["picture" "patch"] e-picture/patch
                ["picture" "create"] e-picture/create
                e-planet/create)]
        (f ent data (vs/jm)))
      (catch Throwable e (println (str "media-probe: case " i ": " (.getMessage e)))))))

(println (str "media-probe: ran " (vs/size cases) " cases"))
`


const RUST_PROBE = String.raw`
use demo_sdk::core::helpers::{getp, jo, setp};
use demo_sdk::utility::voxgigstruct as vs;
use demo_sdk::{bytes_value, json_parse, DemoEntity, DemoSDK, Value};

macro_rules! call {
    ($ent:expr, $op:ident, $data:expr) => {
        $ent.$op($data, Value::Noval).map(|_| ()).map_err(|e| e.to_string())
    };
}

#[test]
fn media_probe() {
    let cases = json_parse(&std::fs::read_to_string("media-cases.json").unwrap()).unwrap();
    let base = std::env::var("MEDIA_BASE").unwrap();
    let n = match &cases {
        Value::List(l) => l.borrow().len(),
        _ => 0,
    };
    for i in 0..n {
        let c = vs::get_elem(&cases, &Value::Num(i as f64), Value::Noval);
        let opts = jo(vec![("base", Value::str(format!("{}/c{}", base, i)))]);
        let headers = getp(&c, "headers");
        if !headers.is_noval() {
            setp(&opts, "headers", headers);
        }
        let client = DemoSDK::new(opts);
        let data = vs::clone(&getp(&c, "input"));
        if let Value::Str(h) = getp(&c, "bodyHex") {
            let bytes: Vec<u8> = (0..h.len() / 2)
                .map(|j| u8::from_str_radix(&h[2 * j..2 * j + 2], 16).unwrap())
                .collect();
            setp(&data, "$body", bytes_value(&bytes));
        }
        if let Value::Str(t) = getp(&c, "bodyText") {
            setp(&data, "$body", Value::Str(t));
        }
        let text = |k: &str| match getp(&c, k) {
            Value::Str(s) => s,
            _ => String::new(),
        };
        let res = match (text("entity").as_str(), text("op").as_str()) {
            ("cat", "load") => call!(client.cat(Value::Noval), load, data),
            ("cat", "list") => call!(client.cat(Value::Noval), list, data),
            ("cat", "create") => call!(client.cat(Value::Noval), create, data),
            ("cat", "update") => call!(client.cat(Value::Noval), update, data),
            ("cat", "remove") => call!(client.cat(Value::Noval), remove, data),
            ("picture", "load") => call!(client.picture(Value::Noval), load, data),
            ("picture", "update") => call!(client.picture(Value::Noval), update, data),
            ("picture", "patch") => call!(client.picture(Value::Noval), patch, data),
            ("picture", "create") => call!(client.picture(Value::Noval), create, data),
            _ => call!(client.planet(Value::Noval), create, data),
        };
        if let Err(e) = res {
            println!("media-probe: case {}: {}", i, e);
        }
    }
    println!("media-probe: ran {} cases", n);
}
`


// c and cpp ship no live transport: system.fetch prints each request.
const C_PROBE = String.raw`
#include "sdk.h"
#include "api.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static voxgig_value* printer(void* ud, voxgig_value* args) {
  (void)ud;
  voxgig_list* a = voxgig_as_list(args);
  voxgig_value* fetchdef = a->items[1];
  voxgig_value* body = getp(fetchdef, "body");
  char* headers = voxgig_jsonify(getp(fetchdef, "headers"), cmap(1, "indent", v_int(0)));
  printf("MEDIA-REQUEST {\"url\":\"%s\",\"method\":\"%s\",\"headers\":%s,\"bodyHex\":\"",
    voxgig_as_string(a->items[0]), get_str(fetchdef, "method"), headers ? headers : "{}");
  if (voxgig_is_string(body)) {
    const unsigned char* b = (const unsigned char*)voxgig_as_string(body);
    for (size_t i = 0; i < voxgig_string_len(body); i++) printf("%02x", b[i]);
  }
  printf("\"}\n");
  free(headers);
  return cmap(5, "status", v_num(200), "statusText", v_str("OK"), "headers", v_map(),
    "body", v_str("{}"), "json", json_thunk(cmap(1, "id", v_str("x01"))));
}

static voxgig_value* unhex(const char* h) {
  size_t n = strlen(h) / 2;
  char* b = (char*)malloc(n + 1);
  for (size_t i = 0; i < n; i++) {
    unsigned int x = 0;
    sscanf(h + 2 * i, "%2x", &x);
    b[i] = (char)x;
  }
  voxgig_value* v = voxgig_new_string_n(b, n);
  free(b);
  return v;
}

int main(void) {
  voxgig_list* cases = voxgig_as_list(voxgig_parse_json_file("media-cases.json"));
  const char* base = getenv("MEDIA_BASE");
  size_t n = voxgig_list_len(cases);
  for (size_t i = 0; i < n; i++) {
    voxgig_value* c = voxgig_list_get(cases, i);
    char url[512];
    snprintf(url, sizeof(url), "%s/c%zu", base, i);
    voxgig_value* opts = cmap(2, "base", v_str(url), "system", cmap(1, "fetch", vfn(printer, NULL)));
    voxgig_value* headers = getp(c, "headers");
    if (!v_is_noval(headers)) setp(opts, "headers", headers);
    DemoSDK* sdk = demo_sdk_new(opts);
    voxgig_value* input = voxgig_clone(getp(c, "input"));
    const char* hex = get_str(c, "bodyHex");
    if (hex) setp(input, "$body", unhex(hex));
    const char* text = get_str(c, "bodyText");
    if (text) setp(input, "$body", v_str(text));
    const char* entity = get_str(c, "entity");
    const char* op = get_str(c, "op");
    Entity* e = 0 == strcmp(entity, "cat") ? demo_cat(sdk, NULL) :
      0 == strcmp(entity, "picture") ? demo_picture(sdk, NULL) : demo_planet(sdk, NULL);
    PNError* err = NULL;
    if (0 == strcmp(op, "load")) e->vt->load(e, input, v_map(), &err);
    else if (0 == strcmp(op, "list")) e->vt->list(e, input, v_map(), &err);
    else if (0 == strcmp(op, "create")) e->vt->create(e, input, v_map(), &err);
    else if (0 == strcmp(op, "update")) e->vt->update(e, input, v_map(), &err);
    else if (0 == strcmp(op, "patch")) e->vt->patch(e, input, v_map(), &err);
    else e->vt->remove(e, input, v_map(), &err);
    if (err) printf("media-probe: case %zu: %s\n", i, pn_error_str(err));
  }
  printf("media-probe: ran %zu cases\n", n);
  return 0;
}
`


const CPP_PROBE = String.raw`
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <sstream>

#include "harness.hpp"

using namespace sdk;

static std::string hexOf(const std::string& s) {
  static const char* digits = "0123456789abcdef";
  std::string out;
  for (unsigned char ch : s) {
    out += digits[ch >> 4];
    out += digits[ch & 15];
  }
  return out;
}

static std::string unhex(const std::string& h) {
  std::string out;
  for (size_t i = 0; i + 1 < h.size(); i += 2) out += (char)std::stoi(h.substr(i, 2), nullptr, 16);
  return out;
}

int main() {
  std::ifstream in("media-cases.json");
  std::stringstream text;
  text << in.rdbuf();
  Value cases = vs::parse_json(text.str());
  if (!cases.is_list()) return 1;
  std::string base = std::getenv("MEDIA_BASE") ? std::getenv("MEDIA_BASE") : "";
  vs::Injector fetch = [](vs::Injection&, const Value& args, const std::string&, const Value&) -> Value {
    Value fetchdef = vs::getelem(args, Value(int64_t(1)));
    Value body = getp(fetchdef, "body");
    std::cout << "MEDIA-REQUEST " << vs::jsonify(vmap({
      {"url", vs::getelem(args, Value(int64_t(0)))},
      {"method", getp(fetchdef, "method")},
      {"headers", getp(fetchdef, "headers")},
      {"bodyHex", Value(body.is_string() ? hexOf(body.as_string()) : std::string())},
    }), 0) << std::endl;
    Value out = vmap();
    map_put(out, "status", Value(200));
    map_put(out, "statusText", Value("OK"));
    map_put(out, "headers", vmap());
    map_put(out, "body", Value("{}"));
    map_put(out, "json", json_thunk(vmap({{"id", Value("x01")}})));
    return out;
  };
  size_t i = 0;
  for (const auto& c : *cases.as_list()) {
    Value opts = vmap({
      {"base", Value(base + "/c" + std::to_string(i))},
      {"system", vmap({{"fetch", Value(fetch)}})},
    });
    Value headers = getp(c, "headers");
    if (headers.is_map()) map_put(opts, "headers", headers);
    auto client = std::make_shared<DemoSDK>(opts);
    Value data = vs::clone(getp(c, "input"));
    Value hex = getp(c, "bodyHex");
    if (hex.is_string()) map_put(data, "$body", Value(unhex(hex.as_string())));
    Value txt = getp(c, "bodyText");
    if (txt.is_string()) map_put(data, "$body", txt);
    std::string entity = as_str(getp(c, "entity"));
    std::string op = as_str(getp(c, "op"));
    try {
      SdkEntityPtr ent = "cat" == entity ? SdkEntityPtr(client->cat()) :
        "picture" == entity ? SdkEntityPtr(client->picture()) : SdkEntityPtr(client->planet());
      if ("load" == op) ent->load(data, vmap());
      else if ("list" == op) ent->list(data, vmap());
      else if ("create" == op) ent->create(data, vmap());
      else if ("update" == op) ent->update(data, vmap());
      else if ("patch" == op) ent->patch(data, vmap());
      else ent->remove(data, vmap());
    }
    catch (const std::exception& e) {
      std::cout << "media-probe: case " << i << ": " << e.what() << std::endl;
    }
    catch (const SdkErrorPtr& e) {
      std::cout << "media-probe: case " << i << ": " << e->what() << std::endl;
    }
    i++;
  }
  std::cout << "media-probe: ran " << i << " cases" << std::endl;
  return 0;
}
`


// zig ships no live transport either, so the base is a placeholder.
const ZIG_PROBE = String.raw`
const std = @import("std");
const sdk = @import("sdk");
const h = sdk.h;
const vs = sdk.vs;
const Value = sdk.Value;

fn vnull() Value {
    return Value{ .null = {} };
}

fn hexOf(bytes: []const u8) []const u8 {
    const digits = "0123456789abcdef";
    const out = h.A().alloc(u8, bytes.len * 2) catch unreachable;
    for (bytes, 0..) |b, i| {
        out[2 * i] = digits[b >> 4];
        out[2 * i + 1] = digits[b & 15];
    }
    return out;
}

fn unhex(text: []const u8) []const u8 {
    const out = h.A().alloc(u8, text.len / 2) catch unreachable;
    for (out, 0..) |*b, i| b.* = std.fmt.parseInt(u8, text[2 * i .. 2 * i + 2], 16) catch 0;
    return out;
}

fn printer(_: *anyopaque, _: std.mem.Allocator, arg: Value) anyerror!Value {
    const fetchdef = h.get_elem(arg, h.vnum(1), vnull());
    const body = h.getp(fetchdef, "body");
    const line = h.jsonify_compact(h.jo(&.{
        .{ "url", h.get_elem(arg, h.vnum(0), vnull()) },
        .{ "method", h.getp(fetchdef, "method") },
        .{ "headers", h.getp(fetchdef, "headers") },
        .{ "bodyHex", h.vstr(if (body == .string) hexOf(body.string) else "") },
    }));
    std.debug.print("MEDIA-REQUEST {s}\n", .{line});
    return h.jo(&.{
        .{ "status", h.vnum(200) },
        .{ "statusText", h.vstr("OK") },
        .{ "headers", h.omap() },
        .{ "json", h.json_thunk(h.jo(&.{.{ "id", h.vstr("x01") }})) },
        .{ "body", h.vstr("{}") },
    });
}
var printer_dummy: u8 = 0;

fn report(i: usize, r: anytype) void {
    switch (r) {
        .ok => {},
        .err => std.debug.print("media-probe: case {d}: error\n", .{i}),
    }
}

test "media probe" {
    const io = std.Io.Threaded.global_single_threaded.io();
    const text = try std.Io.Dir.cwd().readFileAlloc(io, "media-cases.json", h.A(), .unlimited);
    const parsed = try std.json.parseFromSlice(std.json.Value, h.A(), text, .{});
    const cases = try vs.fromStdJson(h.A(), parsed.value);
    for (cases.array.data.items, 0..) |c, i| {
        const base = std.fmt.allocPrint(h.A(), "http://media.test/c{d}", .{i}) catch unreachable;
        const opts = h.jo(&.{
            .{ "base", h.vstr(base) },
            .{ "system", h.jo(&.{.{ "fetch", h.callable(@ptrCast(&printer_dummy), printer) }}) },
        });
        const headers = h.getp(c, "headers");
        if (headers == .object) h.setp(opts, "headers", headers);
        const client = sdk.SDK.new(opts);
        const data = h.clone(h.getp(c, "input"));
        const hex = h.getp(c, "bodyHex");
        if (hex == .string) h.setp(data, "$body", h.vstr(unhex(hex.string)));
        const txt = h.getp(c, "bodyText");
        if (txt == .string) h.setp(data, "$body", txt);
        const entity = h.scalar_str(h.getp(c, "entity"));
        const op = h.scalar_str(h.getp(c, "op"));
        const is = std.mem.eql;
        if (is(u8, entity, "cat") and is(u8, op, "load")) report(i, client.cat(vnull()).load(data, h.omap()));
        if (is(u8, entity, "cat") and is(u8, op, "list")) report(i, client.cat(vnull()).list(data, h.omap()));
        if (is(u8, entity, "cat") and is(u8, op, "create")) report(i, client.cat(vnull()).create(data, h.omap()));
        if (is(u8, entity, "cat") and is(u8, op, "update")) report(i, client.cat(vnull()).update(data, h.omap()));
        if (is(u8, entity, "cat") and is(u8, op, "remove")) report(i, client.cat(vnull()).remove(data, h.omap()));
        if (is(u8, entity, "picture") and is(u8, op, "load")) report(i, client.picture(vnull()).load(data, h.omap()));
        if (is(u8, entity, "picture") and is(u8, op, "update")) report(i, client.picture(vnull()).update(data, h.omap()));
        if (is(u8, entity, "picture") and is(u8, op, "patch")) report(i, client.picture(vnull()).patch(data, h.omap()));
        if (is(u8, entity, "picture") and is(u8, op, "create")) report(i, client.picture(vnull()).create(data, h.omap()));
        if (is(u8, entity, "planet")) report(i, client.planet(vnull()).create(data, h.omap()));
    }
    std.debug.print("media-probe: ran {d} cases\n", .{cases.array.data.items.len});
}
`


// ocaml ships no live transport either.
const OCAML_PROBE = String.raw`
(* Prints what system.fetch is given for each media case. *)
open Voxgig_struct
open Sdk_types
open Sdk_helpers

let hex_of (s : string) : string =
  String.concat "" (List.init (String.length s) (fun i -> Printf.sprintf "%02x" (Char.code s.[i])))

let unhex (h : string) : string =
  String.init (String.length h / 2) (fun i -> Char.chr (int_of_string ("0x" ^ String.sub h (2 * i) 2)))

let fetch = Func (fun _ args _ _ ->
    let fetchdef = getelem args (Num 1.) in
    let body = match getp fetchdef "body" with Str b -> hex_of b | _ -> "" in
    print_endline ("MEDIA-REQUEST " ^ jsonify ~flags:(jo [("indent", Num 0.)]) (jo [
        ("url", getelem args (Num 0.));
        ("method", getp fetchdef "method");
        ("headers", getp fetchdef "headers");
        ("bodyHex", Str body)]));
    jo [("status", Num 200.); ("statusText", Str "OK"); ("headers", empty_map ());
        ("body", Str "{}"); ("json", json_thunk (jo [("id", Str "x01")]))])

let run (ent : entity_obj) (op : value) (input : value) : unit =
  match op with
  | Str "load" -> ignore (ent.e_load input (empty_map ()))
  | Str "list" -> ignore (ent.e_list input (empty_map ()))
  | Str "create" -> ignore (ent.e_create input (empty_map ()))
  | Str "update" -> ignore (ent.e_update input (empty_map ()))
  | Str "patch" -> ignore (ent.e_patch input (empty_map ()))
  | _ -> ignore (ent.e_remove input (empty_map ()))

let () =
  let ic = open_in_bin "media-cases.json" in
  let text = really_input_string ic (in_channel_length ic) in
  close_in ic;
  let cases = match Sdk_json.json_read text with List r -> !r | _ -> [] in
  let base = try Sys.getenv "MEDIA_BASE" with Not_found -> "" in
  List.iteri (fun i c ->
      let opts = jo [("base", Str (base ^ "/c" ^ string_of_int i));
                     ("system", jo [("fetch", fetch)])] in
      (match getp c "headers" with Map _ as h -> setp opts "headers" h | _ -> ());
      let client = Sdk_client.make opts in
      let input = clone (getp c "input") in
      (match getp c "bodyHex" with Str h -> setp input "$body" (Str (unhex h)) | _ -> ());
      (match getp c "bodyText" with Str t -> setp input "$body" (Str t) | _ -> ());
      let ent = match getp c "entity" with
        | Str "cat" -> Sdk_client.cat client Noval
        | Str "picture" -> Sdk_client.picture client Noval
        | _ -> Sdk_client.planet client Noval in
      try run ent (getp c "op") input
      with e -> Printf.printf "media-probe: case %d: %s\n" i (Printexc.to_string e))
    cases;
  Printf.printf "media-probe: ran %d cases\n" (List.length cases)
`


const MEDIA_PROBES: Record<string, string> = {
  node: NODE_PROBE,
  ocaml: OCAML_PROBE,
  zig: ZIG_PROBE,
  cpp: CPP_PROBE,
  c: C_PROBE,
  rust: RUST_PROBE,
  clojure: CLOJURE_PROBE,
  elixir: ELIXIR_PROBE,
  swift: SWIFT_PROBE,
  csharp: CSHARP_PROBE,
  scala: SCALA_PROBE,
  kotlin: KOTLIN_PROBE,
  java: JAVA_PROBE,
  go: GO_PROBE,
  py: PY_PROBE,
  rb: RB_PROBE,
  php: PHP_PROBE,
  perl: PERL_PROBE,
  lua: LUA_PROBE,
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
