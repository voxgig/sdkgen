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

with open('media-cases.json') as f:
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


const MEDIA_PROBES: Record<string, string> = {
  node: NODE_PROBE,
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
