// A list whose response transform yields something other than a list, driven
// through a generated SDK over a live transport: a page envelope the transform
// did not unwrap, or a scalar. Only a list holds records, as ts's makeResult
// reads them; an object or a string makes no entity.

type EnvelopeCase = {
  name: string
  status: number
  type: string | null
  body: string
  readable: boolean
}

const ENVELOPE_CASES: EnvelopeCase[] = [
  { name: 'envelope', status: 200, type: 'application/json', readable: true,
    body: '{"page":1,"page_count":240,"page_size":1,"result_count":240,"results":[{"id":"x01"}]}' },
  { name: 'string', status: 200, type: 'application/json', readable: true, body: '"x01"' },
  { name: 'list', status: 200, type: 'application/json', readable: true,
    body: '[{"id":"x01"},{"id":"x02"}]' },
]

// How many entities each case's list makes.
const ENVELOPE_EXPECT: Record<string, string> = { envelope: '0', string: '0', list: '2' }

// A probe prints `envelope-probe: <case>: <count>` for each case, or the error
// in place of the count.
function envelopeCounts(out: string): Record<string, string> {
  const found: Record<string, string> = {}
  for (const m of out.matchAll(/envelope-probe: ([a-z]+): ([^\r\n]*)/g)) {
    found[m[1]] = m[2].trim()
  }
  return found
}


const NODE_PROBE = `
const cases = require(process.env.ENVELOPE_CASES)
const { SDK } = require('SDK_MODULE')

;(async () => {
  for (let i = 0; i < cases.length; i++) {
    const client = new SDK({ base: process.env.ENVELOPE_BASE + '/c' + i })
    try {
      const listed = await client.Cat().list({})
      console.log('envelope-probe: ' + cases[i].name + ': ' + listed.length)
    }
    catch (err) {
      console.log('envelope-probe: ' + cases[i].name + ': ' + err.message)
    }
  }
})()
`


const GO_PROBE = String.raw`package sdktest

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"

	sdk "GOMODULE"
)

type envelopeCase struct {
	Name string ` + '`json:"name"`' + String.raw`
}

func TestEnvelopeProbe(t *testing.T) {
	raw, err := os.ReadFile(os.Getenv("ENVELOPE_CASES"))
	if err != nil {
		t.Fatal(err)
	}
	var cases []envelopeCase
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	for i, c := range cases {
		client := sdk.NewDemoSDK(map[string]any{"base": fmt.Sprintf("%s/c%d", os.Getenv("ENVELOPE_BASE"), i)})
		res, err := client.Cat(nil).List(map[string]any{}, nil)
		if err != nil {
			fmt.Printf("envelope-probe: %s: %v\n", c.Name, err)
			continue
		}
		list, _ := res.([]any)
		fmt.Printf("envelope-probe: %s: %d\n", c.Name, len(list))
	}
}
`


const PY_PROBE = String.raw`
import json
import os
from demo_sdk import DemoSDK

cases = json.load(open(os.environ['ENVELOPE_CASES']))
for i, c in enumerate(cases):
    client = DemoSDK({'base': '%s/c%d' % (os.environ['ENVELOPE_BASE'], i)})
    try:
        listed = client.Cat().list({})
        print('envelope-probe: %s: %d' % (c['name'], len(listed)))
    except Exception as e:
        print('envelope-probe: %s: %s' % (c['name'], e))
`


const RB_PROBE = String.raw`
require 'json'
require_relative 'Demo_sdk'

cases = JSON.parse(File.read(ENV['ENVELOPE_CASES']))
cases.each_with_index do |c, i|
  client = DemoSDK.new({ 'base' => "#{ENV['ENVELOPE_BASE']}/c#{i}" })
  begin
    listed = client.Cat.list({})
    puts "envelope-probe: #{c['name']}: #{listed.length}"
  rescue StandardError => e
    puts "envelope-probe: #{c['name']}: #{e.message}"
  end
end
`


const PHP_PROBE = String.raw`<?php
require_once __DIR__ . '/demo_sdk.php';

$cases = json_decode(file_get_contents(getenv('ENVELOPE_CASES')), true);
foreach ($cases as $i => $c) {
    $client = new DemoSDK(['base' => getenv('ENVELOPE_BASE') . '/c' . $i]);
    try {
        $listed = $client->Cat()->list([]);
        echo 'envelope-probe: ' . $c['name'] . ': ' . count($listed) . "\n";
    } catch (Throwable $e) {
        echo 'envelope-probe: ' . $c['name'] . ': ' . $e->getMessage() . "\n";
    }
}
`


const PERL_PROBE = String.raw`
use strict;
use warnings;
use lib 'lib';
use DemoSDK;
use JSON::PP ();

open(my $fh, '<', $ENV{ENVELOPE_CASES}) or die "cases: $!";
my $cases = JSON::PP::decode_json(do { local $/; <$fh> });
my $i = 0;
for my $c (@$cases) {
  my $client = DemoSDK->new({ base => "$ENV{ENVELOPE_BASE}/c$i" });
  my $listed = eval { $client->Cat->list({}) };
  if (defined $listed) {
    print "envelope-probe: $c->{name}: " . scalar(@$listed) . "\n";
  }
  else {
    print "envelope-probe: $c->{name}: $@\n";
  }
  $i++;
}
`


const LUA_PROBE = String.raw`
local sdk = require("demo_sdk")
local json = require("dkjson")

local f = io.open(os.getenv("ENVELOPE_CASES"))
local cases = json.decode(f:read("a"))
f:close()
for i, c in ipairs(cases) do
  local client = sdk.new({ base = os.getenv("ENVELOPE_BASE") .. "/c" .. (i - 1) })
  local ok, listed, err = pcall(function() local ent = client:Cat(); return ent:list({}) end)
  if not ok or err ~= nil then
    local e = ok and err or listed
    print("envelope-probe: " .. c.name .. ": " .. tostring(type(e) == "table" and e.msg or e))
  else
    print("envelope-probe: " .. c.name .. ": " .. tostring(#listed))
  end
end
`


const ENVELOPE_PROBES: Record<string, string> = {
  node: NODE_PROBE,
  go: GO_PROBE,
  py: PY_PROBE,
  rb: RB_PROBE,
  php: PHP_PROBE,
  perl: PERL_PROBE,
  lua: LUA_PROBE,
}


export type { EnvelopeCase }

export {
  ENVELOPE_CASES,
  ENVELOPE_EXPECT,
  ENVELOPE_PROBES,
  envelopeCounts,
}
