// node recall.js [--review <dir>] [--json]
// Where, in the worklists ledger.js and blocks.js wrote WITHOUT being told
// where to look, each item the independent checkers found (stage2-worklists
// A and B) is flagged. Each item names the language, the worklist and a
// pattern that identifies the flagged class in it; the class line and the
// quoted unit are printed. An item with no pattern is a miss, with the reason.
const Fs = require('node:fs')
const Path = require('node:path')
const K = require('./common.js')
const a = K.args(process.argv.slice(2), { review: Path.join(__dirname, 'review') })

const I = [
  // ---- A, check-v2
  ['A.v2.1', 'zig create comment says "returns the created entity"', [['zig', 'tutorial.ledger', /^   \+ Create — returns the created entity/]]],
  ['A.v2.2', 'ts root quick start no longer names the class an op returns', [['ts', 'rootquick.ledger', /^   - List all planets \(returns PlanetEntity\[\]/], ['ts', 'rootquick.ledger', /^   - Load a specific satellite \(returns the entity, a SatelliteEntity\)/]]],
  ['A.v2.3', 'clojure prose names an unbound `entity`', [['clojure', 'tutorial.ledger', /`entity` appears in no code block/]]],
  ['A.v2.4', 'go create comment imprecise; pair fact only for List/Load; two comments in a row', [['go', 'tutorial.ledger', /^   \+ Create — returns the created entity/], ['go', 'tutorial.ledger', /^   - .*\(value, error\)|^   - .*returns? \(/]]],
  ['A.v2.5', 'go "The steps are one program, shown whole after them."', [['go', 'tutorial.ledger', /^   \+ The steps are one program/]]],
  ['A.v2.6', 'c err never reset after a failed list (root: if (loaded) became if (err))', [['c', 'rootquick.blocks', /^   [-+].*if \((loaded|err)\)/]], 'the change in the root is flagged as a changed block; that err is never reset is runtime semantics, the same in OLD\'s tutorial (identical there), so no comparison can call it a defect'],
  ['A.v2.7', 'ts README contradicts itself (region defaults vs Required; secret under query Basic)', [['ts', 'tutorial.ledger', /`region` at ts\/README\.md:\d+: .*\*\*Required\.\*\*/]], 'flagged by the echo check: the reworded sentence names `region`, which the unchanged options row of the same README still lists as Required. The secret half (query Basic) is not: the quick start drops `secret`, and a removal leaves no span to echo'],
  ['A.v2.8', 'ts "Create — returns the created entity" beside "resolves to"', [['ts', 'tutorial.ledger', /^   \+ Create — returns the created entity/]]],
  ['A.v2.9', 'zig and clojure blocks never compiled', [['zig', 'tutorial.blocks', /^\[/], ['clojure', 'tutorial.blocks', /^\[/]], 'flagged: blocks.js prints "changed N (UNVERIFIED: no zig here)" on its summary line'],
  // ---- A, check-ref
  ['A.ref.1', 'zig field Type cells all `any`', [['zig', 'reference.ledger', /^   \+ `any`$/]]],
  ['A.ref.2', 'example variables utilitys, historys, planet_entitys', [['ts', 'reference.blocks', /^   \+Ⓔ.*s: /], ['go', 'reference.blocks', /utilitys/], ['py', 'reference.blocks', /utilitys/], ['c', 'reference.blocks', /utilitys/], ['zig', 'reference.blocks', /utilitys/]]],
  ['A.ref.3', 'py direct() says `ok` is `false`', [['py', 'reference.ledger', /^   \+ On a failure `ok` is `false`/]]],
  ['A.ref.4', 'direct() result keys status/headers/data no longer stated (go py c zig)', [['py', 'reference.ledger', /^   - status/], ['c', 'reference.ledger', /`status`, `headers`|^   - status/], ['zig', 'reference.ledger', /^   - status/]], 'go: not reproducible; OLD go REFERENCE never states `status` (grep -c over 21 variations: 0 old, 0 new). py, c, zig: flagged'],
  ['A.ref.5', 'c/zig data()/matchv(): "When called without arguments"', [['c', 'reference.ledger', /^   \+ When called without arguments/], ['zig', 'reference.ledger', /^   \+ When called without arguments/]]],
  ['A.ref.6', 'ts Actions: Call column and $action example gone', [['ts', 'reference.ledger', /^   - `client\.Planet\(\)\.create\(\{ \$action/], ['ts', 'reference.ledger', /^   - Call$/]]],
  ['A.ref.7', 'REFERENCE says log runs unless disabled; README Features says every feature inactive', [['ts', 'reference.ledger', /except `log`, which runs unless disabled/]], 'the new sentence is flagged as reworded; the echo check does not connect it to README Features, which says "no logging" without a `log` code span'],
  ['A.ref.8', 'no-test: REFERENCE omits the test constructor the README uses', [['ts', 'reference.ledger', /^   - `test\(|^   - `tester\(/], ['c', 'reference.ledger', /^   - `.*test_sdk|^   - `.*test\(/]], 'the loss is flagged as missing units in no-test; the README still using it is another document'],
  ['A.ref.9', 'REFERENCE says region defaults to eu; README options table says Required', [['ts', 'reference.ledger', /^   \+ Defaults to `eu`\./], ['ts', 'reference.ledger', /`region` at ts\/README\.md:\d+: .*Required/]], 'flagged as added, and by the echo check against the README options row'],
  ['A.ref.10', 'py list signature optional while the sentence says the match must include planet_id', [['py', 'reference.ledger', /^   \+ The match must include `planet_id`/]], 'the new sentence is flagged as added; that the unchanged signature beside it says reqmatch=None is the reviewer\'s to see'],
  ['A.ref.11', 'zig stream lost the throw:false clause and "the branded error"', [['zig', 'reference.ledger', /^   - Under `throw: false`/], ['zig', 'reference.ledger', /^   - .*the branded error/]]],
  ['A.ref.12', 'go TestSDK example uses undefined variables (same in OLD)', [], 'identical in OLD and NEW: an old-vs-new comparison cannot see a defect both sides share'],
  ['A.ref.13', 'awkward load sentence (same in OLD)', [], 'identical in OLD and NEW'],
  // ---- B, check-v2
  ['B.v2.1', "zig 'Create — .ok carries the created entity'", [['zig', 'tutorial.ledger', /^   - Create — \.ok carries the created entity/]]],
  ['B.v2.2', 'zig: switch on list .ok', [['zig', 'tutorial.ledger', /`switch` on it/]]],
  ['B.v2.3', 'ts root: the entity class each op returns', [['ts', 'rootquick.ledger', /returns PlanetEntity\[\]/]]],
  ['B.v2.4', "ts tutorial: 'every operation resolves to entities, not raw records'; create '(.data() for the record)'", [['ts', 'tutorial.ledger', /^   - .*resolves? to entities|^   - .*not raw records/], ['ts', 'tutorial.ledger', /^   - Create.*\.data\(\)/]]],
  ['B.v2.5', "go: '(value, error)' for every op; write results no longer printed", [['go', 'tutorial.ledger', /value, error/], ['go', 'tutorial.blocks', /^   -.*fmt\.Println\(.*(updated|patched|created)/]]],
  ['B.v2.6', "py create comment '(call data_get() for the record)'", [['py', 'tutorial.ledger', /^   - Create.*data_get/]]],
  ['B.v2.7', 'clojure: the bound variable in the record accessor', [['clojure', 'tutorial.ledger', /^   - .*\(\(:data-get (planet|ambient|console)\)\)/]]],
  // ---- B, check-ref
  ['B.ref.1', 'ts options()/utility() Returns `object`', [['ts', 'reference.ledger', /^   - \*\*Returns:\*\* `object`/]]],
  ['B.ref.2', 'ts test(testopts, sdkopts) descriptions and Returns', [['ts', 'reference.ledger', /^   - Test feature options|^   - Additional SDK options merged/], ['ts', 'reference.ledger', /in test mode/]]],
  ['B.ref.3', "ts accessor parameter table and 'Returns: PlanetEntity instance'", [['ts', 'reference.ledger', /^   - Initial entity data/], ['ts', 'reference.ledger', /^   - \*\*Returns:\*\* `ⒺEntity` instance|^   - \*\*Returns:\*\* `\w+Entity` instance/]]],
  ['B.ref.4', 'ts custom action call', [['ts', 'reference.ledger', /\$action: 'terraform'/]]],
  ['B.ref.5', "update/patch comments '// Fields to update', '// Only the fields to change' (ts go py zig)", [['ts', 'reference.ledger', /^   - Fields to update/], ['go', 'reference.ledger', /^   - Fields to update/], ['py', 'reference.ledger', /^   - Fields to update/], ['zig', 'reference.ledger', /^   - Only the fields to change/]]],
  ['B.ref.6', 'go instance example GetName print', [['go', 'reference.blocks', /GetName/], ['go', 'reference.ledger', /^   - "(ambient|planet|console)"$/]]],
  ['B.ref.7', 'py direct() result dict keys and result["ok"]; prepare returns the fetchdef', [['py', 'reference.ledger', /result\["ok"\]/], ['py', 'reference.ledger', /^   - fetchdef/]]],
  ['B.ref.8', 'py `# str` type comments on create fields', [['py', 'reference.ledger', /^   - str$/]]],
  ['B.ref.9', 'c direct(): result keys, never sets *err, getp(result, "ok"); prepare returns the fetchdef', [['c', 'reference.ledger', /getp\(result, "ok"\)/], ['c', 'reference.ledger', /`status`, `headers`/]]],
  ['B.ref.10', "c vt->data/matchv 'Pass a map to set it'", [['c', 'reference.ledger', /^   - Pass a map to set it/]]],
  ['B.ref.11', 'c `// char*` type comments; the `if (result)` guard after load', [['c', 'reference.ledger', /^   - char\*/], ['c', 'reference.blocks', /^   -\s*if \(result\)/]]],
  ['B.ref.12', 'zig direct() map even on non-2xx; h.get_bool(result, "ok")', [['zig', 'reference.ledger', /h\.get_bool\(result, "ok"\)/]]],
  ['B.ref.13', 'zig StreamResult under throw:false; .err the branded error', [['zig', 'reference.ledger', /^   - Under `throw: false`/]]],
  ['B.ref.14', 'zig field types []const u8, f64, i64, Value (object)', [['zig', 'reference.ledger', /^   - `\[\]const u8`$/], ['zig', 'reference.ledger', /^   - `f64`$/], ['zig', 'reference.ledger', /^   - `Value \(object\)`$/]]],
  ['B.ref.15', "zig `// []const u8` type comments; data()/matchv() 'Pass a map to set it'", [['zig', 'reference.ledger', /^   - \[\]const u8$/], ['zig', 'reference.ledger', /^   - Pass a map to set it/]]],
  // ---- B, probe-ref (rust, elixir)
  ['B.pr.rust.1', 'rust direct envelope inside Ok: branch on getp(&result, "ok")', [['rust', 'reference.ledger', /getp\(&result, "ok"\)/]]],
  ['B.pr.rust.2', "rust data(Option<&Value>): 'Pass Some(&map) to set it'", [['rust', 'reference.ledger', /Some\(&map\)/]]],
  ['B.pr.rust.3', "rust stream returns Result<IntoIter..>; 'as one list' approximate", [['rust', 'reference.ledger', /^   \+ .*as one list/]]],
  ['B.pr.elixir.1', "elixir get_utility returns the live node ('Return the SDK utility node')", [['elixir', 'reference.ledger', /utility node|utility object itself/]]],
  ['B.pr.elixir.2', 'elixir arity naming list/2, load/2', [['elixir', 'tutorial.ledger', /`list\/2`|`load\/2`/]]],
  ['B.pr.elixir.3', "elixir 'Voxgig.Struct.getelem/2 reads an item'; 'Demo.Helpers.deep/1'", [['elixir', 'tutorial.ledger', /getelem/], ['elixir', 'reference.ledger', /deep\/1/]]],
  ['B.pr.elixir.4', 'elixir load passed H.deep(%{}) (unified to no argument)', [['elixir', 'tutorial.blocks', /(corrections applied|normalizers used \(pairs\)): .*unify:no-match-load/]], 'declared as the named unification unify:no-match-load (normalizers/elixir.js); blocks.js counts it on every pair it explains'],
]

function classes(text) {
  const out = []
  let cur = null
  for (const l of text.split('\n')) {
    if (/^\[[0-9a-f]{10}\]/.test(l)) { cur = { head: l, body: [] }; out.push(cur) } else if (cur && /^   /.test(l)) cur.body.push(l)
    else if (/^## /.test(l)) cur = null
  }
  return out
}

const res = []
let found = 0, partly = 0, missed = 0
for (const [id, what, probes, note] of I) {
  const hits = []
  for (const [lang, wl, re] of probes) {
    const f = Path.join(a.review, lang, wl.replace('.', '.') + '.txt')
    if (!Fs.existsSync(f)) { hits.push({ lang, wl, hit: null }); continue }
    const cs = classes(Fs.readFileSync(f, 'utf8'))
    const text = Fs.readFileSync(f, 'utf8')
    const hdr = text.split('\n').find((l) => /^# /.test(l) && re.test(l))
    const c = cs.find((c) => c.body.some((l) => re.test(l)) || re.test(c.head)) || (hdr ? { head: hdr, body: [] } : null)
    hits.push({ lang, wl, hit: c ? (c.head.slice(0, 110) + '\n        ' + (c.body.find((l) => re.test(l)) || c.body[0] || '').trim().slice(0, 200)) : null })
  }
  const n = hits.filter((h) => h.hit).length
  const state = !probes.length ? 'MISSED' : n === probes.length ? 'FLAGGED' : n ? 'PARTLY' : 'MISSED'
  if ('FLAGGED' === state) found++; else if ('PARTLY' === state) partly++; else missed++
  res.push({ id, what, state, note, hits })
}
if (a.json) { console.log(JSON.stringify(res, null, 1)); process.exit(0) }
for (const r of res) {
  console.log(`${r.state.padEnd(7)} ${r.id}  ${r.what}${r.note ? '\n        note: ' + r.note : ''}`)
  for (const h of r.hits) console.log(`     ${h.lang} ${h.wl}: ${h.hit || 'NOT FOUND'}`)
}
console.log(`\n${res.length} items: flagged ${found}, partly ${partly}, missed ${missed}`)
