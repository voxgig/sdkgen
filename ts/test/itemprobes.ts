// A list whose items each wrap the record, driven through a generated SDK in
// test mode: the mock answers the wrappers its point's response transform
// names, and the transform reads the records back out of them.
// Each record names its id, as not every mock derives one from its key.
const ITEMS_SEED = { badge: { b1: { id: 'b1', title: 'one' }, b2: { id: 'b2', title: 'two' }, b3: { id: 'b3', title: 'three' } } }

// Each probe prints the records it lists, as `<id>=<title>`, sorted by id.
const ITEMS_EXPECT = 'b1=one,b2=two,b3=three'

function itemsListed(out: string): string | null {
  const m = out.match(/items-probe: ([^\r\n]*)/)
  return null == m ? null : m[1].trim()
}


const NODE_PROBE = `
const { SDK } = require('SDK_MODULE')

;(async () => {
  const sdk = SDK.test({ entity: ${JSON.stringify(ITEMS_SEED)} })
  const list = await sdk.Badge().list()
  const listed = list.map((ent) => ent.data())
    .map((rec) => rec.id + '=' + rec.title).sort().join(',')
  console.log('items-probe: ' + listed)
})()
`


const PY_PROBE = String.raw`
from demo_sdk import DemoSDK

seed = {'entity': {'badge': {
    'b1': {'id': 'b1', 'title': 'one'}, 'b2': {'id': 'b2', 'title': 'two'}, 'b3': {'id': 'b3', 'title': 'three'}}}}

listed = DemoSDK.test(seed, None).Badge(None).list(None, None)
recs = [ent.data_get() if hasattr(ent, 'data_get') else ent for ent in listed]
print('items-probe: ' + ','.join(sorted('%s=%s' % (r.get('id'), r.get('title')) for r in recs)))
`


const GO_PROBE = String.raw`package sdktest

import (
	"fmt"
	"sort"
	"strings"
	"testing"

	sdk "GOMODULE"
)

func TestItemsProbe(t *testing.T) {
	seed := map[string]any{"entity": map[string]any{"badge": map[string]any{
		"b1": map[string]any{"id": "b1", "title": "one"},
		"b2": map[string]any{"id": "b2", "title": "two"},
		"b3": map[string]any{"id": "b3", "title": "three"},
	}}}
	res, err := sdk.TestSDK(seed, nil).Badge(nil).List(nil, nil)
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
		out = append(out, fmt.Sprintf("%v=%v", rec["id"], rec["title"]))
	}
	sort.Strings(out)
	fmt.Println("items-probe: " + strings.Join(out, ","))
}
`


const RB_PROBE = String.raw`
require_relative 'Demo_sdk'

seed = { 'entity' => { 'badge' => {
  'b1' => { 'id' => 'b1', 'title' => 'one' }, 'b2' => { 'id' => 'b2', 'title' => 'two' }, 'b3' => { 'id' => 'b3', 'title' => 'three' },
} } }

listed = DemoSDK.test(seed, nil).Badge(nil).list(nil, nil)
recs = listed.map { |ent| ent.respond_to?(:data_get) ? ent.data_get : ent }
puts 'items-probe: ' + recs.map { |r| "#{r['id']}=#{r['title']}" }.sort.join(',')
`


const PHP_PROBE = String.raw`<?php
require_once __DIR__ . '/demo_sdk.php';

$seed = ['entity' => ['badge' => [
    'b1' => ['id' => 'b1', 'title' => 'one'], 'b2' => ['id' => 'b2', 'title' => 'two'], 'b3' => ['id' => 'b3', 'title' => 'three'],
]]];

$listed = DemoSDK::test($seed, null)->Badge(null)->list(null, null);
$out = [];
foreach ($listed as $ent) {
    $rec = is_object($ent) && method_exists($ent, 'data_get') ? $ent->data_get() : $ent;
    $out[] = $rec['id'] . '=' . $rec['title'];
}
sort($out);
echo 'items-probe: ' . implode(',', $out) . "\n";
`


const PERL_PROBE = String.raw`
use strict;
use warnings;
use lib 'lib';
use Scalar::Util qw(blessed);
use DemoSDK;

my $seed = { entity => { badge => {
  b1 => { id => 'b1', title => 'one' }, b2 => { id => 'b2', title => 'two' }, b3 => { id => 'b3', title => 'three' },
} } };

my $listed = DemoSDK->test($seed, undef)->Badge(undef)->list(undef, undef);
my @out = sort map {
  my $rec = (blessed($_) && $_->can('data_get')) ? $_->data_get : $_;
  "$rec->{id}=$rec->{title}"
} @$listed;
print 'items-probe: ' . join(',', @out) . "\n";
`


const LUA_PROBE = String.raw`
local sdk = require("demo_sdk")

local seed = { entity = { badge = {
  b1 = { id = "b1", title = "one" }, b2 = { id = "b2", title = "two" }, b3 = { id = "b3", title = "three" },
} } }

local listed, err = sdk.test(seed, nil):Badge(nil):list(nil, nil)
if err ~= nil then error(tostring(err)) end
local out = {}
for _, ent in ipairs(listed) do
  local rec = (type(ent) == "table" and ent.data_get) and ent:data_get() or ent
  table.insert(out, tostring(rec.id) .. "=" .. tostring(rec.title))
end
table.sort(out)
print("items-probe: " .. table.concat(out, ","))
`


const JAVA_PROBE = String.raw`
import java.util.*;
import voxgig.demosdk.core.*;

public class ItemsProbe {
  static Map<String, Object> map(Object... kv) {
    Map<String, Object> m = new LinkedHashMap<>();
    for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
    return m;
  }

  @SuppressWarnings("unchecked")
  public static void main(String[] args) {
    Map<String, Object> seed = map("entity", map("badge", map(
        "b1", map("id", "b1", "title", "one"),
        "b2", map("id", "b2", "title", "two"),
        "b3", map("id", "b3", "title", "three"))));
    Object listed = DemoSDK.testSDK(seed, null).badge(null).list(null, null);
    List<String> out = new ArrayList<>();
    for (Object item : (List<Object>) listed) {
      Map<String, Object> rec = (Map<String, Object>) (item instanceof Entity ? ((Entity) item).data() : item);
      out.add(rec.get("id") + "=" + rec.get("title"));
    }
    Collections.sort(out);
    System.out.println("items-probe: " + String.join(",", out));
  }
}
`


const KOTLIN_PROBE = String.raw`package voxgig.demosdk.sdktest

import org.junit.jupiter.api.Test

import voxgig.demosdk.core.DemoSDK
import voxgig.demosdk.core.Entity

class ItemsProbe {
  @Test
  fun itemsProbe() {
    val seed = linkedMapOf<String, Any?>("entity" to linkedMapOf<String, Any?>(
      "badge" to linkedMapOf<String, Any?>(
        "b1" to linkedMapOf<String, Any?>("id" to "b1", "title" to "one"),
        "b2" to linkedMapOf<String, Any?>("id" to "b2", "title" to "two"),
        "b3" to linkedMapOf<String, Any?>("id" to "b3", "title" to "three"))))
    val listed = DemoSDK.testSDK(seed, null).badge(null).list(null, null) as List<*>
    val out = listed.map { item ->
      val rec = (if (item is Entity) item.data() else item) as Map<*, *>
      "" + rec["id"] + "=" + rec["title"]
    }.sorted()
    println("items-probe: " + out.joinToString(","))
  }
}
`


const SCALA_PROBE = String.raw`
import java.util.{ArrayList, Collections, LinkedHashMap, List => JList, Map => JMap}
import voxgig.demosdk.core.{DemoSDK, Entity}

object ItemsProbeMain {
  private def map(kv: (String, Object)*): JMap[String, Object] = {
    val m = new LinkedHashMap[String, Object]()
    kv.foreach { case (k, v) => m.put(k, v) }
    m
  }

  def main(args: Array[String]): Unit = {
    val seed = map("entity" -> map("badge" -> map(
      "b1" -> map("id" -> "b1", "title" -> "one"),
      "b2" -> map("id" -> "b2", "title" -> "two"),
      "b3" -> map("id" -> "b3", "title" -> "three"))))
    val listed = DemoSDK.testSDK(seed, null).badge(null).list(null, null).asInstanceOf[JList[Object]]
    val out = new ArrayList[String]()
    listed.forEach { item =>
      val rec = (item match {
        case e: Entity => e.data()
        case other => other
      }).asInstanceOf[JMap[String, Object]]
      out.add(String.valueOf(rec.get("id")) + "=" + String.valueOf(rec.get("title")))
    }
    Collections.sort(out)
    println("items-probe: " + String.join(",", out))
  }
}
`


const CSHARP_PROBE = String.raw`
using DemoSdk;

public static class ItemsProbe
{
    static Dictionary<string, object?> Rec(string id, string title) =>
        new Dictionary<string, object?> { ["id"] = id, ["title"] = title };

    public static void Main()
    {
        var seed = new Dictionary<string, object?>
        {
            ["entity"] = new Dictionary<string, object?>
            {
                ["badge"] = new Dictionary<string, object?>
                {
                    ["b1"] = Rec("b1", "one"), ["b2"] = Rec("b2", "two"), ["b3"] = Rec("b3", "three"),
                },
            },
        };
        var listed = DemoSDK.TestSDK(seed, null).Badge().List(null, null) as List<object?> ?? new List<object?>();
        var output = new List<string>();
        foreach (var item in listed)
        {
            var rec = (item is IEntity ent ? ent.Data() : item) as Dictionary<string, object?>;
            output.Add(rec?["id"] + "=" + rec?["title"]);
        }
        output.Sort(StringComparer.Ordinal);
        Console.WriteLine("items-probe: " + string.Join(",", output));
    }
}
`


const SWIFT_PROBE = String.raw`import Foundation
import XCTest
@testable import DemoSdk

final class ItemsProbeTest: XCTestCase {
  func rec(_ id: String, _ title: String) -> Value {
    let m = VMap()
    m.entries["id"] = .string(id)
    m.entries["title"] = .string(title)
    return .map(m)
  }

  func testItemsProbe() throws {
    let badges = VMap()
    badges.entries["b1"] = rec("b1", "one")
    badges.entries["b2"] = rec("b2", "two")
    badges.entries["b3"] = rec("b3", "three")
    let entity = VMap()
    entity.entries["badge"] = .map(badges)
    let seed = VMap()
    seed.entries["entity"] = .map(entity)

    let listed = try DemoSDK.testSDK(seed, nil).Badge(nil).list(VMap(), nil)
    var out: [String] = []
    for item in listed.asList?.items ?? [] {
      var record = item
      if case .native(let ref) = item, let ent = ref.value as? Entity {
        record = ent.data()
      }
      out.append((gp(record, "id").asString ?? "") + "=" + (gp(record, "title").asString ?? ""))
    }
    print("items-probe: " + out.sorted().joined(separator: ","))
  }
}
`


const ELIXIR_PROBE = String.raw`
defmodule Demo.ItemsProbeTest do
  use ExUnit.Case

  alias Voxgig.Struct, as: S

  test "items probe" do
    rec = fn id, title -> S.jm(["id", id, "title", title]) end
    badges = S.jm(["b1", rec.("b1", "one"), "b2", rec.("b2", "two"), "b3", rec.("b3", "three")])
    sdk = Demo.test(S.jm(["entity", S.jm(["badge", badges])]), nil)
    result = Demo.Entity.Badge.list(Demo.badge(sdk), S.jm([]))

    listed =
      for i <- 0..(S.size(result) - 1)//1 do
        r = Demo.EntityBase.data_get(S.getelem(result, i))
        "#{S.getprop(r, "id")}=#{S.getprop(r, "title")}"
      end

    IO.puts("items-probe: " <> (listed |> Enum.sort() |> Enum.join(",")))
  end
end
`


const CLOJURE_PROBE = String.raw`
(require '[sdk.api :as api]
         '[voxgig.struct :as vs]
         '[clojure.string :as cstr]
         '[sdk.entity.badge :as e-badge])

(defn rec [id title] (vs/jm "id" id "title" title))

(def sdk (api/test-sdk (vs/jm "entity" (vs/jm "badge" (vs/jm "b1" (rec "b1" "one")
                                                                 "b2" (rec "b2" "two")
                                                                 "b3" (rec "b3" "three"))))
                       nil))

(def listed (e-badge/list (api/badge sdk nil) (vs/jm) nil))

(println (str "items-probe: "
              (cstr/join "," (sort (map (fn [item]
                                          (let [r (if (map? item) ((:data-get item)) item)]
                                            (str (vs/getprop r "id") "=" (vs/getprop r "title"))))
                                        listed)))))
`


const RUST_PROBE = String.raw`
use demo_sdk::core::helpers::{getp, jo};
use demo_sdk::{test_sdk, DemoEntity, Entity, Value};

#[test]
fn items_probe() {
    let rec = |id: &str, title: &str| jo(vec![("id", Value::str(id)), ("title", Value::str(title))]);
    let seed = jo(vec![("entity", jo(vec![("badge", jo(vec![
        ("b1", rec("b1", "one")),
        ("b2", rec("b2", "two")),
        ("b3", rec("b3", "three")),
    ]))]))]);
    let listed = test_sdk(seed, Value::Noval).badge(Value::Noval)
        .list(Value::Noval, Value::Noval).expect("list failed");
    let mut out: Vec<String> = listed.iter().map(|ent| {
        let rec = ent.data(None);
        format!("{}={}", getp(&rec, "id").as_str().unwrap_or(""), getp(&rec, "title").as_str().unwrap_or(""))
    }).collect();
    out.sort();
    println!("items-probe: {}", out.join(","));
}
`


// The list answers a NULL-terminated array of entities.
const C_PROBE = String.raw`
#include "sdk.h"
#include "api.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static voxgig_value* rec(const char* id, const char* title) {
  return cmap(2, "id", v_str(id), "title", v_str(title));
}

static int byrow(const void* a, const void* b) {
  return strcmp((const char*)a, (const char*)b);
}

static const char* str(voxgig_value* m, const char* key) {
  const char* s = get_str(m, key);
  return s ? s : "";
}

int main(void) {
  voxgig_value* seed = cmap(1, "entity", cmap(1, "badge", cmap(3,
    "b1", rec("b1", "one"), "b2", rec("b2", "two"), "b3", rec("b3", "three"))));
  Entity* e = demo_badge(test_sdk(seed, NULL), NULL);
  PNError* err = NULL;
  Entity** items = e->vt->list(e, NULL, NULL, &err);
  if (err) {
    printf("list failed: %s\n", pn_error_str(err));
    return 1;
  }
  char out[16][128];
  int n = 0;
  for (; n < 16 && items[n]; n++) {
    voxgig_value* r = items[n]->vt->data(items[n], NULL);
    snprintf(out[n], sizeof(out[n]), "%s=%s", str(r, "id"), str(r, "title"));
  }
  qsort(out, n, sizeof(out[0]), byrow);
  printf("items-probe: ");
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

static Value record(const std::string& id, const std::string& title) {
  return vmap({{"id", Value(id)}, {"title", Value(title)}});
}

int main() {
  Value seed = vmap({{"entity", vmap({{"badge", vmap({
    {"b1", record("b1", "one")},
    {"b2", record("b2", "two")},
    {"b3", record("b3", "three")},
  })}})}});
  auto client = DemoSDK::testSDK(seed, Value::undef());
  std::vector<std::string> out;
  for (const auto& ent : client->badge()->list(vmap(), vmap())) {
    Value r = ent->data();
    out.push_back(as_str(getp(r, "id")) + "=" + as_str(getp(r, "title")));
  }
  std::sort(out.begin(), out.end());
  std::string joined;
  for (size_t i = 0; i < out.size(); i++) joined += (0 < i ? "," : "") + out[i];
  std::cout << "items-probe: " << joined << std::endl;
  return 0;
}
`


const ZIG_PROBE = String.raw`
const std = @import("std");
const sdk = @import("sdk");
const h = sdk.h;
const Value = sdk.Value;

fn record(id: []const u8, title: []const u8) Value {
    return h.jo(&.{ .{ "id", h.vstr(id) }, .{ "title", h.vstr(title) } });
}

fn before(_: void, a: []const u8, b: []const u8) bool {
    return std.mem.lessThan(u8, a, b);
}

test "items probe" {
    const seed = h.jo(&.{.{ "entity", h.jo(&.{.{ "badge", h.jo(&.{
        .{ "b1", record("b1", "one") },
        .{ "b2", record("b2", "two") },
        .{ "b3", record("b3", "three") },
    }) }}) }});
    const client = sdk.test_sdk(seed, Value{ .null = {} });
    const listed = switch (client.badge(Value{ .null = {} }).list(h.omap(), h.omap())) {
        .ok => |items| items,
        .err => |e| {
            std.debug.print("list failed: {s}\n", .{e.msg});
            return error.ListFailed;
        },
    };
    var out: std.ArrayList([]const u8) = .empty;
    for (listed) |ent| {
        const r = ent.asEntity().data(null);
        const line = std.fmt.allocPrint(h.A(), "{s}={s}",
            .{ h.scalar_str(h.getp(r, "id")), h.scalar_str(h.getp(r, "title")) }) catch unreachable;
        out.append(h.A(), line) catch unreachable;
    }
    std.mem.sort([]const u8, out.items, {}, before);
    const joined = std.mem.join(h.A(), ",", out.items) catch unreachable;
    std.debug.print("items-probe: {s}\n", .{joined});
}
`


const OCAML_PROBE = String.raw`
open Voxgig_struct
open Sdk_types
open Sdk_helpers

let record id title = jo [("id", Str id); ("title", Str title)]

let () =
  let seed = jo [("entity", jo [("badge", jo [("b1", record "b1" "one");
                                              ("b2", record "b2" "two");
                                              ("b3", record "b3" "three")])])] in
  let client = Sdk_client.test_with seed Noval in
  let listed = (Sdk_client.badge client Noval).e_list (empty_map ()) (empty_map ()) in
  let str v = match v with Str s -> s | _ -> "" in
  let out = List.map (fun e ->
      let r = e.e_data_get () in str (getp r "id") ^ "=" ^ str (getp r "title")) listed in
  Printf.printf "items-probe: %s\n%!" (String.concat "," (List.sort compare out))
`


const ITEMS_PROBES: Record<string, string> = {
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
  ITEMS_SEED,
  ITEMS_EXPECT,
  ITEMS_PROBES,
  itemsListed,
}
