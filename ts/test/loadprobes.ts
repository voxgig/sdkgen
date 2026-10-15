// A load that fails, driven through a generated SDK in test mode: each probe
// prints the code, the status and the not-found predicate of every case's
// error. `missing` names a record the mock does not hold, and `unsent` names
// no id, so its request is never made.
const LOAD_CASES: [string, string | null][] = [
  ['missing', 'nope'],
  ['unsent', null],
]

type LoadOutcome = { code: string, status: number, notfound: string }

// `load-probe: <case> <code> <status> <notfound>`, where notfound is
// true or false, and the code `ok` when the load did not fail.
function loadOutcomes(out: string): Record<string, LoadOutcome> {
  const found: Record<string, LoadOutcome> = {}
  for (const m of out.matchAll(/load-probe: ([a-z]+) (\S+) (-?\d+) (true|false)/g)) {
    found[m[1]] = { code: m[2], status: Number(m[3]), notfound: m[4] }
  }
  return found
}


const NODE_PROBE = `
const { SDK } = require('SDK_MODULE')

;(async () => {
  for (const [name, id] of ${JSON.stringify(LOAD_CASES)}) {
    try {
      await SDK.test().Cat().load(null == id ? {} : { id })
      console.log('load-probe: ' + name + ' ok -1 false')
    }
    catch (e) {
      console.log('load-probe: ' + name + ' ' + e.code + ' ' + e.status + ' ' + e.notFound)
    }
  }
})()
`


const GO_PROBE = String.raw`package sdktest

import (
	"errors"
	"fmt"
	"testing"

	sdk "GOMODULE"
)

func TestLoadProbe(t *testing.T) {
	cases := [][2]string{{"missing", "nope"}, {"unsent", ""}}
	for _, c := range cases {
		match := map[string]any{}
		if "" != c[1] {
			match["id"] = c[1]
		}
		_, err := sdk.TestSDK(nil, nil).Cat(nil).Load(match, nil)
		var se *sdk.DemoError
		if nil == err {
			fmt.Printf("load-probe: %s ok -1 false\n", c[0])
		} else if errors.As(err, &se) {
			fmt.Printf("load-probe: %s %s %d %t\n", c[0], se.Code, se.Status, se.NotFound())
		} else {
			fmt.Printf("load-probe: %s none -1 false\n", c[0])
		}
	}
}
`


const PY_PROBE = String.raw`
from demo_sdk import DemoSDK

for name, eid in [('missing', 'nope'), ('unsent', None)]:
    try:
        DemoSDK.test(None, None).Cat(None).load({} if eid is None else {'id': eid}, None)
        print('load-probe: %s ok -1 false' % name)
    except Exception as e:
        print('load-probe: %s %s %d %s' % (name, e.code, e.status, str(e.not_found).lower()))
`


const RB_PROBE = String.raw`
require_relative 'Demo_sdk'

[['missing', 'nope'], ['unsent', nil]].each do |name, id|
  begin
    DemoSDK.test(nil, nil).Cat(nil).load(id.nil? ? {} : { 'id' => id }, nil)
    puts "load-probe: #{name} ok -1 false"
  rescue StandardError => e
    puts "load-probe: #{name} #{e.code} #{e.status} #{e.not_found?}"
  end
end
`


const PHP_PROBE = String.raw`<?php
require_once __DIR__ . '/demo_sdk.php';

foreach ([['missing', 'nope'], ['unsent', null]] as [$name, $id]) {
    try {
        DemoSDK::test(null, null)->Cat(null)->load(null === $id ? [] : ['id' => $id], null);
        echo 'load-probe: ' . $name . " ok -1 false\n";
    } catch (\Throwable $e) {
        echo 'load-probe: ' . $name . ' ' . $e->sdk_code . ' ' . $e->status . ' ' .
            ($e->notFound() ? 'true' : 'false') . "\n";
    }
}
`


const PERL_PROBE = String.raw`
use strict;
use warnings;
use lib 'lib';
use DemoSDK;

for my $c (['missing', 'nope'], ['unsent', undef]) {
  my ($name, $id) = @$c;
  if (eval { DemoSDK->test(undef, undef)->Cat(undef)->load(defined $id ? { id => $id } : {}, undef); 1 }) {
    print "load-probe: $name ok -1 false\n";
  }
  else {
    my $e = $@;
    print 'load-probe: ' . $name . ' ' . $e->code . ' ' . $e->status . ' ' .
      ($e->not_found ? 'true' : 'false') . "\n";
  }
}
`


const LUA_PROBE = String.raw`
local sdk = require("demo_sdk")

for _, c in ipairs({ { "missing", "nope" }, { "unsent", nil } }) do
  local match = {}
  if c[2] ~= nil then match.id = c[2] end
  local _, err = sdk.test(nil, nil):Cat(nil):load(match, nil)
  if err == nil then
    print("load-probe: " .. c[1] .. " ok -1 false")
  else
    print("load-probe: " .. c[1] .. " " .. tostring(err.code) .. " " .. tostring(err.status) ..
      " " .. tostring(err:not_found()))
  end
end
`


// java and scala: the test mock answers a load it holds no record for with
// 200, so a scripted transport answers 404 there instead.
const JAVA_PROBE = String.raw`
import java.util.*;
import java.util.function.Supplier;
import voxgig.demosdk.core.*;

public class LoadProbe {
  static DemoSDK client() {
    Utility.FetcherFn notFound = (ctx, fullurl, fetchdef) -> {
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("status", 404);
      out.put("statusText", "Not found");
      out.put("headers", new LinkedHashMap<String, Object>());
      out.put("json", (Supplier<Object>) () -> null);
      out.put("body", "not-used");
      return out;
    };
    Map<String, Object> test = new LinkedHashMap<>();
    test.put("active", true);
    Map<String, Object> utility = new LinkedHashMap<>();
    utility.put("fetcher", notFound);
    Map<String, Object> opts = new LinkedHashMap<>();
    opts.put("test", test);
    opts.put("utility", utility);
    return new DemoSDK(opts);
  }

  public static void main(String[] args) {
    String[][] cases = { { "missing", "nope" }, { "unsent", null } };
    for (String[] c : cases) {
      Map<String, Object> match = new LinkedHashMap<>();
      if (c[1] != null) match.put("id", c[1]);
      try {
        client().cat(null).load(match, null);
        System.out.println("load-probe: " + c[0] + " ok -1 false");
      }
      catch (SdkError e) {
        System.out.println("load-probe: " + c[0] + " " + e.code + " " + e.status + " " + e.notFound());
      }
    }
  }
}
`


const KOTLIN_PROBE = String.raw`package voxgig.demosdk.sdktest

import org.junit.jupiter.api.Test

import voxgig.demosdk.core.DemoSDK
import voxgig.demosdk.core.SdkError

class LoadProbe {
  @Test
  fun loadProbe() {
    for ((name, id) in listOf("missing" to "nope", "unsent" to null)) {
      val match = linkedMapOf<String, Any?>()
      if (id != null) match["id"] = id
      try {
        DemoSDK.testSDK(null, null).cat(null).load(match, null)
        println("load-probe: " + name + " ok -1 false")
      } catch (e: SdkError) {
        println("load-probe: " + name + " " + e.code + " " + e.status + " " + e.notFound)
      }
    }
  }
}
`


const SCALA_PROBE = String.raw`
import java.util.LinkedHashMap
import java.util.function.Supplier
import voxgig.demosdk.core.{DemoSDK, FetcherFn, SdkError}

object LoadProbeMain {
  private def client(): DemoSDK = {
    val notFound: FetcherFn = (_, _, _) => {
      val js: Supplier[Object] = () => null
      val out = new LinkedHashMap[String, Object]()
      out.put("status", java.lang.Integer.valueOf(404))
      out.put("statusText", "Not found")
      out.put("headers", new LinkedHashMap[String, Object]())
      out.put("json", js)
      out.put("body", "not-used")
      out
    }
    val test = new LinkedHashMap[String, Object]()
    test.put("active", java.lang.Boolean.TRUE)
    val utility = new LinkedHashMap[String, Object]()
    utility.put("fetcher", notFound)
    val opts = new LinkedHashMap[String, Object]()
    opts.put("test", test)
    opts.put("utility", utility)
    new DemoSDK(opts)
  }

  def main(args: Array[String]): Unit = {
    for ((name, id) <- Seq("missing" -> "nope", "unsent" -> null)) {
      val matcher = new LinkedHashMap[String, Object]()
      if (id != null) matcher.put("id", id)
      try {
        client().cat(null).load(matcher, null)
        println("load-probe: " + name + " ok -1 false")
      }
      catch {
        case e: SdkError =>
          println("load-probe: " + name + " " + e.code + " " + e.status + " " + e.notFound)
      }
    }
  }
}
`


const CSHARP_PROBE = String.raw`
using DemoSdk;

public static class LoadProbe
{
    public static void Main()
    {
        foreach (var (name, id) in new[] { ("missing", (string?)"nope"), ("unsent", (string?)null) })
        {
            var match = new Dictionary<string, object?>();
            if (id != null) match["id"] = id;
            try
            {
                DemoSDK.TestSDK(null, null).Cat().Load(match, null);
                Console.WriteLine("load-probe: " + name + " ok -1 false");
            }
            catch (DemoError e)
            {
                Console.WriteLine("load-probe: " + name + " " + e.Code + " " + e.Status + " " +
                    (e.NotFound ? "true" : "false"));
            }
        }
    }
}
`


const SWIFT_PROBE = String.raw`import Foundation
import XCTest
@testable import DemoSdk

final class LoadProbeTest: XCTestCase {
  func testLoadProbe() throws {
    for (name, id) in [("missing", "nope"), ("unsent", nil)] as [(String, String?)] {
      let match = VMap()
      if let id = id { match.entries["id"] = .string(id) }
      do {
        _ = try DemoSDK.testSDK(nil, nil).Cat(nil).load(match, nil)
        print("load-probe: " + name + " ok -1 false")
      } catch let e as DemoError {
        print("load-probe: " + name + " " + e.code + " " + String(e.status) + " " + String(e.notFound))
      }
    }
  }
}
`


const ELIXIR_PROBE = String.raw`
defmodule Demo.LoadProbeTest do
  use ExUnit.Case

  alias Voxgig.Struct, as: S

  test "load probe" do
    for {name, id} <- [{"missing", "nope"}, {"unsent", nil}] do
      match = if id == nil, do: S.jm([]), else: S.jm(["id", id])

      try do
        Demo.Entity.Cat.load(Demo.cat(Demo.test(nil, nil)), match)
        IO.puts("load-probe: #{name} ok -1 false")
      rescue
        e in Demo.Error ->
          IO.puts("load-probe: #{name} #{e.code} #{Demo.Error.status(e)} #{Demo.Error.not_found?(e)}")
      end
    end
  end
end
`


const CLOJURE_PROBE = String.raw`
(require '[sdk.api :as api]
         '[sdk.core :as core]
         '[voxgig.struct :as vs]
         '[sdk.entity.cat :as e-cat])

(doseq [[name id] [["missing" "nope"] ["unsent" nil]]]
  (try
    (e-cat/load (api/cat (api/test-sdk nil nil) nil) (if (nil? id) (vs/jm) (vs/jm "id" id)) nil)
    (println (str "load-probe: " name " ok -1 false"))
    (catch clojure.lang.ExceptionInfo t
      (let [e (core/ex->sdk t)]
        (println (str "load-probe: " name " " (core/err-code e) " " (core/err-status e) " "
                      (core/not-found? e)))))))
`


const RUST_PROBE = String.raw`
use demo_sdk::core::helpers::jo;
use demo_sdk::{test_sdk, DemoEntity, Value};

#[test]
fn load_probe() {
    for (name, id) in [("missing", Some("nope")), ("unsent", None)] {
        let matcher = match id {
            Some(id) => jo(vec![("id", Value::str(id))]),
            None => jo(vec![]),
        };
        match test_sdk(Value::Noval, Value::Noval).cat(Value::Noval).load(matcher, Value::Noval) {
            Ok(_) => println!("load-probe: {} ok -1 false", name),
            Err(e) => println!("load-probe: {} {} {} {}", name, e.code, e.status, e.not_found()),
        }
    }
}
`


const C_PROBE = String.raw`
#include "sdk.h"
#include "api.h"
#include <stdio.h>

int main(void) {
  const char* names[] = { "missing", "unsent" };
  const char* ids[] = { "nope", NULL };
  for (int i = 0; i < 2; i++) {
    Entity* e = demo_cat(test_sdk(NULL, NULL), NULL);
    PNError* err = NULL;
    e->vt->load(e, ids[i] ? cmap(1, "id", v_str(ids[i])) : v_map(), v_map(), &err);
    if (!err) printf("load-probe: %s ok -1 false\n", names[i]);
    else printf("load-probe: %s %s %d %s\n", names[i], err->code, err->status,
      pn_error_not_found(err) ? "true" : "false");
  }
  return 0;
}
`


const CPP_PROBE = String.raw`
#include <iostream>
#include <string>

#include "harness.hpp"

using namespace sdk;

int main() {
  const char* names[] = { "missing", "unsent" };
  const char* ids[] = { "nope", nullptr };
  for (int i = 0; i < 2; i++) {
    Value match = ids[i] ? vmap({{"id", Value(std::string(ids[i]))}}) : vmap();
    try {
      DemoSDK::testSDK(Value::undef(), Value::undef())->cat()->load(match, vmap());
      std::cout << "load-probe: " << names[i] << " ok -1 false" << std::endl;
    }
    catch (const SdkErrorPtr& e) {
      std::cout << "load-probe: " << names[i] << " " << e->code << " " << e->status << " "
                << (e->notFound() ? "true" : "false") << std::endl;
    }
  }
  return 0;
}
`


const ZIG_PROBE = String.raw`
const std = @import("std");
const sdk = @import("sdk");
const h = sdk.h;
const Value = sdk.Value;

test "load probe" {
    const names = [_][]const u8{ "missing", "unsent" };
    const ids = [_]?[]const u8{ "nope", null };
    for (names, ids) |name, id| {
        const match = if (id) |v| h.jo(&.{.{ "id", h.vstr(v) }}) else h.omap();
        const client = sdk.test_sdk(Value{ .null = {} }, Value{ .null = {} });
        switch (client.cat(Value{ .null = {} }).load(match, h.omap())) {
            .ok => std.debug.print("load-probe: {s} ok -1 false\n", .{name}),
            .err => |e| std.debug.print("load-probe: {s} {s} {d} {}\n", .{ name, e.code, e.status, e.not_found() }),
        }
    }
}
`


const OCAML_PROBE = String.raw`
open Voxgig_struct
open Sdk_types
open Sdk_helpers

let () =
  List.iter (fun (name, id) ->
    let mtch = match id with Some v -> jo [("id", Str v)] | None -> empty_map () in
    let client = Sdk_client.test_with Noval Noval in
    match (Sdk_client.cat client Noval).e_load mtch (empty_map ()) with
    | _ -> Printf.printf "load-probe: %s ok -1 false\n%!" name
    | exception Sdk_error_exc e ->
      Printf.printf "load-probe: %s %s %d %b\n%!" name (Sdk_error.code e)
        (Sdk_error.status e) (Sdk_error.not_found e))
    [("missing", Some "nope"); ("unsent", None)]
`


const LOAD_PROBES: Record<string, string> = {
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
  LOAD_CASES,
  LOAD_PROBES,
  loadOutcomes,
}
