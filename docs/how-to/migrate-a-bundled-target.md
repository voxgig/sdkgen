# How to migrate a bundled target into an sdkgen package

The §14 deliverable from [the packages design](../design/sdkgen-packages.md):
the checklist that makes the first move safe.

A bundled target and a package target are the *same shape* — `ts/project/`
is itself an sdkgen package, which is exactly why. So migrating one is a
move, not a rewrite. What makes it worth a checklist is that a target's
identity is recorded in four places outside its own directories, and three
of them are guard tests that will fail informatively only if you move them
in the right order.

## Before you start: is this target a good candidate?

**Check what its components import.** Anything beyond siblings and
`@voxgig/sdkgen` is a scaffold-relative dependency that has to be promoted
to the public API first (§11 of the design) — otherwise the package
compiles here and fails for everyone else.

```bash
grep -h "^import\|require(" ts/project/.sdk/src/cmp/<t>/*.ts \
  | sed "s/.*from //;s/.*require(//" | sort -u
```

All five MIRRORED-tier targets (`c`, `clojure`, `elixir`, `haskell`,
`zig`) pass this today: siblings, `@voxgig/sdkgen`, and `node:path`.

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

### 2. The four enumeration points

Everything else in the repo derives the target set from the model
directory listing and needs no edit. These four do not:

| Where | What to do |
|---|---|
| `ts/project/.sdk/model/target/target-index.aontu` | remove the `@"<t>.aontu"` line |
| `ts/project/sdkgen-package.json` | remove `<t>` from `provides.target` — a guard test pins this to the directory listing, so it fails until you do |
| `ts/test/parity.test.ts` | remove `<t>` from `FULL` / `MIRRORED` / `UNCOVERED` **and** from `RAW_ACCESS` if present; the tier declaration moves to the package manifest's `parity` field |
| `ts/test/golden/add-output.txt` | regenerate with `npm run golden` |

The parity suite asserts that every SDK target appears in exactly one
tier, derived from the directory listing — so it fails loudly if you
remove the tree and forget the tier, and equally if you remove the tier
and forget the tree. Let it.

### 3. The package's own manifest

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

`parity` is where the tier now lives. It travels with the target, which
is the point of moving it.

### 4. Its own suite, on the test kit

The in-repo suites no longer cover this target — that is what migrating
means. Replace them from the package side:

```js
const { stageConsumer, generateInto } = require('@voxgig/sdkgen/testkit')
```

See [author-an-sdkgen-package](./author-an-sdkgen-package.md#automate-that-loop-the-test-kit).

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
