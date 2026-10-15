// PreUnexpected counted through a generated SDK in test mode: a feature added
// to the client counts each firing while one load of a missing record fails.
// Under `hook` the same feature raises in PreRequest, an error that never
// reaches makeError, so the operation's own catch path fires the hook.
const HOOK_KINDS = ['load', 'hook']

// Each probe prints `hook-probe: <kind> <count>`.
function hookCounts(out: string): Record<string, number> {
  const found: Record<string, number> = {}
  for (const m of out.matchAll(/hook-probe: ([a-z]+) (\d+)/g)) {
    found[m[1]] = Number(m[2])
  }
  return found
}


const NODE_PROBE = `
const { SDK } = require('SDK_MODULE')

;(async () => {
  for (const kind of ${JSON.stringify(HOOK_KINDS)}) {
    const client = SDK.test()
    let fired = 0
    client._features.push({
      name: 'hookprobe',
      PreRequest() { if ('hook' === kind) throw new Error('hook-probe raised') },
      PreUnexpected() { fired++ },
    })
    try { await client.Cat().load({ id: 'nope' }) } catch (e) { }
    console.log('hook-probe: ' + kind + ' ' + fired)
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

type hookProbe struct {
	sdk.BaseFeature
	raise bool
	fired int
}

func (f *hookProbe) PreRequest(ctx *sdk.Context) {
	if f.raise {
		panic(errors.New("hook-probe raised"))
	}
}

func (f *hookProbe) PreUnexpected(ctx *sdk.Context) { f.fired++ }

func TestHookProbe(t *testing.T) {
	for _, kind := range []string{"load", "hook"} {
		client := sdk.TestSDK(nil, nil)
		probe := &hookProbe{BaseFeature: *sdk.NewBaseFeature(), raise: "hook" == kind}
		client.Features = append(client.Features, probe)
		client.Cat(nil).Load(map[string]any{"id": "nope"}, nil)
		fmt.Printf("hook-probe: %s %d\n", kind, probe.fired)
	}
}
`


const PY_PROBE = String.raw`
from demo_sdk import DemoSDK


class HookProbe:
    def __init__(self, raise_hook):
        self.raise_hook = raise_hook
        self.fired = 0

    def PreRequest(self, ctx):
        if self.raise_hook:
            raise RuntimeError('hook-probe raised')

    def PreUnexpected(self, ctx):
        self.fired += 1


for kind in ['load', 'hook']:
    client = DemoSDK.test(None, None)
    probe = HookProbe('hook' == kind)
    client.features.append(probe)
    try:
        client.Cat(None).load({'id': 'nope'}, None)
    except Exception:
        pass
    print('hook-probe: %s %d' % (kind, probe.fired))
`


const RB_PROBE = String.raw`
require_relative 'Demo_sdk'

class HookProbe
  attr_reader :fired

  def initialize(raise_hook)
    @raise_hook = raise_hook
    @fired = 0
  end

  def PreRequest(_ctx)
    raise 'hook-probe raised' if @raise_hook
  end

  def PreUnexpected(_ctx)
    @fired += 1
  end
end

%w[load hook].each do |kind|
  client = DemoSDK.test(nil, nil)
  probe = HookProbe.new('hook' == kind)
  client.features << probe
  begin
    client.Cat(nil).load({ 'id' => 'nope' }, nil)
  rescue StandardError
    nil
  end
  puts "hook-probe: #{kind} #{probe.fired}"
end
`


const PHP_PROBE = String.raw`<?php
require_once __DIR__ . '/demo_sdk.php';

class HookProbe
{
    public int $fired = 0;

    public function __construct(private bool $raise_hook)
    {
    }

    public function PreRequest($ctx): void
    {
        if ($this->raise_hook) {
            throw new \RuntimeException('hook-probe raised');
        }
    }

    public function PreUnexpected($ctx): void
    {
        $this->fired++;
    }
}

foreach (['load', 'hook'] as $kind) {
    $client = DemoSDK::test(null, null);
    $probe = new HookProbe('hook' === $kind);
    $client->features[] = $probe;
    try {
        $client->Cat(null)->load(['id' => 'nope'], null);
    } catch (\Throwable $e) {
    }
    echo 'hook-probe: ' . $kind . ' ' . $probe->fired . "\n";
}
`


const PERL_PROBE = String.raw`
use strict;
use warnings;
use lib 'lib';
use DemoSDK;

package HookProbe;

sub new { my ($class, $raise) = @_; return bless { raise => $raise, fired => 0 }, $class }
sub PreRequest { my ($self) = @_; die "hook-probe raised\n" if $self->{raise}; return }
sub PreUnexpected { my ($self) = @_; $self->{fired}++; return }

package main;

for my $kind (qw(load hook)) {
  my $client = DemoSDK->test(undef, undef);
  my $probe = HookProbe->new('hook' eq $kind);
  push @{ $client->{features} }, $probe;
  eval { $client->Cat(undef)->load({ id => 'nope' }, undef); 1 };
  print 'hook-probe: ' . $kind . ' ' . $probe->{fired} . "\n";
}
`


const LUA_PROBE = String.raw`
local sdk = require("demo_sdk")

for _, kind in ipairs({ "load", "hook" }) do
  local client = sdk.test(nil, nil)
  local probe = { fired = 0 }
  function probe:PreRequest(ctx)
    if kind == "hook" then error("hook-probe raised", 0) end
  end
  function probe:PreUnexpected(ctx)
    self.fired = self.fired + 1
  end
  table.insert(client.features, probe)
  pcall(function() return client:Cat(nil):load({ id = "nope" }, nil) end)
  print("hook-probe: " .. kind .. " " .. probe.fired)
end
`


const ELIXIR_PROBE = String.raw`
defmodule Demo.HookProbeTest do
  use ExUnit.Case

  alias Voxgig.Struct, as: S

  test "hook probe" do
    for kind <- ["load", "hook"] do
      Process.put(:hook_probe, 0)
      sdk = Demo.test(nil, nil)

      probe =
        S.jm([
          "name", "hookprobe",
          "PreRequest", fn _ctx -> if kind == "hook", do: raise("hook-probe raised") end,
          "PreUnexpected", fn _ctx -> Process.put(:hook_probe, Process.get(:hook_probe) + 1) end
        ])

      S.setprop(sdk, "features", (S.getprop(sdk, "features") || []) ++ [probe])

      try do
        Demo.Entity.Cat.load(Demo.cat(sdk), S.jm(["id", "nope"]))
      rescue
        _ -> nil
      end

      IO.puts("hook-probe: #{kind} #{Process.get(:hook_probe)}")
    end
  end
end
`


const CLOJURE_PROBE = String.raw`
(require '[sdk.api :as api]
         '[voxgig.struct :as vs]
         '[sdk.entity.cat :as e-cat])

(doseq [kind ["load" "hook"]]
  (let [sdk (api/test-sdk nil nil)
        fired (atom 0)
        probe (atom {:name "hookprobe"
                     "PreRequest" (fn [_] (when (= "hook" kind) (throw (ex-info "hook-probe raised" {}))))
                     "PreUnexpected" (fn [_] (swap! fired inc))})]
    (swap! (:features sdk) conj probe)
    (try
      (e-cat/load (api/cat sdk nil) (vs/jm "id" "nope") nil)
      (catch Throwable _ nil))
    (println (str "hook-probe: " kind " " @fired))))
`


const OCAML_PROBE = String.raw`
open Voxgig_struct
open Sdk_types
open Sdk_helpers

let () =
  List.iter (fun kind ->
    let client = Sdk_client.test_with Noval Noval in
    let fired = ref 0 in
    let probe = {
      f_name = "hookprobe"; f_version = "0.0.1"; f_active = true; f_options = Noval;
      f_init = (fun _ _ -> ());
      f_hook = (fun name _ ->
        if name = "PreRequest" && kind = "hook" then failwith "hook-probe raised";
        if name = "PreUnexpected" then incr fired);
    } in
    client.cl_features <- client.cl_features @ [probe];
    (try ignore ((Sdk_client.cat client Noval).e_load (jo [("id", Str "nope")]) (empty_map ()))
     with _ -> ());
    Printf.printf "hook-probe: %s %d\n%!" kind !fired)
    ["load"; "hook"]
`


// The targets whose operation catch path fires PreUnexpected beside makeError,
// and go, which fires it in makeError alone. The rest fire it in makeError
// alone too: an error raised outside it is routed into it.
const HOOK_PROBES: Record<string, string> = {
  node: NODE_PROBE,
  go: GO_PROBE,
  py: PY_PROBE,
  rb: RB_PROBE,
  php: PHP_PROBE,
  perl: PERL_PROBE,
  lua: LUA_PROBE,
  elixir: ELIXIR_PROBE,
  clojure: CLOJURE_PROBE,
  ocaml: OCAML_PROBE,
}


export {
  HOOK_KINDS,
  HOOK_PROBES,
  hookCounts,
}
