// A live load with the secrets feature exchanging a refresh token and no
// access token, so the load buys one first: a POST to the token endpoint.
// Each probe sends to GETONLY_BASE and prints the load's outcome.

// A plugin group gives the exchange a transport where the SDK has none.
const NO_TRANSPORT = ['cpp', 'zig', 'ocaml']

function getOnlyModel(target: string): string {
  return (NO_TRANSPORT.includes(target)
    ? '\nmain: kit: feature: secrets: { active: true plugin: vault: active: true }\n'
    : '\nmain: kit: feature: secrets: active: true\n') +
    'main: kit: config: auth: active: true\n'
}

const GETONLY_FEATURES = ['test', 'log', 'secrets']

// How much longer than an answered run a stalled one may take, past the
// exchange's own limit.
const GETONLY_STALL_MS = 45000

// The token endpoint the exchange posts to, by default.
const GETONLY_PATH = '/auth/token'

type GetOnlyOutcome = { code: string, message: string }

// `getonly-probe: <code> <message>`, the code `ok` for a load that returned.
function getOnlyOutcome(out: string): GetOnlyOutcome | null {
  const m = /getonly-probe: (\S*) ?(.*)/.exec(out)
  return null == m ? null : { code: m[1], message: m[2].trim() }
}


const NODE_PROBE = `
const { SDK } = require('SDK_MODULE')

;(async () => {
  const client = new SDK({
    base: process.env.GETONLY_BASE,
    feature: {
      secrets: { active: true, exchange: { active: true, refresh: 'REFRESH01' } },
      ...(process.env.GETONLY_TEST ? { test: { active: true } } : {}),
    },
  })
  try {
    await client.Cat().load({ id: 'c1' })
    console.log('getonly-probe: ok')
  }
  catch (e) {
    console.log('getonly-probe: ' + e.code + ' ' + e.message)
  }
})()
`


const GO_PROBE = String.raw`package sdktest

import (
	"errors"
	"fmt"
	"os"
	"testing"

	sdk "GOMODULE"
)

func TestGetonlyProbe(t *testing.T) {
	feature := map[string]any{"secrets": map[string]any{
		"active":   true,
		"exchange": map[string]any{"active": true, "refresh": "REFRESH01"},
	}}
	if "" != os.Getenv("GETONLY_TEST") {
		feature["test"] = map[string]any{"active": true}
	}
	client, err := sdk.NewDemoSDK(map[string]any{"base": os.Getenv("GETONLY_BASE"), "feature": feature})
	if nil == err {
		_, err = client.Cat(nil).Load(map[string]any{"id": "c1"}, nil)
	}
	var se *sdk.DemoError
	if nil == err {
		fmt.Println("getonly-probe: ok")
	} else if errors.As(err, &se) {
		fmt.Println("getonly-probe: " + se.Code + " " + se.Msg)
	} else {
		fmt.Println("getonly-probe: none " + err.Error())
	}
}
`


const PY_PROBE = String.raw`
import os
from demo_sdk import DemoSDK

feature = {'secrets': {'active': True, 'exchange': {'active': True, 'refresh': 'REFRESH01'}}}
if os.environ.get('GETONLY_TEST'):
    feature['test'] = {'active': True}
client = DemoSDK({'base': os.environ['GETONLY_BASE'], 'feature': feature})
try:
    client.Cat(None).load({'id': 'c1'}, None)
    print('getonly-probe: ok')
except Exception as e:
    print('getonly-probe: %s %s' % (getattr(e, 'code', 'none'), getattr(e, 'msg', str(e))))
`


const RB_PROBE = String.raw`
require_relative 'Demo_sdk'

feature = { 'secrets' => { 'active' => true,
  'exchange' => { 'active' => true, 'refresh' => 'REFRESH01' } } }
feature['test'] = { 'active' => true } if ENV['GETONLY_TEST']
client = DemoSDK.new({ 'base' => ENV['GETONLY_BASE'], 'feature' => feature })
begin
  client.Cat(nil).load({ 'id' => 'c1' }, nil)
  puts 'getonly-probe: ok'
rescue StandardError => e
  puts "getonly-probe: #{e.respond_to?(:code) ? e.code : 'none'} #{e.message}"
end
`


const PHP_PROBE = String.raw`<?php
require_once __DIR__ . '/demo_sdk.php';

$feature = ['secrets' => ['active' => true,
    'exchange' => ['active' => true, 'refresh' => 'REFRESH01']]];
if (getenv('GETONLY_TEST')) {
    $feature['test'] = ['active' => true];
}
$client = new DemoSDK(['base' => getenv('GETONLY_BASE'), 'feature' => $feature]);
try {
    $client->Cat(null)->load(['id' => 'c1'], null);
    echo "getonly-probe: ok\n";
} catch (\Throwable $e) {
    echo 'getonly-probe: ' . ($e->sdk_code ?? 'none') . ' ' . $e->getMessage() . "\n";
}
`


const PERL_PROBE = String.raw`
use strict;
use warnings;
use lib 'lib';
use DemoSDK;

my $feature = { secrets => { active => 1,
  exchange => { active => 1, refresh => 'REFRESH01' } } };
$feature->{test} = { active => 1 } if $ENV{GETONLY_TEST};
my $client = DemoSDK->new({ base => $ENV{GETONLY_BASE}, feature => $feature });
if (eval { $client->Cat(undef)->load({ id => 'c1' }, undef); 1 }) {
  print "getonly-probe: ok\n";
}
else {
  my $e = $@;
  print 'getonly-probe: ' . (ref $e ? $e->code . ' ' . $e->msg : 'none ' . $e) . "\n";
}
`


const JAVA_PROBE = String.raw`
import java.util.*;
import voxgig.demosdk.core.*;

public class GetonlyProbe {
  public static void main(String[] args) {
    Map<String, Object> exchange = new LinkedHashMap<>();
    exchange.put("active", true);
    exchange.put("refresh", "REFRESH01");
    Map<String, Object> secrets = new LinkedHashMap<>();
    secrets.put("active", true);
    secrets.put("exchange", exchange);
    Map<String, Object> opts = new LinkedHashMap<>();
    opts.put("base", System.getenv("GETONLY_BASE"));
    Map<String, Object> feature = new LinkedHashMap<>(Map.of("secrets", secrets));
    if (System.getenv("GETONLY_TEST") != null) {
      feature.put("test", new LinkedHashMap<>(Map.of("active", true)));
    }
    opts.put("feature", feature);
    Map<String, Object> match = new LinkedHashMap<>();
    match.put("id", "c1");
    try {
      new DemoSDK(opts).cat(null).load(match, null);
      System.out.println("getonly-probe: ok");
    }
    catch (SdkError e) {
      System.out.println("getonly-probe: " + e.code + " " + e.msg);
    }
    catch (RuntimeException e) {
      System.out.println("getonly-probe: none " + e.getMessage());
    }
  }
}
`


const KOTLIN_PROBE = String.raw`package voxgig.demosdk.sdktest

import org.junit.jupiter.api.Test

import voxgig.demosdk.core.DemoSDK
import voxgig.demosdk.core.SdkError

class GetonlyProbe {
  @Test
  fun getonlyProbe() {
    val opts = linkedMapOf<String, Any?>(
      "base" to System.getenv("GETONLY_BASE"),
      "feature" to linkedMapOf<String, Any?>("secrets" to linkedMapOf<String, Any?>(
        "active" to true,
        "exchange" to linkedMapOf<String, Any?>("active" to true, "refresh" to "REFRESH01"),
      )),
    )
    if (System.getenv("GETONLY_TEST") != null) {
      @Suppress("UNCHECKED_CAST")
      (opts["feature"] as MutableMap<String, Any?>)["test"] = linkedMapOf<String, Any?>("active" to true)
    }
    try {
      DemoSDK(opts).cat(null).load(linkedMapOf<String, Any?>("id" to "c1"), null)
      println("getonly-probe: ok")
    } catch (e: SdkError) {
      println("getonly-probe: " + e.code + " " + e.msg)
    } catch (e: RuntimeException) {
      println("getonly-probe: none " + e.message)
    }
  }
}
`


const SCALA_PROBE = String.raw`
import java.util.LinkedHashMap
import voxgig.demosdk.core.{DemoSDK, SdkError}

object GetonlyProbeMain {
  def main(args: Array[String]): Unit = {
    val exchange = new LinkedHashMap[String, Object]()
    exchange.put("active", java.lang.Boolean.TRUE)
    exchange.put("refresh", "REFRESH01")
    val secrets = new LinkedHashMap[String, Object]()
    secrets.put("active", java.lang.Boolean.TRUE)
    secrets.put("exchange", exchange)
    val feature = new LinkedHashMap[String, Object]()
    feature.put("secrets", secrets)
    if (System.getenv("GETONLY_TEST") != null) {
      val test = new LinkedHashMap[String, Object]()
      test.put("active", java.lang.Boolean.TRUE)
      feature.put("test", test)
    }
    val opts = new LinkedHashMap[String, Object]()
    opts.put("base", System.getenv("GETONLY_BASE"))
    opts.put("feature", feature)
    val matcher = new LinkedHashMap[String, Object]()
    matcher.put("id", "c1")
    try {
      new DemoSDK(opts).cat(null).load(matcher, null)
      println("getonly-probe: ok")
    }
    catch {
      case e: SdkError => println("getonly-probe: " + e.code + " " + e.msg)
      case e: RuntimeException => println("getonly-probe: none " + e.getMessage)
    }
  }
}
`


const CSHARP_PROBE = String.raw`
using DemoSdk;

public static class GetonlyProbe
{
    public static void Main()
    {
        var opts = new Dictionary<string, object?>
        {
            ["base"] = Environment.GetEnvironmentVariable("GETONLY_BASE"),
            ["feature"] = new Dictionary<string, object?>
            {
                ["secrets"] = new Dictionary<string, object?>
                {
                    ["active"] = true,
                    ["exchange"] = new Dictionary<string, object?> { ["active"] = true, ["refresh"] = "REFRESH01" },
                },
            },
        };
        if (Environment.GetEnvironmentVariable("GETONLY_TEST") != null)
        {
            ((Dictionary<string, object?>)opts["feature"]!)["test"] = new Dictionary<string, object?> { ["active"] = true };
        }
        try
        {
            new DemoSDK(opts).Cat().Load(new Dictionary<string, object?> { ["id"] = "c1" });
            Console.WriteLine("getonly-probe: ok");
        }
        catch (DemoError e)
        {
            Console.WriteLine("getonly-probe: " + e.Code + " " + e.Message);
        }
        catch (Exception e)
        {
            Console.WriteLine("getonly-probe: none " + e.Message);
        }
    }
}
`


const SWIFT_PROBE = String.raw`import Foundation
import XCTest
@testable import DemoSdk

final class GetonlyProbeTest: XCTestCase {
  func testGetonlyProbe() throws {
    let exchange = vm(("active", .bool(true)), ("refresh", .string("REFRESH01")))
    let secrets = vm(("active", .bool(true)), ("exchange", .map(exchange)))
    let feature = vm(("secrets", .map(secrets)))
    if ProcessInfo.processInfo.environment["GETONLY_TEST"] != nil {
      feature.entries["test"] = .map(vm(("active", .bool(true))))
    }
    let opts = vm(
      ("base", .string(ProcessInfo.processInfo.environment["GETONLY_BASE"] ?? "")),
      ("feature", .map(feature)))
    do {
      _ = try DemoSDK(opts).Cat(nil).load(vm(("id", .string("c1"))), nil)
      print("getonly-probe: ok")
    } catch let e as DemoError {
      print("getonly-probe: " + e.code + " " + e.message)
    } catch {
      print("getonly-probe: none \(error)")
    }
  }
}
`


const RUST_PROBE = String.raw`
use demo_sdk::core::helpers::jo;
use demo_sdk::{DemoEntity, DemoSDK, Value};

#[test]
fn getonly_probe() {
    let exchange = jo(vec![("active", Value::Bool(true)), ("refresh", Value::str("REFRESH01"))]);
    let secrets = jo(vec![("active", Value::Bool(true)), ("exchange", exchange)]);
    let mut feature = vec![("secrets", secrets)];
    if std::env::var("GETONLY_TEST").is_ok() {
        feature.push(("test", jo(vec![("active", Value::Bool(true))])));
    }
    let opts = jo(vec![
        ("base", Value::str(std::env::var("GETONLY_BASE").unwrap())),
        ("feature", jo(feature)),
    ]);
    let client = DemoSDK::new(opts).unwrap();
    match client.cat(Value::Noval).load(jo(vec![("id", Value::str("c1"))]), Value::Noval) {
        Ok(_) => println!("getonly-probe: ok"),
        Err(e) => println!("getonly-probe: {} {}", e.code, e.msg),
    }
}
`


const C_PROBE = String.raw`
#include "sdk.h"
#include "api.h"
#include <stdio.h>
#include <stdlib.h>

int main(void) {
  voxgig_value* exchange = cmap(2, "active", v_bool(true), "refresh", v_str("REFRESH01"));
  voxgig_value* opts = cmap(2, "base", v_str(getenv("GETONLY_BASE")),
    "feature", cmap(1, "secrets", cmap(2, "active", v_bool(true), "exchange", exchange)));
  if (getenv("GETONLY_TEST")) setp(getp(opts, "feature"), "test", cmap(1, "active", v_bool(true)));
  Entity* e = demo_cat(demo_sdk_new(opts, NULL), NULL);
  PNError* err = NULL;
  e->vt->load(e, cmap(1, "id", v_str("c1")), v_map(), &err);
  if (!err) printf("getonly-probe: ok\n");
  else printf("getonly-probe: %s %s\n", err->code, err->msg);
  return 0;
}
`


const CPP_PROBE = String.raw`
#include <cstdlib>
#include <iostream>
#include <string>

#include "harness.hpp"

using namespace sdk;

int main() {
  const char* base = std::getenv("GETONLY_BASE");
  Value opts = vmap({
    {"base", Value(std::string(base ? base : ""))},
    {"feature", vmap({{"secrets", vmap({
      {"active", Value(true)},
      {"exchange", vmap({{"active", Value(true)}, {"refresh", Value(std::string("REFRESH01"))}})},
    })}})},
  });
  if (std::getenv("GETONLY_TEST")) map_put(getp(opts, "feature"), "test", vmap({{"active", Value(true)}}));
  auto client = std::make_shared<DemoSDK>(opts);
  try {
    client->cat()->load(vmap({{"id", Value(std::string("c1"))}}), vmap());
    std::cout << "getonly-probe: ok" << std::endl;
  }
  catch (const SdkErrorPtr& e) {
    std::cout << "getonly-probe: " << e->code << " " << e->msg << std::endl;
  }
  catch (const std::exception& e) {
    std::cout << "getonly-probe: none " << e.what() << std::endl;
  }
  return 0;
}
`


const CLOJURE_PROBE = String.raw`
(require '[sdk.api :as api]
         '[sdk.core :as core]
         '[voxgig.struct :as vs]
         '[sdk.entity.cat :as e-cat])

(let [opts (vs/jm "base" (System/getenv "GETONLY_BASE")
                  "feature" (vs/jm "secrets" (vs/jm "active" true
                                                    "exchange" (vs/jm "active" true "refresh" "REFRESH01"))))]
  (when (System/getenv "GETONLY_TEST")
    (.put ^java.util.Map (vs/getprop opts "feature") "test" (vs/jm "active" true)))
  (try
    (e-cat/load (api/cat (api/make-sdk opts) nil) (vs/jm "id" "c1") nil)
    (println "getonly-probe: ok")
    (catch clojure.lang.ExceptionInfo t
      (let [e (core/ex->sdk t)]
        (println (str "getonly-probe: " (core/err-code e) " " (core/err-msg e)))))))
(shutdown-agents)
`


const LUA_PROBE = String.raw`
local sdk = require("demo_sdk")

local feature = { secrets = { active = true,
  exchange = { active = true, refresh = "REFRESH01" } } }
if os.getenv("GETONLY_TEST") then
  feature.test = { active = true }
end
local client = sdk.new({ base = os.getenv("GETONLY_BASE"), feature = feature })
local ok, res, err = pcall(function()
  local ent = client:Cat(nil)
  return ent:load({ id = "c1" }, nil)
end)
if not ok then
  print("getonly-probe: none " .. tostring(res))
elseif err ~= nil then
  print("getonly-probe: " .. tostring(err.code) .. " " .. tostring(err.msg))
else
  print("getonly-probe: ok")
end
`


const ELIXIR_PROBE = String.raw`
defmodule Demo.GetonlyProbeTest do
  use ExUnit.Case

  alias Voxgig.Struct, as: S

  test "getonly probe" do
    opts =
      S.jm([
        "base", System.get_env("GETONLY_BASE"),
        "feature", S.jm(["secrets", S.jm(["active", true,
          "exchange", S.jm(["active", true, "refresh", "REFRESH01"])])])
      ])

    if System.get_env("GETONLY_TEST"),
      do: S.setprop(S.getprop(opts, "feature"), "test", S.jm(["active", true]))

    try do
      Demo.Entity.Cat.load(Demo.cat(Demo.new(opts)), S.jm(["id", "c1"]))
      IO.puts("getonly-probe: ok")
    rescue
      e in Demo.Error -> IO.puts("getonly-probe: #{e.code} #{e.msg}")
    end
  end
end
`


const ZIG_PROBE = String.raw`
const std = @import("std");
const sdk = @import("sdk");
const h = sdk.h;
const Value = sdk.Value;

test "getonly probe" {
    const environ = std.Io.Threaded.global_single_threaded.environ.process_environ;
    const base = environ.getAlloc(h.A(), "GETONLY_BASE") catch "";
    const opts = h.jo(&.{
        .{ "base", h.vstr(base) },
        .{ "feature", h.jo(&.{.{ "secrets", h.jo(&.{
            .{ "active", h.vbool(true) },
            .{ "exchange", h.jo(&.{ .{ "active", h.vbool(true) }, .{ "refresh", h.vstr("REFRESH01") } }) },
        }) }}) },
    });
    if (environ.getAlloc(h.A(), "GETONLY_TEST")) |_| {
        h.setp(h.getp(opts, "feature"), "test", h.jo(&.{.{ "active", h.vbool(true) }}));
    } else |_| {}
    switch (sdk.SDK.new(opts)) {
        .ok => |client| switch (client.cat(Value{ .null = {} }).load(h.jo(&.{.{ "id", h.vstr("c1") }}), h.omap())) {
            .ok => std.debug.print("getonly-probe: ok\n", .{}),
            .err => |e| std.debug.print("getonly-probe: {s} {s}\n", .{ e.code, e.msg }),
        },
        .err => |e| std.debug.print("getonly-probe: {s} {s}\n", .{ e.code, e.msg }),
    }
}
`


const OCAML_PROBE = String.raw`
open Voxgig_struct
open Sdk_types
open Sdk_helpers

let () =
  let opts = jo [
    ("base", Str (Sys.getenv "GETONLY_BASE"));
    ("feature", jo [("secrets", jo [
      ("active", Bool true);
      ("exchange", jo [("active", Bool true); ("refresh", Str "REFRESH01")])])])] in
  (match Sys.getenv_opt "GETONLY_TEST" with
   | Some _ -> setp (getp opts "feature") "test" (jo [("active", Bool true)])
   | None -> ());
  let client = Sdk_client.make opts in
  match (Sdk_client.cat client Noval).e_load (jo [("id", Str "c1")]) (empty_map ()) with
  | _ -> print_endline "getonly-probe: ok"
  | exception Sdk_error_exc e -> Printf.printf "getonly-probe: %s %s\n%!" e.err_code e.err_msg
`


const GETONLY_PROBES: Record<string, string> = {
  node: NODE_PROBE,
  go: GO_PROBE,
  py: PY_PROBE,
  rb: RB_PROBE,
  php: PHP_PROBE,
  perl: PERL_PROBE,
  java: JAVA_PROBE,
  kotlin: KOTLIN_PROBE,
  scala: SCALA_PROBE,
  csharp: CSHARP_PROBE,
  swift: SWIFT_PROBE,
  rust: RUST_PROBE,
  c: C_PROBE,
  cpp: CPP_PROBE,
  clojure: CLOJURE_PROBE,
  lua: LUA_PROBE,
  elixir: ELIXIR_PROBE,
  zig: ZIG_PROBE,
  ocaml: OCAML_PROBE,
}


export {
  GETONLY_FEATURES,
  GETONLY_PATH,
  GETONLY_PROBES,
  GETONLY_STALL_MS,
  getOnlyModel,
  getOnlyOutcome,
}
