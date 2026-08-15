# Design: sdkgen packages — external targets, features, and other kinds

Status: **proposal** (2026-08-14). **Phase 1 (§18.1) implemented**
(2026-08-15) — the live bugs of §16 and the characterization goldens that
gate phase 2. Everything from §18.2 onward is still proposal.

Deltas found while implementing phase 1:

- **jostraca's `replace` map cannot express the alias rewrites.** Each key
  is canonicalised into a regex GROUP NAME (`idenstr(k)` with underscores
  collapsed), so two keys differing only in punctuation collide and one
  silently overwrites the other. Both alias rewrites hit this: `_go'` /
  `_go"` reduced to the same name, so every single-quoted sibling import
  came out as `from './Package_go2"`; and `target: go-cli:` /
  `target: 'go-cli':` likewise, so the quoted key a hyphenated target needs
  was rewritten to the bare form. Both now use one explicit regex with the
  quote captured. **This constrains §8**: a `TreeDef.replace` mode is a
  named rewrite the registry owns, not necessarily a jostraca replace map —
  `alias` mode in particular must not be implemented as one.
- **The `to` prop works as designed** — an explicit destination name on a
  single-file `Copy` is honoured, so the model file lands under the alias
  with no post-copy pass.
- **The aliased `src/cmp` tree is emitted file by file** (`File`/`Content`)
  rather than copied, because jostraca's tree walk has no per-entry rename
  hook. The unaliased path keeps its plain tree `Copy` untouched, which is
  what keeps all 27 golden trees byte-identical.
- **The goldens are 2,226 entries / ~100 KB** (`ts/test/golden/add-output.txt`),
  built in ~5 s. Per-file hashes rather than an aggregate digest, so a
  failure names the files that moved.
- **`base` is recorded for only 3 targets today** (ts, csharp, swift — the
  ones carrying the `'BASE'` anchor), so the machine-independence guard
  currently bites only there. Universalising the anchor is §18.3, and the
  guard is already general.
- **The dry-run prune fix needed the flag threaded explicitly.**
  `pruneStaleTemplates` writes through `fs` rather than jostraca, so it
  takes `dryrun` as an argument from `TargetRoot`'s `actx` rather than
  reading anything jostraca knows.

Requirement: it should be possible to add targets and features that are
defined *outside* the `@voxgig/sdkgen` package. Define a folder structure
or convention for such "sdkgen packages". Targets and features are just
two kinds — there could be more, such as docs. A package must be addable
from a local folder or a checkout of a custom repo, and it must also be
possible to publish one as an npm package that a consumer installs in its
`.sdk` folder.

The one-paragraph design: **an sdkgen package is a folder shaped exactly
like sdkgen's own `ts/project/.sdk` scaffold, plus a JSON manifest at its
root. What a package provides is described by a KIND — `target`,
`feature` and `docs` ship as data in a kind registry, so adding any of
them is one uniform copy pipeline rather than one hand-written action per
kind. Provenance stays in the model: every copied model file records the
`.sdk` folder it came from, so there is no new lockfile and no second
source of truth.** Most of the machinery exists; this design names the
convention, turns the two hardcoded add-actions into registry entries,
parameterises the places that hardcode the bundled scaffold, and closes
the provenance and doctor gaps that external sources expose. Verifying
those seams also surfaced live bugs — aliased installs are broken
end-to-end, dry runs delete files — which land first (§16, §18).

The long-term aim this design is built for: **voxgig's own targets should
eventually be able to ship as sdkgen packages.** The bundled scaffold is
therefore treated as the first package throughout, and the portability
work (test kit, corpus, parity tiers) is first-class rather than a
courtesy to third parties (§14).

---

## 1. How much of this already exists

This design is a generalisation of shipped seams, not an invention. What
is already true today:

| Seam | Where | What it gives us |
| --- | --- | --- |
| **Path refs in `target add`** | `resolveTarget` (`ts/src/action/target.ts`), documented in [reference/cli](../reference/cli.md#target-references) | `target add acme/widgets/go` already resolves `node_modules/acme/widgets/.sdk`, falling back to `acme/widgets/.sdk` relative to the CLI's working directory (the consumer's `.sdk`); absolute paths work. The last path element is the target name; everything before it locates a `.sdk` folder. |
| **Provenance via `base`** | the `'BASE'` replace in `target_add`; `base: 'BASE'` in the shipped model file | The copied `model/target/<t>.aontu` records which `.sdk` folder it came from. `feature_add` reads `t.base` back to find each target's template tree, and `doctor` re-resolves the scaffold from it to diff against. This is the provenance channel this design generalises rather than replaces. |
| **Consumer targets** | `go-cli`, `go-mcp`, `py-data`, `seneca-provider` | A target can switch every standard phase off (`phase.<name>.active: false`) and emit an arbitrary package from `Main` — i.e. "target" is already a general *output kind*, not just "language SDK". |
| **Out-of-tree output** | `output.path` + `cmp/ExternalTarget.ts` + `checkExternalFolders` | A target can generate into another repo, with destination safety checks. |
| **Project-side extension** | `registerComponent` (`ts/src/cmp/Registered.ts`) | A project adds `cmp/<t>/X_<t>.ts` components that `doctor` classifies as additive, not drift. |
| **Root-wiring detection** | `doctor`'s `unwired` category + `ROOT_COMPONENTS` | A project's `Root.ts` is frozen at init, so sdkgen already has a mechanism for reporting capabilities a project never wired in. New kinds need exactly this (§8). |
| **Package-path aontu includes** | `@"@voxgig/apidef/model/apidef.aontu"` (`ts/test/generateharness.ts` `makeModel`; the harness reaches the sdkgen schema by a *relative* include, a real consumer by the package path `@voxgig/sdkgen/model/sdkgen.aontu`) | aontu `@"..."` includes can name an npm-package path — how a consumer's model pulls in the base schemas. |

And the gaps an external source hits today:

- **Feature models are hardcoded to the bundled scaffold.** `feature_add`
  copies the feature `.aontu` from
  `node_modules/@voxgig/sdkgen/project/.sdk/model/feature/` unconditionally
  (`ts/src/action/feature.ts`, the `BASE` constant — the code carries the
  comment `TODO: these paths needs to be parameterised`). There is no ref
  syntax for features, and a copied feature model records **no provenance
  at all**, so nothing can say where a feature came from.
- **Target provenance is patchy.** Only `ts.aontu`, `csharp.aontu` and
  `swift.aontu` carry `base: 'BASE'`; the other 24 shipped target models
  record nothing, so `doctor` and `feature_add` silently fall back to the
  bundled scaffold for them — correct today, wrong the moment a same-named
  target can come from elsewhere.
- **Aliased targets break drift detection loudly.** `base` alone cannot
  express an aliased target's original name: for the three base-carrying
  targets `doctor` reconstructs the ref as `<base>/../<tname>` (so
  `ts~ts2` probes for a `ts2` tree that does not exist); for the 24
  base-less ones it goes wrong a step earlier, via the bare-name fallback.
  Both routes converge on scaffold trees that do not exist, whose walk
  returns empty — so every aliased component file reads as `additive` and
  every template as `stale`, a *failing* category. Real edits are
  undetectable, and `doctor` exits red with pure noise for any project
  carrying an alias.
- **Aliasing itself is broken end-to-end** — deeper than the doctor
  symptom; see §16.1. This design uses `~` aliasing as the collision
  escape hatch, so repairing it is a prerequisite, not a nice-to-have.
- **The feature source fan-out uses the installed name.** `feature_add`
  searches `<t.base>/tm/<t.name>` — for an aliased target the source tree
  is `tm/<origname>`, so the search misses.
- **Two hand-written add pipelines, no shared spine.** `target_add` and
  `feature_add` each re-implement resolution, copying, index maintenance,
  dry-run handling and logging, and they have already drifted (only one
  applies a replace map; only one prunes; only one accepts path refs). A
  third kind would be a third copy.
- **No package concept.** Nothing groups "this folder provides targets X,Y
  and feature Z", or validates that claim. A typo'd ref that resolves to
  an existing-but-wrong `.sdk` folder fails *late*, with an internal
  jostraca `ShapeError` (the model-file `Copy` stats a missing `.aontu`)
  that names neither the probed locations nor what kind of thing was
  being looked for — the only existence check `resolveTarget` performs is
  on the `.sdk` directory itself.
- **The CLI mangles refs.** `SdkGen().action()` maps every positional
  through `Jsonic(arg)` before dispatch (`ts/src/sdkgen.ts`), so a Windows
  absolute ref (`C:\...`) parses into an object. No test covers the CLI
  argument path — `target.test.ts` calls the resolver directly.
- **The guard suites are closed over the bundled scaffold.** `parity.test.ts`,
  `featuremodel.test.ts`, `featuresource.test.ts` and `generate.test.ts`
  enumerate `ts/project/.sdk` with exact-set assertions. An external
  package's content is invisible to all of them — nothing fails, and
  nothing is covered. Since bundled targets are meant to migrate out
  eventually (§14), portable equivalents are a requirement, not a bonus.

---

## 2. What an sdkgen package is

A package is any folder — an npm package installed in the consumer's
`.sdk`, a git checkout, or a plain local directory — with this shape:

```
<package-root>/
├── package.json            # npm packages only. files: [".sdk", "sdkgen-package.json", ...],
│                           # peerDependencies: { "@voxgig/sdkgen": ">=3.5" }
├── sdkgen-package.json     # THE manifest (below). Same place for every source kind.
├── README.md
└── .sdk/                   # shaped byte-for-byte like ts/project/.sdk:
    ├── model/
    │   ├── target/<t>.aontu        # one per provided target (self-contained; see §10)
    │   ├── feature/<f>.aontu       # one per provided feature
    │   └── <kind>/<n>.aontu        # one per provided item of any other kind
    ├── src/cmp/<t>/                # per-target components (Main_<t>.ts, Entity_<t>.ts, …)
    └── tm/
        ├── <t>/                    # per-target templates
        └── <other-target>/…        # feature-source overlays for targets the package
                                    # does NOT provide (a feature's per-target source)
```

The `.sdk` subfolder is the load-bearing convention: it is what
`resolveTarget` already probes for, and it means the copy pipeline —
stale-template pruning, feature-source discovery (`findFeatureSources`),
doctor's re-substituted comparison — works on a package tree unchanged,
because it cannot tell it apart from the bundled scaffold. One code path
is the deliberate exception: **feature trim resolves its catalogue from
the source folder**, which is wrong for external targets and gets
parameterised (§6).

### The manifest: `sdkgen-package.json`

```json
{
  "sdkgen": { "package": 1 },
  "name": "@acme/sdkgen-iot",
  "version": "1.4.0",
  "engines": { "sdkgen": ">=3.5" },
  "provides": {
    "target": ["iot-go"],
    "feature": ["circuitbreaker"],
    "docs": ["apiportal"]
  },
  "targetsSupported": { "circuitbreaker": ["ts", "js", "go", "iot-go"] },
  "parity": { "iot-go": "MIRRORED" }
}
```

- **JSON, not aontu, deliberately.** Consumer models compile under
  `@voxgig/model`'s strictly-configured parser (`#` comments only — a `//`
  line is a parse error; see `ts/test/model-compile.test.ts`, which exists
  because seven shipped targets once broke exactly this way). The manifest
  is read by the CLI, not unified into the model, and JSON keeps it outside
  that trap entirely.
- `sdkgen.package` is a schema version gate; `engines.sdkgen` gates the
  generator version (packages consume the public component API, which
  evolves).
- `provides` is keyed **by kind** (§8), so a new kind needs no manifest
  schema change. It is the package's claim, **validated structurally at
  add time** against the kind's declared trees: every listed target must
  have its `model/target/<t>.aontu`, `src/cmp/<t>/` and `tm/<t>/` on
  disk; every feature its `model/feature/<f>.aontu`. This closes the
  typo'd-ref hole in both directions (manifest lies → error naming what
  is missing; on-disk extras → warning).
- `targetsSupported` (optional) declares which targets a feature ships
  source for, so a missing overlay can be reported as *out of declared
  coverage* (info) rather than *broken* (warn) — see §7.
- `parity` (optional) is the package author's declared tier per target,
  in `ts/test/parity.test.ts`'s FULL / MIRRORED / UNCOVERED vocabulary.
  The test kit keys its probes off it (§14). For a bundled target that
  migrates out, this field is where its existing tier declaration goes to
  live — which is why it is defined now rather than left to convention.
- The manifest is **required for `package add`**, and **optional for
  direct refs** (`target add <path>/<name>`): a bare `.sdk`-shaped folder
  keeps working as today, reported once as `package-unmanifested` (info).
  Existing consumers and the create-sdkgen fixtures stay valid — item
  provenance does not depend on a manifest existing (§4).

### The bundled scaffold becomes the first package

`ts/project/` gains a checked-in `sdkgen-package.json` whose `provides` is
pinned to the actual directory listings by a new exact-set guard test
(same discipline as every other closed set in `ts/test/`), with the
version stamped by the existing `build/version.js` lane. This is
dogfooding, the drift-killer (the manifest cannot lie about the scaffold
because a test fails when the directories change), *and* the migration
path: moving a target out later becomes an edit to two manifests rather
than a new mechanism.

One consequence worth stating plainly: because the bundled scaffold now
has a manifest, every bundled add stamps `package: '@voxgig/sdkgen'`
alongside `base` (§4). So the transition diff is two provenance lines
rather than one, and `package update @voxgig/sdkgen` becomes a
meaningful, supported operation — resyncing a project against a newer
sdkgen through exactly the same path an external package uses.

---

## 3. Sources and resolution

Three source kinds, one resolver. All relative refs resolve against the
CLI's working directory, which is the **consumer's `.sdk` directory**
(`resolveActionContext` pins `folder: '.'` and loads
`./model/sdk.aontu`) — so a sibling checkout of the SDK repo is two
levels up:

| Source | How it gets there | Ref that reaches it |
| --- | --- | --- |
| **npm package** | `cd .sdk && npm install --save-dev @acme/sdkgen-iot` (the consumer's `.sdk` is already an npm package with its own `package.json`) | `@acme/sdkgen-iot` (package ref) or `@acme/sdkgen-iot/iot-go` (item ref) — probes `node_modules/@acme/sdkgen-iot/.sdk` first |
| **git checkout / monorepo sibling** | `git clone` anywhere reachable by a relative path from `.sdk` | `../../sdkgen-iot/iot-go` for a checkout beside the SDK repo — second probe, `<.sdk>/<path>/.sdk` |
| **local folder** | already on disk | same as above, or absolute: `/abs/path/sdkgen-iot/iot-go` |

sdkgen grows **no git client**: npm already fetches, pins and
authenticates git dependencies (`npm install acme/sdkgen-iot#v1.4.0`
lands in `node_modules` and resolves via the first probe), and a plain
checkout is just a local folder. This is a deliberate non-feature.

### `resolveSource(ref, kind, ctx)`

`resolveTarget` is extracted to `ts/src/action/resolve.ts` as
`resolveSource`, parameterised by kind, keeping its probe chain and
Windows-safe path handling verbatim; `resolveTarget` remains as a thin
wrapper so `target.test.ts` passes unchanged. Changes:

1. **Existence check upgraded** from "the `.sdk` folder exists" to "the
   `.sdk` folder exists **and** `model/<kind>/<origname>.aontu` exists",
   with the error listing every probed location *and* what was missing —
   replacing today's late, unactionable `ShapeError`. This protects
   manifest-less sources too.
2. **Manifest enforcement when present**: `engines.sdkgen` range checked;
   the requested name must appear in `provides[<kind>]`, else the error
   lists what the package actually provides.
3. **Bare names resolve against the model first.** A bare `iot-go` is
   looked up in the consumer's own model — every installed item records
   its source (§4) — and only then in the bundled scaffold. More than one
   hit, or a package item shadowing a bundled name, is a hard error
   listing the qualified forms. Today a same-named external target
   silently resolves against the bundled scaffold in `doctor` (wrong
   comparisons); this converts that hazard into an actionable message.
4. **`~` aliasing stays target-only, and depends on the phase-1 repair.**
   Aliased installs are broken end-to-end today (§16.1). A feature's name
   reaches into generated config keys (`options.feature.<name>`) and hook
   wiring in every language; renaming one at install time is new
   machinery with no customer. `feature add x~y` is a hard error in v1.
5. **CLI fix (prerequisite):** ref positionals after the add verbs must
   bypass the `Jsonic(arg)` mapping in `SdkGen().action()` — raw strings —
   or Windows refs are structurally mangled. A regression test pins both
   this and the `ts,py` comma-splitting that must keep working.

---

## 4. Provenance lives in the model — no lockfile

Every copied model file records where it came from. There is no second
record to keep in sync, no new file format in `.sdk`, and no possibility
of the two disagreeing.

Three keys, stamped into the copy at add time:

```
main: kit: target: 'acme-go': {
  # …the package's own declarations…
  base: 'node_modules/@acme/sdkgen-iot/.sdk'   # the .sdk folder it came from
  origname: 'iot-go'                            # only when aliased
  package: '@acme/sdkgen-iot'                   # only when the source had a manifest
}
```

- **`base` is universalised.** The line is added to the 24 shipped target
  models that lack it and to **all 17 feature models**, which have never
  carried provenance. All three keys are declared in the schema for both
  blocks (`model/sdkgen.aontu`, then `make sync-model`; the model-mirror
  guard fails otherwise) as **defaulted** slots:

  ```
  # in BOTH `main: kit: target: &:` and `main: kit: feature: &:`
  base:     *'' | string   # the .sdk folder this copy came from
  origname: *'' | string   # only when aliased
  package:  *'' | string   # only when the source had a manifest
  ```

  **The empty default is load-bearing, twice over.** These must not follow
  the non-defaulted `string` idiom of their neighbours (`ext`,
  `comment.line`, `module.name`, a feature's `title`) that §10 documents.
  First, aontu treats a non-defaulted key in a `&:` spread as *required*,
  so `base: string` would fail the model compile of every consumer whose
  copies predate this migration — the exact population this section
  promises will behave as today — and `origname`/`package`, which the
  stamp emits only when they apply, would break every *unaliased* install
  on day one. Second, `base` must be FALSY when unset, because both
  shipped readers fall back on falsiness (`t.base || …` in `feature_add`;
  `declared.base ? … : tname` in `doctor`); `*'' | string` reproduces
  today's `undefined` behaviour exactly, while any non-empty default
  would send `feature_add` to a path that does not exist.

  Note the asymmetry in how a mistake here surfaces: `origname` and
  `package` would fail loudly in-repo (`generate.test.ts` unifies the
  schema with the shipped models, none of which carry them), but a
  required `base` would pass every test here — §4 adds the anchor to all
  41 shipped models — and break only downstream consumers.
- **The `base: 'BASE'` line is the anchor, not just a value.** The add
  replace map rewrites it into the full provenance block —
  `"'BASE'" → "'<base>'\n  origname: '<orig>'\n  package: '<pkg>'"`,
  emitting only the keys that apply. That is why every model file needs
  the placeholder line even though most targets are installed unaliased
  from the bundled scaffold: it is the hook the stamp hangs on. Aliased
  installs need the same replace pass anyway to rewrite the target key
  (§16.1), so this is one mechanism, not two.
- **Feature provenance is what makes bare names keep working.**
  `target_add` unconditionally re-runs `feature_add` with *bare* names
  (`test` plus every active feature) after every target add. Without a
  record on the feature, an externally-sourced feature's bare name would
  re-resolve to the bundled scaffold on the next `target add` — and,
  under §3.1's upgraded existence check, hard-error. With `base` on the
  feature model, resolution finds its real source.

  **A model-derived name that no longer resolves must not abort the run.**
  When a recorded `base` is gone (package uninstalled, checkout moved, a
  teammate's clone of a machine-local absolute base — §17.2), the item is
  skipped with a `missing-source` warning naming the recorded base and
  the fix, the already-copied content is left alone, and the remaining
  items still install and still update their index. The skip is **per
  item, not per run**: today a single unresolvable name aborts the whole
  `feature_add` batch, so healthy features — including the mandatory
  `test` — would silently never be copied. §3.1's hard error is reserved
  for a ref the user asked for *explicitly* (`target add`, `feature add`,
  `package add --only`), where nothing is already installed to preserve
  and silence would be wrong. No signal is lost by the downgrade: doctor
  reports `missing-source` as a *failing* category (§12.4), so the
  condition still turns CI red.
- **Authority chain**: model `base`/`origname` → bundled default. A
  consumer whose model files predate this behaves byte-identically to
  today. That chain *is* the migration story.

**What model-only provenance gives up, and what replaces it.** A
lockfile could also record the *version* each copy came from, enabling an
`outdated` report. A version number in a model file would churn on every
`npm update` and produce diff noise in a file `target add` rewrites, so
this design does not record it. Staleness is instead detected **by
content**: `doctor` compares a copy against its source with the
substitutions re-applied, so it reports what actually differs — strictly
more honest than a version comparison, which can match while the content
has diverged (and mismatch while it has not).

For that argument to hold, doctor's coverage has to be extended, because
today it walks TARGETS only — `src/cmp/<t>`, `tm/<t>` and
`model/target/<t>.aontu`. The 17 `model/feature/<f>.aontu` copies this
section gives provenance to, and both index files, are written by add and
compared by nothing. Extending the comparison to every kind's copied
model file is therefore part of this work, not an assumed property
(§12.5). `package list`
reads the model for installed items and *displays* each source's current
on-disk manifest version for information; it does not use it as state.

**Transition tolerance:** after this ships, every existing consumer's
copied model files differ from the scaffold by the new provenance lines
alone. `doctor` classifies a diff consisting *only* of those lines as
informational `resync-pending`, not `forked` — otherwise the upgrade
turns every consumer's CI red at once.

| Provenance alternative | Verdict |
| --- | --- |
| **Model-only (`base` / `origname` / `package`)** | **Chosen.** One record, no new file format, no skew possible; extends the shipped `base` channel that `feature_add` and `doctor` already read. Version tracking is traded for content comparison, which doctor already performs. |
| Lockfile (`.sdk/sdkgen-lock.json`) + `base` | Rejected: a second source of truth that can disagree with the model (hand-edit, merge conflict, partial add), needing its own mismatch detection, dry-run suppression, memfs-aware writer and byte-stability tests — to buy version reporting that content comparison already covers. |
| Lockfile only, drop `base` | Rejected: breaks the shipped `t.base` consumers (`feature_add`, `doctor`) for no gain, and leaves pre-migration projects with nothing. |

---

## 5. Delivery is copy-in at add time — nothing loads from the package at generate time

All content is **copied into the consumer's `.sdk`** by the add actions,
exactly as today. Generation never requires code out of
`node_modules/@acme/...`:

- `requirePath` resolves components from one root,
  `<project>/.sdk/dist/<path>` (`ts/src/utility.ts`), and the consumer
  compiles `.sdk/src` itself — copied component *source* is what compiles.
- Aliasing is a copy-time rename (once repaired — §16.1); a live-loaded
  package could not install one target twice under two names at all.
- Doctor's whole drift model is "compare the copy against the source and
  re-apply the known substitutions".
- Components read their fragments `__dirname`-relative, which survives
  copying but not split loading.
- **Security is the honest fifth reason:** the copied source sits in the
  consumer's git diff *before* it ever executes. `package add` itself
  executes nothing from the package (it parses `.aontu` files and copies);
  the code runs when the consumer builds and generates. There is no
  sandbox, and this design does not pretend to add one — `npm install`
  already ran arbitrary lifecycle scripts, and a malicious *generator*
  owns the supply chain through its emitted SDK regardless. The authoring
  guide states this posture plainly: review a package's `.sdk/src` like
  any other dependency; `doctor` detects post-add tampering of the copies.

---

## 6. Adding a target from a package

```bash
cd my-sdk/.sdk
npm install --save-dev @acme/sdkgen-iot
voxgig-sdkgen target add @acme/sdkgen-iot/iot-go          # qualified
voxgig-sdkgen target add @acme/sdkgen-iot/iot-go~acme-go  # aliased install name
voxgig-sdkgen target add iot-go                           # bare, once installed
```

Mechanically this is the `target` kind's registry entry (§8) executed
against a resolved source: the same three copies (model file with the
provenance replace, `src/cmp/<origname>` → `src/cmp/<tname>`,
`tm/<origname>` → `tm/<tname>` with feature trim + `templateReplacements`),
the same `target-index.aontu` append, the same prune pass — plus manifest
validation when a manifest is present.

Two corrections the external case forces:

- **The trim catalogue must be the consumer's, not the source's.**
  `trimFeatures` derives the trimmable feature set from
  `availableFeatures(tfolder)` — the *source* folder's `model/feature/`
  listing. An external target package that ships source for the *bundled*
  features in its `tm` tree (which any serious language target must, to
  participate in the standard feature set) declares no feature models of
  its own, so nothing is discovered, nothing is trimmed, and every
  consumer receives all of its feature source regardless of the model —
  recreating the 272-stray-file incident the discovery machinery was
  built to kill. Fix: the catalogue becomes the union of the bundled
  scaffold's features, the source package's own, and every feature
  already installed in the consumer's model (whose own `base` says where
  it came from). Bundled adds see bundled ∪ bundled — byte-identical to
  today. The same union feeds `pruneStaleTemplates`' want-set and
  doctor's tm comparison, or correctly-trimmed files would read as
  missing.
- **`readTargetFeature` (trim/fullset) parses the source package's model
  file standalone** — an external target model must be self-contained
  under `main: kit: target: <origname>:`, which §10 spells out.

---

## 7. Adding a feature from a package

```bash
voxgig-sdkgen feature add @acme/sdkgen-iot/circuitbreaker
```

The `feature` kind's registry entry differs from `target` in exactly one
structural way — it has no trees of its own, but a per-target **fan-out**
— and that difference is declared as data (§8) rather than written as a
second pipeline. Four substantive changes:

1. **The model file copies from the resolved package** instead of the
   hardcoded `node_modules/@voxgig/sdkgen/project/.sdk`, and carries the
   provenance stamp (§4) — the `feature.ts` TODO, resolved. The
   `feature-index.aontu` update must receive the resolved *name*
   (`circuitbreaker`), not the raw ref — today `FeatureRoot` passes the
   caller's strings straight through to `UpdateIndex`.
2. **Per-target source fan-out searches two trees per target**: the
   feature package's own `tm/<t.origname>/` overlay first, then the
   target's own base (`<t.base>/tm/<t.origname>`) — `origname` from the
   target's model record, fixing the aliased-target miss in passing.
   First-hit-wins is resolved at **discovery**, not by copy order:
   `findFeatureSources` runs against the overlay and the target's base is
   consulted only if it yields nothing, so exactly one tree is copied.
   (Copy order could not express the preference anyway — jostraca writes
   last-write-wins, so copying both would silently invert the
   precedence.) No hit is an *info* when the manifest's
   `targetsSupported` excludes that target, a *warn* otherwise ("declared
   but not shipped" vs "not claimed").

   **The fan-out must carry the same replace map the `tm` tree does.**
   Today it applies none, while `target add` copies `tm/<t>` with
   `templateReplacements(model, t.name)` — so feature source arriving by
   the fan-out keeps its raw `ProjectName` / `PROJECTVERSION` text where
   the same file arriving with the target tree is substituted. That is a
   live bug (§16.9), and it is exactly the writer/writer disagreement
   `helpers/stdrep.ts` exists to prevent; the registry closes it by
   giving `FanoutDef` the same named replace mode (§8).
3. **The prune keep-set fix.** `pruneStaleTemplates` computes what
   *should* exist in `tm/<t>` from the **target's** source tree, so a
   foreign feature's copied source would be unlinked on the next
   `target add <t>` — and doctor's tm comparison would call it stale. Both
   get a per-target *foreign-feature expected set*: for every active
   feature whose source differs from the target's, the files
   `findFeatureSources` discovers in that feature's overlay tree. Union it
   into the prune keep-set and into doctor's expected set (compared with
   the *same* replace map the fan-out writes with, per item 2 — two
   substitution regimes inside one `tm/<t>` would force doctor to know
   which file arrived by which route; differing → edited, absent →
   missing). **The
   keep-set fails safe**: if a foreign feature's recorded base does not
   exist on disk (package uninstalled or checkout moved while the feature
   stays active), an empty discovery must not be read as "nothing to
   keep" — pruning skips that target with a `missing-source` warning,
   the same rule `pruneStaleTemplates` already applies to an unreadable
   source tree.
4. **The same-run sequencing fix.** `target_add` invokes
   `feature_add(features, actx)` *after* copying targets, but the
   just-added targets are not in the in-memory model, so the fan-out loop
   (`each(target, …)`) cannot see them — the target's own tree covers its
   own feature source, but a *cross-package* feature would silently skip a
   target added in the same run. The fan-out must additionally iterate the
   targets of the current run (passed through, as `TargetRoot` already
   does for trim). **This is gated on item 2 landing first**: extending
   the fan-out to the target being added means it now writes over files
   the target tree just substituted, so without the shared replace map
   the sequencing fix would newly corrupt *bundled* adds — today those
   targets are invisible to the loop, which is the only reason the
   missing map has not bitten there.

A feature package's overlays follow the same per-language layout rules as
shipped features — `findFeatureSources` *discovers* where each language
keeps feature source, so an overlay for `go` is `tm/go/feature/<name>_feature.go`,
for `ts` is `tm/ts/src/feature/<name>/`, and so on. Nothing new to learn,
and the `featuresource.test.ts` discipline (never hardcode
`src/feature/`) carries over verbatim to the authoring guide.

---

## 8. The kind registry

`target` and `feature` are today two hand-written pipelines that have
already drifted: only one takes path refs, only one applies a replace
map, only one prunes, and each re-implements resolution, index
maintenance, dry-run handling and logging. A third kind would be a third
copy. The registry makes a kind **data**, and defines the two existing
kinds in terms of it — which is also the proof that the abstraction is
expressive enough to be worth having.

```ts
type KindDef = {
  name: string                 // 'target' | 'feature' | 'docs' | …
  modelPath?: string           // default `main.${KIT}.${name}`
  index?: boolean              // default true: maintain model/<kind>/<kind>-index.aontu
  provenance?: boolean         // default true: stamp base/origname/package (§4)
  alias?: boolean              // default false: may be installed under a new name
  trees?: TreeDef[]            // what add copies, in order
  fanout?: FanoutDef           // per-target overlay contribution (features)
  root?: string                // root component that renders this kind at generate time
}

type TreeDef = {
  from: string                 // 'src/cmp/$origname'   ($origname/$name interpolated)
  to: string                   // 'src/cmp/$name'
  rename?: { from: RegExp, to: string }   // per copied ENTRY: /_$origname(\.\w+)$/ -> '_$name$1'
  replace?: 'provenance' | 'template' | 'alias' | 'none'
  trim?: boolean               // apply the feature trim + stale prune (targets)
}

type FanoutDef = {
  over: 'target'               // the model collection to fan out over
  from: string                 // '$base/tm/$origname'   (origname, per §16.4)
  to: string                   // 'tm/$name/<discovered destination>'
  replace?: 'template' | 'none'            // DEFAULT 'template' (§7.2)
}
```

The built-in kinds, as registry data:

| Kind | trees | fanout | alias | root |
| --- | --- | --- | --- | --- |
| `target` | `model/target/$origname.aontu` → `model/target/$name.aontu` (provenance); `src/cmp/$origname` → `src/cmp/$name` (alias, rename); `tm/$origname` → `tm/$name` (template, trim) | — | yes | existing per-target dispatch |
| `feature` | `model/feature/$origname.aontu` → `model/feature/$name.aontu` (provenance) | per-target overlay (§7.2) | no | `FeatureHook` |
| `docs` | `model/docs/$origname.aontu`; `src/cmp/docs/$name`; `tm/docs/$name` | — | yes | `Docs` |

One `add(kind, refs, actx)` action drives all of them, so path refs,
provenance stamping, index maintenance, dry-run, logging and doctor
comparison are written once and cannot drift apart again. The replace-map
asymmetry of §7.2 — the `tm` tree substituted, the fan-out not — is
precisely the drift this consolidation exists to end, which is why
`FanoutDef` carries a named replace mode rather than inheriting nothing.

**`alias` mode and `rename` are what make aliasing expressible.** The
`src/cmp` tree cannot simply be copied: the alias repair (§16.1) must
rename `<Cmp>_<origname>.*` to `<Cmp>_<alias>.*` so the neutral
dispatchers (`cmp/<t>/Main_<t>`) resolve, *and* rewrite two kinds of
content the rename would otherwise break — the hardcoded
`src/cmp/<origname>/fragment` paths every target's `Main_<t>` carries,
and the intra-tree sibling imports (`./Package_go` → `./Package_go2`).
Both `rename` and `alias` are **no-ops when `$name === $origname`**,
which is what keeps all 27 unaliased golden trees byte-identical under
phase 2 — the reason this addition is safe rather than a behaviour
change. Mechanically, jostraca's tree walk has no rename hook, but a
single-file `Copy` honours an explicit `to` (verified — §15), so `add`
enumerates the source tree and emits one single-file `Copy` per entry, or
does a post-copy rename pass.

**The honest cost: a new kind touches TWO init-frozen files.**

*Rendering.* Copying content in is only half of a kind; something has to
*render* it. A consumer's `Root.ts` comes from create-sdkgen at init and
is never touched again — which is precisely why `doctor` already has an
`unwired` category and a `ROOT_COMPONENTS` list. So kinds with
generate-time presence declare a `root` component, sdkgen ships a generic
`Kinds({model})` dispatcher that iterates registered kinds and calls each
one's root, and `doctor` reports a project whose wiring never calls it.

*Reaching the model at all.* A kind's items are only in the model if
`model/<kind>/<kind>-index.aontu` is included from the consumer's
`model/sdk.aontu` — another create-sdkgen-owned file written once at
init, which sdkgen only ever READS. Creating the index file (above) does
not include it, and the failure is **silent**: aontu compiles clean and
`main.kit` is an open map, so the kind's keys are simply absent and the
kind generates nothing. Rather than document a second frozen edit, remove
it: `sdk.aontu` carries one include of an sdkgen-maintained aggregator
(`@"kind-index.aontu"`), and the registry's `add` appends each kind's
`@"<kind>/<kind>-index.aontu"` line to that aggregator through the same
`UpdateIndex` machinery it already uses. After a one-time upgrade the
model side self-wires forever, and the `Kinds()` call is the only
remaining frozen-file cost.

*Detecting the omission.* `doctor`'s `unwired` check greps TypeScript
under `src/` and cannot see a missing model include. The detector is
model-versus-filesystem instead: for each registered kind, list
`model/<kind>/*.aontu` (minus the index) and report every basename absent
from `main.kit.<kind>` — a few lines using the same join
`checkTargetModel` already performs. It catches both failure modes, the
unreachable index and an item file never appended to its index (§16.6).

**Docs ships as the third built-in kind**, exercising the registry end to
end: `model/docs/<n>.aontu`, `src/cmp/docs/<n>/`, `tm/docs/<n>/`, a
`Docs` root component, its own index. Note that a package author who
wants zero root wiring can still ship a documentation generator as a
phase-gated *target* (`phase: {entity/feature/readme/agentguide/test:
{active: false}}`, everything emitted from `Main`) — the pattern
`go-cli`, `go-mcp`, `py-data` and `seneca-provider` already prove, and
which keeps working unchanged. The kind is the first-class road; the
target is the zero-wiring road.

**Whether a *package* may declare a brand-new kind is deferred** (§17.1).
v1 ships a registry that sdkgen releases extend, because a new kind needs
a root component and a doctor comparator that a manifest cannot supply.
The registry is the mechanism; opening it to packages is a later,
separable decision.

**De-risking the refactor.** This rewrites the two most incident-scarred
pipelines in the codebase (the `OptionsShape` dry-run trap, the
`pruneStaleTemplates` history), so it lands under **characterization
tests**: before any refactor, pin the byte-exact output of `target add`
for all 27 shipped targets and `feature add` for all 17 features into
golden trees (via the existing memfs `actionharness`), then require the
registry-driven implementation to reproduce them exactly. Same technique
`generate.test.ts` uses for components, and the same discipline AGENTS.md
demands when generated output changes.

Those goldens are the merge gate, so they must be byte-stable across
checkouts, worktrees and CI — and as things stand they would not be.
`actionharness` refs targets by **absolute path**, and `resolveTarget`
records `base` absolutely whenever the source is not under the project
root, so the `'BASE'` stamp embeds the checkout location in every golden
model file — today in 3 of them, and after §4 universalises the anchor,
in all 41. Fix the harness rather than the goldens: mount the scaffold at
a fixed synthetic path inside memfs (`node_modules/@voxgig/sdkgen/…`) so
the *relative* branch runs, which is also the path a real consumer takes.
The harness's existing relative-prefix mapping must be kept alongside the
new mounted one — `feature_add` hardcodes `BASE =
'node_modules/@voxgig/sdkgen'`, and the unconditional feature fan-out
after every target add fails without it. One dedicated test should keep
covering the absolute/out-of-tree branch that the harness stops
exercising.

Two small fixes the registry needs anyway: `loadContent` must bootstrap a
missing `<kind>-index.aontu` (today it `readFileSync`-throws — the
actionharness seeds `# Targets` / `# Features` fixtures by hand), and
`appendIndexEntries` must match line-exact rather than by substring
(today a commented-out entry defeats it), with a `removeIndexEntries`
sibling — which is also what a future `target remove` needs
([regeneration-overwrite](../explanation/regeneration-overwrite.md)
already asks for one).

---

## 9. CLI surface

```bash
voxgig-sdkgen package add @acme/sdkgen-iot        # everything the manifest provides
voxgig-sdkgen package add @acme/sdkgen-iot --only target:iot-go,feature:circuitbreaker
voxgig-sdkgen package add @acme/sdkgen-iot --alias iot-go=acme-go
voxgig-sdkgen package list                        # installed items, their sources, versions on disk
voxgig-sdkgen package update @acme/sdkgen-iot     # re-add from recorded bases (see §13)
voxgig-sdkgen package check [path]                # author-side validation battery (§14)
voxgig-sdkgen docs add @acme/sdkgen-iot/apiportal # any registered kind gets the same verb shape
```

- `package add` resolves the package root (same probe chain, at package
  rather than item level), requires and validates the manifest, then
  **loops the registry's `add`** once per provided item — no new copy
  pipeline, and index and logging semantics come with it. Dry run does
  *not* come for free and is stated explicitly: the pre-existing dry-run
  defect in the loop — `pruneStaleTemplates` deletes files during a dry
  run today (§16.2) — is fixed in phase 1, before `package add` builds on
  it. An `--install` flag may shell out to `npm install --save-dev`
  first; the two-step (`npm install`, then `package add`) stays the
  canonical, documented path — the failure modes of each step stay
  separate and legible.
- `<kind> add <ref>` works for every registered kind, so `target add` and
  `feature add` keep their exact current spelling and gain path refs
  uniformly.
- `package remove` is deferred to a fast-follow: `removeIndexEntries`
  plus the model's provenance record make it (and plain `target remove`)
  implementable, but removal has its own blast radius (generated output,
  model references) and deserves its own note.
- Code API mirrors the CLI: `sdkgen.package.{add,list,update,check}` and
  `sdkgen.kind(<name>).add`. The CLI only ever calls `action()`, so these
  are a façade over the same action functions, not a second
  implementation.
- **The CLI entry script changes too**, and §18 must budget for it.
  `ts/bin/voxgig-sdkgen` parses with `parseArgs` in strict mode over a
  closed `options` map and then re-validates through a closed `Shape`, so
  every flag above needs three edits (parse entry, shape key, help line)
  plus a row in [reference/cli](../reference/cli.md)'s Options table.
  Flags also need a *route*: `operate()` passes only positionals into
  `sdkgen.action(args)`, while `debug`/`dryrun` reach actions through the
  `SdkGen({…})` constructor. `--only`, `--alias` and `--force` are
  per-invocation *action* arguments rather than generator config, so
  `action(args)` gains a second `flags` parameter instead of smuggling
  them through constructor options. `ACTION_MAP` stops being hand-listed
  and is populated from the kind registry plus the `package` verb — so
  `docs add` costs no dispatch code — and is built null-prototype while
  it is being rewritten (today `voxgig-sdkgen toString` passes the
  `null == actionFunc` guard and dispatches into `Object.prototype`).
- **Error messages are normative design surface**, fixed here and locked
  by tests (§15), not left to implementation taste:
  - *resolution failure*: every probed path, each with the reason it was
    rejected (no `.sdk`; `.sdk` present but no `model/<kind>/<name>.aontu`);
  - *manifest mismatch*: "package `@acme/sdkgen-iot` does not provide
    target `iot-goo`; it provides: target `iot-go`, feature `circuitbreaker`";
  - *engine gate*: both the required range and the running version;
  - *name collision*: which source already supplies the name, plus the
    two runnable fixes (qualified ref, or `~alias`);
  - *feature inert for a target*: "no `circuitbreaker` source for target
    `rb` — not in the package's `targetsSupported`" (info) vs "declared in
    `targetsSupported` but no source found" (warn).

---

## 10. Rules for a package's model files

External model files join the same aontu unification as shipped ones, so
the shipped conventions become the package author's contract:

1. **Self-contained target models.** `readTargetFeature` parses the file
   standalone with a bare `Aontu()`; it must compile alone and declare
   everything under `main: kit: target: <origname>:` — including the
   schema-required `ext`, `comment.line` **and `module.name`** (all three
   are non-defaulted `string`; omit `module.name` and the file passes add
   time, then fails the consumer's model compile — the shipped
   phase-gated targets all declare `module: name: '$$name$$'`). Include
   `base: 'BASE'` as the provenance anchor (§4). Target models also carry
   the schema-slot boilerplate every shipped target model has:
   `main: kit: feature: &: target: '<t>': deps: &: { kind: *'prod' | string }`
   — note this line *declares a slot* (the `kind` field's type for deps
   aimed at this target); it is not where anyone puts actual dependencies.
2. **`#` comments only.** The consumer compiles under `@voxgig/model`'s
   strict parser: a `//` line is a parse error in the consumer even though
   a bare `Aontu()` (which `package check` also runs — see §14) accepts
   it. This asymmetry shipped seven broken targets once; the check battery
   compiles every model file under **both** parsers.
3. **Leave project-owned keys unset.** In aontu, concrete beats default
   but concrete-vs-concrete *conflicts*: a package model that pins
   `publish.registry.package` or `publish.version` makes it impossible for
   the consumer to set them (the exact lesson documented at the top of the
   shipped `ts.aontu`). Registry *identity* (name/url/vault recipe) is the
   package's to state; versions, package names, and activation are the
   project's.
4. **Feature models** declare `name: key()`, the schema-required
   `title` (a non-defaulted `string`, the same trap as `module.name`),
   `version`, `config`, `hook` per [reference/hooks](../reference/hooks.md),
   and `base: 'BASE'`. Per-target dependencies go at
   **`deps: <target>: { '<pkg>': { active: true, version: '…', kind: … } }`
   directly under the feature** — the form the shipped `log.aontu` uses
   (`deps: js: {…}`, with `deps: ts: .js` to reuse one target's block)
   and the only path the dep collector reads (`collectDeps` reads
   `f.deps[<target>]`). Deps placed under `feature.<f>.target.<t>.deps`
   are read by *nothing* today — the aontu slot from §10.1 even makes
   them schema-legal, so no error fires; `package check` probes for
   exactly this mistake (§14). On activation: shipped features declare
   feature-level `active: true` (available to the project) and *most*
   default their runtime option off (`config: options: active: false`;
   `log` deliberately ships on) — the per-SDK runtime opt-in is the SDK
   consumer's `options.feature.<name>.active`, not anything in the
   package's file.
5. **Names** share one flat namespace per kind (`a-z0-9-_`). Collisions
   are add-time hard errors, not silently prefixed: target and feature
   names leak into generated class names, folder names, config keys and
   the `<Cmp>_<name>` component convention, so mangling them would
   deform the generated SDK. `~` aliasing is the collision escape hatch
   for kinds that allow it (after its phase-1 repair, §16.1).

A package's model files reach the consumer by *copy* (then the index
include), not by a direct `@"@acme/pkg/..."` include from `sdk.aontu` —
considered, and rejected for v1: a live include bypasses the add
substitutions and doctor's copy-based drift model, and splits the model
across `node_modules` state that `npm update` mutates silently. The
package-path include stays what it is today: the mechanism for the
*schema* fragments (`@voxgig/sdkgen/model/sdkgen.aontu`,
`@voxgig/apidef/model/apidef.aontu`).

---

## 11. Component code: the public API is the contract

Package components are ordinary per-target components: they import
`@voxgig/sdkgen` (whose public surface — `cmp`, `File`, `Content`, `Copy`,
`each`, `Main`, `FeatureHook`, `registerComponent`, `entityCollection`,
the helper suite — is exactly what the shipped scaffold components
compile against, proven by `tsconfig.scaffold.json`'s paths mapping) and
follow the `<Cmp>_<name>.ts` export convention so the neutral dispatchers
(`Main` → `Main_<t>`, `Entity` → `Entity_<t>`, …) find them after copy-in.

Two consequences worth stating, both sharpened by the intent to migrate
bundled targets out eventually:

- The npm package must keep shipping the model mirror and gain **stable
  subpaths** the ecosystem can rely on; adding an `exports` field is part
  of this work (today any deep path is requirable, which is a compat
  hazard for a package ecosystem, but also currently the only way in).
- The per-language utility modules (`utility_go.ts` and friends) are
  scaffold-relative, not public. A target that migrates out of the
  scaffold would lose them, so the promotion list is not speculative:
  §14's test kit run over a candidate target is how the required set gets
  discovered, and promotion happens before that target moves, not after.

---

## 12. Doctor

`doctor`'s job — "has this `.sdk` drifted from what add would write?" —
extends to external sources through the same registry the adds use: each
kind's `trees` define what doctor compares and with which replace map, so
a new kind is checkable by construction rather than by a new comparator.

1. **Resolution**: model `base` + `origname` → bundled scaffold,
   replacing the `<base>/../<tname>` reconstruction.
2. **Aliased targets get real comparisons**: with `origname` recorded,
   the `src/cmp` and `tm` trees compare against the true origin trees
   (killing today's everything-additive/everything-stale noise, which
   currently *fails* doctor for every aliased project). The *model file*
   comparison reports differences as informational `aliased-diff` —
   editing the alias's model is the documented way to differentiate it,
   so it must not fail the check. (`package update` therefore treats the
   alias model file specially — §13.)
3. **Foreign-feature expected set** unioned into each target's tm
   comparison, with the same absent-source fail-safe as the prune (§7.3),
   and the consumer-side trim catalogue of §6 applied so correctly
   trimmed files are not reported missing.
4. **New findings**: `missing-source` (fail — an item's recorded base no
   longer exists; prints the install/checkout fix), `unlisted` (info — a
   model item with no provenance record, i.e. added pre-migration),
   `resync-pending` (info — §4 transition), `package-unmanifested`
   (info — §2), `unwired` extended to kinds whose root component the
   project never calls, and `unreachable` (fail — an item file present in
   `model/<kind>/` but absent from `main.kit.<kind>`, catching both a
   kind index that `sdk.aontu` never includes and an item never appended
   to its index — §8). `ok` continues to flip only on failing categories.
5. **Every kind's copied model file is compared**, not just targets'.
   Today `model/feature/<f>.aontu` and both index files are written by
   add and checked by nothing, which is the coverage §4's
   content-as-staleness argument depends on. The registry supplies this:
   each kind's `trees` already declare what was copied and with which
   replace map, so the comparison generalises instead of being written
   per kind.

Note what is *not* here: no `provenance-mismatch`, because there is only
one record; and no version-based `outdated`, because doctor compares
content, which is the stronger check (§4).

---

## 13. Updates

```bash
cd .sdk && voxgig-sdkgen package update @acme/sdkgen-iot
```

`package update` re-runs the add for every model item whose `package`
matches, from each item's recorded `base`. Three safety properties:

- **It owns the fetch, because the ordering is what makes the safety gate
  meaningful.** `package update` runs the doctor pre-check *first* —
  against the source as currently installed — then performs the npm/git
  fetch itself, then re-adds. Measured before the source moves, a content
  difference means exactly one thing: a local fork. Run the other way
  round (`npm update` first, as an earlier draft of this section showed),
  and every item legitimately differs from the new source, so the gate
  fires on all of them and trains the operator to pass `--force`. That
  ordering bug would have made the gate worse than useless, because the
  same signal — copy differs from source — carries both meanings, and
  only sequence separates them.
- **It refuses to clobber deliberate divergence.** On forked/edited
  findings the pre-check stops and lists them, requiring `--force`.
  Add-is-overwrite is the standing contract, but *silently* destroying a
  hand-fork during an upgrade is the one unforgivable version of it.
  If the operator updated the source **out of band** anyway (an `npm
  update` in a previous shell), the pre-check can no longer separate
  stale from forked and must say so rather than guess: it reports the
  ambiguity by name and offers the two runnable outs — reinstall the
  previous version and re-run, or `--force`. It must not reuse the
  fork wording for a state it cannot actually diagnose. (Recording a
  per-file digest of the source at add time would make the distinction
  exact — pristine-but-upstream-moved versus locally-edited — at the cost
  of a digest block in every model file; deferred, §17.9.)
- **It never rewrites an alias's model file.** The aliased model file is
  the one file a project is *meant* to edit (that is how an alias is
  differentiated), and §12 deliberately keeps its diffs informational —
  so the forked/edited gate would not protect it. `package update`
  re-copies an aliased item's `src/cmp` and `tm` trees from the new
  origin and leaves `model/target/<alias>.aontu` untouched, reporting the
  skipped file so the author can port upstream model changes by hand.
- **Items are independent.** Because provenance is per item, a single
  direct `target add @acme/sdkgen-iot/iot-go` after an `npm update` is a
  complete, coherent operation — it refreshes that item and says nothing
  false about its siblings. `doctor` then reports the siblings' actual
  content drift, which is what an operator needs to know anyway.

The current toolchain generates by **overwrite** — `existing: { txt: {
write: true, merge: false } }`, pinned in `SdkGen` and explained in
[regeneration-overwrite](../explanation/regeneration-overwrite.md) — so a
post-update `generate` replaces stale output cleanly. Consumers whose
`.sdk/build` config predates the overwrite decision still merge, and for
them the documented placeholder gotcha applies
([debug-generation](../how-to/debug-generation.md)); `package update`'s
output includes the rm-and-regenerate remedy when it detects a
merge-enabled build config.

---

## 14. Authoring a package — and migrating a bundled target into one

The authoring loop mirrors working on sdkgen's own scaffold:

```
sdkgen-iot/
├── sdkgen-package.json
├── package.json                # if publishing to npm
├── .sdk/…                      # the content (as §2)
└── test/                       # the package's own suite, on the test kit
```

- **`voxgig-sdkgen package check [path]`** runs the static battery:
  manifest ↔ filesystem agreement both directions, per the kind's
  declared trees; every model file compiled under the strict parser *and*
  bare `Aontu()`, **and unified against the base schema** (catching a
  missing schema-required key — `module.name`, a feature's `title` — at
  author time instead of consumer compile time); the publish-override
  probe (unify the target model with a project that sets
  `publish.version` etc. — a conflict means the package pinned a
  project-owned key); `base: 'BASE'` present; feature overlays
  discoverable by `findFeatureSources` for every target in
  `targetsSupported`; every feature-source file in a provided target's tm
  tree deriving a name in the known catalogue (§6, so nothing escapes
  trim); concrete dep entries under `feature.<f>.target.<t>.deps` flagged
  (read by nothing — §10.4); names legal; no `//` comments in any
  `.aontu`.
- **A published test kit** (`@voxgig/sdkgen/testkit`) parameterises the
  machinery `ts/test` already uses internally (`build/scaffold-stage.js`
  staging + the `generateharness` fixture model): `stageConsumer()` runs
  the *real* add pipeline against a temp consumer; `generateInto(memfs)`
  generates the fixture SDK and applies the placeholder-leak and
  byte-stability scans; parity probes keyed off the manifest's declared
  tier. This closes the "external packages get zero coverage from the
  closed guard suites" gap with the same muscle, made portable.
- **The corpus ships as its own versioned package.** FULL-tier parity
  means driving the shared `.aontu` corpus, which today lives in
  create-sdkgen and is reachable only from inside voxgig's own repos.
  For a migrated target to keep its tier, the corpus must be consumable
  from anywhere: publish it (`@voxgig/sdkgen-corpus`), consumed by
  create-sdkgen, this repo's guards, and external packages alike. Without
  this, migration silently caps every moved target below FULL.
- **The in-repo guards learn about externalised content.** `parity.test.ts`
  and `featuremodel.test.ts` derive their closed sets from
  `ts/project/.sdk` listings, so a migrated target simply leaves those
  sets (and its tier declaration moves to its package manifest). The
  guard assertions stay exact; what changes is that the tier data travels
  with the target. A migration checklist — move trees, move tier, move
  fixtures, promote any scaffold-relative utilities (§11), verify with
  the test kit — is the deliverable that makes the first move safe.
- **Publishing conventions**: name it `sdkgen-<thing>` /
  `@scope/sdkgen-<thing>`, keyword `sdkgen-package`,
  `peerDependencies: { "@voxgig/sdkgen": "<range matching engines>" }`,
  `files` including `.sdk` and the manifest. A `create-sdkgen-package`
  scaffolder is a natural follow-up (create-sdkgen repo, not this one).

---

## 15. Testing plan (this repo)

- **Characterization tests first** (§8): golden byte-exact trees for
  `target add` across all 27 shipped targets and `feature add` across all
  17 features, captured before the registry refactor and required to be
  reproduced exactly after. This is the gate on the refactor, not a
  follow-up.
- **A fixture package** `ts/test/fixture/acme-widgets/` (manifest; tiny
  target `wtest` with `Main`/`Entity`/`Test` components and a `tm` tree; a
  feature `wfeat` with overlays for `ts` and `wtest`; a `docs` item),
  staged under a synthetic `node_modules/@acme/sdkgen-widgets` — the first
  test to drive the node_modules probe against a real tree.
- **E2E over the fixture**: `package add` → qualified/bare/aliased
  `target add` → `feature add` → `docs add` → doctor clean → hand-edit →
  expected findings → `package update` → forked-refusal with and without
  `--force` → aliased-model-file skip.
- **Dry-run tests**: a dry-run add writes nothing — including no prune
  deletions (§16.2).
- **Trim tests**: the fixture target ships source for a bundled feature
  (e.g. `retry`); assert it is trimmed for a consumer that does not
  select it, survives for one that does, and doctor stays clean either
  way (§6). Note this exercises only the *bundled* term of §6's
  catalogue union — pinning the consumer-model term needs a feature that
  is neither bundled nor shipped by the target's own package, which the
  fixture's `wfeat` (installed from a second source) provides.
- **The fixture's components need a compile lane**: `check-scaffold`
  type-checks only `ts/project/.sdk/src/cmp/**`, so the fixture's
  components are invisible to the build unless the parameterised
  scaffold-stage (the same one the test kit needs) also stages them.
- **Prune/doctor foreign-feature tests** (§7.3, including the
  absent-source fail-safe) and doctor tests for: zero-drift after a fresh
  external add, aliased origname round-trip, `missing-source`,
  `resync-pending`, `unwired` for an unrendered kind.
- **Guards stay green unchanged** for a consumer with no external
  content — every phase is gated on that.
**Resolved jostraca `Copy` semantics.** jostraca publishes `src/`
alongside `dist/`, so these were read from
`ts/node_modules/jostraca/src/op/CopyOp.ts` and confirmed by running
them; nothing here is deferred to a spike.

1. **An explicit `to` on a single-file `Copy` is honoured** — the
   destination basename is defaulted only when `name` is unset — and
   `replace` is applied to the copied content. The §16.1 alias repair
   (copy the model file `to: <alias>.aontu`, rewrite the target key
   through the replace map) is therefore supported as written, and needs
   a test rather than an investigation.
2. **`exclude: true` on a single-file `Copy` is inert.** A boolean
   `exclude` maps to an empty list, and the single-file branch never
   consults it. So the `exclude: true` that `feature_add` passes for the
   feature model file does nothing today: that file is already
   overwrite-on-add, and adding the provenance replace map beside it
   changes no overwrite behaviour. The flag encodes a real but
   unimplemented intent — `File` honours `exclude: true` as "skip if the
   destination exists", but `Copy`'s single-file branch deliberately does
   not call it. Since add-is-overwrite is the standing contract (§13),
   phase 1 deletes the dead flag so the code stops implying a protection
   it does not provide; it must not be carried into `TreeDef` as if it
   worked.
3. **Tree writes are last-write-wins.** Two `Copy` trees writing the same
   path leave the second one's content, which is why §7.2 resolves
   overlay precedence at discovery rather than by copy order.

---

## 16. Live bugs this design fixes first

Found while verifying the seams; each is real today, independent of any
new feature, and phase 1 (§18) fixes them before anything is built on
top:

1. **`~` aliasing is broken end-to-end.** An aliased add (`go~go2`)
   copies the model file under its *origin* basename (`model/target/go.aontu`
   — jostraca's single-file `Copy` defaults the destination to the source
   name and `target_add` passes no `to`), while `target-index.aontu`
   gains `@"go2.aontu"` — a dangling include that breaks the consumer
   model compile outright. The copied file still declares
   `main: kit: target: go:` (only `'BASE'` is replaced), the component
   files keep their `_go` suffixes (`src/cmp/go2/Main_go.ts`) so every
   neutral dispatcher (`cmp/<t>/Main_<t>`) fails to resolve them, and
   fragment paths hardcode the origin name. The repair: copy the model
   file `to: <alias>.aontu`, rewrite the target key via the replace map,
   rename `<Cmp>_<origname>.*` to `<Cmp>_<alias>.*` at copy time, and fix
   origname-relative fragment reads. Doctor's aliased noise (item 3) is
   downstream of this.
2. **Dry run deletes files.** `pruneStaleTemplates` runs its
   `fs.unlinkSync` pass during a `--dryrun` add — jostraca honours dryrun
   only in its own write layer, and the prune bypasses it. §7.3 rewrites
   this function's keep-set, so it inherits the fix and the dry-run test.
3. **Doctor fails every aliased project with noise.** For `ts~ts2` the
   `<base>/../<tname>` reconstruction probes a `ts2` scaffold tree that
   does not exist; for the 24 base-less targets the bare-name fallback
   does the same one step earlier. Walks of the nonexistent trees return
   empty, so components read `additive` and templates `stale` — a failing
   category — while real edits are undetectable.
4. **Feature fan-out misses aliased targets** — searches
   `<base>/tm/<t.name>` where the tree is `tm/<origname>` (§1, §7).
5. **CLI ref mangling** — `Jsonic(arg)` over positionals structurally
   parses Windows refs; untested CLI argument path (§3.5).
6. **`appendIndexEntries` substring matching** — `includes('@"x.aontu"')`
   is defeated by a commented-out entry; line-exact matching (§8).
7. **24 target models and all 17 feature models carry no provenance** —
   silent fallback to the bundled scaffold becomes wrong the moment names
   can come from elsewhere (§4).
8. **A typo'd ref fails late and unhelpfully** — `resolveTarget` checks
   only that `.sdk` exists, so a wrong-but-existing folder surfaces as an
   internal jostraca `ShapeError` on the first `Copy`, naming neither the
   probed locations nor the missing kind file (§3.1).
9. **The feature fan-out writes unsubstituted source.** It applies no
   replace map while the target's `tm` copy applies
   `templateReplacements`, so the same file arrives substituted or raw
   depending on which action copied it — the writer/writer disagreement
   `helpers/stdrep.ts` exists to prevent (§7.2). Latent today only
   because the fan-out cannot see the target being added; §7.4's
   sequencing fix would expose it, so it lands first.
10. **A dead `exclude: true`.** `feature_add` passes it on two
    single-file `Copy` calls where it does nothing (§15), implying a
    don't-clobber protection that is not implemented. Deleted, since
    add-is-overwrite is the contract.
11. **`ACTION_MAP` dispatches into `Object.prototype`** — a plain object
    literal, so `voxgig-sdkgen toString` passes the `null == actionFunc`
    guard (§9).
12. **An aliased target reads its ORIGIN's config at generate time.**
    *(Found during phase-1 review; NOT fixed in phase 1 — see below.)* Ten
    `cmp/go/*` components call `goModule(model, 'go')` with the target name
    hardcoded, while their neighbours correctly use `target.name`
    (`goVersion(model, target.name)`, `collectDeps(model, target.name, …)`).
    `goModule` looks up `main.kit.target.<t>.module.path`, so `go~go2`
    silently takes the origin's module path — defeating the one use the
    alias is documented for, "a second Go module with different options"
    ([reference/cli](../reference/cli.md#target-references)). Phase 1
    repairs the ADD side of aliasing; this is the GENERATE side, it predates
    that work, and fixing it means auditing every target for which `'<lang>'`
    literals are TARGET names (config lookups, which must follow the alias)
    versus LANGUAGE identifiers (format selectors like `matchArg('go', …)`,
    which must not) — and the wrapping targets legitimately name the target
    they wrap (`seneca-provider` reads `'ts'`). That audit is its own change.

---

## 17. Open questions

1. **May a package declare its own kind?** v1 says no: a kind needs a
   root component and doctor semantics a manifest cannot supply. The
   natural v2 is a package shipping a `KindDef` plus its root component
   as ordinary copied source — worth revisiting once one exists.
2. **Absolute bases are machine-local.** A `base` recorded from an
   absolute ref will not resolve on a teammate's checkout, so their
   doctor reports `missing-source`. Warn at add time, or document
   absolute installs as machine-local?
3. **Strict parsing at add time.** Does `readTargetFeature` adopt the
   strict parser (rejecting `//` in third-party files at add time, not
   just in `package check`)? It currently fails *safe* (copy everything
   on any parse error), which strictness would change.
4. **How much does `docs` as a built-in kind actually generate?** The
   registry gives it a home; the `Docs` root component's scope (per-target
   reference pages? a whole site? mkdocs/docusaurus scaffolding?) is a
   design of its own, and the first docs package should drive it.
5. **Root-wiring upgrade path.** Existing projects must add one `Kinds()`
   call to render a new kind. Is `unwired` reporting enough, or does
   create-sdkgen need a `resync-root` command? (The frozen-Root problem
   predates this design and affects every root capability.)
6. **The unread dep slot.** The base schema and every shipped target
   model declare a `feature.<f>.target.<t>.deps` slot that no emitter
   reads (`collectDeps` reads `feature.<f>.deps.<target>`); its
   `active`/`version` defaults therefore never reach consumed deps.
   Retire the slot, or wire it up? Either way `package check` flags
   concrete entries under it (§14).
7. **`package remove` / `target remove` scope** — fast-follow once
   `removeIndexEntries` exists; needs its own blast-radius note.
8. **Which bundled target migrates first?** The migration checklist
   (§14) needs a first subject; a MIRRORED-tier target with few
   scaffold-relative dependencies is the low-risk choice.
9. **A source digest, to tell "upstream moved" from "locally edited"?**
   §13 solves the ambiguity by owning the fetch ordering, which is enough
   for the supported path. Stamping a per-file digest of each source file
   at add time would make the distinction exact even after an
   out-of-band update — at the cost of a digest block in every copied
   model file, which is the churn model-only provenance exists to avoid.
   Worth revisiting only if out-of-band updates prove common.

---

## 18. Delivery phasing

1. **Live bugs & characterization** (no new user surface): the §16 list —
   alias repair, dry-run prune fix, fan-out replace map, Jsonic bypass,
   index matching, dead `exclude`, null-prototype dispatch — plus the
   golden add-output trees that gate phase 2, and the `actionharness`
   change that makes them machine-independent (§8).
2. **The kind registry**: `KindDef`/`TreeDef`/`FanoutDef`, `target` and
   `feature` redefined as registry data, one `add(kind, …)` action,
   `loadContent` index bootstrap, `ACTION_MAP` populated from the
   registry. Byte-identical output required.
3. **Provenance**: `base` anchor + `origname`/`package` stamping across
   all 27 target and 17 feature models; schema declarations +
   `make sync-model`; model-first bare-name resolution; doctor resolution
   and `resync-pending` tolerance.
4. **External sources**: `resolveSource` with the kind-aware existence
   check and the per-item `missing-source` fail-safe; the manifest and
   its validation; `package add` / `list`, including their
   `bin/voxgig-sdkgen` flag plumbing and the `action(args, flags)`
   signature (§9); bundled-scaffold manifest + exact-set guard.
5. **Features from packages & external-target trim**: feature refs;
   two-tree fan-out; consumer-side trim catalogue (§6); prune keep-set
   with fail-safe + doctor foreign-expected set; the same-run sequencing
   fix.
6. **Lifecycle & docs kind**: `package update` (fetch-owning ordering,
   forked-refusal, alias-model skip); doctor's new findings and the
   per-kind model-file comparison; the `docs` kind, `Docs` root
   component, `Kinds` dispatcher, the `kind-index.aontu` aggregator and
   `unwired` / `unreachable` reporting.
7. **Portability & ecosystem**: `package check`; the test kit; the corpus
   package; the migration checklist; docs sweep — [cli](../reference/cli.md),
   [model](../reference/model.md),
   [project-layout](../reference/project-layout.md),
   [add-a-target](../how-to/add-a-target.md) /
   [add-a-feature](../how-to/add-a-feature.md),
   [architecture](../explanation/architecture.md), `AGENTS.md`,
   `CLAUDE.md`, new how-tos *use-an-sdkgen-package* and
   *author-an-sdkgen-package*; create-sdkgen `add-package` script
   (separate repo).

Every phase lands with the existing suites green for a consumer with no
external content, and `ts/dist` rebuilt and committed alongside the
source, per repo convention.

---

## 19. Non-goals

- **A git client in sdkgen** — npm git-deps and plain checkouts cover it.
- **A lockfile** — provenance is in the model; see §4's alternatives table.
- **Sandboxing package code** — would be theater; posture stated honestly
  in §5 and the authoring guide.
- **Feature aliasing** — no customer, real blast radius (§3.4).
- **Packages declaring new kinds** — deferred, not refused (§17.1).
- **Namespace prefixing of package content** — names leak into generated
  code; collisions error instead (§10.5).
- **Central package registry/discovery** — npm keywords and docs suffice
  until there is an ecosystem to index.
