# Vendoring by shared tag: omni, struct, plugin, sekreto

A generated SDK must have **no external dependencies**, in every target
language, for supply-chain safety. That is why the four voxgig libraries
it needs are vendored into the target source rather than depended on.

This note is the plan for the second vendoring pass. The first pass
(`vendoring-upgrade-migration.md`) landed ts, and is the record of what
that cost; read its "Implementation notes" before touching a target.
This one adds three things:

1. a **shared tag** across all four upstream repos, so "what version is
   this SDK vendoring" has one answer instead of four,
2. **tooling** that fetches at that tag and vendors mechanically, instead
   of the hand-copy the first pass did by eye, and
3. **omni as the test runner for every LANGUAGE target**, replacing the
   hand-written runners.

> **Status: the decisions below are settled; the ROLLOUT SHAPE is not.**
> An adversarial verification pass (82 agents, every claim re-read
> against the repos, each alleged defect independently refuted or upheld)
> found 2 blocking and 49 significant errors in the first draft of this
> note. The corrections are folded in below, and the section
> **"What verification changed"** records them, because several are
> facts about this repository that no one had written down. Two of the
> eight decisions did not survive contact; both have since been
> re-decided (see **Decisions taken on the verification findings**), so
> the plan is settled again — but **blocker 2 must be cleared before the
> pilot can generate anything at all**.

## The tag

    sdk-20260904-1610-0

Present on all four remotes:

| repo | commit at tag |
|---|---|
| voxgig/struct   | `2caf7f448f265144c18dd6fab6ba270a7f3bca07` |
| voxgig/omni     | `8c3e1b573a8d35796f7fc45e3226b977023cabf7` |
| voxgig/plugin   | `8d8968afc0a2008fbd795b41ab166307d989f02a` |
| voxgig/sekreto  | `a5a00db6e6d3a1ddbdef7ac62e8a75be53a9e042` |

One tag names one coherent cross-library state. A library that did not
change still carries the tag, so "all four at the same tag" is always a
true statement and never a coincidence to be checked.

**On "drift".** An earlier draft justified the tooling with "go's struct
copy is stamped 0.1.3 while ts's says 0.3.2". That is not drift:
`vendored.json` records the same commit `9440935` for struct/go,
struct/javascript and struct/typescript, and upstream simply versions its
ports independently — at that commit `go/VERSION` IS 0.1.3 and
`typescript/package.json` IS 0.3.2. The real defects the tooling
prevents are these two, both live in the tree today and both green:

- `tm/js/src/utility/StructUtility.js` carries a hand-bumped
  `// VERSION: @voxgig/struct 0.3.2` where upstream at the recorded
  commit says `0.0.10`. The string 0.3.2 appears nowhere in struct's
  history for that file. It is the only content difference from
  upstream.
- All 17 vendored sekreto files record commit `65009cb` in the manifest
  and in their own headers, but the bytes are a zero-diff match to
  `0fd486d`. `65009cb` has no `typescript/src/provider/` directory at
  all.

Both are invisible to the guard, because the guard compares a file to
the hash recorded FOR it — never to upstream. That is the actual case
for a tool that fetches and stamps.

## Decisions

Six settled, two reopened by verification.

**1. The tool lives in the sdkgen repo and vendors into the scaffold.**
`ts/build/vendor.js`, run as `make vendor`. It writes into
`ts/project/.sdk/tm/<lang>/**`, which is committed and shipped on npm.
Consumers keep receiving vendored code the way they do today — through
`target add` — so generation stays offline and sdkgen's own suite tests
exactly what ships.

*Caveat found in verification:* this write root cannot reach
`packages/sdkgen-haskell/.sdk/tm/haskell/`, which carries a 2,299-line
vendored struct copy plus `test/Runner.hs` and `test/StructCorpus.hs` —
exactly the artefacts this pass retires. That copy has already drifted
167 lines from upstream, with `re_find_all` stubbed to `emptyList` and
`re_replace` a no-op returning its input. haskell needs either a second
route root or an explicit written exclusion; silence is what let it rot.

**2. Local checkout preferred, clone as fallback.** For each repo the
tool uses `~/Projects/voxgig/<repo>` when it is present AND its HEAD
resolves to the tag's commit; otherwise it clones `--depth 1 --branch
<tag>` into a cache. It verifies the commit SHA before copying a byte,
in both paths.

**3. The tag is the pin; hashes stay.** The manifest carries one `tag`.
Per-library entries carry the RESOLVED commit, written by the tool.
Every file keeps its `sha256`, so the guard still fails byte-for-byte on
a local edit, offline.

*Corrected:* "version strings become informational, read from the
upstream repo" is unimplementable as written — there is no uniform
upstream source. At the tag, struct's four pilot ports report a version
four different ways: ts has `package.json` 0.3.4 plus an agreeing
in-file stamp; js has `package.json` (`@voxgig/struct-js`) 0.1.4; go has
no version in `go.mod` and only `const Version = "0.1.0"` in source,
contradicted by both the vendored 0.1.3 and the tag `go/v0.1.5`; py has
no in-file stamp, `pyproject` 0.1.1, and only the tag `python/v0.1.0`.
**Decide what `version` MEANS before automating it** — the prior pass
suggests 0.3.2 was recorded for js deliberately, as a BEHAVIOUR
generation label ("upstream python and javascript at that commit both
already answer the 0.3.2 way on every null question"), so reading it
mechanically from upstream would silently rewrite it to 0.1.0 and
destroy that signal. Recommended: `version` is a per-(lib,lang) field in
the route table, hand-set, with the tag as the machine-readable pin.

**4. Native omni API everywhere — no compat shim.** Generated tests call
omni's own runner API in every language, including ts.

*Corrected, and materially more expensive than the first draft priced
it.* The compat shims are not thin API adapters:

- **Six of the eight carry a SEMANTIC correction** for corpus entries
  with no `in`, `args` or `ctx` — `zeroargs` (python), `novalargs` +
  NOVALMARK (go), `undefargs` (ruby), and the lua/php/csharp
  equivalents. omni's native rule is `args = [clone(entry.in)]`, which
  passes one null where these ports must call with NO argument. Dropping
  the shim without porting this changes what the corpus asserts.
- **go's subjects do not type-check against omni.** The corpus passes
  bare typed functions (`voxgigstruct.IsNode` is `func(val any) bool`);
  none is assignable to `omni.Subject = func(args ...any) (any, error)`.
  They compile today only because tm/go's own runner carries a
  reflection adapter, `subjectify`. That adapter has to be re-created in
  the resolver, so go is on the EXPENSIVE side of this decision, not the
  cheap side its upstream compat shim suggests.
- **The provider must be a read-through view of the live SDK, not a
  five-hook object.** omni's runner unconditionally overwrites
  `ctx.client` with the provider on any ctx/args entry, and GENERATED
  SDK code — not just tests — reads through it: `ctx.client.options()`,
  `ctx.client._mode`, and `FeatureAddUtility` which ASSIGNS
  `client._features`. This is omni#56, and it is a property of the
  RUNNER protocol, not of the compat shim, so the native path inherits
  it in every language.

**5. Vendored feature code follows each target's STRUCT precedent.**
*(Reopened by verification, now settled.)*

The first draft put plugin at `tm/<lang>/src/feature/secrets/plugin/`.
That layout **exists only for ts and js.** 22 of 26 target models set
`srcfeature: false`, and `Feature.ts:30` gates the entire per-feature
`src/feature/<name>/` copy on `false !== target.srcfeature`;
`Main_go.ts:63` excludes `/src\//` and `Main_py.ts:54` excludes
`/src\//` and `/pkg\//` from their blanket tree copies. For go and py,
anything under `tm/<lang>/src/feature/secrets/**` is copied by NOTHING
and would silently never reach a generated SDK.

**Decision: vendor to the path each target's `Main_<lang>` already
copies**, following the precedent the vendored struct copies set —
`tm/go/utility/...` beside `tm/go/utility/struct`, and `tm/py/pkg/...`
beside `tm/py/pkg/utility/voxgig_struct`. ts and js keep
`src/feature/secrets/`, which works for them.

**What this costs, accepted deliberately.** `Main_go.ts` and
`Main_py.ts` call neither `srcFeatureExcludes` nor `pluginExcludes` —
only `Main_ts.ts` calls both, `Main_js.ts` the first — so for go and py
there is **no generate-time feature or plugin trim**. Gating becomes an
`add`-time concern only, through `target add`'s `featureExcludes`, which
is feature-level and **plugin-blind**. Three consequences to write into
the rollout rather than discover later:

- A go/py SDK gets **all** of a feature's vendored plugins or none. The
  per-kind leanness argument — dotenv-only chains not carrying SigV4 and
  seven vault clients — **does not hold for these targets** until the
  trim is real.
- Decision 8's inactive-state promise weakens accordingly: "zero plugin
  code when secrets is off" holds for ts and js. For go and py the
  guarantee is only that `add` did not copy the feature in — so the
  inactive proof must assert on the ADD output, not merely on a
  regenerated tree.
- Making the trim real for all targets (teaching `Main_go`/`Main_py` the
  helpers, and making `plugin.path` per-target in `model/sdkgen.aon`)
  stays the right end state. It is **deferred to its own PR**, not
  abandoned.

**6. The targets with no sekreto port are gated off, not blocked on.**

*Corrected on both the list and its size.* The list is **eleven**, not
ten: c, clojure, cpp, dart, elixir, **haskell**, lean, lua, ocaml, scala,
swift. And the gate is doing far more work than the draft implied:
`needs: { sekreto: true }` matches a target's `provides` block, and
**exactly one target declares it — ts.** Of the 22 bundled SDK targets
the gate currently excludes 21: the eleven portless ones, plus **eleven
that have an upstream sekreto port but no container in sdkgen** —
csharp, go, java, js, kotlin, perl, php, py, rb, rust, zig.

**secrets is a ts-only feature today.** The eleven portless targets are
the permanent gap; the eleven ported ones are the backlog.

**7. Pilot: ts + go + py for the reshape, js for the runner swap only.**
*(Reopened by verification, now settled.)*

The first draft's four-language pilot could not prove what it claimed:

- **js is not reshaped.** The sekreto reshape landed in FOUR of twelve
  ports — typescript, go, python, zig. javascript is still the
  pre-reshape monolith: a single 1,303-line `Providers.js` with all
  fourteen kinds in one `makeprovider` switch, no `provider/`, no
  `plugins/`, and zero references to plugin. There is no import to
  rewrite, no plugin to vendor, and **no per-kind trim possible**.
- **Three of the four pilots have no secrets container at all.** js, go
  and py each need FOUR net-new pieces before a `SECRETS` parity row or
  the solardemo ACTIVE proof means anything: `provides: { sekreto: true }`
  in the target model, a vendored sekreto port, a `SecretsFeature` in
  that language, and a `tm/<lang>/test/feature/secrets/` suite. Without
  them the ACTIVE proof passes **vacuously**.
- **The count was wrong.** "The remaining 17 targets" should be 18
  bundled language targets (22 in `parity.test.ts`'s `FULL` set, minus
  four pilots), or 19 counting haskell.

**Decision:** the pilot splits by half.

| half | targets | why |
|---|---|---|
| omni runner swap | ts, js, go, py | js is cheap and valuable here, and closes a real parity hole |
| sekreto + plugin | ts, go, py | the three reshaped ports among the pilot |

js's secrets work is **deferred to upstream's switch conversion** — it
is not attempted against a monolithic `Providers.js`, and no js `SECRETS`
parity row is added in this pass. That keeps the leanness argument
honest instead of shipping a js SDK that carries `node:child_process`,
SigV4 and seven HTTP vault clients unconditionally.

**8. solardemo must be proven in both feature states.** Stands — but
see the blocker in **Proving it on solardemo**, and note that the
inactive-state claim "nothing outside the runner swap changed" is not
checkable against the stated baseline: solardemo is on sdkgen 4.4.1 and
HEAD is 4.8.1+2 — 124 commits, 8 releases, 236 files and +12,727/−3,865
lines under `ts/project/.sdk`. A regen lands the whole 4.5→4.8 delta in
the same diff, including changes with no vendoring content at all (HTTP
Basic Auth, the ENTITYMAP switch to `formatJson`, live-suite parity).
**Regenerate on published 4.8.1 FIRST and commit that**, so the
vendoring diff is readable.

## Decisions taken on the verification findings

Both questions verification opened are now answered, and the answers are
folded into Decisions 5 and 7 above.

**A. Vendored feature code follows the struct precedent** — the path each
`Main_<lang>` already copies — rather than teaching every target the trim
helpers now. Chosen for a working pilot over a correct-but-larger schema
change; the real trim is deferred to its own PR, with the leanness caveat
recorded in Decision 5 rather than left implicit.

**B. The pilot splits by half** — ts/js/go/py for the omni runner swap,
ts/go/py for sekreto and plugin. js's secrets work waits for upstream's
switch conversion instead of being faked against a monolith.

## Toolchains available for verification

Measured on this machine, not inherited from the prior note's tier table:

    zig 0.13.0      lean 4.33.1     ocaml 4.14.1    ghc 9.4.7
    clojure 1.12.5  elixir/OTP 25   dart 3.12.2     swift 6.0.3
    go 1.26.1       rustc 1.97.1    dotnet 8.0.130  kotlinc 2.0.21
    java 21.0.12    php 8.3.6       perl 5.38.2     ruby 3.2.3
    lua 5.4.6       python 3.12.3   node 24.14.1    gcc/g++ 13.3.0

Only `scalac` is absent, and `sbt` is installed, which resolves the Scala
compiler per project. `cmake` is absent; the cpp target builds from a
Makefile.

**This retires a standing caveat in the first pass.** That note's
verification tiers put six targets — clojure, elixir, lean, ocaml, scala,
zig — in a bottom tier backed by *nothing*: "no clojure, elixir, lean,
ocaml, scala or zig compiler existed where the change was made ... Treat
them as plausible, not proven. Anyone with one of those toolchains
should build that target FIRST and add a lane second." Those toolchains
exist here. The `auth: null` credential-leak fix in all six is currently
held only by a structural guard that cannot see a type error, a scoping
mistake or a mis-ordered statement — and it is a fail-OPEN defect when
wrong. Building those six and adding their lanes is available work that
does not depend on any part of this pass, and should not wait for it.

**And no pilot choice here is toolchain-limited.** Any target can be
compiled and run on this machine, so pilot composition is a question of
what each target PROVES, never of what can be built.

## Port coverage at the tag

| library | ports | notes |
|---|---|---|
| struct  | 24 | every bundled target + haskell + boru |
| omni    | 24 | same |
| plugin  | 22 | every bundled language target + haskell |
| sekreto | 12 | csharp, go, java, javascript, kotlin, perl, php, python, ruby, rust, typescript, zig |

Of sekreto's twelve, **four are reshaped** (typescript, go, python, zig)
and eight are still monolithic (javascript, ruby, php, perl, rust, java,
csharp, kotlin). The distinction decides whether Decision 5 applies at
all.

Out of scope by construction: the four consumer targets — `go-cli`,
`go-mcp`, `py-data`, `seneca-provider`. `parity.test.ts` excludes them as
`NON_SDK_TARGETS`, each sets `phase.test.active: false`, and none has a
Test component, a runner template, a vendored struct copy or a secrets
container. There is nothing in them for omni to replace.

## The sekreto reshape (typescript, go, python, zig only)

The vendored copy is the old `Registry.ts` self-registration shape. At
the tag, the reshaped ports split into `src/provider/` (built-ins) +
`plugins/` (the rest) and import `@voxgig/plugin`, taking a
`plugins?: Definition[]` option — a kind the caller did not pass in is
unknown to that Sekreto.

The draft called this "three edits beyond the copy". It is at least
**seven**, and two of them are guard repairs:

1. **The `dotenv` group in `secrets.aon` must be DELETED, not
   re-pathed.** Upstream has no `plugins/dotenv.ts` or `plugins/file.ts`
   — both are BUILT-INS, imported at module scope by
   `src/provider/builtin.ts` and instantiated in `BUILTINS`, which
   `Sekreto.ts` imports unconditionally. Leaving a trimmable dotenv
   group lets `pluginExcludes` delete two modules the vendored core
   imports.
2. **The `<kind>.ts` shorthand does not hold.** `plugins/aws.ts` is ONE
   file exporting TWO kinds (`awssecrets`, `awsparams`), so the wiring
   needs a group-name → Definition-symbol map, not a 1:1 name mapping.
   `plugins/httpjson.ts` is imported by eight plugins and must stay out
   of every group's `path`. `plugins/secretspec.ts` — a `spawnSync`
   child-process kind — has no group at all and would otherwise ship
   unconditionally.
3. **`plugins/index.ts` must NOT be vendored.** It is the full-set
   barrel; a vendored barrel importing every plugin stops the SDK
   compiling once the trim removes one. This is per-language and named
   differently in each port: go `plugins/plugins.go` (eager imports of
   all ten — compile break if trimmed), py
   `voxgig_sekreto/plugins/__init__.py` (a PEP-562 lazy `__getattr__`,
   so it imports nothing eagerly and its breakage is at ATTRIBUTE
   ACCESS, not import — the one case a compile-only check ships).
4. **The plugin import rewrite is four files at two depths**, not one:
   `src/Sekreto.ts`, `src/provider/support.ts`, `src/index.ts`,
   `plugins/index.ts`. So the adapts must be per-file (`'../plugin'` vs
   `'../../plugin'`). `support.ts` imports the RUNTIME class
   `PluginError` and is imported by every provider, so plugin's runtime
   must be reachable from the provider layer, not only from
   `Sekreto.ts`. Type-only importers still need the rewrite — an
   unresolvable specifier is a TS2307 error even for `import type`.
5. **`plugins: [...]` is a GENERATION change, not a template edit.**
   `SecretsFeature.ts` is a static template no component generates, and
   the set cannot arrive through feature options either — `fopts` is
   JSON, and a plugin `Definition` carries a `define` function that
   cannot survive it. The import side effects being replaced are emitted
   by `pluginImports()` in `Config_ts.ts`, whose path filter
   (`/\/provider\/[^/]+\.ts$/`) matches NONE of the new
   `plugins/<kind>.ts` paths — so after edit 1 that emitter silently
   becomes a no-op, and nothing catches it: no test asserts on emitted
   imports, the shipped `Secrets.test.ts` uses only `env`/`memory`, and
   the harness stubs sekreto. It surfaces at runtime as *"<kind> is a
   sekreto plugin, not built in"*. The fix is a `FEATURE_PLUGINS` map
   beside `FEATURE_CLASS` in both Config fragments.
6. **Retarget the full-set-barrel guard in the same commit.**
   `vendored.test.ts` pins `.../sekreto/Providers.ts` — a path that
   cannot exist after the reshape, so both its assertions become
   vacuously true while the real barrel goes unguarded.
7. **Rewrite the ts `SECRETS` parity row.** Of its nine `vendorfiles`,
   `provider/Registry.ts` is deleted upstream, `provider/aws.ts` becomes
   `plugins/aws.ts`, and root `Sigv4.ts` becomes `plugins/sigv4.ts`. Its
   explanatory comment block no longer matches the tree either.

## Retiring the per-language runners

The draft's "every target carries two runners, ~5,300 + ~7,000 lines
across 18 languages" was wrong in shape and in count. The real
inventory:

- **ts** — zero hand-written runners; already on vendored omni, with
  `test/runner.ts` deleted and its absence asserted.
- **~5,300 lines of generic runner in DEDICATED files across 11
  targets**: c, cpp, csharp, dart, go, java, js, kotlin, ocaml, rust,
  swift.
- **~8,300 lines of struct runner in dedicated files across 18
  targets** — and eight of them do NOT use the `struct_runner` name
  (clojure `test/sdk/test/struct_corpus.clj`, c
  `tests/struct_corpus_test.c`, dart, elixir, lean, ocaml, scala; zig
  has both).
- **~13,600 lines in swappable files**, not ~12,000.
- **Eight targets have NO dedicated generic runner at all** — py, rb,
  php, lua, perl, clojure, lean, zig INLINE the runset inside a
  1,000–1,300-line primary-utility template.
- **lean's runner is emitted by a COMPONENT**, `Test_lean.ts`, not by a
  template — so "delete the template" does not reach it.

**The five-fused-targets claim was inverted.** In py, rb, php, lua and
perl the file NAMED `runner.*` holds support ONLY — `load_env_local`,
env override, the skip machinery, live pacing, entity-data conversion —
and contains no corpus-running code whatsoever (`grep runset` finds
nothing). It is ALREADY the retained support module, structurally
identical to ts's `test/utility.ts`; it is merely misnamed. **Step 1 for
those five is a rename at most, and step 4 must NOT delete them.**

The genuinely fused targets — where support shares a file with the
corpus engine omni replaces — are **go, csharp, java, kotlin and cpp**.
go is a pilot target, so deleting `runner_test.go` would take the
support with it. go's coupling is by BARE IDENTIFIER, not import
(`package sdktest` is shared), so its seven call-site symbols must be
found by symbol search, never by an import grep.

`OMNI_RUNNER.superseded` is typed `string` — one path per target — but
most targets have two superseded files, including go and py. It must
become `string[]` before the first non-ts row can be added.

**Corpus v1, corrected.** Upgrading to `{"OMNI": {"version": 1}}` does
not "rename `mark` and the `empty: true` sections". It requires ADDING
`empty: true` to every deliberately-empty group (v1's opt-in for a
legitimately empty set — the six pending primary sections declare
deferral with a `pending` string and no `empty` key, and eight more
empty sets sit at `struct.<fn>` level), and renaming FIVE non-standard
entry fields, not one. Still out of scope for a pilot.

## The tool

`ts/build/vendor.js`, driven by a route table.

**Input — `ts/vendor/routes.json`** (hand-maintained): the `tag`, the
four repos, and per `(library, language)` the upstream source paths, the
destination, per-file `adapt` rewrites, and a hand-set `version`.

**Output — `ts/test/vendored.json`** (generated): the tag, the resolved
commit per library, and per file the `sha256`, upstream path and applied
adapts.

**Modes:** `--check` (no writes; fail on drift — what CI runs),
`--tag=`, `--lib=`, `--lang=`.

**The provenance header is per-language on TWO axes, not one.** The
draft generalised only the offset (php's `<?php` prologue). Comment
SYNTAX is independent and reaches a pilot target: py vendors `#`-comment
sources from all four libraries, while the guard's three header regexes
are anchored to `^\/\/`. The header mechanism needs a per-language
`{ prologue, commentPrefix }`, and the guard's regexes must be built
from it.

## Guards

Repairs first, then extensions.

- **`vendored.test.ts` needs repair, not just extension**: the ts
  `SECRETS` row and the `Providers.ts` barrel pin both break at the tag
  (above), and the header regexes need the per-language comment prefix.
- **`VENDOR_DIRS` cannot be derived from route destinations.** Two of
  the five current destinations are SINGLE FILES inside directories that
  are not vendor-only — `tm/ts/src/utility/StructUtility.ts` and its js
  peer, whose parents hold 33 files each. A naive derivation reports ~64
  ordinary template files as unlisted. The rollout makes it worse:
  dart `lib/utility` (34 entries), scala `utility` (13), lean `src` (8),
  ocaml `utility` (2). Only DIRECTORY-valued destinations may become
  VENDOR_DIRS entries; file-valued ones need per-file listing.
- **py is entirely outside the vendoring guard today** — no
  `struct/python` block in `vendored.json`, no py entry in
  `VENDOR_DIRS`, and `voxgig_struct.py` carries no provenance header.
- **`structnull.test.ts`**: ts is the target where "add a row" literally
  applies (its struct is vendored but it has no row); py already has one
  and does not need another. `documented` at line 341 must be updated in
  the same edit.
- **The omni#54 runner fixes are TypeScript-only at the tag.** None of
  js, go or py carries them — no `jsonstr` cycle guard, and `clone(base)`
  still in `match`. Vendoring a port is a copy PLUS a per-port check for
  these, or the pilot re-introduces bugs ts already fixed.
- **The signature pin** stays as-is, and extends per port.

## Struct resync cost, measured per pilot

Not uniform, and the draft budgeted nothing for it:

- **ts, js, go — header only.** `git diff 9440935 2caf7f4` touches one
  line in `javascript/src/struct.js` and one in
  `typescript/src/StructUtility.ts`, both the `// VERSION:` stamp;
  `go/voxgigstruct.go` is unchanged. Whole-file diffs are 8, 8 and 4
  lines, all header.
- **py is a BREAKING resync on three axes** — ~250 lines. Upstream
  removes `jo`/`ja` (`jm`/`jt` become the real definitions), and the
  behaviour that actually moves is the LIST form of the null rule:
  vendored `getprop([None], 0, 'ALT')` returns `None`, upstream returns
  `'ALT'`. **Neither `structnull.test.ts` nor the shared corpus asks
  that question** — structnull asks only the map form, where vendored
  and upstream agree. A py row must add the list form first, or the
  resync lands unpinned.

## Proving it on solardemo

**BLOCKER — the pilot cannot generate at all today.** Repointing `.sdk`
at the local sdkgen is not sufficient and not even self-correcting:

- solardemo's entity models are pre-ADR-003 — `planet.aon` and
  `moon.aon` describe paths as `parts`, with zero `segments`.
- Local sdkgen throws `SdkGenError` on exactly that shape in
  `helpers/pointPath.ts`, reached from `utility.ts`, `opShape.ts` and
  every `TestDirect_<lang>` component. All four pilot targets fail.
- The error's own remedy — regenerate so apidef rewrites the entity
  models — requires apidef ≥ 8.2.0. solardemo pins **8.0.3**, whose dist
  has no segment vector at all, so the model can never gain `segments`.
  It is a deadlock, not a one-off.
- Verified empirically: `npm install --package-lock-only` with sdkgen
  set to `file:.../sdkgen/ts` links sdkgen and **leaves apidef at
  8.0.3, with no ERESOLVE**, even though local sdkgen's peer floor is
  `>=8.2.2`.

So step zero is: **upgrade solardemo's apidef to ≥8.2.2, regenerate on
published sdkgen 4.8.1, and commit that** — which also gives the
readable baseline Decision 8 needs. Only then repoint at the local
checkout.

One more: `generate` regenerates ALL 26 targets with no per-target
filter, and solardemo's per-language components are project-owned and
stale — it has zero files using `targetFeatures`, while the scaffold
gates 20 `Config_<lang>`, 12 `Main_<lang>` and three `Package_*` through
it. With secrets ACTIVE, a stale ungated component emits a feature its
target has no source for. **The pilot needs `add-target` for every
target, not just the four.**

## What verification changed

Recorded because most of these are facts about this repository that
nobody had written down, and the next pass will need them:

| finding | where it bites |
|---|---|
| 22 of 26 targets set `srcfeature: false`; `Main_go`/`Main_py` call no trim helper at all | Decision 5 is unimplementable for half the pilot |
| solardemo's apidef 8.0.3 vs sdkgen's `>=8.2.2` floor is a `parts`/`segments` deadlock | the pilot cannot generate before it is fixed |
| the sekreto reshape landed in 4 of 12 ports; js is monolithic | Decision 7's pilot cannot prove the plugin path |
| exactly one target declares `provides: { sekreto: true }` | secrets is ts-only; the ACTIVE proof would pass vacuously on js/go/py |
| py/rb/php/lua/perl `runner.*` is support-ONLY; the corpus runner is inlined in the primary-utility template | step 1 was a no-op there and step 4 would have deleted the wrong files |
| go, csharp, java, kotlin, cpp are the genuinely fused targets | the split work was aimed at the wrong five |
| six of eight compat shims carry a zero-argument semantic correction | dropping them changes what the corpus asserts |
| go's corpus subjects need `subjectify` reflection to satisfy `omni.Subject` | go is expensive under Decision 4, not cheap |
| `plugins/index.ts` (and its per-port equivalents) must not be vendored; py's is lazy so a compile check misses it | a trimmed barrel ships broken |
| `pluginImports()`'s `/provider/` filter silently no-ops after the path rewrite | runtime-only failure, nothing catches it |
| `Providers.ts` guard pin becomes vacuous at the tag | the barrel protection silently stops protecting |
| haskell is a 23rd target outside the tool's write root, already drifted 167 lines with two regex functions stubbed out | a live correctness bug in shipped code |
| js `StructUtility.js` version stamp is hand-bumped; 17 sekreto files record the wrong commit | the guard cannot see either |
| corpus v1 needs `empty: true` ADDED and five fields renamed | the draft had it backwards |
