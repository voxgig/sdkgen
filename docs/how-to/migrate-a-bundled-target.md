# How to migrate a bundled target into an sdkgen package

The §14 deliverable from [the packages design](../design/sdkgen-packages.md):
the checklist that makes the first move safe.

**This has been done once**, for `haskell` →
[`packages/sdkgen-haskell`](https://github.com/voxgig/sdkgen/tree/main/packages/sdkgen-haskell).
Everything below is written from that, not from reading the code.

A bundled target and a package target are the *same shape* — `ts/project/`
is itself an sdkgen package, which is exactly why. So migrating one is a
move, not a rewrite. What makes it worth a checklist is that a target's
identity is recorded in four places outside its own directories, and three
of them are guard tests that will fail informatively only if you move them
in the right order.

## Before you start: is this target a good candidate?

**Check what its components import.** A relative import of anything outside
the target's own directory is a scaffold-relative dependency that has to be
promoted to the public API first (§11 of the design) — otherwise the package
compiles here and fails for everyone else.

```bash
grep -rh "from '@\|require('@" ts/project/.sdk/src/cmp/<t>/*.ts \
  | sed "s/.*from '//;s/.*require('//;s/'.*//" | sort -u
```

All five MIRRORED-tier targets pass that test. What the run found instead is
the case nobody had written down:

> **A migrated target inherits sdkgen's peer dependencies as its own.**

`haskell`'s components import `@voxgig/apidef` and `@voxgig/struct` by name.
That resolved silently while the target lived beside sdkgen's own
`node_modules`, and stopped the moment it moved — fifteen `TS2307` errors
the first time its new type-check lane ran. So the package declares them,
as **peers** (a consumer necessarily has them via sdkgen, and a second copy
at a different version is the outcome worth preventing) **and** as devDeps,
so its own type-check resolves.

Run the grep above and declare whatever it prints, minus `@voxgig/sdkgen`
itself.

**Check its parity tier.** A FULL-tier target drives the shared `.aontu`
corpus, which today lives in create-sdkgen and is reachable only from
inside voxgig's own repos. Until `@voxgig/sdkgen-corpus` is published, a
migrated FULL-tier target is silently capped below its tier. MIRRORED and
UNCOVERED targets have no such dependency — which is the whole argument
for going first with one.

**Check nothing wraps it.** The consumer targets (`go-cli`, `go-mcp`,
`py-data`, `seneca-provider`) each name the target they wrap. Migrating a
wrapped target means the wrapper's package now depends on the wrapped
one's.

## The move

### 1. The three trees, moved (not copied)

```
ts/project/.sdk/model/target/<t>.aontu  ->  <pkg>/.sdk/model/target/<t>.aontu
ts/project/.sdk/src/cmp/<t>/            ->  <pkg>/.sdk/src/cmp/<t>/
ts/project/.sdk/tm/<t>/                 ->  <pkg>/.sdk/tm/<t>/
```

**`git mv`, not `cp`.** Leaving the scaffold copies in place does not
"keep it working" — it produces a project holding *both*. The bundled
`test` feature's fan-out finds source for the target in the scaffold's
surviving `tm/<t>`, treats it as an overlay over the package's, and warns:

```
feature-source-shadowed: test: both <scaffold>/tm/<t> and <pkg>/.sdk/tm/<t>
provide source for target <t>; the overlay is used, but the files already
copied from the target's own tree are NOT removed
```

That warning is the migration's own smoke alarm. If you see it after the
move, a tree did not actually leave.

### 2. The enumeration points

Most of the repo derives the target set from the model directory listing
and needs no edit. These do not — and there are more of them than the
design implies, because a target accumulates *behavioural* tests as well as
membership in closed sets:

| Where | What to do |
|---|---|
| `ts/project/sdkgen-package.json` | remove `<t>` from `provides.target`. A guard test pins this to the directory listing, so it fails until you do |
| `ts/test/parity.test.ts` | remove from `FULL` / `MIRRORED` / `UNCOVERED`, and from `RAW_ACCESS` / `NO_RAW_ACCESS`. The tier moves to the package manifest's `parity` field |
| `ts/test/featuremodel.test.ts` | remove from `SDK_TARGETS` |
| `ts/test/featuresource.test.ts` | remove from the pinned `untrimmable` list, if it is on it |
| `ts/test/generate.test.ts` | remove its rows from the data-representation and manifest-name tables |
| `ts/test/golden/add-output.txt` | regenerate with `npm run golden` |

There is **no `target-index.aontu` in the bundled scaffold** — the index is
created per consumer project by the `loadContent` bootstrap, so there is
nothing to edit there. (An earlier draft of this page said otherwise.)

The closed-set guards are your safety net, not an obstacle: parity asserts
that every SDK target appears in exactly one tier, derived from the
directory listing, so it fails loudly if you remove the tree and forget the
tier, and equally if you remove the tier and forget the tree. Let it.

### 2a. The target's own tests move with it

This is the step with real content in it. A mature target has tests that
are *about that language* — `haskell` had two, on the `.cabal` module
declaration and on `formatHsValue` key ordering, each with several
paragraphs of hard-won rationale.

Deleting them is not an option: that is coverage the target still needs.
Port them to the package's suite on the test kit, comments and all. The
mechanical differences are small — `generateInto()` returns a path→content
map instead of the in-repo harness's tuples, and a component is required
from the staged consumer's `dist/cmp/<t>/` rather than from
`dist-test-scaffold`.

The package also needs its own **fixture API model**, because the in-repo
one (`ts/test/generateharness.ts`) is not published. Keep it small; it only
has to exercise the shapes that have historically broken this target.

### 3. The package's own manifests

`sdkgen-package.json` — what sdkgen reads:

```json
{
  "sdkgen": { "package": 1 },
  "name": "@voxgig/sdkgen-<t>",
  "version": "1.0.0",
  "engines": { "sdkgen": ">=3.5.0" },
  "provides": { "target": ["<t>"] },
  "parity": { "<t>": "MIRRORED" }
}
```

`parity` is where the tier now lives. It travels with the target, which is
the point of moving it.

`package.json` — what npm reads. Beyond the usual, it needs `files`
covering `.sdk` and `sdkgen-package.json`, the peers from the screen
above, and a devDependency on `@voxgig/sdkgen` as `file:../../ts` if the
package lives in this repo, so its suite runs against the working
checkout.

### 4. The type-check lane it just lost

`check-scaffold` type-checked these components while they were bundled.
Nothing does now, and a component tree with no compile gate fails deep
inside someone's generation run as a require error naming a path rather
than a type error naming a line.

Give the package a `tsconfig.json` over `.sdk/src/cmp/**` (excluding
`fragment/**`, which is template source, not modules) and wire it into its
`test` script. This is the step that caught the peer-dependency problem
above — the first thing it did was fail.

### 5. Its own suite, on the test kit

```js
const { stageConsumer, generateInto } = require('@voxgig/sdkgen/testkit')
```

See [author-an-sdkgen-package](./author-an-sdkgen-package.md#automate-that-loop-the-test-kit).

### 6. CI

A migrated target leaves sdkgen's suites, which is also how it quietly
stops being tested. Add a step to `.github/workflows/build.yml` that
installs and tests the package against the checkout, so a change to sdkgen
that breaks a packaged target fails in this repo rather than in someone's
install.

## Verify

The bar is that a consumer cannot tell the difference. That is checkable
directly, and it is worth doing before the move rather than after:
install the target from the package into one staged consumer and from the
bundled scaffold into another, generate both from the same model, and
diff.

That comparison has been run for all five MIRRORED-tier targets:

| target | files generated | differences |
|---|---|---|
| `c` | 94 | 0 |
| `clojure` | 29 | 0 |
| `elixir` | 53 | 0 |
| `haskell` | 29 | 0 |
| `zig` | 61 | 0 |

Byte-identical, with no placeholder leaks on either side. The mechanism
works; what remains for any given target is the bookkeeping above.

Then, in a real project:

```bash
voxgig-sdkgen package add @voxgig/sdkgen-<t>
voxgig-sdkgen doctor
```

A clean `doctor` immediately after is the bar (§14). If it reports
anything, the package and the copy pipeline disagree about what should
have been written.

## What this does NOT decide

Which target migrates first is a **product** decision, not a technical
one: a migrated target is no longer in the box, and a consumer who had it
by default now needs `package add`. §17.8 of the design is open for that
reason, not for want of a recipe.
