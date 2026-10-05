// Responses that are not JSON, driven through a generated SDK: each probe prints
// the code and message every case gets. The reference is ts's ResultBodyUtility.

const NONJSON_SECRET = 'NONJSON-PROBE-SECRET-7f2c'

// What a built-in transport sends and records when the client sets no agent.
const NONJSON_DEFAULT_AGENT = 'Mozilla/5.0 (compatible; DemoSDK/1.0)'
const NONJSON_NO_AGENT = 'transport default'

const CHALLENGE = '<!DOCTYPE html><html><head><title>Just a moment...</title></head>' +
  '<body>key ' + NONJSON_SECRET + ' ' + 'x'.repeat(300) + '</body></html>'

// `readable` says whether the body parses as JSON; a stub transport, standing
// in for one the caller supplies, marks the response from it.
type NonjsonCase = {
  name: string
  status: number
  type: string | null
  body: string
  readable: boolean
  agent?: string
}

const NONJSON_CASES: NonjsonCase[] = [
  { name: 'html', status: 200, type: 'text/html; charset=utf-8', body: CHALLENGE, readable: false,
    agent: 'NonjsonProbe/1.0' },
  { name: 'badjson', status: 200, type: 'application/json', body: '{"id": "x01", "title": ',
    readable: false },
  { name: 'untyped', status: 200, type: null, body: 'not json at all', readable: false },
  { name: 'failed', status: 503, type: 'text/html', body: '<html><body>Service Unavailable</body></html>',
    readable: false },
  { name: 'json', status: 200, type: 'application/json', body: '[{"id":"x01","title":"x"}]',
    readable: true },
]

// What each case's message must hold, beside the code it must carry.
const NONJSON_EXPECT: Record<string, { code: string, parts: string[], absent: string[] }> = {
  html: {
    code: 'response_content_type',
    parts: ['expected JSON, got text/html; charset=utf-8', 'HTTP 200',
      'content-type text/html; charset=utf-8',
      'body: <!DOCTYPE html><html><head><title>Just a moment...</title></head><body>key ', '...'],
    absent: [NONJSON_SECRET, 'x'.repeat(200)],
  },
  badjson: {
    code: 'response_json_invalid',
    parts: ['body is not valid JSON', 'HTTP 200', 'content-type application/json',
      'body: {"id": "x01", "title":'],
    absent: [],
  },
  untyped: {
    code: 'response_json_invalid',
    parts: ['body is not valid JSON', 'HTTP 200', 'content-type none', 'body: not json at all'],
    absent: [],
  },
  failed: {
    code: 'request_status',
    parts: ['503', 'HTTP 503', 'content-type text/html', 'body: <html><body>Service Unavailable'],
    absent: [],
  },
  json: { code: 'ok', parts: [], absent: [] },
}


// A probe prints `nonjson-<path>: <case>: <code> | <message>` for each case,
// where the path is `probe` for an entity list and `direct` for direct().
function nonjsonOutcomes(out: string, path: string): Record<string, { code: string, message: string }> {
  const found: Record<string, { code: string, message: string }> = {}
  const line = new RegExp('nonjson-' + path + ': ([a-z]+): ([^|\\r\\n]*?)(?: \\| ([^\\r\\n]*))?\\r?$', 'gm')
  for (const m of out.matchAll(line)) {
    found[m[1]] = { code: m[2].trim(), message: (m[3] ?? '').trim() }
  }
  return found
}


// direct() in these targets returns a plain value with no slot for an error
// object, so err is the message alone; their probes print the code `error`.
const NONJSON_MESSAGE_ONLY = ['rust', 'c', 'cpp', 'zig']


// Each case that did not get its code, or whose message lacks a part, the agent
// it must name among them, or holds one it must not, by both paths.
function nonjsonFailures(out: string, target: string, seam: boolean): string[] {
  const fails: string[] = []
  for (const path of ['probe', 'direct']) {
    const found = nonjsonOutcomes(out, path)
    for (const c of NONJSON_CASES) {
      const want = NONJSON_EXPECT[c.name]
      const got = found[c.name]
      const name = path + ' ' + c.name
      if (null == got) {
        fails.push(name + ': no outcome printed')
        continue
      }
      const code = 'direct' === path && 'ok' !== want.code && NONJSON_MESSAGE_ONLY.includes(target)
        ? 'error' : want.code
      if (code !== got.code) {
        fails.push(name + ': code ' + got.code + ', expected ' + code + ' (' + got.message + ')')
      }
      const agent = 'ok' === want.code ? [] :
        ['user-agent ' + (c.agent ?? (seam ? NONJSON_NO_AGENT : NONJSON_DEFAULT_AGENT))]
      for (const part of [...want.parts, ...agent]) {
        if (!got.message.includes(part)) fails.push(name + ': message lacks ' + JSON.stringify(part))
      }
      for (const part of want.absent) {
        if (got.message.includes(part)) fails.push(name + ': message holds ' + JSON.stringify(part))
      }
    }
  }
  return fails
}


// The cases one per line, for a probe without a JSON reader: name, status,
// content type, agent and body, tab-separated, an absent value empty.
function nonjsonTsv(): string {
  return NONJSON_CASES.map((c) =>
    [c.name, String(c.status), c.type ?? '', c.agent ?? '', c.body].join('\t')).join('\n') + '\n'
}


// Answers /c<i>... with case i, and anything else with a 404.
const NONJSON_SERVER = `
const http = require('node:http')
const cases = require(process.argv[2])
const server = http.createServer((req, res) => {
  req.resume()
  req.on('end', () => {
    const m = /^\\/c(\\d+)/.exec(req.url)
    const c = null == m ? null : cases[Number(m[1])]
    if (null == c) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      return res.end('no case')
    }
    const headers = { 'content-length': Buffer.byteLength(c.body) }
    if (null != c.type) headers['content-type'] = c.type
    res.writeHead(c.status, headers)
    res.end(c.body)
  })
})
server.listen(0, '127.0.0.1', () => console.log('listening ' + server.address().port))
`


const NODE_PROBE = `
const cases = require(process.env.NONJSON_CASES)
const { SDK } = require('SDK_MODULE')

const base = process.env.NONJSON_BASE

const report = (path, name, code, message) => console.log('nonjson-' + path + ': ' + name + ': ' + code +
  (null == message ? '' : ' | ' + String(message).replace(/\\s+/g, ' ')))

;(async () => {
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]
    const client = new SDK({ base: base + '/c' + i, apikey: '${NONJSON_SECRET}',
      ...(c.agent ? { headers: { 'user-agent': c.agent } } : {}) })
    try {
      await client.Cat().list({})
      report('probe', c.name, 'ok')
    }
    catch (err) {
      report('probe', c.name, String(err.code), err.message)
    }
    const res = await client.direct({ path: 'cat' })
    if (res.ok) report('direct', c.name, 'ok')
    else report('direct', c.name, String(res.err?.code), res.err?.message)
  }
})()
`


const GO_PROBE = String.raw`package sdktest

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"testing"

	sdk "GOMODULE"
)

type nonjsonCase struct {
	Name  string ` + '`json:"name"`' + String.raw`
	Agent string ` + '`json:"agent"`' + String.raw`
}

var nonjsonSpace = regexp.MustCompile(` + '`\\s+`' + String.raw`)

func TestNonjsonProbe(t *testing.T) {
	raw, err := os.ReadFile(os.Getenv("NONJSON_CASES"))
	if err != nil {
		t.Fatal(err)
	}
	var cases []nonjsonCase
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	base := os.Getenv("NONJSON_BASE")
	for i, c := range cases {
		opts := map[string]any{"base": fmt.Sprintf("%s/c%d", base, i), "apikey": "SECRET_TOKEN"}
		if c.Agent != "" {
			opts["headers"] = map[string]any{"user-agent": c.Agent}
		}
		client := sdk.NewDemoSDK(opts)
		_, err := client.Cat(nil).List(map[string]any{}, nil)
		nonjsonReport("probe", c.Name, err)
		res, _ := client.Direct(map[string]any{"path": "cat"})
		if ok, _ := res["ok"].(bool); ok {
			nonjsonReport("direct", c.Name, nil)
		} else if derr, isErr := res["err"].(error); isErr {
			nonjsonReport("direct", c.Name, derr)
		} else {
			fmt.Printf("nonjson-direct: %s: none | %v\n", c.Name, res["err"])
		}
	}
}

func nonjsonReport(path, name string, err error) {
	if err == nil {
		fmt.Printf("nonjson-%s: %s: ok\n", path, name)
		return
	}
	code := "none"
	if rec, ok := err.(interface{ Record() map[string]any }); ok {
		code = fmt.Sprint(rec.Record()["code"])
	}
	fmt.Printf("nonjson-%s: %s: %s | %s\n", path, name, code,
		nonjsonSpace.ReplaceAllString(err.Error(), " "))
}
`.replace('SECRET_TOKEN', NONJSON_SECRET)


// Without requests, NONJSON_SEAM answers here as the transport would.
const PY_PROBE = String.raw`
import json
import os
import re
from demo_sdk import DemoSDK

cases = json.load(open(os.environ['NONJSON_CASES']))
base = os.environ['NONJSON_BASE']
seam = 'NONJSON_SEAM' in os.environ


def stub_for(c):
    def stub(url, fetchdef):
        data = json.loads(c['body']) if c['readable'] else None
        headers = {} if c['type'] is None else {'content-type': c['type']}
        return {'status': c['status'], 'statusText': 'OK' if c['status'] < 400 else 'Error',
                'headers': headers, 'json': lambda: data, 'body': c['body'],
                'unreadable': not c['readable']}, None
    return stub


def report(path, name, code, message=None):
    tail = '' if message is None else ' | ' + re.sub(r'\s+', ' ', str(message))
    print('nonjson-%s: %s: %s%s' % (path, name, code, tail))


for i, c in enumerate(cases):
    opts = {'base': '%s/c%d' % (base, i), 'apikey': 'SECRET_TOKEN'}
    if c.get('agent'):
        opts['headers'] = {'user-agent': c['agent']}
    if seam:
        opts['system'] = {'fetch': stub_for(c)}
    client = DemoSDK(opts)
    try:
        client.Cat().list({})
        report('probe', c['name'], 'ok')
    except Exception as e:
        report('probe', c['name'], getattr(e, 'code', 'none'), e)
    res = client.direct({'path': 'cat'})
    if res.get('ok'):
        report('direct', c['name'], 'ok')
    else:
        err = res.get('err')
        report('direct', c['name'], getattr(err, 'code', 'none'), err)
`.replace('SECRET_TOKEN', NONJSON_SECRET)


const RB_PROBE = String.raw`
require 'json'
require_relative 'Demo_sdk'

cases = JSON.parse(File.read(ENV['NONJSON_CASES']))
base = ENV['NONJSON_BASE']

def report(path, name, code, message = nil)
  tail = message.nil? ? '' : ' | ' + message.to_s.gsub(/\s+/, ' ')
  puts "nonjson-#{path}: #{name}: #{code}#{tail}"
end

def code_of(err)
  err.respond_to?(:code) ? err.code : 'none'
end

cases.each_with_index do |c, i|
  opts = { 'base' => "#{base}/c#{i}", 'apikey' => 'SECRET_TOKEN' }
  opts['headers'] = { 'user-agent' => c['agent'] } if c['agent']
  client = DemoSDK.new(opts)
  begin
    client.Cat.list({})
    report('probe', c['name'], 'ok')
  rescue StandardError => e
    report('probe', c['name'], code_of(e), e.message)
  end
  res = client.direct({ 'path' => 'cat' })
  if res['ok']
    report('direct', c['name'], 'ok')
  else
    err = res['err']
    report('direct', c['name'], code_of(err), err.respond_to?(:message) ? err.message : err)
  end
end
`.replace('SECRET_TOKEN', NONJSON_SECRET)


const PHP_PROBE = String.raw`<?php
require_once __DIR__ . '/demo_sdk.php';

$cases = json_decode(file_get_contents(getenv('NONJSON_CASES')), true);
$base = getenv('NONJSON_BASE');

function nonjson_report(string $path, string $name, string $code, $message = null): void {
    $tail = null === $message ? '' : ' | ' . preg_replace('/\s+/', ' ', (string)$message);
    echo 'nonjson-' . $path . ': ' . $name . ': ' . $code . $tail . "\n";
}

function nonjson_code($err): string {
    return is_object($err) && property_exists($err, 'sdk_code') ? (string)$err->sdk_code : 'none';
}

function nonjson_message($err): string {
    return $err instanceof Throwable ? $err->getMessage() : (string)$err;
}

foreach ($cases as $i => $c) {
    $opts = ['base' => $base . '/c' . $i, 'apikey' => 'SECRET_TOKEN'];
    if (!empty($c['agent'])) {
        $opts['headers'] = ['user-agent' => $c['agent']];
    }
    $client = new DemoSDK($opts);
    try {
        $client->Cat()->list([]);
        nonjson_report('probe', $c['name'], 'ok');
    } catch (Throwable $e) {
        nonjson_report('probe', $c['name'], nonjson_code($e), nonjson_message($e));
    }
    $res = $client->direct(['path' => 'cat']);
    if (!empty($res['ok'])) {
        nonjson_report('direct', $c['name'], 'ok');
    } else {
        $err = $res['err'] ?? null;
        nonjson_report('direct', $c['name'], nonjson_code($err), nonjson_message($err));
    }
}
`.replace('SECRET_TOKEN', NONJSON_SECRET)


const PERL_PROBE = String.raw`
use strict;
use warnings;
use lib 'lib';
use DemoSDK;
use JSON::PP ();

open(my $fh, '<', $ENV{NONJSON_CASES}) or die "cases: $!";
my $cases = JSON::PP::decode_json(do { local $/; <$fh> });
my $base = $ENV{NONJSON_BASE};

sub report {
  my ($path, $name, $code, $message) = @_;
  my $tail = '';
  if (defined $message) {
    ($tail = " | $message") =~ s/\s+/ /g;
  }
  print "nonjson-$path: $name: $code$tail\n";
}

sub code_of {
  my ($err) = @_;
  return (ref $err && eval { exists $err->{code} }) ? $err->{code} : 'none';
}

my $i = 0;
for my $c (@$cases) {
  my $opts = { base => "$base/c$i", apikey => 'SECRET_TOKEN' };
  $opts->{headers} = { 'user-agent' => $c->{agent} } if defined $c->{agent};
  my $client = DemoSDK->new($opts);
  if (eval { $client->Cat->list({}); 1 }) {
    report('probe', $c->{name}, 'ok');
  }
  else {
    my $err = $@;
    report('probe', $c->{name}, code_of($err), "$err");
  }
  my $res = $client->direct({ path => 'cat' });
  if ($res->{ok}) {
    report('direct', $c->{name}, 'ok');
  }
  else {
    report('direct', $c->{name}, code_of($res->{err}),
      defined $res->{err} ? "$res->{err}" : '');
  }
  $i++;
}
`.replace('SECRET_TOKEN', NONJSON_SECRET)


// Without luasocket, NONJSON_SEAM answers here as the transport would.
const LUA_PROBE = String.raw`
local sdk = require("demo_sdk")
local json = require("dkjson")

local f = io.open(os.getenv("NONJSON_CASES"))
local cases = json.decode(f:read("a"))
f:close()
local base = os.getenv("NONJSON_BASE")
local seam = os.getenv("NONJSON_SEAM") ~= nil

local function stub_for(c)
  return function(url, fetchdef)
    local data = c.readable and json.decode(c.body) or nil
    local headers = {}
    if c.type ~= nil then headers["content-type"] = c.type end
    return { status = c.status, statusText = c.status < 400 and "OK" or "Error",
      headers = headers, json = function() return data end,
      body = c.body, unreadable = not c.readable }, nil
  end
end

local function report(path, name, code, message)
  local tail = ""
  if message ~= nil then
    tail = " | " .. (string.gsub(tostring(message), "%s+", " "))
  end
  print("nonjson-" .. path .. ": " .. name .. ": " .. tostring(code) .. tail)
end

local function code_of(err)
  if type(err) == "table" and err.code ~= nil then return err.code end
  return "none"
end

local function message_of(err)
  if type(err) == "table" and err.msg ~= nil then return err.msg end
  return tostring(err)
end

for i, c in ipairs(cases) do
  local opts = { base = base .. "/c" .. (i - 1), apikey = "SECRET_TOKEN" }
  if c.agent ~= nil then opts.headers = { ["user-agent"] = c.agent } end
  if seam then opts.system = { fetch = stub_for(c) } end
  local client = sdk.new(opts)
  local ok, res, err = pcall(function() local ent = client:Cat(); return ent:list({}) end)
  if not ok then
    report("probe", c.name, code_of(res), message_of(res))
  elseif err ~= nil then
    report("probe", c.name, code_of(err), message_of(err))
  else
    report("probe", c.name, "ok")
  end
  local dres = client:direct({ path = "cat" })
  if dres.ok then
    report("direct", c.name, "ok")
  else
    report("direct", c.name, code_of(dres.err), message_of(dres.err))
  end
end
`.replace('SECRET_TOKEN', NONJSON_SECRET)


const JAVA_PROBE = String.raw`
import java.nio.file.*;
import java.util.*;
import voxgig.demosdk.core.*;

public class NonjsonProbe {
  static void report(String path, String name, String code, String message) {
    System.out.println("nonjson-" + path + ": " + name + ": " + code
        + (message == null ? "" : " | " + message.replaceAll("\\s+", " ")));
  }

  static String codeOf(Object err) {
    return err instanceof SdkError ? ((SdkError) err).code : "none";
  }

  static String messageOf(Object err) {
    return err instanceof Throwable ? ((Throwable) err).getMessage() : String.valueOf(err);
  }

  static Map<String, Object> map(Object... kv) {
    Map<String, Object> m = new LinkedHashMap<>();
    for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
    return m;
  }

  public static void main(String[] args) throws Exception {
    String base = System.getenv("NONJSON_BASE");
    List<String> lines = Files.readAllLines(Paths.get(System.getenv("NONJSON_TSV")));
    for (int i = 0; i < lines.size(); i++) {
      String[] f = lines.get(i).split("\t", -1);
      Map<String, Object> opts = map("base", base + "/c" + i, "apikey", "SECRET_TOKEN");
      if (!f[3].isEmpty()) opts.put("headers", map("user-agent", f[3]));
      DemoSDK client = new DemoSDK(opts);
      try {
        client.cat(null).list(map(), null);
        report("probe", f[0], "ok", null);
      }
      catch (RuntimeException e) {
        report("probe", f[0], codeOf(e), messageOf(e));
      }
      Map<String, Object> res = client.direct(map("path", "cat"));
      if (Boolean.TRUE.equals(res.get("ok"))) report("direct", f[0], "ok", null);
      else report("direct", f[0], codeOf(res.get("err")), messageOf(res.get("err")));
    }
  }
}
`.replace('SECRET_TOKEN', NONJSON_SECRET)


const KOTLIN_PROBE = String.raw`package voxgig.demosdk.sdktest

import java.nio.file.Files
import java.nio.file.Paths

import org.junit.jupiter.api.Test

import voxgig.demosdk.core.DemoSDK
import voxgig.demosdk.core.SdkError

class NonjsonProbe {

  private fun report(path: String, name: String, code: String, message: String?) {
    println("nonjson-" + path + ": " + name + ": " + code +
      (if (message == null) "" else " | " + message.replace(Regex("\\s+"), " ")))
  }

  private fun codeOf(err: Any?): String = if (err is SdkError) err.code else "none"

  private fun messageOf(err: Any?): String =
    (if (err is Throwable) err.message else null) ?: err.toString()

  @Test
  fun nonjsonProbe() {
    val base = System.getenv("NONJSON_BASE")
    val lines = Files.readAllLines(Paths.get(System.getenv("NONJSON_TSV")))
    for ((i, line) in lines.withIndex()) {
      val f = line.split("	")
      val opts = linkedMapOf<String, Any?>("base" to base + "/c" + i, "apikey" to "SECRET_TOKEN")
      if (f[3].isNotEmpty()) opts["headers"] = linkedMapOf<String, Any?>("user-agent" to f[3])
      val client = DemoSDK(opts)
      try {
        client.cat(null).list(linkedMapOf<String, Any?>(), null)
        report("probe", f[0], "ok", null)
      } catch (e: RuntimeException) {
        report("probe", f[0], codeOf(e), messageOf(e))
      }
      val res = client.direct(linkedMapOf<String, Any?>("path" to "cat"))
      if (res["ok"] == true) report("direct", f[0], "ok", null)
      else report("direct", f[0], codeOf(res["err"]), messageOf(res["err"]))
    }
  }
}
`.replace('SECRET_TOKEN', NONJSON_SECRET)


const SCALA_PROBE = String.raw`
import java.nio.file.{Files, Paths}
import java.util.{LinkedHashMap, Map => JMap}
import voxgig.demosdk.core.{DemoSDK, SdkError}

object NonjsonProbeMain {
  private def report(path: String, name: String, code: String, message: String): Unit =
    println("nonjson-" + path + ": " + name + ": " + code +
      (if (message == null) "" else " | " + message.replaceAll("\\s+", " ")))

  private def codeOf(err: Any): String = err match {
    case e: SdkError => e.code
    case _ => "none"
  }

  private def messageOf(err: Any): String = err match {
    case e: Throwable => e.getMessage
    case other => String.valueOf(other)
  }

  private def map(kv: (String, Object)*): JMap[String, Object] = {
    val m = new LinkedHashMap[String, Object]()
    kv.foreach { case (k, v) => m.put(k, v) }
    m
  }

  def main(args: Array[String]): Unit = {
    val base = System.getenv("NONJSON_BASE")
    val lines = Files.readAllLines(Paths.get(System.getenv("NONJSON_TSV")))
    for (i <- 0 until lines.size) {
      val f = lines.get(i).split("\t", -1)
      val opts = map("base" -> (base + "/c" + i), "apikey" -> "SECRET_TOKEN")
      if (f(3).nonEmpty) opts.put("headers", map("user-agent" -> f(3)))
      val client = new DemoSDK(opts)
      try {
        client.cat(null).list(map(), null)
        report("probe", f(0), "ok", null)
      }
      catch {
        case e: RuntimeException => report("probe", f(0), codeOf(e), messageOf(e))
      }
      val res = client.direct(map("path" -> "cat"))
      if (java.lang.Boolean.TRUE == res.get("ok")) report("direct", f(0), "ok", null)
      else report("direct", f(0), codeOf(res.get("err")), messageOf(res.get("err")))
    }
  }
}
`.replace('SECRET_TOKEN', NONJSON_SECRET)


const CSHARP_PROBE = String.raw`
using System.Text.RegularExpressions;
using DemoSdk;

public static class NonjsonProbe
{
    static void Report(string path, string name, string code, string? message)
    {
        Console.WriteLine("nonjson-" + path + ": " + name + ": " + code +
            (message == null ? "" : " | " + Regex.Replace(message, @"\s+", " ")));
    }

    static string CodeOf(object? err) => err is DemoError e ? e.Code : "none";

    static string MessageOf(object? err) => err is Exception e ? e.Message : err?.ToString() ?? "";

    public static void Main()
    {
        var nbase = Environment.GetEnvironmentVariable("NONJSON_BASE");
        var lines = File.ReadAllLines(Environment.GetEnvironmentVariable("NONJSON_TSV")!);
        for (var i = 0; i < lines.Length; i++)
        {
            var f = lines[i].Split('\t');
            var opts = new Dictionary<string, object?> { ["base"] = nbase + "/c" + i, ["apikey"] = "SECRET_TOKEN" };
            if (f[3] != "") opts["headers"] = new Dictionary<string, object?> { ["user-agent"] = f[3] };
            var client = new DemoSDK(opts);
            try
            {
                client.Cat().List(new Dictionary<string, object?>());
                Report("probe", f[0], "ok", null);
            }
            catch (Exception e)
            {
                Report("probe", f[0], CodeOf(e), MessageOf(e));
            }
            var res = client.Direct(new Dictionary<string, object?> { ["path"] = "cat" });
            if (res.TryGetValue("ok", out var ok) && ok is true) Report("direct", f[0], "ok", null);
            else Report("direct", f[0], CodeOf(res.GetValueOrDefault("err")), MessageOf(res.GetValueOrDefault("err")));
        }
    }
}
`.replace('SECRET_TOKEN', NONJSON_SECRET)


const RUST_PROBE = String.raw`
use demo_sdk::core::helpers::{getp, jo};
use demo_sdk::{DemoEntity, DemoSDK, Value};

fn report(path: &str, name: &str, code: &str, message: Option<String>) {
    let tail = match message {
        Some(m) => format!(" | {}", m.split_whitespace().collect::<Vec<_>>().join(" ")),
        None => String::new(),
    };
    println!("nonjson-{}: {}: {}{}", path, name, code, tail);
}

#[test]
fn nonjson_probe() {
    let base = std::env::var("NONJSON_BASE").unwrap();
    let tsv = std::fs::read_to_string(std::env::var("NONJSON_TSV").unwrap()).unwrap();
    for (i, line) in tsv.lines().enumerate() {
        let f: Vec<&str> = line.split('\t').collect();
        let mut opts = vec![
            ("base", Value::str(format!("{}/c{}", base, i))),
            ("apikey", Value::str("SECRET_TOKEN")),
        ];
        if !f[3].is_empty() {
            opts.push(("headers", jo(vec![("user-agent", Value::str(f[3]))])));
        }
        let client = DemoSDK::new(jo(opts));
        match client.cat(Value::Noval).list(jo(vec![]), Value::Noval) {
            Ok(_) => report("probe", f[0], "ok", None),
            Err(e) => report("probe", f[0], &e.code, Some(e.msg.clone())),
        }
        match client.direct(jo(vec![("path", Value::str("cat"))])) {
            Ok(res) => match (getp(&res, "ok"), getp(&res, "err")) {
                (Value::Bool(true), _) => report("direct", f[0], "ok", None),
                (_, Value::Str(msg)) => report("direct", f[0], "error", Some(msg)),
                _ => report("direct", f[0], "error", Some(String::from("no message"))),
            },
            Err(e) => report("direct", f[0], &e.code, Some(e.msg.clone())),
        }
    }
}
`.replace('SECRET_TOKEN', NONJSON_SECRET)


const ELIXIR_PROBE = String.raw`
defmodule Demo.NonjsonProbeTest do
  use ExUnit.Case

  alias Voxgig.Struct, as: S

  defp report(path, name, code, message) do
    tail = if message == nil, do: "", else: " | " <> Regex.replace(~r/\s+/, message, " ")
    IO.puts("nonjson-" <> path <> ": " <> name <> ": " <> code <> tail)
  end

  defp code_of(%Demo.Error{code: code}), do: code
  defp code_of(_), do: "none"

  defp message_of(err) do
    cond do
      is_exception(err) -> Exception.message(err)
      is_binary(err) -> err
      true -> inspect(err)
    end
  end

  test "nonjson probe" do
    base = System.get_env("NONJSON_BASE")
    lines = System.get_env("NONJSON_TSV") |> File.read!() |> String.split("\n", trim: true)

    lines
    |> Enum.with_index()
    |> Enum.each(fn {line, i} ->
      [name, _status, _type, agent | _] = String.split(line, "\t")
      opts = S.jm(["base", base <> "/c" <> Integer.to_string(i), "apikey", "SECRET_TOKEN"])
      if agent != "", do: S.setprop(opts, "headers", S.jm(["user-agent", agent]))
      client = Demo.new(opts)

      try do
        Demo.Entity.Cat.list(Demo.cat(client), S.jm([]))
        report("probe", name, "ok", nil)
      rescue
        e -> report("probe", name, code_of(e), message_of(e))
      end

      res = Demo.direct(client, S.jm(["path", "cat"]))

      if S.getprop(res, "ok") == true do
        report("direct", name, "ok", nil)
      else
        err = S.getprop(res, "err")
        report("direct", name, code_of(err), message_of(err))
      end
    end)
  end
end
`.replace('SECRET_TOKEN', NONJSON_SECRET)


const CLOJURE_PROBE = String.raw`
(require '[sdk.api :as api]
         '[sdk.client :as client]
         '[sdk.core :as core]
         '[voxgig.struct :as vs]
         '[clojure.string :as cstr]
         '[sdk.entity.cat :as e-cat])

(def base (System/getenv "NONJSON_BASE"))

(defn report [path name code message]
  (println (str "nonjson-" path ": " name ": " code
                (if (nil? message) "" (str " | " (cstr/replace message #"\s+" " "))))))

(defn sdk-err [e]
  (cond
    (core/sdk-error? e) e
    (instance? clojure.lang.ExceptionInfo e) (core/ex->sdk e)
    :else nil))

(defn code-of [e] (or (:code (sdk-err e)) "none"))

(defn message-of [e]
  (let [se (sdk-err e)]
    (cond
      se (:msg se)
      (instance? Throwable e) (.getMessage ^Throwable e)
      :else (str e))))

(doseq [[i line] (map-indexed vector (cstr/split-lines (slurp (System/getenv "NONJSON_TSV"))))]
  (let [[name _status _type agent] (cstr/split line #"\t" -1)
        opts (vs/jm "base" (str base "/c" i) "apikey" "SECRET_TOKEN")
        _ (when (not= "" agent) (vs/setprop opts "headers" (vs/jm "user-agent" agent)))
        sdk (api/make-sdk opts)]
    (try
      (e-cat/list (api/cat sdk nil) (vs/jm) (vs/jm))
      (report "probe" name "ok" nil)
      (catch Throwable e (report "probe" name (code-of e) (message-of e))))
    (let [res (client/direct sdk (vs/jm "path" "cat"))]
      (if (true? (vs/getprop res "ok"))
        (report "direct" name "ok" nil)
        (let [err (vs/getprop res "err")]
          (report "direct" name (code-of err) (message-of err)))))))
`.replace('SECRET_TOKEN', NONJSON_SECRET)


// c, cpp, zig and ocaml ship no live transport: a stub system.fetch answers
// each case and sets the unreadable mark, as a transport does.
const C_PROBE = String.raw`
#include "sdk.h"
#include "api.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static voxgig_value* stub(void* ud, voxgig_value* args) {
  (void)args;
  voxgig_value* c = (voxgig_value*)ud;
  const char* body = get_str(c, "body");
  bool readable = false;
  get_bool(c, "readable", &readable);
  voxgig_value* data = readable ? json_parse(body) : v_undef();
  bool unreadable = !readable;
  int64_t status = to_int(getp(c, "status"));
  const char* type = get_str(c, "type");
  return cmap(6, "status", v_num((double)status),
    "statusText", v_str(status < 400 ? "OK" : "Error"),
    "headers", type ? cmap(1, "content-type", v_str(type)) : v_map(),
    "body", v_str(body), "json", json_thunk(data), "unreadable", v_bool(unreadable));
}

static char* slurp(const char* path) {
  FILE* f = fopen(path, "rb");
  if (!f) return NULL;
  fseek(f, 0, SEEK_END);
  long n = ftell(f);
  fseek(f, 0, SEEK_SET);
  char* buf = (char*)malloc((size_t)n + 1);
  size_t got = fread(buf, 1, (size_t)n, f);
  buf[got] = '\0';
  fclose(f);
  return buf;
}

static void report(const char* path, const char* name, const char* code, const char* message) {
  if (message) printf("nonjson-%s: %s: %s | %s\n", path, name, code, message);
  else printf("nonjson-%s: %s: %s\n", path, name, code);
}

int main(void) {
  voxgig_value* cases = json_parse(slurp(getenv("NONJSON_CASES")));
  const char* base = getenv("NONJSON_BASE");
  voxgig_list* list = voxgig_as_list(cases);
  for (size_t i = 0; i < list->len; i++) {
    voxgig_value* c = list->items[i];
    const char* name = get_str(c, "name");
    char url[256];
    snprintf(url, sizeof(url), "%s/c%zu", base, i);
    voxgig_value* opts = cmap(3, "base", v_str(url), "apikey", v_str("SECRET_TOKEN"),
      "system", cmap(1, "fetch", vfn(stub, c)));
    const char* agent = get_str(c, "agent");
    if (agent) setp(opts, "headers", cmap(1, "user-agent", v_str(agent)));
    DemoSDK* sdk = demo_sdk_new(opts);
    PNError* err = NULL;
    Entity* e = demo_cat(sdk, NULL);
    e->vt->list(e, v_map(), v_map(), &err);
    if (err) report("probe", name, err->code, err->msg);
    else report("probe", name, "ok", NULL);
    PNError* derr = NULL;
    voxgig_value* res = sdk_direct(sdk, cmap(1, "path", v_str("cat")), &derr);
    bool ok = false;
    if (derr) report("direct", name, derr->code, derr->msg);
    else if (get_bool(res, "ok", &ok) && ok) report("direct", name, "ok", NULL);
    else report("direct", name, "error", get_str(res, "err"));
  }
  return 0;
}
`.replace('SECRET_TOKEN', NONJSON_SECRET)


const CPP_PROBE = String.raw`
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>

#include "harness.hpp"

using namespace sdk;

static void report(const std::string& path, const std::string& name, const std::string& code,
                   const std::string* message) {
  std::cout << "nonjson-" << path << ": " << name << ": " << code;
  if (message) std::cout << " | " << *message;
  std::cout << std::endl;
}

int main() {
  std::ifstream in(std::getenv("NONJSON_CASES"));
  std::stringstream buf;
  buf << in.rdbuf();
  Value cases = vs::parse_json(buf.str());
  std::string base = std::getenv("NONJSON_BASE");
  int i = 0;
  for (const Value& c : *cases.as_list()) {
    std::string name = as_str(getp(c, "name"));
    vs::Injector fetch = [c](vs::Injection&, const Value&, const std::string&, const Value&) -> Value {
      Value readable = getp(c, "readable");
      bool parses = readable.is_bool() && readable.as_bool();
      std::string body = as_str(getp(c, "body"));
      int status = Helpers::toInt(getp(c, "status"));
      Value headers = vmap();
      Value type = getp(c, "type");
      if (type.is_string()) map_put(headers, "content-type", type);
      Value out = vmap();
      map_put(out, "status", Value(status));
      map_put(out, "statusText", Value(status < 400 ? "OK" : "Error"));
      map_put(out, "headers", headers);
      map_put(out, "body", Value(body));
      map_put(out, "json", json_thunk(parses ? vs::parse_json(body) : Value::undef()));
      map_put(out, "unreadable", Value(!parses));
      return out;
    };
    Value opts = vmap({
      {"base", Value(base + "/c" + std::to_string(i))},
      {"apikey", Value("SECRET_TOKEN")},
      {"system", vmap({{"fetch", Value(fetch)}})},
    });
    Value agent = getp(c, "agent");
    if (agent.is_string()) map_put(opts, "headers", vmap({{"user-agent", agent}}));
    auto client = std::make_shared<DemoSDK>(opts);
    try {
      client->cat()->list(vmap(), vmap());
      report("probe", name, "ok", nullptr);
    }
    catch (const SdkErrorPtr& e) {
      report("probe", name, e->code, &e->msg);
    }
    catch (const std::exception& e) {
      std::string m = e.what();
      report("probe", name, "none", &m);
    }
    Value res = client->direct(vmap({{"path", Value("cat")}}));
    Value okv = getp(res, "ok");
    if (okv.is_bool() && okv.as_bool()) {
      report("direct", name, "ok", nullptr);
    }
    else {
      std::string m = as_str(getp(getp(res, "err"), "message"));
      report("direct", name, "error", &m);
    }
    i++;
  }
  return 0;
}
`.replace('SECRET_TOKEN', NONJSON_SECRET)


const ZIG_PROBE = String.raw`
const std = @import("std");
const sdk = @import("sdk");
const h = sdk.h;
const vs = sdk.vs;
const Value = sdk.Value;

fn vnull() Value {
    return Value{ .null = {} };
}

fn stub(ud: *anyopaque, _: std.mem.Allocator, _: Value) anyerror!Value {
    const c: *const Value = @ptrCast(@alignCast(ud));
    const readable = h.get_bool(c.*, "readable") orelse false;
    const body = h.getp(c.*, "body");
    const data: Value = if (readable) blk: {
        const parsed = try std.json.parseFromSlice(std.json.Value, h.A(), h.scalar_str(body), .{});
        break :blk try vs.fromStdJson(h.A(), parsed.value);
    } else vnull();
    const status = h.getp(c.*, "status");
    const headers = h.omap();
    const ctype = h.getp(c.*, "type");
    if (ctype == .string) h.setp(headers, "content-type", ctype);
    return h.jo(&.{
        .{ "status", status },
        .{ "statusText", h.vstr(if (h.to_int(status) < 400) "OK" else "Error") },
        .{ "headers", headers },
        .{ "json", h.json_thunk(data) },
        .{ "body", body },
        .{ "unreadable", h.vbool(!readable) },
    });
}

fn report(path: []const u8, name: []const u8, code: []const u8, message: ?[]const u8) void {
    if (message) |m| {
        std.debug.print("nonjson-{s}: {s}: {s} | {s}\n", .{ path, name, code, m });
    } else {
        std.debug.print("nonjson-{s}: {s}: {s}\n", .{ path, name, code });
    }
}

test "nonjson probe" {
    const io = std.Io.Threaded.global_single_threaded.io();
    const text = try std.Io.Dir.cwd().readFileAlloc(io, "nonjson-cases.json", h.A(), .unlimited);
    const parsed = try std.json.parseFromSlice(std.json.Value, h.A(), text, .{});
    const cases = try vs.fromStdJson(h.A(), parsed.value);
    for (cases.array.data.items, 0..) |c, i| {
        const cp = h.A().create(Value) catch unreachable;
        cp.* = c;
        const name = h.scalar_str(h.getp(c, "name"));
        const base = std.fmt.allocPrint(h.A(), "http://nonjson.test/c{d}", .{i}) catch unreachable;
        const opts = h.jo(&.{
            .{ "base", h.vstr(base) },
            .{ "apikey", h.vstr("SECRET_TOKEN") },
            .{ "system", h.jo(&.{.{ "fetch", h.callable(@ptrCast(cp), stub) }}) },
        });
        const agent = h.getp(c, "agent");
        if (agent == .string) h.setp(opts, "headers", h.jo(&.{.{ "user-agent", agent }}));
        const client = sdk.SDK.new(opts);
        switch (client.cat(vnull()).list(h.omap(), h.omap())) {
            .ok => report("probe", name, "ok", null),
            .err => |e| report("probe", name, e.code, e.msg),
        }
        const res = client.direct(h.jo(&.{.{ "path", h.vstr("cat") }}));
        const okv = h.getp(res, "ok");
        if (okv == .bool and okv.bool) {
            report("direct", name, "ok", null);
        } else {
            report("direct", name, "error", h.scalar_str(h.getp(res, "err")));
        }
    }
}
`.replace('SECRET_TOKEN', NONJSON_SECRET)


const OCAML_PROBE = String.raw`
open Voxgig_struct
open Sdk_types
open Sdk_helpers

let report path name code message =
  match message with
  | Some m -> Printf.printf "nonjson-%s: %s: %s | %s\n%!" path name code m
  | None -> Printf.printf "nonjson-%s: %s: %s\n%!" path name code

let stub (c : value) = Func (fun _ _ _ _ ->
    let readable = getp c "readable" = Bool true in
    let body = getp c "body" in
    let status = getp c "status" in
    let headers = empty_map () in
    (match getp c "type" with Str _ as t -> setp headers "content-type" t | _ -> ());
    let data = match readable, body with true, Str b -> Sdk_json.json_read b | _ -> Noval in
    jo [("status", status);
        ("statusText", Str (match status with Num n when n < 400. -> "OK" | _ -> "Error"));
        ("headers", headers); ("body", body); ("json", json_thunk data);
        ("unreadable", Bool (not readable))])

let () =
  let ic = open_in_bin (Sys.getenv "NONJSON_CASES") in
  let text = really_input_string ic (in_channel_length ic) in
  close_in ic;
  let cases = match Sdk_json.json_read text with List r -> !r | _ -> [] in
  List.iteri (fun i c ->
      let name = match getp c "name" with Str s -> s | _ -> "?" in
      let opts = jo [("base", Str ("http://nonjson.test/c" ^ string_of_int i));
                     ("apikey", Str "SECRET_TOKEN");
                     ("system", jo [("fetch", stub c)])] in
      (match getp c "agent" with Str _ as a -> setp opts "headers" (jo [("user-agent", a)]) | _ -> ());
      let client = Sdk_client.make opts in
      (match (Sdk_client.cat client Noval).e_list (empty_map ()) (empty_map ()) with
       | _ -> report "probe" name "ok" None
       | exception Sdk_error_exc e -> report "probe" name e.err_code (Some e.err_msg)
       | exception e -> report "probe" name "none" (Some (Printexc.to_string e)));
      let res = Sdk_client.direct client (jo [("path", Str "cat")]) in
      (match getp res "ok" with
       | Bool true -> report "direct" name "ok" None
       | _ ->
         let err = getp res "err" in
         let field k = match getp err k with Str s -> s | _ -> "none" in
         report "direct" name (field "code") (Some (field "message"))))
    cases
`.replace('SECRET_TOKEN', NONJSON_SECRET)


const SWIFT_PROBE = String.raw`import Foundation
import XCTest
@testable import DemoSdk

final class NonjsonProbeTest: XCTestCase {
  func report(_ path: String, _ name: String, _ code: String, _ message: String?) {
    let tail = message.map { " | " + $0.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ") } ?? ""
    print("nonjson-" + path + ": " + name + ": " + code + tail)
  }

  func codeOf(_ err: Any?) -> String {
    (err as? DemoError)?.code ?? "none"
  }

  func messageOf(_ err: Any?) -> String {
    if let e = err as? DemoError { return e.message }
    return err.map { "\($0)" } ?? ""
  }

  func testNonjsonProbe() throws {
    let env = ProcessInfo.processInfo.environment
    let base = env["NONJSON_BASE"] ?? ""
    let text = try String(contentsOfFile: env["NONJSON_CASES"] ?? "", encoding: .utf8)
    let cases = try JSON.parse(text).asList?.items ?? []
    for (i, c) in cases.enumerated() {
      let name = gp(c, "name").asString ?? "?"
      let opts = VMap()
      opts.entries["base"] = .string(base + "/c\(i)")
      opts.entries["apikey"] = .string("SECRET_TOKEN")
      if let agent = gp(c, "agent").asString {
        let headers = VMap()
        headers.entries["user-agent"] = .string(agent)
        opts.entries["headers"] = .map(headers)
      }
      let client = DemoSDK(opts)
      do {
        _ = try client.Cat(nil).list(VMap(), nil)
        report("probe", name, "ok", nil)
      } catch {
        report("probe", name, codeOf(error), messageOf(error))
      }
      let path = VMap()
      path.entries["path"] = .string("cat")
      let res = client.direct(path)
      if gp(res, "ok") == .bool(true) {
        report("direct", name, "ok", nil)
      } else {
        let err = gp(res, "err").asNative
        report("direct", name, codeOf(err), messageOf(err))
      }
    }
  }
}
`.replace('SECRET_TOKEN', NONJSON_SECRET)


const NONJSON_PROBES: Record<string, string> = {
  node: NODE_PROBE,
  go: GO_PROBE,
  py: PY_PROBE,
  rb: RB_PROBE,
  php: PHP_PROBE,
  perl: PERL_PROBE,
  lua: LUA_PROBE,
  java: JAVA_PROBE,
  kotlin: KOTLIN_PROBE,
  scala: SCALA_PROBE,
  csharp: CSHARP_PROBE,
  rust: RUST_PROBE,
  elixir: ELIXIR_PROBE,
  clojure: CLOJURE_PROBE,
  c: C_PROBE,
  cpp: CPP_PROBE,
  zig: ZIG_PROBE,
  ocaml: OCAML_PROBE,
  swift: SWIFT_PROBE,
}


export {
  NONJSON_CASES,
  NONJSON_PROBES,
  NONJSON_SECRET,
  NONJSON_SERVER,
  nonjsonFailures,
  nonjsonOutcomes,
  nonjsonTsv,
}
