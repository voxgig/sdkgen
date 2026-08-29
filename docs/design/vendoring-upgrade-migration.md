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
| `test/vendor/omni/` + `test/omni.ts` resolver | new `tm/ts/test/vendor/omni/` + `tm/ts/test/omni.ts`, REPLACING `tm/ts/test/runner.ts`; same per language for the other runner templates (`tm/py/test/runner.py`, `tm/lua/test/runner.lua`, `tm/go/test/runner_test.go`, ...), vendoring omni's own port for that language |
| consumer import changes in `test/utility/{PrimaryUtility,StructUtility}.test.ts` | the same files under `tm/ts/test/utility/` |
| `src/utility/sekreto/` | new `tm/ts/src/utility/sekreto/`; other languages from sekreto's ports (`go/`, `python/`, `java/`, `ruby/`, `php/`, `rust/`, ...) |
| `src/feature/secrets/SecretsFeature.ts` | new `tm/ts/src/feature/secrets/` (beside the 19 existing feature template dirs) |
| `Config.ts` registry + metadata edits | `ts/project/.sdk/src/cmp/<lang>/fragment/Config.fragment.*` / `Config.data.fragment.*` — emit the `secrets` FEATURE_CLASS entry and `config.feature.secrets` metadata when the model enables the feature |
| `SolardemoSDK.ts` (`_secrets` field, `secrets()` accessor, `prepare()` await) | the Main template/fragment for each language |
| `test/secrets.test.ts`, `test/omni.test.ts` | `tm/ts/test/` (trimmed by the feature-tag machinery when secrets is off — see Phase 3) |
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
4. Repeat per language using omni's own ports
   (`/home/user/voxgig/omni/<lang>/`), replacing
   `tm/<lang>/test/runner.*`. Where a language's omni port lacks a
   compat shim, the resolver template supplies the same adapter shape.
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

1. Vendor sekreto verbatim into `tm/ts/src/utility/sekreto/`
   (Sekreto, Providers, Sigv4, trimmed barrel) and re-export it from
   the Main template (`export { ..., sekreto }`), as the prototype
   does — SDK users need the provider factories to configure chains.
2. Add the `secrets` feature template `tm/ts/src/feature/secrets/`,
   copied from the prototype's `SecretsFeature.ts`. The design that
   survived contact, and must survive porting:
   - The `apikey` option keeps its exact old meaning and ALWAYS wins:
     `init` places it first in the chain as a `memory` provider named
     `options`, so explicit-beats-lookup is sekreto's own first-hit
     rule, not special-case logic. `prepareAuth` is untouched;
     behavior with the feature inactive is bit-identical.
   - `init` is synchronous by feature contract: it builds the chain,
     never looks anything up. Resolution happens once in the awaited
     `PreSpec` hook and writes into the live options where the sync
     `prepareAuth` already looks; concurrent ops share the in-flight
     promise.
   - A provider ERROR fails the op; only a MISS falls through
     (sekreto's invariant: a broken vault never yields an
     unauthenticated request). The secret name defaults to `apikey`,
     configurable via `feature.secrets.name`.
3. Component work (this is what the prototype had to hand-edit in
   three places):
   - Config fragments (`ts/project/.sdk/src/cmp/<lang>/fragment/
     Config*.fragment.*`) emit the `secrets` FEATURE_CLASS entry and
     `config.feature.secrets` metadata when the model enables it.
   - The Main template gains the `_secrets` field, the `secrets()`
     accessor (returning the LIVE instance — sekreto holds provider
     state, so never a clone), and the explicit
     `await client._secrets.resolve()` in `prepare()`, which bypasses
     the feature hook pipeline.
   - Model: a `feature.secrets` block beside `feature.test` in
     `model/sdkgen.aon`'s feature machinery, plus the feature-tag
     declaration so `target add` trims it for targets without a
     sekreto port (see `docs/design/feature-tags.md`).
4. Tests: port the prototype's `secrets.test.ts` (option-wins,
   env/custom provider, miss-vs-error, PreSpec resolution through a
   real entity op) as a feature-gated test template. Replace the
   entity-test `dotenv` preamble with `loadEnvLocal` over the vendored
   `parsedotenv` (same semantics: missing file fine, existing env vars
   win) and drop `dotenv` from `tm/ts/package.json` — the last
   non-tooling devDependency. Watch the emit order: the loader call
   must sit AFTER the import block (the prototype hit the
   emitted-require-before-import TDZ failure).
5. Follow-on candidates, kept out of the first pass: wire `clean()`
   (currently an identity function with its redaction body commented
   out) to `sekreto.redact()`, which already tracks every resolved
   value even with caching off; and decide ONCE, in sdkgen, whether
   `prepare()`/`direct()`/`graphql()` should run a reduced hook
   pipeline instead of accreting per-feature awaits.
6. Language rollout follows sekreto's ports (go, py, java, rb, php,
   rust first); targets without a port simply do not enable the
   feature — the trim machinery already handles feature-absent
   targets.

**Done when:** a model with `feature.secrets` active generates an SDK
whose suite includes the secrets tests and passes; one with it
inactive generates byte-identically to pre-migration output (modulo
Phases 1–2); solardemo regen reproduces the prototype's `src/` tree.

## Phase 4 — conventions and guards

1. **Provenance headers everywhere**: source repo + commit + upstream
   path + license + "do not edit: resync from upstream" on every
   vendored file, as the prototype standardized. Backfill the copies
   that predate the convention (the go struct copy has no stamp at
   all).
2. **Stamps move together**: the runner, StructUtility, and the struct
   corpus test carried matching `0.0.10` stamps that all had to change
   in step. Add a per-target vendored-versions manifest (or extend
   `sdkgen-package.json`) naming each vendored library's version and
   commit, and a `doctor` check that (a) verifies stamps agree with
   the manifest and (b) flags unmarked local edits to vendored files
   — the drift gate already catches post-generation edits in consumer
   repos; this catches drift inside the templates themselves.
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
sdkgen must reproduce the prototype's `ts/` content — at which point
the prototype's red `Generate and check for drift` gate would be
green, and the branch can be closed as absorbed. Elementdemo is the
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
- **sekreto in browsers** stays broken until the upstream split lands;
  until then the secrets feature is Node-only, which the feature tag
  should say.
