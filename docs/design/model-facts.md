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
  - `main.kit.fact.top` and `main.kit.fact.build`: whether a run writes the
    root documents and the per-entity test data (WP02).
  - `target.fact.phase`: the five phases a target runs (`entity`, `feature`,
    `readme`, `agentguide`, `test`), each on unless the target's model turns
    it off. The base model declares no target phases, so the rules declare
    their defaults, for the fact pass only (WP02).
  - The escaped forms of every text a neutral document prints (WP18): the
    `escape` rule computes, for one raw text, `text`, `inline`, `cell`,
    `code`, `codecell`, `link` and `label`. Spec text (`vendor: true`) loses
    its relative links (DQ19) and its fences; `$$` becomes `$&#36;`
    everywhere. The pass supplies each raw text, from `helpers/doctext`, and
    writes the forms beside what it describes: `main.kit.fact.text.<slot>`,
    an entity's `desc`, a feature's `title` and `option.<name>.value` or
    `.type`. They cost about 170 ms of the pass with 20 targets and 20
    features, and about 0.75 s for 600 texts.
  - The escaped forms of each field's description (WP33), as
    `main.kit.fact.field.<entity>.<field>.desc`, for the fields whose `sh` is
    set. They sit beside the kit rather than the field, because the ts and
    js live tests print an entity whole. Each costs about 2 ms of the pass,
    so 5000 described fields add about 9 s.
  - `main.kit.fact.auth` (WP19): `apikey`, `suppressed`, `basic`, `in`,
    `name`, `prefix` and `secret`, each equal to the helper it is computed
    for (`isAuthActive`, `isAuthSuppressed`, `isHttpBasicAuth`,
    `resolveAuthIn`, `resolveAuthName`, `resolveAuthPrefix`). `secret` is
    Basic, header placement and not suppressed, which is exactly when every
    bundled PrepareAuth composes the secret, measured over twenty targets and
    eight auth states. The rules declare, for the pass only, an unset slot of
    `config.auth` and `info.security` as `''`, and an unset prefix as `false`,
    because `''` is a prefix a project may declare.
  - `main.kit.fact.server` (WP19): the server variables, as `serverVariables`
    lists them. A rule decides `required` from `re()` built from each
    variable's key, `key(2)` where it sits; only a word-character name can be
    one the URL uses. The pass supplies the first server as a map, declares a
    variable the URL names and the spec omits, and lists the result in the
    URL's order, then the declared order, since aontu lists no map's keys.
  - `main.kit.fact.env` (WP19): `prefix`, `apikey`, `secret`, `base`, `live`,
    a name per server variable under `server` and per entity under `entid`.
    The rule spells a token as `envToken` does, with `upper` and `rep`: aontu's
    `nom(name, 'upper')` splits a digit into a word of its own
    (`n3ds_session` becomes `N_3_DS_SESSION`), which would rename the
    variables of any project or entity whose name holds a digit.
  - `target.fact.dir` and `target.fact.sdkrel` (WP19): the directory a reader
    enters, and the path from there back to the project: `.` at the root, the
    target's name and `..` in a folder, `output.path` and `output.sdkrel` out
    of tree. An out-of-tree target that declares no `sdkrel` has it derived
    from the layout at generate, as before. Every pass gives a template the
    path as `SDKREL`, and no template names it yet.
- **What the pass computes in code**, because aontu cannot list a map's keys
  or compare package names (WP19):
  - `main.kit.fact.active`: the active targets, in key order.
  - `target.fact.tag`: the release tag before its version: `<prefix>/v` when
    `publish.tag.prefix` names one, else `v` for the one npm package the tree
    publishes or the npm package of the ts SDK, else `<target>/v`; `''` when
    `publish.tag.active` is false (WP25). The publish workflow's tag job and
    PUBLISHING table read it, and so do the root Makefile's tag recipe and
    header. The per-target Makefile templates still spell `<target>/v` until
    WP35 gives them the tag through a token.
  - `main.kit.fact.ops`: each entity's canonical operations, by entity name,
    in canonical order, action-only ones included, with no fallback. They sit
    outside the entities because the ts and js live tests print an entity
    whole into generated source.
  - `main.kit.fact.package`: the JVM package of java, kotlin and scala, and the
    Python package py and py-data import, which is jostraca's `Name` for the
    project lower-cased.
  - `main.kit.fact.option`: one row per client option in `main.kit.optspec`,
    `name` and `type`, in key order.
- **The pass** is `applyFacts` (`ts/src/helpers/facts.ts`). `generate()` runs
  it after `guardModel`, before Root. It evaluates the rules over the
  generated model, minus the entity and flow maps that no rule reads and the
  facts of an earlier pass, and copies each `fact` map into the model. An
  entity reaches the rules as its name alone: over 500 entities the pass takes
  about 1.6 s, against 0.19 s for seven.
- **The accessor** is `fact(node, name)`. It throws when the node has no
  such fact, which names both causes: the model did not pass through
  `applyFacts`, or it lacks what the rule reads.
- **The readers.** `AgentGuideFeature` reads `fact(feature, 'on')` in place
  of its own expression. The root plan's readers are testkit's default Root,
  the suite's `makeRoot`, `ExternalTarget` and `AgentGuideContent` (WP02).
- **The refusal.** `refuseRootPlan` runs in `generate()` once the run's
  out-of-tree targets are known: two targets at the project root, or one
  there while the top phase is on, are refused with the messages
  create-sdkgen's scaffold Root gives. A target that declares no `output`
  claims no place.

Generated output is byte-identical: the characterization golden
(`ts/test/characterize.test.ts`) passes unchanged. `ts/test/facts.test.ts`
holds each rule to the expression it replaces, over every bundled feature,
and checks that `generate()` applies the facts before Root runs.

With all 20 SDK targets and all 20 bundled features, the pass reads 73 KB of
model and takes 120 to 190 ms.

## The generate-time document check (WP18)

After each pass, `generate()` reads the Markdown `File` nodes of the tree it
kept and warns, as `doc-link-dangling` or `doc-table-broken`, of a relative
link that resolves to nothing the pass wrote or the project holds, and of a
table row that does not end as its header ends or holds a different number
of cells. A dry run writes no copies, so there a path under a copy's
destination counts as written. sdkgen's generate suite fails on either,
except what `DOC_PINS` in `ts/test/generate.test.ts` names: the dangling
target links of S43 to S45 (WP14), and a new finding, the nullable field
type `T | null` printed unescaped in a code span in the per-language field
tables, which the copy wave's cell escaping fixes (WP33).

U104 is settled: a fenced block in an entity description, spliced raw, is
extracted and compiled by the README example tests. Before WP18 the rb, go,
py and perl README lanes all failed on one in the root README's entity table
(`main.kit.text.entity_desc`) and on one in an entity's `short`, which the
per-language READMEs print. After WP18 the root README case passes in all
four; the per-language case still fails, because those sites are the copy
wave's (WP33). A lone run of three backticks inline failed no lane.

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
| A reference cannot name a key called `top`, which 0.76.3 reads as a keyword | fixed on aontu main | The rule quotes the key: `$.main.kit.phase."top".active` |

When aontu releases a fix, the matching workaround goes, and the rule says
what it means directly.

## What a missing input does

Each rule reads its input through `maybe()`. A model built by hand in a test
may lack the base model's slots; the fact is then absent rather than an
error, and only a component that reads it fails. A model from the base model
always has the inputs.

## Where a fact can be read

Only from a prepared model: the guards, then `applyFacts`. Today `generate()`
is the one place that prepares a model, and nothing reads a fact before it
does. A reader elsewhere prepares the model it holds the same way, first: the
actions through `resolveModel`, `admin/status.ts` and docgen's standalone run
over `sdk.json`, and `package check` over the model it compiles. The plan adds
each preparation with the first fact read there, and once `targetOrigins`
reads the active fact, `generate()` runs `warnUngeneratedOps` after the facts.

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
  rule about importing each newer export with a fallback goes. A pack that
  reads a fact declares its sdkgen floor at the release that computes it, and
  `package add` refuses it below that floor; the language pack's floor moves
  to R3 with its parity wave. docgen's standalone run imports only
  `guardModel` and `applyFacts`.
- The copy wave (R3) reads facts, so the copies call no derivation of
  sdkgen's.
- The fact pass took 4.45.0, so the plan's R1, R2 and R3 move to 4.46.0,
  4.47.0 and 4.48.0.
