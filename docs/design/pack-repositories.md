# Pack repositories: sdkgen ships no packages

Working notes for the move from per-target packages inside this repository
to two **pack repositories**, each holding one npm package that provides
several targets.

```
voxgig/sdkgen-langpack    @voxgig/sdkgen-langpack    dart, haskell, lean
voxgig/sdkgen-infrapack   @voxgig/sdkgen-infrapack   seneca-provider
                                                     (terraform-provider, designed)
```

`packages/` is gone from this repository. So are the `dart` and `lean` trees
from the bundled scaffold.

## Why a pack rather than a package per target

The migration design assumed one package per target, and
[seneca-provider-package](./seneca-provider-package.md) argued the case for
independent release cadence. A pack trades that away deliberately, for two
reasons.

**Repository count is a real cost.** Four targets meant four repositories,
each with its own CI, its own manifests, its own README and its own
dependency drift. The targets in a pack are related — three languages, or
the provider family — and nobody has ever wanted to release `lean` without
`dart`.

**Nothing is publishable yet anyway.** No packaged target has ever reached
npm: `@voxgig/sdkgen-haskell` returns a 404. While the publish story is
unsolved, the number of artifacts needing a trusted-publishing setup is a
cost with no offsetting benefit, and fewer is the cheaper mistake to make.

The trade back: a fix to Dart bumps the version Haskell and Lean ship under.
If one of these grows its own maintainer and cadence, splitting it out is the
same move that brought it here — the machinery is per target, not per package.

**Verified, not assumed.** A package providing several targets was proven end
to end before the shape was chosen: one `package add` installs all three
target models, component trees and template trees, and generation produces
all three SDKs with no placeholder leaks. A consumer wanting one asks for it
by path — `target add @voxgig/sdkgen-langpack/dart`.

## Byte-identity, before anything moved

The cheap step that could have invalidated the plan, run per target: generate
from the bundled scaffold and from the pack, from the same model, and diff.

| target | files | differences |
|---|---|---|
| `dart` | 77 | 0 |
| `lean` | 26 | 0 |
| `haskell` | 29 | 0 (verified at its earlier move) |
| `seneca-provider` | 21 | 0 (verified at its earlier move) |

No placeholder leaks on either side, and identical warning streams.

## `dart` and `lean` are FULL tier, and moving them has a cost

The migration guide gates on this: a FULL-tier target drives the shared
`.aontu` corpus, which lives in create-sdkgen and is not published, so a
migrated FULL-tier target cannot be verified against it from a pack.

That gate was not overridden by accident. The precise position:

- The corpus is **materialised into each project** as `.sdk/test/test.json`,
  so a real generated Dart or Lean SDK still executes it. The FULL tier
  remains accurate for a consumer, which is who the tier is about.
- What is lost is verification **in the pack's own CI**. A green build there
  says the components type-check and generate; it says nothing about corpus
  conformance.

So the manifests declare `FULL` — the true tier — and both the pack README
and the migration guide say plainly that a green pack build is not a green
corpus. Downgrading the tier to match what CI happens to check would make the
manifest lie about the target, which is the failure mode the closed parity
vocabulary exists to prevent. Publishing `@voxgig/sdkgen-corpus` closes this
properly and remains the highest-value work available on parity.

## What the move found

**The type-check lane was passing on borrowed types.** Every packaged
target's components import `node:path` and read `__dirname`, and no package
declared `@types/node`. Inside this checkout they hoisted from the
generator's own devDependencies, so `packages/sdkgen-haskell`'s lane was
green while depending on something it never asked for. Standing alone in its
own repository the hoist is gone and the lane fails on sixteen errors —
exactly the class of breakage the lane exists to catch, discovered only by
moving the package out of reach of the thing propping it up.

**A removed vendoring route left a stale manifest section.** `build/vendor.js`
wrote `vendored.json` per key and never pruned, so removing `dart` and `lean`
from `routes.json` left their sections claiming files the tree no longer had.
The guard reported "vendored file is missing", which reads as a deleted
template rather than a stale manifest, and the obvious fix is the wrong one.
The tool now prunes a section no route produces — on an **unfiltered** run
only, since `--lib`/`--lang` deliberately leave unselected entries alone and
cannot tell "not selected" from "no longer exists" — and `--check` reports one
as drift.

**A pack's suite runs against the PUBLISHED generator.** There is no
`file:../../ts` across repository boundaries, and that turns out to be a
feature: a pack's CI is the thing that catches an sdkgen release breaking a
packaged target, which is otherwise discovered by a consumer, at generation
time, as a require error naming a path.

It also creates an ordering problem. The infrastructure pack's out-of-tree
tests need the test kit's `outside` option, which is newer than any published
sdkgen. They **probe** for the feature rather than comparing versions, skip
with a stated reason when it is absent, and start running the moment the
release lands. A visible skip is this project's own rule for a capability the
environment lacks; a silent pass would be the worse outcome.

**`canonType.ts` stays.** Its per-target column is public API that a packaged
target's `EntityTypes_<lang>` still calls. A shared lookup keyed by target
name is not an enumeration of what this repository ships, and stripping the
`dart` column would break the packaged target that depends on it.

## Still open

- **No publish path for any pack.** `publish.yml` builds and publishes `ts`
  and nothing else. Until that is solved, `package add @voxgig/sdkgen-langpack`
  cannot work for anyone outside these repositories — and `dart` and `lean`
  were in the box before this change, so the ordering between merging and
  publishing is a decision, not a detail.
- **CI workflows in the pack repositories** were written but could not be
  pushed from the session that made this change, which lacked GitHub
  `workflow` scope. They are carried in the pack pull requests for a human to
  apply.
- **`@voxgig/sdkgen-corpus`**, which is what would let a pack verify a
  FULL-tier target.
