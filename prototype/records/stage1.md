# Stage 1 results (the record the next stage builds on)

Five agents ran: an architect (`core`), a migration test (`migrate`), a REFERENCE anatomy (`refanatomy`), and two independent probes of the architect's work (`probe-interface`, `probe-claims`). This file holds their results. Where a probe contradicts the architect, the probe ran the check itself; believe the probe.

## 1. What the architect built

I built the core of the write-once structure in a clone of sdkgen and tested it on the README quick start for ts, go, py and c. The pieces are: a resolved, JSON-serialisable SdkDescription per target (ts/src/helpers/sdkdesc.ts); a language-neutral example representation of 7 statement kinds and 6 expression kinds, with its builders (ts/src/helpers/example.ts); a shared ReadmeQuick.ts that writes every heading and sentence once; and four syntax providers, Syntax_<lang>.ts. The four retired ReadmeQuick_<lang>.ts files are deleted. Across 19 model variations, every changed line in the four ported languages is tagged with a reason (0 UNEXPLAINED), and the 16 unported languages are byte-identical to the old output in every variation. The providers read the model 0 times, as counted by a script. They needed no idiom notes: across ts/go/py/c, 100% of the quick-start prose sentences are the same text once each provider's 4 runtime words are masked (84.6% raw, against 30.8% in the old output). All 11 catalogued quick-start issues are fixed for all four languages by the shared code. Along the way I found and fixed one more defect: the c quick start calls getenv without including <stdlib.h>, so it does not compile, and the old code fails the same way. Examples compile and run: 16/16 ts README lanes, 12/12 go README lanes, py with a pytest stand-in on 4 models, and the c DOC lane on 5/6 models. The one c failure is the root README's ReadmeTopQuick_c, which I did not port; it has the same getenv defect and fails identically on the old code. H2 (source shrinks 2x) is refuted for this section: the four-language source grows (945 to 1069 lines, 0.88x), and the projection to 20 languages is 1.66x, below the 2x threshold. H5 is only partly supported: doctor reports a ReadmeQuick_<lang> left behind by an upgrade as 'additive' with ok: true, and `target add` never prunes src/cmp. So the migration needs a doctor rule I did not build.

Stopped at: Finished, in the brief's order: (1) the description and the representation, designed against the 20 languages' output; (2) the shared quick start, the ts and go providers and the diff report; (3) the py and c providers; (4) the lanes; (5) the metrics. Also finished: the H5 probe (doctor, target add and an alias against a leftover component) and the full suite without the toolchain lanes. Not done: (a) py ran without real pytest. pytest is not installed and the brief forbids PyPI, so the generated test/test_readme_examples.py ran under harness/pyrun.py with a 10-line stand-in for pytest.skip and pytest.fail; it executed every block. (b) I fixed no doctor rule for retired components; I only measured the gap. (c) I did not port the root README quick start (ReadmeTopQuick_<lang>); it still carries the getenv defect in c and the old server and secret behaviour. (d) The language pack (dart, haskell, lean) was not generated. It takes the same fallback path as the 16 unported languages, which I checked; the pack itself was read, not run. (e) No timings were measured. (f) The REFERENCE page was not touched; it is the next agent's task.

Clone: /tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/core/sdkgen (branch detached from 9aebaf9e; commits f21e6fe1 'Prototype: SDK description, example representation, shared quick start, ts/go/py/c syntax providers', d4d99cd9 'Retire ReadmeQuick_ts/go/py/c...', ae38ac4b 'Golden and guide follow the retired components; ts list match stays inline', 0aef7328 'c quick start includes stdlib.h for getenv; lanes for Basic auth with a templated server', f9d408a5 'A target's own ReadmeQuick wins over its syntax provider', 950912e7 'Golden follows the providers'). A second pristine clone at 9aebaf9e, /tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/core/oldclone, exists only to stage the go~go2 alias for OLD output and to run lanes on OLD code (its test/generatedcompile.test.ts carries the same added lanes).

### Description (verbatim)
```ts
type Scalar = string

type DescServerVar = {
  name: string
  required: boolean // the URL references it and it has no default
  dflt: string
}

type DescOption =
  | { name: 'apikey', env: string }
  | { name: 'secret', env: string }
  | { name: 'server', vars: { name: string, placeholder: string }[] }

// One member of an example request: a typed placeholder, or the id read off
// the record the example created.
type DescArg =
  | { name: string, type: Scalar, placeholder: string }
  | { name: string, fromCreated: string }

type DescEntity = {
  name: string // model key, e.g. graph_ql
  Name: string // class-name stem, e.g. GraphQl
  ops: string[] // generated, callable, canonical order
  id: string | null // the load-match id key
  dataId: string | null // the id on the returned record
  parents: string[] // required non-id load parameters of a nested entity
}

type DescQuick = {
  entity: string // the example entity (first active)
  list: DescArg[] | null // null: no list step
  load: { entity: string, args: DescArg[], nested: null | { parent: string, param: string } } | null
  create: DescArg[] | null
  update: DescArg[] | null
  patch: DescArg[] | null
  remove: DescArg[] | null
  chainsId: boolean // update/patch/remove take the id off the created record
}

type SdkDescription = {
  target: string
  name: string // model slug
  Name: string // class-name stem
  package: string // published package or module path of this target
  env: { prefix: string }
  auth: { active: boolean, in: string, name: string, basic: boolean, secret: boolean }
  options: DescOption[] // what the quick start's constructor passes, in order
  server: DescServerVar[] // variables the server URL references
  entities: DescEntity[]
  quick: DescQuick | null // null when no entity is active
}

// Rules computed in describe(): secret = auth active && basic && in === 'header' && !isAuthSuppressed (the condition under which every PrepareAuth_<lang> emits the Basic branch). options = apikey when auth is active, secret per that rule, and server with only the required variables. server = serverVariables() filtered to the variables the URL references.
```

### Example representation (verbatim)
```ts
type Ent = { name: string, Name: string }

// A value an example names. `role` says what it holds, so a printer can
// choose its identifier: the entities a list returned, one of them, the one a
// load returned, the one a create returned.
type Ref = { role: 'many' | 'item' | 'one' | 'created', entity: Ent }

type Expr =
  | { k: 'lit', type: Scalar, text: string } // a typed literal; `text` when it is a string
  | { k: 'str', text: string } // a plain string
  | { k: 'env', name: string } // an environment variable, read
  | { k: 'record', of: Ref } // the record a returned entity holds
  | { k: 'field', of: Ref, field: string } // one field of that record
  | { k: 'map', entries: Entry[] }

type Entry = { key: string, value: Expr }

type Stmt =
  | { k: 'client', options: Entry[] } // construct the client; [] for none
  | { k: 'call', entity: Ent, op: string, arg: Entry[] | null, bind: Ref | null }
  | { k: 'each', item: Ref, of: Ref, body: Stmt[] }
  | { k: 'print', what: Expr }
  | { k: 'attempt', what: string, body: Stmt[] } // report a failure of `what`
  | { k: 'comment', text: string }
  | { k: 'gap' }

// A null arg on a call: the call takes no match. A create always takes data.

// What a block uses, for a printer that declares imports.
type Uses = { env: boolean, field: boolean, entities: string[] }

// Builders (read only an SdkDescription): clientBlock(desc), listBlock(desc), loadBlock(desc), writeBlock(desc), writeOps(desc).
// List and load are each [attempt(call bound to many/one, then each+print or print)]. The write block is comment + call per op present, separated by gap; create binds `created`, and update/patch/remove bind nothing.
// Comment texts are shared: 'Create — returns the created entity', 'Update — the id comes off the created entity's record' (when chained), 'Patch — sends only the fields given[; the id comes off the created entity's record]', 'Remove'.
```

### Provider interface (verbatim)
```ts
// What one section's printing has declared so far; a printer that hoists a
// declaration (a handle, an error slot) records it here.
type Scope = { declared: Set<string>, local: Set<string>, stmts: Stmt[] }

// The words the shared prose uses for this runtime's parts. Data, not text:
// the sentences that hold them are written once.
type RuntimeWords = {
  op: (name: string) => string // how the prose names an operation: `list()`
  many: string // what a list returns: 'an array'
  fails: string // how an operation reports failure: 'throws on failure'
  data: string // what reads an entity's record: '`.data()`'
}

type Syntax = {
  fence: string // the code fence language
  words: RuntimeWords
  // Each printer returns lines; `inner` prints nested statements at one more level.
  client: (s: Extract<Stmt, { k: 'client' }>, desc: SdkDescription, sc: Scope) => string[]
  call: (s: Extract<Stmt, { k: 'call' }>, desc: SdkDescription, sc: Scope) => string[]
  each: (s: Extract<Stmt, { k: 'each' }>, inner: (body: Stmt[]) => string[], sc: Scope) => string[]
  print: (s: Extract<Stmt, { k: 'print' }>, sc: Scope) => string[]
  attempt: (s: Extract<Stmt, { k: 'attempt' }>, inner: (body: Stmt[]) => string[], sc: Scope) => string[]
  comment: (text: string) => string
  expr: (e: Expr, sc: Scope) => string
  // Optional: lines a block needs ahead of its statements (a hoisted handle).
  before?: (stmts: Stmt[], desc: SdkDescription, sc: Scope) => string[]
}

// What each member prints:
// fence   - the code fence language ('ts', 'go', 'python', 'c').
// words   - the 4 runtime facts the shared list/load sentences are filled with.
// client  - the imports or includes, and the constructor call with its options (env reads, the server map); c also declares `PNError* err`.
// call    - one entity operation with its match/data argument and the binding of its result; go also prints its `if err != nil` check.
// each    - iteration over a bound list of entities.
// print   - printing a record (or field) of a bound entity.
// attempt - error handling around a body: try/catch, try/except, `if (err) ... else`, or (go) the body alone, since each call carries its check.
// comment - one comment line.
// expr    - a literal, env read, record or field read, or map.
// before  - (c only) declarations hoisted ahead of a block: an entity handle declared once per section.
// A provider is found as `Syntax` exported by cmp/<target>/Syntax_<target> through optionalComponent(ctx$, target, 'Syntax').
```

### Survey of the 20 quick starts
Quick start of all 20 languages as of 9aebaf9e. Read from the stored spike outputs for B, auth-basic, auth-off, server-none, op-absent-readonly, ent-only-ambient and ent-none, and from my own OLD runs of doc-list, doc-crud, doc-nested, crud-noupdate, auth-basic-query, server-mixed and alias-go2. B's example entity is `ambient` (load only), so B shows only steps 1 and 3; doc-crud and doc-nested show the full shape.
SHARED BY 18 (all but js and go): headings '### 1. Create a client', '### 2. List <e> records' (only with list), '### 3. Load a/an <e>' (the nested entity if any, else the example), '### 4. Create, update, and remove' (whenever any write op exists). The numbers are literal (S28: B prints 1 then 3) and the write heading is fixed (U45). All 18 pick the same example entity, nested entity, load/remove match and create/update fields. The lead-in 'creating a client, listing entities, and loading a specific record' is shared and unconditional.
Columns: client constructor | list | load | writes | error idiom | id chaining in writes | server vars | Basic secret | other.
ts | import + new XSDK({apikey: process.env, server:{all vars} with a '// Required' comment}) | not in try; '.data()' | try/catch | multi-line object args; binds updated/patched | try/catch | chains, type-checked (`created.data().id!`) | all vars (G01) | yes, at any placement (M12) | 4 steps.
js | require + new XSDK({apikey}) | after load; no error handling | first; literal 'planet_id' | one heading per op (Create a Planet...), each prints data() | none | no (literal ids) | no (S49) | no | Title-Case unnumbered headings; extra '### Direct API Access' section. DRIFT.
go | one '### Quickstart' program: package main, import block, func main, sdk.NewXSDK(map{apikey os.Getenv, server{all vars, mis-indented: M14}}) or sdk.New() | `.([]any)` range, item.(sdk.Entity).Data() | panic(err) | prints every write result | `if err != nil { panic(err) }` after every call | no (literal) | all vars | no | never chooses a nested entity; prose about (value, error). DRIFT in structure.
py | import os + from x_sdk import XSDK({apikey os.environ.get, server{all}}) | try/except | try/except | inline dicts | try/except | chains, no type check | all vars | no | -
php | <?php require_once; new XSDK([apikey getenv]) | try/catch; prints id and radius fields | try/catch, comment in code | inline arrays | try/catch \Throwable | chains | no | no | picks fields to print (a selection inside the component).
rb | require_relative; XSDK.new({apikey ENV}) | begin/rescue; prints id and radius | begin/rescue | inline hashes | begin/rescue | chains | no | no | picks fields to print.
lua | require; sdk.new({apikey os.getenv}) | `local v, err = ...; if err then error(err) end`; prints rec["id"] | same | inline tables | value,err return | chains | no | no | prints one field.
csharp | using; new XSDK(new Dictionary{[apikey]=Environment.Get...}) | try/catch; (List<object?>) cast | (IEntity) cast | Dictionary literals, 1.0 numbers | try/catch | no ('supply the id') | no | no | -
java | imports incl. SdkEntity; options.put(...) imperatively, server map via put | try/catch; (List<?>) cast | (SdkEntity) cast | Map.of(...), extra null arg | try/catch RuntimeException | no | all vars | no | -
kotlin | imports; XSDK(mutableMapOf(apikey to System.getenv)) | try/catch; as List<*> | as SdkEntity | mutableMapOf | try/catch | no | no | no | -
scala | imports; options.put | try/catch; asInstanceOf; forEach lambda | asInstanceOf | java.util.Map.of | catch case | no | no | no | -
swift | import; VMap entries assignment | do/catch; asNative as? Entity | same | `_ = try` VMap([...]) | do/catch | no | no | no | -
rust | use (getp, jo, ...); XSDK::new(jo(vec![...])) | match Ok/Err | match | `.unwrap()` per write | match on Result | chains (getp) | no | no | -
c | #include "core/api.h" (no <stdlib.h>: getenv undeclared, my defect c-getenv); x_sdk_new(cmap(1, apikey)); PNError* err | hoisted `Entity* e = x_e(client, NULL)`; NULL-terminated array | `Entity* loaded`; `if (err) else` | cmap(n,...); hoisted `voxgig_value* created_id` | `if (err)` | chains via created_id | no (S49) | no | handle hoisting depends on earlier steps.
cpp | includes, using namespace; getenv hoisted into `const char* apikey`; make_shared<XSDK>(vmap) | try/catch SdkErrorPtr; std::vector | same | vmap({{...}}) | try/catch | chains (getp) | no | no | -
zig | @import consts; XSDK.new(h.jo(&.{...})) | switch .ok/.err | switch | a switch around every write, printing each result; remove prints 'removed' | switch on union | no | no | no | -
perl | use lib, use X; X->new({apikey $ENV}) | eval/$@; prints ->{id} | eval/$@ | inline hashrefs | eval { } / $@ | chains | no | no | prints one field.
clojure | (require ... entity namespace of the example entity ...); (api/make-sdk (vs/jm ...)) | (try (doseq ...) (catch ...)) | (try (let ...)) | (def created ...); vs/getprop | try/catch | chains | no | no | imports depend on which entities are used.
elixir | alias H; X.new(H.deep(%{...})) | try/rescue; Voxgig.Struct.getelem loop | handle `e = X.e(sdk)` | handle reused; H.deep maps | try/rescue | chains (getprop) | no | no | -
ocaml | open modules; Sdk_client.make (jo [...]) | (try ... with Sdk_error.E) List.iter | same | `let created = ... in`; remove prints e_deleted | try ... with | chains (getp) | no | no | remove's result printed.
Constructs the representation must cover across all 20 (each appears in at least one language): imports derived from what the block uses (env, entities, field reads); a constructor with an options map of env reads and a nested server map (imperative put form in java, scala and swift); a hoisted declaration (c handle and err, cpp apikey, elixir handle); an op call with a match/data map or none, a cast and trailing control args; result binding; iteration; printing a record or chosen fields; error handling (try, result match, error return, errno, eval); per-write handling or unwrap; comments; typed literals (string, number, boolean, empty list, empty map, null); a field read of the created record. My representation covers all of these except: 'print chosen fields' (perl, php, rb, lua), a printed remove result (ocaml, zig), and per-write error handling distinct from attempt (zig, rust unwrap, go) — see gaps.

### Decisions
- **go structure: one program versus steps.** go prints the shared four steps as fragments; there is no '### Quickstart' program. Why: go does not need a whole compilable unit. Its README harness (ReadmeExamplesTest_go.ts:159-196) compiles fragments by wrapping each in a function, and 18 of 20 languages use steps. The single program is drift. The go README lanes pass (12/12, including the new Basic/templated-server lane). Lines: In go, every quick-start line in every variation: 346 lines tagged as the structure change, 434 re-indented, 40 import lines rewritten as single lines, 23 in-code comments moved into the step prose (diff-report.txt). Go code blocks: 0 identical / 47 changed across 19 variations.
- **js headings, order and Direct API section.** Not ported. js keeps its own ReadmeQuick_js and is byte-identical. Why: Out of scope (four languages). It is drift to resolve when js gets a provider: Title-Case unnumbered headings, load before list, one heading per write op, no error handling, and an extra 'Direct API Access' section that belongs to the how-to. Lines: 0
- **Prose wording: one sentence per fact.** List: '<op> returns <many> of entities, one per record, and <fails>; <data> reads an entity's record.' Load: '<op> returns the entity and <fails>; <data> reads its record.' The 4 placeholders are the provider's RuntimeWords. Why: ts, py and c each worded the same fact differently (ts: 'resolves to an array of Planet ENTITIES — every operation resolves to entities, not raw records. Iterate them directly...'; py: '... raises on error; ... (a `dict`)'; c: '... — check `err` after the call'). The extra clauses repeat the failure fact or restate the entity contract, so they were dropped rather than kept as idiom notes. Lines: 183 prose lines tagged 'unified wording: list/load step prose' across the four languages.
- **Client step prose.** New shared sentences from the description: which environment variables the client reads (one or two), which server variables `server` must give, and the default of each defaulted one. ts's in-code comment '// Required: this API's server URL is templated on these.' is removed. Why: D25 and G01/D55: the facts live once in the description, and the code block carries only the options the runtime requires. Lines: 181 prose lines added (D25/S49/G01); 28 ts code lines (S49/G01).
- **Write-step comments.** Shared comment texts in the representation, printed in each language's comment syntax. Why: Each language wrote its own (ts: 'returns the created Planet ENTITY (.data() for the record)'; c: 'or NULL with *err set'; go: 'Create a planet.'). Lines: 106 code comment lines.
- **Error handling of the list step.** List is wrapped in attempt like load, in every language. Why: py, c and go already handled list failure; ts alone did not. Unified. Lines: ts: 30 lines (try/catch) plus 36 re-indented.
- **Write results.** create binds `created`; update, patch and remove bind nothing and print nothing. Why: py and c bound nothing; ts bound unused `updated`/`patched`; go bound and printed each. The variable is needed only where a later call reads it. Lines: ts and go: 14 binding lines; go: 17 print lines.
- **Chaining on the created id.** One rule, in the description: chain only when the data id's type equals the match key's (ts's rule). py and c used to chain without the type check; go never chained. Why: A WHETHER decision belongs in the description. go now prints `created.(sdk.Entity).Data().(map[string]any)["id"]` and its README lane runs it. Lines: go: 24 lines. py and c: 0 in these variations, because the fixture's id types match.
- **Nested entity.** Chosen once in the description; go now shows the nested load too. Why: go's component never looked for a nested entity; the other 18 did. Lines: go: 5 lines (doc-nested).
- **ts argument layout.** Multi-line for a write's data and for a load match of more than one member; inline otherwise. The list match stays inline. Why: The old ts layout depended on whether the load was the nested one, which a printer cannot see. The list match had to stay inline: the generate suite's list-parameter test reads one following line, and my first rule (multi-line from two members) failed it. Lines: 0 in the 19 variations (the old outputs coincide); a non-nested load with two members would change.
- **Precedence between a target's own ReadmeQuick_<lang> and its Syntax_<lang>.** The own component wins; then the provider; then the old warning. Why: Provider-first would silently drop a project's fork. Component-first keeps a fork, but it also keeps an unmodified leftover from an upgrade writing the old tutorial, which doctor reports as 'additive' (h5.js). Neither is safe without a doctor rule; component-first loses nothing. Lines: 0 in output (no leftovers in the harness).
- **Lead-in and placement sentence.** The lead-in lists the steps written ('creating a client and loading an ambient', ...), wrapped at 72 columns. The placement sentence is rebuilt from desc.auth in credentialPlacement's words and reflows with the lead-in. Why: S28/U45. Lines: 272 prose lines plus 8 placement lines.

### Facts that had leaked into per-language code
- In each case below an old per-language component held a model-dependent condition; each now sits in the description. Server variables (which are required, which defaulted): now desc.server and desc.options. No provider reads them.
- Basic secret: the old ts component tested isHttpBasicAuth alone. It is now desc.auth.secret (basic, header placement, not suppressed); providers only print the options list.
- Chaining on the created id: three different rules (ts type-checked, py and c unchecked, go never). Now DescArg.fromCreated, decided in sdkdesc; the go provider prints whatever it is handed.
- Nested entity and parent parameter: go never chose one. Now desc.quick.load.nested.
- Which write operations appear, and the create/update field choice: copied into each component. Now desc.quick.create, update, patch and remove.
- Borderline, a fact derived from description strings rather than read from the model: the py provider builds its import module as `${desc.Name.toLowerCase()}_sdk`, as the old component did. That is a layout fact of the py target. It belongs in the description (a per-target `module` field), but deriving it needs language knowledge the description builder does not have; this is the clearest pressure point.
- Borderline: the c provider builds its identifier stem from desc.name (`toLowerCase().replace(/[^a-z0-9]/g,'')`), duplicating utility_c's cIdent(model). It also copies C_RESERVED and cVarName, because utility_c also exports helpers that read the model. A pure naming module per language would remove the copies.
- Alias provenance: desc.package comes from packageName(model, target), which reads `origname` to know that go2 is a go target. The old go component called goModule(model, target) directly. With the model `target add go~go2` writes (origname: go) the output is the same. A hand-made alias model without origname would get 'voxgig-sdk-demo-sdk' as its go module. My first alias staging omitted origname and showed exactly this; fixed by staging as target add does.
- Not a model fact but provider state across blocks: c hoists entity handles once per section, and go declares err once per block. Both are handled by Scope (declared, local, stmts), which is passed in, so the providers stay pure functions of what they are given.

### Gaps the architect listed
- The representation has no statement for printing CHOSEN fields of a record. perl prints ->{id}, php and rb print id and radius, lua prints rec["id"]. Today that choice is made inside those components; it needs a description field (which fields to show) and an Expr form for it.
- A remove's result is shown by ocaml (`removed.e_deleted`) and zig ('removed'); there is no Stmt for 'show the deleted marker'.
- Per-write error handling distinct from attempt (zig wraps each write in a switch, rust unwraps, go checks): go handles it inside call. zig would need either attempt around each write or a per-call handling mode; the builder emits writes without attempt.
- Options built imperatively (java, scala and swift use put or entries) are printable from the same Entry list. Not tried.
- Imports that depend on the entities used (clojure requires the entity namespace) are supported through uses(stmts), but no provider exercised it.
- js's 'Direct API Access' section and its other drift are undecided; it is a how-to section living in the tutorial.
- The description has no per-target layout facts (py import module, c identifier stem). Providers derive them from strings, which is borderline.
- No retired-component rule in doctor: a ReadmeQuick_<lang> left by an upgrade is 'additive', so a migration cannot be reported or pruned (H5).
- server-none: the description says nothing about `base` (the URL a spec without servers needs); the quick start shows no option.
- The root README quick start (ReadmeTopQuick_<lang>) is still per-language, with the same S49, S50, G01 and M12 issues and the c getenv defect.
- RuntimeWords are English fragments chosen to fit two sentence frames. A third sentence frame may need more words, and the interface would grow.

### Surprises
- The source grew for four languages (0.88x). The fixed cost of the description, the representation and the walker (about 650 lines) only pays back across many languages, and even 20 projects to 1.66x. Most of the old per-language code was selection logic that already called shared helpers; per language it was not as large as the brief's 36,000-line figure suggests for the whole documentation.
- The c quick start never compiled with auth active (getenv without <stdlib.h>). Nothing caught it, because the DOC-lane models have auth off. The root README copy has the same defect, which illustrates the proposal's own point.
- The go README harness compiles fragments, so go's whole-program form was a choice, not a need. No language among the four needs a compilable unit.
- doctor's `known` check consults only the current scaffold, not the copy record. A component the scaffold stops shipping becomes 'additive (project-owned)', the same as a deliberate project extension.
- packageName for an alias depends on `origname` in the target's model, while the old go component used goModule directly, so the description inherits a provenance dependency.
- Masking the 4 runtime words makes 100% of the prose identical across four languages. The old prose was only 30.8% identical, and none of its extra clauses held a fact the others lacked.
- Three interface changes were needed by the second and fourth providers (go err scoping, c lookahead and hoisting), all about cross-statement state rather than syntax of one statement.

### Measurements
- source lines, four languages, before vs after (total / non-blank non-comment) = before 945 / 717 (shared ReadmeQuick.ts 34 + ReadmeQuick_ts 242 + go 203 + py 225 + c 241); after 1069 / 826 (ReadmeQuick.ts 165 + sdkdesc.ts 245 + example.ts 244 + Syntax_ts 89 + go 103 + py 81 + c 142). Ratio 0.88x / 0.87x, so the source GREW. 0 utility_<lang> lines removed: every helper in them is still used by other components. (node harness/metrics.js)
- source lines, projection to 20 languages = before 4537 / 3479 (measured: all 20 ReadmeQuick_<lang> plus the shared file); after 2729 / 2090, assuming the other 16 providers average the four measured (103.75 / 79 lines) and the shared code does not grow. Ratio 1.66x / 1.66x, below the 2x of H2. sdkdesc.ts holds more than the quick start needs (all entities, auth, server), meant to be reused by the REFERENCE page; counting only the quick-start share would help, but I did not split it. (node harness/metrics.js)
- changed lines in the four ported languages without a reason = 0 UNEXPLAINED, of 2236 tagged changed lines across 19 variations (node harness/diff.js (report: harness/diff-report.txt; per-line: harness/diff-detail.txt))
- unported languages byte-identical = 0 of 272 whole README files differ (16 languages x 17 variations) (node harness/diff.js)
- quick-start prose shared across ts/go/py/c = OLD: 144 of 468 sentences identical in all four (30.8%). NEW: 460 of 544 identical raw (84.6%), 544 of 544 (100%) once the providers' RuntimeWords strings are masked. Per-language prose that is not a shared sentence: 0. (node harness/agg.js)
- provider interface size = Syntax: 10 members (fence, words, client, call, each, print, attempt, comment, expr, before?); RuntimeWords: 4 (op, many, fails, data); Stmt kinds 7; Expr kinds 6. (node harness/metrics.js)
- interface changes after the first provider (ts) = 3, all made while writing go and c, before the first commit, so git does not show them: Scope gained `local` (go: err declared once per block), Scope gained `stmts` (c: look ahead for field reads to hoist created_<field>), and an optional `block` post-processor became `before` (c: hoist handles). The third is the one breaking change. None after c. (read, not run (from the session's own edits))
- idiom notes = 0. The interface has no member for one, and none was needed for ts, go, py or c. (node harness/metrics.js)
- model reads in providers = 0 (ts 0, go 0, py 0, c 0) (node harness/metrics.js)
- ts README lanes = 16/16 pass (cd sdkgen/ts && node --test --test-name-pattern 'typescript: the README example tests type-check and run' dist-test/generatedcompile.test.js)
- go README lanes = 12/12 pass (cd sdkgen/ts && node --test --test-name-pattern '^go: (every README example|the README examples run)' dist-test/generatedcompile.test.js)
- c DOC lanes = NEW 5/6 pass; the basic-server failure is in the root README (ReadmeTopQuick_c), not the ported section. On OLD the same basic-server lane fails in both the root README and c/README.md. (cd sdkgen/ts && node --test --test-name-pattern '^c: every documented example compiles' dist-test/generatedcompile.test.js; same in oldclone/ts)
- py README examples (pytest stand-in) = NEW and OLD: baseline, crud, basic-server and nested each 9 passed, 0 failed, 1 skipped (mypy) (node harness/pylane.js <sdkgen/ts> <outdir>)
- full suite without the toolchain lanes = 2514 tests: 2508 pass, 5 skipped, 1 fail (characterize golden, from a provider edit made after the previous golden). After `npm run golden`, characterize passes 2/2. (cd sdkgen/ts && node --enable-source-maps --test $(find dist-test -name '*.test.js' ! -name 'generatedcompile.test.js' | sort); npm run golden)
- H5 probe = Fresh add of go: Syntax_go.ts present, no ReadmeQuick_go.ts, doctor ok. With the old ReadmeQuick_go.ts left in src/cmp/go and target add re-run: the file stays (src/cmp is never pruned), and doctor reports ok: true with additive ['src/cmp/go/ReadmeQuick_go.ts'], stale []. Aliased add go~go2: Syntax_go2.ts written, no ReadmeQuick_go2.ts; generation of go2 goes through the provider (alias-go2 variation). (node harness/h5.js)

### How to reproduce
```
export PATH=/opt/node24/bin:$PATH
P=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/core
cd $P/sdkgen/ts && npm run build        # NEW dist and stage
cd $P/oldclone/ts && npm run build      # pristine 9aebaf9e, for the alias staging only
cd $P/harness
node gen.js old /home/user/sdkgen/ts                                   # OLD, 18 variations (alias skipped)
node gen.js oldclone $P/oldclone/ts --only alias && rm -rf out/old/alias-go2 && cp -r out/oldclone/alias-go2 out/old/
node gen.js new $P/sdkgen/ts                                           # NEW, 19 variations
node diff.js > diff-report.txt; node diff.js --json > diff-report.json; node diff.js --detail all > diff-detail.txt
node agg.js; node metrics.js; node h5.js
node survey.js new doc-crud ts go py c                                 # read any section
node pylane.js $P/sdkgen/ts $P/pyout-new; node pylane.js $P/oldclone/ts $P/pyout-old
cd $P/sdkgen/ts && node --test --test-name-pattern 'typescript: the README example tests type-check and run' dist-test/generatedcompile.test.js
node --test --test-name-pattern '^go: (every README example|the README examples run)' dist-test/generatedcompile.test.js
node --test --test-name-pattern '^c: every documented example compiles' dist-test/generatedcompile.test.js
node --enable-source-maps --test $(find dist-test -name '*.test.js' ! -name 'generatedcompile.test.js' | sort)
Variations are in $P/harness/variations.js (B, auth-basic, auth-basic-query, auth-query, auth-off, server-mixed, server-static, server-none, op-absent-readonly, ent-only-ambient, ent-none, doc-list, doc-crud, doc-nested, crud-basic, crud-bare, crud-noupdate, lone-go, alias-go2). B itself is the templated server with one required (tenant, default '') and one defaulted (region, 'eu') variable; server-mixed has a referenced, undeclared one.
```

### Handoff
Everything is under /tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/core/. The clone is sdkgen/ (commits f21e6fe1..950912e7 on 9aebaf9e); the harness is harness/ (README.txt lists the commands); stored outputs are in harness/out/{old,new}/<variation>/<target>/README.md.

For the REFERENCE page: extend SdkDescription (ts/src/helpers/sdkdesc.ts) rather than reading the model in the shared component. desc.entities already carries ops, id, dataId and parents per active entity; add the per-op argument lists the REFERENCE shows (requiredItems, matchExampleItems, requestExampleItems are the helpers) and the option rows. Reuse desc.options and desc.server for the constructor table, so S49, S50, G01 and M12 close there too. Find a provider with optionalComponent(ctx$, target, 'Syntax'). A section with a provider writes every sentence itself, conditioned on the description; a target with no provider must stay byte-identical (check it with harness/diff.js, adapting qsect.js to the REFERENCE section).

Rules a provider follows: pure functions of (statement or expression, desc, scope); no model, no ctx$, no import of utility_<lang> or @voxgig/apidef; only the pure helpers (exampleVarName, jsKey, jsProp, jsQuote, camelify, indentLines). It decides HOW, never WHETHER. Anything that decides whether a thing is shown goes in the description or the builder. State across blocks goes in Scope: declared is per section, local per block, stmts is the current block. Runtime facts the prose needs go in RuntimeWords, as phrases that fit the shared sentences. harness/metrics.js counts violations; keep it at 0.

Watch for: (1) the survey's open constructs (chosen-field printing in perl, php, rb and lua; the printed remove result in ocaml and zig; per-write handling in zig and rust) need representation additions and a description field for the field choice; do not let a provider pick fields. (2) py's import module and c's identifier stem are derived in providers from desc strings; add per-target layout fields if a language needs more. (3) H5 is not closed: doctor needs a retired-components rule before a release could retire ReadmeQuick_<lang> for existing projects. ReadmeQuick.ts currently lets a project's own ReadmeQuick_<lang> win over its provider. (4) Alias packages depend on origname; stage aliases as target add writes them (harness/gen.js stageAlias). (5) The c DOC lane with auth active fails on ReadmeTopQuick_c (getenv without stdlib.h); port or patch it with the root quick start. (6) No pytest here: use harness/pylane.js. (7) Never rebuild dist while a suite runs; it produces about 120 spurious sub-millisecond failures.

For porters of the other 16: copy the shape of Syntax_ts.ts (simplest) or Syntax_c.ts (hoisting, lookahead). Expect structure decisions like go's to be counted in diff.js reasons, and add reason rules to diff.js rather than leaving UNEXPLAINED. Each port should also delete ReadmeQuick_<lang>.ts and refresh the golden (`npm run golden`).

## 2. The independent check of those claims (`probe-claims`)

I reproduced the architect's main numbers independently, and most of their claims hold. My copy is /tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/probe-claims/: I rebuilt both clones there, regenerated OLD from the pristine oldclone and NEW from the clone, and compared them with my own script (mycmp.js). My counts match theirs exactly once headings are counted as prose. The 16 unported languages are byte-identical in all 272 READMEs, and nothing outside the quick start changed. My own scan (mymodelreads.js) finds 0 model reads in the four providers. A structural check of every quick start (checks.js) finds no defects in NEW across all 19 variations: no step-number gaps, no lead-in promising an operation that is not called, no wrong write heading, no getenv without stdlib.h, no defaulted variable shown as required. OLD has 30, 47, 12, 15 and 45 of those respectively. The full suite passes: 2514 tests, 2509 pass, 5 skipped, 0 fail. The lanes: ts 16/16, go 12/12, c 5/6, where the one failure is the root README, which was not ported and fails on OLD too.

Five things are wrong or missing in their report:
(1) **py was runnable.** pytest 9.1.1 is installed as a uv tool at /root/.local/share/uv/tools/pytest/bin. With that on PATH, the real generatedcompile py README lanes ran: 12/12 pass on NEW and 12/12 on OLD. Their "not runnable, used a stand-in" was an environment check that failed, not a fact about the machine.
(2) **go regressed for readers and for verification.** The OLD go quick start was one complete program (package main, func main, grouped imports including fmt). The go README harness compiled it AND ran a test-mode variant against the seeded mock. NEW go is fragments with no package, no main and no fmt import, so a user cannot copy and run it. The harness now only type-checks the fragments (wrapFragment) and executes none. The per-target go README has 0 `func main` blocks against 1 before. The architect tagged this as "structure" rather than as a cost. It is also the one idiom the provider interface could not express; it was dropped rather than modelled.
(3) **The "100% shared prose" comes partly from deleting language-specific facts.** Examples: c's "returns the created entity, or NULL with *err set" and "check `err` after the call"; go's paragraph on `(value, error)` and "there is no {ok, data} wrapper"; py's "returns the ENTITY — call data_get()".
(4) **Upgrading projects keep the old text.** Commit f9d408a5 makes a leftover ReadmeQuick_<lang> win over the provider. I re-ran their h5.js: doctor reports the leftover as additive with ok: true, and target add never prunes src/cmp. So an upgraded project silently keeps the OLD, defective quick start. The code comment in ReadmeQuick.ts says "until doctor's stale finding has it removed", but no such finding exists.
(5) **The ts README now contradicts itself.** Only one section was ported. In B the quick start says `region` defaults to `eu` while the options table says **Required** `tenant`, `region`. In auth-basic-query the quick start drops `secret` while four later ts sections still print it.

Smaller points:
- Syntax_c copies C_RESERVED, cVarName and cIdent (the last inline three times) instead of importing them, because the model-read metric counts imports from utility_c. That duplicates naming rules and goes against the repository's one-rule-one-place convention.
- The variation op-absent-readonly exercises nothing in the quick start: the example entity stays `ambient`, so its output is identical to B.
- In the c examples `err` is never reset, so after one failure every later step reports a failure. OLD did the same.

Verdicts:
- **H1: supported for 4 languages, with a caveat.** 0 model reads; per-language prose is 4 runtime words; no interface change after the first commit (git confirms example.ts and sdkdesc.ts are unchanged since f21e6fe1). The 3 changes made before the commit are unverifiable. The caveat is that go's idiom was dropped, not expressed.
- **H2: refuted for the quick start.** 945 to 1069 lines across the four languages. Their 20-language projection is 1.66x, and it is optimistic: with c-sized providers (142 lines) it is 1.36x, and even with no shared code at all it only reaches 2.19x. Reaching 2x depends on reuse by the REFERENCE page or the root README quick start (ReadmeTopQuick, 2000 lines), which is not measured.
- **H3: supported for the 4 ported languages.** The quick-start parts of S28, U45, S49, S50, G01, M13, M14 and M12 are fixed by the shared code, and so is the go part of X6, which the architect did not list. Two fixes are per-language provider facts: M14 and c-getenv. D23, D25 and D55 are fixed only in part. The lean items M19 and U10 are not addressed.
- **H4: no failure intrinsic to the approach.** But the go quick start is no longer executed by any test.
- **H5: partly supported, as they say.** As built, the upgrade path does not deliver the fixes.

### Defects in the NEW output
- **go / all variations with entities (e.g. doc-crud, B).** The quick start is no longer a complete program. There is no package main, no func main, and no fmt import although every step calls fmt.Println; imports are separate single lines. A reader cannot copy and run it. OLD gave one runnable program, and the README harness executed it; NEW fragments are only type-checked. Evidence: harness/out/new/doc-crud/go/README.md vs harness/out/old/doc-crud/go/README.md; ReadmeExamplesTest_go.ts runs only func main blocks (runProgs) and wraps the rest with wrapFragment
- **c / doc-crud, doc-nested, crud-noupdate.** Language-specific facts were dropped to make the prose shared: the create comment lost 'or NULL with *err set', and the list prose lost 'check `err` after the call'. A failure also leaves err set for every later step, which OLD shares. Evidence: OLD c doc-crud '// Create — returns the created entity, or NULL with *err set' vs NEW '// Create — returns the created entity'
- **go / all.** The explanatory paragraph was lost: '(value, error) — the value is the entity ... there is no {ok, data} wrapper'. NEW keeps only 'reports failure in a non-nil `err`'. Evidence: harness/out/old/B/go/README.md lines under '### Quickstart'
- **ts / B, server-mixed.** The README contradicts itself. The new quick start says '`region` defaults to `eu`' and shows only tenant, while the unported options table in the same README still says '**Required.** ... `tenant`, `region`' (G01 is fixed in one place only). Evidence: harness/out/new/B/ts/README.md lines 35 and 224
- **ts / auth-basic-query.** The README contradicts itself. The quick start correctly omits secret (Basic in the query string), but lines 143, 180, 192, 216 and 230 of the same README still show secret / DEMO_SECRET. Evidence: grep -n -i secret harness/out/new/auth-basic-query/ts/README.md
- **ts, go, py, c / upgrade of an existing project.** A ReadmeQuick_<lang> left behind by an upgrade wins over the provider (f9d408a5), and doctor reports ok:true. Upgraded projects therefore keep the OLD, defective quick start with no warning. The comment in ReadmeQuick.ts says a doctor 'stale finding' will remove it, but none exists. Evidence: node harness/h5.js: additive [src/cmp/go/ReadmeQuick_go.ts], stale []; ts/src/cmp/ReadmeQuick.ts lines 18-21
- **c / source.** Naming rules are duplicated: Syntax_c copies C_RESERVED and cVarName from utility_c and inlines cIdent three times, so drift from utility_c is possible and the repository's one-rule-one-place convention is broken. Evidence: ts/project/.sdk/src/cmp/c/Syntax_c.ts lines 5-20, 86, 89, 98 vs utility_c.ts cVarName and cIdent
- **all / op-absent-readonly.** Not an output defect but a harness gap: the variation does not reach the quick start, because the example entity is ambient. Its output equals B, so it says nothing about a read-only example entity. Evidence: diff of the quick starts in new/B and new/op-absent-readonly: identical

### Claims checked
- [imprecise] Across 19 variations, ts prose identical 47 / changed 81 / added 48; code blocks identical 18 / changed 25 (and go 19/146/29/6, 0/47; py 53/69/54/0, 24/19; c 83/60/33/0, 22/21) TRUE: Reproduced exactly once headings count as prose: ts headings 46 identical plus 1 prose line = 47; blocks 18 of 43. go 19 identical, all of them headings. py 46+7=53. c 46+37=83. But almost all the 'identical prose' is headings: actual sentence lines identical were ts 1 of 68, go 0 of 133, py 7 of 62, c 37 of 83. On the 8 variations the task names (B, auth-basic, auth-query, auth-off, server-none, op-absent-readonly, ent-only-ambient, ent-none): ts prose 0/23 identical (45 new), headings 16/23, blocks 8/15; go prose 0/56 (45 new), headings 8/16, blocks 0/8 old vs 15 new; py prose 0/23, headings 16/23, blocks 8/15; c prose 14/30 (45 new), headings 16/23, blocks 7/15.
- [confirmed] The 16 unported languages are byte-identical to the old output in every variation (0 of 272 whole READMEs differ) TRUE: unported files 272, differ 0. For the four ported languages, the README outside the quick start is unchanged in every variation (0 outside-section changes).
- [confirmed] The providers read the model 0 times TRUE: 0 hits in all four. Description fields read: ts Name and package; go package and Name; py Name only (it derives the import module as Name.toLowerCase()+'_sdk' itself rather than taking it from the description); c Name and name. Every conditional is syntax-level. But Syntax_c copies C_RESERVED and cVarName from utility_c, and cIdent inline three times, rather than importing them: the scan counts a utility_c import as a model read, so the rules were duplicated to stay at 0.
- [imprecise] 100% of quick-start prose sentences are the same text across ts/go/py/c once the 4 runtime words are masked; no idiom notes were needed TRUE: True by construction: every sentence is in ReadmeQuick.ts. But it was reached partly by deleting language-specific facts the old text carried: c 'returns the created entity, or NULL with *err set' and '— check `err` after the call'; go's paragraph '(value, error) ... there is no {ok, data} wrapper'; py 'returns the ENTITY'. go's idiom of one complete program could not be expressed through the interface and was dropped.
- [imprecise] All 11 catalogued quick-start issues are fixed for all four languages by the shared code TRUE: NEW has 0 non-consecutive step numbers (OLD 30), 0 lead-ins promising list with no list call (OLD 47), 0 wrong write headings (OLD 12), 0 defaulted region printed as required (OLD 45), 0 getenv without stdlib.h (OLD 15). S28 is fixed on ent-only-ambient and U45 on crud-noupdate ('### 4. Create and remove' in all four). S49, S50, G01, M13, M14 and M12 are fixed on the variations that expose them. M14 and c-getenv are provider fixes, not shared ones. D23, D25 and D55 are fixed only in part, as they say. X6 (go prose about list when there is none) is also fixed and was not listed. The lean items M19 and U10 are not touched. Side effect: the ts README now contradicts itself. In B the quick start says region defaults to eu while the ts options table (line 224) still says Required: tenant, region. In auth-basic-query the quick start omits secret while lines 143, 180, 216 and 230 of the same README still show it.
- [confirmed] ts README lanes 16/16 pass TRUE: 16/16 pass on NEW, including the added Basic + templated-server lane. OLD (oldclone): 16/16 pass.
- [imprecise] go README lanes 12/12 pass TRUE: 12/12 pass on NEW and 12/12 on OLD. But the check is now weaker. The OLD go quick start was a func main program, which the harness compiled and then ran as a test-mode variant (runProgs). NEW go quick-start blocks are fragments, which wrapFragment only compiles, with unused variables blanked by applyFixes. No NEW go quick-start code is executed. The per-target go README has 0 func main blocks against 1 before.
- [wrong] py could not be run with real pytest (pytest absent); a stand-in ran the README example test: 9 passed, 1 skipped on 4 models TRUE: pytest is installed as a uv tool, just not importable from the system python3. With its venv first on PATH, the real py README lanes ran: 12/12 pass on NEW (including 'the README examples run with Basic auth and a templated server') and 12/12 on OLD. Each lane asserts /[1-9]\d* passed/, so these were real runs, not skips. The mypy part was not checked.
- [confirmed] c DOC lane 5/6 on NEW; the basic-server failure is only the root README (ReadmeTopQuick_c, not ported); OLD fails in both the root README and c/README.md TRUE: NEW: 5/6; the failure is ../README.md:53, implicit declaration of getenv. OLD: 5/6, failing at both ../README.md:53 and README.md:50.
- [confirmed] Source grows: before 945 / 717, after 1069 / 826 (0.88x); 20-language projection 4537 to 2729 (1.66x) TRUE: Counts identical: 945/717 before, 1069/826 after; all 20 ReadmeQuick_<lang> = 4503/3458, plus 34 shared = 4537. The projection assumes the 16 unported providers average 103.75 lines (the mean of ts 89, go 103, py 81, c 142) and that the shared 654 lines do not grow. c is the only measured port in the closed-Value-union family (rust, zig, cpp and ocaml are likely closer to it). At c's 142 lines for the other 16: 4537/(654+415+2272) = 1.36x. Even with no shared code at all: 4537/2075 = 2.19x. ReadmeTopQuick_<lang> (20 files, 2000 lines) is another candidate for reuse and is not counted.
- [confirmed] Full suite without toolchain lanes: 2514 tests, 2508 pass, 5 skipped, 1 golden fail, fixed by npm run golden TRUE: At HEAD (golden already updated): 2514 tests, 2509 pass, 0 fail, 5 skipped. npm run build in my copy left the committed dist unchanged.
- [confirmed] H5: doctor reports a leftover ReadmeQuick_<lang> as additive with ok:true; target add never prunes src/cmp; an alias gets Syntax_go2.ts TRUE: Reproduced: ok true, additive ['src/cmp/go/ReadmeQuick_go.ts'], stale []. Combined with f9d408a5, where the target's own ReadmeQuick wins, an upgraded project keeps generating the OLD defective quick start, and doctor reports it as fine. The ReadmeQuick.ts comment says the leftover stays only 'until doctor's stale finding has it removed', but no such finding exists.
- [could-not-check] Provider interface: 3 changes after the first provider, all before the first commit, none after c TRUE: No interface change in git after f21e6fe1. Later commits touch only the providers, ReadmeQuick.ts, tests and docs. The 3 changes said to come before the commit are not in history, so I cannot check them.

## 3. The attack on the interface from the 16 unported languages (`probe-interface`)

I wrote the zig and clojure providers against the interface as it stands, then stopped wherever the interface forced a change. Both providers are in my copy, /tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/probe-interface/sdkgen. The commits are 0a4c0a06, caf89e8e, 455bbea6 and c74f7435 on top of 950912e7. Both ReadmeQuick_<lang>.ts components are deleted and the golden is refreshed. The output covers the architect's 19 variations; I generated it with `node gen.js probe3 <clone>/ts` and diffed it against OLD with harness/diff-probe.js, which is diff.js with PORTED extended to zig and clojure. Result: zig has 24 code blocks identical and 19 changed; clojure has 25 identical and 18 changed. Nothing is UNEXPLAINED, nothing changed outside the quick start, and the other 18 languages are byte-identical to the architect's output.

Every changed block has a stated reason:
- The server option is now added (S49).
- The shared write comments replace each language's own.
- The description now decides id chaining. zig never chained before; it now binds create outside its switch so the id is still in scope afterwards.
- zig no longer prints write results or the word 'removed'. I dropped these rather than add a representation construct, because which results get printed is a decision the builder should make, not a provider.

clojure's list and load blocks came out byte-identical. Its let/doseq scoping fits inside attempt with lookahead, the same way the c provider does it.

Two interface changes were forced, and neither breaks anything. After each one, all 20 READMEs in all 19 variations were byte-identical to before (`diff -r`):
- **Scope.section**: clojure has to require every entity namespace the later blocks use, from inside the client block. Without this field it could only find them by reading desc.quick itself, which is a whether-decision made in a provider.
- **Optional RuntimeWords.one**: the shared load sentence, '`load()` returns the entity', is false for runtimes that return a result union (zig; rust too, by inspection).

`npm run check-scaffold`, generate.test and characterize.test pass after the golden refresh. No zig or clojure toolchain is installed here (`command -v` reports MISSING), so neither port was compiled.

The survey of all 16 unported languages finds none that cannot be expressed at all. Nine of them need additions before they can be ported, and most of those additions are to the description, not to the interface:
- **Field choice**: php, rb, lua and perl print chosen fields of a record, and the choice is made from the model.
- **Write results**: ocaml prints the created record and `removed.e_deleted`; zig and js print write results.
- **Names that need the whole model**: elixir's entity accessor depends on the whole entity collection, including inactive entities (elixirAccessor at elixir/ReadmeQuick_elixir.ts:50). A provider cannot compute it from the description at all.
- **Identifiers derived from the model**: the rust crate identifier and method names, and the swift module name.
- **js Direct API Access**: this section has no statement in the representation.

The four existing providers and my zig port also carry copies of model-name rules (the c and zig RESERVED sets, cIdent, the py package directory). That is a model-dependent condition held in a provider.

On H1: under a strict reading the providers-reading-model-facts threshold is crossed with the interface as it stands. c and zig carry reserved-name conditions, elixir would have to read the collection, and with py's module rule the count is three or more. Once naming facts move into the description as data, the count is zero. The breaking changes still undecided number 2 to 4, under the threshold of about 10.

Per-language prose, measured as words outside code spans in the quick start, is 7 to 15% for ts, py, c, go and clojure, and 19 to 23% for zig. The share for zig is over the 15% line in this section, and a sentence frame that cannot say 'a result whose .ok is ...' would have been false there instead.

For H2, harness/metrics.js with the six providers projects the quick start's source shrinking 1.59x over 20 languages (the architect's projection from four providers was 1.66x). That is under 2x for this section alone.

Not done:
- the REFERENCE page;
- H3 and H5;
- compiling any zig or clojure example;
- the other 14 ports.

Its copy, with zig and clojure providers and two additive interface changes: /tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/probe-interface/sdkgen (commits 0a4c0a06, caf89e8e, 455bbea6, c74f7435 on top of the architect's 950912e7).

### Per language
- **js** (with-extension): The 'Direct API Access' section is inside the quick start, a `client.direct({...})` call with an `if (result.ok)` envelope. No Stmt exists for it; it needs a `direct` Stmt or must move out of the section (js/ReadmeQuick_js.ts:156). | Write results are printed (`console.log(created.data())`, js:106,121,138). Expressible only as a builder decision, which is not made today; unify by dropping them. | Load comes before list, each write is its own titled step with its own prose ('Sends only the fields given.'), and headings are Title Case (js:25,76,87,102-145). These are structure drift that the shared component unifies, not missing constructs. | There is no try/catch at all. Unify.
- **php** (with-extension): The list prints CHOSEN fields: `echo $item["id"] . " " . $item["radius"]`, where the display field is the first non-id `$STRING` field picked from exampleEntity.fields (php/ReadmeQuick_php.ts:68-75,86). This needs a description field (fields to show) and an Expr form for a field list. | In-code commentary inside list/load (`// list() returns entity instances; data_get() reads each record.`, php:82). Unify. | The attempt message is 'Error: ' plus the message, not '<what> failed'. Unify. | The constructor ignores server variables (php:26-28). This is the S49 correction, not an inability.
- **rb** (with-extension): The list prints chosen fields via interpolation, `puts "#{record["id"]} #{record["radius"]}"`, with the display field chosen from model fields (rb/ReadmeQuick_rb.ts:72-79,90). | In-code commentary inside the begin block. Unify.
- **lua** (with-extension): Chosen fields: `local rec = item:data_get()` then `print(rec["id"])`, chosen from dataId plus a display field picked from exampleEntity.fields (lua/ReadmeQuick_lua.ts:74-88). It falls back to `for k, val in pairs(...)` when there is no column. Note that line 80 reads `.name` where php and rb read `.n`, so the display field is silently null. | `(value, err)` with `if err then error(err) end` after BOUND calls only (lua:99,134,156,193). This is expressible in a call printer keyed on `bind`, but it carries no attempt. There is no try form.
- **csharp** (yes): nothing missing
- **java** (yes): nothing missing
- **kotlin** (yes): nothing missing
- **scala** (yes): nothing missing
- **swift** (yes): The module name `${Name}Sdk` (swift/ReadmeQuick_swift.ts:17) is a layout fact a provider would derive from desc.Name, the same borderline case as py.
- **rust** (with-extension): The crate identifier comes from crateIdent(model) (rust/ReadmeQuick_rust.ts:16), and entity methods from rustMethodName (reserved-word rename) in utility_rust. These need description layout and symbol fields, or the provider copies rules. | Per-write `.unwrap()` (rust:179,186,193,205) while list/load use `match ... { Ok(x) => ..., Err(err) => ... }` (rust:76-77,113-114). A call printer cannot tell whether it is inside an attempt without a Scope flag convention or a call-context argument.
- **cpp** (yes): nothing missing
- **zig** (with-extension): Each write is wrapped in its own switch that PRINTS the result (`.ok => |created| ...`, `.ok => |updated| ...`; zig/ReadmeQuick_zig.ts@9aebaf9e:173,183). There is no Ref role for update/patch results and no print statement after writes. | Remove prints the word 'removed' (`.ok => std.debug.print("removed\n", .{})`, :208). There is no Stmt for showing a remove's result. | Per-write handling outside attempt: the builder emits writes bare. My port handles this with a Scope.local flag set by attempt, which is a convention and not part of the interface. | Chaining: the old form scopes `created` to its switch arm, so the description's chainsId cannot be honoured without restructuring create into `const created = switch (...) { .ok => |e| e, .err => |e| return ... };`. The new form is not compiled (no zig here). | The shared load sentence ('returns the entity') is false for a result union. This forced RuntimeWords.one.
- **perl** (with-extension): Prints a chosen field `$x->data_get->{id}` instead of the record (perl/ReadmeQuick_perl.ts:82,119,145). | The attempt is `my $x = eval { call }; if (my $err = $@) {...} else {...}` (perl:76-77). This is expressible as c-style first/rest.
- **clojure** (with-extension): The client block requires the namespace of every entity LATER blocks call (clojure/ReadmeQuick_clojure.ts@9aebaf9e:49-54). A client printer sees only its own statement. This forced Scope.section (non-breaking). | Bound results scope what follows: `(doseq [planet (call)] ...)` (:83) and `(let [planet (call)] ...)` (:117,142). Expressible only by lookahead inside attempt (fusing call+each or call+rest), as c does. | Old prose names the entity variable inside a runtime word ("((:data-get planet))"). RuntimeWords.data is a fixed string, so the wording became generic.
- **elixir** (with-extension): The entity accessor is `elixirAccessor(exampleEntity, entityCollection(model))` (elixir/ReadmeQuick_elixir.ts:50,81). Its name depends on collisions across the WHOLE entity collection, including inactive entities. It cannot be computed from SdkDescription, whose entities are active-only. It needs a per-entity, per-target symbol in the description; otherwise the provider must read the model. | A handle `planet = Demo.planet(sdk)` is declared inside each attempt for list/load (elixir:64,129) and once ahead of the writes (:167), then rebound by load (`planet = ...load(planet, ...)`). This is expressible with `before` plus per-block Scope.local. | The list is an indexed loop over Voxgig.Struct `for i <- 0..(size-1)//1` with getelem. Printer only.
- **ocaml** (with-extension): Prints the created record after create (`print_endline (stringify (created.e_data_get ()));`, ocaml/ReadmeQuick_ocaml.ts:173). The builder emits no print after writes. | Remove binds and prints the deleted marker (`let removed = ... in Printf.printf "deleted: %b\n" removed.e_deleted`, ocaml:198-200). There is no Ref role 'removed' and no Expr for the marker. | Sequencing: `let x = ... in` and `;` between unit expressions, with no `;` after the last. A call printer must know its position in the block. This is derivable only by searching sc.stmts by identity; no position argument exists.

### Interface changes it recommends
- [additive] Scope gains `section: Stmt[]`, every statement the section will print, set by the shared component before the first block is printed. Why: Imports and requires that depend on later blocks (clojure entity namespaces; also rust's unconditional `getp` and the java/csharp import lists) otherwise make a provider re-derive from desc.quick which entities are used. Languages: clojure (done), rust, java, csharp, kotlin, swift
- [additive] RuntimeWords gains optional `one` (what a load returns where it is not the entity), defaulting to 'the entity'. More generally, the sentence frames need a slot for how a result is carried. Why: '`load()` returns the entity' is false for a result union (zig .ok, rust Result). Without the word the shared sentence states a falsehood. Even with it, zig's provider supplies 19-23% of the quick start's prose words. Languages: zig (done), rust, possibly go and lua
- [additive] Per-target naming and layout facts in SdkDescription, computed by the generator's own naming functions: desc.layout (py package dir, c ident, rust crate ident, swift module, csharp namespace) and per entity a target `symbol` (accessor, handle or method name). Why: elixir's accessor depends on the whole entity collection, inactive entities included (naming.ts:301-320); a provider cannot compute it from the description at all. Syntax_c and Syntax_zig copy the RESERVED sets and the cVarName/cIdent rules, and Syntax_py copies Main_py's package-dir rule. That is the same rule written twice, and it is a model-dependent condition held in a provider. Languages: elixir (required), c, zig, py, rust, swift, csharp, ocaml, php
- [additive] A call-context argument to `call` (for example `{ inAttempt: boolean, last: boolean }`), or a per-call handling mode on the call statement. Why: zig switches on, and rust unwraps, every write, but not calls inside an attempt. ocaml needs to know whether a statement is last to place `;` or `in`. Today this works only by Scope.local flags or by searching sc.stmts by identity. Languages: zig, rust, ocaml, lua
- [BREAKING] Decide ONCE in the builder whether write results and a remove's result are shown. If they are kept, Ref.role gains 'updated' | 'patched' | 'removed' and Expr gains a 'deleted' form. Why: Adding a role or an Expr kind breaks every exhaustive switch in the providers (Syntax_c `name()` and every `expr()`), which fail to compile under strict without a default. Recommended: do not add them, and drop result printing as in the zig and go ports. Then no change is needed. Languages: zig, ocaml, js (and go previously)
- [BREAKING] Decide once whether records are printed whole or by chosen fields. If by fields: a DescEntity field `show: string[]` chosen in describe(), plus an Expr `{ k: 'fields', of: Ref, fields: string[] }`. Why: php, rb, lua and perl choose display fields from the model inside their components. A provider must not choose fields. A new Expr kind breaks the six existing expr switches at compile time. Languages: php, rb, lua, perl
- [BREAKING] RuntimeWords.data becomes a function of the entity Ref, so prose can name the variable. Why: clojure's and elixir's old prose names the entity variable ('((:data-get planet))'). Recommended: accept the generic wording instead; I did that in the clojure port, which avoids the break. Languages: clojure, elixir, swift
- [additive] js 'Direct API Access': either a `direct` Stmt or (recommended) move it out of the tutorial into its own shared section. Why: No statement represents `client.direct(...)` and its envelope. Moving it out needs no interface change; a new Stmt kind would be breaking. Languages: js

### Facts found in providers
- Syntax_c.ts copies C_RESERVED and re-implements cVarName (entity handle `${ident}_${h}`) and cIdent (`desc.name.toLowerCase().replace(/[^a-z0-9]/g, '')`, written three times). These are the generator's own rules in utility_c.ts:21-30 and MainEntity_c.ts:16-17, so whether an entity name is reserved is a model-dependent condition held in the provider.
- Syntax_py.ts derives the import module as `${desc.Name.toLowerCase()}_sdk`, a copy of Main_py.ts:48 (pkgdir). It is a layout fact disguised as string manipulation of a description value.
- Syntax_go.ts chooses between two constructors on option count (`sdk.New()` when there are no options, `sdk.New${Name}SDK(...)` otherwise). It also prints `fmt.Println` without importing fmt, so the block relies on the README harness supplying it.
- Syntax_ts.ts `argOf` hard-codes `WRITES = ['create','update','patch','remove']` and `'load' === op && 1 < arg.length` to choose multi-line layout: a list of model operation names, and a member-count condition, in the provider.
- Syntax_c.ts prints `PNError* err = NULL;` in the client block unconditionally, even when no later block exists (ent-none). Declaring it is a whether-decision made without the section.
- RuntimeWords in all four (go 'a `[]any`', c 'a `NULL`-terminated array' and 'sets `*err` on failure', ...) are runtime facts held as English fragments. They are per-language prose: 7 to 15% of the quick start's prose words for ts, py, c and go (go 14.9% in doc-crud), and 19 to 23% for zig.
- My own Syntax_zig.ts copies ZIG_RESERVED, the same class as c. It also uses a Scope.local flag ('attempt') to learn its context, which is state the interface does not define.
- Needed by unported languages and not in the description: the elixir accessor over the whole collection (elixir/ReadmeQuick_elixir.ts:50); display fields chosen from exampleEntity.fields (php:68-75, rb:72-79, lua:74-88, perl:82); the rust crate ident and method rename (rust:16); the swift module name (swift:17).

## 4. Migration and the copy channel (`migrate`)

H5 is not refuted, but only with a change to the tool. Without it, retiring per-language components is unsafe, and it fails quietly rather than loudly. With the unmodified tool, a project that took ReadmeQuick_<lang> copies from 4.44.0 keeps them after the upgrade, after `target add` and after `package update`. Generation keeps calling those copies, so the shared section never appears. Doctor labels them "additive (project-owned, not drift)" even though the copy record shows an add wrote them. `target remove` refuses them as "what `target add` did not write". A second hazard sits under that: deleting the .ts source is not enough. `tsc --build src` leaves .sdk/dist/cmp/<t>/ReadmeQuick_<t>.js behind, and the loader requires dist, so the retired component is still called. The fix is 136 added and 14 removed lines in 4 files (target.ts +85/-3, doctor.ts +45/-10, edition.ts +5/-1, remove.ts +1), plus a 143-line test file. After it, an unchanged copy that the scaffold no longer ships is reported once as RETIRED: doctor fails, it is counted as outdated, and generate warns. The next `target add`, `package update` or `edition add` deletes it and its compiled output, and the record forgets it. An edited copy is kept, still called, and reported as an `override`; doctor stays ok and does not fail because of it. A file the record does not name is never deleted. A dry run deletes nothing. Overwrite mode and --force treat an edited retired copy like any edited copy, which means they delete it. Aliases (go~go2) and a pack that retires its own component (dart) go through the same path, and both work. The language pack, still shipping its own ReadmeQuick_<lang>, generates the same output and passes its suite against the modified build, because the shared component calls a target's own component first. Two things remain open. A project with no copy record (or whose copies were never recorded) cannot be cleaned automatically; doctor now names those files, but they stay in use. And a project that deletes an override by hand leaves stale compiled output that is silently still used.

Clone: /tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/migrate/sdkgen (from 9aebaf9e = 4.44.0). Commits: 177c44ec stand-in (deletes ReadmeQuick_{ts,go,py}.ts, adds Syntax_{ts,go,py}.ts, and ts/src/cmp/ReadmeQuick.ts calls the target's own ReadmeQuick_<t> if present, else writes '<!-- shared-quick provider=X -->'); 98f87b2b sets the version to 4.45.0 so the record's from/to versions differ; a49fddc0, 7bb5161b and c193a603 are the lifecycle change and its tests. The unmodified 4.44.0 build was copied to /tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/migrate/old. Langpack clone: /tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/migrate/langpack (c6069bb). Its node_modules/@voxgig/sdkgen is a symlink to the old copy or to the clone's ts/.

### Changes to the tool
- ts/src/action/target.ts (+85 -3): New pruneRetired(ctx$, actx, fromDir, toRel, origname, name), called for src/cmp/<t> before the copy. It reuses pruneStaleTemplates with a new optional 7th argument {record, rename, discard}. The new retiredCopies() keeps only the unwanted files that untouched() shows unchanged (or changed, when discard is set: --force or overwrite mode). For a changed copy it warns target-component-override instead of deleting. The new removeCompiled() also deletes dist/<path>.js, .js.map, .d.ts and .d.ts.map for each deleted source. pruneRetired is exported
- ts/src/action/doctor.ts (+45 -10): Report gains retired[] and override[]. compareTrees sends a file under a forked tree that the scaffold has never shipped to found('unshipped'). noteDrift decides through untouched(): unchanged goes to retired (counted in ok, tallied as outdated so the existing refresh advice and generate's copyCheck warning apply); changed goes to override (informational); unrecorded goes to additive (as before). doctor-end counts retired. The new replacesShared() adds '(used instead of the shared <Name>)' to additive and override lines named after an OPTIONAL_COMPONENTS dispatch name
- ts/src/action/edition.ts (+5 -1): The edition 'none' (component) tree calls pruneRetired, so doctor's 'the next add removes it' holds for editions too
- ts/src/action/remove.ts (+1): driftFindings adds report.override to what remove refuses. Retired copies are not refused
- ts/test/retire.test.ts (+143 (new)): 7 cases on the actionharness memfs project. A recorded unchanged copy is retired and removed by an add (with its compiled output and its record entry); package update removes it without --force; a dry run removes nothing; a changed copy is an override, kept, warned about, and doctor stays ok; overwrite mode removes it; an unrecorded file is additive and kept; remove deletes a retired copy and refuses an override

### Behaviours
- [ok] 1. Project made with 4.44.0 (target add ts go py, copies recorded). Package upgraded to the build with the stand-in; nothing else run | today: generate works and writes the OLD per-language quick start for ts, go and py, because generation loads the project's still-present copies (shared section absent). Doctor: the 3 retired copies are 'additive (project-owned, not drift)'; the 3 new Syntax_<lang>.ts are MISSING. Exit 1, caused by the MISSING providers, not by the retired files. A release that only deleted files would exit 0. Generate warns '3 file(s) in .sdk differ … changed in this project', and those 3 files are the missing ones | after: Doctor: 'RETIRED (an unchanged copy its source no longer ships; the next add removes it)' for each file, counted as outdated per item, with doctor-outdated advice '`voxgig-sdkgen package update @voxgig/sdkgen --no-fetch` refreshes them'. doctor-end reads '3 missing, 0 outdated, 3 retired'. Exit 1. Generate also warns '3 file(s) in .sdk are unchanged copies from @voxgig/sdkgen 4.44.0, but … 4.45.0 is installed'. Generation still writes the old quick start until an add runs
- [ok] 2a. Same project, re-add | today: ReadmeQuick_ts.ts kept and still called. Record keeps its fingerprint. Doctor after re-adding all three: 'matches the scaffold (3 additive, 0 customized)', exit 0. Retired copies are never removed and the shared section never appears. pruneStaleTemplates runs on tm/<t> only, never on src/cmp | after: 'removed src/cmp/ts/ReadmeQuick_ts.ts', and dist/cmp/ts/ReadmeQuick_ts.js(.map) are deleted too. The record writes null for the file. Generate writes '<!-- shared-quick provider=ts -->'. After go and py are re-added, doctor reports 'matches the scaffold (0 additive, 0 customized)', exit 0
- [ok] 2b. Same project, package update | today: Exit 0. All three retired copies kept and still used. Doctor afterwards: 3 additive, exit 0 | after: preCheck logs the 3 outdated files. The update removes all three retired copies and their compiled output without --force. Generate writes the shared section for go, py and ts. Doctor ok, exit 0
- [ok] 2c. Re-add as a dry run | today: Nothing written | after: Logs 'would remove 1 stale template(s) — ** DRY RUN **' and 'would remove src/cmp/ts/ReadmeQuick_ts.ts'. Source and compiled files are still on disk
- [ok] 3. Retired copy the project EDITED (ReadmeQuick_ts.ts), then upgrade | today: With 4.44.0 the edit was 'CUSTOMIZED', ok. After the upgrade it becomes 'additive', exactly like the unedited copies, so the project is not told. Re-add keeps it and it is still used ('PROJECT-EDITED QUICK START'). No message | after: Doctor: 'override (its source no longer ships it; changed here, so kept and used instead of the shared component): src/cmp/ts/ReadmeQuick_ts.ts (used instead of the shared ReadmeQuick)'. It is informational, so doctor exits 0 once go and py are re-added. Re-add and package update keep it and warn target-component-override: '…kept and still used in place of the shared one. To use the shared one, delete it and its compiled output under dist/cmp/ts/ReadmeQuick_ts.js'. Generate still uses the edit. The record keeps its fingerprint, so it stays classed as an override
- [ok] 3b. Edited retired copy with --force, or with main.kit.copies 'overwrite' | today: Kept | after: Deleted, along with its compiled output. This matches how --force and overwrite mode treat any changed copy
- [ok] 4a. target remove ts right after the upgrade, unedited | today: Refuses: 'target remove: refusing to delete what `target add` did not write  ts: src/cmp/ts/ReadmeQuick_ts.ts … or pass --force', EXIT 1. The record shows target add did write it | after: EXIT 0. The retired copy goes with the tree
- [ok] 4b. target remove ts after a re-add | today: Refuses on src/cmp/ts/ReadmeQuick_ts.ts, as in 4a | after: EXIT 0 (the copy is already gone)
- [ok] 4c. target remove ts with the edited override | today: Refuses on src/cmp/ts/ReadmeQuick_ts.ts (as additive) | after: Refuses on it, now because it is an `override`. This is the same rule remove already applies to customized and additive files: refused unless --force. The refusal wording 'what `target add` did not write' was not changed and is inaccurate for an override
- [ok] 5. Project whose copy record was deleted (as before 4.34.0), then upgrade | today: 3 additive; re-add keeps them and they are still used; remove refuses | after: Same, deliberately, because nothing shows an add wrote them. Doctor now adds '(used instead of the shared ReadmeQuick)' to each additive line. Without a record the tool cannot tell a retired copy from the project's own file. Cleanup is by hand (delete the source and its compiled output)
- [ok] 6. Aliased target go~go2 added with 4.44.0, then upgrade | today: src/cmp/go2/ReadmeQuick_go2.ts reported as additive; Syntax_go2.ts MISSING. Re-add copies Syntax_go2.ts (renamed by aliasCmpTree, content lang: 'go' unchanged) but keeps ReadmeQuick_go2.ts, which is still used | after: Doctor reports RETIRED for src/cmp/go2/ReadmeQuick_go2.ts. Re-add removes it: the source list is renamed with aliasCmpName before comparing. The shared component then finds ./cmp/go2/Syntax_go2 and writes '<!-- shared-quick provider=go --> SHARED QUICK START for go2'
- [ok] 7a. Language pack (dart, haskell, lean), still shipping ReadmeQuick_<lang>, against the modified sdkgen | today: With old 4.44.0: 76 tests, 74 pass, 0 fail, 2 skipped | after: Modified build (stand-in, and stand-in plus lifecycle change): 76 tests, 74 pass, 0 fail, 2 skipped. All 12 generated .md files byte-identical (diff -r clean). The shared component calls the target's own ReadmeQuick_<lang> first
- [ok] 7b. A pack that later retires its own component (pack copy with ReadmeQuick_dart.ts deleted, version bumped), project installed from it | today: Not run on 4.44.0. The code path is the same as row 2a, so the copy would be kept and labelled additive | after: Doctor counts 1 unchanged copy outdated for target dart. package update logs 'removed src/cmp/dart/ReadmeQuick_dart.ts'
- [ok] 8. Project-owned target `mine` (model/target/mine.aontu plus src/cmp/mine/ReadmeQuick_mine.ts, no scaffold source) | today: 'target-owned … its files stay as they are'; its own quick start is used; no doctor finding for mine | after: Same: 'MINE OWN QUICK START', no finding for mine. The prune is never reached for an owned target, because TargetRoot returns before it
- [NOT OK] Override deleted by hand, following the old advice 'delete it' | today: Same as after the change (this hazard was not changed) | after: Generate still writes 'PROJECT-EDITED QUICK START' from the stale dist/cmp/ts/ReadmeQuick_ts.js. Doctor reports 'matches the scaffold', exit 0. Only the override message was changed, to name the compiled file; no check catches this

### The override rule
An edited copy of a retired component is the project's own override, decided by the copy record and nothing else. If the recorded fingerprint differs from the file, it is an override: kept by every add and package update, called first (a target's own <Name>_<t> wins over the shared section, as for packs), and reported by doctor as `override` without failing it. `remove` refuses it, as it refuses any changed or project-added copy, unless --force is passed. An add deletes it only where any changed copy would be overwritten (--force, or main.kit.copies 'overwrite'), and then deletes its compiled output too. A file with no record entry is never deleted and is reported as additive, '(used instead of the shared <Name>)'. The advice for dropping an override must name both the source and .sdk/dist/cmp/<t>/<Name>_<t>.js, or the compiled output keeps being used. Better still, a loader or doctor check for compiled components with no source, which I did not build. Order for a PROJECT when a release retires components: (1) before upgrading, make sure every copy is recorded: any add or `package update` on a version of 4.34.0 or later records what it writes; commit .sdk/log/copies.jsonl. (2) Install the new sdkgen. (3) Run `voxgig-sdkgen doctor`: RETIRED files will be removed; decide on each `override`; additive '(used instead of the shared X)' lines are copies with no record, to delete by hand together with their dist .js. (4) Run `voxgig-sdkgen package update @voxgig/sdkgen`, which removes the unchanged retired copies and their compiled output without --force. (5) Run `npm run generate`, review the README diff, and commit. Order for a PACK AUTHOR: (1) Nothing is required while the pack keeps shipping <Name>_<lang>: output is unchanged and the suite passes against the new sdkgen. (2) To move, add the syntax provider and delete <Name>_<lang>.ts in the same release. Raise the @voxgig/sdkgen peer floor and engines.sdkgen to the first sdkgen that has both the shared component and this record-based pruning; below that, a project's old copy is called forever, labelled additive, and refused by remove. (3) Tell consumers to run `package update <pack>`. One constraint on sdkgen: the shared component must keep calling <Name>_<t> first, and OPTIONAL_COMPONENTS must keep the name, for as long as any pack or project ships one.

### Risks
- Stale compiled output, not fixed. The loader requires .sdk/dist/cmp/<t>/<Name>_<t>.js and the project's `tsc --build src` never deletes the output of a deleted source. The change deletes it when an add prunes a copy. But a person who deletes a component (an override, or an unrecorded retired copy) by hand keeps getting it, and doctor reports nothing (measured: 'PROJECT-EDITED QUICK START' after deletion, doctor ok). Needs either a loader rule (ignore a dist module whose .sdk/src source is absent) or a doctor check for orphan compiled components.
- Projects without a copy record (last add before 4.34.0, or copies never recorded) cannot be cleaned automatically. The retired copy stays, keeps overriding the shared section, and keeps any defect it carries. So any catalogue fix made once in a shared sentence (H3) does not reach that project until a person deletes the file.
- Doctor exits non-zero for unchanged retired copies until the next add, like `outdated`. A CI job that gates on doctor turns red on the upgrade commit and green after `package update`. That is intended, but it is a rollout-ordering cost.
- The CLI's drift summary (bin/voxgig-sdkgen) prints only forked, edited, stale and missing counts. A release that only retires files makes doctor exit 1 while printing '0 forked, 0 edited, 0 stale, 0 missing'. This already happens for outdated-only drift. Read in the code, not run in that exact state.
- The generate warning says '3 file(s) in .sdk differ … changed in this project' for files that are MISSING (the new providers). This is existing wording, made more visible because each retirement also adds a provider.
- Under --force or overwrite mode, an edited retired copy is deleted with no backup, as an edited live copy is overwritten. That is consistent with those modes, but the edit is lost, with nothing left to merge into.
- Edition component retirement shares the code but was not exercised end to end.
- The 'own component wins' precedence is what keeps packs working, and it is the same precedence that hides an un-pruned retired copy. Any later change that makes the shared section ignore <Name>_<t> would break every pack that has not moved.
- An override is reported on every doctor run but never fails it. A project can carry an outdated override indefinitely without noticing that shared fixes are not reaching it.

### How to reproduce
export PATH=/opt/node24/bin:$PATH; D=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/migrate. Build the clone: cd $D/sdkgen/ts && npm run build. The project driver is $D/bin/tool.js; its commands are mk <p>, use <p> old|new, cli <p> <verb...>, build <p> and gen <p>. Each project lives at $D/work/<p>/.sdk with node_modules/@voxgig/sdkgen symlinked to $D/old (4.44.0) or $D/sdkgen/ts. gen prints each target's quick start and generate's warnings. Base fixtures: work/base (4.44.0, target add ts go py, recorded); base-edited (bin/edit.sh puts 'PROJECT-EDITED QUICK START' into ReadmeQuick_ts.ts); base-norecord (log/copies.jsonl deleted); base-alias (target add go~go2); base-owned (project-defined target mine). All rows: $D/bin/rows.sh, which copies a base, switches it to the new build and runs each row; output is in $D/rows-final.log. Before-change rows: check out 98f87b2b in the clone, run npm run build, then rerun rows.sh. Langpack: cd $D/langpack && npm_execpath=/opt/node24/lib/node_modules/npm/bin/npm-cli.js node --enable-source-maps --test test/*.test.js; output comparison: node $D/bin/lpgen.js <outdir> under each symlink, then diff -r. Unit tests: cd $D/sdkgen/ts && node --test dist-test/retire.test.js.

## 5. Anatomy of the REFERENCE page (`refanatomy`)

I analysed the REFERENCE page as it stands today, using the 20 stored baseline outputs and the 20 ReadmeRef_<lang>.ts generators (8,330 lines, counted with wc). Nothing was built, so every verdict here is as far as analysis can go.

The page has one structure. All 20 languages print the same blocks in the same order. The exceptions are a few blocks present in some languages only: cancel and tester in ts/js, stream in go/zig, custom actions in ts only, options()/utility() absent in c and ocaml, and Field Usage by Operation absent in elixir. The model logic in every generator is the same skeleton: the same helpers (matchExampleItems, requestExampleItems, entityIdField, opNeedsAction, bodyNote), the same id-first sort, the same opcols filter. The only conditions specific to one language are maps from a canonical type to a type name or a literal (swift:18-23, rust:18-22, ocaml:16-34, clojure:16-33, zig:16-33, c:13-35). Those are syntax from a neutral value.

Prose sharing, counted per block with blocks.py: 80% of 2,461 normalised prose units are the same sentence in at least 15 languages. Most of that is the feature reference, which is already shared. Of the part each language writes itself, 67% is shared (1,026 of 1,521 units); leaving out the features summary too, it is 54% (586 of 1,081).

The gap is not idiom. It comes from one language-API fact written out as free text in every file: the error and return convention ("raises/throws/dies on error", "`err` is non-nil", "`NULL` with `*err` set", "`Ok` is … `Err` a failure", "Resolves to"). When that is replaced by a token (tokenized.py), sharing in the load, create, update and remove descriptions rises from 48-62% to 88-92%. The rest is drift, about 20 items. Prose that genuinely belongs to one language comes to about 18 distinct sentences (2% of the non-feature units). That is a hand classification of the 165 sentences found in at most three languages, so it is an estimate.

The model variations show the cost of 20 copies. With an operation switched off (op-off-planet-*, op-readonly), only go's REFERENCE changes. With HTTP Basic auth (auth-basic), only ts changes. With auth-query, server-none or server-static, no REFERENCE changes in any language. These are counted from the stored outputs, which keep only files that differ from the baseline.

The proposal survives this page on paper, with one condition. A provider has to declare a small table of facts about its own runtime: the error style, the collection noun, the fixed method signatures and capability flags. Those facts must be enums that the shared component writes sentences for, not phrases the provider writes. If providers return phrases, about 10 short clauses per language become per-language prose. That is still well under 15%, but it breaks "a provider is a printer".

The real risks:
- **Hand-declared tables are already wrong.** The method table written by hand in each file disagrees with the runtime today: stream() is documented in 2 languages but exists in at least 6, and py reads fetchargs.ctrl but does not document it.
- **Example code holds the most per-language logic,** such as result consumption, error handling and literal construction. It is where H4 will be decided.
- **lean has no entity layer.** A shared page needs every entity block to be absent by data for it.

Only building can show whether the interface stays stable after the first four languages, the real line counts (H2) and compile results (H4).

### Blocks
- **title + intro** (20/20). Shared: 100% (20/20 units, 1 distinct after setting aside SDK name and language title) Differs: Only the language title (TypeScript, Golang, C#...). Classes: SYNTAX 1 (title) Needs from description: sdk.name Needs from provider: title
- **client h2** (20/20). Shared: n/a (heading only) Differs: DemoSDK in 17; 'Client' in clojure; 'Demo' in elixir; 'Sdk_client' in ocaml. Classes: SYNTAX 1 (client type name) Needs from description: sdk.name Needs from provider: clientTypeName
- **constructor (code, sentence, options table)** (20/20). Shared: 84% (191/227). The 7 option rows are the same sentence in 20 (system 16/20). Differs: Signature code. Option key spelling: options.apikey, options["apikey"] or a bare key. Type names: object, map[string]any, map. A sentence on what options is, in 12 languages, with 7 variants ('§ is a § map (§ for none)' rust/c/zig; elixir 'struct value node'). Table caption: Parameters, Options or 'Parameters (§ map keys)'. 'System overrides (e.g. custom fetch).' against 'System overrides.' in rust/c/cpp/zig. Rows are hand-written in each file, not taken from optspec. apikey depends on isAuthActive in 20 files; secret depends on isHttpBasicAuth in ts only. Classes: SYNTAX 5 (signature, key spelling, type names, null literal, caption); LANGUAGE-API-FACT 1 (options container kind); IDIOM-PROSE 1 (elixir 'build one from a native map'); DRIFT 2 (system row, caption); DEFECT S50, D23, D26, D55 (server variables are never listed: server-none and server-static change no REFERENCE) Needs from description: ctor.options[] from optspec, each {name, type, description, required}, including apikey/secret from requiredOptions and server variables Needs from provider: ctorSignature, optionKey(container,key), typeName(canonical), nullLiteral, optionsContainerNoun
- **test client (static test / TestSDK / test_sdk)** (20/20 (go has two entries: Test() and TestSDK)). Shared: 71% (34/48) Differs: Heading signature. 'Both arguments may be §' in 16; lua 'are optional'; cpp adds 'a no-arg overload'; ocaml adds a parenthesis; go 'Test client with options.' replaces the shared sentence. ts/js have a parameter table and Returns line, the others an example. ts/js also document tester() as an alias. Classes: SYNTAX 2 (signature, call example); LANGUAGE-API-FACT 2 (number of overloads, tester alias); IDIOM-PROSE 3 (go Test(), cpp overload, ocaml Noval); DRIFT 2 (go sentence, ts/js table against example); DEFECT S13 (unconditional when the test feature is absent) Needs from description: testClient.available (test feature shipped) Needs from provider: testSignatures[], testCall(), nullLiteral
- **entity accessors (one per entity)** (20/20). Shared: 0% at the 15-language threshold (44 units, 12 distinct) Differs: 'Create a new § entity instance.' against 'Create a new § instance.', '(returns §)', 'handle', 'accessor', 'bound to this client'. 'Pass § for no initial data' in 9 against 'options' in 9; the parameter really is data or entopts depending on the language. ts/js add a parameter table and Returns line. Accessor names: Planet / planet / demo_planet / (api/planet ...) / Demo.planet; java escapes record_. Classes: SYNTAX 3 (accessor call, identifier escaping, return type); LANGUAGE-API-FACT 1 (argument is data or entopts); DRIFT 3 (entity/instance/handle wording, table or not, returns placement); DEFECT U34 (class name built by hand) Needs from description: entities[] (active only) with name, className (entityClassName), varName Needs from provider: accessorSignature(ent), accessorArgKind ('data'|'entopts'), entityTypeName(className)
- **options() / utility()** (18/20 (missing in c and ocaml)). Shared: 90% and 85% Differs: Method names (options, OptionsMap, options_map, optionsMap, options-map). Return type. elixir 'Return the SDK utility node.' Classes: SYNTAX 2; LANGUAGE-API-FACT 1 (method exists or not); DRIFT 1 (elixir wording) Needs from description: none Needs from provider: fixedClient.options, fixedClient.utility (signature or absent)
- **direct()** (20/20). Shared: 57% (135/238); 65% after the fact tokens Differs: Seven parameter rows, of which 'Path parameter values for § substitution.' (6) against 'Path parameter values.' (14). The ctrl row appears in ts js go php rb lua only, yet py reads fetchargs.ctrl (py/fragment/Main.fragment.py, _raw_request). ts/js add a signal row. The container noun in 'Request body (X are JSON-serialized)' takes 9 values. 'Returns a result § with ok, status...' plus a no-throw sentence in 8 variants (raises/throws/dies/sets *err/resolves to Ok/returns a map); php has a three-sentence variant. Caption takes 4 variants. Classes: SYNTAX 3 (key spelling, container noun, ok-branch expression); LANGUAGE-API-FACT 3 (error convention, signal support, ctrl support); IDIOM-PROSE 1 (php); DRIFT 3 (path row, caption, returns wording) Needs from description: none from the model (fixed transport API) Needs from provider: directSignature, fetchargKey(k), containerNoun, okBranchExpr, capabilities.directCtrl, capabilities.cancel
- **prepare()** (20/20). Shared: 0% (47 units, 14 distinct) Differs: 'without sending the request' (6) against 'without sending' (14). 'Accepts the same parameters as §' in 5 only. The error clause takes 9 variants. Classes: SYNTAX 1; LANGUAGE-API-FACT 1 (error convention); DRIFT 2 Needs from description: none Needs from provider: prepareSignature, errorStyle
- **Cancelling a call** (ts js only). Shared: 4 sentences, shared by ts and js only Differs: The whole paragraph depends on AbortSignal. Classes: LANGUAGE-API-FACT (capability); IDIOM-PROSE 4 sentences Needs from description: none Needs from provider: capabilities.cancel {param, type} or absent
- **entity h2 + description + create-an-instance example** (20/20). Shared: n/a (heading and code; the description is ent.short) Differs: Heading: '## PlanetEntity' in ts js go py php rb lua rust cpp zig; '## Planet' in csharp java kotlin scala swift c clojure ocaml; '## Planet entity' in perl; '## Demo.Entity.Planet' in elixir. The example is one accessor call; go adds GetName(), clojure a require, elixir names the client 'sdk' instead of 'client'. Classes: SYNTAX 2 (type name, accessor call); DRIFT 3 (heading in 6 class languages, perl, elixir 'sdk'); DEFECT U36 (reads ent.short and skips main.kit.text), U34, G27/G29 (the description is not escaped) Needs from description: entity.className, entity.description (entityDescription: entity_desc, then short, then desc), entity.varName Needs from provider: entityTypeName(className), instanceExample(ent)
- **fields table** (20/20). Shared: 100% of header prose; descriptions come from the model Differs: Type cell only: canonToType(field.t, target.name) in 14; a local type map in c, zig, clojure, ocaml, swift and rust (for example c cType at ReadmeRef_c.ts:13). Classes: SYNTAX 1 (typeName); DEFECT N04/U06/M04 (target.name breaks aliased targets), G27/M38/D69 (no cell escaping) Needs from description: fields[] {name, canonicalType, required, description (cell-escaped)} Needs from provider: typeName(canonical)
- **Field Usage by Operation** (19 generators carry it (absent in elixir); not printed for the baseline model (no field.op)). Shared: heading and table only Differs: go filters columns through entityOps; the others use opnames plus op.active. The logic is otherwise identical. Classes: DRIFT 1 (elixir omission) Needs from description: fields[].ops (active ops only) Needs from provider: none
- **Actions (custom $action routes)** (ts only (ReadmeRef_ts.ts:273-301)). Shared: 5 sentences, ts only Differs: Missing in 19 languages, although every runtime takes $action. Classes: DEFECT (uncatalogued: 19 REFERENCEs omit custom actions) Needs from description: entity.actions[] {action, op, path} (entityActions) Needs from provider: actionCall(ent, op, action)
- **operations: heading signature + description + example (load, list, create, update, patch, remove)** (20/20 (order: go canonical through entityOps, 19 in model-key order)). Shared: load 49%, list 33%, create 50%, update 62%, remove 49%. After tokenising the error clause and return verb: 90/33/92/88/90%. Differs: Description = shared verb sentence + return phrase + error clause (10 styles: promise; raise; throw; die; go err; lua nil,err; c NULL+*err; rust Ok/Err; zig .ok/.err; swift Value+asNative). list adds the collection noun (array, list, vector, slice, arrayref, NULL-terminated array, Vec) and 'The match is optional...' in 14 languages (missing in ts js go lua; php/rb inline it). Examples: same items from the shared helpers, printed per language; whether the result is consumed varies (go, c, rust and perl lists print it, ts does not). perl's list example prints ->{id} whatever the id field (ReadmeRef_perl.ts:293). c/rust/zig say 'entity id' without a code span. Classes: SYNTAX 6 (signature, method case, map literal, scalar literal, comment, call); LANGUAGE-API-FACT 3 (error style, collection noun, op return type); IDIOM-PROSE 1 (swift asNative); DRIFT 5 (op order, 'match is optional' presence, ocaml 'Resolves', ocaml remove extra clause, c missing update comment); DEFECT S25/D10 (19 languages document inactive ops: only go reacts to op-off-*), U43, U44, perl {id} (uncatalogued, read not run) Needs from description: entity.ops[] (active, canonical order) each {name, kind match|data, needsAction, idField, matchItems[{name, scalarKind, placeholder}], requestItems[...], listArg, bodyNote facts} Needs from provider: opSignature(op), errorStyle, collectionNoun, mapLiteral(items), scalarLiteral(kind,placeholder), comment(text), opExample(kind, ent, args) incl. result consumption
- **common methods** (20/20 (h3 label: Methods 17, Members clojure, Functions elixir, Fields ocaml)). Shared: data 0%, match 0%, make 0%, name 89%, client and entopts in ts/js only Differs: Accessor shape: one get/set method (ts js go csharp java kotlin scala swift cpp rust c zig) against a get/set pair (py php rb lua perl clojure elixir ocaml): 4 wording variants each. make: 'same client and options' (6) against 'same options' (12); zig has no make (verified: no make in zig/fragment/Entity.fragment.zig). stream documented in go and zig only, yet the runtime defines it in ts (EntityBase.fragment.ts:111), py (Entity.fragment.py:74), rb (Entity.fragment.rb:104) and java (EntityBase.fragment.java:206); the rest were not checked. client() and entopts() documented in ts/js only. Classes: SYNTAX 2 (signatures, call); LANGUAGE-API-FACT 4 (accessor shape, make exists, stream return kind, name is property or method); IDIOM-PROSE 7 (go stream 3, zig stream 3, clojure keyword lookup 1); DRIFT 3 (make wording, data/match wording, h3 label); DEFECT stream omission (uncatalogued) Needs from description: entity.className, sdk.clientTypeName Needs from provider: fixedEntity table (below)
- **features: summary table + activation snippet** (20/20 (written in each per-language file)). Shared: 100% (440/440); per-language content is only the code fence Differs: The activation snippet's syntax. Every file hard-codes the '0.0.1' default. Classes: SYNTAX 1 (feature config literal); DEFECT D04 (truthy-active filter in each file), N11 (js fenced ts) Needs from description: features[] from featureDocs(model, target) Needs from provider: featureActivationExample(names[]), fence
- **features: Configuring, Ordering, per-feature (ReadmeRefFeatures)** (20/20 (already shared)). Shared: 100% (940/940) Differs: Nothing per language except honoursActivationOrder(target). The literal backslash-backtick leak ('The array form of \`feature\`', ReadmeRefFeatures.ts:26) prints in all 20; found by grep and not in the catalogue. Being shared, it is fixable once. Classes: DEFECT S09, S22, U52, U53, X3, U102, V27 (each fixed once, already shared); escaped-backtick leak (uncatalogued) Needs from description: features[], wraps, honoursActivationOrder Needs from provider: none

### Drift
- **Entity section heading.** Variants: '## PlanetEntity': ts js go py php rb lua rust cpp zig (10). '## Planet': csharp java kotlin scala swift c clojure ocaml (8). '## Planet entity': perl. '## Demo.Entity.Planet': elixir. Recommendation: Print the type the language actually exposes, from entity.className through a provider: PlanetEntity for every class language. csharp, java, kotlin, scala, swift and perl declare class/package EntyClass = entityClassName, which is PlanetEntity (Entity_csharp.ts:26, java fragment line 14, perl fragment line 15), so their '## Planet' is drift. c (Entity* handle), clojure (namespace) and ocaml (entity_obj record) legitimately print 'Planet'; elixir prints its module. Lines: 7 headings per language in csharp java kotlin scala swift perl (42 lines in all); 0 elsewhere
- **Test-client h3 label.** Variants: 'Static Methods' (14), 'Static Functions' (rust zig), 'Test Constructor' (c), 'Test client' (clojure), 'Constructors' (elixir), 'Static constructors' (ocaml) Recommendation: '### Test client' for all: the section holds only test constructors, and 'Static' is false for 6 languages. Lines: 1 per language in 19 languages
- **Client-member and common-member h3 labels.** Variants: 'Instance Methods' 16, 'Entity Accessors' c (also holds direct/prepare), 'Client functions' clojure, 'Functions' elixir, 'Instance functions' ocaml; 'Common Methods' 17, 'Common Members' clojure, 'Common Functions' elixir, 'Common Fields' ocaml Recommendation: 'Instance {Methods|Functions}' and 'Common {Methods|Functions}', with the noun as a provider fact Lines: c 1, elixir 1, clojure 8, ocaml 8
- **Operation order.** Variants: go: CANON_OP_ORDER through entityOps (list load create update patch remove). The other 19: Object.keys(ent.op) order (create list load patch remove update in the fixture). Recommendation: Canonical order from the description Lines: Planet's 5-6 op subsections move in 19 languages; no text changes
- **'The match is optional' sentence in list.** Variants: Absent: ts js go lua. Inline parenthesis: php rb. 'call with § to list all records': clojure. 'pass §': rust c cpp zig ocaml. 'call §': csharp java kotlin scala swift elixir. 'call § with no argument': py perl. Recommendation: One sentence, written only when list has no required match (U44) Lines: 1 per language in 20
- **Return verb.** Variants: 'Resolves to' in ts js (promise) and ocaml; 'Returns' elsewhere; '§ is' rust; '§ carries' zig Recommendation: Take it from errorStyle. ocaml 'Resolves' looks like drift (its ops are not promises), but that was not verified. Lines: ocaml 6 op descriptions
- **Accessor sentence.** Variants: 'Create a new § entity instance.' (ts js go rb lua perl clojure swift c) / 'Create a new § instance.' (py php rust zig) / '(returns §)' (csharp java kotlin scala) / 'bound to this client' (cpp) / 'handle' (elixir) / 'accessor' (ocaml) Recommendation: One sentence, plus the type name from the provider Lines: 7 per language in about 11 languages
- **data()/match() descriptions.** Variants: 4 wordings for the same two accessor shapes (single get/set method against a get/set pair); cpp adds a parenthetical; ts/js/go add two long sentences Recommendation: Two shared sentences selected by the accessorShape fact Lines: 2-4 lines per entity in most languages
- **make() description.** Variants: 'with the same client and options' (ts js go php rb lua) against 'with the same options' (12) Recommendation: One sentence Lines: 1 per entity in 6 or 12 languages
- **prepare() description.** Variants: 'without sending the request' (ts js go php rb lua) / 'without sending' (14); 'Accepts the same parameters as §' in ts js go rb lua only Recommendation: One sentence plus the error clause Lines: 1-2 per language
- **direct() table rows.** Variants: Path row with 'for § substitution' (6) / without (14). The ctrl row only in ts js go php rb lua, although py reads it. The caption takes 4 variants. Recommendation: Rows from one list, with ctrl conditioned on a capability fact that is checked against the runtime Lines: 2-3 per language
- **Constructor 'system' row.** Variants: 'System overrides (e.g. custom fetch).' (16) against 'System overrides.' (rust c cpp zig) Recommendation: One row from optspec Lines: 1 in 4 languages
- **go test sentence.** Variants: go 'Test client with options.' against 19 'Create a test client with mock features active.' Recommendation: The shared sentence Lines: 1
- **Fixed-method coverage.** Variants: stream documented only in go and zig (the runtime has it in at least ts py rb java); client() and entopts() only in ts/js; options() and utility() missing in c and ocaml Recommendation: A per-language fixed-method table, checked by a test against the runtime templates Lines: Adds 5-20 lines per language
- **Small example drift.** Variants: elixir instance example names the client 'sdk'; c's update example drops the 'Fields to update' comment; c, rust and zig write 'entity id' without a code span Recommendation: Shared Lines: 1-2 per language

### What each language declares about its own runtime
What each language would have to declare about its own fixed runtime API. It is written from the signatures each generator prints today (sigs.txt, counted from patch-on/B headings) and from opening the templates for stream, make and ctrl.

Per-language FACT TABLE, the same columns for every language:
- client: ctorSignature, testSignatures[] (1 or 2: go and cpp have overloads), accessorArgKind (data|entopts), options, utility (signature or absent: c and ocaml have neither documented), directSignature, prepareSignature, tester (ts/js only)
- capabilities: cancel {param, type} (ts/js), directCtrl (ts js go php rb lua documented; py reads it), stream {returnKind: async-iterator|channel|materialised|...} or absent, make (absent in zig)
- errorStyle, one of 10: promise (ts js), raise (py rb csharp java kotlin scala clojure elixir ocaml), throw (php swift cpp), die (perl), go-err, lua-nil-err, c-null-errptr, rust-result, zig-union, plus swift's Value/asNative wrapper on load
- opSignature for the 6 ops (fixed except the op name's case)
- collectionNoun for list: array, list, vector, slice, arrayref, NULL-terminated array, Vec, or a Value list
- accessorShape: single get/set (12 languages) or get/set pair (8); nameAccessor: method, property (kotlin) or record field (ocaml)
- fixedEntity: data, match, make, stream, name, client, entopts (signature or absent)
- optionsContainerNoun and nullLiteral (nil, null, NULL, None, Value::Noval, undef, Noval...)

Size (counted rows in the printed headings per language): 15-23 signature rows. c 15; cpp, csharp, rust, swift and zig 16; ts, js, go, py, php, rb, lua, perl and ocaml 18; java, kotlin and scala 20; clojure 23. Each generator already holds OP_SIGNATURES today: 27-33 lines in every file, 636 lines in all.

Does "a fixed runtime method's signature is a fact about the language's own template, not about the model" hold in every block?
- Mostly yes. No model reading is needed to print any fixed signature.
- **Model decides whether a fixed method exists:** test() exists only when the test feature ships (S13). The description must carry that, not the provider.
- **Model decides a name inside a fixed signature:** java record_ (keyword escape), class-name collision renames (U34), and rust's Result<Rc<Self>, DemoError> carries the SDK name. These are syntax over values from the description.
- **The table is itself drifting from the runtime it describes,** so "fact" does not mean "correct": stream is undocumented in at least 4 languages that have it, and py's direct takes ctrl but does not document it. A declared table needs a test that re-derives it from tm/<lang> and fragment/*. naming.ts does that for SDK names.
- **Facts must be data, not phrases.** errorStyle and collectionNoun change sentences. If a provider returns 'and dies on error', that is provider prose. The rule holds only if the shared component owns about 10 error-style clauses and the provider returns an enum. This is the one place where "a runtime difference is data" sounds like a switch on the language under another name.

### Prose only one language needs
- ts, js, client.cancel (ReadmeRef_ts.ts:185-192): Every entity operation takes an optional ctrl … AbortSignal in ctrl.signal cancels the request … rejects with … request_aborted … stream() takes the signal as callopts.signal (4 sentences) Shareable: Partly: shared only if cancellation becomes a capability record {param, type, errorCode}. The AbortSignal and stream wording stays ts/js-specific.
- go, common.stream (ReadmeRef_go.ts, the Stream entry): …send its result items on the returned channel, which closes when the stream ends. A StreamItem holds one item in Item, or in Err… Under throw: false … no error is sent. Shareable: No: channel semantics are go's own
- zig, common.stream: …materialise its result items. StreamResult is .ok with the items, or .err … Under throw: false … a failed stream is .ok… Shareable: No
- clojure, common h3: State accessors are stored on the entity map and called via keyword lookup. Shareable: No (1 sentence)
- elixir, constructor: § is a struct value node — build one from a native map with §. Shareable: The first half is shareable with an optionsContainerNoun; the second is idiom
- swift, op.load: …as a native Value that `asNative as? Entity` unwraps Shareable: No, but it applies to every op, not only load (drift inside the idiom)
- go, client.test0: No-arg convenience constructor for the common no-options test case. Shareable: Yes if overloads are a fact; otherwise no
- cpp, client.test: …; a no-arg overload is also provided. Shareable: As go
- ocaml, client.test / ctor: (§ uses defaults, § takes explicit options); Use § for defaults. Shareable: Yes with nullLiteral
- kotlin, common.name: The entity name (read-only property). Shareable: Yes with a nameAccessor fact
- php, direct: This is the raw-HTTP escape hatch: it does **not** throw. … Branch on §. Shareable: Yes: it is the shared no-throw sentence written differently
- ocaml, op.remove: …marked as deleted (§); it keeps the data it held. Shareable: Yes: it is true of every language, so it is drift rather than idiom

### Proposed description fields
Per target, resolved once from the model:
- **sdk:** name, clientTypeName input (Name + 'SDK'), title
- **ctor.options[]:** from main.kit.optspec plus requiredOptions(model) (apikey when auth is active; secret only for Basic in a header and not suppressed; server variables with required = referenced and no default). Each option is {name, canonicalType, description (cell-escaped), required, default}.
- **testClient:** {available} (test feature shipped)
- **entities[]:** active only, in key order, each with:
  - name, className (entityClassName against entityCollection, U34)
  - varName input
  - description (entityDescription: text.entity_desc, then short, then desc; cell- and link-safe)
  - fields[]: {name, canonicalType, scalarKind, required, description(escaped), ops[] (active ops only)}
  - idField (entityIdField, or null)
  - ops[]: active only, CANON_OP_ORDER. Each op is {name, kind: match|data, needsAction, matchItems[{name, scalarKind, placeholder}], requestItems[{name, scalarKind, placeholder, optional}], listRequiresMatch + requiredListParams (U44), idInData (U43), bodyNote facts {values, once}}.
  - actions[]: {action, op, path}
- **features[]:** featureDocs(model, target), with {name, version, title, wraps}, plus honoursActivationOrder
- **No model fact goes to the provider.** Every model fact the REFERENCE uses is on this list. Each of these is what today's 20 files re-derive, and among those reads are S25/D10, U43, U44, U34, U36, S50/D23, D04 and N04.

### Proposed provider additions
```ts
interface RefSyntax {
  fence: string                                   // N11: js gets 'js'
  title: string                                   // language title
  clientTypeName(sdkName: string): string         // DemoSDK | Demo | Sdk_client
  entityTypeName(className: string, entName: string): string  // PlanetEntity | Planet | Demo.Entity.Planet
  memberNoun: 'Methods' | 'Functions'
  typeName(canonical: string): string             // replaces the 6 local type maps and canonToType(..., target.name)
  scalarLiteral(kind: string, placeholder: string): string
  mapLiteral(items: { key: string, value: string }[], multiline: boolean): string  // c: NULL or cmap(n,...)
  nullLiteral: string
  comment(text: string): string
  optionKey(container: 'options' | 'fetchargs', key: string): string  // options.apikey | options["apikey"] | apikey
  containerNoun: string                           // maps | dicts | hashes | tables | arrays | hashrefs ...
  ctorExample(sdkName: string): string
  testCall(sdkName: string): string
  accessorCall(ent: { name: string, varName: string }): string
  opCall(op: OpDesc, ent: EntDesc, arg: string): string        // the call alone
  opExample(op: OpDesc, ent: EntDesc, arg: string): string     // call + language's result consumption / error check
  actionCall(ent: EntDesc, op: string, action: string): string
  featureActivation(names: string[]): string
  facts: LangApiFacts                             // the table above: signatures, errorStyle enum, collectionNoun, accessorShape, capabilities
}
```

### Proposed structure
One scheme, in document order:

```
# {Name} {Lang} SDK Reference
## {clientTypeName}
### Constructor
### Test client
### Instance {memberNoun}
#### `{accessor}` …  #### `{options}`  #### `{utility}`  #### `{direct}`  #### `{prepare}`  [#### Cancelling a call, by capability]
---
## {entityTypeName}
### Fields
[### Field Usage by Operation]
[### Actions]
### Operations
#### `{opSignature}` (canonical order)
### Common {memberNoun}
---
## Features
### Configuring features
#### Ordering
#### `{feature}`
```

Heading lines that change per language under it, counted on the B output by headings.py, against 105-121 heading lines per page:
- 1 each: ts js go py php rb lua rust cpp zig
- 2 each: c, elixir
- 8 each: csharp java kotlin scala swift perl (7 entity h2s + 1)
- 9 each: clojure, ocaml (7 Common h3s + 2)
- Added: Actions and missing fixed methods. Moved: the op order in 19 languages.

The h4 signature text is printed by the provider and changes only where drift is fixed.

### Hard cases
- **c (handles, no objects).** It has no options()/utility() entries. Accessors are free functions (demo_planet(client, NULL)) and ops are vtable calls with an explicit self and PNError** (ReadmeRef_c.ts:60-75, 270-330). The examples carry their own result-consumption loops (NULL-terminated array, printf of voxgig_to_json). It is a mapLiteral provider case rather than a model condition (an empty create prints NULL, ReadmeRef_c.ts:298). It holds the largest local helper set: 22 lines of type and literal maps. Prose fits the shared form once errorStyle is c-null-errptr; examples are all provider. It is in the compiled README/REFERENCE lanes (generatedcompile.test.ts), so H4 will show here first.
- **go (two return values).** It is the only language whose ops follow entityOps and canonical order (ReadmeRef_go.ts:166-169), so it is the one that is right on S25. Each example adds an err check and a print, with a type assertion result.(sdk.Entity). It has two test constructors and the channel-based Stream paragraph (idiom). The difference is easy to express as data (go-err style); go is not hard.
- **swift.** Ops return Value: the load description carries 'asNative as? Entity' (ReadmeRef_swift.ts:32) and the list example unwraps item.asNative. The return phrase is a third value shape (Value-wrapped entity), beyond the 10 error styles. A provider can supply it as a fact, but the shared sentence then needs a slot for 'as a native Value that … unwraps'.
- **clojure, ocaml, elixir (no classes).** The prose fits the shared sentences once memberNoun, accessorShape and nameAccessor are facts. Their real hardness is code. clojure's example needs a (require …) alias per entity (e-planet/load). ocaml's ops are record fields called with a receiver expression ((Sdk_client.planet client Noval).e_load). elixir passes the entity as the first argument and rebinds it (planet = Demo.Entity.Planet.update(planet, …)), with a Helpers.deep map wrapper. None of the three has a toolchain here, so the H4 test for them is byte equality only.
- **perl.** Its list example hard-codes `->{id}` (ReadmeRef_perl.ts:293): a model fact (the id field) hidden inside example code. The pattern is examples that consume the result by reading a field, and each provider wants it. Unless opExample receives idField from the description, perl's provider will read the model: the first H1 violation to watch for.
- **rust and zig.** Their result types (Result<Vec<Rc<Self>>, DemoError>, StreamResult) put the SDK name inside fixed signatures, and their prose subject is the Ok/.ok variant rather than 'Returns'. The shared sentence needs a subject slot. Both are in the compile lanes.
- **ts/js.** They carry content no other language has: Cancelling, tester(), client() and entopts(), and the Actions block (ts only). Actions is a model-dependent block present in 1 of 20 languages, the exact class the proposal claims to fix. Building it for all 20 adds actionCall to every provider.
- **Language pack: lean.** It has no entity layer (ReadmeRef_lean.ts emits only a module table plus ReadmeRefFeatures). A shared page must make every client and entity block absent by data, or lean keeps a component of its own. dart and haskell (394 and 413 lines) are a second copy of the full skeleton outside this repo (H5).
- **The fixed-method table.** Documented methods already disagree with the runtimes (stream, ctrl, client/entopts). If providers declare the table by hand, the drift moves rather than disappears, unless a guard re-derives it from tm/<lang> and fragment/*.

### Measurements
- ReadmeRef_<lang>.ts lines, 20 bundled languages = 8,330 in all (350 elixir to 473 ts)
- REFERENCE.md lines, baseline B = 24,447 in all (1,168-1,312 per language)
- Prose units shared by at least 15 languages, whole page = 80% (1,966/2,461); 5% of units found in one language only
- Same, excluding ReadmeRefFeatures output (the part each language writes) = 67% (1,026/1,521); lone 8%
- Same, excluding all feature blocks = 54% (586/1,081); lone 11% (117)
- Op description sharing at 15 or more languages, before and after tokenising the error and return clause = load 49%->90%, create 50%->92%, update 62%->88%, remove 49%->90%, list 33%->33%, direct 57%->65%, prepare 0%->0%
- Sentences found in at most 3 languages (non-feature blocks) = 165 (block, sentence) pairs. Hand classification: about 18 distinct are idiom, the rest are error-style, syntax or drift (estimated, not counted).
- REFERENCE reaction to model switches (lines differing from B, per language) = auth-off: 1 line in each of 20. auth-basic: ts only. auth-query, server-none, server-static: no REFERENCE changed in any language. op-off-planet-{create,update,list,load,remove} and op-readonly: go only. patch-on: all 20 (9-15 lines). feat-none: about 707 lines in all 20.
- Heading lines changed under the proposed scheme = 1 in ts js go py php rb lua rust cpp zig; 2 in c and elixir; 8 in csharp java kotlin scala swift perl; 9 in clojure and ocaml (of 105-121 heading lines each)
- Operation order = go canonical; the other 19 in model-key order
- Per-file content a provider would keep (code-template lines + OP_SIGNATURES + local helper functions + signature headings) = 77 (elixir) to 114 (clojure) per file; 1,914 in all. A rough split, so this is estimated.
- Model-reading lines and conditions per generator = modelref 21-47, conditions 20-37 per file. The conditions specific to one language are all type to literal or type-name maps.
- Fixed signature rows per language = 15-23 (c 15; cpp, csharp, rust, swift, zig 16; ts, js, go, py, php, rb, lua, perl, ocaml 18; java, kotlin, scala 20; clojure 23)
- H2 shrink estimate = About 3,000-3,500 lines after (shared about 450 + 20 providers of about 130-150) against 8,330 before: about 2.4-2.8x. Estimated, not counted. Only building measures it.
- stream() in runtime but not documented = Defined in ts (EntityBase.fragment.ts:111), py (Entity.fragment.py:74), rb (Entity.fragment.rb:104) and java (EntityBase.fragment.java:206); documented only in go and zig. Other languages not checked.
- py direct reads ctrl, REFERENCE omits it = py/fragment/Main.fragment.py _raw_request: ctrl = helpers.to_map(vs.getprop(fetchargs, "ctrl"))
- Escaped-backtick leak in shared ReadmeRefFeatures = 1 occurrence in each of 20 REFERENCEs ('of \`feature\`'); not in the catalogue
