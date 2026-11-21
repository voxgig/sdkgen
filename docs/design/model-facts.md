# Design: facts computed once, in the model

Status: **in progress** (2026-11-21). The fact pass and the first two facts
are released in 4.45.0; the rest follow the plan in
`docs/design/model-dependent-text-plan.md`, whose section 0 maps each
function it once proposed to the fact that replaces it.

## The ruling

The design in `docs/design/model-dependent-text.md` proposed "one answer per
fact" as exported functions, called by every writer that makes the same
decision. The maintainer's review replaced that half of the design:

> The facts should be generated once and represented in aontu, with the
> template code merely extracting them.

So a fact that generated text or code depends on is computed once, by an
aontu rule, and stored in the model. Components, templates, packs and docgen
read it; none of them computes it.

## What exists now

- **The rules** are `ts/model/fact.aontu`. Each writes a `fact` map beside
  the node it describes:
  - `feature.fact.on`: whether the feature is on by default. True exactly
    when `config.options.active` is true; an absent value reads as off, as
    `AgentGuideFeature` read it before.
  - `target.fact.place`: `root` when `output.root` is true; `folder` when
    `output.path` is empty; `external` otherwise.
- **The pass** is `applyFacts` (`ts/src/helpers/facts.ts`). `generate()` runs
  it after `guardModelNames` and `guardFlowSteps`, before Root. It evaluates
  the rules over the generated model, minus the entity and flow maps that no
  rule reads, and copies each `fact` map into the model.
- **The accessor** is `fact(node, name)`. It throws when the node has no
  such fact, which names both causes: the model did not pass through
  `applyFacts`, or it lacks what the rule reads.
- **The first reader** is `AgentGuideFeature`, which reads `fact(feature,
  'on')` in place of its own expression.

Generated output is byte-identical: the characterization golden
(`ts/test/characterize.test.ts`) passes unchanged. `ts/test/facts.test.ts`
holds each rule to the expression it replaces, over every bundled feature,
and checks that `generate()` applies the facts before Root runs.

With all 20 SDK targets and all 20 bundled features, the pass reads 73 KB of
model and takes 120 to 190 ms.

## Why the rules run over the generated model

A rule written into the project's own evaluation would see defaults, and
aontu 0.76.3 does not read a default inside a map in `filter` or `match`:

```aontu
t: &: { surface: *"sdk" | string }
t: { go: {}, ts: {} }
sdks: filter($.t, { surface: "sdk" })   # sdks: {}
```

`match` over a map with defaulted fields takes the fallback arm. Neither says
anything. sdkgen's base model declares nearly every setting as a default, so
the rules run over the generated model instead, where every default is a
value. Reported as aontu-lang/aontu#847.

## The other aontu gaps, and their workarounds

| Gap | Report | Workaround until aontu ships it |
| --- | --- | --- |
| No Markdown variant of `esc` | aontu-lang/aontu#848 | `rep` escapes a table cell: `rep(rep(s, "\\|", "\\|"), "\\n", "<br>")` |
| No fallback for a member's absent field: `match` on it is `no_path`, `maybe()` passes the absence on, a `key()` default does not generate | aontu-lang/aontu#849 | A rule reads only what the base model declares. A per-member fallback (a title, else the key) is computed by the pass in code and written into the model with the other facts |
| A `match` whose result is a relative reference overflows the stack in TypeScript | aontu-lang/aontu#850 | A rule's results are literals or absolute references |
| `key()` read through a reference from a shallower site gives a stale key | aontu-lang/aontu#463 | No rule refers to a node holding `key()` from a shallower site |
| A node cannot filter the map it sits in | by design | A fact about a collection (the targets that consume `go`) sits outside that collection, over a `copy()` of it |

When aontu releases a fix, the matching workaround goes, and the rule says
what it means directly.

## What a missing input does

Each rule reads its input through `maybe()`. A model built by hand in a test
may lack the base model's slots; the fact is then absent rather than an
error, and only a component that reads it fails. A model from the base model
always has the inputs.

## How the plan changes

Each derivation the plan adds as an exported function becomes a rule here,
with its readers moved to `fact`:

- `featureOnByDefault` (WP16) is `feature.fact.on`, built.
- `targetPlace` (WP14) is `target.fact.place`, built; `docLink`'s per-target
  links follow.
- `targetSurface` (WP13) becomes declared `surface` and `consumes` slots,
  with the consumers of each target as a collection fact.
- `requiredOptions`, the environment-variable names and the escaped vendor
  text (WP18, WP19) become facts. A rule finds which server variables a URL
  uses with `re()` built from each variable's own key (`key(2)` where the
  rule sits), which aontu 0.76.3 evaluates, so apidef needs no change for it.
- Packs and docgen read facts from the model they receive, so the plan's
  rule about importing newer exports with a fallback goes. docgen's
  standalone run imports only `guardModel` and `applyFacts`.
- The copy wave (R3) reads facts, so the copies call no derivation of
  sdkgen's.
- The fact pass took 4.45.0, so the plan's R1, R2 and R3 move to 4.46.0,
  4.47.0 and 4.48.0.
