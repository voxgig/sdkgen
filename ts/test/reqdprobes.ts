// A list whose route requires the path parameter engine and the query parameter
// q, driven through a generated SDK in test mode: the mock answers only the
// seeded records whose required parameters all match the call. s2 differs from
// the call in q alone, and s3 in engine alone.
const REQD_SEED = {
  search: {
    s1: { engine: 'google', q: 'coffee' },
    s2: { engine: 'google', q: 'tea' },
    s3: { engine: 'bing', q: 'coffee' },
  },
}

// Each probe lists engine=google and q=coffee, and prints the ids it answers, sorted.
const REQD_EXPECT = 's1'

function reqdListed(out: string): string | null {
  const m = out.match(/reqd-probe: ([^\r\n]*)/)
  return null == m ? null : m[1].trim()
}


const NODE_PROBE = `
const { SDK } = require('SDK_MODULE')

;(async () => {
  const sdk = SDK.test({ entity: ${JSON.stringify(REQD_SEED)} })
  const list = await sdk.Search().list({ engine: 'google', q: 'coffee' })
  console.log('reqd-probe: ' + list.map((ent) => ent.data().id).sort().join(','))
})()
`


const PY_PROBE = String.raw`
from demo_sdk import DemoSDK

seed = {'entity': {'search': {
    's1': {'engine': 'google', 'q': 'coffee'},
    's2': {'engine': 'google', 'q': 'tea'},
    's3': {'engine': 'bing', 'q': 'coffee'}}}}

listed = DemoSDK.test(seed, None).Search(None).list({'engine': 'google', 'q': 'coffee'}, None)
print('reqd-probe: ' + ','.join(sorted(str(ent.data_get().get('id')) for ent in listed)))
`


const GO_PROBE = String.raw`package sdktest

import (
	"fmt"
	"sort"
	"strings"
	"testing"

	sdk "GOMODULE"
)

func TestReqdProbe(t *testing.T) {
	seed := map[string]any{"entity": map[string]any{"search": map[string]any{
		"s1": map[string]any{"engine": "google", "q": "coffee"},
		"s2": map[string]any{"engine": "google", "q": "tea"},
		"s3": map[string]any{"engine": "bing", "q": "coffee"},
	}}}
	res, err := sdk.TestSDK(seed, nil).Search(nil).List(
		map[string]any{"engine": "google", "q": "coffee"}, nil)
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	list, _ := res.([]any)
	out := []string{}
	for _, item := range list {
		rec, _ := item.(map[string]any)
		if ent, ok := item.(sdk.Entity); ok {
			rec, _ = ent.Data().(map[string]any)
		}
		out = append(out, fmt.Sprintf("%v", rec["id"]))
	}
	sort.Strings(out)
	fmt.Println("reqd-probe: " + strings.Join(out, ","))
}
`


const RB_PROBE = String.raw`
require_relative 'Demo_sdk'

seed = { 'entity' => { 'search' => {
  's1' => { 'engine' => 'google', 'q' => 'coffee' },
  's2' => { 'engine' => 'google', 'q' => 'tea' },
  's3' => { 'engine' => 'bing', 'q' => 'coffee' },
} } }

listed = DemoSDK.test(seed, nil).Search(nil).list({ 'engine' => 'google', 'q' => 'coffee' }, nil)
puts 'reqd-probe: ' + listed.map { |ent| ent.data_get['id'].to_s }.sort.join(',')
`


const PHP_PROBE = String.raw`<?php
require_once __DIR__ . '/demo_sdk.php';

$seed = ['entity' => ['search' => [
    's1' => ['engine' => 'google', 'q' => 'coffee'],
    's2' => ['engine' => 'google', 'q' => 'tea'],
    's3' => ['engine' => 'bing', 'q' => 'coffee'],
]]];

$listed = DemoSDK::test($seed, null)->Search(null)->list(['engine' => 'google', 'q' => 'coffee'], null);
$out = array_map(fn($ent) => (string) $ent->data_get()['id'], $listed);
sort($out);
echo 'reqd-probe: ' . implode(',', $out) . "\n";
`


const PERL_PROBE = String.raw`
use strict;
use warnings;
use lib 'lib';
use DemoSDK;

my $seed = { entity => { search => {
  s1 => { engine => 'google', q => 'coffee' },
  s2 => { engine => 'google', q => 'tea' },
  s3 => { engine => 'bing', q => 'coffee' },
} } };

my $listed = DemoSDK->test($seed, undef)->Search(undef)
  ->list({ engine => 'google', q => 'coffee' }, undef);
print 'reqd-probe: ' . join(',', sort map { $_->data_get->{id} } @$listed) . "\n";
`


const LUA_PROBE = String.raw`
local sdk = require("demo_sdk")

local seed = { entity = { search = {
  s1 = { engine = "google", q = "coffee" },
  s2 = { engine = "google", q = "tea" },
  s3 = { engine = "bing", q = "coffee" },
} } }

local listed, err = sdk.test(seed, nil):Search(nil):list({ engine = "google", q = "coffee" }, nil)
if err ~= nil then error(tostring(err)) end
local out = {}
for _, ent in ipairs(listed) do
  table.insert(out, tostring(ent:data_get().id))
end
table.sort(out)
print("reqd-probe: " .. table.concat(out, ","))
`


const JAVA_PROBE = String.raw`
import java.util.*;
import voxgig.demosdk.core.*;

public class ReqdProbe {
  static Map<String, Object> map(Object... kv) {
    Map<String, Object> m = new LinkedHashMap<>();
    for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
    return m;
  }

  @SuppressWarnings("unchecked")
  public static void main(String[] args) {
    Map<String, Object> seed = map("entity", map("search", map(
        "s1", map("engine", "google", "q", "coffee"),
        "s2", map("engine", "google", "q", "tea"),
        "s3", map("engine", "bing", "q", "coffee"))));
    Object listed = DemoSDK.testSDK(seed, null).search(null)
        .list(map("engine", "google", "q", "coffee"), null);
    List<String> out = new ArrayList<>();
    for (Object item : (List<Object>) listed) {
      out.add(String.valueOf(((Map<String, Object>) ((Entity) item).data()).get("id")));
    }
    Collections.sort(out);
    System.out.println("reqd-probe: " + String.join(",", out));
  }
}
`


const KOTLIN_PROBE = String.raw`package voxgig.demosdk.sdktest

import org.junit.jupiter.api.Test

import voxgig.demosdk.core.DemoSDK
import voxgig.demosdk.core.Entity

class ReqdProbe {
  @Test
  fun reqdProbe() {
    val seed = linkedMapOf<String, Any?>("entity" to linkedMapOf<String, Any?>(
      "search" to linkedMapOf<String, Any?>(
        "s1" to linkedMapOf<String, Any?>("engine" to "google", "q" to "coffee"),
        "s2" to linkedMapOf<String, Any?>("engine" to "google", "q" to "tea"),
        "s3" to linkedMapOf<String, Any?>("engine" to "bing", "q" to "coffee"))))
    val listed = DemoSDK.testSDK(seed, null).search(null)
      .list(linkedMapOf<String, Any?>("engine" to "google", "q" to "coffee"), null) as List<*>
    val out = listed.map { item -> "" + ((item as Entity).data() as Map<*, *>)["id"] }.sorted()
    println("reqd-probe: " + out.joinToString(","))
  }
}
`


const SCALA_PROBE = String.raw`
import java.util.{ArrayList, Collections, LinkedHashMap, List => JList, Map => JMap}
import voxgig.demosdk.core.{DemoSDK, Entity}

object ReqdProbeMain {
  private def map(kv: (String, Object)*): JMap[String, Object] = {
    val m = new LinkedHashMap[String, Object]()
    kv.foreach { case (k, v) => m.put(k, v) }
    m
  }

  def main(args: Array[String]): Unit = {
    val seed = map("entity" -> map("search" -> map(
      "s1" -> map("engine" -> "google", "q" -> "coffee"),
      "s2" -> map("engine" -> "google", "q" -> "tea"),
      "s3" -> map("engine" -> "bing", "q" -> "coffee"))))
    val listed = DemoSDK.testSDK(seed, null).search(null)
      .list(map("engine" -> "google", "q" -> "coffee"), null).asInstanceOf[JList[Object]]
    val out = new ArrayList[String]()
    listed.forEach { item =>
      val rec = item.asInstanceOf[Entity].data().asInstanceOf[JMap[String, Object]]
      out.add(String.valueOf(rec.get("id")))
    }
    Collections.sort(out)
    println("reqd-probe: " + String.join(",", out))
  }
}
`


const CSHARP_PROBE = String.raw`
using DemoSdk;

public static class ReqdProbe
{
    static Dictionary<string, object?> Rec(string engine, string q) =>
        new Dictionary<string, object?> { ["engine"] = engine, ["q"] = q };

    public static void Main()
    {
        var seed = new Dictionary<string, object?>
        {
            ["entity"] = new Dictionary<string, object?>
            {
                ["search"] = new Dictionary<string, object?>
                {
                    ["s1"] = Rec("google", "coffee"), ["s2"] = Rec("google", "tea"), ["s3"] = Rec("bing", "coffee"),
                },
            },
        };
        var listed = DemoSDK.TestSDK(seed, null).Search().List(Rec("google", "coffee"), null)
            as List<object?> ?? new List<object?>();
        var output = new List<string>();
        foreach (var item in listed)
        {
            var rec = ((IEntity)item!).Data() as Dictionary<string, object?>;
            output.Add(rec?["id"] + "");
        }
        output.Sort(StringComparer.Ordinal);
        Console.WriteLine("reqd-probe: " + string.Join(",", output));
    }
}
`


const SWIFT_PROBE = String.raw`import Foundation
import XCTest
@testable import DemoSdk

final class ReqdProbeTest: XCTestCase {
  func rec(_ engine: String, _ q: String) -> VMap {
    let m = VMap()
    m.entries["engine"] = .string(engine)
    m.entries["q"] = .string(q)
    return m
  }

  func testReqdProbe() throws {
    let searches = VMap()
    searches.entries["s1"] = .map(rec("google", "coffee"))
    searches.entries["s2"] = .map(rec("google", "tea"))
    searches.entries["s3"] = .map(rec("bing", "coffee"))
    let entity = VMap()
    entity.entries["search"] = .map(searches)
    let seed = VMap()
    seed.entries["entity"] = .map(entity)

    let listed = try DemoSDK.testSDK(seed, nil).Search(nil).list(rec("google", "coffee"), nil)
    var out: [String] = []
    for item in listed.asList?.items ?? [] {
      var record = item
      if case .native(let ref) = item, let ent = ref.value as? Entity {
        record = ent.data()
      }
      out.append(gp(record, "id").asString ?? "")
    }
    print("reqd-probe: " + out.sorted().joined(separator: ","))
  }
}
`


const ELIXIR_PROBE = String.raw`
defmodule Demo.ReqdProbeTest do
  use ExUnit.Case

  alias Voxgig.Struct, as: S

  test "reqd probe" do
    rec = fn engine, q -> S.jm(["engine", engine, "q", q]) end
    searches = S.jm(["s1", rec.("google", "coffee"), "s2", rec.("google", "tea"), "s3", rec.("bing", "coffee")])
    sdk = Demo.test(S.jm(["entity", S.jm(["search", searches])]), nil)
    result = Demo.Entity.Search.list(Demo.search(sdk), rec.("google", "coffee"))

    listed =
      for i <- 0..(S.size(result) - 1)//1 do
        "#{S.getprop(Demo.EntityBase.data_get(S.getelem(result, i)), "id")}"
      end

    IO.puts("reqd-probe: " <> (listed |> Enum.sort() |> Enum.join(",")))
  end
end
`


const CLOJURE_PROBE = String.raw`
(require '[sdk.api :as api]
         '[voxgig.struct :as vs]
         '[clojure.string :as cstr]
         '[sdk.entity.search :as e-search])

(defn rec [engine q] (vs/jm "engine" engine "q" q))

(def sdk (api/test-sdk (vs/jm "entity" (vs/jm "search" (vs/jm "s1" (rec "google" "coffee")
                                                                   "s2" (rec "google" "tea")
                                                                   "s3" (rec "bing" "coffee"))))
                       nil))

(def listed (e-search/list (api/search sdk nil) (rec "google" "coffee") nil))

(println (str "reqd-probe: "
              (cstr/join "," (sort (map (fn [item] (str (vs/getprop ((:data-get item)) "id"))) listed)))))
`


const RUST_PROBE = String.raw`
use demo_sdk::core::helpers::{getp, jo};
use demo_sdk::{test_sdk, DemoEntity, Entity, Value};

#[test]
fn reqd_probe() {
    let rec = |engine: &str, q: &str| jo(vec![("engine", Value::str(engine)), ("q", Value::str(q))]);
    let seed = jo(vec![("entity", jo(vec![("search", jo(vec![
        ("s1", rec("google", "coffee")),
        ("s2", rec("google", "tea")),
        ("s3", rec("bing", "coffee")),
    ]))]))]);
    let listed = test_sdk(seed, Value::Noval).search(Value::Noval)
        .list(rec("google", "coffee"), Value::Noval).expect("list failed");
    let mut out: Vec<String> = listed.iter()
        .map(|ent| getp(&ent.data(None), "id").as_str().unwrap_or("").to_string())
        .collect();
    out.sort();
    println!("reqd-probe: {}", out.join(","));
}
`


// The list answers a NULL-terminated array of entities.
const C_PROBE = String.raw`
#include "sdk.h"
#include "api.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static voxgig_value* rec(const char* engine, const char* q) {
  return cmap(2, "engine", v_str(engine), "q", v_str(q));
}

static int byrow(const void* a, const void* b) {
  return strcmp((const char*)a, (const char*)b);
}

int main(void) {
  voxgig_value* seed = cmap(1, "entity", cmap(1, "search", cmap(3,
    "s1", rec("google", "coffee"), "s2", rec("google", "tea"), "s3", rec("bing", "coffee"))));
  Entity* e = demo_search(test_sdk(seed, NULL), NULL);
  PNError* err = NULL;
  Entity** items = e->vt->list(e, rec("google", "coffee"), NULL, &err);
  if (err) {
    printf("list failed: %s\n", pn_error_str(err));
    return 1;
  }
  char out[16][128];
  int n = 0;
  for (; n < 16 && items[n]; n++) {
    const char* id = get_str(items[n]->vt->data(items[n], NULL), "id");
    snprintf(out[n], sizeof(out[n]), "%s", id ? id : "");
  }
  qsort(out, n, sizeof(out[0]), byrow);
  printf("reqd-probe: ");
  for (int i = 0; i < n; i++) printf("%s%s", 0 < i ? "," : "", out[i]);
  printf("\n");
  return 0;
}
`


const CPP_PROBE = String.raw`
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

#include "harness.hpp"

using namespace sdk;

static Value record(const std::string& engine, const std::string& q) {
  return vmap({{"engine", Value(engine)}, {"q", Value(q)}});
}

int main() {
  Value seed = vmap({{"entity", vmap({{"search", vmap({
    {"s1", record("google", "coffee")},
    {"s2", record("google", "tea")},
    {"s3", record("bing", "coffee")},
  })}})}});
  auto client = DemoSDK::testSDK(seed, Value::undef());
  std::vector<std::string> out;
  for (const auto& ent : client->search()->list(record("google", "coffee"), vmap())) {
    out.push_back(as_str(getp(ent->data(), "id")));
  }
  std::sort(out.begin(), out.end());
  std::string joined;
  for (size_t i = 0; i < out.size(); i++) joined += (0 < i ? "," : "") + out[i];
  std::cout << "reqd-probe: " << joined << std::endl;
  return 0;
}
`


const ZIG_PROBE = String.raw`
const std = @import("std");
const sdk = @import("sdk");
const h = sdk.h;
const Value = sdk.Value;

fn record(engine: []const u8, q: []const u8) Value {
    return h.jo(&.{ .{ "engine", h.vstr(engine) }, .{ "q", h.vstr(q) } });
}

fn before(_: void, a: []const u8, b: []const u8) bool {
    return std.mem.lessThan(u8, a, b);
}

test "reqd probe" {
    const seed = h.jo(&.{.{ "entity", h.jo(&.{.{ "search", h.jo(&.{
        .{ "s1", record("google", "coffee") },
        .{ "s2", record("google", "tea") },
        .{ "s3", record("bing", "coffee") },
    }) }}) }});
    const client = sdk.test_sdk(seed, Value{ .null = {} });
    const listed = switch (client.search(Value{ .null = {} }).list(record("google", "coffee"), h.omap())) {
        .ok => |items| items,
        .err => |e| {
            std.debug.print("list failed: {s}\n", .{e.msg});
            return error.ListFailed;
        },
    };
    var out: std.ArrayList([]const u8) = .empty;
    for (listed) |ent| {
        out.append(h.A(), h.scalar_str(h.getp(ent.asEntity().data(null), "id"))) catch unreachable;
    }
    std.mem.sort([]const u8, out.items, {}, before);
    const joined = std.mem.join(h.A(), ",", out.items) catch unreachable;
    std.debug.print("reqd-probe: {s}\n", .{joined});
}
`


const OCAML_PROBE = String.raw`
open Voxgig_struct
open Sdk_types
open Sdk_helpers

let record engine q = jo [("engine", Str engine); ("q", Str q)]

let () =
  let seed = jo [("entity", jo [("search", jo [("s1", record "google" "coffee");
                                               ("s2", record "google" "tea");
                                               ("s3", record "bing" "coffee")])])] in
  let client = Sdk_client.test_with seed Noval in
  let listed = (Sdk_client.search client Noval).e_list (record "google" "coffee") (empty_map ()) in
  let str v = match v with Str s -> s | _ -> "" in
  let out = List.map (fun e -> str (getp (e.e_data_get ()) "id")) listed in
  Printf.printf "reqd-probe: %s\n%!" (String.concat "," (List.sort compare out))
`


const REQD_PROBES: Record<string, string> = {
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
  REQD_SEED,
  REQD_EXPECT,
  REQD_PROBES,
  reqdListed,
}
