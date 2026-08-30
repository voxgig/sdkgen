# Migration guide: vendoring omni, struct 0.3.2, and sekreto

A phased plan to upgrade sdkgen so generated SDKs vendor the current
[voxgig/omni](https://github.com/voxgig/omni) (shared test specs),
[voxgig/struct](https://github.com/voxgig/struct) (data utilities) and
[voxgig/sekreto](https://github.com/voxgig/sekreto) (secret access) —
keeping the "SDKs have no dependencies" rule — including the upstream
bug-fix backports the prototype surfaced.

**Source of truth.** Everything here was proven against solardemo. The
sekreto half now runs on its main, project-owned, via `options.extend`
([`ts/src/ext/secrets/`](https://github.com/voxgig-sdk/voxgig-solardemo-sdk/tree/main/ts/src/ext/secrets)
— see **Staging** for why that route exists and what it is waiting on).
The struct and omni halves, and the full hand-refactor they came from,
are on the prototype branch
[`claude/vendor-omni-struct-sekreto-prototype`](https://github.com/voxgig-sdk/voxgig-solardemo-sdk/tree/claude/vendor-omni-struct-sekreto-prototype)
([PR #29](https://github.com/voxgig-sdk/voxgig-solardemo-sdk/pull/29),
deliberately unmergeable), whose
[`design/REPORT-vendoring-prototype.md`](https://github.com/voxgig-sdk/voxgig-solardemo-sdk/blob/claude/vendor-omni-struct-sekreto-prototype/design/REPORT-vendoring-prototype.md)
carries the full findings. The prototype refactored the generated `ts/`
target by hand; running `generate` reverted every edit, which is the
point of this guide: the same content must land here, as templates and
components, so regeneration produces it.

**Version pins for the migration** (record these in the vendored
headers; move them only as a deliberate resync):

| Library | Version | Commit | Vendored from |
|---|---|---|---|
| omni | 0.1.2 | `bc9535d` | `typescript/src/{Util,Runner,index}.ts`, `typescript/compat/struct.ts` |
| struct | 0.3.2 | `9440935` | `typescript/src/StructUtility.ts` (byte-identical to npm 0.3.2) |
| sekreto | 0.1.2 | `a8c293b` | `typescript/src/{Sekreto,Providers,Sigv4,index}.ts` |

All three are MIT; vendoring needs only notice retention, which the
per-file provenance header supplies.

## Where the changes land in this repository

The prototype's manual edits map onto sdkgen mechanically. The
two-layer rule decides every placement: same for every API → template
(`ts/project/.sdk/tm/<lang>/`); depends on the API → component
(`ts/src/cmp/`, per-language `ts/project/.sdk/src/cmp/<lang>/`).

| Prototype content (solardemo `ts/`) | sdkgen home |
|---|---|
| `src/utility/StructUtility.ts` (0.3.2) | `tm/ts/src/utility/StructUtility.ts`, and each language's vendored struct (all 22 targets carry one, e.g. `tm/py/pkg/utility/voxgig_struct/`, `tm/go/utility/struct/`) |
| `test/vendor/omni/` + `test/omni.ts` resolver | new `tm/ts/test/vendor/omni/` + `tm/ts/test/omni.ts`, REPLACING `tm/ts/test/runner.ts`; same per language for the other runner templates (`tm/py/test/runner.py`, `tm/lua/test/runner.lua`, `tm/go/test/runner_test.go`, ...), vendoring omni's own port for that language. NOT wholesale: several runners fuse SDK support helpers into the same file — see the Phase 2 carve-out |
| consumer import changes in `test/utility/{PrimaryUtility,StructUtility}.test.ts` | the same files under `tm/ts/test/utility/` |
| `src/utility/sekreto/` | new `tm/ts/src/feature/secrets/sekreto/` — INSIDE the feature container, not under `src/utility/`, so the feature trim removes the vendored library when `secrets` is inactive; other languages from sekreto's ports (`go/`, `python/`, `java/`, `ruby/`, `php/`, `rust/`, ...) |
| `src/feature/secrets/SecretsFeature.ts` | new `tm/ts/src/feature/secrets/` (beside the 19 existing feature template dirs) |
| `Config.ts` registry + metadata edits | no bespoke fragment edits: `Config_ts.ts` (and its per-language peers) already emit feature imports, FEATURE_CLASS entries, and `config.feature` metadata GENERICALLY from the model's feature collection (`#ImportFeatures` / `#FeatureClasses` via `configDefinition`) — registering the feature in the catalogue (Phase 3) is sufficient |
| `SolardemoSDK.ts` (`_secrets` field, `secrets()` accessor, `prepare()` await) | the Main template/fragment for each language, emitted CONDITIONALLY on the feature being active (an unconditional template edit would change every generated SDK and break the inactive-output gate) |
| `test/secrets.test.ts` | `tm/ts/test/feature/secrets/` — feature-source discovery (`findFeatureSources`) recognizes feature-owned entries only inside a directory whose basename is `feature`, so a top-level `test/secrets.test.ts` would be copied and compiled even with the feature inactive |
| `test/omni.test.ts` | `tm/ts/test/` (feature-independent: the runner ships with every target) |
| dotenv removal (`loadEnvLocal` via sekreto `parsedotenv`) | `tm/ts/test/utility.ts` + the entity-test component that emits the `.env.local` preamble + `tm/ts/package.json` devDeps |

## Phase 0 — upstream backports (before any template work)

The prototype carries three patches to vendored omni, each marked
`PATCH (solardemo prototype, pending upstream fix)`. They are genuine
omni bugs: omni's own consumers feed it pure-JSON specs, while sdkgen
corpora drive live cyclic `Context` objects through entries.

1. **`Runner.match()` clones the match base.** The clone is read-only
   waste and blows the stack on any cyclic base (a live ctx reaches its
   client, whose root context reaches the client again). Fix: read the
   base directly.
2. **`Util.jsonstr()` has no cycle guard**, so building a *failure
   message* for a ctx entry recurses forever (the entry carries the
   live ctx as bookkeeping). Fix: emit `'[Circular]'`, as the original
   struct-repo runner did.
3. **`errify()`/`errmessage()` collapse non-Error throwables to
   `String(err)`** = `'[object Object]'`. The shared corpus throws
   error-shaped plain maps (generated `makeError` rethrows the
   fixture's `ctrl.err` verbatim); the original runner matched
   `err.message` regardless of class. Fix: read `.message` / spread the
   map when present.

Also file upstream (not blocking, but do it now):

- omni compat: `structprovider` forwards `utility()`/`tester()` but not
  `options()`, `_features`, `_rootctx`, `_mode`; propose the
  prototype's prototype-delegation shape (`Object.create(sdk)` +
  hooks). And its caller-directory spec-path heuristic mis-resolves for
  the compiled `dist-test/` layout — upstream already documents that
  ports must resolve the path themselves; sdkgen's resolver template
  does.
- omni spec entries pinning all three bugs (cyclic ctx entry;
  map-shaped error) so the fixes cannot regress across omni's 24 ports.
- struct: reconcile the **go port drift** — upstream `struct/go` gained
  the NOVAL sentinel while solardemo's vendored copy independently
  gained `net/url` (~672 diff lines, both directions). Upstream is
  canonical; port the `net/url` need upstream if still real, then
  every vendored go copy resyncs from upstream only.
- sekreto: raise browser-safety — `Providers.ts` top-level imports of
  `node:child_process`/`fs`/`path` and `Sigv4.ts`'s `node:crypto` enter
  the SDK module graph at import time. Proposed upstream shape:
  per-kind provider modules lazy-loaded by `makeprovider`, keeping
  `Sekreto.ts` + env/memory importable anywhere. Do NOT fork this in
  templates; vendor verbatim and track the upstream issue.

**Backport policy until upstream releases:** vendored template copies
carry the three omni patches with the `PATCH` markers intact, each
naming the upstream issue. A later resync that includes the upstream
fixes deletes the markers. Never let an unmarked local deviation into a
vendored file — `doctor` will enforce this from Phase 4.

**Done when:** upstream issues/PRs exist for all of the above, and the
three omni patches are captured as marked blocks ready to paste into
the vendored copies.

## Phase 1 — struct 0.3.2 refresh

1. Replace `tm/ts/src/utility/StructUtility.ts` with upstream 0.3.2
   plus the provenance header (keep upstream's own
   `// VERSION: @voxgig/struct 0.3.2` line). The prototype proved zero
   call-site changes are needed in ts: 0.3.2's exports are a strict
   superset of 0.0.10's, and the full shared corpus passes on both
   versions (verified empirically, 1179 entries).
2. Do the same per language from each struct port, ts/js first (the
   reference implementations), then down the parity tiers. Stamp every
   copy — the current go copy has NO version stamp; fix that as part of
   the refresh.
3. **Suite-green is not semantics-free.** Corpus nulls travel as
   `'__NULL__'` strings, so these 0.3.2 changes are invisible to the
   corpus but visible to live API traffic:
   - getprop/getelem/getpath treat stored JSON null as "no value" (the
     `alt` default fires on null; `Result.body`, GraphQL `data: null`,
     null entity fields read as undefined).
   - inject/transform DELETE an output key whose backtick reference
     resolves to null (0.0.10 emitted `key: null`) — reaches every
     `transform.req`/`transform.res` point spec.
   - validate's list-form `` ['`$CHILD`', tm] `` now validates the
     first element (map-form, which `makeOptions` uses, is unchanged).
   - `escre` throws on non-string input; `walk`'s callback path array
     is pooled (callbacks must clone to retain it).
   Add shared-corpus entries that PIN the null semantics, and record in
   the model docs the decision on null-vs-undefined at the `Result`
   boundary. Pull upstream 0.3.2's new corpus sections (condense,
   regex, sentinels, select.nullkey) into the corpus that create-sdkgen
   owns (`project/standard/.sdk/test/`).
4. Note for consumers in the changelog: struct is a PEER dependency of
   sdkgen itself; the `.sdk` build-tooling range and the vendored
   version should agree at major.minor to avoid two-copy sentinel
   mismatches (`SKIP`/`DELETE` identity).

**Done when:** `make build test` green; `generate.test.ts` green for
all targets; a solardemo `add-target ts && generate` reproduces the
prototype's `StructUtility.ts` byte-for-byte (minus the prototype's
hand-added header if wording differs); new null-semantics corpus
entries pass on ts and js.

## Phase 2 — omni replaces the per-target runners

1. Vendor omni's ts files into `tm/ts/test/vendor/omni/`
   (`Util.ts`, `Runner.ts`, `index.ts`, `compat.ts` with its import
   path adapted `'../src'` → `'./index'`), carrying the Phase 0
   patches. Add `tm/ts/test/omni.ts` — the resolver from the
   prototype: absolutizes the spec path against its own compiled
   location, and wraps the SDK as a provider by prototype delegation.
   Delete `tm/ts/test/runner.ts`.
2. Update the two consumer templates
   (`tm/ts/test/utility/{PrimaryUtility,StructUtility}.test.ts`):
   import from `'../omni'`; PrimaryUtility additionally unwraps
   `run.client.sdk` (its featureHook test ASSIGNS `client._features`,
   which delegation cannot forward — under the old runner `run.client`
   was the SDK itself).
3. Add `tm/ts/test/omni.test.ts` — the runner-must-fail smoke test
   (wrong result and missing expected error both reject with
   `OmniError`), so a broken vendored runner cannot produce a
   vacuously green generated suite.
4. Repeat per language using omni's own ports — but NOT as a wholesale
   file replacement. In several targets (`py`, `rb`, `php`, `lua`,
   `perl`) the runner template FUSES sdkgen-specific support helpers
   into the same file: `load_env_local`, `env_override`, the
   `sdk-test-control.json` skip machinery, live pacing, entity-data
   conversion — and the generated entity/direct tests (emitted by the
   TestEntity components) call them on the runner. The ts target
   already keeps these in a separate `test/utility.ts`; do the same
   split everywhere FIRST: move the support helpers into a retained
   per-language support module, update the TestEntity components'
   emitted call sites, and only then swap the corpus-runner half for
   the vendored omni port. Where a language's omni port lacks a compat
   shim, the resolver template supplies the same adapter shape.
5. Corpus versioning, deliberately LAST in this phase: the shared
   corpus has no `OMNI` block, so omni runs it lenient (v0) — exactly
   today's behavior, typo'd assertion fields and all. Upgrading to
   `{"OMNI": {"version": 1}}` requires renaming/dropping the
   non-standard `mark` field (23 entries) and `empty: true` on the six
   pending sections, and must move ALL targets at once (the corpus is
   shared). Do it only after every language runs a vendored omni.

**Done when:** every target's generated suite runs on vendored omni;
the smoke test exists per target; the corpus carries the v1 block; a
solardemo regen reproduces the prototype's `test/` tree.

## Phase 3 — sekreto and the secrets feature

**Prerequisite: an implemented applicability gate.** Feature tags
(`docs/design/feature-tags.md`) are a PROPOSAL today — nothing gates a
feature by target, and `ts/src/action/feature.ts` fans out to every
target and merely WARNS on `feature-source-missing`. This is not a
theoretical gap: attempting it aborts generation outright and would
dangle Config imports in the targets that did generate — see
**Staging** below for the exact failure and why resolving the
`Feature.ts` TODO is not sufficient on its own. Implement the gate
first, as its own design and PR; do not rely on the warning.

1. Vendor sekreto verbatim into `tm/ts/src/feature/secrets/sekreto/`
   (Sekreto, Providers, Sigv4, trimmed barrel) — INSIDE the feature
   container, so `target add`'s feature trim removes the vendored
   library when the model does not enable `secrets`, keeping the
   inactive-output gate below honest.
2. Add the `secrets` feature template `tm/ts/src/feature/secrets/`,
   copied from the prototype's `SecretsFeature.ts`. The design that
   survived contact, and must survive porting:
   - The `apikey` option keeps its exact old meaning and ALWAYS wins
     when set: `init` places a non-empty option first in the chain as
     a `memory` provider named `options`, so explicit-beats-lookup is
     sekreto's own first-hit rule, not special-case logic.
     `prepareAuth` is untouched; behavior with the feature inactive is
     bit-identical.
   - **Empty vs omitted, decided explicitly:** `makeOptions`
     normalizes an omitted `apikey` to `''` before features
     initialize, so by init time the two are indistinguishable, and
     the prototype treats both as "unset — defer to the chain". Keep
     that as the documented contract: with `secrets` active, an empty
     `apikey` (omitted or explicit) defers to the provider chain, and
     DISABLING auth outright remains what it already is today —
     `auth: null`, which `prepareAuth` honors before ever reading the
     apikey. If a product later needs "explicit empty suppresses the
     chain", the constructor must capture pre-merge suppliedness;
     until then, tests must pin all three cases (omitted + chain hit,
     explicit `''` + chain hit, `auth: null` + chain configured).
   - `init` is synchronous by feature contract: it builds the chain,
     never looks anything up. Resolution happens once in the awaited
     `PreSpec` hook and writes into the live options where the sync
     `prepareAuth` already looks; concurrent ops share the in-flight
     promise.
   - A provider ERROR fails the op; only a MISS falls through
     (sekreto's invariant: a broken vault never yields an
     unauthenticated request). On the ENTITY path that error flows
     through the normal pipeline error handling. On the DIRECT path it
     must NOT throw: `_rawRequest` awaits `prepare()` outside its
     `try`, and `direct()`/`graphql()` are documented to return a
     value or an `Error`, never reject — the prototype got this wrong
     (its `prepare()` rejects on a provider error). The migration
     version of `prepare()` catches resolver failures and RETURNS the
     `Error`, matching its existing error-return convention; each
     language port follows its target's direct-call convention.
   - The secret name defaults to `apikey`, configurable via
     `feature.secrets.name`.
3. Registration — in the bundled feature CATALOGUE, not the base
   schema: add `ts/project/.sdk/model/feature/secrets.aon`, include it
   from `feature-index.aon`, and advertise it in
   `ts/project/sdkgen-package.json`'s `feature` list (the manifest is
   pinned to the directory listings by a guard test, so it fails
   loudly if forgotten). `model/sdkgen.aon` changes only if the
   feature needs new schema keys. With the catalogue entry in place,
   the generic Config emission (`#ImportFeatures` /
   `#FeatureClasses` / `configDefinition`) produces the registry and
   metadata with NO per-feature fragment edits — the three places the
   prototype hand-edited in `Config.ts` are exactly what the generic
   slots emit for an active feature.
4. Main template/fragment: the `_secrets` field, the `secrets()`
   accessor (returning the LIVE instance — sekreto holds provider
   state, so never a clone), the `sekreto` re-export (SDK users need
   the provider factories), and the `prepare()` resolver call — all
   emitted CONDITIONALLY on the feature being active, since an
   unconditional template edit lands in every generated SDK and
   breaks the inactive-output gate.
5. Tests: port the prototype's `secrets.test.ts` (option-wins,
   env/custom provider, miss-vs-error, PreSpec resolution through a
   real entity op, plus the empty/omitted/`auth: null` triple and the
   direct-path error-return behavior from step 2) into
   `tm/ts/test/feature/secrets/` — the `feature` container is what
   makes it trimmable. Replace the entity-test `dotenv` preamble with
   `loadEnvLocal` over the vendored `parsedotenv` (same semantics:
   missing file fine, existing env vars win) and drop `dotenv` from
   `tm/ts/package.json` — the last non-tooling devDependency. Watch
   the emit order: the loader call must sit AFTER the import block
   (the prototype hit the emitted-require-before-import TDZ failure).
   Note `loadEnvLocal` lives with the retained support helpers
   (Phase 2's split), not in the feature container — the entity tests
   need it whether or not `secrets` is active.
6. Follow-on candidates, kept out of the first pass: wire `clean()`
   (currently an identity function with its redaction body commented
   out) to `sekreto.redact()`, which already tracks every resolved
   value even with caching off; and decide ONCE, in sdkgen, whether
   `prepare()`/`direct()`/`graphql()` should run a reduced hook
   pipeline instead of accreting per-feature awaits.
7. Language rollout follows sekreto's ports (go, py, java, rb, php,
   rust first); targets without a port are excluded by the
   applicability gate above.

**Done when:** a model with `feature.secrets` active generates an SDK
whose suite includes the secrets tests and passes; one with it
inactive generates byte-identically to pre-migration output (modulo
Phases 1–2) — which is achievable precisely because the vendored
library, the feature class, the tests, and the Main additions are all
feature-owned or conditionally emitted; solardemo regen reproduces the
prototype's `src/` tree (minus the prototype's `prepare()` rejection
bug, corrected per step 2).

## Phase 4 — conventions and guards

1. **Provenance headers everywhere**: source repo + commit + upstream
   path + license + "do not edit: resync from upstream" on every
   vendored file, as the prototype standardized. Backfill the copies
   that predate the convention (the go struct copy has no stamp at
   all).
2. **Stamps move together**: the runner, StructUtility, and the struct
   corpus test carried matching `0.0.10` stamps that all had to change
   in step. Add a per-target vendored-versions manifest (or extend
   `sdkgen-package.json`) naming each vendored library's version,
   commit, AND a per-file content hash. The hash is what makes
   template-side drift detectable: `doctor` compares a consumer's
   copies against sdkgen's templates, so an edit made INSIDE the
   templates is invisible to it — after the next `add`, source and
   project agree again. Split the enforcement accordingly: a test in
   sdkgen's own suite verifies each vendored template file against the
   manifest hashes (an intentional resync updates both together, and
   the marked `PATCH` blocks are part of the hashed content); `doctor`
   keeps its existing job of consumer-side comparison, plus verifying
   the stamps agree with the manifest.
3. Parity: extend `ts/test/parity.test.ts` coverage so a target
   claiming the secrets feature or the omni runner carries the
   corresponding template files, per the existing tier rules.

## Staging: what can be proven before a phase lands

Two constraints were established by trying them, and together they
decide how this migration is staged.

**There is no prerelease shortcut.** The tempting way to prove a phase
against a real consumer without touching main is to publish a
prerelease from a prototype branch and pin the consumer's `.sdk` to it.
`publish.yml` refuses: *"dispatch ref is `<branch>`; releases must come
from main"*. The only other entry, a hand-pushed `v*` tag, has no such
guard — but taking it would circumvent a control installed deliberately
against exactly that, for an action that cannot be undone. So a phase
reaches a consumer only by landing on main and releasing normally, and
the pre-merge proof is sdkgen's own suite plus a local
`add-target`/`generate` against a checkout.

**A feature cannot be generated for a subset of targets.** This is the
applicability gate, and it is a hard prerequisite for Phase 3 rather
than a nicety. Building the secrets feature as a project-owned sdkgen
package (manifest + `model/feature/secrets.aon` +
`tm/ts/src/feature/secrets/`, modelled on elementdemo's `elementcard`)
passes `package check` cleanly and wires in correctly with `package
add` + `feature add` — and then generation aborts:

```
Copy: from: check: string: tm/js/src/feature/secrets
```

`feature add` warns `feature-source-missing` for every target with no
source and only warns; `Copy` then stat-fails on the first of them and
exits 1, so no target generates. Resolving the `Feature.ts` TODO
(*"Copy should just warn if from not found"*) is necessary but NOT
sufficient: the Config components emit feature imports and registry
entries generically from the model's ACTIVE features, so each target
that did generate would carry a dangling import for a feature it has no
source for. The gate therefore has to filter the per-target model view —
in ONE place, so `Feature`, the Config components and the docs
components all see the same answer — which is a design of its own
(`docs/design/feature-tags.md`) and its own PR.

**Meanwhile, `options.extend` is the honest staging route.** It is the
documented seam for handing a generated client a feature INSTANCE at
construction, it needs no sdkgen change, and it puts a feature's design
under test in a real consumer before the templates exist. solardemo runs
the secrets feature this way today
([`ts/src/ext/secrets/`](https://github.com/voxgig-sdk/voxgig-solardemo-sdk/tree/main/ts/src/ext/secrets)):
project-owned, untouched by `generate`, drift gate green. Phase 3 moves
it into a feature template and deletes it there. Any future feature can
be staged the same way.

## Rollout and acceptance

Order: Phase 0 → 1 → 2 → 3, each as its own reviewed PR (Phase 4 rides
along with whichever phase first needs the guard), with the
applicability gate landing before Phase 3. Between phases, run the
standard validation sequence from `CLAUDE.md`:

```
cd sdkgen && make build test          # includes generate.test.ts, all targets
cd solardemo-sdk/.sdk
npm run add-target <lang>
npm run generate
cd ../<lang> && <lang-test-command>
```

**The acceptance test for the whole migration is the prototype
branch itself:** after Phase 3, regenerating solardemo from main-line
sdkgen must reproduce the prototype's `ts/` content — modulo the
deliberate corrections this guide makes to it (the `prepare()`
error-return fix and the feature-container placements) — at which
point the prototype's red `Generate and check for drift` gate would be
green on the corrected equivalent, and the branch can be closed as
absorbed. For the secrets half specifically, the acceptance test is
sharper and already in place: solardemo's `ts/src/ext/secrets/` and its
14 tests must keep passing when the feature becomes generated, with the
directory deleted and nothing else in the suite changing. Elementdemo is the
second gate: its `ext/` package's custom `bash` target and
`elementcard` feature must regenerate unchanged, proving the migration
does not break external sdkgen packages.

Version note: Phases 1–2 change generated output for every consumer
(vendored library refresh, runner replacement) — a minor bump at
least; Phase 3 adds a feature — minor; any behavior change surfaced by
the struct null semantics that leaks into generated SDK behavior
should be called out in the changelog explicitly, since it reaches
consumers through regeneration rather than an npm install.

## Risk register

- **Struct null semantics** (Phase 1) is the only change that can
  alter LIVE SDK behavior without any test going red today. Mitigation
  is the new corpus entries, written BEFORE the per-language refresh
  so every port proves the same semantics.
- **Corpus v1 upgrade** (Phase 2.5) breaks any target still on an old
  runner — hence "all targets at once, last".
- **Per-language omni ports** vary in maturity (go's is minimal);
  budget for upstreaming small fixes rather than diverging in
  templates.
- **create-sdkgen** owns the standard project's test corpus; corpus
  changes (null entries, v1 block, upstream 0.3.2 sections) need a
  paired PR there.
- **Feature gating is a prerequisite, not a given**: feature tags are
  a proposal, and today `feature-source-missing` only warns. Phase 3
  does not start until an applicability gate is implemented.
- **The runner split** (Phase 2.4) touches TestEntity components and
  every fused-runner language at once; the retained-support-module
  refactor should land and go green BEFORE any omni swap, so runner
  replacement diffs stay reviewable.
- **sekreto in browsers** stays broken until the upstream split lands;
  until then the secrets feature is Node-only, which the feature tag
  should say.

---

## Implementation notes: what the ts pass actually found

Phases 1–4 are landed for **ts only**, with the applicability gate as its
own change ahead of Phase 3. Validated by regenerating solardemo from a
local checkout and running its suite: **209 tests, 208 pass, 0 fail** with
the feature active; **197/196/0** with it inactive; sdkgen's own suite
**1039/1037/0** (from 1025/1023). The full 1179-entry struct corpus runs
through vendored omni as 83 sections, all green.

Nine things the plan did not predict. Most were invisible to sdkgen's own
suite and only appeared against a real project.

**1. The struct null risk is real, and it bit.** The register called this
the one change that can alter live behaviour with nothing going red.
Isolated, on the exact shape `makeOptions` uses:

| | `validate({auth: null}, {auth: {prefix: ''}})` | `getprop({a: null}, 'a', 'ALT')` |
|---|---|---|
| 0.0.10 | throws `Expected field auth to be map` | `null` |
| 0.3.2 | returns `{auth: {prefix: ''}}` | `'ALT'` |

So `auth: null` — the documented way to disable auth — silently becomes
the DEFAULT auth config instead of erroring. The shared corpus is blind to
it by construction (nulls travel as `'__NULL__'` strings); what caught it
was a hand-written project test. The generated secrets suite now pins the
new semantics explicitly.

**2. Applicability tags must be MAPS, not lists.** `needs: *[] | [&: string]`
under `main: kit: feature: &:` HANGS aontu outright on a real model — no
output, no error. The same shape under `target: &:` is fine, which is what
made it bisectable, and `feature.fullset` already uses it. sdkgen's own
fixtures are too small to reach it. Both keys are maps keyed by tag, the
shape the schema already recommends for `contributor`.

**3. A feature catalogue entry must not set `active`.** In aontu a concrete
value does not yield to another concrete value — it conflicts. A shipped
`active: false` makes a project's `active: true` fail to unify, naming two
files and offering no way to reconcile them. Leave the key unset and let
the schema default it. This is the defect `model/target/ts.aon` already
warns about for publication keys.

**4. Activation belongs in the project overlay.** `target add` re-runs
`feature add` for every selected feature, and add is overwrite — so an
activation written into `model/feature/<name>.aon` silently reverts on the
next target resync. It goes in `model/project.aon`.

**5. Deleting a template does not delete generated output.** jostraca
writes; it never removes. `test/runner.ts` survived Phase 2 in the consumer
and had to be deleted by hand, and DEACTIVATING a feature leaves its
generated source and tests behind — where the orphaned tests then fail (11
of them), because the SDK no longer has the feature. "Generates
byte-identically when inactive" holds for a project that never switched it
on; deselecting needs an explicit delete of `src/feature/<name>/` and
`test/feature/<name>/`. Worth a `doctor` check.

**6. The gate makes every consumer resync every target.** `Config_<lang>`
and `Main_<lang>` are PROJECT-OWNED copies under `.sdk/src/cmp/`. Until a
consumer re-runs `target add` for each language, its stale ungated
components still emit the feature — which is a hard crash, not a warning
(`formatJson` on an undefined config). This is a migration cost the guide
should state: one `target add` per target, not just per changed target.

**7. `loadEnvLocal` cannot use sekreto's `parsedotenv`.** The guide asks for
both "sekreto lives inside the feature container so the trim removes it"
and "the entity tests need the loader whether or not secrets is active".
Those are incompatible: the loader would import a module that is trimmed
away. Resolved with a small independent parser in the test support module;
the coupling is the thing worth avoiding, not the duplication.

**8. `secrets()` returns the Sekreto instance, not the feature.** Callers
use `getfrom`/`get`/`redact`, which are sekreto's. The feature gained a
public `sekreto()` accessor rather than the prototype's reach into a
private field.

**9. The docs components and `collectDeps` needed gating too.** The guide
names Feature and the Config components; AgentGuide was also writing
`AGENTS.md`/`CLAUDE.md` for `secrets` into the js target — documenting a
feature that target has no implementation for — and `collectDeps` would
flow a non-applicable feature's dependency into a target's manifest.

### Still outstanding

- **Phase 0 upstream filings — DONE.** omni's three runner fixes landed
  in omni#54 and sekreto's `checkaddr` and lazy-builtin fixes in
  sekreto#13 and #14, so those are no longer local patches. What remained
  is now filed: **omni#56** (structprovider hides the client members
  corpus subjects reach through `ctx.client`), **omni#57** (port the three
  runner fixes to the other 22 ports), **sekreto#16** (port `checkaddr`
  and the lazy loading to the other 9 ports). struct's go-port drift is
  RESOLVED — see below.
- **Corpus entries pinning the null semantics**, which belong in the
  corpus create-sdkgen owns, plus upstream 0.3.2's new sections. Now
  demonstrated to be a PER-TARGET defect, not a ts one — see below.
- ~~**sekreto's `checkaddr` rejects IPv6 loopback.**~~ Fixed upstream in
  sekreto#13 and resynced. Porting it to sekreto's other nine ports is
  sekreto#16.
- ~~**`jsonstr`'s cycle guard has a DAG false positive.**~~ Fixed upstream
  in omni#54 (the guard now tracks ancestors and deletes on the way out,
  so a DAG renders in full). Porting it is omni#57.
- The other 21 language targets, which the rollout lists in
  `parity.test.ts` (`OMNI_RUNNER`, `SECRETS`) and `featuremodel.test.ts`
  (`GATED`) now gate explicitly rather than silently.

### The go resync: what the plan got wrong, and the trap it hid

Phase 0 listed struct's go port as "about 672 diff lines, in both
directions", and asked whether the vendored copy's independent `net/url`
addition was "still real" and should be ported upstream. It was not real.
Upstream's `EscUrl` matches the TypeScript reference (`encodeURIComponent`)
on every corpus case; the vendored `url.QueryEscape` diverges on 5 of 10,
including encoding a space as `+` rather than `%20`. `make_url.go` used it
for PATH parameters, and `struct_utility_test.go` carried a
`ReplaceAll("+", "%20")` around the subject that made the shared corpus
pass while real paths and query strings still went out wrong. There was
nothing to port: the vendored copy was simply a bad local edit, and the
workaround existed to hide it. Resync from upstream, delete the
workaround, pass the subject bare.

The resync itself is small. Diffing every exported signature between the
old vendored copy and upstream 0.1.3 gives the complete breaking surface:

| change | caught by |
|---|---|
| `Transform` returns `(any, error)` | the compiler |
| `Jo`/`Ja` renamed to `Jm`/`Jt` | the compiler |
| `Re*` helpers added | nothing to do |
| **`GetPath(path, store)` → `GetPath(store, path)`** | **nothing** |

The last one is the trap, and it is worth naming because every remaining
target's resync can hit the same shape. Both parameters are `any`, so all
35 call sites across `tm/go` and `src/cmp/go` kept compiling and began
returning nil. `go vet` was clean. The golden manifest reported fourteen
changed hashes and no reason. What went red was the feature-corpus lane,
three layers from the cause, complaining that "no declared operation
completed against a plain 200" — because `allow.op` had resolved to `""`.
Upstream's change is a good one (it makes `GetPath` agree with
`SetPath(store, path, val)`); it is only dangerous because it is invisible.

Two things follow for the other targets:

- **Diff the signatures, do not read the diff.** 672 lines of drift is
  unreadable, and the one line that matters looks like formatting. Extract
  every exported signature from both copies and compare them
  mechanically; the table above took seconds to produce that way and
  nothing else surfaced `GetPath` at all.
- **Check `auth: null` on every target you touch.** When this was first
  written the defect was live in eleven targets; twelve have since been
  fixed and **six remain** (named below). It fails two different ways, so
  neither fix stands in for the other. go had the same credential leak ts did, independently
  and already present before the resync: `validate` treats a stored null as "no value", the optspec's
  `auth` default fires, and the documented way to disable auth silently
  becomes "use default auth" — putting the withheld credential on the
  wire. It is invisible unless the caller ALSO supplies an apikey: with
  none, nothing is sent either way, so the obvious test passes while the
  defect is live. Fixed the same way as ts (capture suppliedness before
  validate, restore the null after), but go needs the two-value map read
  `authval, authgiven := options["auth"]` — a plain read is nil for an
  absent key too, and only a present nil is a suppression. Every target
  whose struct has these null semantics needs the check and its own test;
  the corpus cannot supply one, because corpus nulls travel as the
  `'__NULL__'` string.

  The two failure modes follow the target's struct version, and only one
  of them is a leak:

  | struct | `validate({auth: null}, …)` | symptom |
  |---|---|---|
  | 0.3.2 / go 0.1.3 | returns the optspec default | **credential transmitted** (fail-open) |
  | 0.0.10 | throws `Expected field auth to be map` | construction error (fail-closed) |

  So the fix differs too: on the newer struct, restoring the null after
  validate is enough; on 0.0.10 the key must be DELETED before validate
  as well, or it throws before the restore can run.

  **Every expressible target now carries it** — twenty-one of them: ts, js,
  go, c, clojure, cpp, csharp, dart, elixir, java, kotlin, lean, ocaml,
  perl, php, py, rb, rust, scala, swift and zig. Only lua cannot express it
  at all (below).

  **Read the verification tier before you trust that list**, because it is
  three tiers, not one:

  | tier | targets | what backs it |
  |---|---|---|
  | executed probe | py, rb, perl, php, java, kotlin, c, cpp, rust, go, js, ts | a lane that generates an SDK, mocks the transport and asserts on the header |
  | lane written, runs in CI only | csharp | the same lane, but no dotnet was available where it was written |
  | no lane anywhere | dart, swift | no runner in the matrix ships dart; swift is macos-only and needs an executable target the template does not emit |
  | **read by eye** | **clojure, elixir, lean, ocaml, scala, zig** | **nothing — never compiled, never run** |

  The **kotlin** lane is the one added with a real toolchain to hand, and it
  was checked BOTH ways: green with the fix, red with the capture stubbed
  back out. A probe that has only ever passed has not been shown to be able
  to fail — the c probe passed its own defect once, for exactly that reason.
  It is also the first thing in this repo that compiles the kotlin target at
  all, and the only lane that needs the network (gradle resolves the Kotlin
  plugin on a cold runner).

  The six in the bottom tier were written against toolchains that were not
  available: no clojure, elixir, lean, ocaml, scala or zig compiler existed
  where the change was made. They are held only by the structural guard in
  `generatedcompile.test.ts`, and a structural guard cannot see a type
  error, a scoping mistake or a mis-ordered statement. Treat them as
  plausible, not proven. Anyone with one of those toolchains should build
  that target FIRST and add a lane second.

  **The fix is not always in makeOptions — lean's is not.** lean's
  `makeOptions` runs no `validate` and its defaults carry no `auth` key, so
  no optspec default can fire and there is nothing to capture around. The
  leak was entirely in `prepareAuth`, which branched only on an empty
  apikey and never read `options.auth`. Its fix therefore reads the raw
  stored slot (`getpropRaw`, the only reader that tells a stored null from
  an absent key) and suppresses the header on that — and, unlike every
  other port, ABSENCE must stay the ordinary case there, precisely because
  no optspec guarantees the key is present.

  The first audit behind this rollout missed all seven, because it looked
  for files named like `makeOptions` — and cpp keeps that logic in
  `utility/pipeline.hpp`, lean in `SdkUtility.lean`, and so on. Thirteen
  of twenty-six targets were skipped in silence, which produced a
  confident and wrong "complete". **Audit by content, never by filename**;
  `generatedcompile.test.ts` now classifies every target and scans whole
  trees for the marker, so the list cannot drift out of date again.

  One target is a language limit rather than an oversight:
  **lua cannot express it at all.** A Lua table stores no nil — `t.auth =
  nil` removes the key — and the port has no null sentinel (its own
  struct source says so: "Lua has no undefined; the unit tests use the
  string `__NULL__` where necessary"). So `auth = nil` is indistinguishable
  from omitting auth, and there is nothing for makeOptions to detect.
  Giving lua the suppression means giving the port a null sentinel first,
  which is a much larger change to its public shape.

  **Do not assume the fix is confined to makeOptions.** An earlier draft
  of this note claimed every target's prepareAuth already honours a null,
  and that an options-level assertion (`options.auth is still null`) was
  therefore a sound proxy for driving the wire. Both were wrong, from the
  same sample error as the filename audit: thirteen targets were checked,
  not twenty-six.

  **lean is the counterexample.** Its `prepareAuth` never read
  `options.auth` at all — it branched on an empty apikey and otherwise read
  `auth.prefix` — so restoring the null in makeOptions would have changed
  nothing there. lean's fix is in `prepareAuth` alone, and its makeOptions
  needed no change at all.

  So for each target, check BOTH ends, and pin the property where it is
  actually observable: **assert on the authorization header a mocked
  transport receives**, not on the options map. An options-level assertion
  passes for a lean-shaped port that never consults the value.

  **The structural guard had the same C-family blind spot, in miniature.**
  It anchored on `validate(` — the name with an opening paren — and so read
  two correctly fixed ports as unfixed: clojure writes `(vs/validate merged
  optspec)` and ocaml `validate merged optspec`, and neither puts a paren
  after the name. It also spelled the marker `authSuppressed|auth_suppressed`,
  missing clojure's idiomatic `auth-suppressed`. It now anchors on the bare
  identifier between the first and last marker, which is
  spelling-independent, and lean — whose fix is a different shape entirely —
  has an explicit entry in `AUTHNULL_FIX_SHAPE` rather than a loosened rule
  that would blind the check everywhere else.

  Guards live in `generatedcompile.test.ts` as a table of per-target
  lanes, one row per target, each running a probe inside a freshly
  generated SDK. Every probe opens with a BASELINE assertion that an
  ordinary apikey is still sent, because the suppression alone cannot fail
  visibly — with no apikey nothing goes on the wire either way, so a probe
  without the baseline passes with the defect live.
- **What a struct resync actually costs, measured on two targets.** The
  rollout's per-target step 1 is "vendor that language's struct 0.3.2". Two
  were attempted, and they came out at opposite ends, so do not price the
  remaining ones off either alone.

  **Read behaviour, not the stamp.** The upstream repo's per-port
  `// VERSION:` lines are STALE: at commit `9440935` — the commit `ts@0.3.2`
  and `go@0.1.3` were both taken from — `javascript/src/struct.js` still says
  0.0.10 and most ports say nothing at all. Scanning those stamps says only
  TypeScript has 0.3.2, and that is wrong: upstream python and javascript at
  that commit both already answer the 0.3.2 way on every null question. The
  stamps are the same trap as auditing by filename. Run the code.

  **js was a one-file drop-in, and worth doing on its own.** 65 exports in
  common, 6 new regex helpers, none dropped; header, manifest entry, golden
  regen, done, whole suite green. It also closed a live parity hole: js was
  on 0.0.10 while ts was on 0.3.2, so the two targets *every other language
  is held in parity with* sat in different auth-null failure classes.

  **php is NOT, and the reasons are concrete.** Two hard blockers, both
  found by trying it:

  1. **PHP's `[]` is both an empty list and an empty map**, and upstream
     0.3.2's validate now rejects what the older vendored copy tolerated.
     The generated SDK dies at construction with `Expected field
     entity.ambient to be map, but found list: []` for every entity. Fixing
     that is a php TEMPLATE change — the option/optspec construction has to
     mark an empty map as a map — not a vendoring change.
  2. **The provenance header cannot go first.** `vendored.test.ts` reads the
     `// VENDORED:` line as line 1; php requires `<?php` there. Either the
     guard learns a per-language prologue or php gets a different provenance
     mechanism.

  And a resync would NOT fix php's auth-null failure mode anyway. Upstream
  php's validate still diverges from canonical on a stored null: with
  `{auth: null}` against a spec whose `auth` carries a default, canonical
  substitutes the default and php raises `Expected field auth to be map, but
  found no value`. Both agree when `auth` is ABSENT — so this is specifically
  the stored-null path, and it is why php is fail-CLOSED. That one is an
  upstream php fix, not a resync.

  **A third upstream-side item, already fixed there.** py's vendored getprop
  is right for a map and wrong for a list — canonical tests `isnode(val)`
  (map and list) then applies the null rule once, while py's copy branches
  ismap/islist and its list branch does `return val[key]`, an early return
  that skips it. Upstream python at `9440935` already returns `'ALT'` there,
  so py needs a resync, not an upstream fix. Whether py's resync is
  js-shaped or php-shaped is untested.

  **rb is likely to be neither.** Its vendored copy carries a local
  performance fix (lazy `log`, an O(n²) removal with measurements in the
  comment) that upstream took with a DIFFERENT signature — block-only
  upstream, block-or-string in the vendored copy — so a resync has call
  sites to reconcile. 1249 differing lines.

- **A silent BEHAVIOUR is now pinned too.** `ts/test/structnull.test.ts`
  runs each vendored struct through the one question that started all of
  this — when a key is PRESENT and holds a JSON null, is that "no value"? —
  and pins the answer per port. Measured, not assumed:

  | port | stamp | `getprop({x:null},'x','ALT')` | `haskey` | `validate({auth:null},…)` |
  |---|---|---|---|---|
  | go | 0.1.3 | `'ALT'` | false | returns the default |
  | py | — | `'ALT'` | false | returns the default |
  | perl | — | `'ALT'` | false | returns the default |
  | rb | — | `null` | true | returns the default |
  | php | — | `null` | true | THROWS |
  | js | 0.0.10 | `null` | true | THROWS |

  Three distinct behaviours across six ports — and **`ts` (0.3.2) and `js`
  (0.0.10), the two targets every other language is held in parity WITH, are
  in different classes.** That is not subtle: it is exactly the fail-open /
  fail-closed split catalogued above. The signature pin below cannot see any
  of it, because nothing about a signature changes.

  The shared corpus cannot pin it either, for a reason worth writing down:
  the runner's `fixJSON` rewrites every JSON null — on BOTH the `in` and
  `out` sides — to the string `'__NULL__'` before the subject is called,
  unless the section runs with the `null: false` flag. So a corpus case
  written the obvious way passes the STRING `'__NULL__'` as the stored value
  and asserts nothing about null at all.
  **create-sdkgen#26** adds `struct/nullsem.aon` — 33 cases across getprop,
  getelem, getpath, haskey and keysof, all verified against upstream 0.3.2 —
  which runs with that flag and is OPT-IN, so it becomes each target's null
  gate as it migrates rather than reddening the half of the tree that has
  not.

  That section found a defect on its first run: **py's vendored getprop is
  correct for a map and wrong for a list.** Canonical getprop tests
  `isnode(val)` — map and list — then applies the null rule once; py's copy
  branches ismap/islist and its list branch does `return val[key]`, an early
  return that skips the rule, so `getprop([null], 0, 'ALT')` hands back the
  null. Fix upstream, resync, then py opts in.

- **A silent signature is now pinned.** `ts/test/vendored.test.ts` grew a
  `vendored signature drift` block listing the exact `func` lines the
  templates' call sites assume — currently `GetPath` and `SetPath`, the
  two whose parameters share a type. A resync that reorders them fails
  there, at the point of the resync, quoting both the old and the new
  declaration. Add the equivalent pin for any other port whose vendored
  API has same-typed adjacent parameters.
