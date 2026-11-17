const fs = require('fs')
const P = '/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2'
const list = require(P + '/sentences/tools/review/sentences/sentences.json').list
  .filter((s) => 'tutorial' === s.section || 'rootquick' === s.section)
const ENV = 'FALSE: no client constructor reads the environment. sdkdesc.ts:247-248 records the env name only for the example; the example passes it (`apikey: process.env.DEMO_APIKEY`, `os.Getenv`, `getenv`, `std::env::var`), and the runtime reads options.apikey alone (PrepareAuth_py.ts:114, PrepareAuth_c.ts:146, PrepareAuth_rust.ts:144; no Main_<lang> or tm/<lang>/src reads *_APIKEY). `new DemoSDK()` sends no key. Should say the example passes it. Printed by ReadmeQuick.ts:79/82.'
const V = {
  // false
  a2bf96f937: ['false', ENV], cfc01f1671: ['false', ENV + ' Same for the secret (sdkdesc.ts:248).'],
  '095528ea62': ['false', ENV + ' go form (bold step lead).'], a73956b3fb: ['false', ENV + ' go form.'],
  // lead sentences
  '509df65eab': ['ok', 'ReadmeQuick.ts:191 series(lead); true of B (load-only singleton), checked ts c go rust.'],
  '3b42b780fa': ['ok', 'matches the steps printed (crud-bare ts, c, zig, rb, py).'],
  '8e422a85a8': ['ok', 'matches crud-noupdate steps.'],
  '95064ad01e': ['ok', 'doc-list.'],
  '59ac8a63ea': ['ok', 'doc-nested: lists planet, loads satellite (q.load.entity), writes planet: true to the steps.'],
  bcbefa9d5b: ['ok', 'ent-none: one step. Thin but true.'],
  '5f48968a61': ['ok', 'ex-readonly.'],
  fc11508b53: ['ok', 'ref-issues: the only write is update; true to the steps.'],
  ee58ce03de: ['ok', 'True of every op the page shows (ts EntityListOp Promise<EntyClass[]>, c Entity** list in tm/c/core/sdk.h:362, rust/zig results hold entities). Loose for pair/union styles where the op returns a pair/result whose arm is the entity; the step sentence says so next. rb prints it too but is not in langs.'],
  afbad155be: ['ok', 'Model: tenant default "" (required), region default eu (harness variations.js:11-12). Every target emits options.server defaults via shared configDefinition (utility.ts:384-385) used by Config_<lang> of all 20; runtime fails on an empty placeholder outside test mode (MakeOptionsUtility.ts:80-93, make_options.c:117-128, zig utility.zig:826-837). REFERENCE and README options now agree (B: all 9 ported say region defaults to eu).'],
  '2873e86578': ['ok', 'server-mixed: {account} undeclared so required, region defaulted; same mechanism as afbad155be.'],
  '118dab2307': ['ok', 'go form of afbad155be (bold lead); same account.'],
  // write comments
  ac63285763: ['ok', 'example.ts:306-307. Patch sends the given map; id read off created record in every printer (ts created.data().id, c created_id from vt->data, zig h.getp(created.asEntity().data(null),"id")). Masks the field id (Ⓕ).'],
  '3b2733cb55': ['ok', 'example.ts:305; same check.'],
  '4235f37e3f': ['ok', 'example.ts:308. go only because others were unchanged from OLD.'],
  fa74e53c4a: ['ok', 'example.ts:305 unchained form (ref-issues).'],
  // headings
  ac969fd7fb: ['ok', 'ReadmeQuick.ts:164. Article from a vowel test (ReadmeQuick.ts:58): would print "an utility"/"an user"; no variation shows it.'],
  c246e90164: ['ok', 'ReadmeQuick.ts:174-176.'],
  '4633b64615': ['ok', 'as c246e90164.'],
  f999547282: ['awkward', 'A one-op write step is headed by the bare verb "2. Update" (ref-issues), while the lead says "updating a gauge". Better: "2. Update a gauge" (title with the entity when one op).'],
  // load/list/write sentences
  a2bf96f937_: null,
  '366f8e2cd2': ['ok', 'loadComment raise style; py/clojure/elixir/rb raise by default (elixir utility.ex make_error_impl ends `raise sdk_err` unless ctrl throw_err false).'],
  '0ea856bddf': ['ok', 'article variant of 366f8e2cd2.'],
  a12cc73410: ['ok', 'runtimeprose.ts:152 createComment, raise style.'],
  f2515f53be: ['ok', 'runtimeprose.ts:119; removal marks deleted in py/clojure/elixir remove fragments.'],
  '2e3c8aae76': ['ok', 'runtimeprose.ts:113,119 single-op form.'],
  cd455bcf95: ['ok', 'union; rust Ok/Err cited EntityLoadOp.fragment.rs; zig .ok/.err cited Entity.fragment.zig. zig example: planet.asEntity().data(null).'],
  e0fb6e7e3c: ['ok', 'union write sentence.'],
  '4ffde2c5db': ['ok', 'union single write.'],
  '6732c42051': ['ok', 'clojure/elixir raise; clojure OLD page also said "raises" (attested), though a JVM reader expects "throws".'],
  '3d0c1adcc3': ['ok', 'clojure collection vector cited prose (EntityListOp.fragment.clj `(vec items)`); elixir `Voxgig.Struct` list cited prose with a quote that does not show it (alias line).'],
  a0f86c7f47: ['ok', 'pair loadComment; go Load returns (any, error) EntityLoadOp.fragment.go:13.'],
  c9472ea53d: ['ok', 'ts async createComment.'],
  '57eaa23251': ['ok', 'article variant of a0f86c7f47.'],
  '1dc13211d0': ['ok', 'go listComment; collection `[]any` cited tm/go/utility/make_result.go.'],
  '1b25034e90': ['ok', 'py data_get returns a dict (recordType cited Entity.fragment.py).'],
  dbb15d380e: ['ok', 'zig union createComment.'],
  bfe2260d8d: ['ok', 'ts listOf {Class}[] derived; EntityListOp.fragment.ts:13 Promise<EntyClass[]>.'],
  d079618e6e: ['ok', 'ts async throw; EntityLoadOp.fragment.ts:13.'],
  e5b6ebca15: ['ok', 'ts.'],
  '6d459aa83b': ['ok', 'ts write sentence.'],
  '6adfda349a': ['ok', 'ts single write.'],
  aec346dc78: ['awkward', 'ReadmeQuick.ts:201-203. "The program after these 2 steps runs them in order" reads oddly; the count includes creating a client. Better: "The program below runs these 2 steps in order." Same sentence as ea263c07cb, c88eca6d9f, e0ff605945 with an unmasked number.'],
  ea263c07cb: ['awkward', 'see aec346dc78.'],
  c88eca6d9f: ['awkward', 'see aec346dc78.'],
  e0ff605945: ['awkward', 'singular of aec346dc78: "The program after this step runs it." Better: "The program below runs this step."'],
  '9736ad7042': ['ok', 'go pair loadSentence with bold lead; pairForm cited EntityLoadOp.fragment.go; noError nil cited. Does not say the value is `any` and needs `.(sdk.Entity)` before Data(), which the example shows.'],
  '3cba044db7': ['ok', 'go step lead with no text (no auth, no server).'],
  '89e4ec3e7c': ['ok', 'go pair listSentence first half (bold lead).'],
  '71b4990dcd': ['awkward', 'runtimeprose.ts:74: old go wording that survived ("(there is no `{ok, data}` wrapper)" in OLD crud-bare go README:39-40). Names a shape the page never introduced; repeats "Every operation returns entities, not raw records." Drop it, or say "unlike `Direct()`, the value is not an `{ok, data}` envelope".'],
  '094f5ec892': ['ok', 'article variant of 9736ad7042.'],
  '9bbd9f45ff': ['ok', 'go pair write sentence; "too" follows list/load steps here.'],
  f3bd7e9a0a: ['ok', 'as 9bbd9f45ff.'],
  '64112421c3': ['awkward', 'ReadmeQuick.ts:161-162. "so provide the `planet_id`" — "the" before a code token, and it does not say where (the match) or that the satellite id is still needed. Better: "Satellite is nested under planet, so the match gives `planet_id` as well as the satellite\'s own id."'],
  '4967fbd62e': ['ok', 'go pair load without lead (doc-nested, after the nested sentence).'],
  '62e6942ba3': ['ok', 'as 9bbd9f45ff.'],
  e705d74e4b: ['awkward', 'runtimeprose.ts:123 always says "too"; in ref-issues the update is the only operation step, so "returns `(value, error)` too" refers to nothing. Say "too" only when a list or load step precedes.'],
  '563a2ccc24': ['ok', 'py list.'],
  '487605432b': ['ok', 'c errslot; load signature tm/c/core/sdk.h:360 returns Entity*, PNError** err; NULL cited.'],
  bbd7e22198: ['ok', 'c list; Entity** list sdk.h:362; NULL-terminated cited prose (EntityListOp.fragment.c).'],
  '933ecb9182': ['ok', 'c createComment; NULL printed raw (not masked) in comments.'],
  '5cc55217a8': ['ok', 'c write.'],
  d8ced013b2: ['ok', 'c single write.'],
  f11f771494: ['ok', 'zig list; .ok: []*EntyClass cited Entity.fragment.zig.'],
  cd05688101: ['ok', 'clojure createComment; record token not masked here (clojure record fact carries the variable).'],
  c1b47f3295: ['ok', 'rust list; same sentence as f11f771494, `Vec` not masked.'],
  '5097de7b71': ['ok', 'rust createComment; Ok not masked in comment.'],
  '3426e9ddb3': ['ok', 'elixir note (Syntax_elixir.ts:178, slot tutorial:list); getelem/3 with a default arg (voxgig_struct.ex:466) so /2 exists; a runtime fact, correctly a note.'],
  d71fee0121: ['ok', 'rb list; tokens unmasked (`list`, `Hash`); same sentence as 563a2ccc24.'],
  '6d96732675': ['ok', 'rb load; same as 1b25034e90.'],
  cb4c5bf0da: ['ok', 'ts loadComment with class; derived.'],
  a1239b7c70: ['ok', 'same as cb4c5bf0da; class name masked whole.'],
  '99a8153c15': ['ok', 'same as cb4c5bf0da.'],
  '6b7dda2d14': ['ok', 'py listComment; collection printed without backticks so not masked.'],
  '0b439b0c35': ['ok', 'c failsShort.'],
  d236d7548c: ['ok', 'article variant.'],
  e7e0248d60: ['ok', 'c listComment.'],
  '805f851dc5': ['awkward', 'runtimeprose.ts:165 failsShort union: "`.err` on failure" has no verb, where every other style says what happens ("raises on failure", "err is non-nil on failure"). Better: ".err holds the failure".'],
  '5d43ee1d56': ['awkward', 'see 805f851dc5.'],
  '541249a1d2': ['awkward', 'see 805f851dc5.'],
  '7cbfe3fde1': ['ok', 'clojure listComment.'],
  '76d2d79f05': ['awkward', 'see 805f851dc5 (rust: "Err on failure"; the example then calls .unwrap(), which panics).'],
  '4f5c517896': ['awkward', 'see 76d2d79f05.'],
  '882eac65b5': ['awkward', 'see 76d2d79f05.'],
  '9bb950f3bb': ['ok', 'elixir listComment; masker labelled `Voxgig.Struct` as ref.container because the values coincide.'],
  '6de5ea1c00': ['ok', 'rb listComment.'],
  a4274bffdd: ['ok', 'go pair createComment ("the value is the created entity"); Create returns (any, error) EntityCreateOp.fragment.go:13.'],
}
delete V.a2bf96f937_
const out = { sentences: {} }
const missing = []
for (const s of list) {
  const v = V[s.id]
  if (null == v) { missing.push(s.id); continue }
  out.sentences[s.id] = { verdict: v[0], note: v[1] }
}
const extra = Object.keys(V).filter((k) => !list.find((s) => s.id === k))
fs.writeFileSync(P + '/sentences/A/sentences.json', JSON.stringify(out, null, 2) + '\n')
const n = {}; Object.values(out.sentences).forEach((x) => n[x.verdict] = (n[x.verdict] || 0) + 1)
console.log('share', list.length, 'verdicts', Object.keys(out.sentences).length, n, 'missing', missing, 'extra', extra)
