# Migrating `seneca-provider` into `packages/sdkgen-seneca-provider`

Working notes for the second migration out of the bundled scaffold, and the
first migration of a CONSUMER target. `haskell` answered §17.8 of
[sdkgen-packages](./sdkgen-packages.md) and produced
[how-to/migrate-a-bundled-target](../how-to/migrate-a-bundled-target.md);
this move tests that checklist against a target it was not written from,
and three of its instructions turn out to be haskell-specific.

## Why this target, and why no language target can go instead

`ts/test/parity.test.ts` now declares `MIRRORED: string[] = []` and
`UNCOVERED: string[] = []`. Every one of the 22 bundled language targets is
FULL — they all drive the shared `.aontu` corpus.

The migration guide's candidate check says to pick a MIRRORED or UNCOVERED
target, because a FULL-tier target that moves is silently capped: the corpus
lives in create-sdkgen and is reachable only from inside voxgig's own repos
until `@voxgig/sdkgen-corpus` is published (§18.7 item 1, still open). That
constraint has not changed. What changed is that the pool it selected from is
now empty. **No language target can migrate today** — not for want of a
recipe, but because the guide's own gate excludes all of them.

The four consumer targets — `go-cli`, `go-mcp`, `py-data`, `seneca-provider`
— are in a different position. `parity.test.ts` lists them in
`NON_SDK_TARGETS` and they appear in no tier set at all; they are not
measured against the shared corpus, so there is nothing for a move to cap.
They are the only viable candidates, and that is a fact about the corpus
gap rather than a judgement about their maturity.

Among the four, `seneca-provider` is the most decoupled. It is the only
target of any kind that already generates into **its own repository**
(`main: kit: target: 'seneca-provider': output: path`, handled by
`cmp/ExternalTarget.ts`); the other three emit a subfolder of the SDK repo.
A target whose output is already a separate release artifact with its own
cadence is the one whose *definition* has the least to lose by living in a
separate package with its own cadence. The long comment at the top of
`ts/project/.sdk/model/target/seneca-provider.aon` makes that case in the
target's own words.

## Verified before the move: generation is byte-identical

The guide says to prove this first, because it is the cheap step that can
invalidate the whole plan, and it had been done for five MIRRORED language
targets and no consumer target. Done here on the test kit: a candidate
package staged as a **copy** of the three bundled trees, two staged
consumers, the same compiled model, `['ts', 'seneca-provider']`.

| | files under `seneca-provider/` | only in one side | differing |
|---|---|---|---|
| bundled scaffold | 21 | — | — |
| candidate package | 21 | none | none |

Byte-identical. The placeholder scan reports the same single known mention
on both sides (`ts/src/feature/test/AGENTS.md: ProjectName`, which belongs
to the `ts` target and is pinned in `generate.test.ts`), and the generator's
warning stream is identical too. `voxgig-sdkgen package check` on the
candidate returns no findings.

Two things that comparison does **not** cover, stated so they are not
mistaken for covered:

- **The out-of-tree pass.** The diff was run with `output: path` unset, so
  the target generated in-tree. That is not a gap in the evidence: `sdkrel`
  — the only value in the generated provider that depends on where its
  destination is — comes from `ctx$.sdkrelpath`, which `sdkgen.ts` computes
  from `output.path` / `output.sdkrel` in the core, never from the target's
  provenance. Where the target's definition lives cannot reach it.
- **The `feature-source-shadowed` warning.** It did not fire, because the
  candidate is a copy and the bundled tree is still in place, so both
  consumers see one tree each. The warning is the *post-move* smoke alarm
  the guide describes, and it can only be observed after the `git mv`.

## Correction 1: the guide's peer-dependency instruction is wrong here

The guide gives this candidate check and says to declare whatever it prints,
minus `@voxgig/sdkgen`:

```bash
grep -rh "from '@\|require('@" ts/project/.sdk/src/cmp/<t>/*.ts \
  | sed "s/.*from '//;s/.*require('//;s/'.*//" | sort -u
```

Run over `seneca-provider` it prints:

```
@seneca/maintain
@voxgig/apidef
@voxgig/sdkgen
```

Following the instruction literally would put `@seneca/maintain` in the
package's `peerDependencies`. That would be wrong, and the interesting part
is *why* — it is not a judgement call about whether Seneca packages are
peers.

**`@seneca/maintain` is not an import of these components at all.** The hit
is at `Extras_seneca-provider.ts:382`, inside the `Content(\`…\`)` template
literal that emits the *generated provider's* test file. The component does
not require it; the code the component writes does. It is already declared
where it belongs — as a `prod` dependency of the generated package, in
`model/target/seneca-provider.aon`'s `deps` block — and it must not appear
in the sdkgen package's manifest in any role.

The grep cannot tell the two apart, because a generator's components are
mostly strings containing other languages' source. It is a *text* search
being read as an *import* list. For `haskell` the two happened to coincide;
for a target that generates a Node package they systematically do not, and
this target emits four `require` lines of Seneca framework code that the
grep will report every time.

So the guide's wording needs to change from "declare whatever it prints" to
"the grep is a starting point; the declaration is the module's real
top-level imports". The real imports here are:

| module | imports |
|---|---|
| `Main_seneca-provider.ts` | `@voxgig/sdkgen`, `@voxgig/apidef`, two local siblings |
| `Extras_seneca-provider.ts` | `@voxgig/sdkgen` |
| `Gitignore_seneca-provider.ts` | `@voxgig/sdkgen` |

which makes the package's peers `@voxgig/sdkgen` and `@voxgig/apidef`, and
nothing else. Note it needs no `@voxgig/struct` — haskell's third peer is
haskell's, not a property of being migrated.

The consequence the brief anticipated is real, just reached by a different
route: following the guide literally produces a package that will not
install cleanly, because it declares a peer no consumer has any reason to
supply.

## Correction 2: the manifest's `parity` field, for a target that has no tier

`sdkgen-package.json` for haskell carries `"parity": {"haskell": "MIRRORED"}`
and the guide presents that field as where a migrated target's tier now
lives. A consumer target has no tier: `parity.test.ts` puts the four of them
in `NON_SDK_TARGETS` and excludes them from `FULL` / `MIRRORED` /
`UNCOVERED` entirely. So there is nothing to carry, and the choice is
between omitting the field and extending its vocabulary.

**Decision: declare `"parity": {"seneca-provider": "CONSUMER"}`, and make
the vocabulary closed.**

The reasoning is the repo's own, stated in AGENTS.md: the closed-set guards
exist because *silently absent* was the failure mode that let five targets
mirror the corpus undetected. An omitted `parity` field is exactly that
shape. It is indistinguishable from an author who did not know the field
existed, and the two cases want opposite responses — one is correct and one
is a defect. `CONSUMER` says the same thing `NON_SDK_TARGETS` says in the
bundled world: *this target is outside the tier system, deliberately.*

It is worth being precise about what the value is. `CONSUMER` is not a
fourth tier alongside FULL/MIRRORED/UNCOVERED, which grade corpus coverage.
It is the marker for a target that is not graded, and it is the honest
answer for one — a consumer target has no primary-utility suite to have a
tier about, because it has no utility layer.

A declaration nothing checks is the field this repo has already been burned
by (`engines.sdkgen` says so in its own comment). So the vocabulary becomes
closed where an author meets it: `package check` reports a `parity` value
outside `FULL | MIRRORED | UNCOVERED | CONSUMER`, and a `parity` entry for a
target the package does not provide. Both are cheap, and both turn a typo
into a finding rather than into silence.

## Correction 3: "requires target `ts`" has nowhere machine-readable to go

`Main_seneca-provider` throws when the `ts` target is absent — deliberately,
as every consumer target does. Once the definition lives in a package, that
is a cross-package dependency: `@voxgig/sdkgen-seneca-provider` needs
something the *bundled* scaffold provides.

The direction is safe. Package → bundled means installing the package can
never leave a project short: `ts` is in the box, and a project that has the
provider without `ts` is a project that removed `ts`. Nothing here creates a
cycle or a resolution order to get wrong.

But there is no field for it. `Manifest` in `helpers/manifest.ts` carries
`provides`, `targetsSupported` (features → targets) and `parity`, and
nothing that says *this target requires that one*. So the requirement is
stated in the package README and enforced where it already is — at
generation, by the throw, which names the missing target.

A `requires` field is the obvious follow-up and is deliberately **not** in
this change. It would need a validator, a `package add` check, an error
message, and a decision about whether an unsatisfied requirement is a
warning or a refusal — and it wants more than one consumer target migrated
before its shape is decided from evidence rather than from this one case.
Recorded here so the next migration does not have to rediscover the gap.

## The test split, which is the real work

`ts/test/external.test.ts` is 691 lines and mentions `seneca-provider` 57
times, which reads like a large body of Seneca coverage to move. It is not.
Reading the assertions, essentially all of it tests the **out-of-tree output
mechanism** — a generator feature — using `seneca-provider` as its vehicle,
because it was for a long time the only target that had an `output.path`:

- files land at the destination and not in the SDK repo;
- a relative path resolves against the SDK project, not the CWD;
- the SDK repo's own root files do not follow the target out;
- two external targets do not contaminate each other;
- components resolve from the project, not from the destination;
- dry run, `output.create: false`, `output.adopt`, `output.sdkrel`;
- every destination guard (inside/containing/equal to the project, two
  targets claiming one folder, unrelated content present).

None of those is about Seneca. The strongest Seneca-shaped assertion in the
file is that `src/demo-provider.ts` exists — used as proof that component
resolution stayed with the project, for which any target's output would do.

**So the suite stays in sdkgen and is re-pointed at another target with an
external path.** The mechanism's coverage must not leave with the target it
happened to be written against — that would be the migration quietly
deleting a generator feature's test suite.

`go-cli` is the substitute, not `go`. The first draft of this note said
`go` — bundled, FULL-tier, already the second destination — and running it
showed why the SHAPE of the output matters more than the target's standing.
Out of tree, `go` emits a whole SDK: 100-odd files including a `README.md`
and an `AGENTS.md` of its own. Half the suite's assertions are of the form
"the SDK repo's own root files did not follow it out", and against `go`
they stop meaning anything — the target legitimately emits files with those
names. `go-cli` emits seven files with its own README, its own `go.mod` and
no agent guide, which is `seneca-provider`'s shape, so the assertions
transfer intact.

Three changes it forced, each an improvement on what was there:

- **Root files are compared by CONTENT, not by filename.** The old
  assertion was `!rootFiles.includes('AGENTS.md')`, which passed only
  because the vehicle emitted none — it would have passed for the wrong
  reason the moment the SDK's own guide was renamed. It now asserts that
  the file out there is not the SDK's.
- **The two-destination test needed a real discriminator.** It told the two
  packages apart by `package.json` versus `go.mod`; `go-cli` and `go` are
  both Go modules, so it now uses a file only one of them emits
  (`main.go` from `Main_go-cli`, `core/config.go` from the SDK's
  components). The manifest would have asserted nothing.
- **`.jostraca/` was missing from `go-cli`'s ignore file** — see below.

What genuinely moves is what the brief did not name, and it is not in
`external.test.ts` at all. Two suites drive `seneca-provider` components
directly:

| suite | drives | lines |
|---|---|---|
| `ts/test/recordkey.test.ts` | `recordKey` from `Main_seneca-provider.ts` | 90 |
| `ts/test/seedrecord.test.ts` | `seedRecord` from `Extras_seneca-provider.ts` | 97 |

Both transpile the real shipped component with sucrase and call the function
under test. They are exactly the "behavioural tests a mature target
accumulates" that §18.7 records as the enumeration surprise from the haskell
move, and they are the target's coverage — they go to the package, with
their rationale comments intact, ported to the test kit the way haskell's
two were.

(`ts/test/ownidfield.test.ts` matches a grep for "seneca" but drives
`tm/ts/src/feature/test/TestFeature.ts`. It stays.)

## The enumeration points

Derived from the tree except where listed. Bigger than the guide's table,
again because behavioural membership accumulates:

| where | what |
|---|---|
| `ts/project/sdkgen-package.json` | remove from `provides.target` |
| `ts/test/parity.test.ts` | remove from `NON_SDK_TARGETS` |
| `ts/test/featuremodel.test.ts` | remove from `CONSUMER_TARGETS` and `NO_FEATURE_DIRS` |
| `ts/test/generate.test.ts` | remove from `NON_SDK_SIBLING`; the gitignore-is-generated test moves to the package |
| `ts/test/generatedcompile.test.ts` | remove from `AUTHNULL_NOT_APPLICABLE` |
| `ts/test/external.test.ts` | re-point at `go-cli` (above) |
| `ts/test/recordkey.test.ts`, `ts/test/seedrecord.test.ts` | move to the package |
| `ts/test/golden/add-output.txt` | regenerate |
| `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/reference/cli.md`, `docs/reference/project-layout.md`, `docs/how-to/add-a-target.md`, `docs/explanation/architecture.md`, `docs/explanation/out-of-tree-targets.md` | the target lists |

`ts/test/manifest.test.ts` mentions the name as a *name-grammar* fixture
(a hyphenated item name that must validate). That is not enumeration and it
stays — the grammar it pins is unaffected by where the target lives.

`docs/explanation/out-of-tree-targets.md` needs more than a list edit: it
explains the mechanism through this target, so it has to keep explaining the
mechanism while pointing at a target that is no longer in the box.

## What the implementation found that the plan did not

Four things, each recorded because the next migration meets them too.

### The test kit could not express out-of-tree generation at all

`generateInto` THROWS on any generated path outside the consumer root — a
good guard, and the exact reason it exists is a Windows path bug where the
root and the prefix being stripped diverged. But `output: path` writes
outside the root by design, so a package whose target's defining mode is
out-of-tree could not test that mode through the kit.

Loosening the guard would have been the wrong fix: a path under neither the
root nor a destination is still a bug. So the caller DECLARES its
destinations instead — `generateInto(consumer, { model, outside: ['../x'] })`
— and the result carries an `outside` map per destination alongside `files`.
A path under neither still throws, with a message that now names the option.
The placeholder scan runs over both views, which matters more than it looks:
a package whose whole output is external would otherwise have reported
`leaks: []` while scanning nothing.

This is sdkgen's change, not the package's. The migration is what surfaced
it, because it created the first packaged target that generates out of tree.

### The `sdkrel` test had to split, and the seam was already there

`external.test.ts` asserted that a declared `output: sdkrel` reaches
generated CONTENT. No bundled target can carry that assertion: the only
component that has ever read `ctx$.sdkrelpath` is `Main_seneca-provider`.
Substituting a target that ignores the value would have left an assertion
that passes while testing nothing — the worst outcome available.

The split is at the real seam. The core's job ends at computing the value
and handing it to the pass, and that whole decision surface is observable in
the log without any target's cooperation: derive-and-warn, derive-cleanly,
and declared-so-do-neither. Those stay in sdkgen. The content half moved to
the package, next to the component that consumes it.

### Every target but one is missing `.jostraca/` from its ignore file

Re-pointing the "the destination ignores the generator bookkeeping" test
failed immediately: `go-cli`'s generated `.gitignore` does not ignore
`.jostraca/`. Nor does any other target's. `seneca-provider` was the only
one that did — which is why the test passed for as long as it was the
vehicle.

It matters only out of tree, and any target can be put there: jostraca
drops its meta log and a full duplicate of the last generated output at the
output ROOT, and the destination is a repository nothing in the SDK repo's
own ignore file covers. So the first regeneration leaves it dirty with
hundreds of untracked files.

`go-cli` is fixed here, because the test that now drives it requires it.
**The other 21 targets are not**, and that is a deliberate scope line rather
than an oversight: it is a fleet-wide one-line change to 21 `Gitignore_<lang>`
components plus their golden hashes, which would bury the migration it was
found by. It should be its own change.

### The stale-compiled-test trap

`git rm`-ing a `*.test.ts` leaves its compiled `dist-test/*.test.js` behind,
and `npm test` globs the compiled tree — so the moved suites went on running
from stale JavaScript against components that were no longer there, and
failed. Deleting the compiled files is the fix. Worth knowing before reading
the failure, which names a missing component rather than a stale artefact.

## What this move does not settle

Whether the other three consumer targets follow. `go-cli`, `go-mcp` and
`py-data` are all wrapped-target packages with the same safe dependency
direction, but they generate in-tree and so have none of this one's
independent-release argument. Their case should be made on their own terms,
after this one has been through a real consumer.
