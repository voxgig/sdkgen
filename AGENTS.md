# AGENTS.md — operating guide for AI coding agents

This is the manual for automated agents working in or with
`@voxgig/sdkgen`. It is intentionally dense. Read it before making
changes; it will save you a broken build.

Human-oriented docs live in [`docs/`](./docs/README.md) (tutorial,
how-to, reference, explanation). This file is the agent-facing summary
plus the gotchas.

**Building an SDK, not modifying the generator?** If your goal is to
produce an SDK for your own API — i.e. *consume* this tool rather than
change it — start at
[`create-sdkgen/AGENTS.md`](https://github.com/voxgig/create-sdkgen/blob/main/AGENTS.md): the end-to-end
spec → scaffold → generate → test → publish guide. This file is for
working *on* the generator itself.

---

## What this tool is

`@voxgig/sdkgen` generates idiomatic, multi-language client SDKs from an
OpenAPI-derived **model**. It is a **library + CLI**, consumed three ways:

1. **CLI** `voxgig-sdkgen` — `target add` / `feature add` scaffold a
   language or feature into a project's `.sdk/`.
2. **Engine** — `SdkGen.makeBuild(...)` runs generation (invoked by
   `@voxgig/model`, not by the CLI binary).
3. **Toolkit** — per-language generator components import this package's
   public API (`cmp`, `File`, `Content`, `Copy`, `each`, `FeatureHook`,
   `getModelPath`, …).

Pipeline: `OpenAPI → apidef → model (.aontu) → aontu (unify) → jostraca
(+ sdkgen components/templates) → SDK source`.

---

## Commands

The npm package root is **`ts/`** — run npm there. The top-level
`Makefile` wraps it (`make build`, `make test`, `make check-model`, `make
sync-model`) and runs from the repo root.

```bash
cd ts && npm install
cd ts && npm run build       # tsc --build src test  → ts/dist/ (committed) + ts/dist-test/ (gitignored)
cd ts && npm test            # node --test over dist-test/**/*.test.js
cd ts && npm run test-some --pattern="<name>"   # subset by test name
cd ts && npm run watch       # incremental compile
```

`ts/` is the self-contained npm package root: `package.json`,
`node_modules/`, `bin/`, `build/`, and the shipped `project/` scaffold all
live under it, alongside the tool's own TypeScript (`ts/src/`, `ts/test/`,
compiled to `ts/dist/` and `ts/dist-test/`) — mirroring a generated SDK's
layout. The top-level holds only the shared, non-npm pieces: the canonical
`model/`, `docs/`, and the `Makefile`. **Always build before testing** —
tests run against compiled `ts/dist-test/`.

Environment note: a transitive dep (`shape`) declares `engines.node >=24`.
Builds/tests pass on Node 22 with an `EBADENGINE` warning; ignore it.

The CLI a consumer runs, from its own `.sdk/` directory:

```bash
voxgig-sdkgen target add <ref>       # add or resync a language target
voxgig-sdkgen feature add <ref>      # add a feature
voxgig-sdkgen docs add <ref>         # add a docs item (from a package)
voxgig-sdkgen package add <pkg>      # everything an sdkgen package provides
voxgig-sdkgen package list           # what is installed, and who supplied it
voxgig-sdkgen package update <pkg>   # fetch a newer version and refresh
voxgig-sdkgen doctor                 # report .sdk/ drift; non-zero on drift
```

And one an AUTHOR runs, from a package root rather than a project — the
only verb that runs where there is no `model/sdk.aontu`:

```bash
voxgig-sdkgen package check [path]   # validate a package; non-zero on error
```

A `<ref>` is a bare name (`go`), a package-relative path
(`@acme/sdkgen-iot/iot-go`), or an absolute path — optionally suffixed
`~<alias>` to install it under a different name. See
[reference/cli](./docs/reference/cli.md).

---

## Content can come from OUTSIDE this package

Targets and features are no longer only the ones bundled here. An
**sdkgen package** is any folder holding a `sdkgen-package.json` manifest
beside a `.sdk/` directory shaped exactly like `ts/project/.sdk` —
installed from npm, a checkout, or a local path. `ts/project/` is itself
one, manifest and all, which is what keeps the bundled path and the
external path the same code.

Three consequences you must hold when changing anything in `ts/src/action/`:

1. **Never assume the bundled scaffold.** Where an item came from is
   recorded in its own copied model file as `base` / `origname` /
   `package`, and resolution reads that. Code that falls back to
   `node_modules/@voxgig/sdkgen/project/.sdk` for a bare name is right
   only for items that came from there.
2. **`add` is overwrite, and that is the contract** — it is how a resync
   works. The safety net is `doctor`, which compares every tree and every
   copied model file against the source it records. If you write
   something new during an add, doctor must learn to compare it, or the
   next add silently reverts a project's edit.
3. **One rule, one place.** Path conventions, name grammars and provenance
   reconstruction each live in exactly one function
   (`helpers/definition`, `helpers/manifest`, `action/kind`,
   `action/resolve`). This subsystem has produced the same-rule-written-
   twice defect five separate times; if you find yourself spelling out
   `model/<kind>/<name>.aontu` or "what a valid name looks like", there is
   already a function for it.

Design and rationale: [docs/design/sdkgen-packages.md](./docs/design/sdkgen-packages.md).

---

## The one mental model you must hold

Each language target is generated from **two layers**:

| Layer | Path | Nature | Edit it when… |
| --- | --- | --- | --- |
| **Templates** | `ts/project/.sdk/tm/<lang>/` | Plain target-language source, copied verbatim with placeholder substitution | the broken/changed file looks the **same for every API** (transport, base classes, utilities, runtime) |
| **Components** | `ts/project/.sdk/src/cmp/<lang>/` | TypeScript that **generates** source by walking the model | the file's shape **depends on the entities/operations** (entity classes, the constructor, README, tests) |

Plus the language-neutral components in `ts/src/cmp/` (this package's own
source) which delegate to the per-language ones via `requirePath`.

> Decision rule: *same for every API → template; depends on the API →
> component.*

Full explanation: [components-and-templates](./docs/explanation/components-and-templates.md).

---

## Entity operations return ENTITIES — a fundamental design

**Every entity operation resolves to the Entity INSTANCE**, never to plain
data: `load`, `list`, `create`, `update` and `remove` alike. `remove` returns
the entity marked as deleted. `.data()` on an instance gives back the entity
data container instance.

This is a design decision, not a trade-off to be re-opened. Entities are
stateful objects (see the "Entity instances are stateful" section every
generated README carries); the operation RESULT is the entity, and the data
is reached through it.

It has been got wrong in both directions, so the rules are explicit:

- **`done()` returns the entity.** It must not return `ctx.result.resdata` —
  that is the data the entity has just absorbed, not the result.
- **`make_result` keeps `list` results as entity instances.** One per record.
- **Declared types name the CLASS, not the data interface.** `Promise<XEntity>`
  and `Promise<XEntity[]>`, never `Promise<X>` where `X` is the generated data
  interface. A signature that says `Promise<Planet>` while the call resolves to
  a `PlanetEntity` is a lie the compiler cannot catch, and it is what broke the
  first downstream integration.
- **The typed layer takes a `.data()` hop.** Go's `LoadTyped`/`ListTyped` feed
  `typedFrom` (a `json.Marshal`/`Unmarshal` into the struct), which needs the
  DATA — hand it an entity and it marshals through the serialisation marker.
- **The serialisation marker is namespaced and non-enumerable.** It is
  `voxgig$entity`, not `entity$`: Seneca uses `entity$` on its own entities to
  hold the canon, so an SDK record fed into `entize` silently produced entities
  claiming a canon that does not exist. Non-enumerable so it cannot merge into
  a host framework's metadata at all.

**Where it lives.** In the OP FRAGMENT (or the shared op runner a language
has), never in `done()`. `done()` is the pipeline's terminal step and is also
driven by `direct()`/`prepare()` and the streaming path, none of which have an
entity — and the ports whose pipeline carries a closed `Value` union (rust,
zig, c, cpp) cannot return an entity through it at all. The op runs `done()`
to complete the pipeline and raise on failure, then returns the entity.

**Coverage.** Honoured by every target that HAS entity instances: ts, js,
dart, go, py, rb, lua, perl, php, java, kotlin, scala, swift, csharp, rust,
cpp, c, zig, elixir, clojure, haskell and ocaml. In the statically typed ports
the contract lives in the SIGNATURES — their pipeline carries a closed `Value`
union with no slot for an entity, so the op methods return the entity handle
(`Rc<EntyClass>`, `SdkEntityPtr`, `Entity*`, `entity_obj`, ...) instead of a
`Value`.

**`lean` is the one exception, by construction.** It has no entity object at
all: `Entity_lean` emits nothing, and ops are namespaced free functions over
the client `Value` (`Planet.load c m co`), dispatched by the config-driven
`SdkRuntime`. There is no instance to return, no per-entity data/match state,
no `.data()`, `make()` or `stream()`. Honouring the contract there is not a
signature change but a new entity layer for the target — a design decision in
its own right, not a port of this one. Don't record it as a simple gap.

Whoever changes a language must update its `TestEntity_<lang>` in the same
change — the generated per-entity and flow tests read the record off the op
result, and a text-only assertion will not catch the miss.

**And the generated TESTS move with it.** `TestEntity_<lang>` emits flow tests
that assert on the RECORD, so every op call site takes the data hop
(`.data()`, `data_get()`, `Data()`). Missing this is what broke every
consumer's flow suite while sdkgen's own suite stayed green — see
`ts/test/generatedcompile.test.ts`, which now compiles the generated test tree
with a real compiler for exactly that reason.

A consumer report once proposed resolving the inconsistency toward plain
records, citing a generated README's "bare records" wording. That reading is
wrong: converging on plain records INVERTS the design. The plain-data
signals — `done()`, the declared types, the README wording, `typedFrom` — were
the parts that needed fixing.

---

## Language parity is CRITICAL

The whole value of sdkgen is that **every target language behaves identically**.
A component or template lives in a per-language directory
(`src/cmp/<lang>/`, `tm/<lang>/`), so the SAME logical concern is implemented
~22 times. **A fix, feature, or behavioural change to one language is almost
never done until it is mirrored across ALL languages that have that
component.** Treat "I fixed it in go" as "I have started fixing it everywhere."

Rules:

- **Fix the class, not the instance.** When you fix a bug in one language's
  component, immediately grep the sibling `src/cmp/*/` files for the same
  shape and fix every one. Enumerate the targets — don't fix the language in
  front of you and move on.
- **`ts`/`js` are the reference implementation.** Bring a change to `ts`/`js`
  first, then port to the rest; check the others against them.
- **Parity is testable.** `ts/test/parity.test.ts` states the coverage TIERS
  as data and enforces them: FULL (drives the shared `.aontu` corpus),
  MIRRORED (hand-written mirror, free to drift), UNCOVERED (no primary-utility
  suite). Adding or removing a target fails until its tier is declared.
  `ts/test/feature.test.ts` / `featuremodel.test.ts` cover feature behaviour
  and model/template consistency. Extend them when you add behaviour.
- **A corpus section with zero cases is a FAILURE, not a pass.** The runners
  (`tm/go/test/runner_test.go`, `tm/rust/tests/common/mod.rs`,
  `tm/ts/test/utility/PrimaryUtility.test.ts`) reject an empty or missing
  section unless it is on their PENDING list, which must match the PENDING
  headers on the fixtures in create-sdkgen. Nine fixtures once shipped empty
  and every language "passed" them.
- **The corpus is compiled.** Targets execute `.sdk/test/test.json`, not the
  `.aontu` fixtures. Edit a fixture and you MUST recompile (`npm run
  test-model` in a scaffolded project) and copy back only the changed
  sections — create-sdkgen's `test/corpus.test.ts` fails on drift between the
  two.
- **The corpus has two families.** `primary/` pins the utility functions;
  `feature/` pins FEATURE behaviour, driven through a real generated SDK by
  each target's `test/feature/Corpus.test.*`. Feature cases use the ARRAY form
  of `options.feature` (position is add-order, and add-order is nesting order),
  and the tokens `#OP1`/`#OP2` for two operations the runner discovers from
  the client — no case may name an entity. A section that runs but defers part
  of its subject says so with `partial:`, not `basic: pending:`. `ts`, `js`,
  `go`, `py`, `rb`, `php`, `perl` and `java` have runners; the other targets
  do not yet.
- **A corpus section the project does not have is a SKIP; one sdkgen supplies
  is a FAILURE.** Every project carries its own materialised
  `.sdk/test/test.json`, so one scaffolded before a section existed
  legitimately has no cases to run. The first cut asserted the `feature`
  section outright and took the fleet red on every ts and js SDK for a corpus
  those projects had simply not re-pulled yet — a deployment-ordering break,
  not a defect in any SDK. The generated runners therefore SKIP a missing
  section, and the strict check lives where the corpus is CONTROLLED:
  `generatedcompile.test.ts` writes its own fixture and requires the
  `feature.<name>: ran N of M case(s)` line, so a section that goes missing
  there still fails loudly. Both directions are pinned — strip the section
  from the lane's fixture and all eight lanes fail; strip it from a project's
  corpus and all eight runners skip green.
- **`options.utility` must be REAL, or the corpus cannot run.** The cases
  script the transport through `utility: { fetcher }` — the documented seam —
  and a target whose `makeOptions` shelves every passed slot in a `custom` map
  nothing reads honours nothing while `ts` honours it. That was true of every
  target but `ts`/`js`, invisibly, because each `custom_utility` test asserted
  the side map rather than the behaviour. The eight targets above now map the
  option key onto the real member and replace it, keeping unknown names in
  `custom`; lua, elixir, clojure, csharp, kotlin and scala now do too, swift
  honours `fetcher` alone, and dart always did (`Utility.setUtility` is a
  keyed switch falling through to `custom`).

  **Five targets CANNOT have this seam, and that is a boundary rather than a
  gap.** rust, c, zig, ocaml and cpp carry options in a CLOSED value union -
  `Value::Func` is the struct library's own `(Inj, Value, str, Value) ->
  Value` shape in rust, `Injector`/`Modify` in cpp, and c's header says
  outright that "adding a variant to a general-purpose struct library to hold
  SDK objects would be wrong". No caller can put a transport function into
  those options at all, so there is nothing to remap: the seam for them is
  `system.fetch` or a transport feature. The seam exists exactly where the
  options container is dynamically typed, and that is the rule to reason from
  rather than a per-target list. `ts/test/generatedcompile.test.ts` proves each lane end to end:
  generate an SDK WITH the feature, build it, run the shipped runner, and read
  the `feature.<name>: ran N of M case(s)` line every runner prints. Exit zero
  is not enough — every framework reports a fully-skipped suite as a pass. A
  toolchain this machine lacks SKIPS, visibly; it never silently passes.
- **A per-language divergence must be deliberate and commented.** If one
  language genuinely must differ (e.g. go additionally emits `LoadTyped`
  wrappers because go-cli/go-mcp dispatch entities through the untyped
  interface, which the other targets don't have), say so in a comment at the
  divergence — otherwise a reader can't tell a bug from a decision. (The
  typed-model emitters themselves are deliberately UNIFORM: every
  `EntityTypes_<lang>` emits for every entity — active or not — via
  `only_active: false`, and maps sentinels through the shared `canonToType`
  column; see [docs/reference/typed-models](./docs/reference/typed-models.md).)

> **Cautionary example (real):** the typed-model emitter filtered structs on the
> lazily-derived `Name` (`filter(null != e.Name)`), silently dropping fieldless
> placeholder entities and producing `undefined: Gon2` in generated Go. The fix
> (derive `Name` via `names()` before emitting) had to land in **all eight**
> `EntityTypes_<lang>` components — go was merely where it surfaced first. Fixing
> only go would have left seven latent copies of the same defect.

---

## Where do I make this change?

| Goal | Edit | Then |
| --- | --- | --- |
| Fix generated **runtime** source (HTTP, base feature, utility) | `ts/project/.sdk/tm/<lang>/…` | propagate (below) |
| Fix generated **API-specific** source (entity, main, readme, tests) | `ts/project/.sdk/src/cmp/<lang>/…` | propagate (below) |
| Change a target's deps / ext / module | `ts/project/.sdk/model/target/<lang>.aontu` | propagate |
| Change a feature's hooks / deps | `ts/project/.sdk/model/feature/<name>.aontu` | propagate |
| Change the **generator core** (CLI, actions, neutral components, helpers) | `ts/src/…` | `cd ts && npm run build && npm test` |
| Change the base model schema | `model/sdkgen.aontu` (canonical) | `make sync-model` then `make build test` |
| Add/remove a bundled target or feature | the trees above **and** `ts/project/sdkgen-package.json` | a guard test fails if the manifest and the directories disagree |
| Change what an `add` writes | `ts/src/action/…` **and** `ts/src/action/doctor.ts` | a file add writes that doctor does not compare is a file the next add silently reverts |
| Change a CLI flag | `ts/bin/voxgig-sdkgen` — parse entry, the closed `Shape`, **and** the help text | plus a row in [reference/cli](./docs/reference/cli.md); the shape is closed, so missing one of the three is a runtime rejection, and an optional flag is `Skip(String)` (see Sharp edges) |
| Add a rule about a package's `.aontu` files | `ts/src/helpers/modelcheck.ts` | `package check` and `ts/test/model-compile.test.ts` are both callers — the bundled scaffold is checked by the same battery an author runs |
| Ignore another build/editor dropping (`__pycache__`, `.DS_Store`, …) | `ts/src/helpers/junk.ts` | every walk already consults it — copy, prune, doctor, feature scan; `ts/test/junk.test.ts` guards the list against the shipped scaffold |

### Never edit generated output

Files in a generated SDK (`ts/`, `go/`, …) are overwritten by
`generate`/`reset` — generation is **overwrite, not merge**, so any hand-edit is
lost. Fix the **template or component**, then regenerate. Why overwrite (and not
jostraca's 3-way merge, which silently kept stale files and injected `<<<<<<<`
markers on toolchain bumps): [regeneration-overwrite](./docs/explanation/regeneration-overwrite.md).

---

## Propagating a `ts/project/.sdk/` change into a generated SDK

```
edit sdkgen template/component
  └─▶ (consumer .sdk/) npm run add-target <lang>   # copy updated files in
       └─▶ npm run generate                         # substitute + merge into target dir
```

**Merge gotcha:** `generate` merges into existing files, and placeholder
replacement (`ProjectName`, `GOMODULE`, …) is **not** re-applied to
merged content. If you see a literal `ProjectName` in output, delete that
generated file and re-run `generate` to recreate it fresh.

Details: [customize-and-propagate-templates](./docs/how-to/customize-and-propagate-templates.md).
Debugging a failing target: [debug-generation](./docs/how-to/debug-generation.md).

---

## Conventions

- **CommonJS**, strict TypeScript, ES2021 target. Source maps on.
- `ts/dist/` is **committed**; `ts/dist-test/` is gitignored. A clean
  rebuild must leave `ts/dist/` unchanged (deterministic) — if
  `git status` shows `ts/dist/` changes after `npm run build`, commit them
  with your source.
- Index the `kit` namespace with the **`KIT`** constant
  (`getModelPath(model, \`main.${KIT}.entity\`)`), not a hardcoded
  `'kit'`.
- The model is dynamic (aontu metadata: `key$`, `val$`, `Name`, …).
  Typed model interfaces live in `ts/src/types.ts` (`SdkModel`,
  `ModelTarget`, `ModelFeature`, …) with permissive index signatures —
  prefer them over bare `any` at function boundaries.
- `each(...)` iterates objects in **sorted-key order** for deterministic,
  byte-stable output. Do not rely on insertion order.
- **The `ts`/`js` targets are the reference implementation.** When fixing
  one language, check — and fix — the others against `ts`/`js`. Language
  parity is a hard requirement, not a nicety: see
  [Language parity is CRITICAL](#language-parity-is-critical).

---

## Testing

- Node's built-in runner; files are `ts/test/*.test.ts` → `ts/dist-test/*.test.js`.
- Pure helpers (`collectDeps`, `buildIdNames`, `getMatchEntries`,
  `resolveTarget`, `isAuthActive`, `requirePath`) have direct unit tests.
- Components are tested by **rendering them through jostraca into memfs**
  and asserting on the output. Pattern:

  ```ts
  import { Jostraca, Project, Folder, File } from 'jostraca'
  import { memfs } from 'memfs'
  import { ReadmeExplanation } from '../'

  const { fs, vol } = memfs({})
  const jostraca = Jostraca()
  await jostraca.generate({ fs: () => fs, folder: '/x', model }, () => {
    Project({ folder: 'p' }, () => Folder({ name: 'd' }, () => File({ name: 'out.md' }, () => {
      ReadmeExplanation({ target: { name: 'ts' } })
    })))
  })
  // assert on vol.toJSON()
  ```

- `ctx$.model` comes from the `model` option to `generate`. `build: false`
  runs define-only (no file I/O) — handy for counting hook firings.
- **If you change generated *output*, characterize it first.** Capture
  the rendered output before your change and diff after to prove
  intentional vs accidental changes. (This is how `ReadmeExplanation` was
  refactored to a data table with zero output change.)

Validation sequence for a template/component change:

```bash
cd sdkgen && make build test                    # generator healthy (npm runs in ts/)
cd <project>/.sdk && npm run add-target <lang> && npm run generate
cd ../<lang> && <lang-test-command>             # target builds + tests
# re-run ts/js target tests too (reference parity)
```

### `test/generate.test.ts` — the component layer, generated for real

`make test` now generates a small SDK for EVERY target into memfs and asserts
on the generated text. This is the only suite that runs
`ts/project/.sdk/src/cmp/<lang>/**`; before it, a component that crashed or
emitted broken source reached the fleet unchallenged.

- **Fixture:** aontu source unified against the real `apidef`/`sdkgen` base
  models and the real `project/.sdk/model/target|feature/` models, so target
  defaults are inherited, not restated. Three deliberately awkward entities —
  full-CRUD, singleton-load (no path params), list-only — plus the basic flow
  each one would get from apidef.
- **Covers:** components crashing, ops called on an entity that does not
  declare them, leaked `ProjectName` placeholders, syntactically broken
  emissions.
- **Does NOT cover:** whether the generated source COMPILES. That still needs
  a real toolchain, i.e. the fleet regeneration lane.
- Entity NAMES and ordering in the fixture are load-bearing: several
  `ReadmeTopQuick_<lang>` components render only the first active entity by
  key, so the singleton is named to sort first. Guards in the suite fail
  loudly if that stops holding.
- Known-benign placeholder mentions are PINNED in `PLACEHOLDER_PINNED`, not
  ignored — a new leak still fails.
- The CONSUMER targets are out of the two broad loops (standalone they throw,
  by design) and so were out of the leak scan as well — the suite's only
  content guard. They get their own case, generated against the sibling each
  one wraps (`NON_SDK_SIBLING`), scanned for `ProjectName` / `PROJECTENV` /
  `PROJECTVERSION` and a surviving `$$model.path$$`. Note `$$` in a Makefile
  is a literal `$`, so the ref pattern matches a model path, not any `$$` pair.

---

## Sharp edges (already handled — don't reintroduce)

- **`requirePath(ctx$, path, { ignore: true })`** swallows only genuine
  *module-not-found*. A component that resolves but throws while loading
  must propagate — do not wrap it in a blanket try/catch that hides load
  errors.
- **`FeatureHook`** must tolerate an active feature that omits a stage:
  use `feature.hook?.[name]?.active`. Never assume every feature
  implements every hook.
- **Dry run** must be honoured everywhere. Reuse the caller's Jostraca
  instance (`actx.jostraca`); a fresh `Jostraca()` defaults `dryrun:false`
  and will write during a `-y` run.
- **Index updates** (`feature-index` / `target-index`) must be idempotent
  — adding a name already present must not duplicate it.
- **Junk is filtered in ONE place: `helpers/junk`.** Everything that walks
  a tree consults it — the tree `Copy` (through `cmp.Copy.ignore`, passed
  *per call* for the same reason `control.dryrun` is), `aliasCmpTree`,
  `pruneStaleTemplates`, doctor's drift walk, `findFeatureEntries`,
  `definitionNames` — and a new walk must too. Half a filter is worse than
  none: the writer and the reader then disagree about what a tree
  contains, which is precisely what doctor reports as drift. A stray
  `tm/py/utility/__pycache__/*.pyc` was copied into the add output for
  months. Membership is a promise that no template is ever named that, so
  `build`/`dist`/`bin` are NOT junk and `target` emphatically is not;
  `test/junk.test.ts` checks the list against every shipped name.
- **An ALIAS is a name, never a path.** It becomes the directory an item
  is installed into (`src/cmp/<alias>`, `tm/<alias>`) and `add`
  overwrites what it writes, so `go~..` would redirect the copy out of
  the target's own tree. Validated against `ITEM_NAME_RE` in both
  `parseAliases` and `resolveSource`, because those catch different
  inputs — the second sees only what survives ref parsing.
- **Provenance is matched by EXACT LINE, never by pattern.** `base`,
  `origname` and `package` are not reserved words: `module: package` (the
  Go root package identifier) and `publish: registry: package` are
  declared model slots a target may write in block form. A regex for "a
  line that looks like provenance" got both directions wrong — it read a
  target's own `module: package:` as a stamp (false fork on an untouched
  file) *and* stripped it from the comparison (a real deletion passing
  the check). Compare against what `provenanceReplace` emits.
- **An OPTIONAL CLI flag is `Skip(...)`, not `One(..., undefined)`.** The
  shape is closed AND every listed key is required: spelling the optional
  flags as an alternative with `undefined` made them mandatory, so every
  invocation that did not pass both `--only` and `--alias` — i.e. every
  ordinary `target add` — was rejected before dispatch. `Optional(String)`
  is the other trap: it substitutes `''` for a missing value, and an empty
  `--only` means "install nothing", which is deliberately not the same as
  passing no flag. Nothing caught this because nothing RAN the binary;
  `cli.test.ts` now spawns it.
- **A scaffold dotfile npm refuses to publish must be EMITTED, not
  templated.** `.gitignore` (and `.npmignore`) sit on npm's own
  always-excluded list, which naming the parent directory in
  `package.json` `files` does not override. So
  `tm/seneca-provider/.gitignore` was present for every checkout — this
  repo's whole test suite, every local `add-target` — and absent for
  everyone who installed sdkgen from the registry, whose generated
  provider had no ignore file at all. The 23 language targets escaped it
  only because they emit theirs from `Gitignore_<lang>.ts`, which is now
  the rule for all 24. `ts/test/packaging.test.ts` asks `npm pack`
  directly rather than restating npm's exclusion list.
- **`package update` must check BEFORE it fetches.** Measured before the
  source moves, a differing copy means the project changed it; measured
  after, every item legitimately differs, the gate fires on all of them,
  and the operator learns to pass `--force`. Reordering those two steps
  makes the gate worse than not having one.
- **A gate must cover what the re-add WRITES**, which is more than it is
  asked to: `target_add` re-runs `feature_add` for every active feature,
  whoever supplied it. Scope `doctor` to the blast radius, not to the
  package's own items.
- **Dry run reaches outside the project too.** `package update`'s fetch
  runs `npm install`; skipping the file writes and still fetching mutates
  `package.json`, the lockfile and `node_modules` in the one mode that
  promises nothing changes.
- **Registration by import side effect is not a capability.** The
  per-kind adders `package add` loops over are registered by
  `action/dispatch`; anything importing `action/package` without it got
  an empty table and *silently installed nothing while reporting
  success*. `adderFor` loads them lazily — do not replace it with a
  top-level import (that is a require cycle) or with a bare lookup.
- **`ts/project/.sdk/src/cmp/**` is NOT compiled by `tsc --build src test`.**
  It compiles only inside a consumer project, so a missing import is invisible
  here and breaks every generated SDK of that language. `npm run build` runs
  `check-scaffold` (`tsconfig.scaffold.json`) to type-check it — do not remove
  that step. It then runs `stage-scaffold`, which EMITS the same tree into
  `ts/dist-test-scaffold/` (a miniature consumer: compiled components under
  `.sdk/dist/cmp/`, plus copies of `.sdk/src` and `.sdk/model`) so
  `test/generate.test.ts` can run the components for real — see below.
- **Two entity views, two different questions. Pick by the question.**
  - *"Which entities do I EMIT for?"* — `getModelPath(model,
    \`main.${KIT}.entity\`)`, which is ACTIVE-filtered by default. Every
    `Main_<lang>` and every `Test_<lang>` iterates this. Reading the raw
    `model.main[KIT].entity` map instead is a defect: sixteen `Test_<lang>`
    components did, and generated a full test suite for entities the SDK
    deliberately excluded (`active: false`, which is how a consumer scopes a
    70-entity spec down to one).
  - *"What is the whole name-space of entities?"* — `entityCollection(model)`,
    which is deliberately UNFILTERED and memoised. Class-name assignment and
    type-collision work need it: `EntityTypes_<lang>` emits data types with
    `only_active: false`, so a name assigned against a filtered view cannot
    see the inactive entities it must avoid colliding with. Calling
    getModelPath for THIS is also quadratic — it rebuilds its container on
    every call when filtering, defeating the memo (~15s at 500 entities x 22
    targets).

  The two are not interchangeable and neither is "the right one". Using the
  unfiltered collection to decide what to emit ships excluded entities; using
  the filtered one to assign class names produces collisions.
- **An entity type can collide with the SDK'S OWN scaffolding, not just with a
  language keyword.** Where a target has one flat namespace, a generated type
  meets every unprefixed name the templates and components declare — the test
  tree included, because the suite loads both into one process. `naming.ts`
  carries a set per exposed language (`RB_SDK_CONSTANTS`, `SWIFT_SDK_TYPES`,
  `PHP_SDK_CLASSES`), each with a test that RE-DERIVES the list from
  `tm/<lang>/**` and `src/cmp/<lang>/*.ts` and fails on drift. These are the
  second half of "already taken"; the `*_RESERVED_*` sets beside them cover
  what the LANGUAGE owns, which is the half a scaffolding list cannot see. Add a
  top-level declaration to one of those trees and the guard test tells you to
  register it. Do not hand-maintain the list: the swift one missed three names
  on its first cut, one declared by a component rather than a template. Ruby
  only warns on a collision and carries on (issue #64, gitlab-sdk's `Runner`);
  PHP fatals on redeclaration, so the same hazard is worse there.
- **`ts/test/fixture/**` has its OWN compile lane.** `check-scaffold` covers
  `ts/project/.sdk/src/cmp/**` and nothing else, so the fixture PACKAGE's
  components — which are what an external author's components look like — had
  no type-check at all. `npm run build` now also runs `check-fixture`
  (`tsconfig.fixture.json`); keep it, or a broken fixture component fails deep
  inside a generation run as a require error naming a path instead of a type
  error naming a line.
- **`Name` is derived lazily.** Do not assume a component ran before you.
  `entityClassName` / `entityTypeCollisions` derive it themselves; if you add
  a helper that reads `e.Name`, call `deriveEntityNames()` first — and never
  memoise a result computed from an underived collection.
- **An entity need not declare `op`.** Read it as `entity.op || {}` /
  `entity.op?.load`; an unguarded `Object.keys(entity.op)` aborts generation
  for every target. `ts/test/entityname.test.ts` fails if one is reintroduced.
- **Every entity operation resolves to PLAIN records.** `list` used to wrap
  each record in an entity instance, so the same record came back with a
  different type, key order and marker depending on which call produced it —
  and the marker (`entity$`) collided with Seneca's own, silently producing
  wrong entities. The wrap is gone from every language's `make_result`; the
  marker on `toJSON()` is namespaced `voxgig$entity`. Pinned by
  `ts/test/resultcontract.test.ts`, which transpiles and RUNS the shipped
  template.
- **The HTTP status is on the error, not just in `err.result`.** `err.status`
  (-1 when there was no response) plus a `notFound` predicate, so a consumer
  never couples itself to the internal shape of `result`.
- **A generated doc example must RUN.** A `list()` on a nested entity needs
  its parent path params (`matchArg`), the offline-test example must SEED the
  mock (`SDK.test()` seeds nothing), and the entity table shows the entity's
  own route — never a custom action folded into `create`. Custom actions are
  reachable only through `$action`, so `ReadmeRef` documents them; an
  undocumented action is an endpoint no reader can call.
- **A project decision belongs in the MODEL, never in a forked component.**
  `target add` overwrites `.sdk/src/cmp/**`, `.sdk/tm/**` AND
  `.sdk/model/target/<t>.aontu`, so any hand-edit in those three is silently
  reverted on the next run — the SDK regresses with nobody touching it. When a
  project needs to say something about itself, add a model key and read it; do
  not make the project fork. The surfaces that exist for this:
  `main.kit.repo.{path,host}` (repo identity — the repo is NOT always
  `<origin>/<slug>-sdk`), `main.kit.author` / `main.kit.contributor.<key>`
  (manifest attribution — hand-edited credit is DELETED by the next
  regeneration), `main.kit.test.live.strict`, `main.kit.feature` (which feature
  source ships), and per target `module.{path,package,goversion}`,
  `publish.{version,registry.package}`, `output.{path,repo,create,adopt,sdkrel}`
  (generate into another repo). All of them are catalogued in
  [reference/model](./docs/reference/model.md#what-a-project-declares-about-itself).
  A project extends a target with `registerComponent('X')` ->
  `cmp/<t>/X_<t>.ts`, which `doctor` reports as ADDITIVE rather than drift.
- **`voxgig-sdkgen doctor` is the check that keeps all of this true.** It
  compares all THREE things `target add` owns — `src/cmp/<t>/`, `tm/<t>/` and
  `model/target/<t>.aontu` — against the scaffold *after* re-applying the
  substitutions `target add` applied (jostraca's Copy always interpolates
  `$$ref$$` against the model, and passes a DIFFERENT replace map per tree:
  `templateReplacements` for `tm`, `'BASE'` for the model file, none for
  `src/cmp`). A naive `diff -r` reports mostly placeholder replacement; so did
  doctor itself, for the three `Config.fragment.<ext>` files carrying
  `$$const.Name$$`, until it templated with an empty replace map too. Non-zero
  exit on forked / edited / stale / missing. An ALIASED target
  (`target add go~go2`) is exempt from the model-file comparison — the
  scaffold ships nothing to compare it against, and editing it is how an alias
  is differentiated.
- **Derive an env-var name with `envToken`/`envName`, never from the camel
  form.** `nom(model, 'Name').toUpperCase()` swallows a hyphen, so a slug like
  `voxgig-solardemo` produced BOTH `VOXGIG_SOLARDEMO_TEST_LIVE` and
  `VOXGIGSOLARDEMO_TEST_LIVE` in the same SDK — the template half read one and
  the component half the other, so setting either sent part of the live suite
  live and left the rest mocked, green either way. In templates the placeholder
  is `PROJECTENV` (added by `ensureStdrep`), NOT `PROJECTNAME` — that one is
  the class-name form.
- **The go module path has ONE implementation: `goModule(model, target)`.**
  Twelve components used to re-derive it inline, so fixing it in one place
  fixed nothing — and `ReadmeTop` prints it from inside node_modules, where a
  consumer cannot patch it at all.
- **Feature source lives somewhere different in every language.** Only `ts`
  and `js` use `src/feature/<name>/`; go uses `feature/<name>_feature.go`,
  py `pkg/feature/`, dart `lib/feature/<name>/`, swift
  `Sources/ProjectNameSDK/feature/`, and so on. Never hardcode one of those
  paths — `helpers/featureSource.ts` DISCOVERS them (any directory named
  `feature`, each entry mapped back to a feature name), and both `target add`
  and `feature add` go through it. Hardcoding `src/feature` is what shipped
  272 unrequested feature source files into every project. Pinned by
  `ts/test/featuresource.test.ts`.
- **Trimming the feature set can break a target's build.** `target add`
  copies source only for features the model declares AND activates, so any
  template that statically references every shipped feature stops compiling.
  Dedicated cross-feature test suites are declared per target as
  `feature: { fullset: [...] }` and dropped alongside the features they
  exercise. A template can also depend on a feature WITHOUT naming its
  symbol — `tm/c/tests/sdk_pipeline_test.c` drives retry entirely through the
  options map (`"feature", cmap(1, "retry", ...)`), so it linked fine and
  failed at runtime. No scan finds that reliably: the same quoted names
  appear all over the corpus as ordering-test data and as ordinary concepts
  (`"paging"` in a context type, `"proxy"` in a fetcher), so widening the
  `featuresource.test.ts` guard to quoted names produces ~25 hits of which
  one is real. Declare it in `fullset` instead; a target that cannot be trimmed at all says
  `feature: { trim: false }` (currently `clojure`, `lean`, `ocaml`,
  `scala`, `zig` bundled, plus `haskell` in its own package — see their
  model files for what has to change first). Aggregate indexes must be GENERATED, not templated: that is why
  `rust/feature/mod.rs` comes from `Main_rust`. And the shared test harness
  must not live in the file that gets dropped — go and csharp keep it in
  `feature_harness_test.go` / `FeatureHarness.cs` for exactly that reason.

---

## Project map (this repo)

```
model/sdkgen.aontu     canonical base model schema (mirrored to ts/model/)
Makefile               build/test/check-model/sync-model (wraps ts/ npm)
docs/                  human-oriented documentation
ts/                    the self-contained npm package root (@voxgig/sdkgen)
  package.json         the npm manifest (main: dist/sdkgen.js)
  bin/voxgig-sdkgen    CLI entry
  build/version.js     stamps the version into bin/ and the scaffold
                       manifest — run it BY HAND on a release, see Releasing
  model/sdkgen.aontu   npm-shipped mirror of the canonical model/
  src/                 generator core
    sdkgen.ts          SdkGen, makeBuild, public exports
    types.ts           ActionContext + model interfaces
    utility.ts         requirePath, resolvePath, isAuthActive
    action/            the verbs
      dispatch.ts      ACTION_MAP, built from the kind registry
      kind.ts          KINDS — what an `add` can install, and the shared spine
      resolve.ts       ref -> source; provenance recording; name collisions
      target.ts        target add (+ trees, trim, stale prune)
      feature.ts       feature add (+ the per-target fan-out)
      docs.ts          docs add — the third kind (items live in packages)
      package.ts       package add / list / update
      check.ts         package check — the author-side battery
      doctor.ts        the drift check every other action is guarded by
      action.ts        index maintenance
    cmp/               language-neutral components (delegate per-language)
      Docs.ts          the in-tree docs pass + the per-item dispatch
      ExternalDocs.ts  the out-of-tree docs Root (own generate() pass)
    helpers/           collectDeps, buildIdNames, getMatchEntries
      definition.ts    where a kind's `model/<kind>/<name>.aontu` lives
      manifest.ts      sdkgen-package.json: read + validate
      semver.ts        the engines.sdkgen subset (true/false/UNDEFINED)
      stdrep.ts        the replace maps add writes with and doctor re-applies
      featureSource.ts per-feature source discovery in a target's tm tree
      modelcheck.ts    the .aontu rules: strict parse, schema unify, probes
      shipped.ts       where THIS generator's own model/ and project/ are
  test/                Node test runner suites (+ model-mirror guard)
  dist/ (committed)    dist-test/ (gitignored)
  project/             an sdkgen package, like any other
    sdkgen-package.json   its manifest (pinned to the listings by a guard)
    .sdk/              the scaffold copied into consumer projects
      model/{target,feature}/   target & feature definitions
      src/cmp/<lang>/  per-language COMPONENTS
      tm/<lang>/       per-language TEMPLATES
```

SDK targets, BUNDLED (22): `ts js go py php rb lua csharp java kotlin scala
swift dart rust c cpp zig perl clojure elixir ocaml lean`.

SDK targets, PACKAGED (1): `haskell`, in `packages/sdkgen-haskell` — the
first migration out of the scaffold. It is NOT in any of this repo's closed
guard sets and has its own suite; see
[docs/how-to/migrate-a-bundled-target](./docs/how-to/migrate-a-bundled-target.md).

CONSUMER targets (4): `go-cli go-mcp` (wrap `go`), `py-data` (wraps `py`),
`seneca-provider` (wraps `ts`). Each switches every standard generation phase
off (`phase.<name>.active: false`) and emits its whole package from `Main`,
and each FAILS without the target it wraps — deliberately. `seneca-provider`
is also the one target that generates into ANOTHER REPO, via
`main: kit: target: <t>: output: path` (`cmp/ExternalTarget.ts` +
`externalTargets()`): see
[out-of-tree-targets](./docs/explanation/out-of-tree-targets.md).

Both lists are enforced, not decorative: `ts/test/parity.test.ts` fails until
a new target declares its parity tier, and `ts/test/featuremodel.test.ts`
fails until it is classified as SDK or consumer. Adding a target means
updating both, plus the lists in this file, `README.md`,
`docs/reference/cli.md`, `docs/reference/project-layout.md`,
`docs/how-to/add-a-target.md` and `docs/explanation/architecture.md`.

Features (all inactive by default — opt in per SDK via
`options.feature.<name>.active`):

- **Core:** `log` (structured logging), `test` (in-memory mock transport;
  accepts an optional `net` block to simulate latency / failures / offline
  — see [how-to/simulate-network](./docs/how-to/simulate-network.md)).
- **Enterprise:** `retry`, `timeout`, `ratelimit`, `cache`,
  `idempotency`, `paging`, `streaming`, `proxy`, `telemetry`, `metrics`,
  `debug`, `audit`, `clienttrack`, `rbac`.
- **Test support:** `netsim` (wraps any transport to inject network
  conditions; composes with `retry`/`timeout` etc.).

Enterprise features are implemented across **all SDK targets** (each with a
vendored `@voxgig/struct` port and a full offline feature-behaviour test
suite at parity). Two mechanisms: *transport
wrappers* replace `ctx.utility.fetcher` in `init()` (retry, timeout,
ratelimit, cache, proxy, netsim); *pipeline hooks* implement the stages in
[hooks.md](./docs/reference/hooks.md) (idempotency, rbac, metrics,
telemetry, debug, audit, clienttrack, paging, streaming). `cost` does BOTH
— it wraps the transport to price each HTTP attempt and hooks
PrePoint/PreDone to enforce a budget and attribute spend to one operation —
so never infer a feature's transport role from an empty `hook` block; the
role is DECLARED in the feature model. Behaviour is
covered by `ts/test/feature.test.ts`, which drives the **real template
source** through a simulated pipeline+network offline (see
`ts/test/featureharness.ts`); `ts/test/featuremodel.test.ts` guards
model↔template consistency.

Both of those simulate. The check that does not is the shared **feature
corpus** — language-neutral cases in create-sdkgen's
`.sdk/test/feature/<name>.aon`, run by a generated SDK's own
`test/feature/Corpus.test.*` against the compiled feature, the generated
config and a real entity operation. Prefer it for anything expressible as
data; it is what caught `error is not a function` on every ts/js pipeline
short-circuit, which both simulations had passed for as long as they
existed. Reach for the harness only when the subject is a function (a
`sink` callback) or a language idiom.

Eight targets run it today — `ts`, `js`, `go`, `py`, `rb`, `php`, `perl`,
`java` — and `ts/test/generatedcompile.test.ts` drives one lane per target:
generate an SDK carrying the feature, build it, run the shipped runner, and
require the `feature.<name>: ran N of M case(s)` line it prints. Adding a
target is a row in `CORPUS_LANES`, not a new test. Two things the lane
exists to catch: a runner that SKIPS (every framework reports that as a
pass), and a `makeOptions` that ignores `options.utility` (see "Language
parity is CRITICAL") — without that seam the cases cannot script the
transport at all.

Per-feature options, defaults, recorded state and ordering semantics are
documented in [reference/features](./docs/reference/features.md) — keep it
in step when a feature's model or template changes.

### Generated-SDK test surfaces (ts templates)

Every generated ts SDK ships its own coverage-oriented tests:

- `test/feature.test.ts` + `test/feature/harness.ts` — drive each present
  feature (discovered via `config.makeFeature`) through a mock pipeline;
  `test/netsim.test.ts` covers the `test` feature's `net` simulation.
- `test/feature/Corpus.test.ts` — runs the shared feature corpus against
  THIS client: features built by the generated config, installed by the
  generated constructor, driven by a real entity operation. No mock
  pipeline. `test/utility/Corpus.test.ts` guards the corpus file itself.
- `test/pipeline.test.ts` — direct unit tests of the operation-pipeline
  utilities' error/edge branches (missing spec/response, 4xx, transport
  failure, feature ordering, auth shaping) reached via `stdutil`.
- `npm run test-coverage` (or `make coverage`) enforces a coverage floor on
  the SDK source (test files excluded); thresholds live in the generated
  `package.json`. Note: `--enable-source-maps` (used by `npm test`) maps
  coverage back to `.ts` and reads several points **lower** than true `.js`
  coverage — the gate omits it deliberately.

---

## Releasing

Publishing is **tag-driven and runs in CI**: pushing a `v*` tag fires
`.github/workflows/publish.yml`, which publishes to npm over GitHub OIDC
trusted publishing (no token, provenance attached). That workflow's own header
says it — do NOT run `npm run repo-publish` locally, because it publishes over
a token and bypasses OIDC entirely.

**The publish workflow does not run `embed-version`.** It runs `npm ci`,
`npm run build`, `npm test`, `npm publish` — nothing else. So the version must
already be stamped into the tree *before* you tag, or the release ships a CLI
that reports the previous version and a scaffold manifest that disagrees with
`package.json` (which is exactly what `package update @voxgig/sdkgen` acts on).

The release sequence, in order:

```bash
cd ts
npm version minor --no-git-tag-version   # or patch; see below
npm run embed-version                    # REQUIRED — nothing else runs this
npm run build && npm test
cd .. && git add -A && git commit -m "vX.Y.Z" && git push
git tag vX.Y.Z && git push origin vX.Y.Z # publish.yml takes it from here
```

`embed-version` (`ts/build/version.js`) writes **two** places, both of which
must be committed with the bump: `const VERSION` in `ts/bin/voxgig-sdkgen`,
and `version` in `ts/project/sdkgen-package.json` (the bundled scaffold ships
as one artifact with the npm package, so the two versions must agree).

Choosing the bump: patch for fixes, **minor when the release carries a
`feat:`** — the log between the last `v*` tag and `main` is the input to that
decision, not the size of the diff.

## Git / workflow

- Develop on the branch you were given; do not push to others.
- Commit `ts/dist/` changes alongside the `ts/src/` change that produced them.
- Do not create pull requests unless explicitly asked.

---

## Pointers

- Concepts: [architecture](./docs/explanation/architecture.md) ·
  [pipeline](./docs/explanation/operation-pipeline.md) ·
  [out-of-tree targets](./docs/explanation/out-of-tree-targets.md)
- Reference: [features](./docs/reference/features.md) ·
  [CLI](./docs/reference/cli.md) ·
  [API](./docs/reference/api.md) · [model](./docs/reference/model.md) ·
  [layout](./docs/reference/project-layout.md) ·
  [hooks](./docs/reference/hooks.md)
- Tasks: [docs/how-to/](./docs/how-to/)
