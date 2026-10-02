
import { test, describe } from 'node:test'
import { deepStrictEqual, strictEqual, ok } from 'node:assert'

import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import { spawnSync } from 'node:child_process'

import { isElixirReservedType, elixirSafeTypeName } from '../dist/sdkgen.js'


// Each fails `@type <name> :: ...`: a built-in type cannot be redefined, `nil`
// is not a type name, and a reserved word does not parse. `mfa` is SMSAPI's.
const BUILTIN = [
  'any', 'arity', 'atom', 'binary', 'bitstring', 'bool', 'boolean', 'byte',
  'char', 'charlist', 'dynamic', 'float', 'function', 'identifier', 'integer',
  'iodata', 'iolist', 'keyword', 'list', 'map', 'maybe_improper_list', 'mfa',
  'module', 'neg_integer', 'no_return', 'node', 'non_neg_integer', 'none',
  'nonempty_binary', 'nonempty_bitstring', 'nonempty_charlist',
  'nonempty_list', 'nonempty_maybe_improper_list', 'nonempty_string',
  'number', 'pid', 'port', 'pos_integer', 'reference', 'string', 'struct',
  'term', 'timeout', 'tuple', 'var',
]

const RESERVED = [
  'after', 'and', 'catch', 'do', 'else', 'end', 'false', 'fn', 'in', 'nil',
  'not', 'or', 'rescue', 'true', 'when',
]

// Compiles, with a warning that it overrides the built-in.
const OVERRIDES = ['record']

// Legal type names, some of them close to the guarded ones.
const ORDINARY = [
  'planet', 'fun', 'case', 'cond', 't', 'optional', 'as_boolean',
  'nonempty_improper_list', 'mfa_code', 'node_pool', 'record_set', 'lists',
]

const GUARDED = BUILTIN.concat(RESERVED, OVERRIDES)


function toolchain(name: string): string | null {
  const probe = 'win32' === process.platform
    ? spawnSync('where', [name], { encoding: 'utf8' })
    : spawnSync('/usr/bin/which', [name], { encoding: 'utf8' })
  const found = String(probe.stdout || '').trim().split(/\r?\n/)[0]
  return 0 === probe.status && '' !== found ? found : null
}


describe('elixir type name guard', () => {

  test('a built-in or reserved name gains _type', () => {
    deepStrictEqual(GUARDED.filter((n) => !isElixirReservedType(n)), [])
    for (const n of GUARDED) {
      strictEqual(elixirSafeTypeName(n), n + '_type')
    }
  })


  test('any other name is untouched', () => {
    for (const n of ORDINARY) {
      strictEqual(elixirSafeTypeName(n), n)
    }
  })


  // The re-derivation half: Erlang's own table of zero-arity built-ins, read
  // from the abstract code of `erl_internal:is_type/2`.
  test('the guard covers every zero-arity built-in Erlang declares', (t) => {
    const erl = toolchain('erl')
    if (null == erl) {
      return t.skip('no erl here: the built-in table cannot be read')
    }

    const ran = spawnSync(erl, ['-noshell', '-eval',
      '{ok,{_,[{abstract_code,{raw_abstract_v1,Forms}}]}} = ' +
      'beam_lib:chunks(code:which(erl_internal),[abstract_code]), ' +
      '[io:format("~s~n",[N]) || {function,_,is_type,2,Cs} <- Forms, ' +
      '{clause,_,[{atom,_,N},{integer,_,0}],_,_} <- Cs], halt().'],
    { encoding: 'utf8', timeout: 60000 })

    const names = String(ran.stdout || '').split(/\s+/).filter((n) => '' !== n)
    if (0 !== ran.status || 0 === names.length) {
      return t.skip('erl_internal carries no abstract code here: ' +
        String(ran.stderr || ran.stdout).slice(0, 200))
    }

    ok(names.includes('mfa'), 'the table read is not the built-in table')
    deepStrictEqual(names.filter((n) => !isElixirReservedType(n)), [],
      'Erlang declares built-in types the elixir guard does not list')
  })


  test('each guarded name fails as a type and its _type form compiles', (t) => {
    const elixir = toolchain('elixir')
    if (null == elixir) {
      return t.skip('no elixir here: the names cannot be compiled')
    }

    const tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'sdkgen-elixir-types-'))
    try {
      const script = Path.join(tmp, 'probe.exs')
      Fs.writeFileSync(script, PROBE)

      const ran = spawnSync(elixir, [script, ...GUARDED, ...ORDINARY], {
        encoding: 'utf8', timeout: 5 * 60 * 1000,
        env: { ...process.env, ELIXIR_ERL_OPTIONS: '+fnu' },
      })
      const out = String(ran.stdout || '')
      if (out.includes('SKIP')) {
        return t.skip('elixir here has no Code.with_diagnostics/1')
      }
      strictEqual(ran.status, 0, 'probe failed:\n' + out + ran.stderr)

      const seen: Record<string, string> = {}
      for (const line of out.split(/\r?\n/)) {
        const [name, bad, good] = line.trim().split(/\s+/)
        if (null != good) seen[name] = bad + ' ' + good
      }

      for (const n of BUILTIN.concat(RESERVED)) {
        strictEqual(seen[n], 'error ok', n)
      }
      for (const n of OVERRIDES) {
        strictEqual(seen[n], 'warning ok', n)
      }
      for (const n of ORDINARY) {
        ok(seen[n]?.startsWith('ok '), n + ' should compile as a type: ' + seen[n])
      }
    }
    finally {
      Fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

})


const PROBE = `
if not function_exported?(Code, :with_diagnostics, 1) do
  IO.puts("SKIP")
  System.halt(0)
end

compile = fn src ->
  {res, diags} =
    Code.with_diagnostics(fn ->
      try do
        Code.compile_string(src)
        :ok
      rescue
        _ -> :error
      end
    end)

  cond do
    :error == res -> "error"
    Enum.any?(diags, &(&1.severity == :warning)) -> "warning"
    true -> "ok"
  end
end

System.argv()
|> Enum.with_index()
|> Enum.each(fn {name, i} ->
  bad = compile.("defmodule ElixirTypeProbeA#{i} do\\n  @type #{name} :: term()\\nend\\n")
  good = compile.("defmodule ElixirTypeProbeB#{i} do\\n  @type #{name}_type :: term()\\nend\\n")
  IO.puts("#{name} #{bad} #{good}")
end)
`
