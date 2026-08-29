# Migration guide: vendoring omni, struct 0.3.2, and sekreto

A phased plan to upgrade sdkgen so generated SDKs vendor the current
[voxgig/omni](https://github.com/voxgig/omni) (shared test specs),
[voxgig/struct](https://github.com/voxgig/struct) (data utilities) and
[voxgig/sekreto](https://github.com/voxgig/sekreto) (secret access) —
keeping the "SDKs have no dependencies" rule — including the upstream
bug-fix backports the prototype surfaced.

**Source of truth.** Everything here was proven on the solardemo
prototype branch
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
target and merely WARNS on `feature-source-missing`. A project with any
target lacking a sekreto port would otherwise carry an active `secrets`
model/config with no implementation behind it. Either implement the
feature-tag gate first, or ship an equivalent applicability check as
part of this phase; do not rely on the warning.

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

## Rollout and acceptance

Order: Phase 0 → 1 → 2 → 3, each as its own reviewed PR (Phase 4 rides
along with whichever phase first needs the guard). Between phases, run
the standard validation sequence from `CLAUDE.md`:

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
absorbed. Elementdemo is the
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
