// The allow option, driven through a generated SDK: every probe makes the same
// calls, and an allow list names whole methods and operations in any case, so
// `PU` is not `PUT`, `load` is not `reload`, and `get` is GET.
const ALLOW_OUTCOMES: Record<string, string> = {
  'prepare get': 'GET',
  'prepare POST': 'refused allow.method',
  'prepare PU': 'refused allow.method',
  'load get': 'sent',
  'direct indirect': 'refused allow.op',
  'load reload': 'refused allow.op',
}


function allowOutcomes(out: string): Record<string, string> {
  const found: Record<string, string> = {}
  for (const m of out.matchAll(/allow-probe: ([^:\n]+): ([^\r\n]*)/g)) {
    found[m[1]] = m[2].trim()
  }
  return found
}


const NODE_PROBE = `
const { SDK } = require('SDK_MODULE')

const base = process.env.ALLOW_BASE

const outcome = (err) => {
  const msg = String(null != err && null != err.message ? err.message : err)
  return msg.includes('allow.method value') ? 'refused allow.method' :
    msg.includes('allow.op value') ? 'refused allow.op' : 'error ' + msg.split('\\n')[0]
}

const report = (name, result) => console.log('allow-probe: ' + name + ': ' + result)

const call = async (name, fn) => {
  try {
    const res = await fn()
    report(name, res instanceof Error ? outcome(res) :
      null != res && false === res.ok ? outcome(res.err) : 'sent')
  }
  catch (err) {
    report(name, outcome(err))
  }
}

;(async () => {
  const a = new SDK({ base, allow: { method: 'get, PUT', op: 'direct,load' } })
  const b = new SDK({ base, allow: { op: 'indirect,reload' } })

  for (const method of ['get', 'POST', 'PU']) {
    const fetchdef = await a.prepare({ path: 'a', method })
    report('prepare ' + method, fetchdef instanceof Error ? outcome(fetchdef) : fetchdef.method)
  }

  await call('load get', () => a.Cat().load({ id: 'c1' }))
  await call('direct indirect', () => b.direct({ path: 'a' }))
  await call('load reload', () => b.Cat().load({ id: 'c1' }))
})()
`


// py's live transport needs requests; without it ALLOW_SEAM answers here.
const PY_PROBE = String.raw`
import os
from demo_sdk import DemoSDK

base = os.environ['ALLOW_BASE']
seam = 'ALLOW_SEAM' in os.environ


def stub(url, fetchdef):
    return {'status': 200, 'statusText': 'OK', 'headers': {},
            'json': lambda: {'id': 'x01'}, 'body': '{}'}, None


def outcome(err):
    msg = str(err)
    if 'allow.method value' in msg:
        return 'refused allow.method'
    if 'allow.op value' in msg:
        return 'refused allow.op'
    return 'error ' + (msg.splitlines() or [''])[0]


def report(name, result):
    print('allow-probe: %s: %s' % (name, result))


def call(name, fn):
    try:
        res = fn()
        if isinstance(res, dict) and res.get('ok') is False:
            report(name, outcome(res.get('err')))
        else:
            report(name, 'sent')
    except Exception as e:
        report(name, outcome(e))


def client(allow):
    opts = {'base': base, 'allow': allow}
    if seam:
        opts['system'] = {'fetch': stub}
    return DemoSDK(opts)


a = client({'method': 'get, PUT', 'op': 'direct,load'})
b = client({'op': 'indirect,reload'})

for method in ['get', 'POST', 'PU']:
    try:
        report('prepare ' + method, a.prepare({'path': 'a', 'method': method})['method'])
    except Exception as e:
        report('prepare ' + method, outcome(e))

call('load get', lambda: a.Cat().load({'id': 'c1'}))
call('direct indirect', lambda: b.direct({'path': 'a'}))
call('load reload', lambda: b.Cat().load({'id': 'c1'}))
`


const GO_PROBE = String.raw`package sdktest

import (
	"fmt"
	"os"
	"strings"
	"testing"

	sdk "GOMODULE"
)

func allowProbeOutcome(err any) string {
	msg := fmt.Sprint(err)
	if strings.Contains(msg, "allow.method value") {
		return "refused allow.method"
	}
	if strings.Contains(msg, "allow.op value") {
		return "refused allow.op"
	}
	return "error " + strings.SplitN(msg, "\n", 2)[0]
}

func allowProbeReport(name, result string) {
	fmt.Printf("allow-probe: %s: %s\n", name, result)
}

func allowProbeCall(name string, res map[string]any, err error) {
	if err != nil {
		allowProbeReport(name, allowProbeOutcome(err))
	} else if ok, isBool := res["ok"].(bool); isBool && !ok {
		allowProbeReport(name, allowProbeOutcome(res["err"]))
	} else {
		allowProbeReport(name, "sent")
	}
}

func TestAllowProbe(t *testing.T) {
	base := os.Getenv("ALLOW_BASE")
	a := sdk.NewDemoSDK(map[string]any{"base": base,
		"allow": map[string]any{"method": "get, PUT", "op": "direct,load"}})
	b := sdk.NewDemoSDK(map[string]any{"base": base,
		"allow": map[string]any{"op": "indirect,reload"}})

	for _, method := range []string{"get", "POST", "PU"} {
		fetchdef, err := a.Prepare(map[string]any{"path": "a", "method": method})
		if err != nil {
			allowProbeReport("prepare "+method, allowProbeOutcome(err))
		} else {
			allowProbeReport("prepare "+method, fmt.Sprint(fetchdef["method"]))
		}
	}

	_, err := a.Cat(nil).Load(map[string]any{"id": "c1"}, nil)
	allowProbeCall("load get", nil, err)
	res, err := b.Direct(map[string]any{"path": "a"})
	allowProbeCall("direct indirect", res, err)
	_, err = b.Cat(nil).Load(map[string]any{"id": "c1"}, nil)
	allowProbeCall("load reload", nil, err)
}
`


const RB_PROBE = String.raw`
require_relative 'Demo_sdk'

BASE = ENV['ALLOW_BASE']

def outcome(err)
  msg = err.respond_to?(:message) ? err.message : err.to_s
  return 'refused allow.method' if msg.include?('allow.method value')
  return 'refused allow.op' if msg.include?('allow.op value')
  'error ' + msg.lines.first.to_s.strip
end

def report(name, result)
  puts "allow-probe: #{name}: #{result}"
end

def call(name)
  res = yield
  if res.is_a?(Hash) && false == res['ok']
    report(name, outcome(res['err']))
  else
    report(name, 'sent')
  end
rescue StandardError => e
  report(name, outcome(e))
end

a = DemoSDK.new({ 'base' => BASE, 'allow' => { 'method' => 'get, PUT', 'op' => 'direct,load' } })
b = DemoSDK.new({ 'base' => BASE, 'allow' => { 'op' => 'indirect,reload' } })

%w[get POST PU].each do |method|
  begin
    report("prepare #{method}", a.prepare({ 'path' => 'a', 'method' => method })['method'])
  rescue StandardError => e
    report("prepare #{method}", outcome(e))
  end
end

call('load get') { a.Cat.load({ 'id' => 'c1' }) }
call('direct indirect') { b.direct({ 'path' => 'a' }) }
call('load reload') { b.Cat.load({ 'id' => 'c1' }) }
`


const PHP_PROBE = String.raw`<?php
require_once __DIR__ . '/demo_sdk.php';

function allow_outcome($err): string {
    $msg = $err instanceof Throwable ? $err->getMessage() : (string)$err;
    if (str_contains($msg, 'allow.method value')) {
        return 'refused allow.method';
    }
    if (str_contains($msg, 'allow.op value')) {
        return 'refused allow.op';
    }
    return 'error ' . explode("\n", $msg)[0];
}

function allow_report(string $name, string $result): void {
    echo 'allow-probe: ' . $name . ': ' . $result . "\n";
}

function allow_call(string $name, callable $fn): void {
    try {
        $res = $fn();
        if (is_array($res) && array_key_exists('ok', $res) && false === $res['ok']) {
            allow_report($name, allow_outcome($res['err'] ?? ''));
        } else {
            allow_report($name, 'sent');
        }
    } catch (Throwable $e) {
        allow_report($name, allow_outcome($e));
    }
}

$base = getenv('ALLOW_BASE');
$a = new DemoSDK(['base' => $base, 'allow' => ['method' => 'get, PUT', 'op' => 'direct,load']]);
$b = new DemoSDK(['base' => $base, 'allow' => ['op' => 'indirect,reload']]);

foreach (['get', 'POST', 'PU'] as $method) {
    try {
        $fetchdef = $a->prepare(['path' => 'a', 'method' => $method]);
        allow_report('prepare ' . $method, is_array($fetchdef) ? (string)$fetchdef['method'] : allow_outcome($fetchdef));
    } catch (Throwable $e) {
        allow_report('prepare ' . $method, allow_outcome($e));
    }
}

allow_call('load get', fn() => $a->Cat()->load(['id' => 'c1']));
allow_call('direct indirect', fn() => $b->direct(['path' => 'a']));
allow_call('load reload', fn() => $b->Cat()->load(['id' => 'c1']));
`


const PERL_PROBE = String.raw`
use strict;
use warnings;
use lib 'lib';
use DemoSDK;

sub outcome {
  my ($err) = @_;
  my $msg = defined $err ? "$err" : '';
  return 'refused allow.method' if index($msg, 'allow.method value') >= 0;
  return 'refused allow.op' if index($msg, 'allow.op value') >= 0;
  my ($first) = split /\n/, $msg;
  return 'error ' . (defined $first ? $first : '');
}

sub report {
  my ($name, $result) = @_;
  print "allow-probe: $name: $result\n";
}

sub call {
  my ($name, $fn) = @_;
  my $res = eval { $fn->() };
  if (my $err = $@) {
    report($name, outcome($err));
  }
  elsif (ref $res eq 'HASH' && exists $res->{ok} && !$res->{ok}) {
    report($name, outcome($res->{err}));
  }
  else {
    report($name, 'sent');
  }
}

my $base = $ENV{ALLOW_BASE};
my $ca = DemoSDK->new({ base => $base, allow => { method => 'get, PUT', op => 'direct,load' } });
my $cb = DemoSDK->new({ base => $base, allow => { op => 'indirect,reload' } });

for my $method (qw(get POST PU)) {
  my $fetchdef = eval { $ca->prepare({ path => 'a', method => $method }) };
  if (my $err = $@) {
    report("prepare $method", outcome($err));
  }
  else {
    report("prepare $method", $fetchdef->{method});
  }
}

call('load get', sub { $ca->Cat->load({ id => 'c1' }) });
call('direct indirect', sub { $cb->direct({ path => 'a' }) });
call('load reload', sub { $cb->Cat->load({ id => 'c1' }) });
`


// lua's live transport needs luasocket; without it ALLOW_SEAM answers here.
const LUA_PROBE = String.raw`
local sdk = require("demo_sdk")

local base = os.getenv("ALLOW_BASE")
local seam = os.getenv("ALLOW_SEAM") ~= nil

local function stub(url, fetchdef)
  return { status = 200, statusText = "OK", headers = {},
    json = function() return { id = "x01" } end, body = "{}" }, nil
end

local function outcome(err)
  local msg = tostring(err)
  if msg:find("allow.method value", 1, true) then return "refused allow.method" end
  if msg:find("allow.op value", 1, true) then return "refused allow.op" end
  return "error " .. (msg:match("[^\n]*") or "")
end

local function report(name, result)
  print("allow-probe: " .. name .. ": " .. result)
end

local function call(name, fn)
  local ok, res, err = pcall(fn)
  if not ok then
    report(name, outcome(res))
  elseif err ~= nil then
    report(name, outcome(err))
  elseif type(res) == "table" and rawget(res, "ok") == false then
    report(name, outcome(rawget(res, "err")))
  else
    report(name, "sent")
  end
end

local function client(allow)
  local opts = { base = base, allow = allow }
  if seam then opts.system = { fetch = stub } end
  return sdk.new(opts)
end

local a = client({ method = "get, PUT", op = "direct,load" })
local b = client({ op = "indirect,reload" })

for _, method in ipairs({ "get", "POST", "PU" }) do
  local ok, fetchdef, err = pcall(function() return a:prepare({ path = "a", method = method }) end)
  if not ok then
    report("prepare " .. method, outcome(fetchdef))
  elseif err ~= nil then
    report("prepare " .. method, outcome(err))
  else
    report("prepare " .. method, tostring(fetchdef.method))
  end
end

call("load get", function() local ent = a:Cat(); return ent:load({ id = "c1" }) end)
call("direct indirect", function() return b:direct({ path = "a" }) end)
call("load reload", function() local ent = b:Cat(); return ent:load({ id = "c1" }) end)
`


const JAVA_PROBE = String.raw`
import java.util.*;
import voxgig.demosdk.core.*;

public class AllowProbe {
  interface Call { Object run() throws Exception; }

  static String outcome(Object err) {
    String msg = err instanceof Throwable && null != ((Throwable) err).getMessage()
        ? ((Throwable) err).getMessage() : String.valueOf(err);
    if (msg.contains("allow.method value")) return "refused allow.method";
    if (msg.contains("allow.op value")) return "refused allow.op";
    return "error " + msg.split("\n", 2)[0];
  }

  static void report(String name, String result) {
    System.out.println("allow-probe: " + name + ": " + result);
  }

  @SuppressWarnings("unchecked")
  static void call(String name, Call fn) {
    try {
      Object res = fn.run();
      if (res instanceof Map && Boolean.FALSE.equals(((Map<String, Object>) res).get("ok"))) {
        report(name, outcome(((Map<String, Object>) res).get("err")));
      }
      else {
        report(name, "sent");
      }
    }
    catch (Exception e) {
      report(name, outcome(e));
    }
  }

  static Map<String, Object> map(Object... kv) {
    Map<String, Object> m = new LinkedHashMap<>();
    for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
    return m;
  }

  public static void main(String[] args) {
    String base = System.getenv("ALLOW_BASE");
    DemoSDK a = new DemoSDK(map("base", base, "allow", map("method", "get, PUT", "op", "direct,load")));
    DemoSDK b = new DemoSDK(map("base", base, "allow", map("op", "indirect,reload")));
    for (String method : List.of("get", "POST", "PU")) {
      try {
        Map<String, Object> fetchdef = a.prepare(map("path", "a", "method", method));
        report("prepare " + method, String.valueOf(fetchdef.get("method")));
      }
      catch (Exception e) {
        report("prepare " + method, outcome(e));
      }
    }
    call("load get", () -> a.cat(null).load(map("id", "c1"), null));
    call("direct indirect", () -> b.direct(map("path", "a")));
    call("load reload", () -> b.cat(null).load(map("id", "c1"), null));
  }
}
`


const KOTLIN_PROBE = String.raw`package voxgig.demosdk.sdktest

import org.junit.jupiter.api.Test

import voxgig.demosdk.core.DemoSDK

class AllowProbe {

  private fun outcome(err: Any?): String {
    val msg = (if (err is Throwable) err.message else null) ?: err.toString()
    return when {
      msg.contains("allow.method value") -> "refused allow.method"
      msg.contains("allow.op value") -> "refused allow.op"
      else -> "error " + msg.lines().first()
    }
  }

  private fun report(name: String, result: String) {
    println("allow-probe: " + name + ": " + result)
  }

  private fun call(name: String, fn: () -> Any?) {
    try {
      val res = fn()
      if (res is Map<*, *> && res["ok"] == false) report(name, outcome(res["err"]))
      else report(name, "sent")
    } catch (e: Exception) {
      report(name, outcome(e))
    }
  }

  @Test
  fun allowProbe() {
    val base = System.getenv("ALLOW_BASE")
    val a = DemoSDK(linkedMapOf<String, Any?>("base" to base,
      "allow" to linkedMapOf<String, Any?>("method" to "get, PUT", "op" to "direct,load")))
    val b = DemoSDK(linkedMapOf<String, Any?>("base" to base,
      "allow" to linkedMapOf<String, Any?>("op" to "indirect,reload")))
    for (method in listOf("get", "POST", "PU")) {
      try {
        val fetchdef = a.prepare(linkedMapOf<String, Any?>("path" to "a", "method" to method))
        report("prepare " + method, fetchdef["method"].toString())
      } catch (e: Exception) {
        report("prepare " + method, outcome(e))
      }
    }
    call("load get") { a.cat(null).load(linkedMapOf<String, Any?>("id" to "c1"), null) }
    call("direct indirect") { b.direct(linkedMapOf<String, Any?>("path" to "a")) }
    call("load reload") { b.cat(null).load(linkedMapOf<String, Any?>("id" to "c1"), null) }
  }
}
`


const SCALA_PROBE = String.raw`
import java.util.{LinkedHashMap, Map => JMap}
import voxgig.demosdk.core.DemoSDK

object AllowProbeMain {
  private def outcome(err: Any): String = {
    val msg = err match {
      case e: Throwable if null != e.getMessage => e.getMessage
      case other => String.valueOf(other)
    }
    if (msg.contains("allow.method value")) "refused allow.method"
    else if (msg.contains("allow.op value")) "refused allow.op"
    else "error " + msg.split("\n", 2)(0)
  }

  private def report(name: String, result: String): Unit =
    println("allow-probe: " + name + ": " + result)

  private def call(name: String)(fn: => Any): Unit = {
    try {
      fn match {
        case m: JMap[_, _] if java.lang.Boolean.FALSE == m.get("ok") => report(name, outcome(m.get("err")))
        case _ => report(name, "sent")
      }
    }
    catch {
      case e: Exception => report(name, outcome(e))
    }
  }

  private def map(kv: (String, Object)*): JMap[String, Object] = {
    val m = new LinkedHashMap[String, Object]()
    kv.foreach { case (k, v) => m.put(k, v) }
    m
  }

  def main(args: Array[String]): Unit = {
    val base = System.getenv("ALLOW_BASE")
    val a = new DemoSDK(map("base" -> base, "allow" -> map("method" -> "get, PUT", "op" -> "direct,load")))
    val b = new DemoSDK(map("base" -> base, "allow" -> map("op" -> "indirect,reload")))
    for (method <- Seq("get", "POST", "PU")) {
      try {
        val fetchdef = a.prepare(map("path" -> "a", "method" -> method))
        report("prepare " + method, String.valueOf(fetchdef.get("method")))
      }
      catch {
        case e: Exception => report("prepare " + method, outcome(e))
      }
    }
    call("load get") { a.cat(null).load(map("id" -> "c1"), null) }
    call("direct indirect") { b.direct(map("path" -> "a")) }
    call("load reload") { b.cat(null).load(map("id" -> "c1"), null) }
  }
}
`


const CSHARP_PROBE = String.raw`
using DemoSdk;

public static class AllowProbe
{
    static string Outcome(object? err)
    {
        var msg = err is Exception e ? e.Message : err?.ToString() ?? "";
        if (msg.Contains("allow.method value")) return "refused allow.method";
        if (msg.Contains("allow.op value")) return "refused allow.op";
        return "error " + msg.Split('\n')[0];
    }

    static void Report(string name, string result) => Console.WriteLine($"allow-probe: {name}: {result}");

    static void Call(string name, Func<object?> fn)
    {
        try
        {
            var res = fn();
            if (res is Dictionary<string, object?> m && m.TryGetValue("ok", out var ok) && ok is false)
            {
                Report(name, Outcome(m.GetValueOrDefault("err")));
            }
            else
            {
                Report(name, "sent");
            }
        }
        catch (Exception e)
        {
            Report(name, Outcome(e));
        }
    }

    static Dictionary<string, object?> Allow(string? method, string op)
    {
        var allow = new Dictionary<string, object?> { ["op"] = op };
        if (method != null) allow["method"] = method;
        return allow;
    }

    public static void Main()
    {
        var abase = Environment.GetEnvironmentVariable("ALLOW_BASE");
        var a = new DemoSDK(new Dictionary<string, object?> { ["base"] = abase, ["allow"] = Allow("get, PUT", "direct,load") });
        var b = new DemoSDK(new Dictionary<string, object?> { ["base"] = abase, ["allow"] = Allow(null, "indirect,reload") });
        foreach (var method in new[] { "get", "POST", "PU" })
        {
            try
            {
                var fetchdef = a.Prepare(new Dictionary<string, object?> { ["path"] = "a", ["method"] = method });
                Report("prepare " + method, fetchdef["method"]?.ToString() ?? "");
            }
            catch (Exception e)
            {
                Report("prepare " + method, Outcome(e));
            }
        }
        Call("load get", () => a.Cat().Load(new Dictionary<string, object?> { ["id"] = "c1" }));
        Call("direct indirect", () => b.Direct(new Dictionary<string, object?> { ["path"] = "a" }));
        Call("load reload", () => b.Cat().Load(new Dictionary<string, object?> { ["id"] = "c1" }));
    }
}
`


const SWIFT_PROBE = String.raw`import Foundation
import XCTest
@testable import DemoSdk

final class AllowProbeTest: XCTestCase {
  func outcome(_ err: Any?) -> String {
    let msg = err.map { "\($0)" } ?? ""
    if msg.contains("allow.method value") { return "refused allow.method" }
    if msg.contains("allow.op value") { return "refused allow.op" }
    return "error " + (msg.split(separator: "\n").first.map(String.init) ?? "")
  }

  func report(_ name: String, _ result: String) {
    print("allow-probe: \(name): \(result)")
  }

  func client(_ allow: VMap) -> DemoSDK {
    let opts = VMap()
    opts.entries["base"] = .string(ProcessInfo.processInfo.environment["ALLOW_BASE"] ?? "")
    opts.entries["allow"] = .map(allow)
    return DemoSDK(opts)
  }

  func testAllowProbe() throws {
    let la = VMap()
    la.entries["method"] = .string("get, PUT")
    la.entries["op"] = .string("direct,load")
    let lb = VMap()
    lb.entries["op"] = .string("indirect,reload")
    let a = client(la)
    let b = client(lb)

    for method in ["get", "POST", "PU"] {
      let args = VMap()
      args.entries["path"] = .string("a")
      args.entries["method"] = .string(method)
      do {
        let fetchdef = try a.prepare(args)
        report("prepare " + method, gp(fetchdef, "method").asString ?? "")
      } catch {
        report("prepare " + method, outcome(error))
      }
    }

    let id = VMap()
    id.entries["id"] = .string("c1")
    do {
      _ = try a.Cat(nil).load(id, nil)
      report("load get", "sent")
    } catch {
      report("load get", outcome(error))
    }

    let path = VMap()
    path.entries["path"] = .string("a")
    let res = b.direct(path)
    if gp(res, "ok") == .bool(false) {
      report("direct indirect", outcome(gp(res, "err").asNative))
    } else {
      report("direct indirect", "sent")
    }

    do {
      _ = try b.Cat(nil).load(id, nil)
      report("load reload", "sent")
    } catch {
      report("load reload", outcome(error))
    }
  }
}
`


const ELIXIR_PROBE = String.raw`
defmodule Demo.AllowProbeTest do
  use ExUnit.Case

  alias Voxgig.Struct, as: S

  defp outcome(err) do
    msg =
      cond do
        is_exception(err) -> Exception.message(err)
        is_binary(err) -> err
        true -> inspect(err)
      end

    cond do
      String.contains?(msg, "allow.method value") -> "refused allow.method"
      String.contains?(msg, "allow.op value") -> "refused allow.op"
      true -> "error " <> (msg |> String.split("\n") |> hd())
    end
  end

  defp report(name, result), do: IO.puts("allow-probe: #{name}: #{result}")

  defp call(name, fun) do
    try do
      res = fun.()

      if S.ismap(res) and S.getprop(res, "ok") == false do
        report(name, outcome(S.getprop(res, "err")))
      else
        report(name, "sent")
      end
    rescue
      e -> report(name, outcome(e))
    end
  end

  test "allow probe" do
    base = System.get_env("ALLOW_BASE")
    a = Demo.new(S.jm(["base", base, "allow", S.jm(["method", "get, PUT", "op", "direct,load"])]))
    b = Demo.new(S.jm(["base", base, "allow", S.jm(["op", "indirect,reload"])]))

    Enum.each(["get", "POST", "PU"], fn method ->
      try do
        fetchdef = Demo.prepare(a, S.jm(["path", "a", "method", method]))
        report("prepare " <> method, S.getprop(fetchdef, "method"))
      rescue
        e -> report("prepare " <> method, outcome(e))
      end
    end)

    call("load get", fn -> Demo.Entity.Cat.load(Demo.cat(a), S.jm(["id", "c1"])) end)
    call("direct indirect", fn -> Demo.direct(b, S.jm(["path", "a"])) end)
    call("load reload", fn -> Demo.Entity.Cat.load(Demo.cat(b), S.jm(["id", "c1"])) end)
  end
end
`


const CLOJURE_PROBE = String.raw`
(require '[sdk.api :as api]
         '[sdk.client :as client]
         '[voxgig.struct :as vs]
         '[clojure.string :as cstr]
         '[sdk.entity.cat :as e-cat])

(def base (System/getenv "ALLOW_BASE"))

(defn outcome [err]
  (let [msg (str (if (instance? Throwable err) (.getMessage ^Throwable err) err))]
    (cond
      (cstr/includes? msg "allow.method value") "refused allow.method"
      (cstr/includes? msg "allow.op value") "refused allow.op"
      :else (str "error " (first (cstr/split-lines msg))))))

(defn report [name result]
  (println (str "allow-probe: " name ": " result)))

(defn call [name f]
  (try
    (let [res (f)]
      (if (and (vs/ismap res) (= false (vs/getprop res "ok")))
        (report name (outcome (vs/getprop res "err")))
        (report name "sent")))
    (catch Throwable e (report name (outcome e)))))

(def a (api/make-sdk (vs/jm "base" base "allow" (vs/jm "method" "get, PUT" "op" "direct,load"))))
(def b (api/make-sdk (vs/jm "base" base "allow" (vs/jm "op" "indirect,reload"))))

(doseq [method ["get" "POST" "PU"]]
  (try
    (report (str "prepare " method)
            (vs/getprop (client/prepare a (vs/jm "path" "a" "method" method)) "method"))
    (catch Throwable e (report (str "prepare " method) (outcome e)))))

(call "load get" #(e-cat/load (api/cat a nil) (vs/jm "id" "c1") (vs/jm)))
(call "direct indirect" #(client/direct b (vs/jm "path" "a")))
(call "load reload" #(e-cat/load (api/cat b nil) (vs/jm "id" "c1") (vs/jm)))
`


const RUST_PROBE = String.raw`
use demo_sdk::core::helpers::{getp, jo};
use demo_sdk::{DemoEntity, DemoSDK, Value};

fn outcome(msg: String) -> String {
    if msg.contains("allow.method value") {
        "refused allow.method".to_string()
    } else if msg.contains("allow.op value") {
        "refused allow.op".to_string()
    } else {
        format!("error {}", msg.lines().next().unwrap_or(""))
    }
}

fn report(name: &str, result: &str) {
    println!("allow-probe: {}: {}", name, result);
}

#[test]
fn allow_probe() {
    let base = std::env::var("ALLOW_BASE").unwrap();
    let a = DemoSDK::new(jo(vec![
        ("base", Value::str(base.clone())),
        ("allow", jo(vec![("method", Value::str("get, PUT")), ("op", Value::str("direct,load"))])),
    ]));
    let b = DemoSDK::new(jo(vec![
        ("base", Value::str(base)),
        ("allow", jo(vec![("op", Value::str("indirect,reload"))])),
    ]));

    for method in ["get", "POST", "PU"] {
        let name = format!("prepare {}", method);
        match a.prepare(jo(vec![("path", Value::str("a")), ("method", Value::str(method))])) {
            Ok(fetchdef) => match getp(&fetchdef, "method") {
                Value::Str(m) => report(&name, &m),
                _ => report(&name, "error no method"),
            },
            Err(e) => report(&name, &outcome(e.to_string())),
        }
    }

    let id = || jo(vec![("id", Value::str("c1"))]);
    match a.cat(Value::Noval).load(id(), Value::Noval) {
        Ok(_) => report("load get", "sent"),
        Err(e) => report("load get", &outcome(e.to_string())),
    }
    match b.direct(jo(vec![("path", Value::str("a"))])) {
        Ok(res) => match getp(&res, "ok") {
            Value::Bool(false) => {
                let msg = match getp(&res, "err") {
                    Value::Str(s) => s,
                    _ => String::from("error value"),
                };
                report("direct indirect", &outcome(msg))
            }
            _ => report("direct indirect", "sent"),
        },
        Err(e) => report("direct indirect", &outcome(e.to_string())),
    }
    match b.cat(Value::Noval).load(id(), Value::Noval) {
        Ok(_) => report("load reload", "sent"),
        Err(e) => report("load reload", &outcome(e.to_string())),
    }
}
`


// c, cpp, zig and ocaml ship no live transport: system.fetch answers here.
const C_PROBE = String.raw`
#include "sdk.h"
#include "api.h"
#include <stdio.h>
#include <string.h>

static voxgig_value* stub(void* ud, voxgig_value* args) {
  (void)ud;
  (void)args;
  return cmap(5, "status", v_num(200), "statusText", v_str("OK"), "headers", v_map(),
    "body", v_str("{}"), "json", json_thunk(cmap(1, "id", v_str("x01"))));
}

static const char* outcome(const char* msg) {
  static char buf[512];
  if (!msg) return "error (none)";
  if (strstr(msg, "allow.method value")) return "refused allow.method";
  if (strstr(msg, "allow.op value")) return "refused allow.op";
  snprintf(buf, sizeof(buf), "error %s", msg);
  char* nl = strchr(buf, '\n');
  if (nl) *nl = '\0';
  return buf;
}

static void report(const char* name, const char* result) {
  printf("allow-probe: %s: %s\n", name, result);
}

static DemoSDK* client(voxgig_value* allow) {
  return demo_sdk_new(cmap(3, "base", v_str("http://allow.test"), "allow", allow,
    "system", cmap(1, "fetch", vfn(stub, NULL))));
}

static void load(const char* name, DemoSDK* sdk) {
  PNError* err = NULL;
  Entity* e = demo_cat(sdk, NULL);
  e->vt->load(e, cmap(1, "id", v_str("c1")), v_map(), &err);
  report(name, err ? outcome(pn_error_str(err)) : "sent");
}

int main(void) {
  DemoSDK* a = client(cmap(2, "method", v_str("get, PUT"), "op", v_str("direct,load")));
  DemoSDK* b = client(cmap(1, "op", v_str("indirect,reload")));
  const char* methods[] = {"get", "POST", "PU"};
  char name[64];
  for (int i = 0; i < 3; i++) {
    PNError* err = NULL;
    voxgig_value* fetchdef = sdk_prepare(a, cmap(2, "path", v_str("a"), "method", v_str(methods[i])), &err);
    snprintf(name, sizeof(name), "prepare %s", methods[i]);
    report(name, err ? outcome(pn_error_str(err)) : get_str(fetchdef, "method"));
  }
  load("load get", a);
  PNError* derr = NULL;
  voxgig_value* res = sdk_direct(b, cmap(1, "path", v_str("a")), &derr);
  bool ok = true;
  if (derr) report("direct indirect", outcome(pn_error_str(derr)));
  else if (get_bool(res, "ok", &ok) && !ok) report("direct indirect", outcome(get_str(res, "err")));
  else report("direct indirect", "sent");
  load("load reload", b);
  return 0;
}
`


const CPP_PROBE = String.raw`
#include <iostream>
#include <string>

#include "harness.hpp"

using namespace sdk;

static std::string outcome(const std::string& msg) {
  if (std::string::npos != msg.find("allow.method value")) return "refused allow.method";
  if (std::string::npos != msg.find("allow.op value")) return "refused allow.op";
  return "error " + msg.substr(0, msg.find('\n'));
}

static void report(const std::string& name, const std::string& result) {
  std::cout << "allow-probe: " << name << ": " << result << std::endl;
}

template <typename F>
static void op(const std::string& name, F fn) {
  try {
    fn();
    report(name, "sent");
  }
  catch (const SdkErrorPtr& e) {
    report(name, outcome(e->what()));
  }
  catch (const std::exception& e) {
    report(name, outcome(e.what()));
  }
}

int main() {
  vs::Injector fetch = [](vs::Injection&, const Value&, const std::string&, const Value&) -> Value {
    Value out = vmap();
    map_put(out, "status", Value(200));
    map_put(out, "statusText", Value("OK"));
    map_put(out, "headers", vmap());
    map_put(out, "body", Value("{}"));
    map_put(out, "json", json_thunk(vmap({{"id", Value("x01")}})));
    return out;
  };
  auto client = [&](const Value& allow) {
    return std::make_shared<DemoSDK>(vmap({
      {"base", Value("http://allow.test")},
      {"allow", allow},
      {"system", vmap({{"fetch", Value(fetch)}})},
    }));
  };
  auto a = client(vmap({{"method", Value("get, PUT")}, {"op", Value("direct,load")}}));
  auto b = client(vmap({{"op", Value("indirect,reload")}}));

  for (const std::string method : {"get", "POST", "PU"}) {
    try {
      Value fetchdef = a->prepare(vmap({{"path", Value("a")}, {"method", Value(method)}}));
      report("prepare " + method, as_str(getp(fetchdef, "method")));
    }
    catch (const SdkErrorPtr& e) {
      report("prepare " + method, outcome(e->what()));
    }
    catch (const std::exception& e) {
      report("prepare " + method, outcome(e.what()));
    }
  }

  op("load get", [&] { a->cat()->load(vmap({{"id", Value("c1")}}), vmap()); });
  try {
    Value res = b->direct(vmap({{"path", Value("a")}}));
    Value okv = getp(res, "ok");
    if (okv.is_bool() && !okv.as_bool()) {
      report("direct indirect", outcome(as_str(getp(getp(res, "err"), "message"))));
    }
    else {
      report("direct indirect", "sent");
    }
  }
  catch (const SdkErrorPtr& e) {
    report("direct indirect", outcome(e->what()));
  }
  op("load reload", [&] { b->cat()->load(vmap({{"id", Value("c1")}}), vmap()); });
  return 0;
}
`


const ZIG_PROBE = String.raw`
const std = @import("std");
const sdk = @import("sdk");
const h = sdk.h;
const Value = sdk.Value;

fn vnull() Value {
    return Value{ .null = {} };
}

fn stub(_: *anyopaque, _: std.mem.Allocator, _: Value) anyerror!Value {
    return h.jo(&.{
        .{ "status", h.vnum(200) },
        .{ "statusText", h.vstr("OK") },
        .{ "headers", h.omap() },
        .{ "json", h.json_thunk(h.jo(&.{.{ "id", h.vstr("x01") }})) },
        .{ "body", h.vstr("{}") },
    });
}
var stub_dummy: u8 = 0;

fn outcome(msg: []const u8) []const u8 {
    if (std.mem.indexOf(u8, msg, "allow.method value") != null) return "refused allow.method";
    if (std.mem.indexOf(u8, msg, "allow.op value") != null) return "refused allow.op";
    return std.fmt.allocPrint(h.A(), "error {s}", .{msg}) catch "error";
}

fn report(name: []const u8, result: []const u8) void {
    std.debug.print("allow-probe: {s}: {s}\n", .{ name, result });
}

fn opts(allow: Value) Value {
    return h.jo(&.{
        .{ "base", h.vstr("http://allow.test") },
        .{ "allow", allow },
        .{ "system", h.jo(&.{.{ "fetch", h.callable(@ptrCast(&stub_dummy), stub) }}) },
    });
}

test "allow probe" {
    const a = sdk.SDK.new(opts(h.jo(&.{ .{ "method", h.vstr("get, PUT") }, .{ "op", h.vstr("direct,load") } })));
    const b = sdk.SDK.new(opts(h.jo(&.{.{ "op", h.vstr("indirect,reload") }})));

    for ([_][]const u8{ "get", "POST", "PU" }) |method| {
        const name = std.fmt.allocPrint(h.A(), "prepare {s}", .{method}) catch unreachable;
        if (a.prepare(h.jo(&.{ .{ "path", h.vstr("a") }, .{ "method", h.vstr(method) } }))) |fetchdef| {
            report(name, h.scalar_str(h.getp(fetchdef, "method")));
        } else |_| {
            report(name, outcome(if (a.rootctx.?.pending_err) |e| e.msg else "no error recorded"));
        }
    }

    switch (a.cat(vnull()).load(h.jo(&.{.{ "id", h.vstr("c1") }}), h.omap())) {
        .ok => report("load get", "sent"),
        .err => |e| report("load get", outcome(e.msg)),
    }

    const res = b.direct(h.jo(&.{.{ "path", h.vstr("a") }}));
    const okv = h.getp(res, "ok");
    if (okv == .bool and !okv.bool) {
        report("direct indirect", outcome(h.scalar_str(h.getp(res, "err"))));
    } else {
        report("direct indirect", "sent");
    }

    switch (b.cat(vnull()).load(h.jo(&.{.{ "id", h.vstr("c1") }}), h.omap())) {
        .ok => report("load reload", "sent"),
        .err => |e| report("load reload", outcome(e.msg)),
    }
}
`


const OCAML_PROBE = String.raw`
open Voxgig_struct
open Sdk_types
open Sdk_helpers

let fetch = Func (fun _ _ _ _ ->
    jo [("status", Num 200.); ("statusText", Str "OK"); ("headers", empty_map ());
        ("body", Str "{}"); ("json", json_thunk (jo [("id", Str "x01")]))])

let contains (hay : string) (needle : string) : bool =
  let hl = String.length hay and nl = String.length needle in
  let rec go i = i + nl <= hl && (String.sub hay i nl = needle || go (i + 1)) in
  go 0

let outcome (msg : string) : string =
  if contains msg "allow.method value" then "refused allow.method"
  else if contains msg "allow.op value" then "refused allow.op"
  else "error " ^ List.hd (String.split_on_char '\n' msg)

let report name result = Printf.printf "allow-probe: %s: %s\n%!" name result

let message (e : exn) : string =
  match e with
  | Sdk_error_exc err -> err.err_msg
  | e -> Printexc.to_string e

let client allow =
  Sdk_client.make (jo [("base", Str "http://allow.test"); ("allow", allow);
                       ("system", jo [("fetch", fetch)])])

let () =
  let a = client (jo [("method", Str "get, PUT"); ("op", Str "direct,load")]) in
  let b = client (jo [("op", Str "indirect,reload")]) in
  List.iter (fun m ->
      let name = "prepare " ^ m in
      match Sdk_client.prepare a (jo [("path", Str "a"); ("method", Str m)]) with
      | fetchdef -> report name (match getp fetchdef "method" with Str s -> s | _ -> "?")
      | exception e -> report name (outcome (message e)))
    ["get"; "POST"; "PU"];
  (match (Sdk_client.cat a Noval).e_load (jo [("id", Str "c1")]) (empty_map ()) with
   | _ -> report "load get" "sent"
   | exception e -> report "load get" (outcome (message e)));
  (match Sdk_client.direct b (jo [("path", Str "a")]) with
   | res ->
     (match getp res "ok" with
      | Bool false ->
        report "direct indirect" (outcome (match getp res "err" with Str s -> s | _ -> "?"))
      | _ -> report "direct indirect" "sent")
   | exception e -> report "direct indirect" (outcome (message e)));
  (match (Sdk_client.cat b Noval).e_load (jo [("id", Str "c1")]) (empty_map ()) with
   | _ -> report "load reload" "sent"
   | exception e -> report "load reload" (outcome (message e)))
`


const ALLOW_PROBES: Record<string, string> = {
  node: NODE_PROBE,
  py: PY_PROBE,
  go: GO_PROBE,
  rb: RB_PROBE,
  php: PHP_PROBE,
  perl: PERL_PROBE,
  lua: LUA_PROBE,
  java: JAVA_PROBE,
  kotlin: KOTLIN_PROBE,
  scala: SCALA_PROBE,
  csharp: CSHARP_PROBE,
  swift: SWIFT_PROBE,
  elixir: ELIXIR_PROBE,
  clojure: CLOJURE_PROBE,
  rust: RUST_PROBE,
  c: C_PROBE,
  cpp: CPP_PROBE,
  zig: ZIG_PROBE,
  ocaml: OCAML_PROBE,
}


export {
  ALLOW_OUTCOMES,
  ALLOW_PROBES,
  allowOutcomes,
}
