// A syntax provider declares facts about its runtime (RuntimeFacts). They are
// facts about the target's own templates, not the model, so they are checked
// against those templates: every declared operation method and the record
// accessor must be declared there, and the result style must match the
// operation's signature. A hand-written table that drifts fails here.

import { describe, test } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'
import * as Fs from 'node:fs'
import * as Path from 'node:path'


const STAGE = Path.resolve(__dirname, '..', 'dist-test-scaffold', '.sdk', 'dist', 'cmp')
const SCAFFOLD = Path.resolve(__dirname, '..', 'project', '.sdk')

const PROVIDERS = Fs.readdirSync(STAGE)
  .filter((t: string) => Fs.existsSync(Path.join(STAGE, t, 'Syntax_' + t + '.js')))
  .sort()

// The runtime source a target's entity operations are declared in.
function runtimeSource(t: string): string {
  const dirs = [Path.join(SCAFFOLD, 'src', 'cmp', t, 'fragment'), Path.join(SCAFFOLD, 'tm', t, 'core'),
    Path.join(SCAFFOLD, 'tm', t, 'src')]
  const text: string[] = []
  for (const d of dirs) {
    if (!Fs.existsSync(d)) continue
    for (const f of Fs.readdirSync(d)) {
      const p = Path.join(d, f)
      if (Fs.statSync(p).isFile()) text.push(Fs.readFileSync(p, 'utf8'))
    }
  }
  return text.join('\n')
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// A method declared in any of the languages' forms.
function declares(src: string, m: string): boolean {
  return new RegExp('(^\\s+|async\\s+|func \\(\\w+ \\*?\\w+\\)\\s+|def\\s+|(pub )?fn\\s+|\\(defn-?\\s+|\\(\\*|:)' + esc(m) + '\\b', 'm').test(src)
}

// The name the record accessor calls: `.data()` -> data, `vt->data` -> data,
// `((:data-get entity))` -> data-get.
function accessorName(record: string): string {
  const prefixed = [...record.matchAll(/(?:->|\.|:)([A-Za-z_][\w-]*)/g)]
  if (0 < prefixed.length) return prefixed[prefixed.length - 1][1]
  const lead = /^([A-Za-z_]\w*)/.exec(record)
  return lead ? lead[1] : record
}


// What the operation signature shows for each result style.
const STYLE: Record<string, (src: string, load: string) => boolean> = {
  throw: (src, load) => new RegExp('async\\s+' + esc(load) + '\\(').test(src),
  raise: (src, load) => new RegExp('def\\s+' + esc(load) + '\\(|\\(defn\\s+' + esc(load) + '\\b').test(src),
  pair: (src, load) => new RegExp(esc(load) + '\\([^)]*\\)\\s*\\(any, error\\)').test(src),
  errslot: (src, load) => new RegExp('\\(\\*' + esc(load) + '\\)\\([^)]*PNError\\*\\* err\\)').test(src),
  // zig: `pub fn load(...) EntResult`; rust: `fn load(...) -> Result<..>`.
  union: (src, load) => new RegExp('(pub )?fn ' + esc(load) + '\\([^)]*\\)\\s+(->\\s*)?\\w*Result\\b').test(src),
}


// The generator components that write fixed members into the runtime (the
// entity accessor, go's Test()), beside the templates and fragments.
function generatorSource(t: string): string {
  const dir = Path.join(SCAFFOLD, 'src', 'cmp', t)
  return Fs.readdirSync(dir)
    .filter((f: string) => /^(Main|MainEntity|EntityBase|Entity)_/.test(f) && f.endsWith('.ts'))
    .map((f: string) => Fs.readFileSync(Path.join(dir, f), 'utf8')).join('\n')
}

// The function a declared signature names: `vt->data(...)` -> data,
// `{var}_stream(...)` -> any `<ident>_stream`, `{client}.test(...)` -> test.
function memberPattern(sig: string): RegExp | null {
  // Only a receiver ahead of the first parenthesis is stripped, so a return
  // type such as `String.t()` is not read as the member's name.
  const m = /([\w{}]+)\s*\(/.exec(sig.replace(/^[^(]*?(->|\.)(?=[\w{}]+\s*\()/, ''))
  if (null == m || /^\{(accessor|ctor)\}$/.test(m[1])) return null
  const name = esc(m[1]).replace(/\\\{var\\\}|\\\{\w+\\\}/g, '\\w+')
  return new RegExp('(\\b|\\(\\*)' + name + '\\)?\\s*\\(')
}

// A fixed member a runtime may define, by kind: if the runtime defines it,
// the table must declare it, so the reference cannot fall behind the runtime.
const PRESENT: Record<string, RegExp> = {
  stream: /(async \*stream|\) Stream|def stream|\w+_stream|fn stream)\s*\(/,
  client: /^\s+client\(\)\s*\{|def client\(|\) Client\(\)/m,
  entopts: /^\s+entopts\(\)\s*\{|def entopts\(|\) Entopts\(/m,
  options: /^\s+options\(\)\s*\{|\) OptionsMap\(|def options_map\(|fn options_map\(/m,
  utility: /^\s+utility\(\)\s*\{|\) GetUtility\(|def get_utility\(|fn get_utility\(/m,
  make: /^\s+make\(|\) Make\(\)|def make\(|_make\(Entity|fn make\(&self\)/m,
  name: /getName\(|GetName\(|def get_name\(|\(\*get_name\)|fn get_name\(/,
}

const kindOf = (k: string): string => k.startsWith('stream') ? 'stream' : (k.startsWith('utility') ? 'utility' : k)


describe('runtimefacts', () => {

  test('every provider is checked', () => {
    ok(PROVIDERS.length >= 6, 'providers found: ' + PROVIDERS.join(' '))
  })

  for (const t of PROVIDERS) {
    test(t + ': the declared runtime facts are what its templates declare', () => {
      const { Syntax } = require(Path.join(STAGE, t, 'Syntax_' + t + '.js'))
      const f = Syntax.facts
      const src = runtimeSource(t)
      ok(src.length > 0, t + ': no runtime source found')

      const missing = Object.entries(f.method)
        .filter(([, m]) => !declares(src, m as string)).map(([op, m]) => op + ' -> ' + m)
      deepStrictEqual(missing, [], t + ': methods the facts table declares and the runtime does not')

      const acc = accessorName(f.record)
      ok(declares(src, acc), t + ': record accessor ' + acc + ' (from ' + f.record + ') is not declared')

      ok(STYLE[f.result](src, f.method.load), t + ': load is not declared in the ' + f.result + ' style')
    })

    test(t + ': the declared reference members are what its runtime defines', (tc) => {
      const { Syntax } = require(Path.join(STAGE, t, 'Syntax_' + t + '.js'))
      if (null == Syntax.ref) return tc.skip(t + ' declares no reference facts')
      const r = Syntax.ref.facts
      const src = runtimeSource(t) + '\n' + generatorSource(t)

      const sigs = [...r.client, ...r.entity].map((m: any) => m.sig)
        .concat(r.test.map((x: any) => x.sig), Object.values(r.op) as string[])
      const absent = sigs.filter((sig: string) => {
        const re = memberPattern(sig)
        return null != re && !re.test(src)
      })
      deepStrictEqual(absent, [], t + ': signatures the reference declares and the runtime does not define')

      const declared = [...r.client, ...r.entity].map((m: any) => kindOf(m.kind))
      const undeclared = Object.keys(PRESENT).filter((k) => PRESENT[k].test(src) && !declared.includes(k))
      deepStrictEqual(undeclared, [], t + ': members the runtime defines and the reference does not document')
    })
  }
})
