# Porting a language to the shared README tutorial, root quick start and REFERENCE page (version 3.2)

This replaces `P/base/PORTING.md` (version 3.1). It assumes you have read
`brief.md`, `brief3.md`, `brief4.md` and `brief5.md` and nothing else. `P` is
`/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.

Everything you start from is in `P/base32/`:

| path | what |
| --- | --- |
| `P/base32/sdkgen` | the clone at tag `v32-frozen`, built (`node_modules`, `ts/dist`, `ts/dist-test`, `ts/dist-test-scaffold`) |
| `P/base32/tools` | the review tools, under git (one commit), with the nine ported languages' classifications as the reference set |
| `P/base32/harness` | the generator of the 21 model variations (the tools carry their own copy in `tools/gen`) |
| `P/base32/out/old` | OLD output: every variation, generated from the pristine code (9aebaf9e) |
| `P/base32/out/new` | NEW output at `v32-frozen` |
| `P/base32/oldclone` | a link to `P/freeze/oldclone`, the pristine old code, built. Read-only: never build in it |
| `P/base32/runtime-table.md` | what the guard reads from each of the twenty runtimes |
| `P/base32/newport.sh` | makes your workspace: `P/base32/newport.sh <lang> <dir>` |

Ported (all three sections): ts go py c zig clojure rust elixir rb.
To port, one engineer each: **perl, swift, ocaml and lua first**, then js
php csharp java kotlin scala cpp.

## 0. Your environment, and one rule about it

At the top of every shell:

```sh
export PATH=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/zigenv/lib/python3.12/site-packages/ziglang:/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH
```

That gives node 24, real pytest and Zig 0.16.0. Do not download, install or
unpack a compiler or a tool. Check what you have with `command -v` and
report it. At the freeze, on this PATH: node, go, python3 with pytest, ruby
with bundle, php with composer, perl, javac with mvn and gradle, rustc with
cargo, gcc, g++, zig present; lua, busted, dotnet, kotlinc, scala, sbt,
swift, clojure, elixir, ocaml absent. That is a fact about that machine: run
`command -v` where you are.

Never rebuild while a suite or a lane runs in the same clone. Regenerate the
output after every source change before you measure anything.

## 1. Make your workspace

```sh
P/base32/newport.sh <lang> <dir>      # e.g. P/base32/newport.sh perl P/port-perl
cd <dir>/<lang>
REGEN=1 tools/portcheck.sh sdkgen out <lang>
```

`newport.sh` copies `P/base32/sdkgen` and `P/base32/tools` (with its git
history) into `<dir>/<lang>/`, links `out/old` to the OLD output (never
copied) and makes `out/new`. Before you change anything the one command
prints exactly these two lines and exits 1; that is the expected start:

```
<lang>: NOT PORTED. No section is ported for it: ported.json does not list it, and the clone has no Syntax_<lang>.ts in ts/project/.sdk/src/cmp/<lang>/. Nothing to classify yet.
PORTCHECK <lang>: NOT PORTED
```

`REGEN=1` regenerates all 21 variations, `alias-go2` included (the clone
sits inside the workspace); it prints the variations it SKIPPED and those in
`old/` missing from `new/`, so a short count is never silent. `git -C tools
status` shows your tools changes as your language's files only.

## 2. What a language supplies, and what it never does

**The rule of this stage: every fact the page prints is checked by
something other than the person who wrote it, and the kind of check follows
from the kind of fact.** Shared code supplies no runtime value of its own:
every literal, key, word or name that differs between runtimes is a fact
your provider declares, and where you do not declare one that the page
needs, shared code throws (it no longer guesses a member name, an entity
name, an operation name, a naming hook, a literal or a word).

A language supplies five things, all in its own files:

1. **A naming hook**, `ts/project/.sdk/src/cmp/<lang>/Naming_<lang>.ts`:
   `Naming(model, target, tm) -> { layout, symbols(entity), ident? }`. It is
   the only per-language documentation file that may read the model, and it
   holds no rule the language's code generator does not also use: it calls
   the functions the generator calls (`utility_<lang>.ts`,
   `ts/src/helpers/naming.ts`). Where the generator spells a name inline,
   extract a function into `utility_<lang>.ts`, make the generator call it,
   and call it from the hook (c's `cAccessorName` is the example).
   - `layout`: `module`, `client`, `ctor`, optional `names` (by role),
     optional `vars`.
   - `symbols(e)`: `accessor`, `var`, optional `module`, `alias`, `fields`.
   - `ident(name)`: adapts a shared example name through the function the
     language's other README components use.
   - Template names go through `tm('ProjectNameSDK')` with the template's
     whole spelling, never `tm(...) + '.new'`.
2. **Printers**, `Syntax_<lang>.ts`: `client`, `call`, `each`, `print`,
   `attempt`, `comment`, `expr`, optional `imports`, `before`, `program`, and
   `ref.{type, key, instance, read}`. Each is a pure function of the
   statement, the description and the scope.
3. **Declared runtime facts**, in the same file: `facts: RuntimeFacts` and
   `ref.facts: RefFacts`. Data only. Every one is accounted for (section 6).
4. **Runtime notes**, optional: `notes: { [slot]: text }`. **Each note is one
   plain string literal in the notes table** (not a constant, not a call,
   not literals joined with `+`: the lint flags all three). A note may name
   `{module}`, `{client}`, `{ctor}` and `{names.<role>}`. Every note is
   cited, every backticked code token in it must be in its citation's
   quote, and it is linted (section 8).
5. **Guard forms**, `ts/test/runtimeforms/<lang>.ts`: written from the
   runtime before any port. It is your language's file: you complete the
   porter's part, and you correct any row you find wrong (section 3, step 1).

### What you must declare, and where its value is read from

Every value the page prints is declared; none has a shared default.

| fact | when | where the value comes from | check |
| --- | --- | --- | --- |
| `ref.facts.direct.okFalse` | always (direct prints it) | the literal `direct` puts in `ok` on a failure; the table lists it as "cited ahead of a provider" (perl `0`; every other runtime `false`) | cited: the token must be in the quote; your forms already cite it with `value:`, and a different declaration fails |
| `ref.facts.direct.abortCode` | with `direct.signal` (a runtime that cancels: ts, js) | the error code an aborted request carries | cited |
| `ref.facts.accessor.param` | always | the name the accessor's own signature gives its argument (php, lua and perl: `data`) | derived: the last parameter of your `accessor.sig` |
| `ref.facts.accessor.arg` | always | what the runtime passes the argument to: `entopts` in all twenty | derived from the entity constructor |
| `runs` on the stream member | every stream kind | when the operation runs: the table's Stream line says `a provider declares runs: '...'` (`iterate`, `call` or `background`) | derived from the stream record's quote positions |
| `copy` on a member | a getter (data, match, options, entopts) that returns a clone | the clone call in the runtime | cited, pinned to `true`; without `copy` the page says no copy |
| `ref.facts.setArg` | with `dataArg`/`matchArg` | how a map is passed to set them | cited |
| `facts.pairForm`, `facts.noError` | result style `pair` (lua) | the pair as the page names it, and the "no error" literal | cited |
| `ref.facts.none` | always | the null literal a call takes for "none" | cited, token in the quote |
| everything in version 3.1 | as before | as before | as before |

Shared code throws, by design, when one of these is missing: you see the
error at generation, not a guessed word on the page.

### Signatures carry every dimension the table shows

A signature string states what the runtime declaration states, and the guard
compares each dimension:

- **how a failure shows** (`fails`): swift's `throws`, go's second
  `error`, c's `PNError**`, rust's `Result`, zig's `Result`, lua's second
  value. The signature must carry the marker, and your printed call must
  carry the word calling such a declaration needs (`failure.call`: swift
  `try`, go `err`, c `&err`, rust `unwrap`, zig `.err`; lua `err`).
- **what it is called on** (`on`): instance, type, or module. A member the
  runtime declares on the type (swift `static func testSDK`, lua
  `ProjectNameSDK.test` with a dot, perl `my ($class, ...)`) is not listed
  among the instance members, and the call you print for the constructor
  and the test constructor is made on what the runtime declares it on.
- **callable or field** (`field`): an ocaml `entity_obj` holds both; a field
  takes no argument in your signature, and a callable is not written as a
  field.
- **a return read from a comment** (`from`): lua's `---@return` and rb's
  `@return`. Where the code says otherwise (lua's second value is the
  `sdk_err` table with `status` and `code`, `make_error.lua:62-86`, not the
  `string?` its comment says), the code wins; the forms cite it (`shows`).
- **optional parameters**, parameter names and types, and the return, as
  before.

### Streams: what is returned, and when the operation runs

A stream kind names what the call returns (`stream` a channel,
`streamIterator` an async iterator, `streamGenerator` a generator,
`streamLazy` a lazy sequence, `streamSync` an iterator, `streamFunction` a
function returning the next item, `streamList` one list). `runs` says when
the operation runs. **No sentence says when items arrive**: every runtime's
streaming feature yields from a response already read whole
(`tm/ts/src/feature/streaming/StreamingFeature.ts:52`), and in java, kotlin,
scala and perl the operation runs at the call while the feature's items are
drawn as the caller iterates. Record `runs` from the code, never from the
type: the table's Stream line gives it, from three quotes in your forms
(`forms.stream`: `construct`, `run`, `draw`).

### Examples may not walk past a failure

Decided once in shared code (`ts/src/helpers/example.ts`, `interrupts()` and
`checksItself()`), by result style:

- `throw`, `raise`, `die`, `wrapped`: a failure interrupts, so examples keep
  the bare shape.
- `pair`, `union`: the call printer takes the result apart and checks it at
  the call; single-entity REFERENCE examples (load, remove) read the record
  back after it.
- `errslot` (c): the call checks nothing, so every call that a later
  statement follows is wrapped in an `attempt` whose body is the call
  alone; your `attempt` printer prints the check (and omits an empty else).
  The tutorial writes and the root quick start keep their checks.

### What a language never does

Decide what is shown; read the model in a printer; hold a sentence whose
truth depends on the model; hold a reserved-word list, a pluralisation or a
concatenation on a name; name an operation outside its fact tables.

## 3. Order of work: the table first, then the guard, then the page

1. **Read every row of your section of `runtime-table.md` against the
   runtime, before you write any fact, and report each row that is wrong or
   missing.** The table is produced by a reader that has been wrong before
   (the last stage found eight wrong rows in six languages, and this one
   four more in the unported table). Open the file each row cites:
   `src/cmp/<lang>/fragment/`, `Main_<lang>.ts`, `MainEntity_<lang>.ts`,
   `tm/<lang>/`. Correct the forms file where the table is wrong (it is your
   file; the reader test must still pass for your language), and list each
   correction with file and line in your report. Section 9 has what is known
   for your language; the table is the starting point, not the authority.
2. **Read what the page prints**: `ts/src/cmp/ReadmeQuick.ts`,
   `ts/src/cmp/ReadmeRef.ts` (`memberText`, `STREAM_RUNS`, `accessorText`,
   `testText`), `ts/src/helpers/runtimeprose.ts`, the types in
   `ts/src/helpers/example.ts` and `ts/src/helpers/sdkdesc.ts`, and your
   language's lanes (`ts/test/generatedcompile.test.ts`: `README_LANES`,
   `DOC_LANES`, `ReadmeExamplesTest_<lang>.ts`). Then your old components
   `ReadmeQuick_<lang>.ts`, `ReadmeTopQuick_<lang>.ts`, `ReadmeRef_<lang>.ts`.
3. **Write the provider's facts from the table and the runtime**
   (`Syntax_<lang>.ts`), copying the shape from the nearest ported language:
   `Syntax_ts.ts` (exceptions, async), `Syntax_py.ts` and `Syntax_rb.ts`
   (raise), `Syntax_go.ts` (pair, a `program` printer), `Syntax_c.ts`
   (errslot, hoisting with `before`), `Syntax_clojure.ts` (a Lisp),
   `Syntax_rust.ts` and `Syntax_zig.ts` (a result union).
4. **Complete the forms file**: `sigName`, `sigParams`, `sigReturns` where
   the default reader does not fit; `renames` and `typeNames` with
   `namesWhy`; `uncompared` with a reason; `cite` for every cited fact
   (section 6). Never edit `forms.ts`, `account.ts`, `guard.ts`,
   `runtimefacts.test.ts` or `runtimereader.test.ts`.
5. **Write the naming hook and the printers.**
6. **Delete** `ReadmeQuick_<lang>.ts`, `ReadmeTopQuick_<lang>.ts` and
   `ReadmeRef_<lang>.ts` with `rm`, and update the shared tests that name
   them (section 4).
7. Build (`cd sdkgen/ts && npm run build`), run the guard and the reader for
   your language, regenerate, and run the one command, first from scratch
   (`SCRATCH=1`), then normally (section 5); classify until it passes.
8. Run your language's toolchain lane or command where the toolchain is here
   (section 9).
9. Commit (section 10) and report (section 12).

## 4. What a port may touch

Only these, and only for your language:

- `ts/project/.sdk/src/cmp/<lang>/Syntax_<lang>.ts` and `Naming_<lang>.ts`
  (new)
- `ts/project/.sdk/src/cmp/<lang>/ReadmeQuick_<lang>.ts`,
  `ReadmeTopQuick_<lang>.ts`, `ReadmeRef_<lang>.ts` (deleted)
- `ts/project/.sdk/src/cmp/<lang>/utility_<lang>.ts`, and a generator
  component of your language that now calls a function you extracted
- `ts/test/runtimeforms/<lang>.ts` (your language's forms, the reader part
  included where you correct a wrong row)
- the shared test files that name your deleted components, **only in the
  lines that name your own language**. Searched at the freeze with
  `grep -nE 'Readme(Quick|TopQuick|Ref)_<lang>\b' ts/test/*.ts` for each of
  the eleven:

  | lang | shared test files naming its components |
  | --- | --- |
  | lua | `ts/test/lua-table-keys.test.ts:53-55` (`ReadmeQuick_lua.ts`, `ReadmeRef_lua.ts`, `ReadmeTopQuick_lua.ts`, listed as luaKey callers) |
  | js php csharp java kotlin scala swift cpp perl ocaml | none |

  The Ruby pilot (a62870e2) touched no shared test. Tests that check every
  target generically keep running on your page and are not yours to edit:
  `ts/test/media.test.ts:375` (finds a REFERENCE by `ReadmeRef_<lang>` or
  `Syntax_<lang>`), `ts/test/vendored.test.ts:425` (loops over the
  `ReadmeRef_*` files that exist), `ts/test/generate.test.ts:2544` and
  `:2752` (every target's REFERENCE, its operation headings and returns).
  If one of them fails on your port, that is a finding: record it.
- `ts/test/golden/add-output.txt`: only your language's lines, regenerated
- in your tools copy: `hand/<lang>.json`, `normalizers/<lang>.js`,
  `counts/<lang>.json`, `purity-allow/<lang>.json`; `classes/<lang>.json`
  and `review/<lang>/` are generated

Nothing else: not `ts/src/**`, not another language's directory, not the
shared guard files, not `ts/dist`, not a shared file of the tools.

### When a shared file seems to need a change (perl, swift, ocaml, lua first)

The first four ports run before the other seven so that what the shared
code cannot express is found once. If you meet such a construct:

1. Stop. Do not work around it in the provider.
2. Record, in your report: the construct, with the file and line of the
   runtime or old component; the smallest change that would express it;
   whether it is BREAKING (a new required fact, a new `Expr`/`Stmt` kind, a
   changed sentence) or ADDITIVE (an optional member, a new `MemberKind`,
   `NoteSlot`, `ResultStyle` or stream kind with its sentence written once);
   and which providers it would force work in (name them).
3. Only if your port cannot continue without it: make it as a separate
   commit of shared files only, additive only, with that record in its
   message body, and say so first in your report. What the first four find
   is fixed once in shared code before the other seven start.

A fact key with no default category (`no default category in the shared
account`) is such a change (`ts/test/runtimeforms/account.ts`, `DEFAULTS`).

## 5. The review: one command

```sh
cd <dir>/<lang> && SCRATCH=1 REGEN=1 tools/portcheck.sh sdkgen out <lang>   # as a language nobody reviewed
cd <dir>/<lang> && tools/portcheck.sh sdkgen out <lang>                      # with your hand records
```

It exits 0 only when every number below holds:

| number | must be |
| --- | --- |
| ledger, each section: `OPEN` (unclassified, RECOUNT and INVALID together) | 0 |
| ledger, each section: `defect` | 0 |
| blocks, each section: `OPEN` (classes, and a changed normalizer count) | 0 |
| blocks, each section: `defect` | 0 |
| purity: `open` | 0 |
| guard: `^<lang>: ` in `runtimefacts.test.js` | every test passes, more than 0 ran |
| fact sheet: facts with no account | 0 |
| facts: `UNATTESTED` (a language or convention fact the OLD page does not attest) | 0 (a hand record decides it) |
| shared sentences printed less often than their reference | 0 (open classes) |

It also prints, and you report: units same; classes matched as shared
sentences, and how many of those match a sentence nobody has reviewed
(`STRICT_SENTENCES=1` makes them fail once the sentence review is done);
by hand; missing; contradictions; the absent list (sentences every
reference language of your result style prints and you print nowhere; not
failed, but each needs a reason in `hand/<lang>.json` under `absent`).

### How to classify

The worklists are `tools/review/<lang>/<section>.ledger.txt` and
`<section>.blocks.txt`, with `*.open.json` as templates. Write outcomes into
`tools/hand/<lang>.json`: `{ "<10-hex id>": { "outcome", "why", "n" } }`.
Keep `n` from the template.

- **Shared sentences are matched for you**, with your fact tokens masked.
  Matching says nothing about whether the fact in the sentence is true.
- **Everything else is yours, one class at a time.** Outcomes:
  `same-meaning` (needs `why`), `restored:shared|fact|printer|note`,
  `correction:<catalogue id or name>`, `unification:<name>`, `dropped`
  (needs `why`), `defect` (fails until the source is fixed),
  `contradiction` (an echo only).
- **A missing unit is always by hand**, restored (where) or dropped (why).
- **An echo** is `contradiction` (`where`, `true`, `evidence`) or
  `same-meaning` with the reason the statements agree.
- **A class left open with "prints it in fewer variations, or fewer times,
  than <ref> does"** is a dropped sentence until you show otherwise. One
  known case is not: the sentence splitter does not split after `.**`, so a
  sentence printed after a bold step lead (go's one-program tutorial,
  `auth-off`) is a different unit.
- **A hand record whose reason goes stale is your problem too.** A record at
  an unchanged count stays decided even when a shared change makes its
  `why` false (this stage found five). When shared text you depend on
  changes, re-read your records that quote it.

### Facts the OLD page cannot show

`tools/review/<lang>/facts.txt` lists every fact, its account and one OLD
and NEW unit. A `language` or `convention` fact (`ref.maps`, `ref.noun`,
`ref.entityNoun`, `ref.heading`, `ref.valueType.*`, `facts.errVar`,
`facts.unusedError`, the enumerations) is compared with your OLD page: each
distinct NEW unit carrying it must pair with an OLD unit holding the same
value in the same place. Otherwise it is UNATTESTED, and you record it by
hand: `hand/<lang>.json` -> `facts: { "<path>": { value, why, evidence } }`,
saying why the OLD page differs (or has no such sentence) and what shows
the value is right. Expect `ref.noun` for a language with functions, not
methods, and `ref.heading` where the old heading was a word (clojure's
`Client`). A wrong enumerated fact (`named`, `prints`, `entityBy`, `keys`)
makes you print another value's sentences: the sheet says UNATTESTED or
"not judged"; read those classes.

### Blocks

Every OLD code block is paired with NEW: identical; identical after named
corrections; changed by a named unification; otherwise. The `classes`
column counts the "otherwise" pairs grouped by their masked diff, plus
OLD-only and NEW-only blocks, plus identifiers new to or gone from the code
(the screen prints the split). The `compiler on PATH` column means only that
`command -v` finds one: **no tool compiles the changed blocks of these 21
variations; the toolchain lanes compile their own models.** Report the
changed blocks as compiled by nothing unless a lane covered them. After
reading the pairs, record the normalizer counts:
`node tools/blocks.js --old out/old --new out/new --lang <lang> --section tutorial,rootquick,reference --record-counts`.

## 6. The guard, and the account of every fact

Every leaf in `facts`, `ref.facts` and `notes` is one of:

- **derived**: the guard re-derived it from the runtime (methods,
  parameters, optionality, returns, style, async, record accessor, members
  both ways, member shapes, `on`, `field`, `fails`, the accessor's argument
  and parameter, `runs`, the field types);
- **cited**: your forms file names a runtime file and a quote that **shows
  the value**: every code token of the value must be in the quote; a value
  that is prose, a boolean, a member kind or a note is pinned (`value:`) to
  what you audited, and counted as pinned prose, which only the reviewer
  checks;
- **cited, an absence**: `{ absent: { pattern, files }, value }` for a fact
  that says something is not there (`cancel: false`): the search runs on
  every check and must find nothing;
- **language** (only what no runtime file can show: how a map is called in
  prose, the blank identifier) or **convention** (a noun, a heading): both
  compared with your OLD page by the tools (section 5).

`unquoted: { <token>: <reason> }` excuses a code token missing from a quote
only when the token stands nowhere within 3 lines of any quote of that
citation (the guard refuses it otherwise; quote it there instead). The
guard report prints, for each excused token, how many runtime files hold it;
the reviewer reads every excuse. A citation may never quote a line that
does not show its value: use an excuse or a pin, openly.

```sh
cd sdkgen/ts && SDKGEN_GUARD_REPORT=1 node --test --test-name-pattern 'account, per language' dist-test/runtimefacts.test.js
node --test dist-test/runtimefacts.test.js dist-test/runtimereader.test.js
```

## 7. What the independent reviewer will do after you

Report only what you ran. Your reviewer starts from your commits and your
tools copy, and:

1. audits every cited fact and every pinned-prose fact against the runtime:
   opens the file, reads the quote, checks it shows the value; reads every
   `unquoted` excuse and every hand-recorded fact;
2. reads OLD and NEW side by side for three variations (at least `B`, one
   auth variation and `ref-issues`): README tutorial, root quick start and
   REFERENCE, and lists every sentence false for your runtime;
3. re-runs the one command from a clean regeneration, normally and with
   `SCRATCH=1`, and compares every number with your report;
4. changes a fact of each category in your provider (derived, cited, cited
   absence, pinned prose, language, convention, enumerated) and checks that
   something fails, naming the fact;
5. drops a shared sentence from one variation and from all, and checks
   that something fails or is listed;
6. re-runs your toolchain lane where one exists.

## 8. Purity: what a provider and a hook must not do

```sh
node tools/purity.js --providers sdkgen/ts/project/.sdk/src/cmp --lang <lang> --root out/new
```

It flags in `Syntax_<lang>.ts`: an import other than the printing helpers; a
read of the model under any name; a reserved list; a case change or
concatenation on a description name; an operation literal outside the fact
tables; a condition on what the description shows. In notes: a note naming
a feature, option, entity or operation, or stating a number; a note that is
not one plain string literal; a declared note that is not, whole, one entry
of the table. In `Naming_<lang>.ts`: concatenation onto a generator name,
pluralisation, an unimported reserved list, and for each function the hook
calls whether a non-README component calls it too. Accepted findings go in
`purity-allow/<lang>.json` with the reason (expected: `exampleVarName`; a
note that names a model word by coincidence, accepted only with why it is
true whatever the model says).

## 9. The eleven languages

Read your row with your section of `runtime-table.md` (regenerated at
`v32-frozen`), and the runtime, before writing a fact. Each row was settled
from the runtime, file and line; where two readers disagreed, both readings
are given and you settle it.

| lang | result style | stream (kind; `runs`) | what this stage settled from the runtime | compile or run its examples here |
| --- | --- | --- | --- | --- |
| **perl** | die | streamFunction (returns `sub`, Entity.fragment.pm:149); `runs: 'call'` (`_run_op` before the coderef is returned; the feature's items are drawn per call, Entity.fragment.pm:177,202,205) | `direct`'s `ok` is `0` or `1`, not a boolean (Main.fragment.pm:226,245,260,264,310 `'ok' => 0`, :300 `? 1 : 0`): `direct.okFalse: '0'`, cited ahead in your forms. `test` is a class method (`my ($class, $testopts, $sdkopts) = @_`, Main.fragment.pm:364-365): on the type, called `DemoSDK->test(...)`, not an instance member. Accessor `($data)` -> `new($client, $entopts)`: `param: 'data'`, `arg: 'entopts'`. Parameters are read from `my (...) = @_;`. No type column. `prints: 'fields'`. Data getter clones (`Voxgig::Struct::clone`, Entity.fragment.pm:103): `copy: true` | `tools/before/run.sh sdkgen perl` (`perl -Ilib t/readme_examples.t`) |
| **swift** | wrapped (`unwrap: 'asNative as? Entity'`) | streamIterator (`AsyncStream`); `runs: 'call'` (`try runOp` and the feature's items before the `AsyncStream` is built, EntityBase.fragment.swift:223,229,236) | every operation, `prepare` and `stream` are `throws` (EntityLoadOp.fragment.swift:8, Main.fragment.swift:96, EntityBase.fragment.swift:188-189); `direct` is not. Signatures carry `throws`; the call printer prints `try` (`failure: { shows: 'throws', call: 'try' }`). `testSDK` is `public static` (Main.fragment.swift:330): on the type. `okFalse: 'false'` (`.bool(false)`, Main.fragment.swift:178). `data(_:)`/`matchv(_:)` with no default: `dataArg`/`matchArg` | none: swift absent |
| **ocaml** | raise | `e_stream : ... value Seq.t`; the shared engineer read `streamLazy` (the type), the guard reads `streamSync`; both agree on `runs: 'call'` (`run_op` and `rt_stream` before the Seq is built over the finished list, Entity_ocaml.ts:141-152). Choose the kind whose sentence is true of what is returned, and say why | `entity_obj` fields are fields, not functions: `e_name`, `e_client`, `e_utility`, `e_entopts`, `e_data`, `e_match`, `e_entctx`, `e_deleted` (tm/ocaml/sdk_types.ml:198-204,223); `e_load` and the other arrows are callables. The client is a module (`make`, `make0`, `test`, `test_with`, `direct`, `prepare`, `graphql`, `entity`): every member is on the module, and it has no options or utility member (Main_ocaml.ts:168-200). `okFalse: 'false'` (`Bool false`, sdk_features.ml:1775). `noun: 'functions'`, `entityNoun: 'Fields'`, heading via `heading` | none: ocaml absent |
| **lua** | pair: `pairForm: 'value, err'`, `noError: 'nil'` | streamFunction (returns `function()`); `runs: 'iterate'` (the coroutine is created at the call and first resumed on the first pull, Entity.fragment.lua:179-192) | the error value is the `sdk_err` table with `.status` and `.code` (tm/lua/utility/make_error.lua:62,66,86), not the `string?` of the `---@return` comment (EntityLoadOp.fragment.lua:10-12): say "table" where the page states it. `ProjectNameSDK.test` is a dot function (Main.fragment.lua:432; every other member has a colon): on the type. Accessor `(data)` -> `new(client, entopts)`. OLD lua's display-field fallback never fired (decide `prints` from the OLD output). Update `ts/test/lua-table-keys.test.ts` (section 4) | none: lua and busted absent |
| js | throw, async | streamIterator; `runs: 'iterate'` (EntityBase.fragment.js:107) | as ts: `abortCode` and `signal` (cancels), `okFalse: 'false'` (Main.fragment.js:208) | nothing: no README example test (`before/run.sh` prints NOT RUN) |
| php | throw | streamGenerator; `runs: 'iterate'` (Entity.fragment.php:148) | `keys: 'bare'`; `prints: 'listFields'`; accessor `$data = null` -> `__construct(... ?array $entopts)`: `param: 'data'`; data getter clones (`copy: true`); `okFalse: 'false'` (Main.fragment.php:262) | `tools/before/run.sh sdkgen php` |
| csharp | throw | streamIterator; `runs: 'iterate'` (`RunOp` inside the async iterator, on the first `MoveNextAsync`, EntityBase.fragment.cs:257,306) | `Stream` takes a fourth `[EnumeratorCancellation] CancellationToken cancel = default` (shown optional); `Direct`/`Prepare` take a required `fetchargs`; `okFalse: 'false'` | none: dotnet absent |
| java | throw | streamLazy (`Stream<Object>`); `runs: 'call'` (`runOp` before the Stream is returned; the feature's items drawn as iterated, EntityBase.fragment.java:246,278,292) | operations have no overloads: both parameters required (EntityLoadOp.fragment.java:22); `testSDK()` and `testSDK(a, b)` overloads; `okFalse: 'false'` (SdkClient.java:217) | `tools/before/run.sh sdkgen java` (structure) |
| kotlin | throw | streamLazy (`Sequence`); `runs: 'call'` (EntityBase.fragment.kt:213,245,248) | the client constructor has no return (the reader once read its superclass as one, Main.fragment.kt:8); `name` is a property; `okFalse: 'false'` | none: kotlinc absent |
| scala | throw | streamSync (`Iterator[Object]`); `runs: 'call'` (EntityBase.fragment.scala:192,218,240) | `toString` is a `def` with no parameter list, a callable (SdkClient.scala:81); `matchArgs`; `okFalse: 'false'`: the runtime writes `java.lang.Boolean.FALSE` (SdkClient.scala:175), excused in your ahead citation | none: scala and sbt absent |
| cpp | throw | streamList (`std::vector<Value>`); `runs: 'call'` (types.hpp:1424,1454) | the client constructor has no return (the reader once read `explicit`, Main.fragment.cpp:17); the no-argument test overload is a second `test` entry; `okFalse: 'false'` (`Value(false)`, types.hpp:1085) | `node --test --test-name-pattern '^cpp: every documented example compiles' dist-test/generatedcompile.test.js` |

Every runtime passes its accessor's argument to the entity constructor's
options (`arg: 'entopts'`); php, lua and perl name the parameter `data`
(`param: 'data'`), and the page then says "Its `data` argument holds the
entity options".

## 10. How to commit

In your clone, these kinds apart, in this order:

1. shared source and tests: a port has none, except the lines of a shared
   test that name your own language (section 4), in their own commit;
2. per-language files, staged by explicit path (`git add <path>`; for a
   deleted component `git add -u <path>`; never `git rm` followed by a plain
   `git commit`);
3. the build: a port changes no shared source, so `git status` after
   `npm run build` must show nothing;
4. the golden, on its own: `SDKGEN_GOLDEN_UPDATE=1 node --test
   dist-test/characterize.test.js`, then once without the variable. Only
   your language's lines change; on a conflict, regenerate.

In your tools copy, commit your language's files (`git -C tools add
hand/<lang>.json ...`): `git -C tools status` then shows nothing, and
`git -C tools log` shows your language's files only. Commit messages name no
tool and no model.

## 11. Baselines: the nine ported languages at `v32-frozen`

Produced by `tools/portcheck.sh sdkgen out <lang>` at `v32-frozen` (3d58cb46),
tools commit d2e3b26. Every language: ledger OPEN 0 and defect 0, blocks
OPEN 0, purity open 0, guard pass, 0 facts without an account, 0 UNATTESTED.
These are what a port is compared with.

| lang | section | units same | classes | shared | rule records | by hand | missing | contradictions | identical | corrected | unified | otherwise | changed blocks compiled by nothing |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ts | tutorial | 61 | 43 | 0 | 30 | 8 | 5 | 0 | 19 | 16 | 12 | 1 | 29 (node on PATH) |
| ts | rootquick | 21 | 6 | 0 | 5 | 0 | 1 | 0 | 0 | 13 | 5 | 1 | 19 (node on PATH) |
| ts | reference | 15470 | 112 | 1 | 57 | 19 | 34 | 1 | 195 | 0 | 118 | 0 | 118 (node on PATH) |
| go | tutorial | 23 | 58 | 0 | 40 | 9 | 9 | 0 | 0 | 12 | 1 | 8 | 21 (go on PATH) |
| go | rootquick | 22 | 4 | 0 | 4 | 0 | 0 | 0 | 0 | 14 | 4 | 4 | 22 (go on PATH) |
| go | reference | 17481 | 89 | 0 | 64 | 11 | 12 | 2 | 337 | 21 | 18 | 0 | 39 (go on PATH) |
| py | tutorial | 61 | 40 | 0 | 31 | 5 | 4 | 0 | 26 | 22 | 0 | 0 | 22 (python3 on PATH) |
| py | rootquick | 19 | 3 | 0 | 3 | 0 | 0 | 0 | 0 | 18 | 0 | 1 | 19 (python3 on PATH) |
| py | reference | 14958 | 117 | 1 | 77 | 19 | 19 | 1 | 230 | 0 | 83 | 0 | 83 (python3 on PATH) |
| c | tutorial | 61 | 38 | 0 | 29 | 5 | 4 | 0 | 0 | 41 | 0 | 7 | 48 (gcc on PATH) |
| c | rootquick | 19 | 3 | 0 | 3 | 0 | 0 | 0 | 0 | 2 | 0 | 17 | 19 (gcc on PATH) |
| c | reference | 14872 | 106 | 0 | 67 | 21 | 18 | 0 | 151 | 143 | 19 | 0 | 162 (gcc on PATH) |
| zig | tutorial | 61 | 43 | 0 | 32 | 5 | 5 | 1 | 24 | 17 | 0 | 7 | 24 (zig on PATH) |
| zig | rootquick | 19 | 3 | 0 | 3 | 0 | 0 | 0 | 0 | 2 | 15 | 2 | 19 (zig on PATH) |
| zig | reference | 15019 | 113 | 2 | 76 | 15 | 19 | 1 | 151 | 0 | 162 | 0 | 162 (zig on PATH) |
| clojure | tutorial | 61 | 38 | 0 | 29 | 5 | 4 | 0 | 26 | 21 | 0 | 1 | 22 (no compiler on PATH) |
| clojure | rootquick | 19 | 3 | 0 | 3 | 0 | 0 | 0 | 0 | 16 | 0 | 3 | 19 (no compiler on PATH) |
| clojure | reference | 14983 | 124 | 1 | 75 | 23 | 25 | 0 | 230 | 0 | 83 | 0 | 83 (no compiler on PATH) |
| rust | tutorial | 61 | 46 | 0 | 32 | 9 | 5 | 0 | 26 | 22 | 0 | 0 | 22 (cargo on PATH) |
| rust | rootquick | 19 | 3 | 0 | 3 | 0 | 0 | 0 | 0 | 18 | 0 | 1 | 19 (cargo on PATH) |
| rust | reference | 15019 | 126 | 0 | 83 | 25 | 18 | 0 | 230 | 0 | 83 | 0 | 83 (cargo on PATH) |
| elixir | tutorial | 61 | 40 | 0 | 29 | 7 | 4 | 0 | 16 | 22 | 10 | 0 | 32 (no compiler on PATH) |
| elixir | rootquick | 19 | 3 | 0 | 3 | 0 | 0 | 0 | 0 | 18 | 0 | 1 | 19 (no compiler on PATH) |
| elixir | reference | 14802 | 130 | 0 | 86 | 21 | 22 | 1 | 151 | 0 | 162 | 0 | 162 (no compiler on PATH) |
| rb | tutorial | 61 | 47 | 23 | 0 | 19 | 5 | 0 | 3 | 21 | 23 | 1 | 45 (ruby on PATH) |
| rb | rootquick | 19 | 3 | 0 | 0 | 3 | 0 | 0 | 0 | 2 | 15 | 2 | 19 (ruby on PATH) |
| rb | reference | 15059 | 119 | 48 | 0 | 51 | 19 | 1 | 303 | 0 | 10 | 0 | 10 (ruby on PATH) |

"Compiled by nothing" counts the changed blocks of the 21 variations; the
lanes compile their own models (at the tag: ts README 16/16, go README 12/12,
py README 12/12, c DOC 6/6, rust DOC 6/6, rb 49/49, zig documentation 6/6).

Shared outcomes matched against a sentence nobody has given a verdict:
ts: 1 matched, unreviewed 1, go: 0 matched, unreviewed 0, py: 1 matched, unreviewed 1, c: 0 matched, unreviewed 0, zig: 2 matched, unreviewed 2, clojure: 1 matched, unreviewed 1, rust: 0 matched, unreviewed 0, elixir: 0 matched, unreviewed 0, rb: 71 matched, unreviewed 71.
`node tools/sentences.js --clone sdkgen --old out/old --new out/new --match`
lists 297 distinct reference sentences; 68 rest on a person's decision (56
by hand only, 12 both), 229 only on stage-3a rule records; 0 have a verdict
in `reviewed/sentences.json` yet.

Hand-recorded facts at the tag (each with value, why and evidence in
`hand/<lang>.json`): go `errVar`; c `errVar`, `ref.noun`; clojure
`ref.noun`, `ref.heading`, `ref.valueType.OBJECT`; elixir `ref.noun`.
Absent lists, each entry explained: zig 12 and rust 12 (each the other's
sentences under another mask, plus rust's direct note, zig's prepare and
stream notes, and zig's `make`, reachable only as `asEntity().makeEnt()`),
clojure 1, elixir 1, rb 1.

Contradictions recorded (counted, not failed): the no-test SDK's test client
(ts, go twice, py, elixir, rb): the REFERENCE says it has no mock transport,
the unported README test line says it has one; true: the REFERENCE (S13).
zig: the shared README Error handling section prints TypeScript and says
operations reject; true: the tutorial and REFERENCE (a result union).

Guard account at the tag (derived / cited / language / convention, excepted
0 everywhere; pinned prose among the cited):

| lang | derived | cited | pinned prose | language | convention |
| --- | --- | --- | --- | --- | --- |
| ts | 47 | 19 | 9 | 1 | 5 |
| go | 48 | 14 | 7 | 2 | 6 |
| py | 48 | 14 | 6 | 1 | 7 |
| c | 42 | 14 | 7 | 1 | 10 |
| zig | 40 | 17 | 9 | 2 | 9 |
| clojure | 43 | 16 | 8 | 1 | 11 |
| rust | 43 | 14 | 6 | 1 | 9 |
| elixir | 48 | 15 | 9 | 1 | 5 |
| rb | 47 | 14 | 6 | 1 | 7 |

No `WRONG:` exception remains in any forms file.

## 12. What you report

1. Your commits (hash, message, files), and `git status --short` after a
   build (empty); your tools commit.
2. The one command's screen, final run with `REGEN=1`, its exit code; and
   the `SCRATCH=1` run's numbers.
3. Every row of your `runtime-table.md` section you found wrong or missing,
   with file and line, and the forms change you made.
4. Per section: units same; shared sentences matched (and against
   unreviewed sentences); by hand; missing (each with its reason);
   contradictions (where, true side, evidence).
5. Blocks per section: identical, after named corrections, by named
   unification, otherwise, and how many changed blocks nothing compiled.
6. The fact sheet's summary and the guard's account line; every pinned-prose
   citation, every `unquoted` excuse and every hand-recorded fact (the
   reviewer audits these first).
7. The absent list, each entry with its reason.
8. Purity: open, accepted (each reason), notes declared and regions found.
9. Toolchain: the lane or command, its pass/fail line and time; or the
   `command -v` that shows it absent.
10. The unported-language check: no other language's page changed
    (`diff -r` against `P/base32/out/new`).
11. Every interface gap (section 4): file, line, smallest change, breaking or
    additive, providers it would force; and whether you made a shared change.
12. What you did not run, and why.

## 13. Traps

- The old page is not the runtime, and neither is the table: read the code.
- Shared code throws where a fact is missing. A generation error naming a
  fact is the interface asking for a value, not a bug to work around.
- A note is one plain string literal; a constant or a `+` is a finding.
- `copy: true` only where the runtime clones, cited to the clone.
- `runs` comes from the order of statements in the stream's code, never
  from its type (a `Seq`, a `Stream`, a lazy-seq can be built over items
  already read).
- A null-argument form chosen per operation would need an operation literal
  outside the fact tables, which purity flags; index `facts.method[s.op]`.
- `prints` is `record`, `listFields` or `fields`: read the OLD tutorial
  list, tutorial load, root quick start and REFERENCE list before choosing.
- Imports are a fact of the page, printed once ahead of the tutorial's
  client block; the rust, c and cpp lanes compile a block with every import
  on its page.
- A REFERENCE example gets a fresh `Scope` (`standalone: true`) and prints
  no imports; an action example is the Call cell of the Actions table, on
  one line, with the route's path parameters beside `$action`.
- The test constructors exist with or without the test feature; the page
  says it then has no mock transport, and documents `tester()` wherever the
  runtime has it.
- `ReadmeRefFeatures.ts` prints `active: false` and `feature.<name>.active`
  in TypeScript form for every language; that is known and left for the
  integration (it needs a literal from every provider). Do not work around
  it in your provider; record what your page shows.
- The cancel paragraph prints only where `cancel: true` (ts today).
- lean has no entity layer and keeps its own components (language pack).
