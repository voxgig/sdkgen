// A list whose items are not records, driven through a generated SDK in test
// mode: the mock answers the scalars it is seeded with, and each listed entity
// must hold its item, as ts's makeResult keeps it.
const SCALAR_SEED = { cat: { s1: 'a.md', s2: 'dir/' } }

// Each probe prints the data of every entity it lists, sorted, with `?` for
// data that is not a string.
const SCALAR_EXPECT = 'a.md,dir/'

function scalarsListed(out: string): string | null {
  const m = out.match(/scalars-probe: ([^\r\n]*)/)
  return null == m ? null : m[1].trim()
}


const NODE_PROBE = `
const { SDK } = require('SDK_MODULE')

;(async () => {
  const sdk = SDK.test({ entity: ${JSON.stringify(SCALAR_SEED)} })
  const list = await sdk.Cat().list()
  const listed = list.map((ent) => ent.data())
    .map((d) => 'string' === typeof d ? d : '?').sort().join(',')
  console.log('scalars-probe: ' + listed)
})()
`


const PY_PROBE = String.raw`
from demo_sdk import DemoSDK

seed = {'entity': {'cat': {'s1': 'a.md', 's2': 'dir/'}}}

listed = DemoSDK.test(seed, None).Cat(None).list(None, None)
data = [ent.data_get() for ent in listed]
print('scalars-probe: ' + ','.join(sorted(d if isinstance(d, str) else '?' for d in data)))
`


const GO_PROBE = String.raw`package sdktest

import (
	"fmt"
	"sort"
	"strings"
	"testing"

	sdk "GOMODULE"
)

func TestScalarsProbe(t *testing.T) {
	seed := map[string]any{"entity": map[string]any{"cat": map[string]any{
		"s1": "a.md",
		"s2": "dir/",
	}}}
	res, err := sdk.TestSDK(seed, nil).Cat(nil).List(nil, nil)
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	list, _ := res.([]any)
	out := []string{}
	for _, item := range list {
		s := "?"
		if ent, ok := item.(sdk.Entity); ok {
			if d, ok := ent.Data().(string); ok {
				s = d
			}
		}
		out = append(out, s)
	}
	sort.Strings(out)
	fmt.Println("scalars-probe: " + strings.Join(out, ","))
}
`


const RB_PROBE = String.raw`
require_relative 'Demo_sdk'

seed = { 'entity' => { 'cat' => { 's1' => 'a.md', 's2' => 'dir/' } } }

listed = DemoSDK.test(seed, nil).Cat(nil).list(nil, nil)
data = listed.map { |ent| ent.data_get }
puts 'scalars-probe: ' + data.map { |d| d.is_a?(String) ? d : '?' }.sort.join(',')
`


const PHP_PROBE = String.raw`<?php
require_once __DIR__ . '/demo_sdk.php';

$seed = ['entity' => ['cat' => ['s1' => 'a.md', 's2' => 'dir/']]];

$listed = DemoSDK::test($seed, null)->Cat(null)->list(null, null);
$out = [];
foreach ($listed as $ent) {
    $d = $ent->data_get();
    $out[] = is_string($d) ? $d : '?';
}
sort($out);
echo 'scalars-probe: ' . implode(',', $out) . "\n";
`


const PERL_PROBE = String.raw`
use strict;
use warnings;
use lib 'lib';
use DemoSDK;

my $seed = { entity => { cat => { s1 => 'a.md', s2 => 'dir/' } } };

my $listed = DemoSDK->test($seed, undef)->Cat(undef)->list(undef, undef);
my @out = sort map {
  my $d = $_->data_get;
  (defined $d && !ref $d) ? $d : '?'
} @$listed;
print 'scalars-probe: ' . join(',', @out) . "\n";
`


const LUA_PROBE = String.raw`
local sdk = require("demo_sdk")

local seed = { entity = { cat = { s1 = "a.md", s2 = "dir/" } } }

local listed, err = sdk.test(seed, nil):Cat(nil):list(nil, nil)
if err ~= nil then error(tostring(err)) end
local out = {}
for _, ent in ipairs(listed) do
  local d = ent:data_get()
  table.insert(out, type(d) == "string" and d or "?")
end
table.sort(out)
print("scalars-probe: " .. table.concat(out, ","))
`


const JAVA_PROBE = String.raw`
import java.util.*;
import voxgig.demosdk.core.*;

public class ScalarsProbe {
  static Map<String, Object> map(Object... kv) {
    Map<String, Object> m = new LinkedHashMap<>();
    for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
    return m;
  }

  @SuppressWarnings("unchecked")
  public static void main(String[] args) {
    Map<String, Object> seed = map("entity", map("cat", map("s1", "a.md", "s2", "dir/")));
    Object listed = DemoSDK.testSDK(seed, null).cat(null).list(null, null);
    List<String> out = new ArrayList<>();
    for (Object item : (List<Object>) listed) {
      Object d = item instanceof Entity ? ((Entity) item).data() : null;
      out.add(d instanceof String ? (String) d : "?");
    }
    Collections.sort(out);
    System.out.println("scalars-probe: " + String.join(",", out));
  }
}
`


const KOTLIN_PROBE = String.raw`package voxgig.demosdk.sdktest

import org.junit.jupiter.api.Test

import voxgig.demosdk.core.DemoSDK
import voxgig.demosdk.core.Entity

class ScalarsProbe {
  @Test
  fun scalarsProbe() {
    val seed = linkedMapOf<String, Any?>("entity" to linkedMapOf<String, Any?>(
      "cat" to linkedMapOf<String, Any?>("s1" to "a.md", "s2" to "dir/")))
    val listed = DemoSDK.testSDK(seed, null).cat(null).list(null, null) as List<*>
    val out = listed.map { item ->
      ((if (item is Entity) item.data() else null) as? String) ?: "?"
    }.sorted()
    println("scalars-probe: " + out.joinToString(","))
  }
}
`


const SCALA_PROBE = String.raw`
import java.util.{ArrayList, Collections, LinkedHashMap, List => JList, Map => JMap}
import voxgig.demosdk.core.{DemoSDK, Entity}

object ScalarsProbeMain {
  private def map(kv: (String, Object)*): JMap[String, Object] = {
    val m = new LinkedHashMap[String, Object]()
    kv.foreach { case (k, v) => m.put(k, v) }
    m
  }

  def main(args: Array[String]): Unit = {
    val seed = map("entity" -> map("cat" -> map("s1" -> "a.md", "s2" -> "dir/")))
    val listed = DemoSDK.testSDK(seed, null).cat(null).list(null, null).asInstanceOf[JList[Object]]
    val out = new ArrayList[String]()
    listed.forEach { item =>
      out.add(item match {
        case e: Entity => e.data() match {
          case s: String => s
          case _ => "?"
        }
        case _ => "?"
      })
    }
    Collections.sort(out)
    println("scalars-probe: " + String.join(",", out))
  }
}
`


const CSHARP_PROBE = String.raw`
using DemoSdk;

public static class ScalarsProbe
{
    public static void Main()
    {
        var seed = new Dictionary<string, object?>
        {
            ["entity"] = new Dictionary<string, object?>
            {
                ["cat"] = new Dictionary<string, object?> { ["s1"] = "a.md", ["s2"] = "dir/" },
            },
        };
        var listed = DemoSDK.TestSDK(seed, null).Cat().List(null, null) as List<object?> ?? new List<object?>();
        var output = new List<string>();
        foreach (var item in listed)
        {
            output.Add(item is IEntity ent && ent.Data() is string s ? s : "?");
        }
        output.Sort(StringComparer.Ordinal);
        Console.WriteLine("scalars-probe: " + string.Join(",", output));
    }
}
`


const SWIFT_PROBE = String.raw`import Foundation
import XCTest
@testable import DemoSdk

final class ScalarsProbeTest: XCTestCase {
  func testScalarsProbe() throws {
    let cats = VMap()
    cats.entries["s1"] = .string("a.md")
    cats.entries["s2"] = .string("dir/")
    let entity = VMap()
    entity.entries["cat"] = .map(cats)
    let seed = VMap()
    seed.entries["entity"] = .map(entity)

    let listed = try DemoSDK.testSDK(seed, nil).Cat(nil).list(VMap(), nil)
    var out: [String] = []
    for item in listed.asList?.items ?? [] {
      var s = "?"
      if case .native(let ref) = item, let ent = ref.value as? Entity {
        s = ent.data().asString ?? "?"
      }
      out.append(s)
    }
    print("scalars-probe: " + out.sorted().joined(separator: ","))
  }
}
`


const ELIXIR_PROBE = String.raw`
defmodule Demo.ScalarsProbeTest do
  use ExUnit.Case

  alias Voxgig.Struct, as: S

  test "scalars probe" do
    cats = S.jm(["s1", "a.md", "s2", "dir/"])
    sdk = Demo.test(S.jm(["entity", S.jm(["cat", cats])]), nil)
    result = Demo.Entity.Cat.list(Demo.cat(sdk), S.jm([]))

    listed =
      for i <- 0..(S.size(result) - 1)//1 do
        d = Demo.EntityBase.data_get(S.getelem(result, i))
        if is_binary(d), do: d, else: "?"
      end

    IO.puts("scalars-probe: " <> (listed |> Enum.sort() |> Enum.join(",")))
  end
end
`


const CLOJURE_PROBE = String.raw`
(require '[sdk.api :as api]
         '[voxgig.struct :as vs]
         '[clojure.string :as cstr]
         '[sdk.entity.cat :as e-cat])

(def sdk (api/test-sdk (vs/jm "entity" (vs/jm "cat" (vs/jm "s1" "a.md" "s2" "dir/"))) nil))

(def listed (e-cat/list (api/cat sdk nil) (vs/jm) nil))

(println (str "scalars-probe: "
              (cstr/join "," (sort (map (fn [item]
                                          (let [d (if (map? item) ((:data-get item)) item)]
                                            (if (string? d) d "?")))
                                        listed)))))
`


const RUST_PROBE = String.raw`
use demo_sdk::core::helpers::jo;
use demo_sdk::{test_sdk, DemoEntity, Entity, Value};

#[test]
fn scalars_probe() {
    let seed = jo(vec![("entity", jo(vec![("cat", jo(vec![
        ("s1", Value::str("a.md")),
        ("s2", Value::str("dir/")),
    ]))]))]);
    let listed = test_sdk(seed, Value::Noval).cat(Value::Noval)
        .list(Value::Noval, Value::Noval).expect("list failed");
    let mut out: Vec<String> = listed.iter().map(|ent| {
        ent.data(None).as_str().unwrap_or("?").to_string()
    }).collect();
    out.sort();
    println!("scalars-probe: {}", out.join(","));
}
`


// The list answers a NULL-terminated array of entities.
const C_PROBE = String.raw`
#include "sdk.h"
#include "api.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int byrow(const void* a, const void* b) {
  return strcmp((const char*)a, (const char*)b);
}

int main(void) {
  voxgig_value* seed = cmap(1, "entity", cmap(1, "cat", cmap(2,
    "s1", v_str("a.md"), "s2", v_str("dir/"))));
  Entity* e = demo_cat(test_sdk(seed, NULL), NULL);
  PNError* err = NULL;
  Entity** items = e->vt->list(e, NULL, NULL, &err);
  if (err) {
    printf("list failed: %s\n", pn_error_str(err));
    return 1;
  }
  char out[16][128];
  int n = 0;
  for (; n < 16 && items[n]; n++) {
    voxgig_value* d = items[n]->vt->data(items[n], NULL);
    snprintf(out[n], sizeof(out[n]), "%s", v_is_str(d) ? voxgig_as_string(d) : "?");
  }
  qsort(out, n, sizeof(out[0]), byrow);
  printf("scalars-probe: ");
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

int main() {
  Value seed = vmap({{"entity", vmap({{"cat", vmap({
    {"s1", Value(std::string("a.md"))},
    {"s2", Value(std::string("dir/"))},
  })}})}});
  auto client = DemoSDK::testSDK(seed, Value::undef());
  std::vector<std::string> out;
  for (const auto& ent : client->cat()->list(vmap(), vmap())) {
    Value d = ent->data();
    out.push_back(d.is_string() ? d.as_string() : std::string("?"));
  }
  std::sort(out.begin(), out.end());
  std::string joined;
  for (size_t i = 0; i < out.size(); i++) joined += (0 < i ? "," : "") + out[i];
  std::cout << "scalars-probe: " << joined << std::endl;
  return 0;
}
`


const ZIG_PROBE = String.raw`
const std = @import("std");
const sdk = @import("sdk");
const h = sdk.h;
const Value = sdk.Value;

fn before(_: void, a: []const u8, b: []const u8) bool {
    return std.mem.lessThan(u8, a, b);
}

test "scalars probe" {
    const seed = h.jo(&.{.{ "entity", h.jo(&.{.{ "cat", h.jo(&.{
        .{ "s1", h.vstr("a.md") },
        .{ "s2", h.vstr("dir/") },
    }) }}) }});
    const client = sdk.test_sdk(seed, Value{ .null = {} });
    const listed = switch (client.cat(Value{ .null = {} }).list(h.omap(), h.omap())) {
        .ok => |items| items,
        .err => |e| {
            std.debug.print("list failed: {s}\n", .{e.msg});
            return error.ListFailed;
        },
    };
    var out: std.ArrayList([]const u8) = .empty;
    for (listed) |ent| {
        const d = ent.asEntity().data(null);
        const s: []const u8 = switch (d) {
            .string => |str| str,
            else => "?",
        };
        out.append(h.A(), s) catch unreachable;
    }
    std.mem.sort([]const u8, out.items, {}, before);
    const joined = std.mem.join(h.A(), ",", out.items) catch unreachable;
    std.debug.print("scalars-probe: {s}\n", .{joined});
}
`


const OCAML_PROBE = String.raw`
open Voxgig_struct
open Sdk_types
open Sdk_helpers

let () =
  let seed = jo [("entity", jo [("cat", jo [("s1", Str "a.md"); ("s2", Str "dir/")])])] in
  let client = Sdk_client.test_with seed Noval in
  let listed = (Sdk_client.cat client Noval).e_list (empty_map ()) (empty_map ()) in
  let out = List.map (fun e -> match e.e_data_get () with Str s -> s | _ -> "?") listed in
  Printf.printf "scalars-probe: %s\n%!" (String.concat "," (List.sort compare out))
`


const SCALAR_PROBES: Record<string, string> = {
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
  SCALAR_SEED,
  SCALAR_EXPECT,
  SCALAR_PROBES,
  scalarsListed,
}
