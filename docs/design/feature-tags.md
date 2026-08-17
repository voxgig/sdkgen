# Design: feature tags — which features a target can actually take

Status: **proposal** (2026-08-17).

From `NOTES.md`, in full:

> features should have tags so that only compatible features are applied
> to a target

This note works out what that costs and what it buys, because the idea is
about to stop being optional: the package system made "a feature that does
not fit every target" the normal case, and
[station](./voxgig-station.md) is the first real package to hit it.

---

## 1. How much of this already exists

Nothing gates a feature against a target today. `feature add <f>` fans out
to **every target in the model** (`action/feature.ts`), and the only thing
that varies per target is whether source turns up:

- `findFeatureSources` (`helpers/featureSource.ts`) walks the target's
  template tree, treats any directory named `feature` as a container, and
  maps entries back to feature names. It encodes no layout, which is why a
  target added later is gated without editing that file.
- If the walk finds nothing, the add logs
  `point: 'feature-source-missing'`, one line per target, and moves on.
- `sdkgen-package.json` declares an optional `targetsSupported`
  (`helpers/manifest.ts`). **Nothing reads it.** It was deferred to
  §18.7 of [sdkgen-packages](./sdkgen-packages.md) precisely because the
  reader did not exist yet.
- Six targets declare `feature.trim: false` — clojure, haskell, lean,
  ocaml, scala, zig.

### What the bundled scaffold actually looks like

Measured against the shipped tree (`findFeatureSources` over every
`tm/<target>` for every `model/feature/*.aontu`):

| | |
|---|---|
| targets | 27 |
| features | 17 |
| (feature, target) pairs | 459 |
| pairs with no source | **17** (4%) |
| targets accounting for those 17 | **1** — `seneca-provider` |

That single number is the whole argument in miniature. `seneca-provider`
is a consumer target: it wraps the `ts` SDK and delegates to it, so it
will **never** carry feature source, for any feature, ever. Every feature
added to a project that includes it prints a `feature-source-missing`
warning that is structurally, permanently wrong.

So the warning already has a 100% false-positive rate on the one bundled
target where it fires. It is just quiet enough — one target, one line —
that nobody has had to care.

---

## 2. The problem: one warning, three different meanings

`feature-source-missing` fires in three situations that a reader has to
tell apart and currently cannot:

1. **Deliberate and permanent.** `seneca-provider` delegates to the SDK it
   wraps. There is nothing to ship and never will be.
2. **Deliberate and temporary.** Station defers adapters for haskell,
   clojure, ocaml and lean because those four hold all feature code in one
   monolithic module that an external package cannot safely overlay
   ([station §9.1](./voxgig-station.md)). That is a decision with a
   documented reason and an exit condition.
3. **An authoring mistake.** The package meant to ship source for this
   target and the file is misnamed, or in a container the walk does not
   recognise, or was left out of `files`.

Only (3) is actionable, and it is the one that looks identical to the
other two. The failure mode is the ordinary one for a noisy diagnostic:
a project with a few packages installed learns to scroll past the warning,
and then (3) arrives and gets scrolled past too.

The consequence of a missed (3) is not cosmetic. `add` is overwrite, so a
feature that silently shipped no source leaves the target with a feature
declared in its model, an options block in its generated config, and no
implementation behind it.

### Why now

Both of the things that make this urgent landed or were designed in the
last few weeks:

- **Packages.** A bundled feature could reasonably be expected to cover
  every bundled target — and, per §1, essentially does. An external
  package has no such obligation and no way to acquire one: its author
  cannot ship source for targets that did not exist when they published.
- **Station.** It is a feature, shipped as an external package, that by
  design does not fit six targets in two distinct shapes. It would emit
  category-(2) warnings on day one.

---

## 3. The shape: tags on both sides

A feature declares what it **needs**; a target declares what it
**provides**; a feature applies to a target when `needs ⊆ provides`.

```
main: kit: feature: retry: needs: ['transport-wrap']
main: kit: target: go: provides: ['transport-wrap', 'hooks', 'deps', 'per-feature-file']
```

### Why tags and not a target list

The obvious cheaper design is for a feature to name its targets:
`targets: ['ts', 'js', 'go']`. It fails on the axis that matters — time.
A named list has to be edited whenever a target is added, **including
targets the feature's author has never heard of**, which for a published
package is every target added after its release. The list is therefore
permanently stale in the one direction that produces false negatives: a
new target gets no features until every package is republished.

A tag is a claim about the feature that stays true as the target set
grows, paired with a claim about the target written by the person adding
it. Each side is maintained by whoever actually knows, and a new target
picks up every compatible existing feature the moment it declares what it
provides.

`targetsSupported` in the manifest then stops being hand-written. It
becomes the **materialised result** of the tag comparison — useful to
display, wrong to author.

### The vocabulary must be closed

A free-form tag string is a second name for the problem: two authors spell
the same capability differently and nothing matches. The vocabulary is a
fixed set in the base schema, extended by a schema change and nothing
else.

It should start at the smallest set that separates cases already named in
existing docs, rather than at a guess about what features might one day
want:

| tag | means | who lacks it today |
|---|---|---|
| `per-feature-file` | a new file in the target's feature container is picked up without editing anything else | haskell, clojure, ocaml, lean (one monolithic feature module); zig and scala need edits to static reference points (station §9.1) |
| `deps` | the target's `Package_<lang>` component consumes `collectDeps`, so a feature can flow a dependency into the generated manifest | haskell, clojure, elixir, ocaml, lean, scala (station §9.2); c, cpp, zig have no registry at all |
| `transport-wrap` | the transport seam can be wrapped, which is how retry/proxy/netsim work | — |
| `hooks` | the target dispatches the pipeline hooks a feature can attach to | — |
| `delegates` | this target implements no features itself; it wraps another target's SDK | `seneca-provider`, and the consumer targets generally |

`delegates` is the one that earns its place immediately: it turns §1's 17
false warnings into zero, today, with no other machinery.

Two of the rows have an empty "lacks it" column on purpose. A tag whose
answer is currently "everyone" is not yet load-bearing, and adding it now
is speculative — they are listed because station's design already
distinguishes them, not because this proposal needs them on day one.

---

## 4. What changes

- **Model.** `feature.<f>.needs` and `target.<t>.provides`, both defaulting
  to empty. An empty `needs` means "applies anywhere", so every existing
  feature keeps its current behaviour with no edit — the change is additive
  by construction.
- **`feature add` / `package add`.** A target that does not satisfy a
  feature's needs is **skipped**, and says so once at info level naming the
  unmet tag. `feature-source-missing` then fires only for a target that
  *should* have had source — recovering it as the actionable signal it was
  meant to be.
- **`package check`.** A feature whose `needs` no installed target
  satisfies is an error, not a warning: the package ships something that
  cannot apply anywhere, which is almost always a typo in a tag name. And
  `targetsSupported`, if present, must agree with what the tags derive —
  the manifest stops being a second source of truth (§18.4a's stated
  worry).
- **Doctor.** Nothing. Add is still overwrite and provenance is unchanged;
  a skipped target simply has no feature files to compare.
- **Generated config.** A skipped feature must not appear in the target's
  embedded config either. This is the part to get right: a feature listed
  in the config with no implementation behind it is the exact hybrid state
  §2 says the warning exists to prevent.

---

## 5. Interaction with `trim`

`feature.trim: false` and a `provides` tag look adjacent and are not the
same thing. `trim` answers *may `target add` remove this feature's source
from the copied tree?* — a question about the copy. A tag answers *can
this target take this feature at all?* — a question about applicability.

zig and scala are the case that keeps them apart: both are `trim: false`,
both **can** take a new feature file, and both need edits to static
reference points when one arrives (`root.zig`/`build.zig`,
`SdkTestMain.scala`). So they lack `per-feature-file` while being
perfectly capable of carrying features — which is why the tag is named for
the mechanism and not for the tier.

---

## 6. Testing

- The existing feature suites are the regression bar: with no `needs`
  declared anywhere, `feature add` output must be **byte-identical**, and
  the characterization golden must not move. That is the gate on the
  change, the same way byte-identical output gated the kind registry
  (§18.2).
- A fixture feature declaring a tag no fixture target provides: asserted
  skipped, asserted absent from the generated config, asserted not
  warned about as missing source.
- `seneca-provider` tagged `delegates`: the 17 warnings measured in §1 go
  to zero, and this is worth pinning as an explicit count so a regression
  is visible rather than merely noisy.
- `package check` over a package whose feature needs an unprovided tag.

---

## 7. Open questions

1. **Does a tag mismatch skip, or refuse?** Skipping is right for
   `package add` (install what fits). For an explicit
   `feature add retry` naming one feature by hand, silence is arguably
   wrong — the operator asked for something specific and did not get it.
   Refusing that spelling while skipping the fan-out spelling is
   defensible but is two behaviours for one verb.
2. **Who owns a bundled target's `provides`?** It is scaffold data, so it
   travels with the target model — but §14's migration checklist has to
   move it along with the parity tier, and that checklist does not exist
   yet.
3. **Does `needs` belong per-target?** A feature might apply everywhere but
   need `deps` only where it has a runtime dependency. A single flat
   `needs` cannot say that. Per-target overrides would, at the cost of
   being a second dispatch table.
4. **Interaction with the unread `feature.<f>.target.<t>.deps` slot**
   (§17.6 of sdkgen-packages). Both are per-(feature, target) declarations
   that nothing reads. Whichever gets wired first should probably absorb
   the other rather than sit beside it.
5. **Does station wait for this?** Station phase 1 is ts/js only, where
   every tag is satisfied, so it does not strictly block. But phase 2
   fans out across tier A and phase 3 reaches the four deferred targets,
   which is exactly where the category-(2) warnings land.

---

## 8. Non-goals

- **A capability model for generated SDKs.** These tags describe what the
  GENERATOR can do for a target, not what the resulting SDK can do at
  runtime. Nothing here reaches generated code.
- **Feature dependencies** (`retry` needs `log`). A different relation
  between different things; conflating them would make the tag set do two
  jobs.
- **Author-defined tags.** The vocabulary is closed (§3) — an open one
  cannot be checked, and an unchecked tag is a comment.
- **Retiring `feature-source-missing`.** The point is to make it mean
  something, not to remove it.
