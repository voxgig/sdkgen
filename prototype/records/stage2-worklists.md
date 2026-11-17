# Stage 2 worklists, verbatim from the independent checks

Generated from `results/s2-*.json`. The full results, readable, are `results/s2-*.txt` beside this file.

## A. Output defects found by the checks

### check-v2 (quick start, root quick start)

1. **zig** (doc-crud, doc-nested, crud-basic, crud-bare, crud-noupdate (every variation with create)), worse than old: True
   - Defect: The create comment says 'Create — returns the created entity'. That is false for zig, where create returns EntResult, a union whose .ok holds the entity. The shared createComment adapts only to errslot.
   - Evidence: out/new/doc-crud/zig/README.md step 4; OLD said '// Create — .ok carries the created entity'; src/cmp/zig/fragment/EntityCreateOp.fragment.zig:3 'pub fn create(...) EntResult'; ts/src/helpers/runtimeprose.ts createComment
2. **ts** (all variations with entities (root README)), worse than old: True
   - Defect: The root quick start no longer names the class an operation returns. OLD: '(returns PlanetEntity[], one entity per record)', '(returns the entity, a SatelliteEntity)'. NEW: 'an array of entities'.
   - Evidence: rootParts(out/old/doc-crud/README.md).sub.ts vs out/new; OLD-only comments listed by the per-language diff
3. **clojure** (every variation with list or load), worse than old: True
   - Defect: The prose says '`((:data-get entity))` reads an entity's record', but the code binds planet, console or ambient. No `entity` symbol exists, so a reader copying the expression gets an unresolved symbol. OLD named the bound variable.
   - Evidence: out/new/doc-crud/clojure/README.md steps 2-3; OLD 'Read each record with `((:data-get planet))`'
4. **go** (doc-crud, doc-nested, crud-*), worse than old: False
   - Defect: '// Create — returns the created entity' is imprecise for go: Create returns (value, error). The write step's list item carries no sentence, so the pair fact is stated only for List and Load. The program also prints two comments in a row ('// Create, update, patch, and remove' then '// Create — ...').
   - Evidence: out/new/doc-crud/go/README.md; EntityCreateOp.fragment.go:13 '(any, error)'
5. **go** (ent-none, and every variation (wording)), worse than old: False
   - Defect: 'The steps are one program, shown whole after them.' reads awkwardly. In ent-none it introduces a single step.
   - Evidence: out/new/ent-none/go/README.md
6. **c** (every variation with list then load (tutorial, and now the root)), worse than old: False
   - Defect: err is never reset. After list fails, load's `if (err)` reports 'load failed' with the list's message; and because the runtime returns NULL whenever *err is already set (EntityListOp.fragment.c 'if (*err) return NULL'), every later call fails. OLD's tutorial had the same defect. OLD's root used `if (loaded)` and failed silently instead.
   - Evidence: out/new/doc-crud/README.md C subsection; src/cmp/c/fragment/EntityListOp.fragment.c
7. **ts** (B, server-mixed, auth-basic-query), worse than old: False
   - Defect: The README still contradicts itself (brief2 item 8). The tutorial says region defaults to eu while the options table says '**Required.** … tenant, region'. Under query Basic the quick start omits secret, but 5 later lines show it.
   - Evidence: out/new/B/ts/README.md lines 35 and 224; grep -n secret out/new/auth-basic-query/ts/README.md (lines 143, 180, 192, 216, 230)
8. **ts** (crud variations), worse than old: False
   - Defect: 'Create — returns the created entity' sits beside 'resolves to' in the same document; ts create resolves (async).
   - Evidence: out/new/doc-crud/ts/README.md step 4 vs step 3
9. **zig, clojure** (all), worse than old: False
   - Defect: Unverifiable: no toolchain. The NEW zig create binding (`const created = switch … .err => |e| return std.debug.print(…)`) and the clojure blocks were never compiled or run.
   - Evidence: command -v zig/clojure MISSING

### check-ref (REFERENCE)

1. **zig** (every variation with fields (e.g. B, doc-crud)), worse than old: True
   - Defect: Every field's Type cell is `any`, which is not a zig type name and says less than before. OLD printed `[]const u8`, `f64`, `i64`, `Value (object)`. The cause: canonToType has no zig column, so the provider's ref.type falls back.
   - Evidence: new/B/zig/REFERENCE.md: 16 field cells `any`; old/B/zig: 10 `[]const u8`, 3 `f64`, 1 `i64`; src/helpers/canonType.ts:2-5 (zig has no column); old ReadmeRef_zig.ts zigType()
2. **ts go py c zig** (every variation with a list op (B, doc-crud, ...)), worse than old: True
   - Defect: Example variables are bad English plurals (`utilitys`, `historys`, `planet_entitys`). They come from `vars: v + 's'`, copied into all five Naming hooks, which no code generator uses.
   - Evidence: new/doc-crud/ts/REFERENCE.md: 'const utilitys = await client.Utility().list()'; 338 occurrences; Naming_<lang>.ts symbols()
3. **py** (all), worse than old: True
   - Defect: direct() Returns says '`ok` is `false`'. In Python the value is `False`. OLD said 'branch on `result["ok"]`'.
   - Evidence: new/B/py/REFERENCE.md direct(): '**Returns:** `dict`. On a failure `ok` is `false` and `err` holds the error.'
4. **go py c zig** (all), worse than old: True
   - Defect: direct() no longer says what the result holds: `status`, `headers` and `data` appear nowhere. Only ts names them, in its type `Promise<{ ok, status, headers, data }>`. py, c and zig also lost the idiom for reading `ok`.
   - Evidence: OLD py 'Returns a result `dict` with `ok`, `status`, `headers`, and `data` (or `err` on failure)'; OLD c '... branch on `getp(result, "ok")`'; OLD zig '... branch on `h.get_bool(result, "ok")`'; NEW only '**Returns:** `dict`|`voxgig_value*`|`Value`'
5. **c zig** (all), worse than old: True
   - Defect: The data()/matchv() description says 'When called without arguments, returns a copy'. In C and Zig the argument is always passed (NULL or null), so the sentence describes a call these languages cannot make. OLD said 'Get the entity data. Pass a map to set it.'
   - Evidence: new/B/c/REFERENCE.md Common Functions vt->data; c/fragment/Entity.fragment.c:242-250 (args NULL check)
6. **ts** (doc-crud, B and every variation with an action), worse than old: True
   - Defect: The Actions block no longer shows how to call an action. The 'Call' column and the example `client.Planet().create({ $action: 'terraform', ... })` are gone. Only the sentence 'Select one with `$action` in the call's argument' remains.
   - Evidence: diff old/new doc-crud ts: '| `terraform` | `/planet/{id}/terraform` | `client.Planet().create({ $action: ...})` |' -> '| `terraform` | `create` | `/planet/{id}/terraform` |'
7. **ts go py c zig** (B, every variation with log), worse than old: False
   - Defect: The REFERENCE now says log runs unless disabled, while the README Features section of the same SDK says every feature is 'inactive until you switch it on ... no logging'. The two documents contradict each other.
   - Evidence: new/B/ts/REFERENCE.md:708 vs new/B/ts/README.md:590-592
8. **ts go py c zig** (no-test), worse than old: False
   - Defect: The REFERENCE omits the test constructor, which still exists in every runtime. The README of the same SDK still uses it (`DemoSDK.test()`, `test_sdk(NULL, NULL)`) and lists it in its own table.
   - Evidence: new/no-test/ts/README.md:132,253; new/no-test/c/README.md:157,264; grep counts README 2-3, REFERENCE 0
9. **ts** (B, server-mixed), worse than old: False
   - Defect: The REFERENCE says `region` defaults to `eu`. The README options table of the same SDK says '**Required.** ... `tenant`, `region`'.
   - Evidence: new/B/ts/README.md:224 vs new/B/ts/REFERENCE.md options.server.region row
10. **py** (doc-nested), worse than old: False
   - Defect: The list signature says the match is optional (`list(reqmatch=None, ...)`), while the sentence below it says 'The match must include `planet_id`'.
   - Evidence: new/doc-nested/py/REFERENCE.md SatelliteEntity list
11. **zig** (all), worse than old: True
   - Defect: Stream lost what happens under `throw: false` (a failed stream is `.ok` with whatever data the failure left). `.err` is no longer described as 'the branded error'.
   - Evidence: old/B/zig Common Methods stream vs new
12. **go** (all), worse than old: False
   - Defect: The TestSDK example `client := sdk.TestSDK(testopts, sdkopts)` uses undefined variables. The same line is in OLD.
   - Evidence: new/doc-crud/go/REFERENCE.md Test client
13. **ts go py c zig** (all), worse than old: False
   - Defect: The load sentence reads awkwardly: 'Resolves to the entity, whose record `.data()` reads'. OLD had the same phrase.
   - Evidence: new/doc-crud/ts/REFERENCE.md load

## B. Facts lost (true statements the old text made and the new text does not)

### From check-v2

- zig: 'Create — .ok carries the created entity' (replaced by the false 'returns the created entity').
- zig: the instruction to `switch` on list's .ok ('`.ok` is a slice of entities, one per record — `switch` on it').
- ts root README: the entity class each operation returns ('returns PlanetEntity[]', 'a SatelliteEntity', 'ConsoleEntity[]').
- ts tutorial: 'every operation resolves to entities, not raw records' (the general contract). NEW states it per list and load only; the create comment also lost '(.data() for the record)'.
- go: 'Each operation returns (value, error)' as a statement about every operation, writes included. NEW states the pair only for List and Load. Write results are no longer printed, which OLD used to show that update and patch return the entity.
- py: the create comment's '(call data_get() for the record)'.
- clojure: naming the bound variable in the record accessor (`((:data-get planet))`); NEW uses an unbound `entity`.

### From check-ref

- ts: options() and utility() return `object` ('**Returns:** `object`')
- ts: test(testopts, sdkopts): testopts are 'Test feature options', sdkopts 'Additional SDK options merged with test defaults'; it returns a DemoSDK instance in test mode (and the same Returns line for tester())
- ts: each accessor's parameter table ('`data` | `object` | Initial entity data') and its '**Returns:** `PlanetEntity` instance'
- ts: how to call a custom action: `client.Planet().create({ $action: 'terraform', /* ...the action's own arguments */ })`
- ts, go, py, zig: update/patch example comments '// Fields to update', '// Only the fields to change'
- go: the instance example `fmt.Println(planet.GetName()) // "planet"` (what GetName returns)
- py: direct() returns a result dict with keys `ok`, `status`, `headers`, `data` (or `err`), and the idiom `result["ok"]`; prepare returns the `fetchdef`
- py: `# str` type comments on create example fields
- c: direct() returns a result map with `ok`, `status`, `headers`, `data`; it never sets `*err` for a non-2xx response; read ok with `getp(result, "ok")`; prepare returns the fetchdef
- c: vt->data / vt->matchv: 'Pass a map to set it' (replaced by a no-arguments sentence that does not fit C)
- c: `// char*` type comments on create fields; the `if (result)` guard after load
- zig: direct() returns a `Value` map with `ok`, `status`, `headers`, `data` even on a non-2xx response; read ok with `h.get_bool(result, "ok")`
- zig: StreamResult under `throw: false` in callopts.ctrl: a failed stream is `.ok` with whatever data the failure left; `.err` is the branded error
- zig: field types `[]const u8`, `f64`, `i64`, `bool`, `Value (array)`, `Value (object)` (now all `any`)
- zig: `// []const u8` type comments on create fields; data()/matchv(): 'Pass a map to set it'
- go, py, c, zig: direct()'s result keys `status`, `headers` and `data` are no longer stated anywhere on the page

### From ref (its own list of losses)

- Lost facts: zig StreamResult's throw:false clause; ts tester's 'Returns: DemoSDK instance in test mode' and the accessor parameter table; py's '# str' comments in create examples; ts's '// Fields to update' comment; go's GetName print.

### From probe-ref (rust, elixir): constructs not expressible, and what was lost

**rust**
- The use line names a third SDK name, the entity-base trait DemoEntityBase (old ReadmeQuick_rust.ts:51, ReadmeRef_rust.ts:80). DescLayout had only module, client and ctor. Added layout.names (additive).
- {sdk} in direct.returns and prepare.returns (Result<Value, DemoError>) was not filled: ReadmeRef.ts clientMember printed the raw token. Fixed with fill() (shared, additive).
- The direct envelope is inside Ok: 'resolves to Ok even on a non-2xx response, branch on getp(&result, "ok")' (ReadmeRef_rust.ts:148-151). The shared sentence 'A failed request is reported in the result, not as an error' sits beside a Result<..> return type. Lost, not expressed.
- data(Option<&Value>): 'Pass Some(&map) to set it' (ReadmeRef_rust.ts:337). The shared data sentence is true but drops the Option idiom.
- stream returns Result<IntoIter<Value>, Error>. The closest kind, streamList, says 'as one list'. Approximate.
- Guard: STYLE.union required `pub fn load(...) XResult`, while rust's is `fn load(...) -> Result<` (EntityLoadOp.fragment.rs:3). declares() missed `fn list` at column 0. PRESENT missed `pub fn stream/options_map/get_utility`, `fn make(&self)` and `fn get_name`. Extended the regexes (test only).

**elixir**
- The entity is named by its module Demo.Entity.Planet, which is neither its className nor its Name (heading at ReadmeRef_elixir.ts:154, handle sentence :103, make :295). RefFacts.classes cannot express it. Added DescSymbols.type (additive).
- The Helpers module (alias Demo.Helpers, as: H; Demo.Helpers.deep at ReadmeQuick_elixir.ts:39, ReadmeRef_elixir.ts:69,215) needs a name with no slot. Added layout.names.helpers (additive).
- get_utility/1 returns the client's own node, not a copy (Main.fragment.ex:84; old text 'Return the SDK utility node', ReadmeRef_elixir.ts:115). The shared 'Return a copy of the SDK utility object' is false. Added MemberKind utilityShared (additive).
- stream/4 returns a lazy Elixir Stream (lib/projectname/entity_base.ex:105-118). No kind said that. Added MemberKind streamLazy (additive).
- Arity naming `list/2`, `load/2` (ReadmeQuick_elixir.ts:58,97): RuntimeFacts.named is only 'call' or 'bare'. Lost.
- 'Voxgig.Struct.getelem/2 reads an item' (ReadmeQuick_elixir.ts:59) and 'build one from a native map with Demo.Helpers.deep/1' (ReadmeRef_elixir.ts:68-69). Lost.
- The null-argument form depended on the operation: load passed H.deep(%{}) (ReadmeQuick_elixir.ts:120; ReadmeRef_elixir.ts:218), while list and remove passed nothing. It cannot be kept without an operation name in the provider, so it was unified to no argument, which the old root quick start already printed.
- attempt, each, print and expr receive no description. The handle bound inside try needs the client module, so the hook qualifies the accessor itself (sym.accessor = 'Demo.planet').
- Whether the H alias is in scope (tutorial) or not (a REFERENCE example) is inferred from sc.declared, which the client printer sets. No interface notion separates a standalone snippet from a step.

## C. The other twelve languages: what the read-only survey found

### js (expressible: with-extension)

- '### Direct API Access' inside the quick start (js/ReadmeQuick_js.ts:156): a client.direct({...}) call with an ok envelope, for which no Stmt exists. It must move to another section (a placement decision) or get a new Stmt kind (breaking).
- Prints write results and has no error handling (js/ReadmeQuick_js.ts:106,121,138). These are drift the builder unifies, not missing constructs.
- Evidence: Read only. The REFERENCE matches ts (cancel and tester are already declared as facts). The test-constructor table, 'Returns: DemoSDK instance in test mode' and the accessor parameter table were already dropped for ts.

### php (expressible: with-extension)

- The options table names the container `$options`, with keys `$options["apikey"]` (php/ReadmeRef_php.ts:94). keyTable hard-codes the container row as `options` (ReadmeRef.ts keyTable). It needs r.key('options', []) for that row; go, py and ts return the same string for an empty path, so the change is additive.
- Guard: `public function load(` (php/fragment/EntityLoadOp.fragment.php:15) matches neither declares() nor the throw STYLE (which requires `async`).
- Evidence: Read: the old B REFERENCE and the fragments. Chosen-field printing is already covered by desc.quick.show and Expr 'fields'.

### rb (expressible: yes)

- Evidence: Read. The raise STYLE (`def load(`) and PRESENT (def stream, def make, def options_map, def get_utility at rb/fragment/Entity.fragment.rb:64,104 and Main.fragment.rb:85,90) match. Bare map keys `options["apikey"]` come from the key() printer. Fields printing uses desc.quick.show.

### lua (expressible: with-extension)

- Guard only: STYLE.pair matches go's `(any, error)` alone; lua's is `function EntyClass:load(` (lua/fragment/EntityLoadOp.fragment.lua:12), returning value, err. A lua pattern is needed.
- Per-call `if err then error(err) end` outside an attempt can be expressed through cx.inAttempt. 'Both arguments are optional' (lua/ReadmeRef_lua.ts:113) becomes the shared 'may be nil'.
- Evidence: Read only.

### csharp (expressible: with-extension)

- Guard only: `public override object? Load(` (csharp/fragment/EntityLoadOp.fragment.cs:11). The throw STYLE requires `async` and declares() does not match the form.
- The accessor's declared return (DemoEntityBase) goes into the accessor sig string. Expressible.
- Evidence: Read only. Casts in examples belong to the call printer.

### java (expressible: with-extension)

- Guard only: `public Object load(` (java/fragment/EntityLoadOp.fragment.java:22) matches neither declares() nor any STYLE.
- The record_ keyword escape belongs in the Naming hook. '(returns SdkEntity)' (java/ReadmeRef_java.ts:121) goes into the accessor sig.
- Evidence: Read only. Imperative options.put is a client-printer matter. Imports that depend on later blocks go through sc.section.

### kotlin (expressible: with-extension)

- Guard: `override fun load(` (kotlin/fragment/EntityLoadOp.fragment.kt:16) is not matched.
- name is a read-only property (kotlin/ReadmeRef_kotlin.ts:358). MemberKind 'name' says 'Return the entity name.' and loses 'property'. A minor additive kind if it matters.
- Evidence: Read only.

### scala (expressible: yes)

- Evidence: Read. `override def load(` (scala/fragment/EntityLoadOp.fragment.scala:12) matches the raise STYLE. Its optionsMap/getUtility members are invisible to PRESENT (which knows options_map and GetUtility), so the guard would not catch an omission. That is a guard gap, not an interface one.

### swift (expressible: with-extension)

- Operations return Value, `throws -> Value` (swift/fragment/EntityLoadOp.fragment.swift:8), unwrapped with `asNative as? Entity` (swift/ReadmeRef_swift.ts:32; ReadmeQuick_swift.ts:89,96). No ResultStyle says 'returns the entity wrapped in a Value'. Needs a new style with its sentences and a STYLE check (additive for providers; runtimeprose's switches gain a case).
- The module ${Name}Sdk comes from templates. It belongs in the hook as layout.module.
- Evidence: Read only.

### cpp (expressible: with-extension)

- Guard: `SdkEntityPtr load(` (cpp/fragment/EntityLoadOp.fragment.cpp:3) is not matched by declares() or any STYLE.
- The no-arg test overload (cpp/ReadmeRef_cpp.ts:117) is expressible as a second test entry with args:false. The 'getenv hoisted into const char* apikey' line is the client printer's own.
- Evidence: Read only. cpp is in DOC_LANES, so it can be compiled here (g++ present) once ported.

### perl (expressible: with-extension)

- 'dies on error' (perl/ReadmeRef_perl.ts:40-50): the throw and raise sentences print `${result}s`, which gives no 'dies'. Needs a ResultStyle 'die' with its sentences and a STYLE check for `sub load {` (perl/fragment/EntityLoadOp.fragment.pm:10).
- The `$options` container row and `$options->{apikey}` keys: same keyTable limitation as php.
- Evidence: Read only. The old list example's hard-coded ->{id} is now covered by desc.quick.show.

### ocaml (expressible: with-extension)

- Two nouns: '### Instance functions' for the client and '### Common Fields' for entity record fields (ocaml/ReadmeRef_ocaml.ts:141,346). RefFacts.noun is one value of 'Methods'|'Functions'. Needs separate client and entity nouns and 'Fields' (additive).
- Alternate constructors `Sdk_client.make0 ()` and `Sdk_client.test_with` (ocaml/ReadmeRef_ocaml.ts:105,130) have no fact: ctor is one block, and test entries carry no own sentence.
- Guard: no STYLE or declares pattern for record-field operations (e_load).
- cx.last covers `let ... in` / `;`.
- Evidence: Read only. ocaml is in DOC_LANES, but no ocaml toolchain is here.

## D. Interface changes made or recommended by probe-ref

0. DescSymbols gains optional `type`: what the reference names an entity by when it is neither its class nor its Name. typeOf() prefers it.
   - Breaking: False. Why: elixir's entity is the module Demo.Entity.Planet; RefFacts.classes could only print PlanetEntity or Planet.
   - Languages: elixir (made); likely ocaml or clojure if their heading is not Name
1. DescLayout gains optional `names: Record<string,string>`: further names an example imports, by role, set by the Naming hook.
   - Breaking: False. Why: rust's use line needs the DemoEntityBase trait and elixir's alias needs Demo.Helpers. Without a slot the printer must concatenate onto desc.Name.
   - Languages: rust, elixir (made); likely java (SdkEntity), csharp (namespace), swift (module), cpp (header)
2. MemberKind gains 'utilityShared' ('Return the SDK utility object itself, not a copy.') and 'streamLazy' ('...return a lazy stream of its result items.').
   - Breaking: False. Why: elixir's get_utility returns the live node and its stream is a lazy Stream. The existing sentences would be false.
   - Languages: elixir (made)
3. ReadmeRef clientMember fills {sdk}/{client}/... tokens in direct.returns and prepare.returns.
   - Breaking: False. Why: rust's Result<Value, DemoError> carries the SDK name; the token was printed raw.
   - Languages: rust (made); any language whose error type carries the SDK name
4. runtimefacts.test: union STYLE accepts `fn load(...) -> Result`; declares() accepts `fn name`; PRESENT knows rust's fn forms (make narrowed to `fn make(&self)` after a zig false positive); memberPattern stops a dotted return type (String.t()) being read as the member name; utilityShared counts as utility.
   - Breaking: False. Why: Without it rust failed the guard and an undeclared rust member would have passed silently; elixir's get_name and stream signatures were reported as undefined.
   - Languages: rust, elixir (made)
5. RECOMMENDED before the other twelve: give the guard a declared per-family form table (method declaration, op signature per ResultStyle, each PRESENT member) instead of regexes grown per port.
   - Breaking: False. Why: Today's regexes match neither the declaration nor the result style of java, kotlin, csharp, php, perl, swift, cpp or ocaml, and miss scala's optionsMap. So the guide's 'runtimefacts.test re-derives both' does not hold for them.
   - Languages: js php lua csharp java kotlin scala swift cpp perl ocaml
6. RECOMMENDED: keyTable prints the container row through r.key('options', []) instead of the literal `options`.
   - Breaking: False. Why: php and perl name it `$options`. go, py and ts already return the container for an empty path, so their output is unchanged.
   - Languages: php, perl
7. RECOMMENDED: ResultStyle 'die' (perl) and a Value-wrapped style (swift: ops `throws -> Value`, unwrapped with asNative as? Entity), with sentences in runtimeprose and STYLE checks.
   - Breaking: False. Why: 'dies' is not producible from the throw/raise frames, and 'returns the entity' is false for swift. Providers do not switch on ResultStyle, so only runtimeprose changes.
   - Languages: perl, swift
8. RECOMMENDED: separate client and entity nouns in RefFacts, and the union widened with 'Fields' and 'Members' (or made a string).
   - Breaking: False. Why: ocaml prints 'Instance functions' and 'Common Fields'; clojure prints 'Members'.
   - Languages: ocaml, clojure
9. RECOMMENDED: a client-heading fact (or layout field) for '## {client}'.
   - Breaking: False. Why: clojure's client has no type; '## api' would print.
   - Languages: clojure
10. RECOMMENDED: give attempt, each, print and expr the description, as client, call and before already have it (a trailing parameter TS implementers may ignore).
   - Breaking: False. Why: elixir had to qualify its accessor in the hook because attempt cannot read layout. The alternative is hidden module state, which I first wrote and then removed.
   - Languages: elixir; any language whose handle or import is printed inside error handling
11. RECOMMENDED: a context flag telling a printer whether its block stands alone (a REFERENCE example) or follows the section's client block.
   - Breaking: False. Why: elixir chooses H.deep or Demo.Helpers.deep by peeking at sc.declared. The rust, ts, c and zig feature snippets now repeat their imports.
   - Languages: elixir, rust, and any language with an import alias
12. RECOMMENDED: a fact that direct's envelope is wrapped by the result style (rust: inside Ok).
   - Breaking: False. Why: The shared 'reported in the result, not as an error' sits beside `Result<Value, DemoError>`; the rust-specific branch hint was lost.
   - Languages: rust
13. RECOMMENDED: alternate constructors and test-constructor variants with their own text (ocaml make0, test_with).
   - Breaking: False. Why: ocaml documents three entry points that no RefFacts field holds.
   - Languages: ocaml
14. RECOMMENDED (decision, no interface change): move js's 'Direct API Access' out of the tutorial before porting js.
   - Breaking: False. Why: No Stmt represents it; adding one would be a new Stmt kind and BREAKING for every exhaustive switch.
   - Languages: js

## E. Facts and decisions still inside providers or hooks (probe-ref)

- Syntax_clojure.ts:59-60: reads desc.entities, filtered by uses(sc.section).entities, to choose which namespaces to require. A description lookup and a which-to-show decision made in the provider.
- Syntax_go.ts:149-161: imports fmt and os by uses(sc.section), and pushes `_ = client` when the section calls no entity. A decision on what the program contains.
- Syntax_c.ts:120 and Syntax_py.ts:93: include stdlib.h or import os when an option reads an environment variable. Statement-derived, but a whether.
- Syntax_c.ts:134: declares `PNError* err` only when the block calls an operation.
- Syntax_elixir.ts (mine): binds entity handles from the statements (inside each attempt, and in before for bare calls). Picks H.deep or Demo.Helpers.deep by sc.declared.has('H'). Lays a map out multi-line when one member is a map of maps (c's option() rule is the same kind of thing).
- Syntax_rust.ts (mine): imports getp always. Trimming it by uses() broke other README sections, so the import set is a page fact the provider cannot see.
- Every RefFacts table is hand-declared. The guard cannot check semantics: utility() returns a copy in ts, go, py and rust and the live node in elixir; body.values, container, maps, valueType and none are unchecked. The guard's syntax checks only cover six language families.
- Signature strings carry template naming rules: rust's `{sdk}Error` and `{sdk}EntityBase` repeat Main.fragment.rs and core/types.rs (ProjectNameError, ProjectNameEntityBase). The printers instead read layout.names, so the same name has two sources.
- Naming hooks hold template names as literals: rust `Name+'SDK'`, `Name+'SDK::new'`, `Name+'EntityBase'`; elixir `Name+'.new'`, `Name+'.Helpers'`, and `Name+'.'+elixirAccessor(...)` as the qualified accessor. elixir's entity module now comes from the extracted elixirEntityModule, shared with MainEntity_elixir.
- Naming_c.ts computes field identifiers with cVarName over e.fields (allowed in a hook, but it is the only hook that walks fields).

## F. Problems in the porting guide (probe-ref)

- Step 5 and the Rules say runtimefacts.test 're-derives both' (declared signatures defined; defined members declared). It does so only for forms it has regexes for. rust failed STYLE.union (`pub fn`, no `->`) and declares() (`fn list` at column 0). PRESENT would have silently accepted a rust page missing stream, options_map, get_utility, make and get_name. memberPattern read elixir's `String.t()` return as member `t`. For java, kotlin, csharp, php, perl, swift, cpp and ocaml, neither declares() nor any STYLE matches the load signature. The guide should say the guard must be extended per language, and how.
- Silent on page coupling: in the rust DOC lane (and c and cpp, via pageImports) a block with no own import is compiled with every import line on its page. So the tutorial's client block supplies imports to unported sections (How-to). Trimming imports to what the section uses broke 2 of 6 lanes.
- Silent that the printers which receive no description (attempt, each, print, expr) cannot reach layout. A handle printed inside error handling (elixir) needs a pre-qualified accessor from the hook.
- Silent on names beyond module, client and ctor: rust's use line and elixir's Helpers alias need more. Silent on whether template-derived names in signatures should use {sdk}Suffix or come from the hook.
- The token list says {sdk} etc. are filled in signatures, but direct.returns and prepare.returns were not filled (shared bug).
- Step 5 'classes: true where Entity_<lang> declares a class...; false for ... clojure namespaces' gives no answer for elixir, whose entity is a module named by entity.Name, neither className nor Name.
- Silent on the closed MemberKind sentences being FALSE for a runtime ('Return a copy of the SDK utility object' for elixir) and on how to notice: the guard cannot.
- Silent on null-argument forms that the old component chose per operation (elixir: load passed H.deep(%{}), list and remove nothing). Such a form cannot be kept without an operation name in the provider and must be listed as a unification.
- Silent that topQuickText reuses the tutorial's attempt blocks. Every root block of a language whose old root used bare calls (rust unwrap, elixir) changes, so 0 identical root blocks is expected.
- Per-language table: rust 'Functions? check' is Methods. elixir 'raise | module per entity | Functions' omits the module-name, utility, stream and arity issues. 'raise' is right.
- How to check: diff2.js, purity.js, issuecheck.js and prose.js hard-code their language lists (only diffref.js and proseref.js take an env var). diffref.js and issuecheck.js heading regexes do not know elixir's '### Functions', '### Constructors' or 'Demo.Entity.X' (304 lines UNEXPLAINED until edited). diffref's reasons are by section and heading, so rust reached 0 UNEXPLAINED with no new rule. 0 UNEXPLAINED there is not a line-by-line review; I wrote per-block normalizers (mine/exblocks.js, refblocks.js) to get one.
- metrics3.js measures provider growth since v2, which does not exist for a newly ported language. I counted per language with mine/m.js.
- 'A REFERENCE block gets a fresh Scope' is stated, but not its consequence: feature snippets now print their imports (ts, c, zig, rust, elixir all gained them), a code change in every toolchain-less language.

## G. Purity notes from the checks

### check-v2

I scanned all six Syntax_<lang>.ts files by grep and read each one. Model reads: 0. Naming rules: 0. Reserved-word lists: 0. String surgery on a generated name: 0. The only near case is c's example variable `sym.vars + '[i]'` and `created_` + field, which are example-variable syntax.

Zero was reached by MOVING names into a per-language Naming_<lang>.ts hook, not by copying. The hooks call the code generator's own functions: packageName, goModule, pyPackageDir, cIdent/cVarName, zigVarName, cljAccessor/cljEntityNs/cljEntityAlias. C_RESERVED and ZIG_RESERVED now live only in utility_c and utility_zig.

Some rules are still written twice, but in the hooks, not in providers:
- the client class model.const.Name+'SDK' mirrors the ProjectName template substitution;
- c's ctor cIdent(model)+'_sdk_new' mirrors the template's projectname_sdk_new;
- the literals 'core/api.h', 'sdk' and 'sdk.api'/'api/make-sdk';
- the py package rule, still inline in 5 other py components.

Whether-decisions left in providers, all conditions on the printed section rather than on the description, so I judge them syntax:
- go: `_ = client`, fmt/os imports, := versus =;
- py: `import os`;
- c: `#include <stdlib.h>`, where err and handles are hoisted;
- zig: cx.inAttempt;
- clojure: the requires filter and the doseq/let fusion.

The record-or-fields choice moved into the description plus facts.prints. All six declare 'record', so the `fields` printers in all six are dead, untested code.

### check-ref

I scanned Syntax_ts/go/py/c/zig.ts with grep for model, ctx$, getModelPath, target., KIT, apidef and utility_<lang> imports. I found 0 model reads. Imports are limited to canonToType, canonKey, indentLines, jsKey, jsProp, jsQuote and uses.

Reading the files: no reserved-word list and no naming rule remain in the Syntax files. The string operations are escaping (str()) and syntax (c's `vars[i]`, zig's arm()). Whether-decisions in the providers are declarations, not conditions on the model: which members exist, cancel, signal, prepare.fails. The only conditional layout is ts's `wide` flag, which comes from the statement.

Zero was reached mostly by moving facts into the description: className via entityClassName; ops, ids, option rows and actions in sdkdesc.ts. Names come through the Naming hooks, which call the generators' own goModule, pyPackageDir, packageName, cIdent, cVarName and zigVarName.

It was not reached entirely without copying:
- (1) Every hook restates client and ctor by concatenation (`Name + 'SDK'`, `'New' + Name + 'SDK'`, `Name + 'SDK.new'`) instead of calling a shared function.
- (2) Every hook carries `vars: <var> + 's'`, an English pluralisation rule written five times and used by no code generator. It is defective (`utilitys`).
- (3) Option-row texts live in sdkdesc.ts OPTION_TEXT, not in the model (D26 only partly fixed).

The shared ReadmeRef.ts switches on member kinds and enum values that exactly one runtime declares: streamChannel (go), streamIterator and cancel (ts), prepare 'value' (ts) and 'errorunion' (zig). That is per-language prose relocated into the shared file. It is go 29% and ts 18% of the words of their language-written part of the page.

The RefFacts tables are hand-written. The guard checks only that each declared function name exists (it passed wrong parameters and return types in my control) and does not check types (zig `any`).

## H. Facts stated in several document families (anatomy of the rest)

- **Client constructor options: apikey and its env var, Basic secret, required against defaulted server variables, base for a spec without servers**
  - Families: quick (20), root topquick (20), model options table (20), REFERENCE constructor (20), howto live tests and custom fetch (19), toptest (test client). Counted: 'apikey' in quick, model, topquick and REFERENCE in 20 languages each, howto in 19; server variables in quick and topquick (4) and model (1, ts).
  - Consequence: Must move first and in one step across all six. auth-basic changes only ts's quick, howto, model and topquick (counted), and stage 1 showed that porting one section makes ts say region is defaulted and required in the same README.
- **Which operations an entity has (active, callable, canonical order)**
  - Families: intro op list (19 contain the five-op list), model 'Operations:' line and entity interface (X7, S23), entity operations table (S24), REFERENCE ops (S25), quick and topquick, errors and expl.table (primary op), toptest, the root README entity table
  - Consequence: op-off-* changes only go's ReadmeEntity and REFERENCE; op-absent-readonly changes intro, model and entity in all 20. The op list in the description has to replace every copy at once, or the intro and the entity table will disagree.
- **Error and return convention (raise, throw, die, err, Result, union, NULL with *err set)**
  - Families: errors (20), howto (20), model Result shape and rows (20), REFERENCE (20), quick (18), AGENTS.md (18), root topquick (16), toptest (5), entity rows (4: zig, rust, ocaml, elixir), explanation (c)
  - Consequence: One declared enum per language, written into sentences by the shared side. It must exist before any of these families is ported, or the error-handling section (ts text in 15 languages today) and the Result shape will contradict the quick start.
- **How an entity's record is read (.data(), data_get, Data(), :data-get, e_data_get) and what a list returns (collection noun)**
  - Families: expl.table (20), quick (18), howto (18), model (18), root topquick (18), REFERENCE (18), errors (16), toptest (14), entity (7), explanation (2)
  - Consequence: Stage 1's RuntimeWords.data and many have to be the single source for 10 families. If they are provider phrases, they are per-language prose in every one.
- **direct()/prepare() call shape, its never-throws envelope, and the example route**
  - Families: errors (20, ts text in 15), howto direct and prepare (20), root tophowto (20), REFERENCE direct and prepare (20), model methods table and Result shape (20), root 'Direct and prepare', expl.table 'Direct vs entity access'. The fabricated /api/resource/{id} is counted in errors, howto and tophowto in all 20 (U49).
  - Consequence: One provider printer and one example route in the description. Fixing U49 in one family alone would leave four others showing the fake path.
- **Whether the test feature, and so the test client, is present**
  - Families: howto 'Use test mode' (20), model test constructor (18), REFERENCE test (18), root toptest (18), the shared pipeline sentence (S14), features
  - Consequence: feat-absent-test changes none of the four per-language families in any language (S11, S12, S13). testClient.available must be read by all of them in the same release.
- **Entity class name, accessor and handle symbol**
  - Families: intro, model methods table, entity heading and 'Create an instance', REFERENCE, quick, topquick, toptest, errors, expl.table, howto
  - Consequence: Needs the stage-2 naming hook (elixir's accessor depends on the whole collection) before any of these is ported; otherwise each copy re-derives it (U34).
- **Package and module name, import line, install command, release tag**
  - Families: install (20, the tag in all 20), quick and topquick (import), explanation (module tree and import), root Packages table, AGENTS.md (install commands for 7 targets), model (import in the constructor code)
  - Consequence: One layout/install block in the description (packageMeta, D27, D29). AgentGuideContent.ts LANG_CMD is a second, partial table that would otherwise survive.
- **Target directory and relative paths (cd <lang>, ../README.md, .env.local location, ../.sdk)**
  - Families: howto (20), AGENTS.md (20), install (12), intro alongside note (shared), explanation trees
  - Consequence: Output layout (output.path, root, alias) has to be a description fact read by all of them (D33, U21, U22, S38, S40, D60).
- **Which features exist**
  - Families: expl.shared features list, explanation module trees ('Base, Test, Log' in 13: S15), features, AGENTS.md, install (perl lists feature deps), howto (c reacts to proxy)
  - Consequence: feat-none changes the shared list but not the per-language trees (counted). The feature set must be read from the description in every tree.
- **Entity fields and their types**
  - Families: model '### Entities' tables, entity Fields table, REFERENCE fields, root README entity table
  - Consequence: Three per-language copies of the same table, with the same escaping (G27, M38, D69) and alias typing (N04) defects. Fix once by sharing the row source, and port the three families together.

## I. Interface now (from ref, the page plus the quick start)

```ts
// ===== ts/src/helpers/sdkdesc.ts (description) =====
type Scalar = string
type DescServerVar = { name: string, required: boolean, dflt: string }
type DescOption =
  | { name: 'apikey', env: string }
  | { name: 'secret', env: string }
  | { name: 'server', vars: { name: string, placeholder: string }[] }
type DescArg =
  | { name: string, type: Scalar, placeholder: string }
  | { name: string, fromCreated: string }
type DescLayout = {
  module: string // what an example imports the SDK by: a package, module path, header or namespace
  client: string // the client type
  ctor: string // the function or constructor an example creates a client with
}
type DescSymbols = {
  accessor: string // the client member, or function, that yields the entity
  var: string // a variable holding one entity
  vars: string // a variable holding a list of them
  module?: string // what an example must import to call its operations
  alias?: string // the name that import is bound to
  fields?: Record<string, string> // field -> the identifier a variable named after it takes
}
type Naming = (model: any, target: any) => {
  layout: DescLayout
  symbols: (entity: any) => DescSymbols
}
// One field of an entity's record. `type` is the canonical sentinel, which a
// provider names in its own language; `text` is the spec's description, raw.
type DescField = {
  name: string
  type: any
  required: boolean
  text: string
  ops: string[] // the generated operations whose request or response carries it
}
// One generated operation, as the reference page shows it.
type DescOp = {
  name: string // canonical: list, load, create, update, patch, remove
  action: boolean // reachable only through `$action`, so no example call
  args: DescArg[] // what its example passes, id first; [] for none
  needs: string[] // list: the match members it requires (a nested entity's parent)
  idInData: string | null // update, patch: the id key the data must carry
  body: BodyFacts | null // a request body that is not JSON
}
type DescEntity = {
  name: string // model key, e.g. graph_ql
  Name: string // class-name stem, e.g. GraphQl
  className: string // the entity class, collision-free (entityClassName)
  sym: DescSymbols
  text: string // the description: the project's entity_desc, else the spec's
  ops: string[] // generated, callable, canonical order
  id: string | null // the load-match id key
  dataId: string | null // the id on the returned record
  parents: string[] // required non-id load parameters of a nested entity
  fields: DescField[]
  fieldOps: boolean // the model says which operations each field takes part in
  refOps: DescOp[] // every active operation's method, canonical order, as the reference shows it
  actions: { action: string, op: string, path: string }[] // custom `$action` routes
}
// A client option the constructor accepts, in table order.
type DescOptionRow = {
  path: string[] // the key, and for a server variable the key under `server`
  type: 'STRING' | 'OBJECT' | 'ANY'
  text: string
}
type DescFeature = { name: string, title: string, version: string }
type DescRef = {
  title: string // the language's title, as the target names it
  test: boolean // the test feature ships; without it the test constructor builds no mock
  optionRows: DescOptionRow[]
  features: DescFeature[] // the features this target has, sorted
}
type DescQuick = { entity: string, list: DescArg[] | null, load: { entity: string, args: DescArg[], nested: null | { parent: string, param: string } } | null, create: DescArg[] | null, update: DescArg[] | null, patch: DescArg[] | null, remove: DescArg[] | null, chainsId: boolean, show: string[] }  // unchanged from v2
type SdkDescription = {
  target: string
  name: string // model slug
  Name: string // class-name stem
  package: string // published package or module path of this target
  layout: DescLayout
  env: { prefix: string }
  auth: { active: boolean, in: string, name: string, basic: boolean, secret: boolean }
  options: DescOption[] // what the quick start's constructor passes, in order
  server: DescServerVar[] // variables the server URL references
  entities: DescEntity[]
  quick: DescQuick | null // null when no entity is active
  ref: DescRef
}
// ===== ts/src/helpers/media.ts =====
type BodyFacts = { kind: 'raw' | 'encoded', media: string, binary: boolean, others: string[], encoded: string[] }
// bodyFacts(op), bodyNoteText(facts, { values, once?, binary? }); bodyNote(op, target) kept = bodyNoteText(bodyFacts(op), target)
// ===== ts/src/helpers/markdown.ts =====
// mdCell(text): one line, pipes escaped, relative links unwrapped to their label, $$ escaped; mdInline(text): paragraph, relative links unwrapped
// ===== ts/src/helpers/example.ts (representation: Ent, Ref, Expr, Entry, Stmt unchanged from v2) =====
type Ent = { name: string, Name: string, sym: DescSymbols }
type Ref = { role: 'many' | 'item' | 'one' | 'created', entity: Ent }
type Expr =
  | { k: 'lit', type: Scalar, text: string } | { k: 'str', text: string } | { k: 'env', name: string }
  | { k: 'record', of: Ref } | { k: 'field', of: Ref, field: string } | { k: 'fields', of: Ref, fields: string[] }
  | { k: 'map', entries: Entry[] }
type Entry = { key: string, value: Expr }
type Stmt =
  | { k: 'client', options: Entry[] }
  | { k: 'call', entity: Ent, op: string, arg: Entry[] | null, bind: Ref | null, wide: boolean }
  | { k: 'each', item: Ref, of: Ref, body: Stmt[] } | { k: 'print', what: Expr }
  | { k: 'attempt', what: string, body: Stmt[] } | { k: 'comment', text: string } | { k: 'gap' }
// Builders: clientBlock(desc), listBlock(desc, facts), loadBlock(desc, facts), writeBlock(desc, facts), writeOps(desc),
// refOpBlock(desc, facts, ent: DescEntity, op: DescOp): Stmt[] | null  (null for an action-only op; list/load as attempt+call+each/print like the tutorial; writes a bare call, data ops always take data),
// featureBlock(names): Stmt[]  (a client statement with feature.<name>.active = true)
// ===== runtime-fact tables (example.ts) =====
type ResultStyle = 'throw' | 'raise' | 'pair' | 'errslot' | 'union'
type OpName = 'list' | 'load' | 'create' | 'update' | 'patch' | 'remove'
type RuntimeFacts = {
  method: Record<OpName, string>; named: 'call' | 'bare'; async: boolean; result: ResultStyle
  collection: string; record: string; recordType?: string; errVar?: string; errSlot?: string
  nullValue?: string; ok?: string; err?: string; prints: 'record' | 'fields'
}  // unchanged from v2
// A fixed member of the client or of an entity, as the runtime declares it.
// `sig` is the signature as the language writes it; {sdk}, {client}, {ctor},
// {module}, {accessor}, {var}, {Class} and {Name} are filled from the
// description. Each kind has its sentence written once, in the shared page.
type MemberKind =
  | 'options' | 'utility' | 'direct' | 'prepare' | 'tester'
  | 'data' | 'match' | 'dataGet' | 'dataSet' | 'matchGet' | 'matchSet'
  | 'make' | 'name' | 'client' | 'entopts'
  | 'streamIterator' | 'streamGenerator' | 'streamChannel' | 'streamList'
type Member = { kind: MemberKind, sig: string }
type RefFacts = {
  classes: boolean // an entity is a class named by its className; false: by its Name
  noun: 'Methods' | 'Functions' // what the client's and an entity's members are called
  none: string // the literal for no value: 'undefined', 'nil', 'None', 'NULL'
  keys: 'member' | 'bare' // option tables name `options.x`, or bare map keys
  maps: string // the language's maps, plural: 'objects', 'maps', 'dicts'
  container: string // the type of the options and fetchargs containers: 'object', 'voxgig_value*'
  valueType: Record<'STRING' | 'OBJECT' | 'ANY', string> // option and fetcharg value types
  ctor: string[] // the constructor, as the page shows it
  test: { sig: string, call: string, args: boolean }[] // test constructors
  accessor: { sig: string, arg: 'data' | 'entopts' } // the client's entity accessor
  op: Record<OpName, string> // each operation's signature
  client: Member[] // the client's fixed members, in page order
  entity: Member[] // an entity's fixed members, in page order
  direct: { returns: string, signal?: string } // `signal`: the type of fetchargs ctrl.signal
  // 'value': the error is returned in place of the definition; 'errorunion': a language error union
  prepare: { returns: string, fails: 'style' | 'value' | 'errorunion' }
  body: { values: string, once?: string, binary?: boolean } // what `$body` accepts
  cancel: boolean // operations take an abort signal in ctrl.signal
}
// Sentences per ResultStyle (runtimeprose.ts): listSentence, loadSentence, createComment, listComment, loadComment (v2) + opText(f, op, needs, idInData), failsSentence(f) (new). Sentences per MemberKind: memberText in ReadmeRef.ts.
// ===== provider interface (example.ts) =====
type Uses = { env: boolean, field: boolean, print: boolean, entities: string[] }
type Scope = { declared: Set<string>, local: Set<string>, stmts: Stmt[], section: Stmt[] }
type CallContext = { inAttempt: boolean, last: boolean }
type ProgramStep = { title: string, lines: string[] }
type Syntax = {
  fence: string // the code fence language
  facts: RuntimeFacts
  client: (s: Extract<Stmt, { k: 'client' }>, desc: SdkDescription, sc: Scope) => string[]
  call: (s: Extract<Stmt, { k: 'call' }>, desc: SdkDescription, sc: Scope, cx: CallContext) => string[]
  each: (s: Extract<Stmt, { k: 'each' }>, inner: (body: Stmt[]) => string[], sc: Scope) => string[]
  print: (s: Extract<Stmt, { k: 'print' }>, sc: Scope) => string[]
  attempt: (s: Extract<Stmt, { k: 'attempt' }>, inner: (body: Stmt[]) => string[], sc: Scope) => string[]
  comment: (text: string) => string
  expr: (e: Expr, sc: Scope) => string
  before?: (stmts: Stmt[], desc: SdkDescription, sc: Scope) => string[]
  program?: (steps: ProgramStep[], desc: SdkDescription, sc: Scope) => string[]
  // Optional: what the reference page needs beyond statements.
  ref?: RefSyntax
}
type RefSyntax = {
  facts: RefFacts
  type: (t: any) => string // a field's type, from its canonical sentinel
  key: (container: 'options' | 'fetchargs', path: string[]) => string // how a table names an option
  instance: (ent: Ent, desc: SdkDescription) => string[] // obtaining one entity from the client
}
// Lookup: ReadmeRef finds `Syntax` through optionalComponent(ctx$, target, 'Syntax') and uses the shared page when Syntax.ref exists; a target's own ReadmeRef_<lang> (loadOptional) wins over it; describeTarget(ctx$, target) (ReadmeQuick.ts) supplies the description with the Naming hook.
```
