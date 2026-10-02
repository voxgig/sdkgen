// Cases and per-language probes that drive a generated SDK's prepareAuth
// through repeated calls on ONE spec, as a retried or re-prepared request
// would, and compare both bags after every call.

type AuthStep = {
  options: any
  headers: Record<string, string>
  query: Record<string, string>
}

type AuthCase = {
  name: string
  headers: Record<string, string>
  query: Record<string, string>
  steps: AuthStep[]
}

type AuthModel = {
  name: string
  extra: string
  cases: AuthCase[]
}


const auth = { prefix: 'Bearer', basic: false }
const renamed = (name: string) => ({ ...auth, name })


// COOKIE: the credential is the `session` pair inside the shared cookie header.
const cookieKeep = { session: 'unrelated-header', authorization: 'unrelated-auth' }
const cookieQuery = { session: 'unrelated-query' }
const cookieHeaders = (cookie: string | null) =>
  null == cookie ? { ...cookieKeep } : { ...cookieKeep, cookie }
const cookieStep = (options: any, cookie: string | null): AuthStep =>
  ({ options, headers: cookieHeaders(cookie), query: { ...cookieQuery } })
const cookieCase = (name: string, cookie: string | null, steps: AuthStep[]): AuthCase =>
  ({ name, headers: cookieHeaders(cookie), query: { ...cookieQuery }, steps })

const COOKIE_CASES: AuthCase[] = [
  cookieCase('replace and clear on the same spec', 'theme=dark', [
    cookieStep({ auth, apikey: 'FIRST' }, 'theme=dark; session=FIRST'),
    cookieStep({ auth, apikey: 'FIRST' }, 'theme=dark; session=FIRST'),
    cookieStep({ auth, apikey: 'SECOND' }, 'theme=dark; session=SECOND'),
    cookieStep({ auth: null, apikey: 'SECOND' }, 'theme=dark'),
    cookieStep({ auth, apikey: 'THIRD' }, 'theme=dark; session=THIRD'),
    cookieStep({ auth, apikey: '' }, 'theme=dark'),
  ]),
  ...[
    { auth: null, apikey: 'K' },
    { auth },
    { auth, apikey: '' },
    { auth, apikey: null },
  ].map((options, i) => cookieCase('clear shape ' + i,
    'session=OLD; theme=dark; session=OTHER',
    [cookieStep(options, 'theme=dark'), cookieStep(options, 'theme=dark')])),
  cookieCase('remove the header when no cookies remain', 'session=OLD;session=OTHER', [
    cookieStep({ auth }, null),
    cookieStep({ auth }, null),
    cookieStep({ auth, apikey: 'K' }, 'session=K'),
    cookieStep({ auth: null }, null),
  ]),
  cookieCase('exact case-sensitive names and semicolon whitespace',
    ' session=OLD;theme=dark;\tsession=OTHER ; session_extra=keep; Session=keep; other=a=b;; session ', [
      cookieStep({ auth, apikey: 'NEW=VALUE' },
        'theme=dark; session_extra=keep; Session=keep; other=a=b; session=NEW=VALUE'),
      cookieStep({ auth }, 'theme=dark; session_extra=keep; Session=keep; other=a=b'),
    ]),
  ...[null, ''].map((cookie) => cookieCase('empty initial header ' + cookie, cookie, [
    cookieStep({ auth }, null),
    cookieStep({ auth, apikey: 'K' }, 'session=K'),
  ])),
  cookieCase('long unrelated cookie is preserved', 'other=' + 'x'.repeat(4096) + ';session=OLD', [
    cookieStep({ auth, apikey: 'K' }, 'other=' + 'x'.repeat(4096) + '; session=K'),
    cookieStep({ auth }, 'other=' + 'x'.repeat(4096)),
  ]),
  cookieCase('a run-time name replaces the declared cookie', 'theme=dark; session=OLD', [
    cookieStep({ auth: renamed('token'), apikey: 'K' }, 'theme=dark; token=K'),
    cookieStep({ auth: renamed('token'), apikey: 'K' }, 'theme=dark; token=K'),
    cookieStep({ auth: renamed('token'), apikey: 'K2' }, 'theme=dark; token=K2'),
    cookieStep({ auth: renamed('token'), apikey: '' }, 'theme=dark'),
    cookieStep({ auth, apikey: 'K' }, 'theme=dark; session=K'),
    cookieStep({ auth: renamed('Session'), apikey: 'K' }, 'theme=dark; Session=K'),
    cookieStep({ auth: renamed('Session'), apikey: null }, 'theme=dark'),
    cookieStep({ auth: renamed(''), apikey: 'K' }, 'theme=dark; session=K'),
  ]),
]


// HEADER: the credential is the declared `x-api-key` header.
const headerKeep = { accept: 'application/json', session: 'unrelated-header' }
const headerQuery = { session: 'unrelated-query' }
const headerStep = (options: any, cred: Record<string, string>): AuthStep =>
  ({ options, headers: { ...headerKeep, ...cred }, query: { ...headerQuery } })

const HEADER_CASES: AuthCase[] = [
  {
    name: 'a run-time name replaces the declared header',
    headers: { ...headerKeep, 'x-api-key': 'Bearer OLD' },
    query: { ...headerQuery },
    steps: [
      headerStep({ auth: renamed('Authorization'), apikey: 'K' }, { authorization: 'Bearer K' }),
      headerStep({ auth: renamed('Authorization'), apikey: 'K' }, { authorization: 'Bearer K' }),
      headerStep({ auth: renamed('Authorization'), apikey: '' }, {}),
      headerStep({ auth, apikey: 'K' }, { 'x-api-key': 'Bearer K' }),
      headerStep({ auth: renamed('X-API-KEY'), apikey: 'K' }, { 'x-api-key': 'Bearer K' }),
      headerStep({ auth: renamed(''), apikey: 'K' }, { 'x-api-key': 'Bearer K' }),
      headerStep({ auth: { prefix: '', basic: false, name: 'Authorization' }, apikey: 'K' },
        { authorization: 'K' }),
      headerStep({ auth: renamed('Authorization'), apikey: null }, {}),
      headerStep({ auth: null, apikey: 'K' }, {}),
    ],
  },
  {
    name: 'a run-time name drops the declared header when no key is set',
    headers: { ...headerKeep, 'x-api-key': 'Bearer OLD' },
    query: { ...headerQuery },
    steps: [
      headerStep({ auth: renamed('Authorization') }, {}),
    ],
  },
]


// QUERY: the credential is the declared `api_key` query parameter.
const queryHeaders = { accept: 'application/json', api_key: 'unrelated-header' }
const queryStep = (options: any, cred: Record<string, string>): AuthStep =>
  ({ options, headers: { ...queryHeaders }, query: { page: '2', ...cred } })

const QUERY_CASES: AuthCase[] = [
  {
    name: 'a run-time name replaces the declared parameter',
    headers: { ...queryHeaders },
    query: { api_key: 'OLD', page: '2' },
    steps: [
      queryStep({ auth: renamed('key'), apikey: 'K' }, { key: 'K' }),
      queryStep({ auth: renamed('key'), apikey: 'K' }, { key: 'K' }),
      queryStep({ auth: renamed('key'), apikey: '' }, {}),
      queryStep({ auth, apikey: 'K' }, { api_key: 'K' }),
      queryStep({ auth: renamed('API_KEY'), apikey: 'K' }, { API_KEY: 'K' }),
      queryStep({ auth: renamed('API_KEY'), apikey: null }, {}),
      queryStep({ auth: renamed(''), apikey: 'K' }, { api_key: 'K' }),
      queryStep({ auth: null, apikey: 'K' }, {}),
    ],
  },
]


const AUTH_MODELS: AuthModel[] = [
  {
    name: 'cookie',
    extra: "main: kit: config: auth: { active: true, in: cookie, name: session, prefix: '' }",
    cases: COOKIE_CASES,
  },
  {
    name: 'header',
    extra: "main: kit: config: auth: { active: true, in: header, name: 'X-Api-Key', prefix: 'Bearer' }",
    cases: HEADER_CASES,
  },
  {
    name: 'query',
    extra: "main: kit: config: auth: { active: true, in: query, name: api_key, prefix: '' }",
    cases: QUERY_CASES,
  },
]


const AUTH_PROBES: Record<string, string> = {
  node: String.raw`
const { deepStrictEqual, strictEqual } = require('node:assert')
const cases = require('./auth-cases.json')
const { prepareAuth } = require('./PREPARE_AUTH')
const struct = require('@voxgig/struct')
for (const c of cases) {
  const spec = { headers: c.headers, query: c.query }
  for (const s of c.steps) {
    const ctx = { spec, utility: { struct }, client: { options: () => s.options } }
    strictEqual(prepareAuth(ctx), spec, c.name)
    deepStrictEqual(spec.headers, s.headers, c.name)
    deepStrictEqual(spec.query, s.query, c.name)
  }
}
console.log('auth-probe: ran ' + cases.length + ' cases')
`,
  py: String.raw`
import json
from types import SimpleNamespace
from demo_sdk.utility.prepare_auth import prepare_auth_util

with open('auth-cases.json') as f:
    cases = json.load(f)
for c in cases:
    spec = SimpleNamespace(headers=c['headers'], query=c['query'])
    for s in c['steps']:
        opts = s['options']
        ctx = SimpleNamespace(spec=spec, client=SimpleNamespace(options_map=lambda opts=opts: opts))
        result, err = prepare_auth_util(ctx)
        assert err is None and result is spec, c['name']
        assert spec.headers == s['headers'], (c['name'], spec.headers, s['headers'])
        assert spec.query == s['query'], (c['name'], spec.query, s['query'])
print('auth-probe: ran %d cases' % len(cases))
`,
  rb: String.raw`
require 'json'
require_relative 'utility/prepare_auth'
ProbeSpec = Struct.new(:headers, :query)
ProbeClient = Struct.new(:options_map)
ProbeCtx = Struct.new(:spec, :client)
cases = JSON.parse(File.read('auth-cases.json'))
cases.each do |c|
  spec = ProbeSpec.new(c['headers'], c['query'])
  c['steps'].each do |s|
    ctx = ProbeCtx.new(spec, ProbeClient.new(s['options']))
    result, err = DemoUtilities::PrepareAuth.call(ctx)
    raise c['name'] unless err.nil? && result.equal?(spec)
    raise "#{c['name']}: #{spec.headers.inspect}" unless spec.headers == s['headers']
    raise "#{c['name']}: #{spec.query.inspect}" unless spec.query == s['query']
  end
end
puts "auth-probe: ran #{cases.length} cases"
`,
  php: String.raw`<?php
require_once __DIR__ . '/demo_sdk.php';
$cases = json_decode(file_get_contents('auth-cases.json'), true, 512, JSON_THROW_ON_ERROR);
foreach ($cases as $c) {
    $spec = new DemoSpec(['headers' => $c['headers'], 'query' => $c['query']]);
    foreach ($c['steps'] as $s) {
        $client = new class($s['options']) {
            public function __construct(private array $opts) {}
            public function options_map(): array { return $this->opts; }
        };
        $ctx = new DemoContext(['spec' => $spec, 'client' => $client]);
        [$result, $err] = DemoPrepareAuth::call($ctx);
        if ($err !== null || $result !== $spec || $spec->headers != $s['headers']
            || $spec->query != $s['query']) {
            throw new Exception($c['name'] . ': ' . json_encode([$spec->headers, $spec->query]));
        }
    }
}
echo 'auth-probe: ran ' . count($cases) . " cases\n";
`,
  perl: String.raw`
use strict;
use warnings;
use JSON::PP;
require './utility/prepare_auth.pm';
{ package AuthProbeClient; sub options_map { $_[0]->{opts} } }
open my $fh, '<', 'auth-cases.json' or die $!;
my $cases = decode_json(do { local $/; <$fh> });
my $json = JSON::PP->new->canonical;
for my $c (@$cases) {
  my $spec = { headers => $c->{headers}, query => $c->{query} };
  for my $s (@{$c->{steps}}) {
    my $client = bless { opts => $s->{options} }, 'AuthProbeClient';
    my ($result, $err) = $DemoUtilities::REGISTRY{prepare_auth}->({ spec => $spec, client => $client });
    die $c->{name} if defined $err || $result != $spec;
    for my $bag (qw(headers query)) {
      die "$c->{name}: $bag " . $json->encode($spec->{$bag})
        unless $json->encode($spec->{$bag}) eq $json->encode($s->{$bag});
    }
  }
}
print 'auth-probe: ran ' . scalar(@$cases) . " cases\n";
`,
  go: String.raw`package sdktest

import (
  "encoding/json"
  "os"
  "reflect"
  "testing"
  sdk "GOMODULE"
)

func TestAuthProbe(t *testing.T) {
  data, err := os.ReadFile("../auth-cases.json")
  if err != nil { t.Fatal(err) }
  var cases []struct {
    Name string
    Headers map[string]any
    Query map[string]any
    Steps []struct { Options map[string]any; Headers map[string]any; Query map[string]any }
  }
  if err := json.Unmarshal(data, &cases); err != nil { t.Fatal(err) }
  for _, c := range cases {
    spec := sdk.NewSpec(map[string]any{"headers": c.Headers, "query": c.Query})
    for _, s := range c.Steps {
      client := sdk.NewDemoSDK(s.Options)
      utility := client.GetUtility()
      ctx := sdk.NewContext(map[string]any{"client": client, "spec": spec}, nil)
      result, err := utility.PrepareAuth(ctx)
      if err != nil || result != spec || !reflect.DeepEqual(spec.Headers, s.Headers) ||
        !reflect.DeepEqual(spec.Query, s.Query) {
        t.Fatalf("%s: %v, %v, %v", c.Name, spec.Headers, spec.Query, err)
      }
    }
  }
  t.Logf("auth-probe: ran %d cases", len(cases))
}
`,
  java: String.raw`
import java.nio.file.*;
import java.util.*;
import voxgig.demosdk.core.*;
import voxgig.demosdk.utility.Json;

public class AuthProbe {
  @SuppressWarnings("unchecked")
  public static void main(String[] args) throws Exception {
    var cases = (List<Map<String, Object>>) Json.parse(Files.readString(Path.of("auth-cases.json")));
    for (var c : cases) {
      var spec = new Spec(Map.of("headers", c.get("headers"), "query", c.get("query")));
      for (var s : (List<Map<String, Object>>) c.get("steps")) {
        var client = new DemoSDK((Map<String, Object>) s.get("options"));
        var ctx = new Context(Map.of("client", client, "spec", spec), null);
        var result = client.getUtility().prepareAuth.apply(ctx);
        if (result != spec || !spec.headers.equals(s.get("headers")) ||
            !spec.query.equals(s.get("query"))) {
          throw new AssertionError(c.get("name") + ": " + spec.headers + " " + spec.query);
        }
      }
    }
    System.out.println("auth-probe: ran " + cases.size() + " cases");
  }
}
`,
  rust: String.raw`
use std::{cell::RefCell, rc::Rc};
use demo_sdk::{Context, CtxSpec, Spec, json_parse};
use demo_sdk::core::helpers::{getp, jo};
use demo_sdk::utility::{prepare_auth::prepare_auth_util, voxgigstruct::Value};

#[test]
fn auth_probe() {
    let data = json_parse(&std::fs::read_to_string("auth-cases.json").unwrap()).unwrap();
    let Value::List(cases) = data else { panic!("expected cases") };
    for c in cases.borrow().iter() {
        let spec = Rc::new(RefCell::new(Spec::new(&jo(vec![
            ("headers", getp(c, "headers")), ("query", getp(c, "query")),
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
            assert_eq!(spec.borrow().query, getp(s, "query"), "{:?}", getp(c, "name"));
        }
    }
    println!("auth-probe: ran {} cases", cases.borrow().len());
}
`,
  c: String.raw`
#include "sdk.h"
#include <stdio.h>
#include <string.h>

int main(void) {
  voxgig_value* data = voxgig_parse_json_file("auth-cases.json");
  if (!data || !voxgig_is_list(data)) return 1;
  voxgig_list* cases = voxgig_as_list(data);
  for (size_t i = 0; i < voxgig_list_len(cases); i++) {
    voxgig_value* c = voxgig_list_get(cases, i);
    Spec* spec = spec_new(cmap(2, "headers", getp(c, "headers"), "query", getp(c, "query")));
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
          !voxgig_equals(spec->query, getp(s, "query"))) {
        fprintf(stderr, "auth-probe failed: %s (step %zu)\n", get_str(c, "name"), j);
        return 1;
      }
    }
  }
  printf("auth-probe: ran %zu cases\n", voxgig_list_len(cases));
  fflush(stdout);
  return 0;
}
`,
  cpp: String.raw`
#include <fstream>
#include <iostream>
#include <sstream>

#include "harness.hpp"

using namespace sdk;

// Map equality in this port is order-sensitive; a bag is compared by key.
static bool same(const Value& actual, const Value& expected) {
  if (!actual.is_map() || !expected.is_map()) return actual == expected;
  if (actual.as_map()->size() != expected.as_map()->size()) return false;
  for (const auto& kv : *expected.as_map()) {
    if (!(getp(actual, kv.first) == kv.second)) return false;
  }
  return true;
}

int main() {
  std::ifstream in("auth-cases.json");
  std::stringstream text;
  text << in.rdbuf();
  Value cases = vs::parse_json(text.str());
  if (!cases.is_list()) return 1;
  size_t ran = 0;
  for (const auto& c : *cases.as_list()) {
    SpecPtr spec = std::make_shared<Spec>(vmap({
      {"headers", getp(c, "headers")}, {"query", getp(c, "query")}, {"step", Value("s")}}));
    size_t at = 0;
    for (const auto& s : *getp(c, "steps").as_list()) {
      auto client = DemoSDK::testSDK(Value::undef(), getp(s, "options"));
      UtilityPtr utility = client->getUtility();
      CtxSpec cs;
      cs.setOpname("load");
      cs.client = client.get();
      cs.utility = utility;
      CtxPtr ctx = utility->makeContext(cs, client->getRootCtx());
      ctx->spec = spec;
      SpecPtr result = utility->prepareAuth(ctx);
      if (result != spec || !same(spec->headers, getp(s, "headers")) ||
          !same(spec->query, getp(s, "query"))) {
        std::cerr << "auth-probe failed: " << as_str(getp(c, "name")) << " (step " << at << ")\n";
        return 1;
      }
      at++;
    }
    ran++;
  }
  std::cout << "auth-probe: ran " << ran << " cases\n";
  return 0;
}
`,
  kotlin: String.raw`package voxgig.demosdk.sdktest

import java.io.File

import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

import voxgig.demosdk.core.DemoSDK
import voxgig.demosdk.core.Spec
import voxgig.demosdk.utility.Json

class AuthProbe {

  @Suppress("UNCHECKED_CAST")
  @Test
  fun authProbe() {
    val cases = Json.parse(File("auth-cases.json").readText()) as List<Map<String, Any?>>
    for (c in cases) {
      val spec = Spec(linkedMapOf<String, Any?>("headers" to c["headers"], "query" to c["query"]))
      for (s in c["steps"] as List<Map<String, Any?>>) {
        val client = DemoSDK.testSDK(null, s["options"] as MutableMap<String, Any?>)
        val utility = client.getUtility()
        val ctxmap = linkedMapOf<String, Any?>("opname" to "load", "client" to client, "utility" to utility)
        val ctx = utility.makeContext(ctxmap, client.getRootCtx())
        ctx.spec = spec
        val result = utility.prepareAuth(ctx)
        assertTrue(result === spec && spec.headers == s["headers"] && spec.query == s["query"],
          c["name"].toString() + ": " + spec.headers + " " + spec.query)
      }
    }
    println("auth-probe: ran " + cases.size + " cases")
  }
}
`,
  csharp: String.raw`
using DemoSdk;
using System.Text.Json;

public static class AuthProbe
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

    static bool Same(Dictionary<string, object?> actual, Dictionary<string, object?> expected) =>
        actual.Count == expected.Count &&
        expected.All(p => actual.TryGetValue(p.Key, out var v) && Equals(v, p.Value));

    public static void Main()
    {
        using var fixture = JsonDocument.Parse(File.ReadAllText("auth-cases.json"));
        var cases = (List<object?>)Value(fixture.RootElement)!;
        foreach (var c in cases.Cast<Dictionary<string, object?>>())
        {
            var spec = new Spec(new() { ["headers"] = c["headers"], ["query"] = c["query"] });
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
                if (!ReferenceEquals(result, spec) ||
                    !Same(spec.Headers, (Dictionary<string, object?>)s["headers"]!) ||
                    !Same(spec.Query, (Dictionary<string, object?>)s["query"]!))
                    throw new Exception((string)c["name"]!);
            }
        }
        Console.WriteLine($"auth-probe: ran {cases.Count} cases");
    }
}
`,
}


export { AUTH_MODELS, AUTH_PROBES }
export type { AuthCase, AuthModel }
