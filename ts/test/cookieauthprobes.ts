
const auth = { prefix: 'Bearer', basic: false }
const keep = { session: 'unrelated-header', authorization: 'unrelated-auth' }
const headers = (cookie: string | null) => null == cookie ? { ...keep } : { ...keep, cookie }
const step = (options: any, cookie: string | null) => ({ options, headers: headers(cookie) })

const COOKIE_CASES = [
  {
    name: 'replace and clear on the same spec',
    headers: headers('theme=dark'),
    steps: [
      step({ auth, apikey: 'FIRST' }, 'theme=dark; session=FIRST'),
      step({ auth, apikey: 'FIRST' }, 'theme=dark; session=FIRST'),
      step({ auth, apikey: 'SECOND' }, 'theme=dark; session=SECOND'),
      step({ auth: null, apikey: 'SECOND' }, 'theme=dark'),
      step({ auth, apikey: 'THIRD' }, 'theme=dark; session=THIRD'),
      step({ auth, apikey: '' }, 'theme=dark'),
    ],
  },
  ...[
    { auth: null, apikey: 'K' },
    { auth },
    { auth, apikey: '' },
    { auth, apikey: null },
  ].map((options, i) => ({
    name: 'clear shape ' + i,
    headers: headers('session=OLD; theme=dark; session=OTHER'),
    steps: [step(options, 'theme=dark'), step(options, 'theme=dark')],
  })),
  {
    name: 'remove the header when no cookies remain',
    headers: headers('session=OLD;session=OTHER'),
    steps: [step({ auth }, null), step({ auth }, null),
      step({ auth, apikey: 'K' }, 'session=K'), step({ auth: null }, null)],
  },
  {
    name: 'exact case-sensitive names and semicolon whitespace',
    headers: headers(' session=OLD;theme=dark;\tsession=OTHER ; session_extra=keep; Session=keep; other=a=b;; session '),
    steps: [step({ auth, apikey: 'NEW=VALUE' },
      'theme=dark; session_extra=keep; Session=keep; other=a=b; session=NEW=VALUE'),
    step({ auth }, 'theme=dark; session_extra=keep; Session=keep; other=a=b')],
  },
  ...[null, ''].map((cookie) => ({
    name: 'empty initial header ' + cookie,
    headers: headers(cookie),
    steps: [step({ auth }, null), step({ auth, apikey: 'K' }, 'session=K')],
  })),
  {
    name: 'long unrelated cookie is preserved',
    headers: headers('other=' + 'x'.repeat(4096) + ';session=OLD'),
    steps: [step({ auth, apikey: 'K' }, 'other=' + 'x'.repeat(4096) + '; session=K'),
      step({ auth }, 'other=' + 'x'.repeat(4096))],
  },
]

const COOKIE_PROBES: Record<string, string> = {
  node: String.raw`
const { deepStrictEqual, strictEqual } = require('node:assert')
const cases = require('./cookie-cases.json')
const { prepareAuth } = require('./PREPARE_AUTH')
const struct = require('@voxgig/struct')
for (const c of cases) {
  const spec = { headers: c.headers, query: { session: 'unrelated-query' } }
  for (const s of c.steps) {
    const ctx = { spec, utility: { struct }, client: { options: () => s.options } }
    strictEqual(prepareAuth(ctx), spec, c.name)
    deepStrictEqual(spec.headers, s.headers, c.name)
    deepStrictEqual(spec.query, { session: 'unrelated-query' }, c.name)
  }
}
console.log('cookie-auth: ran ' + cases.length + ' cases')
`,
  py: String.raw`
import json
from types import SimpleNamespace
from demo_sdk.utility.prepare_auth import prepare_auth_util

with open('cookie-cases.json') as f:
    cases = json.load(f)
for c in cases:
    spec = SimpleNamespace(headers=c['headers'], query={'session': 'unrelated-query'})
    for s in c['steps']:
        ctx = SimpleNamespace(spec=spec, client=SimpleNamespace(options_map=lambda: s['options']))
        result, err = prepare_auth_util(ctx)
        assert err is None and result is spec, c['name']
        assert spec.headers == s['headers'], (c['name'], spec.headers, s['headers'])
        assert spec.query == {'session': 'unrelated-query'}, c['name']
print('cookie-auth: ran %d cases' % len(cases))
`,
  rb: String.raw`
require 'json'
require 'ostruct'
require_relative 'utility/prepare_auth'
cases = JSON.parse(File.read('cookie-cases.json'))
cases.each do |c|
  spec = OpenStruct.new(headers: c['headers'], query: {'session' => 'unrelated-query'})
  c['steps'].each do |s|
    ctx = OpenStruct.new(spec: spec, client: OpenStruct.new(options_map: s['options']))
    result, err = DemoUtilities::PrepareAuth.call(ctx)
    raise c['name'] unless err.nil? && result.equal?(spec)
    raise "#{c['name']}: #{spec.headers.inspect}" unless spec.headers == s['headers']
    raise c['name'] unless spec.query == {'session' => 'unrelated-query'}
  end
end
puts "cookie-auth: ran #{cases.length} cases"
`,
  php: String.raw`<?php
require_once __DIR__ . '/demo_sdk.php';
$cases = json_decode(file_get_contents('cookie-cases.json'), true, 512, JSON_THROW_ON_ERROR);
foreach ($cases as $c) {
    $spec = new DemoSpec(['headers' => $c['headers'], 'query' => ['session' => 'unrelated-query']]);
    foreach ($c['steps'] as $s) {
        $client = new class($s['options']) {
            public function __construct(private array $opts) {}
            public function options_map(): array { return $this->opts; }
        };
        $ctx = new DemoContext(['spec' => $spec, 'client' => $client]);
        [$result, $err] = DemoPrepareAuth::call($ctx);
        if ($err !== null || $result !== $spec || $spec->headers != $s['headers']
            || $spec->query !== ['session' => 'unrelated-query']) {
            throw new Exception($c['name'] . ': ' . json_encode($spec->headers));
        }
    }
}
echo 'cookie-auth: ran ' . count($cases) . " cases\n";
`,
  perl: String.raw`
use strict;
use warnings;
use JSON::PP;
require './utility/prepare_auth.pm';
{ package CookieClient; sub options_map { $_[0]->{opts} } }
open my $fh, '<', 'cookie-cases.json' or die $!;
my $cases = decode_json(do { local $/; <$fh> });
for my $c (@$cases) {
  my $spec = { headers => $c->{headers}, query => { session => 'unrelated-query' } };
  for my $s (@{$c->{steps}}) {
    my $client = bless { opts => $s->{options} }, 'CookieClient';
    my ($result, $err) = $DemoUtilities::REGISTRY{prepare_auth}->({ spec => $spec, client => $client });
    die $c->{name} if defined $err || $result != $spec;
    my $json = JSON::PP->new->canonical;
    die "$c->{name}: " . $json->encode($spec->{headers})
      unless $json->encode($spec->{headers}) eq $json->encode($s->{headers});
    die $c->{name} unless $json->encode($spec->{query}) eq '{"session":"unrelated-query"}';
  }
}
print 'cookie-auth: ran ' . scalar(@$cases) . " cases\n";
`,
  go: String.raw`package sdktest

import (
  "encoding/json"
  "os"
  "reflect"
  "testing"
  sdk "GOMODULE"
)

func TestCookieAuth(t *testing.T) {
  data, err := os.ReadFile("../cookie-cases.json")
  if err != nil { t.Fatal(err) }
  var cases []struct {
    Name string
    Headers map[string]any
    Steps []struct { Options map[string]any; Headers map[string]any }
  }
  if err := json.Unmarshal(data, &cases); err != nil { t.Fatal(err) }
  for _, c := range cases {
    spec := sdk.NewSpec(map[string]any{"headers": c.Headers, "query": map[string]any{"session": "unrelated-query"}})
    for _, s := range c.Steps {
      client := sdk.NewDemoSDK(s.Options)
      utility := client.GetUtility()
      ctx := sdk.NewContext(map[string]any{"client": client, "spec": spec}, nil)
      result, err := utility.PrepareAuth(ctx)
      if err != nil || result != spec || !reflect.DeepEqual(spec.Headers, s.Headers) ||
        !reflect.DeepEqual(spec.Query, map[string]any{"session": "unrelated-query"}) {
        t.Fatalf("%s: %v, %v", c.Name, spec.Headers, err)
      }
    }
  }
  t.Logf("cookie-auth: ran %d cases", len(cases))
}
`,
  java: String.raw`
import java.nio.file.*;
import java.util.*;
import voxgig.demosdk.core.*;
import voxgig.demosdk.utility.Json;

public class CookieAuthProbe {
  @SuppressWarnings("unchecked")
  public static void main(String[] args) throws Exception {
    var cases = (List<Map<String, Object>>) Json.parse(Files.readString(Path.of("cookie-cases.json")));
    for (var c : cases) {
      var spec = new Spec(Map.of("headers", c.get("headers"), "query", new LinkedHashMap<>(Map.of("session", "unrelated-query"))));
      for (var s : (List<Map<String, Object>>) c.get("steps")) {
        var client = new DemoSDK((Map<String, Object>) s.get("options"));
        var ctx = new Context(Map.of("client", client, "spec", spec), null);
        var result = client.getUtility().prepareAuth.apply(ctx);
        if (result != spec || !spec.headers.equals(s.get("headers")) ||
            !spec.query.equals(Map.of("session", "unrelated-query"))) {
          throw new AssertionError(c.get("name") + ": " + spec.headers);
        }
      }
    }
    System.out.println("cookie-auth: ran " + cases.size() + " cases");
  }
}
`,
  rust: String.raw`
use std::{cell::RefCell, rc::Rc};
use demo_sdk::{Context, CtxSpec, Spec, json_parse};
use demo_sdk::core::helpers::{getp, jo};
use demo_sdk::utility::{prepare_auth::prepare_auth_util, voxgigstruct::Value};

#[test]
fn cookie_auth() {
    let data = json_parse(&std::fs::read_to_string("cookie-cases.json").unwrap()).unwrap();
    let Value::List(cases) = data else { panic!("expected cases") };
    for c in cases.borrow().iter() {
        let query = jo(vec![("session", Value::str("unrelated-query"))]);
        let spec = Rc::new(RefCell::new(Spec::new(&jo(vec![
            ("headers", getp(c, "headers")), ("query", query.clone()),
        ]))));
        let Value::List(steps) = getp(c, "steps") else { panic!("expected steps") };
        for s in steps.borrow().iter() {
            let ctx = Context::new(CtxSpec {
                spec: Some(spec.clone()), options: Some(getp(s, "options")),
                ..Default::default()
            }, None);
            let result = prepare_auth_util(&ctx).unwrap();
            assert!(Rc::ptr_eq(&result, &spec));
            assert_eq!(spec.borrow().headers, getp(s, "headers"), "{:?}", getp(c, "name"));
            assert_eq!(spec.borrow().query, query);
        }
    }
    println!("cookie-auth: ran {} cases", cases.borrow().len());
}
`,
  c: String.raw`
#include "sdk.h"
#include <stdio.h>
#include <string.h>

int main(void) {
  voxgig_value* data = voxgig_parse_json_file("cookie-cases.json");
  if (!data || !voxgig_is_list(data)) return 1;
  voxgig_list* cases = voxgig_as_list(data);
  for (size_t i = 0; i < voxgig_list_len(cases); i++) {
    voxgig_value* c = voxgig_list_get(cases, i);
    Spec* spec = spec_new(cmap(2, "headers", getp(c, "headers"),
      "query", cmap(1, "session", v_str("unrelated-query"))));
    voxgig_list* steps = voxgig_as_list(getp(c, "steps"));
    for (size_t j = 0; j < voxgig_list_len(steps); j++) {
      voxgig_value* s = voxgig_list_get(steps, j);
      CtxSpec cs = {0};
      cs.options = getp(s, "options");
      Context* ctx = context_new(cs, NULL);
      ctx->spec = spec;
      PNError* err = NULL;
      Spec* result = prepare_auth_util(ctx, &err);
      if (err || result != spec || !voxgig_equals(spec->headers, getp(s, "headers")) ||
          strcmp(get_str(spec->query, "session"), "unrelated-query")) {
        fprintf(stderr, "cookie-auth failed: %s\n", get_str(c, "name"));
        return 1;
      }
    }
  }
  printf("cookie-auth: ran %zu cases\n", voxgig_list_len(cases));
  return 0;
}
`,
  csharp: String.raw`
using DemoSdk;
using System.Text.Json;

public static class CookieAuthProbe
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
        using var fixture = JsonDocument.Parse(File.ReadAllText("cookie-cases.json"));
        var cases = (List<object?>)Value(fixture.RootElement)!;
        foreach (var c in cases.Cast<Dictionary<string, object?>>())
        {
            var spec = new Spec(new() { ["headers"] = c["headers"],
                ["query"] = new Dictionary<string, object?> { ["session"] = "unrelated-query" } });
            foreach (var s in ((List<object?>)c["steps"]!).Cast<Dictionary<string, object?>>())
            {
                var options = (Dictionary<string, object?>)s["options"]!;
                var hasKey = options.TryGetValue("apikey", out var apikey);
                // Construct with a valid key, then exercise raw missing/null values in prepareAuth.
                var client = new DemoSDK(new(options) { ["apikey"] = apikey ?? "" });
                var resolved = client.GetRootCtx().Options
                    ?? throw new Exception("Expected resolved client options");
                if (hasKey) resolved["apikey"] = apikey;
                else resolved.Remove("apikey");
                var actual = client.OptionsMap();
                if (actual.TryGetValue("apikey", out var actualKey) != hasKey || !Equals(actualKey, apikey))
                    throw new Exception("API key fixture was not applied: " + c["name"]);
                var ctx = new Context(new() { ["client"] = client, ["spec"] = spec }, null);
                var result = client.GetUtility().PrepareAuth(ctx);
                var expected = (Dictionary<string, object?>)s["headers"]!;
                if (!ReferenceEquals(result, spec) || spec.Headers.Count != expected.Count ||
                    expected.Any(p => !spec.Headers.TryGetValue(p.Key, out var v) || !Equals(v, p.Value)) ||
                    spec.Query.Count != 1 || !Equals(spec.Query["session"], "unrelated-query"))
                    throw new Exception((string)c["name"]!);
            }
        }
        Console.WriteLine($"cookie-auth: ran {cases.Count} cases");
    }
}
`,
}

export { COOKIE_CASES, COOKIE_PROBES }
