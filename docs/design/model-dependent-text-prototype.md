# Prototype: the generated text written once, measured

Status: **final record** (2026-11-17, fourth version). Nothing here ships,
and nothing here is implemented on `main`. This record covers a prototype
built from sdkgen `main` at 9aebaf9e (4.44.0) to test the proposal that
answered the review of `docs/design/model-dependent-text-plan.md`. All
twenty bundled languages are ported, each one reviewed, fixed and verified
by people who had not ported it, and version 3.4 of the interface is
frozen at them (section 2.1). Two engineers who built none of it then
measured the twenty-language state and attacked it. The verdict follows
the table below.

Since the third version: the last seven ports (js, php, cpp, csharp, java,
kotlin, scala) were made, reviewed, fixed and verified; an integration put
all twenty languages, the catalogue edits and the migration structures
into one state, made the shared changes the seven asked for (eleven made,
the rest recorded with a reason) and froze version 3.4; an independent
measurer took H1, H2, H3 and H5 at twenty and re-counted the interface
changes from the code history; and an independent attacker re-ran every
freeze check, read every changed sentence that no one but its author had
read, and attacked the new ports. Where those two disagree with the
integration, this record follows them, and says so.

What is genuinely not done is in section 8. In short: seven of the twenty
languages were never compiled; the shared changes the integration recorded
and did not make; the fix for the shared sentence the attack found false
in 17 runtimes, which no one has made; one migration bypass still open
and several migration states not re-run at the final state; and
everything an adoption on `main` would still have to build.

The design note this answers is `docs/design/model-dependent-text.md`; the
issues it was measured against are in
`docs/design/model-dependent-text-issues.md`. The prototype's clones,
records, review tools and scripts are working files and are not in this
repository. Paths of sdkgen's own files are given as they are in the
repository; line numbers are at the commit the record names, which is
usually not `main`.

Who did what is given by role. The **builder** built a stage. The
**porter** ported one language by following the porting guide. The
**reviewer**, the **checker** and the **verifier** were independent: they
had not built what they read. The **integrator** merged the last state and
froze it, and was a builder. The **measurer** and the **attacker** of the
twenty-language state were independent of everything they measured or
attacked. A number marked *ran* came from a command;
a number marked *read* came from reading code or pages. OLD is the
generated output of `main` at 9aebaf9e; NEW is the prototype's output for
the same models.

### Where each hypothesis stands

This table is a summary of the verdict below and of sections 3 and 4, and
adds nothing to them. The hypotheses and what would refute each are in
section 1.3.

| | Standing at version 3.4 (twenty languages) | Section |
|---|---|---|
| H1 | **Refuted** on the interface criterion: 44 breaking changes after the first four languages (25 to the provider interface, 19 to the forms framework the guard reads), by an independent re-count from the code history, against a limit of about 10; the newly ported languages alone caused 9 to 11 of them. Not crossed on the other two: no provider reads the model (0 open findings in all twenty), and per-language prose is at most 7.1% by source and 14.8% by the "printed by this language alone" measure (go, both) | 3.1 |
| H2 | **Refuted** on every count that includes what each language must write for its facts to be checked: 1.54x with the forms, 1.20x with the guard, at twenty (independent, ran). Only documentation code counted alone passes 2x, by 3% (2.06x), and only at twenty; at nine and at thirteen every count was under 2x | 3.2 |
| H3 | **Not refuted**: by the brief's rule 2.8% to 5.6% of the 36 in-scope catalogue entries still need a per-language edit at twenty (independent, ran), against a limit of about 10%. But one fix written once prints a sentence that is false in 17 of the 20 runtimes, and every check passed it; charged to its entry, the share is 5.6% to 8.3% by the brief's rule and 8.3% to 11.1% on the strict reading, over the limit only at the top of the strict range | 3.3 |
| H4 | **Not refuted**: holds in the thirteen languages with a toolchain here, where every example lane passes on NEW (integrator, re-run identically by the attacker). Not shown in full: seven languages (csharp, scala, swift, lua, clojure, elixir and ocaml) were never compiled, and the lanes compile their own models and miss a dropped import or swapped arguments | 3.4 |
| H5 | **Not refuted**: packs keep generating, and every unsafe state found traces to one rule; each has a local fix but one. Not shown as built: one silent bypass is open (a provider that takes the interface constant by a deep import), and the remedy recorded for it is ruled out by sdkgen's own `package.json`; and the fix for a release that skips its list makes `doctor` fail a documented extension | 3.5 |
| Reach | Not a hypothesis of the brief, but the maintainers' first question. Not a general solution to the catalogue: the mechanism reaches 66 of 329 entries (20%; 58 to 70 across the open borders); 81 (25%) are already written once, 46 of them needing a derivation the proposal does not supply; it does nothing for 175 (53%) | 4 |

---

## Verdict

The five hypotheses were fixed before anything was built (section 1.3).
For each, below: the claim, the criterion as fixed, the figures at twenty
languages with who measured them and whether they were run or read, and
one word. **Refuted**: the criterion is crossed. **Holds**: it is not
crossed and the claim is shown. **Not refuted**: the criterion is not
crossed, but the claim is not fully shown. **Not decided**: the evidence
does not settle it. None of the five is "not decided". Where the
independent measurer or the attacker differs from a builder's figure, the
verdict follows the evidence that survived, and says so.

The finding that matters most for every verdict below came from the
attacker, and every check the prototype built had passed it. A sentence that
shared code writes once, "- Also attaches to pipeline hooks.", prints
under the `secrets` feature on every REFERENCE page. Shared code writes it
because the feature's model declares a `PreSpec` hook. Only ts, js and py
define that hook; the other seventeen runtimes resolve the secret at the
transport, and several say so in their own comments (csharp: "NO PreSpec
OVERRIDE, deliberately, though the model declares the hook"). The sentence
is false in 17 of the 20 languages. The guard, the review tools, the
catalogue checker and the integration all passed it; the integration
accepted it for the seven new languages by a written rule, without reading
their runtimes. The second half of the same finding: a porter who leaves
out an optional fact (the stream signal in csharp, java, kotlin and scala;
the deleted mark in js) loses a true sentence from every page and passes
everything, and leaving out two others (php's cached accessor, cpp's
remove that keeps its data) brings back a sentence already known to be
false for that runtime, shown only by one open class that a person
decides. The rule the prototype adopted after its first wave, that a wrong
or vanished sentence must fail in the guard or the tools before any person
reads it, does not hold at the frozen state.

### H1. One shared component plus one provider per language

- **Claim.** The README quick start and the REFERENCE page can be written
  as one shared component plus one syntax provider per language, for all
  20 languages.
- **Criterion.** Refuted if providers for 3 or more languages have to read
  model facts or carry model-dependent conditions; or per-language prose
  that cannot be shared exceeds about 15% of the sections' prose; or the
  provider interface needs more than about 10 breaking changes after the
  first four languages.
- **At twenty.** Model reads in providers: 0 open findings in all twenty, 41
  accepted with reasons (measurer, ran). Per-language prose over three
  sections and 21 variations: at most 7.1% by source and 14.8% printed by
  one language alone, both go (measurer, ran); within single sections the
  "alone" measure is far over 15% (go's tutorial 33.5%, the root quick
  starts of c, ts and perl over 92%), all of it shared sentences that one
  runtime's declared style selects. Breaking changes since the first four
  languages: 44, of which 25 to the provider interface and 19 to the forms
  framework the guard reads; the newly ported languages caused 9 to 11 of
  them, 6 to 7 in the first wave of ports and 3 to 4 in the second
  (measurer, re-counted from the code history: ran over the type history,
  read in the commits).
- **Verdict: refuted**, on the interface criterion, at 2.5 to 4.4 times the
  limit (25 counting the provider interface alone, 44 with the forms
  framework). The integrator counted 4 breaking changes caused by the last
  seven languages and none to the provider types; the measurer and the
  attacker each found the interface field of the migration round to be
  breaking in effect (a provider without it is served the previous interface
  and loses sentences, and all seven new providers had to add it), and the
  re-count found guard tightenings that earlier records left out. The
  verdict follows the re-count. The other two criteria are not crossed,
  although the `secrets` sentence above is shared code reading a model fact
  where a runtime fact was needed.

### H2. The source shrinks at least 2x

- **Claim.** The source shrinks substantially.
- **Criterion.** Refuted if less than 2x fewer lines for those sections.
- **At twenty** (measurer, ran, with the arithmetic the base builder used
  at thirteen, unchanged). Documentation code: 15,038 lines before, 7,285
  after, 2.06x (2.14x without the 259 lines of shared migration
  machinery). With the forms files the guard reads: 9,780, 1.54x. With the
  shared guard: 12,520, 1.20x. The tools' own headline (keeps
  `ReadmeTop.ts`, counts the forms, leaves the guard out): 1.50x. The
  thirteen languages recomputed at this state: 1.71x, 1.33x, 0.97x.
- **Verdict: refuted.** The criterion counts "lines for those sections",
  and in the structure tested from version 3 on each language supplies a
  forms file beside its provider and hook, without which its declared
  facts are checked by nothing (section 1.1). Counted with the forms the
  source shrank 1.54x, and 1.20x with the shared guard: under 2x. Only
  documentation code counted alone passes, by 3% (2.06x), and only at
  twenty languages: at nine and at thirteen every count was under 2x, the
  thirteen recomputed at the frozen state give 1.71x, and the twenty came
  in lower than both projections made earlier (2.16x and 2.26x). The
  independent checker at version 3 and the builder at 3.2 judged H2 on
  the counts that include the forms; this record keeps that reading
  rather than move to the one count that passes in the round in which it
  first does. Read on documentation code alone, H2 would be not refuted,
  by 3%.

### H3. Catalogued issues fixed once, for every language

- **Claim.** The catalogued issues in those sections are fixed once, for
  every language.
- **Criterion.** Refuted if more than about 10% of them still need a
  per-language edit.
- **At twenty.** The catalogue checker over all 26 variations and all
  twenty languages exits 0: none of the checked defects shows on NEW
  (measurer, ran; the integrator ran 25 of the 26). The seven last ports
  added one provider line each for S13 and no line for any other entry. Of
  the 36 in-scope entries that are fixed or due: 34 by shared code alone,
  S13 by one declared fact per provider, D26 half (its rows for `extend`
  and `utility` need a declared fact per runtime). Per entry: 2.8% to 5.6%
  by the brief's rule, 5.6% to 8.3% strict, 16.7% to 19.4% on the
  strictest reading, which counts the type printers the brief exempts; per
  distinct defect, 3.4% to 6.9%, 6.9% to 10.3% and 13.8% to 17.2%
  (measurer, ran; unchanged from thirteen).
- **Verdict: not refuted.** The criterion is not crossed by the brief's
  rule on any count, but "fixed once" is not shown: the `secrets` sentence
  came from the shared edit that fixed X3, every check passed it, and the
  catalogue checks are word patterns: the H3 checker put six defects back
  in other words and all six checks passed them, and of seventeen such
  attempts by the builder of the catalogue edits the broader checks missed
  seven (sections 3.3 and 5.1). Charged to X3 as needing a declared fact
  per runtime, the share is 5.6% to 8.3% per entry by the brief's rule
  (6.9% to 10.3% per distinct defect, at the line at most) and 8.3% to
  11.1% per entry (10.3% to 13.8% per distinct defect) on the strict
  reading, over the line only with D26's open half counted against (this
  record's arithmetic).

### H4. Examples still compile and run

- **Claim.** Examples still compile and run.
- **Criterion.** Refuted if an example test fails, in a language with a
  toolchain here, for a reason intrinsic to the approach.
- **At twenty** (integrator, ran at the frozen commit; the attacker re-ran
  every NEW lane with identical results). ts 16/16, go 12/12, py 12/12, c
  6/6, rust 6/6, rb 49/49, zig 6/6 and cpp 6/6 in the repository's lanes;
  perl and php in three models, three runs each, exit 0; java: every block
  of three models compiles (24, 19, 19) and runs as OLD does under the
  test constructor; kotlin: 0 errors in three models, through the Kotlin
  compiler in gradle's offline cache; js: 24/24, 17/17 and 17/17 programs
  run as written (OLD 20, 13, 13).
- **Verdict: not refuted.** It holds in those thirteen languages: no example
  test fails there. The failures the last wave found (js's mixed module
  forms, which OLD shares; java's `Map.of` with a null; kotlin's missing
  import in one variation; scala's comparison of an object with a primitive;
  csharp's duplicate local name in 5 of 21 root quick starts) were each a
  printer choice or a naming decision, fixed inside the interface or by an
  optional fact; the scala and csharp ones were read, not compiled. Seven
  languages were never compiled, the lanes compile their own models rather
  than the 21 review variations, and some lanes are blind to a dropped
  import or swapped arguments (section 3.4), so the claim is not shown in
  full.

### H5. Existing projects, packs and aliases move safely

- **Claim.** Existing projects, packs and aliases can move to it safely.
- **Criterion.** Refuted if retiring per-language components cannot be
  made safe for `doctor`, `remove`, `target add` and `package update`
  without breaking their rules, or a pack's targets stop generating.
- **At twenty.** The measurer rebuilt the fixtures from scratch (the
  earlier ones had been deleted) and re-ran the rows and states it could
  rebuild, with the three states the second attack had found unsafe:
  every row re-run has its earlier verdict;
  the edit equal to an older release is now kept, and a release that skips
  its retired list is now caught at release and by `doctor`; a project
  with all twenty targets upgrades with its 60 retired copies removed and
  its 40 pages and root README equal to a fresh project's (ran). The
  language pack's suite passes against the frozen state, 74 of 76 with 2
  skipped, and its targets generate (attacker, ran). Providers written for
  the previous interface keep generating, with a warning.
- **Verdict: not refuted.** Packs keep generating, and every unsafe state
  found traces to one rule; each has a local fix but one. As built it is not
  safe throughout: a provider that takes the interface constant by a deep
  import passes every later raise unread (open; the remedy recorded for it
  is ruled out by sdkgen's own `package.json`, no other was tried, and its
  effect at a raise was never run); the fix for a skipped list makes
  `doctor` fail a consumer target's own component, which the repository
  documents as a safe extension (attacker, ran); and an interface raise,
  restored files and a pack across a raise were not re-run at the final
  state.

### The maintainers' first question

The maintainers asked whether the proposal is a general solution or a list
of individual fixes. On the evidence, it is neither alone. It is a general
mechanism for one part of the problem, the per-language documentation
text, and at twenty languages it worked there: of the 36 catalogue entries
in the three sections built, 34 were fixed by shared code alone for all
twenty languages, and a correction made once reached every page. But it is
not a general solution to the catalogue. Its mechanism reaches 66 of the
329 entries (20%); a quarter of the catalogue is already written once and
needs shared derivations of facts the proposal assumes and does not
supply; and just over half is consumer writers, generated source, the
generator's tools, docgen, create-sdkgen, apidef and the language pack,
which stay individual fixes (section 4). And writing a sentence once makes
it a claim about twenty runtimes: the build kept finding shared sentences
that were false for some runtime, the last of them false in 17, and the
checks it built do not see that kind of error. The principle that spans
more of the catalogue is the one the proposal's first point restates, one
resolved answer per fact read by every writer; writing each sentence once
is that principle's documentation half.

### What this means for the plan

The plan is `docs/design/model-dependent-text-plan.md`. What follows is
what the records show about each part of the proposal, what each cost in
the prototype, and where the evidence stops. It recommends nothing the
records do not show. Every part was built and measured together with the
others; none was tried alone.

| Part of the proposal | What the evidence supports | What it cost in the prototype |
|---|---|---|
| Names taken from the code generator's own naming functions (the naming hook) | Supported. 0 model reads in all twenty providers; documentation and code agree on names, which corrected wrong class and accessor names on `main`'s pages (U34's class names; php's `GraphQl()`, which calls another method) | 22 to 34 lines per language (22 to 26 in the seven last ports, by the measurer; 22 to 34 across all twenty by a line count of the frozen clone made in the check of this record); naming functions extracted from generator components in py, clojure, elixir, ocaml, php, java, kotlin and scala, which marks those components outdated in existing projects; several generator components still restate the extracted rule inline (kotlin 18 sites, scala 8, php's test templates) |
| Shared sentences over one resolved description, with a syntax provider per language, for the three sections | Supported for those sections, with a condition: 34 of 36 in-scope entries fixed by shared code alone at twenty; six catalogue entries fixed by one shared edit each with no language file touched; documentation code 2.06x smaller (1.54x counting the forms). The condition: one of those six edits wrote a sentence false in 17 runtimes that every check passed, so a shared sentence is fixed once only if someone reads it against every runtime | In the seven last ports, a provider of 148 to 204 lines and a hook of 22 to 26, against 709 to 753 lines deleted; shared documentation code 2,840 lines; a port took a porter from under an hour to about 4 hours, then a review, a fix round and a verification each (untimed); every changed shared sentence reopens classes in every language (752 in the thirteen languages then ported, for one round of eleven sentences) and needs reading against all twenty runtimes |
| Runtime facts declared by each language and checked against its source (the guard) | Needed: undeclared or unchecked facts printed false sentences on every page (six wrong facts in six languages at 3.1). Not sufficient: omitted optional facts, a token that stands in an unrelated quoted line, and a sentence derived from a model fact the runtimes contradict all pass; the accessor check had silently judged nothing in six languages until the last wave's reviews found it | Forms files of 2,495 lines (mean 125 per language) and a shared guard of 2,740 lines; review tools with a 285-control self-test; 55 to 135 hand decisions per language in each REFERENCE. None of the guard, forms or tools is in the repository |
| A stable provider interface | Not supported: 44 breaking changes after the first four languages, 9 to 11 caused by new languages, and each wave of runtimes needed new facts | A layer that serves the previous interface: about 70 shared lines, 2 to 6 lines per breaking change, and a person deciding at each raise how each change is served; it serves one previous version only |
| Retiring per-language components in existing projects | Supported with conditions: safe in every measured state but the ones named under H5 | The package ships fingerprints of every released version of each retired file (150 files at twenty), and every release must regenerate them (a test checks the list against the release tags); the structures added about 730 lines and removed 116, tests included, on top of the lifecycle change (about 280 lines with its tests) and the first migration round (about 280); generic to any per-target component, not only documentation |
| The proposal as the plan's design principle for the whole catalogue | Not supported (section 4) | Ported for every README family, 2 of the plan's 46 packages would disappear and 9 would shrink; 35 stay, among them the text guard and the derivations (WP03, WP19), which any approach needs |

Where the evidence stops. Three sections were built, not the other ten
README families, two of which (Install and Explanation) were found to be
about one language rather than shared text. Every page came from one
demonstration model and 21 variations of it. Seven languages were never
compiled. Nothing was measured over time: whether a shared change stays
cheap once the tools stop needing re-aimed controls is unknown. The guard,
the forms, the review tools and the hand records are working files of the
prototype, not code a maintainer could run today; an adoption would have
to bring the guard and the forms into the repository's tests and replace
the review tools with something its CI can run. Nothing was merged on
`main`, and no pack was carried across a real release.

---

## 1. What was tested

### 1.1 The proposal

The README and REFERENCE of the twenty bundled languages were written by
about 260 per-language components (about 36,000 lines) against 16 shared
ones (about 2,200 lines). About three quarters of the prose lines were the
same sentence in at least 15 languages once identifiers were set aside, so
each sentence was written about twenty times and each copy decided for
itself when it applied. The proposal, as first stated, was "write each
sentence once; a language supplies syntax, never facts". After two stages
it was restated, and this is the form tested from version 3 on:

> The model decides what is said, once. A language supplies how its runtime
> spells it, and nothing a language supplies can see the model.

Concretely:

- **Shared** (in `ts/src/cmp/`): one resolved description of the SDK per
  target, computed once from the model (constructor, entities, operations,
  ids, features and defaults, layout); a language-neutral representation of
  examples (statements and expressions); one shared component per section
  that writes every sentence once and conditions it once on the
  description; sentence builders per result style.
- **Per language** (in `ts/project/.sdk/src/cmp/<lang>/`), three things:
  1. a **naming hook** (`Naming_<lang>.ts`) that calls the code generator's
     own naming functions, so that the documentation and the code agree on
     every name;
  2. a **syntax provider** (`Syntax_<lang>.ts`): printers (a constructor
     call, a method call, an import, an error-handling block, a signature)
     and a table of **declared facts** about the runtime (how a failure
     shows, what a getter returns, whether a stream reads lazily), plus a
     few counted **runtime notes** for what only that runtime does;
  3. the **forms** the guard reads (`ts/test/runtimeforms/<lang>.ts` in the
     prototype, a test file; neither it nor the guard exists on `main`): how
     to find declarations in that runtime's source, and where each declared
     fact is cited.
- **A runtime difference is data.** A runtime that lacks a capability
  declares it, and the shared sentence follows. There is no per-language
  paragraph.

### 1.2 The sections and languages under test

Three sections: the README tutorial (the quick start in each language's
README), the root README quick start (one block per language in the SDK
repository's top README), and the REFERENCE page. The REFERENCE's features
part (`ts/src/cmp/ReadmeRefFeatures.ts`, `FeatureDocs.ts`) was already
shared on `main`; the prototype did not port it as a section, but changed
some of its lines and, in the catalogue round, fixed six catalogued
entries in it with one shared edit each (section 3.3). The other ten README
families (install, errors, how-to, explanation and others) were analysed
but not built.

The twenty bundled SDK languages: ts js go py php rb lua csharp java kotlin
scala swift rust c cpp zig perl clojure elixir ocaml. The consumer targets
(go-cli, go-mcp, py-data) and the language pack (dart, haskell, lean) were
out of scope for porting; the pack was used for the migration test.

### 1.3 The hypotheses, fixed before anything was built

These are the words of the brief that started the prototype. They were not
changed afterwards.

| | Claim | Refuted if |
|---|---|---|
| H1 | The two sections under test (the README quick start and the REFERENCE page) can be written as one shared component plus one syntax provider per language, for all 20 languages | providers for 3 or more languages have to read model facts or carry model-dependent conditions; or per-language prose that cannot be shared exceeds about 15% of the sections' prose; or the provider interface needs more than about 10 breaking changes after the first four languages |
| H2 | The source shrinks substantially | less than 2x fewer lines for those sections |
| H3 | The catalogued issues in those sections are fixed once, for every language | more than about 10% of them still need a per-language edit |
| H4 | Examples still compile and run | an example test fails, in a language with a toolchain here, for a reason intrinsic to the approach |
| H5 | Existing projects, packs and aliases can move to it safely | retiring per-language components cannot be made safe for `doctor`, `remove`, `target add` and `package update` without breaking their rules, or a pack's targets stop generating |

The root README quick start was added to "the README quick start" in the
second stage; H1 and H2 have been measured over all three sections since.

---

## 2. How it was tested

### 2.1 The stages

Each stage was built by one or more builders and then, in most stages,
checked by someone who had not built it. Version numbers name the frozen
provider interface: version 2 after the second stage, 3 after the third,
then 3.1, 3.2 and 3.3 after each fix round, and 3.4 at the integration of
all twenty languages.

| # | Stage | What it built | Builders | Independent check that followed |
|---|---|---|---|---|
| 1 | Core | The description, the example representation, a shared tutorial quick start, providers for ts, go, py and c; 19 model variations with a reason-tagging diff | 1 builder | A checker rebuilt both clones and reproduced the numbers; a porter attacked the interface with zig and clojure; a builder measured migration (H5); an analyst read the REFERENCE as it was |
| 2 | Interface version 2, root quick start | Naming hooks for 6 languages; declared runtime facts replacing English fragments; the root quick start through the same providers | 1 builder | A checker with own scripts and lanes |
| 3 | Shared REFERENCE | The REFERENCE page for ts, go, py, c, zig | 1 builder | A checker; a porter ported rust and elixir through all three sections; an analyst read the other ten README families |
| 4 | Interface version 3 | Interface 3 for the eight ported languages; the review tools; the guard rebuilt on per-language forms; clojure's REFERENCE; a porting guide; then rb ported from the guide alone (the pilot) | 3 builders, 1 porter | A checker: "not ready" |
| 5 | First fix round (3.1) | The guard accounts for every declared fact; shared fixes; review tools that accept nothing by a broad pattern; merge and freeze at nine languages | 3 builders, 1 merging builder | A checker: "not ready" |
| 6 | Second fix round (3.2) | Every kind of fact gets a kind of check; shared code stops supplying runtime values by default; reader sees throws, receivers, fields, stream timing | 3 builders, 1 merging builder who built none of the parts | The merging builder re-ran the previous check's attacks end to end |
| 7 | First wave of ports | perl, swift, ocaml, lua, each from the guide alone | 4 porters | Per language: a reviewer, then a fixer, then a verifier |
| 8 | Sentence review | All 297 distinct shared sentences read against the runtimes | 3 reviewers | (it was itself the check) |
| 9 | Sentence fix round | Sound sentence identity in the tools; each false sentence fixed once; a survey of all twenty runtimes by ten readers | 2 builders, 10 survey readers | A verifier: "ok: false" |
| 10 | Merge and freeze (3.3) | The four ports and the sentence fixes merged; fourteen shared decisions made once; guard and tools holes closed; frozen at thirteen languages | 1 merging builder, 3 builders, 1 freezing builder; 1 tools builder in parallel | The freezing builder re-ran every earlier attack; no separate checker yet |
| 11 | Base for the last seven | The tools round that ran beside the freeze merged onto the frozen tools; the thirteen re-run under them; the measures at thirteen; porting guide 3.3 and the instruction files for porter, reviewer, fixer and verifier | 1 builder, 1 guide writer | No separate check; the thirteen re-run byte-identical to the freeze and the full self-test passed |
| 12 | Measurements at 3.3 | H3: every catalogue entry against the three sections. H5: existing projects, packs and aliases on the real structure. The catalogue by class (section 4) | 1 builder each for H3 and H5; 4 classifiers for the catalogue | H3: an independent checker. H5: an independent attacker. The classes: a checker on a sample it had seen, then a second classifier on a blind sample |
| 13 | Catalogue shared edits | The six in-scope entries left unfixed and D26's in-section half, one shared edit and one commit each, each with a test that fails before it; four residues fixed or decided | 1 builder (resumed after a machine restart) | None at the time; the attacker of stage 18 read every sentence it changed |
| 14 | Migration structures | Retired copies recognised without the copy record; a provider written for the previous interface served instead of refused | 1 builder | An independent checker: 3 of 19 new states unsafe, each with a local fix |
| 15 | Second wave of ports | js, php, cpp, csharp, java, kotlin and scala, each from the base and guide 3.3 | 7 porters | Per language: a reviewer, then a fixer, then a verifier. All seven reviews: accept with fixes. Verified ok: js and php; the other five each fail only on a shared change they recorded |
| 16 | Integration and freeze (3.4) | All twenty languages, stage 13 and stage 14 in one state; eleven shared changes the seven asked for, the rest recorded with a reason; the three local migration fixes; frozen at twenty languages | 1 integrating builder | The integrator re-ran every check; then stages 17 and 18 |
| 17 | Measures at twenty | H1 prose and purity, H2 lines, the sentences, H3 over all 26 variations, H5 rebuilt from scratch, and the interface changes re-counted from the code history | 1 independent measurer | (it was itself a check) |
| 18 | Attack on the frozen state | Every freeze check re-run; every changed sentence that only its author had read, read against the runtimes; each shared decision reverted to see whether a test fails; 43 new attacks on the guard, 28 through the one command, 11 dropped-sentence attacks, and the old mutation sets again | 1 independent attacker | (it was itself the check) |

Stage 10's freeze is the interface the last seven ports start from: sdkgen
tag `v33-frozen` (0065f1e2), unchanged in the base. The review tools in the
base are tag `base33` (a3fd3b8): the frozen tools (`v33-frozen-tools`,
d3b258d) plus five commits of the tools round that ran beside the freeze,
one merge conflict in a control file resolved by keeping both sides, and
two controls re-aimed at text the freeze had re-wrapped. That round's sixth
commit (225a0de, its regenerated class records) was left out, and the
class records were regenerated instead (base builder, ran). The H3 and H5
measurements ran on `v33-frozen`; the H5 builder's own tool changes are on
a branch of it and are not in the base.

Stage 16's freeze is the state every figure at twenty refers to: sdkgen
tag `v34-frozen` (89387a4f, from `v33-frozen`) and review tools tag
`v34-frozen-tools` (e55846e, from `base33`). The catalogue edits, the
migration structures and the seven ports merged with no textual conflict.
Two settlements were needed: each of the seven new providers had to
declare `interface: '3.3'`, because the migration round serves a provider
that declares nothing as the previous interface, with fewer sentences (one
commit per language); and every language's hand records had to be
re-keyed, because the reference set of the review tools grew from nine
languages to twenty and moved every class id (0 conflicts, no hand entry
lost). The migration round's version commit was left out, so the frozen
package reports 4.44.0, the same number as the old build; the copy logic
works on fingerprints, and the measurer found the rows behave as they did
at 4.45.0. The integrator read the 28 reports of the second wave through a
digest and targeted look-ups, not line by line, as its own report says.

### 2.2 The rule each round added, and what forced it

The method changed as the checks found what it let through. Each rule
below still holds.

| After | Rule added | What forced it |
|---|---|---|
| Stage 1 | Names come from the code generator's own naming functions; a provider may print one complete program; runtime facts are declared, structured and counted; decisions leave providers; the migration change is part of the build | Stage 1 reached "providers read the model 0 times" by copying reserved-word lists and naming rules into providers; go's runnable program was dropped as "structure"; "100% shared prose" was reached partly by deleting true facts |
| Stage 2 | The principle is restated (section 1.1); a sentence ledger, a per-block classification and guard coverage become required measures | Sharing relocated per-language prose into shared code; shared sentences were false for some runtimes; a reason-tagger reported "0 unexplained" by section and hid every zig field type becoming `any` |
| Stage 4 | No layer may accept something because of the section it sits in or because a broad pattern matched it | Classification rules accepted injected false sentences automatically; the note lint had never found a note; the guard caught 27 of 52 mutations |
| Stage 5 | Every fact a page prints is checked by something other than its writer, and the kind of check follows the kind of fact (table below); shared code never supplies a runtime value by default; the reader sees every dimension a page states | A wrong value in a "language" or "convention" fact hid behind the mask; shared code printed `false` for perl's `ok`, which perl sets to `0`; the reader could not see swift `throws`, static constructors, ocaml fields or real stream timing; a dropped sentence left no trace in a new port |
| Stage 8 | A sentence is reviewed once only if the tools can tell what "the same sentence" is: one template, one id, one verdict; a token is masked only where a language or the model supplied it; a false sentence is fixed once and must be true of all twenty runtimes; a changed sentence has no verdict until someone else reads it | 14 false sentence ids; shared words masked as model names; one template counted as many sentences |
| Stage 7 reviews | What a porter can decide by hand is not a check. A wrong fact, a missing call or a vanished sentence must fail in the guard or the tools first, naming it. A page that is wrong because shared code cannot say the true thing records a defect and stays failing | Pages wrong while every check passed (perl's lost import path, `HASH(0x...)`, shared sentences false for lua and ocaml); checks a wrong port passed, caught only as open classes the porter then decided |

The second wave added no rule. The attack on the frozen state found that
the stage-7 rule does not hold there: an omitted optional fact or a
sentence written from a model fact can make a page wrong with every
mechanical check passing (the verdict, and section 5.2).

The kinds of fact and their checks, from stage 5 on:

| Kind of fact | Its check |
|---|---|
| derived | the guard re-derives it from the runtime's own declarations |
| cited, a code token | the guard requires the token inside a quote of a runtime file |
| cited, an absence ("cannot be cancelled") | a search over the runtime that must stay empty (over the whole runtime since 3.3) |
| cited, prose | pinned to the audited value; counted; a reviewer audits each one |
| language or convention | nothing in the runtime shows it, so it is compared with the old page of that language, or a person records why it changed |
| a sentence | reviewed once as a sentence; where the reference languages print it, a language that does not is flagged |

### 2.3 What "ported" means

A language is ported when one command (the portcheck) passes for it. The
command builds the clone, regenerates 21 model variations (one baseline and
twenty single-switch variations: Basic auth, a templated server, an
operation removed, no test feature, nested entities, and others), and runs:

- **the guard**: a test that reads the language's runtime source through
  its forms file and fails, naming the fact, when a declared fact is not
  derived from or cited in the runtime;
- **purity**: the provider and hook read no model and contain no naming
  rule of their own;
- **the review tools**: every sentence, table cell, heading, comment and
  code block of the three sections, OLD against NEW, split into classes;
  every class must be decided (identical, a named correction, a shared
  sentence already reviewed, or a hand record with a reason), and no
  shared sentence may vanish without a reason; from the base for the last
  seven on, the tools also report a sentence absent or dropped in any one
  variation, and a page check reads numbers, articles, headings and step
  counts;
- **fact attestation**: a "language" or "convention" fact must be attested
  on the old page or recorded by hand;
- **staleness checks**: the build is current, and no hand record quotes text
  that has left the page and the source.

A **hand record** is a person's decision on one class, with a reason. At
3.4 every language has between 14 and 28 tutorial, 0 to 4 root and 55 to
135 reference hand decisions (at 3.3, the thirteen had 14 to 28, 0 to 3
and 36 to 73); the eight languages ported before the pilot also carry rule
records from earlier rounds (appendix A). A mode that
ignores hand records ("from scratch", as for a language with no old page)
cannot pass for any port; it exists to see what the mechanism alone catches.

The repository suite (without the slow toolchain lanes), the golden test
and the documentation lanes run beside it.

### 2.4 The environment

This is a fact about the machine the prototype ran on, not about the
repository. Present: node 22 and node 24, tsc, go, python3 (with pytest
found later as a separately installed tool), ruby with bundle, php with
composer (composer could not fetch PHPUnit within 300 s, so php ran under a
stand-in test case), perl, javac with mvn, rustc with cargo, gcc and g++.
Zig 0.16.0 was provided from the first fix round on. Missing throughout:
lua, busted, dotnet, kotlinc, scala and sbt, swift, clojure, elixir,
ocaml, ghc, dart, lean.

So, of the twenty languages, examples could be compiled or run here for
thirteen: ts, js, go, py, php, rb, perl, java, c, cpp, rust and zig with
their own toolchains, and kotlin through the Kotlin 2.2.0 compiler already
in gradle's offline cache (the kotlin porter found it; kotlinc itself was
missing, and nothing was downloaded). They could not for seven: csharp,
scala, swift, lua, clojure, elixir and ocaml. When the guide for the last
seven was written, the guide writer's check found php 8.3, composer,
javac, mvn, gradle, g++ and make present, and kotlinc, kotlin, scala,
scala-cli, sbt and dotnet missing (ran); the porters' own checks agreed,
and the scala fixer found no Scala compiler jar anywhere on disk.

The documentation lanes that exist on `main` are uneven: the java and cpp
README example tests check structure only, js has none, the swift test
checks that delimiters balance, and perl's runner rewrote every block
before running it (changed in 3.3, section 3.4). php's README example test
removes the page's own `require_once` and requires the SDK by an absolute
path (`ts/project/.sdk/src/cmp/php/ReadmeExamplesTest_php.ts:304-318`;
guide writer, read), the same blind spot perl's runner had; php's root
import is path-relative, like perl's `use lib`. The csharp lane "the project
builds" returns a pass when dotnet is missing instead of skipping visibly
(csharp verifier and attacker, read), so the one csharp lane counted as
passing ran nothing. No lane runs the scala examples.

---

## 3. Results, hypothesis by hypothesis

The verdict is given before section 1. This section gives the evidence
behind it: for each hypothesis, the figures at version 3.4 (twenty
languages) beside the earlier ones, with who measured them, and the
history that led there. A figure that a later round replaced is kept only
as history and marked as such.

### 3.1 H1: one shared component plus one provider per language

H1 has three refutation criteria. They stand differently.

**Criterion 1: providers reading the model. Not crossed at twenty.**

| When | Model reads in providers | Who | How |
|---|---|---|---|
| Stage 1 | 0 in ts, go, py, c, but reached by copying naming rules into providers (c copied its reserved set and identifier rule, zig its reserved set, py derived the module from the name). Under a strict reading 3 or more providers crossed the line | independent | ran (count) and read |
| Stage 2 (v2) | 43 hits in six providers before naming hooks, 1 after (a c array subscript judged a false positive) | independent | ran |
| Stage 4 tools, on the providers as stage 3 left them | 36 open findings: a `v + 's'` plural in all 8 hooks, `Name + 'SDK'` in 7 | builder | ran |
| 3.1, 3.2 | 0 open in all nine | builder; confirmed by the 3.1 checker | ran |
| 3.3 | 0 open in all thirteen; rb and perl carry path-join allowances with reasons | builder | ran |
| Base for the last seven (3.3, tools merged) | 0 open in all thirteen; accepted findings with reasons: 1 to 4 per language (clojure and elixir 4, rust 3) | base builder | ran |
| 3.4 (twenty) | 0 open in all twenty; 41 accepted with reasons: the thirteen exactly as at the base, and js 1, php 2, csharp 1, java 8, kotlin 1, scala 2, cpp 1 | independent measurer; the same counts with and without the allow list | ran |

The naming hook is what made this hold: the documentation calls the same
functions the code generator calls. That needed naming functions the
generators did not yet have (py, clojure, elixir, ocaml), extracted from
their components; for ocaml an independent reviewer generated a whole OCaml
SDK before and after and found only README.md and REFERENCE.md differ.

The second wave extracted more such functions from generator components
(php's SDK file name, java's core and entity subpackages, kotlin's and
scala's core package and literal tables). java and scala are the first
providers to import example-literal helpers from outside the printing
helpers; each is the language generator's own literal table, which its
code generators call too, and the measurer read them as not model reads
(read). The java provider had first carried a literal table of its own,
which lost the generator's rule for a member whose only type is null and
printed `Map.of("z", null)`, which throws at run time; only the repository
suite caught it, and the fixer replaced the copy with the generator's
table (section 3.4). Several generator components still restate an
extracted rule inline: kotlin's core package in 18 sites, scala's in 8,
php's SDK file name in 8 test templates (verifiers, read). Nothing checks
that a hook's module name matches the package its templates declare:
moving kotlin's client class to another package left every page's import
false with every check passing (kotlin reviewer, ran).

The criterion counts providers. The attacker found shared code reading a
model fact where a runtime fact was needed: the `secrets` sentence of the
verdict comes from the feature model's hook declaration, which 17 runtimes
contradict. That is not a provider reading the model, so it does not cross
the criterion as worded; it is the proposal's fourth point ("a runtime
difference is data") not applied where it mattered, and fixing it
truthfully means a declared fact in 17 providers or no sentence.

**Criterion 2: per-language prose over about 15%. Not crossed at twenty by
either measure over the three sections (crossed for go's REFERENCE at
version 3, and for go by the "alone" measure until the reference set grew
to twenty).**

Two measures were used, and they answer different questions.

- *By source*: the words of the page that come from literals in the
  provider (its notes and the prose values in its fact table).
- *Printed by this language alone*: words in sentences no other ported
  language prints. This counts shared sentences that only one runtime's
  declared style selects (go's pair-return style, swift's wrapped style,
  c's error slot), so it is an upper bound, not a count of provider prose.

| Language | By source, 3.2 | Alone, 3.2 | Alone, after the identity fix (stage 9) |
|---|---|---|---|
| ts | 0.4% | 14.7% | 11.3% |
| go | 7.4% | 22.6% | 18.6% (10.1% over the 19 variations go shares) |
| py | 0.2% | 3.0% | 2.5% |
| c | 1.3% | 9.9% | 6.3% |
| zig | 4.5% (4.4% at stage 9) | 4.8% | 0.1% |
| clojure | 2.8% | 2.8% | 0.4% |
| rust | 1.2% (0.5% at stage 9) | 5.9% | 1.4% |
| elixir | 0.8% | 5.0% | 0.7% |
| rb | 0.2% | 4.7% | 2.5% |

Three sections, 21 variations. The 3.2 column was measured by the merging
builder; the stage-9 column by the independent verifier at tag `v33s` (the
frozen state of the sentence fix round, stage 9). For the four first-wave
ports, by source (porter, reproduced by reviewers): ocaml 7.3%, lua 4.3%,
perl 1.8% (978 of 54,375 words, of which notes 846), swift 0.6%. Their
"alone" figures are high (swift 92% of the root quick start, 35.6% of the
tutorial) because their result styles are printed by no other language; the
ocaml reviewer showed ocaml's 21.4% tutorial figure to be a masking
artefact.

What each measure did not measure: by source cannot see per-language prose
that was moved into shared code and is selected by a fact only one runtime
declares. The independent checker of stage 3 measured that relocation on
the REFERENCE (shared-template words only one runtime uses: go 29.1%, ts
17.7% of the part of the page each language used to write). The "alone"
measure, after the verifier recounted by page at `v33s`, found 77 sentences
printed by one language, of which 9 are a runtime's own fact, 15 printer
output, 1 a declared fact as a heading, 50 shared code one condition
selects, and 2 on no page.

*At thirteen languages.* The base builder measured both again over the
thirteen, three sections, 21 variations, under the merged tools (ran; the
pages are byte-identical to the freeze's). "Alone" here is against all
thirteen, so a sentence another ported language prints no longer counts,
which lowers most figures against the nine-language columns above.

| Language | By source | Alone, against thirteen | | Language | By source | Alone, against thirteen |
|---|---|---|---|---|---|---|
| ts | 0.4% | 8.2% | | rust | 0.5% | 1.4% |
| go | 7.2% (REFERENCE 7.4%) | 17.0% (tutorial 57.1%) | | elixir | 0.8% | 0.5% |
| py | 0.2% | 2.4% | | rb | 0.2% | 0.0% |
| c | 1.3% | 6.2% | | perl | 1.7% | 7.9% |
| zig | 4.3% | 0.1% | | swift | 0.6% | 8.2% |
| clojure | 2.8% | 0.4% | | ocaml | 5.5% | 0.4% |
| | | | | lua | 4.1% | 11.0% |

Notes are the largest part of the by-source figure: go 7.0%, ocaml 5.1%,
lua 3.7%, zig 3.3%, clojure 2.4%, perl 1.5%, the rest under 0.5%. In the
source, the shared templates hold 980 prose-literal words; provider notes
run from 0 to 45 words (go 45, lua 40, ocaml 31). Only go is over 15% by
the "alone" measure.

Sentences at the base (base builder, ran): against the nine reference
languages the tools keep, 235 distinct shared sentences, 231 with a
verdict (the other 4 are the ones the freeze changed), 107 printed by one
language only (tutorial 34, root quick start 4, REFERENCE 69; by language
go 28, ts 23, c 17, elixir 13, the rest 1 to 6). The builder read the 28
of those the tools could not explain: result-style sentences (go's pair,
c's error slot), table headers and cells, go's bold step leads and code
comments, all shared code one style selects, none a provider's own
sentence. Against all thirteen as references: 312 distinct, of which 81
have no verdict, because the sentences only the four first-wave ports
print were never given ids in the reviewed set; 174 printed by one
language.

*At twenty languages* (independent measurer, ran: the tools' word counter
over three sections and 21 variations at `v34-frozen`, with "alone"
measured against all twenty):

| Language | By source | Alone, against twenty | Notes | | Language | By source | Alone, against twenty | Notes |
|---|---|---|---|---|---|---|---|---|
| ts | 0.4% | 0.4% (root quick start 93.3%) | 0% | | kotlin | 2.7% | 0.1% | 0% |
| js | 0.4% | 0.0% | 0% | | scala | 0.2% | 0.0% | 0% |
| go | 7.1% (REFERENCE 7.4%) | 14.8% (tutorial 33.5%) | 6.9% | | swift | 0.6% | 5.9% (tutorial 35.2%) | 0% |
| py | 0.2% | 0.1% | 0% | | rust | 0.5% | 0.0% | 0.2% |
| php | 0.4% | 0.5% (tutorial 18.1%) | 0% | | c | 1.2% | 6.2% (root quick start 93.5%) | 0% |
| rb | 0.2% | 0.0% | 0% | | cpp | 0.2% | 0.9% (tutorial 17.8%) | 0% |
| lua | 4.1% | 0.0% | 3.6% | | zig | 4.3% | 0.1% | 3.3% |
| csharp | 2.2% | 0.1% | 1.6% | | perl | 1.7% | 3.9% (root quick start 92.0%) | 1.5% |
| java | 0.2% | 0.0% | 0% | | clojure | 2.7% | 0.4% | 2.3% |
| | | | | | elixir | 0.8% | 0.5% | 0.4% |
| | | | | | ocaml | 5.5% | 0.2% | 5.1% |

No language is over 15% overall by either measure, and this is the first
time go is under it by the "alone" measure (14.8%, against 17.0% at
thirteen and 22.6% at nine). The sentences did not change; comparing
against more languages lowers the figure. By section the "alone" measure
is still far over 15% in places (go's tutorial 33.5%, swift's 35.2%, php's
18.1%, cpp's 17.8%, and the root quick starts of c, ts and perl, over
92%), and all of those are shared result-style or lead-language sentences
that one runtime's declared style selects. kotlin's by-source figure
(2.7%) is almost all the new stream-signal form fact (1,316 words);
csharp's (2.2%) is mostly its one note, on the stream's own cancellation
token (1.6%), plus that fact (94 words). Kotlin carried that fact first as
a 25-word note, 4.0% of its words; its reviewer showed it to be a fact
every runtime has, and the integration made it a declared fact. The shared
templates hold 1,062 prose-literal words (980 at the base); provider notes
still run from 0 to 45 words.

Sentences at twenty (measurer, ran, against all twenty as references): 385
distinct shared sentences, 221 with a verdict (all ok) and 164 without. Of
the 164, 128 are printed only by the eleven languages ported after the
nine reference languages and were never given ids in the reviewed set, and
36 are printed by a reference language but changed or re-masked since the
review (among them the catalogue round's changed sentences, the
constructor-table cells and the new stream sentence). 190 are printed by
one language only. The measurer read the 40 the tools could not explain
and found the kinds the base builder found at thirteen (result-style
sentences, go's step leads, headings, table cells), none a provider's own
sentence. Every language matches some classes against a sentence with no
verdict, so the strict mode that refuses those (`STRICT_SENTENCES=1`)
would fail all twenty.

Disagreement in the records: the checker of 3.1 judged H1 refuted with go at
25.6% (go-only words plus notes, three sections). The builder of 3.1 said
"partly". The by-source figure, which counts what a provider writes, is
under 15% for every language over the three sections at 3.2 and at stage 9.
It was not always: at version 3, go's notes alone were 20.5% of its
REFERENCE prose by the builder's count (18.9% by the checker's denominator),
and the builder called that criterion crossed; at 3.1 the checker measured
go's REFERENCE notes at 7.8%. This record does not call the prose criterion
crossed, and says that the "alone" measure crossed it for go before the
reference set grew to twenty (17.0% against thirteen at the base; 18.6% at
`v33s`; before the identity fix, 22.6%); at twenty it reads 14.8%.

**Criterion 3: breaking interface changes after the first four languages.
Crossed.**

| At | Breaking changes counted since the first four languages | Counted by |
|---|---|---|
| Stage 2 (v2) | 4 | builder; the stage-2 checker agreed on 4 |
| Stage 3 | about 6, counted from stage 1's first commit (adds the stage-1 `before` change, the naming hook and stage 3's `RefFacts.container`; leaves out the `sdkDescription` signature) | builder; the stage-3 checker agreed on about 6 |
| 3 (shape) | about 11 | builder |
| 3 (freeze) | about 12 (one more: a forms file per language) | builder; checker counted about 10 from type diffs |
| 3.1 | about 11 to 13 | builder |
| 3.2 | about 20 to 22 (about 22 to 24 counting two changed shared sentences) | merging builder |
| Stage 9 | about 22 to 24 | builder |
| 3.3 | about 25 to 27 | freezing builder |
| Base for the last seven | no change: the base is the frozen interface unchanged; not re-counted | base builder |
| 3.4, by the integration | 4 caused by the last seven languages, counted as at 3.3 (5 counting a changed row in two unported components); 0 changes to the provider types | integrating builder |
| 3.4, re-counted from the code history | 25 to the provider interface (24 at `v33-frozen`) and 19 to the forms framework (16 at `v33-frozen`): 44 in all, 42 if two pairs are merged. Changed shared sentences are not in this count | independent measurer: every top-level type diffed at each commit from the first four languages to `v34-frozen`, every `throw` in the shared files traced to its commit, and the files each commit forced read (ran and read) |

The limit was about 10. It was first reached at version 3 and has been
crossed since. Appendix B lists each change, with the rows the re-count
added.

*The re-count* is the independent figure, and the verdict follows it. It
counts a change as breaking when a provider, a naming hook or a forms file
that worked before it must change to keep type-checking, generating or
printing its own page, and it finds more than any earlier record, for
these reasons (measurer, ran and read):

- Four guard tightenings at 3.1 (each method tied to its operation; a
  reader of declarations with returns on a later line; a citation pinning
  its value; a getter's copy fact cited) and one at 3.2 (members a runtime
  lacks marked) forced forms files (all nine then ported for three of the
  3.1 changes; c's, rust's and clojure's for the declaration reader; the
  c, scala, cpp and kotlin forms for the 3.2 change), and no record
  counted them.
- Appendix B row 33 bundles four guard commits of 3.3 and row 34 two; one
  row each gives six where the record had two.
- The renaming of a `testMock` value at the sentence round forced 7
  providers and 18 forms files and had no row.
- The migration round's `interface` field forced a line in all twenty
  providers. The integration calls the interface unchanged at '3.3' with 0
  provider-type changes, because the type allows the field to be omitted;
  but a provider that omits it is served as the previous interface and
  loses sentences, so the re-count counts it, and the attacker reached the
  same conclusion by running kotlin's provider without it (its REFERENCE
  lost a clause).
- In the other direction, three earlier rows are not breaking for any
  provider (v2's rows 4 and 5 are shared only, and the naming hook was
  optional with a generic fallback until 3.2, when it became mandatory and
  forced none), `RefFacts.container` forced 4 providers, not 5, and `read`
  forced 7, not 8.

*Caused by a newly ported language*, by the re-count: none before the
first wave; the first wave 6 or 7 (two provider changes, the stream signal
and the wrapped style's unwrap, and the four guard changes of 3.3, which
the round's brief required to fail in each case the reviewers ran; 7 with
the utility copy the survey prompted); the second wave 3 or 4 (the
accessor lookup, the scala test tree, the deleted read checked name by
name, and the stream sentence changed on every page), with no change to
the provider types. That is 9 to 11 from new languages alone, about the
limit by itself. The second wave was smaller than the first and touched no
provider type, but the guard still tightened three times, and it forced
commits in cpp's, java's and scala's files.

What the builders' running count measured and what it did not: it counts
breaking changes to the provider interface, and from 3.2 also changed
shared sentences that force review. It leaves out the six breaking changes
to the forms framework the guard reads (four at 3.2, two at 3.3; appendix
B rows 24 to 27, 33 and 34), which also force every port to change; with
them the count is about 31 to 33 (this record's arithmetic, not a
builder's count). It does not say whether a new language
needed one. Through 3.2, none came from a newly ported language: rust,
elixir, clojure's REFERENCE and rb each needed 0. The version-3 changes
were elective removals (three avoidable with deprecated aliases); the 3.2
changes each turned a value shared code had supplied into a declared
fact. The four first-wave porters needed none while porting. But
at 3.3, two of the round's three breaking changes were made to answer
those ports' reviews (swift's unwrap; the stream signal, raised by the
perl, lua and ocaml reviewers), and a third (the utility copy) came from a
survey those reviews prompted. The 3.3 builder's verdict: H1 refuted on
this criterion.

The `interface` field the third version of this record called pending was
adopted at the integration, in the form the second migration round left it
(optional in the type, served as the previous version when absent; section
3.5). As the re-count shows, it was one more breaking change. The 3.4
freeze, though it made four breaking changes by its own count, kept the
declared version at '3.3', because none changed the provider types: the
declared version follows the types, not the guard or the shared
sentences, so a provider that declares the current version can still meet
a changed sentence or a tighter guard.

**Standing at twenty:** refuted on the breaking-change criterion: 44
against about 10 by the independent re-count (25 provider, 19 forms
framework), 9 to 11 of them caused by new languages. The integration's
figure (4 from the last seven, 0 provider-type) does not survive the
re-count. Not crossed on model reads (0 open in all twenty) or on prose
(at most 7.1% by source and 14.8% alone, both go).

### 3.2 H2: the source shrinks at least 2x

**Refuted at twenty on every count that includes what a port must write
for its facts to be checked (1.54x with the forms, 1.20x with the guard).
Documentation code alone passes 2x for the first time, by 3% (2.06x). At
nine and at thirteen languages every count was under 2x.**

*At twenty languages*, by the independent measurer (ran: the tools' line
counter over `v34-frozen`, then the base builder's own arithmetic
unchanged: `ReadmeTop.ts` left out; `ReadmeQuick.ts`, `ReadmeRef.ts` and
`ReadmeRefFeatures.ts` counted whole; other changed files under `cmp/` and
`helpers/` counted by their delta; the forms are
`ts/test/runtimeforms/<lang>.ts`; the shared guard by line count over its
six files):

| What is counted (twenty languages) | Before | After | Ratio | Without the 259 migration lines |
|---|---|---|---|---|
| Documentation code only (shared 2,840; providers, hooks and touched files 4,445, mean 222) | 15,038 | 7,285 | 2.06x | 2.14x |
| + forms files the guard reads (2,495, mean 125) | 15,038 | 9,780 | 1.54x | 1.58x |
| + the shared guard (2,740) | 15,038 | 12,520 | 1.20x | 1.23x |
| The tools' own headline (keeps `ReadmeTop.ts`, counts the forms, leaves the guard out) | 15,783 | 10,538 | 1.50x | |

The shared documentation code grew by 367 lines between the base and the
freeze; 259 of them are the migration machinery (the interface version,
the component-path helper and the shared-section rules), which versions
and retires providers rather than prints documentation, so the measurer
gives the ratio without them beside the rest. The method did not change.

Measured, twenty is lower on every count than both earlier projections
(2.16x, 1.65x and 1.28x from the base; 2.26x, 1.80x and 1.47x from 3.2):
the shared code grew, and the seven new forms files came to 855 lines
(mean 122) where the projection had taken their pre-port 492. The seven
providers came in smaller than assumed (mean 216 against 225). The
thirteen and the nine, recomputed at the frozen state, fell for the same
reason, because they now carry the larger shared code:

| Languages | Before | At `v34-frozen`: documentation code / + forms / + guard | Earlier |
|---|---|---|---|
| Thirteen | 9,887 | 5,773 / 7,413 / 10,153: 1.71x, 1.33x, 0.97x | base: 1.83x, 1.41x, 1.02x |
| Nine | 6,916 | 4,824 / 5,888 / 8,628: 1.43x, 1.17x, 0.80x | base: 1.55x, 1.25x, 0.85x; 3.2: 1.61x, 1.33x, 0.98x |

So the 2x on documentation code is reached only with all twenty languages:
the shared code is a fixed cost, and twenty languages' old components are
what pays for it.

At thirteen languages, by the base builder (ran: the tools' line counter
over the frozen clone, with the arithmetic of the freeze: `ReadmeTop.ts`
left out; `ReadmeQuick.ts`, `ReadmeRef.ts` and `ReadmeRefFeatures.ts`
counted whole as new files; other changed shared files by their delta):

| What is counted (thirteen languages) | Before | After | Ratio |
|---|---|---|---|
| Documentation code only (shared 2,473; providers, hooks and touched files 2,920) | 9,887 | 5,393 | 1.83x |
| + forms files the guard reads (nine 1,064, four 576) | 9,887 | 7,033 | 1.41x |
| + the shared guard (2,650 lines; 2,457 without the new call check) | 9,887 | 9,683 | 1.02x |
| The tools' own headline (keeps `ReadmeTop.ts`, leaves the guard out) | 10,632 | 7,791 | 1.36x |

The nine languages alone, measured at the same base, give 1.55x, 1.25x and
0.85x, lower than at 3.2 (1.61x, 1.33x, 0.98x), because the shared
documentation code grew from 2,346 to 2,473 lines and the shared guard from
1,878 to 2,650 between 3.2 and the freeze. The four first-wave ports are
larger than the nine before them: providers and hooks average 236 lines
against 219, forms 144 against 118 (perl 255, swift 208, ocaml 281, lua
201; base builder, ran).

Projected to twenty at the base (history: the measurement at twenty is
above; before 15,038; the seven unported providers at the
thirteen's mean of 225 lines, their forms as they exist, 62 to 92 lines
each), by the base builder (arithmetic, not a measurement):

| Provider size | Documentation code | + forms | + guard |
|---|---|---|---|
| as measured | 2.16x | 1.65x | 1.28x |
| at the four new ports' mean (236) | 2.13x | 1.64x | 1.27x |
| 1.5 times | 1.94x | 1.52x | 1.20x |
| 2 times | 1.76x | 1.41x | 1.13x |

If the seven forms grow to the thirteen's forms mean of 126 lines, as the
four first-wave forms grew (to 122 to 170 lines), the first row becomes
1.59x with forms and 1.24x with the guard (the base builder's arithmetic).
Every column is lower than the projection made at 3.2.

The earlier full measurement, at 3.2 (nine languages), by the merging
builder, ran:

| What is counted (nine languages) | Before | After | Ratio |
|---|---|---|---|
| Documentation code only (shared code by delta, providers, hooks) | 6,916 | 4,283 | 1.61x |
| + forms files the guard reads | 6,916 | 5,190 | 1.33x |
| + the shared guard | 6,916 | 7,068 | 0.98x |
| The tools' own headline (keeps the unchanged `ReadmeTop.ts`, leaves the guard out) | 7,661 | 5,948 | 1.29x |

Its projection to twenty (unported providers at the then mean of 215
lines; arithmetic) was 2.26x, 1.80x and 1.47x at the measured provider
size, 1.92x, 1.58x and 1.32x at 1.5 times, 1.67x, 1.40x and 1.19x at twice.
It is replaced by the projection above.

The only figure over 2x, at 3.2 and at thirteen, is documentation code
alone, projected to twenty at the measured provider size. The history of
this number: 0.88x for the
tutorial alone on four languages (stage 1, builder); 1.13x for both
quick-start sections on six (stage 2, builder, reproduced by the checker);
2.27x for the REFERENCE alone on five (stage 3, builder), 1.89x by the
checker's non-blank count; 1.58x for eight with all shared code counted
(stage 4 tools, builder); 1.39x with the forms (version 3, builder,
reproduced by the checker) and 1.24x with the guard (checker); 1.65x, 1.40x,
1.09x at 3.1 (builder), 1.34x by the tools (checker); 1.61x, 1.33x, 0.98x
at 3.2 for nine; 1.83x, 1.41x, 1.02x at thirteen (base builder).

Per language, a port is much smaller than what it replaces. The first-wave
ports deleted three components each and added a provider, a hook and forms
(3.3, `git diff --numstat` between the 3.2 and 3.3 tags, freezing builder;
the ratios are this record's arithmetic):

| Language | Deleted | Provider + hook | Forms added | Ratio without forms |
|---|---|---|---|---|
| perl | 735 | 197 + 24 | +51 / -2 | 3.3x |
| swift | 764 | 184 + 24 | +69 / -8 | 3.7x |
| ocaml | 723 | 240 + 24 | +74 / -3 | 2.7x |
| lua | 749 | 167 + 26 | +74 / -8 | 3.9x |

These ratios leave out the shared code they rely on, so they are not H2's
measure.

What the criterion did not measure: the brief counts "lines for those
sections". The guard and the forms are not documentation code; they are the
machinery that makes a declared fact a checked one, and the proposal as
written did not mention them. The record gives each count so the reader can
choose, and states that on the documentation-code count alone the twenty
languages shrank 2.06x, over 2x by 3%, while the thirteen at the base
shrank 1.83x and the nine at 3.2 1.61x, both under it.

The second wave, by the measurer's numstat of each port (deleted,
provider, hook, forms in total; ratio without forms): js 734, 148, 22,
165, 4.3x; php 734, 169, 26, 110, 3.4x (and 19 net lines in ten generator
components that now call one SDK file-name function); csharp 741, 179, 25,
121, 3.6x; java 746, 201, 25, 103, 3.2x (9 net generator lines); kotlin
753, 190, 23, 112, 3.4x (10); scala 709, 204, 25, 112, 2.8x (22); cpp 734,
189, 24, 132, 3.4x. As for the first wave, these leave out the shared code
and are not H2's measure.

**Standing at twenty:** refuted on every count that includes the forms
(1.54x) or the guard (1.20x), independent, ran. Documentation code alone
shrank 2.06x (2.14x without the migration machinery), over 2x by 3% and
only at twenty: the thirteen measured at the same state give 1.71x. At
nine (3.2) and at thirteen (the base) every count was under 2x. The
verdict reads the criterion as the independent checker of version 3 and
the builder of 3.2 did, with the forms counted, because the forms are one
of the three things a language supplies in the structure tested (section
1.1); on documentation code alone H2 would not be refuted, by 3%.

### 3.3 H3: catalogued issues fixed once, for every language

**Not refuted at twenty, but "fixed once" is not shown. Measured against
the whole catalogue at 3.3 by a builder, then checked by an independent
checker, who reproduced the measurement and corrected it in four places,
one of them without effect on the result; the seven open entries were then
fixed by shared edits; at twenty, the measurement was run again by an
independent measurer and the changed sentences were read against the
runtimes by an independent attacker, who found one of them false in 17
languages.** The
builder of the H3 round (ran) classed every entry of
`docs/design/model-dependent-text-issues.md` against the three sections at
`v33-frozen`, wrote one machine check per in-scope entry (28 checks),
confirmed each fires on the old output for at least one language, and ran
all of them on old and new output for all twenty languages over the 21
review variations plus five added to make six entries show at all.

| Count at 3.3 (thirteen ported languages) | Builder: entries | Builder: distinct | After the check (entries) |
|---|---|---|---|
| Catalogue entries | 329 | | 329 |
| In scope (13 wholly, 25 in part) | 38 | 30 | 38 |
| Language pack only / outside the three sections | 5 / 286 | | not re-counted; 66 entries re-judged blind, scope agreed except two arguable cases (U37, S46, below) |
| Fixed by shared code alone | 29 | 22 | 28 |
| Fixed only in part, the rest one shared edit (D26) | 0 | 0 | 1 |
| Needed lines of each language: S13 (the `testMock` fact in every provider, citations in every forms file, a ts and js runtime fix) | 1 | 1 | 1 by the brief's rule; 2 on a strict reading (S13, U44) |
| Not fixed at all (X3, S22, U52, U53, V27, U102), still shown in all twenty languages | 6 | 6 | 6 |
| Shown only in an unported language (N11/M35, the ts fence on js pages) | 2 | 1 | 2 |

The ratio H3 names, over the 36 entries that are fixed or should be, as
the builder had it and as the checker recomputed it (both ran):

| Reading | Unfixed entries counted for the proposal: builder / checker | Counted against: builder / checker |
|---|---|---|
| By the brief's rule (type and constructor printers exempt) | 1/36 = 2.8% / 1/36 = 2.8% | 7/36 = 19.4% / 8/36 = 22.2% |
| Strict (also any line of a language's own that exists because of the entry; printers exempt) | not separated / 2/36 = 5.6% | not separated / 9/36 = 25.0% |
| Strictest (also the 13 type printers and go's printer: N04, U06, M04, M14) | 5/36 = 13.9% / 6/36 = 16.7% | 11/36 = 30.6% / 13/36 = 36.1% |

Per distinct defect (29: the 30 less the one shown only in js) the
checker's six figures are, in the same order, 3.4% and 27.6%, 6.9% and
31.0%, 13.8% and 37.9% (the builder's: 3.4% and 24.1%, not separated,
10.3% and 31.0%). If U37 (below) were counted in scope, the brief's
rule would give 9/37 = 24.3% against, and 2/37 = 5.4% for, if its fix is
read as one line of go's own target model; no reading changes side.

What the check confirmed (checker, ran unless marked):

- The scope. The checker judged blind the 66 entries whose number ends in 3
  or 7 and agreed with the builder on all but two arguable cases: U37 (the
  go REFERENCE title says "Golang", written by go's old REFERENCE
  component) and S46 (README and REFERENCE describe entity classes when
  ts's entity phase is off). On the rule the measurement used (every site
  the entry names), both stand outside. The checker read only 7 of the
  other 146 out-of-scope entries that name a README, REFERENCE, quick start
  or example, filtered by script.
- The reproduction. On copies of the builder's old and new output, the
  builder's check script gave a table identical to the builder's. Every check
  fires on OLD for at least one language. The six unfixed defects show on
  NEW. Broader variants written by the checker (code only, any wording)
  found none of the fixed defects back on NEW in the thirteen.

What it corrected:

- **D26 is fixed only in part.** NEW gates a hand-written list of eight
  constructor-table rows on the option spec (`ts/src/helpers/sdkdesc.ts`
  lines 281 to 310 at `v33-frozen`; the file is the prototype's and does
  not exist on `main`). The catalogue's fix is rows derived
  from the option spec, both ways, and that is not done: the spec's `auth`,
  `allow`, `entity`, `extend`, `utility`, `test` and `clean` have no row,
  and `utility` is the documented transport seam. The builder's check
  tested only that a server row exists. One shared edit.
- **U44 has lines of two languages' own on a strict reading.** Two
  guard exceptions, in the py and elixir forms files (lines 93 and 97 of
  `ts/test/runtimeforms/py.ts` and `elixir.ts` in the prototype), are left
  over from a per-language fact since dropped. The shared sentence carries
  the fix; NEW py still prints the optional signature
  `list(reqmatch=None, ...)` beside "The match must include `planet_id`".
  Under the brief's rule U44 stays fixed once.
- **The six unfixed entries were within reach.** The builder reported that
  the prototype never touched `ts/src/cmp/ReadmeRefFeatures.ts` or
  `ts/src/cmp/FeatureDocs.ts`. Two prototype commits changed them (S09 was
  fixed there). The six sit in shared code the prototype already edited;
  they are unfixed because no round scheduled them, not because the
  structure kept them out of reach. Being written once is not the same as
  being fixed.
- **One extractor defect, without effect today.** The root quick-start
  section was cut at the first `# comment` inside a code block for py, rb,
  perl and elixir, so those checks saw a prefix of the block. Every root
  check is about the constructor, which comes first; a fence-aware copy
  gives an identical table. A future check about later lines would be blind
  there.

**What a clean result rests on.** Every check is a pattern over the text.
The checker put six defects back into copies of NEW pages in other words
(S49: the server block deleted while the sentence naming `tenant` stays;
S50 and D23: lua's `secret` line deleted from the code; X6: a list sentence
in other words; S25 and D10: a remove method named in prose under
"Operations"; U43 and U44: the requirement reworded or inverted), and all
six checks still said clean. So a clean NEW here rests on reading as well
as on the checks: the checker read at least three ported pages per entry
and ran the broader variants, and found them clean.

Limits of the measurement, as the builder and the checker state them: the
checks read only the in-section half of each "part" entry (the same
defects still show on NEW in README tables outside the three sections, for
example M37); no check was written for the five pack entries; N04, U06 and
M04 are shown only for go, through the one alias variation; D04 shows in
no variation and was read; S13's "refuses every request" for ts rests on a
commit nobody ran. The checker left two readings unscored: on NEW without
the test feature, the test-client text says the client refuses every
request and then calls the test options "the test feature's options, which
the call switches on", possibly S13 in other words; and the log feature's
REFERENCE section still says to set `feature.log.active` to true although
log is on by default (section 5.8).

Earlier evidence, for and against:

- **For.** Stage 2: quick-start issue checks went from up to 89 instances
  in old output to 0 in new (G01/M13 89, S49 84, S28 63 and 45, c getenv
  30, S50 20, M14 16; checker, ran); all by shared code except c getenv
  and M14, which were provider fixes. Stage 3: 17 REFERENCE issue checks
  showed the defect in old output and not in new for every ported language
  where the check applies (builder, ran; the checker confirmed the listed
  fixes by grep). The pilot rb port received S49, S50, U34, S28, S09, G01,
  G27, S13, U45 and S25 with zero rb code (builder, ran). The first-wave
  ports received S49, S50, S09, S13, S25, U34, U45, G27 and others the same
  way (porters, read; reviewers confirmed as far as read, and the perl
  reviewer found S13 mis-cited for the log default). At 3.3 each of
  fourteen shared decisions reached every affected language through one
  change (for example the stream-signal sentence, 94 paragraphs in each of
  9 languages and 108 in go; builder, ran).
- **Against.** Several catalogue ids also name sites in README sections
  that are not ported, which stay unfixed (checker, stage 2). Some fixes
  needed a per-language edit: wrong declared signatures, one c printer, ts
  `copy: false`, perl's deleted sigil (builders). The analyst of the other
  ten README families estimated, from titles and not by running, that 24
  of 105 issue ids there (23%; 14 of 95, 15%, without the language pack)
  would still need a per-language edit. Porting one section at a time made
  documents of the same SDK contradict each other (section 5.6).

**The seven shared edits** (a builder, ran; their sentences were read
independently only at twenty, below). Made on the frozen state, one
commit per entry, each with a test that fails before it and passes after
(run in a second copy of the clone):

- X3, S22, U52, U53, V27 and U102: one shared edit each, in
  `ts/src/cmp/ReadmeRefFeatures.ts`, `ts/src/cmp/FeatureDocs.ts` and a new
  code-span cell escaper. No language's own file changed: the diff from
  the frozen state touches nothing under `ts/project`, the forms or
  `ts/model`. Because those components serve every language, the six are
  clean on the pages of all twenty, ported or not.
- D26: the REFERENCE constructor table now takes its rows from the
  validated option schema (`main.kit.optspec`); `auth`, `allow` and
  `clean` gained rows, and the type column prints each language's own
  type words. Four schema keys are excepted, with reasons: `entity`,
  `test`, `extend` and `utility`. The last two mean different things per
  runtime (rust, c and ocaml do not read `extend`; zig takes it as an
  argument of its constructor; rust, c, zig, ocaml and cpp cannot carry a
  `utility` at all, because their options are a closed value union), so a
  row for them is true only with a fact each provider declares. D26
  therefore counts as needing a per-language edit to complete. There is
  no default column yet.
- The residues: the feature-ordering note prints feature names as code
  spans; an on-by-default feature is no longer told to be switched on,
  and the true value prints through the language's own literal printer;
  the test client's paragraph without the test feature was reworded.
  U37 was decided and left: the go title follows `target.title`, and a
  label rule for the REFERENCE alone would make it disagree with its own
  README.
- One sentence an earlier part of the same round wrote was false, and the
  tools could not have caught it: that without the test feature "nothing
  reads" the option. Every ported runtime reads `feature.test.active`
  (for example py `Main.fragment.py:45`, c `Main.fragment.c:38`, go
  `make_options.go:156`); it was reworded by its author.
- Checks: the thirteen one commands pass (752 classes opened, every one
  decided by one written rule per changed sentence); the repository suite
  2,642 tests, 2,637 pass, 0 fail, 5 skipped; the guard and reader 77 of
  77; the H3 checker over the 26 variations exits 0 for the thirteen. Of
  17 attempts to put a defect back in other words, the narrow checks were
  fooled every time; broader variants caught 10 and missed 7.
- Not done by that round: an independent reading of the 11 sentences it
  changed (done at twenty, below); the language pack was not generated
  against the edits; the feature configuration tables print every default
  in JavaScript spelling for every language (`false`, `'anonymous'`,
  `['GET']`), observed and not fixed. The round also found a shared branch
  on a target's name (`FIXED_ORDER_TARGETS = ['lean']` in
  `ts/src/cmp/FeatureDocs.ts`), under which the cost-and-cache ordering
  sentence is false for lean; not fixed.

The ratio again, over the same 36 entries, with D26's open half counted
first for the proposal and then against it:

| Reading | Per entry (of 36) | Per distinct defect (of 29) |
|---|---|---|
| By the brief's rule | 1/36 = 2.8% (S13) to 2/36 = 5.6% (S13, D26) | 3.4% to 6.9% |
| Strict (also U44) | 5.6% to 8.3% | 6.9% to 10.3% |
| Strictest (also N04, U06, M04, M14) | 16.7% to 19.4% | 13.8% to 17.2% |

At the frozen state the "against" column read 22.2%, 25.0% and 36.1% per
entry.

**At twenty languages** (independent measurer, ran). The catalogue
checker, with its broader and post-attack variants, ran over all 26
variations for all twenty languages and exits 0: no checked defect shows
on NEW in any language. This was the first run to include the aliased-go
variation (the integration's run had to skip it), so N04, U06 and M04,
which show only through an alias, are now checked and clean. The 21
variations it shares with the review set are byte-identical to the frozen
output. N11 and M35 (a TypeScript fence on js pages), outside the 36, are
fixed for js, through the fence value its provider declares.

Lines the seven last ports added for a catalogued entry: one provider line
each for S13 (`testMock`), seven in all; their forms citations for it were
already present from the sentence round in five of them, and php and scala
re-quoted theirs (one line each); js's runtime fix for S13 predates its
port. No other entry needed a line in any of the seven, none carries a
leftover guard exception like U44's (which remain in py and elixir), and
D26's open half is still done for no language.

| Reading (at twenty) | Per entry (of 36) | Per distinct defect (of 29) |
|---|---|---|
| By the brief's rule (S13; D26 counted for or against) | 1/36 = 2.8% to 2/36 = 5.6% | 3.4% to 6.9% |
| Strict (also U44) | 5.6% to 8.3% | 6.9% to 10.3% |
| Strictest (also the type printers, now 20, and go's printer: N04, U06, M04, M14) | 16.7% to 19.4% | 13.8% to 17.2% |

These are unchanged from thirteen languages. Over 38 entries, counting N11
and M35, the brief's rule gives 2.6% to 5.3%. Not re-done at twenty: the
17 attempts to put a defect back in other words.

**The changed sentences, read against the runtimes** (independent
attacker, read in the runtimes named, ran where marked). The catalogue
round's builder was the only reader of its eleven changed sentences, and
the integration accepted them for the seven new languages by the round's
written rules, checking each against the builder's own reasons, not
against the seven runtimes. The attacker read each one against every
runtime that prints it:

| Sentence (catalogue round) | Verdict | Read |
|---|---|---|
| The hook-feature list without `test`, singular for one | ok | test installs the base fetcher and attaches to no hook (py, go, java, rb, ocaml) |
| test's Considerations: it installs the base transport the wrappers wrap, so it comes first | ok | test replaces the fetcher outright (py, go, java) |
| "- Also attaches to pipeline hooks." under `cost` | ok | cost defines its three hooks in all twenty runtimes |
| "- Also attaches to pipeline hooks." under `secrets` | **false in 17 of 20** | a `PreSpec` hook exists only in ts, js and py; the other seventeen resolve the secret at the transport, and several say so in a comment (csharp `SecretsFeature.cs:317`, rb, php, kotlin, java, swift, clojure, zig); a search for a `PreSpec` definition in every spelling found none elsewhere |
| The short-circuit sentence without the cache example | ok | true of any wrapper that returns without calling inward |
| "`retry` is the one feature that wraps the transport" | ok | retry captures and replaces the installed fetcher |
| The constructor rows `auth`, `allow`, `clean` | ok | the builder's evidence was a count of files; the attacker opened the lines in c, ocaml, perl and zig |
| The feature Usage sentence with the provider's key and literal | awkward | true as a path, but the bracket notation it prints (`options["feature"]["audit"]["active"]`) is not code in java, kotlin, scala, csharp, go or cpp, whose option maps hold untyped values |
| log runs without being switched on; "Active by default" without a TypeScript literal (two sentences) | ok | log's model declares it active, and every runtime installs a feature exactly when its merged `active` is true |
| `cost` and `cache` as code spans | ok | escaping only |
| The test client's first argument without the test feature | ok | each runtime sets the test options active at `feature.test` and its fetcher refuses the request (scala, kotlin, csharp, java, cpp) |

The integration's own changed sentences were read the same way: the stream
signal in words (ok: it prints in sixteen runtimes, and the attacker cites
the reading in fourteen of them, all but py and ocaml), the kotlin
and csharp form clauses (ok), cpp's remove that keeps its data (ok, cpp's
alone), the ts and js README row for the utility getter (ok, ran),
csharp's block-scoped loop variable (ok, read; no compiler), java's
deleted read with its full package name (ok: the attacker compiled it
separately and it printed true; the integration's evidence, that the java
lane compiles it, is wrong, because the read stands only in prose). The
stream sentence without a form clause is awkward in the runtimes that read
one form and ignore any other value without declaring which: the
integration named java and scala, and the attacker found go, perl,
clojure, swift, elixir, ts and js the same.

**What the false sentence means for H3.** X3 itself (the base transport
listed as a hook feature) is fixed, and the checker says so. The fix added
a new claim for every wrapping feature whose model declares an active
hook, from the model's declaration, and for `secrets` the runtimes
contradict the model. No check could see it: the guard checks declared
facts, not shared sentences; the review tools decided the classes it
opened by the round's rule; the catalogue checker tests for the old
defect, not for new ones. Made true, it needs either a declared fact in
each runtime's provider (the proposal's own answer to a runtime
difference) or no sentence. Charged to X3 as needing a declared fact per
runtime, the ratio becomes, by this record's arithmetic, with D26's open
half counted first for the proposal and then against it: 2/36 = 5.6% to
3/36 = 8.3% by the brief's rule and 3/36 = 8.3% to 4/36 = 11.1% strict,
per entry; 6.9% to 10.3% and 10.3% to 13.8% per distinct defect. By the
brief's rule the share stays under the limit per entry and reaches it at
most per distinct defect (10.3%); on the strict reading it is over the
limit only with D26's open half counted against.

**Standing at twenty:** not refuted. By the brief's rule the per-language
share is 2.8% to 5.6% (5.6% to 8.3% with the `secrets` line charged to
X3), under
the limit, measured independently over all twenty languages. "Fixed once"
holds for 34 of the 36 in-scope entries by shared code alone, S13 takes
one declared fact per provider, and D26 is half done. It is not shown in
full: a fix made once introduced a claim false in 17 runtimes, which every
check passed, and the catalogue checks are word patterns that rewording
defeats.

### 3.4 H4: examples still compile and run

**Not refuted: holds in the thirteen languages with a toolchain here;
untested in seven of the twenty.**

At 3.4 the integrator ran every example lane with a toolchain on NEW and
on the old code, and the attacker re-ran every NEW lane with identical
results (both ran). The 3.3 column is the freezing builder's (ran; the
same new-code counts were reproduced by the checker at 3.1 and by the
verifier of stage 9).

| Lane | Old code | 3.3 | 3.4 |
|---|---|---|---|
| ts README | 16/16 | 16/16 | 16/16 |
| go README | 12/12 | 12/12 | 12/12 |
| py README (real pytest) | 12/12 | 12/12 | 12/12 |
| c documentation | 5/6 | 6/6 | 6/6 |
| rust documentation | 6/6 | 6/6 | 6/6 |
| rb README | 48/49 | 49/49 | 49/49 |
| zig documentation (Zig 0.16.0) | 5/6 | 6/6 | 6/6 |
| perl README, three models | 7/7; exit 0, 3 runs each | 7/7 | exit 0, 3 runs each |
| cpp documentation (every block compiled) | 6/6 | | 6/6 |
| php README example test, three models, 3 runs each | exit 0 | | exit 0 |
| java: every block of three models compiled with javac | 23/23, 18/18, 18/18 | | 24/24, 19/19, 19/19 |
| java: the same blocks run under the test constructor | 19/23, 13/18, 13/18 | | 20/24, 14/19, 14/19 (the rest: the mock's 404 on unseeded data, as on old code) |
| kotlin: every block of three models compiled (gradle, offline) | 0 errors | | 0 errors |
| js: every program of three models run as written, as an ES module, from the repository root | 20/24, 13/17, 13/17 | | 24/24, 17/17, 17/17 |

Root quick starts run from the repository root of a generated SDK at 3.4
(integrator, ran; the attacker repeated perl, rb, php and py): perl, rb,
php, py, ts and go all get past their imports and constructor and stop at
the live request, since no server answers here. On the old code rb fails
at its `require_relative`, php at its `require_once`, and go does not
parse (a fragment). js and java run their root quick starts inside their
lanes; c, rust, zig, cpp and kotlin compile theirs in their lanes but
nothing runs them from a root.

Beyond the lanes, the reviewers and verifiers of the second wave compiled
whole variations: java, every block of the 19 variations that have java,
351 of 351 NEW and 333 of 333 OLD (reviewer); kotlin, every block of all
19 variations, 370 NEW and 352 OLD block functions with 0 errors
(verifier); cpp, every block of four variations, 146 of 146 NEW and 143 of
143 OLD (reviewer). Each had a negative control that failed.

Two old failures were defects of `main`, fixed once: c's quick start used
`getenv` without `#include <stdlib.h>` and never compiled with auth active;
zig's printed `std.posix.getenv`, which Zig 0.16 does not have. rb's old
failure was the missing templated server (S49).

Evidence against, all found and since fixed:

- Stage 1 dropped go's runnable program for fragments, so no go quick-start
  code ran (independent). Version 2 restored one program per page; both go
  programs were run directly, exit 0 (builder and checker).
- A custom-action example cannot be a code block in any language with a
  lane: the ts payload type rejects it (TS2739) and py's test mode rejects
  the action. It now sits in a table cell that no lane executes (builder).
- perl's root quick start lost `use lib 'perl/lib'` in the first-wave port,
  because one shared imports printer served the tutorial and the root and
  could not tell them apart. `perl -c` from the repository root failed in
  all 19 variations; the lane stayed 7/7 because its runner prepended the
  import itself (reviewer, ran). The interface gained a place for imports;
  at 3.3 the root quick start runs from the repository root, and the lane,
  changed to run each block from its page's directory, fails with
  "Can't locate DemoSDK.pm" when the line is removed (builder, ran).
- A shared display-field helper made a perl REFERENCE example print
  `HASH(0x...)`: the reviewer ran it and counted 14 variations, the verifier
  17 by grep; the lane passed it. Fixed by a scalar-only rule at 3.3.

Run from the repository root in the 3.3 round (shared builder, ran): perl
and rb load (rb's root block had never loaded on the old code either; it
then fails on the live request, since the default model has no server);
go's old root block was not a program and now builds; c's and py's root
blocks fail on old and new alike (c has statements at file scope; py raises
ModuleNotFoundError as written, and with the package on the path stops at a
missing `requests` module here). ts, rust and zig root quick starts were not
run from the repository root.

What the lanes do not cover: they compile their own models, not the 21
review variations, so most changed blocks are compiled by nothing. Changed
blocks per language with no compiler here: clojure 124 and elixir 213 (3.1
count), swift 172, ocaml 229, lua 226 (first wave). Reviewers read 20 to 24
distinct changed blocks each in swift, ocaml and lua and judged none
failing, with a few doubtful constructs. "Unverified 0" in the block tables
means only that a compiler is on the PATH (checker, 3.1).

**The second wave**, against the examples (each fixed in the port's own
files unless marked):

- js: the tutorial and root quick start mixed `require` with top-level
  `await`, which node 24 refuses before the first statement, on the old
  pages as on the new; js had no lane, and the porter's runner wrapped
  each program in a function, so it could not see it (reviewer, ran). The
  provider now prints an ES `import`, as ts does. The unported "Module
  structure" section of the same README still prints `require`.
- java: the provider's own copy of the example-literal table printed
  `Map.of("z", null)` for a member whose only type is null, which throws
  at run time; no review variation has such a member, so the one command,
  the tools and the lane passed it, and only the repository suite failed
  (reviewer, ran). Fixed by using the generator's own table.
- kotlin: in one variation the REFERENCE casts to `SdkEntity` while the
  tutorial, whose imports the REFERENCE relies on, imported it only when
  it read a record: 8 compile errors (reviewer, ran). Fixed by an
  unconditional import.
- scala: the REFERENCE told the reader to branch on `result.get("ok") ==
  true`, which compares an object with a primitive and is believed not to
  compile under Scala 3; and a bare `1.0` went into a map of objects, as
  on the old pages (reviewer, read; no compiler). Fixed with the boxed
  constants the runtime itself uses.
- csharp: shared code gave the root quick start's list item and its loaded
  entity one name, which C#'s whole-block scope rejects (CS0136) in 5 of
  21 variations; the old pages compiled (porter and reviewer, read; the
  reviewer's own scope checker found exactly those 5 among 1,319 blocks).
  This one was intrinsic to a shared naming decision, and was fixed at the
  integration by an optional language fact (`blockScope`), not by the
  provider. No C# compiler was available, so the fix is read, not
  compiled.
- cpp: the tutorial and root quick start show a live client whose first
  request can only fail, because the cpp runtime has no built-in HTTP
  transport (ocaml and zig neither); no page says so. Recorded at the
  integration, not made.

What the lanes and the checks still miss (attacker and verifiers, ran):
java's lane adds its own imports, so a dropped import passes it, and
swapped arguments of one type compile; the php README example test strips
the page's own `require_once`, so a broken root import passes it; the
csharp lane passes without dotnet; and in java and kotlin the REFERENCE
operation blocks bind the result as `Object` or `Any?` with no cast (0 of
5 blocks) right under the sentence that `data()` reads its record, which
does not compile on those types. The integration had recorded the opposite
(that each example binds with the cast the runtime needs); the attacker
counted the blocks.

**Standing at twenty:** not refuted. It holds for ts, js, go, py, php,
rb, perl, java, kotlin, c, cpp, rust and zig: every example test passes on
NEW, and none failed for a reason intrinsic to the approach. Not tested
for csharp, scala, swift, lua, clojure, elixir and ocaml, whose changed
blocks were read, not compiled, and the lanes compile their own models
and are blind to a dropped import or swapped arguments, so the claim is
not shown in full. Two failures were intrinsic to the interface as it
stood (perl's root import at 3.3; csharp's shared name at 3.4, read) and
each needed an additive change.

### 3.5 H5: existing projects, packs and aliases move safely

**Not refuted at twenty, and not shown safe as built. Measured on the real
structure at 3.3 by a builder, then attacked by an independent checker who
re-ran every row and 22 states of their own; both ran every verb on real
`.sdk` projects. Two structures were then built and attacked again; the
integration made the three local fixes that attack traced; and at twenty
an independent measurer rebuilt the fixtures and re-ran the rows, and an
independent attacker attacked the fixes.**

How it was measured. Projects were made by the unmodified 4.44.0 with ts,
go, py, perl, lua, js and php (five ported targets and two not), with
variants: a retired component edited, no copy record, aliases (`go~go2`,
`js~js2`), a project-owned target, and all twenty targets. They were
upgraded to the frozen prototype stamped 4.45.0, so that a copy record's
versions differ. "Without the change" is that build with the lifecycle
change reverted: the record-gated pruning of retired copies built at the
first stage, which turned out to be in the frozen state already (three
commits, identical source). The verbs run were `doctor`, `target add` and
`target remove`, `package update --no-fetch`, dry runs (`-y`), `doctor
prune`, the project's own `tsc --build src`, and generation. Generation
used the builder's own roots built from the installed package (a
documentation-only root, and a full root modelled on the repository's
generation harness), not `npm run generate` in a project made by
create-sdkgen.

The rows, by the builder (ran; the checker re-ran all 75 row headers and
found the same outcomes, apart from timings and temporary names):

| Row | State | Without the lifecycle change | With it | Safe |
|---|---|---|---|---|
| 1 | Package upgraded, nothing else run | Ported pages stay OLD; `doctor` exits 1 on 10 missing providers and hooks, and shows the 15 retired copies as "additive (project-owned)" | `doctor` exits 1: 10 missing, 11 outdated, 15 retired, each named | yes, both; without the change the copies are mislabelled |
| 2a | Each target re-added | Copies kept and still write all three sections; `doctor` "matches the scaffold (15 additive)", exit 0 | Each re-add removes the three retired components and their compiled output; pages NEW; `doctor` matches | no without; yes with |
| 2b | `package update` | All 15 kept and used | 15 sources and their compiled output removed without `--force`; pages NEW | no without; yes with |
| 2c | Dry runs of both | Tree unchanged | "would remove" per file; tree unchanged | yes |
| 3, 3b | A retired copy edited under 4.44.0, then re-add or update | The edit silently becomes "additive" like the other 14, all kept | The edit is reported as an override "used instead of the shared ReadmeQuick" and kept with a warning; the other 14 are pruned | no without; yes with |
| 3c, 3d | The edited copy with `--force`, or with copies set to overwrite | Kept and used | Deleted with its compiled output, as the mode says, with no backup | yes |
| 4a, 4b | `target remove ts` | Refuses the three files as not written by `target add`, though the record shows add wrote them | exit 0 | no without; yes with |
| 4c | `target remove ts` with the edited override | Refuses the three | Refuses the override only, `--force` offered (its wording "did not write" is wrong for an override) | yes |
| 5 | Copy record deleted, then re-add | `doctor`: 11 forked (scaffold files that changed upstream) and 10 missing, exit 1; re-add refuses entirely | The same, each copy labelled | yes in the strict sense; the project is stuck until `--force` |
| 5b | No record, re-add with `--force` | The 15 retired copies kept and used; `doctor` "matches (15 additive)", exit 0 | The same; the lines say "used instead of the shared X"; exit 0 | **no, with or without** |
| 6 | Aliases made by 4.44.0 | go2's three old copies kept and used | Three retired for go2 (none for js2), removed by the re-add; go2 and js2 pages equal a fresh alias project | no without; yes with |
| 7a | The language pack | Suite 76 tests, 74 pass, 2 skipped | The same; 10 of 12 pages byte-identical; dart and lean REFERENCE differ by one shared line (a backslash fix) | yes |
| 7b | A pack retiring its own old component (`lua~lp`, 0.1.0 to 0.2.0) | not run | 3 retired, 2 missing, 2 outdated, exit 1; the re-add removes them; `doctor` ok | yes |
| 8 | A project-owned target with only its own quick start | Its own used | The same | yes |
| 15 | An override kept, then deleted by hand (the first stage's unsafe row) | The stale compiled `dist/cmp/ts/ReadmeQuick_ts.js` is loaded, and nothing names it | A new `doctor` finding, ORPHAN COMPILED COMPONENT, fails the check; generate warns; `doctor prune` deletes it and honours `-y` | no without; yes with the new finding |

So: without the lifecycle change, 8 rows are unsafe (2a, 2b, 3, 3b, 4a,
4b, 6, and a second variant of 2a). With it and the new finding, every
row is safe except 5b.

**All twenty targets** (builder, ran; timings are the minimum of three on
a shared machine). A 4.44.0 project with all twenty bundled targets holds
60 old-style component files, 39 of them in the thirteen ported languages.
Upgraded, `doctor` reports 26 missing, 25 outdated and 39 retired and exits
1, though its one-line CLI summary prints only "0 forked, 0 edited, 0
stale, 26 missing". `package update --no-fetch` removes the 39 (13 x 3)
and their compiled output, in 4,117 ms. After it, `doctor` matches; the 26
ported pages and the root README are byte-identical to a project made
fresh on the new build; the seven unported languages' 14 pages are too,
their READMEs are identical to 4.44.0's, and their REFERENCE differs from
4.44.0's by the one shared line. `doctor` took 1,252 ms on 4.44.0, 1,369 ms
upgraded and 1,336 ms after; full generation 3,704, 4,093 and 3,599 ms. The
checker's re-run measured 1,393, 1,520 and 1,235 ms, and 4,349, 4,105 and
3,672 ms.

**Version skew** (builder, ran).

- Package upgraded, copies not refreshed: generation writes the OLD
  sections from the kept copies, with no error; a warning counts 26
  unchanged copies and calls the 10 missing providers "changed in this
  project"; `doctor` exits 1.
- Copies refreshed, then the package rolled back to 4.44.0: with the newer
  compiled output still present, `tsc --build src` reports up to date and
  generation throws a TypeError from a refreshed copy
  (`readsSecret is not a function`, in `ReadmeHowto_ts`), after 4.44.0's
  shared sections warn that the tutorial is empty, REFERENCE.md is not
  written and the root quick start is missing. The copies warning states
  the direction backwards. On a clean checkout `tsc` fails with 187
  errors naming 12 missing exports (`Syntax`, `Naming`, `RefFacts` and
  others), which stops the scaffold's `npm run generate`: clear about file
  and name, silent about the cause. `doctor` on 4.44.0 reads the providers
  as additive and the three components as missing, exit 1.

**A provider written for an older interface.** The builder held the 3.2
lua and ocaml providers as a pack against 3.3. Of the seven breaking
changes since 3.2 (five act at generation, two only in sdkgen's own guard),
three applied to each provider, four distinct changes in all: six cases.
With no version: 2 type errors (`testMock` missing), 4 silent
page changes (lua's utility getter loses "a copy", which the 3.2 page had
right; both lose the stream-signal sentence; ocaml keeps a direct Returns
paragraph that is wrong for OCaml), and 6 further silent omissions from
facts added as optional at 3.3. The REFERENCE differs from the 3.3
provider's by 62 lines in lua and 80 in ocaml. The builder then built an
interface version, on that builder's branch and not in the base: the
provider type gains a required `interface: '3.3'`; the shared code checks
it where it loads the provider and refuses another version with a list of
the breaking changes since it, naming `package update` for an unchanged
copy; and `package check` gains a rule (a provider without its naming hook
is an error, a hook without a provider a warning, an old interface an
error). With it, all six applicable cases surface at first contact: a type
error per provider, and the thrown list if the type error is bypassed.
Why not the package manifest's `engines.sdkgen`: it ranges over package
versions, which do not track the provider interface; bundled and
project-owned targets have no manifest; one pack can hold providers on
different versions.

**Stale compiled output** (builder, ran). The new `doctor` finding lists
every compiled file under `.sdk/dist/cmp/<target>/` whose source is gone,
for targets the model declares, and fails the check; generation warns with
the file names; `doctor prune` deletes them and honours a dry run. The
existing prune of superseded files ignored the dry run and deleted anyway
(read; now fixed too). The finding bends `doctor`'s scope: it now reads
`.sdk/dist`, a build output and not a tree an add writes. The builder chose
it over a loader rule that would skip a compiled module with no source,
which would change what generation loads without telling anyone. The
generation that runs before the prune still uses the stale file, with a
warning.

**Overrides** (builder, ran). A project's edit to its own copy of a
provider or a naming hook is reported CUSTOMIZED, kept by a merging add and
by `package update`, and removed by overwrite mode as that mode says. Such
an edit can make a page say what the model does not: a naming-hook edit
named a client class `MyClient` that the generated code does not have, 13
times across README and REFERENCE; flipping the declared fact `async`
turned "resolves to the entity" into "returns the entity" for an async
runtime. `doctor` stays ok. Nothing in a project checks a fact against
the runtime: the guard runs only in sdkgen's own repository. The generated
SDK's own README example test catches a printer edit that breaks
compilation, where a toolchain exists, and not a false fact.

**Cost** (builder, counted with git). The lifecycle change, already in the
frozen state: `ts/src/action/target.ts` +85 −3, `doctor.ts` +45 −10,
`edition.ts` +5 −1, `remove.ts` +1, and 7 tests (+143 lines); about 5
lines of it are specific to documentation components, the rest is generic
to any per-target component. The H5 round: `doctor.ts` +62 −6 and 2 tests
(generic); the interface version, a 51-line helper, +1 line in each of 13
providers and 4 tests; the package-check rule, 44 lines and 4 tests; 13
golden lines refreshed. Action tests 318 of 318; the repository suite
without the slow lanes 2,641 tests, 2,636 pass, 0 fail, 5 skipped.

**What the independent attack found** (checker, ran unless marked). Of 22
states the builder had not tried, 16 were safe. Two more are unsafe, and
both belong to row 5b's class: a copy the record does not hold as
unchanged is kept, used and never fails `doctor`.

- One truncated line in the copy record (`.sdk/log/copies.jsonl`). The
  record reader drops a line it cannot parse without a finding
  (`ts/src/action/copies.ts` lines 77 to 107; read), so an unchanged old
  copy reads as a project's override. It is kept by `package update`,
  still writes the page, `doctor` says "matches the scaffold", exit 0, and
  `target remove` refuses it as not written by an add. The damage was
  synthesised by cutting an appended line.
- `package update`, then the 15 retired files restored from git. The
  record has already written them off, so they come back as "additive
  (used instead of the shared X)": all five ported targets write OLD
  pages, `doctor` matches, exit 0, and a second update keeps them.
- Row 5b itself through a configuration the scaffold once shipped: a
  `.sdk/.gitignore` that ignores `log/` gives a clone on a second machine
  no record.

Loud, but costly:

- An interface raise (a simulated next release declaring 3.4, made by
  editing an archive of the build, not from source): every provider copy
  not yet refreshed fails `tsc` ("'3.3' is not assignable to '3.4'"),
  which stops the whole `npm run generate`, code included, until
  `package update`, and the message never names `package update`. With
  compiled output present, `tsc --build` says up to date and generation
  throws instead. A clean three-way merge raised a customised provider's
  declared interface on the project's behalf, unread.
- A target removed with 4.44.0's own verb and re-added after the upgrade
  loads three orphan compiled components: only the new finding catches
  it, and `target add` does not clean them (`doctor prune` does).
- In overwrite mode, `doctor` tells the project an edited retired copy is
  "kept and used", and the next add deletes it with an info-level line.

On the interface version, with the checker's own provider: for a provider
that declares the current version it adds nothing. A removed optional fact
and a printer with fewer arguments stay silent on both builds. `interface:
SYNTAX_INTERFACE`, the imported constant, passes every later raise unread,
and `package check` misreads it as "none". It catches version drift only,
and only while the version is written as a literal. Because the check throws
inside a component, it aborts the whole generation: a pack that ships
providers stops generating at every raise until the pack releases (the
checker's inference from the raise and the mutations; no pack was upgraded
across a raise end to end). H5 names "a pack's targets stop generating" as a
refutation condition, and the interface broke about 25 times during porting
(section 3.1).

Rules of the repository the changes bend (checker, read; the last two
also seen in runs): the path of a
per-target component and of its compiled output is rebuilt by hand in six
new places; the list of compiled-output extensions is written twice; two
different lists answer which components a shared section replaces; the
runtime check and `package check` read the declared interface in two
different ways and disagree; and the copy record now decides deletion
while a damaged line in it is skipped without a word.

Earlier evidence, with a stand-in (stages 1 and 2):

- With the tool unchanged, an upgraded project silently keeps the old
  per-language component (builder, reproduced independently, ran). The
  real structure confirms it (rows 2a to 6 above).
- The lifecycle change (136 lines added, 14 removed, and a 7-case test)
  made retirement safe in 14 of 15 rows of a stand-in that changed three
  files; a real 4.44.0 project then upgraded cleanly at version 2 (builder,
  reproduced by the checker, ran). The stand-in could not show row 5: on
  the real structure eleven other scaffold files changed upstream read as
  forked, and a project with no record cannot even be re-added.
- The extraction of naming functions marks generator components outdated
  in existing projects (5 in the upgrade walk: Main_py, utility_py,
  Main_clojure, MainEntity_clojure, utility_clojure).
- Retiring the other ten README families would be the same migration for
  200 more files in sdkgen and 30 in the pack (analyst, read).

Not measured by either: the retirement of edition components end to end;
a pack that ships providers upgraded across a raise end to end (inferred
from the raise and the mutations); the naming hook, which has no version;
any compile or run of the generated examples.

**Standing:** not decided. The builder's verdict was "not refuted; confirmed
with conditions"; the checker's, "not decided", leaning towards confirmed
for projects whose copy record is intact and packs that ship old-style
components. The evidence supports this much: retiring the per-language
components can be made safe for `doctor`, `remove`, `target add` and
`package update`, for every measured state in which the project's copy
record holds the retired copy as unchanged, given two tool changes (the
lifecycle change, in the frozen state; the orphan-compiled finding, on the
H5 branch); without them, 8 rows are unsafe. A pack whose targets ship
old-style components keeps generating, with one intended shared line
changed. It is not safe, with or without the changes, for a copy the record
does not hold as unchanged (no record, a damaged record line, files restored
after an update): an old component writes pages while `doctor` exits 0. And
a pack that ships providers either changes its pages silently at an
interface change, without a version, or stops generating at each raise until
it releases, with one (inferred, not run as a pack). Two structures would
decide it: retired copies recognised without the record (for example, the
package shipping the fingerprints of every released version of each retired
file), and an interface that can move without stopping a pack. A follow-up
built both, and they were attacked in turn (below).

**The two structures, built** (a builder, ran):

- **Retired copies recognised without the record.** The package ships
  `ts/project/sdkgen-retired.json`, made from the release tags by a new
  `npm run retired` with the copy record's own fingerprint function: 129
  files, 552 fingerprints, 18,804 bytes (7,257 gzipped), from v0.0.1 to
  v4.44.0, in about 3 seconds. `doctor`, `target add` and `package update`
  read it, and `remove` follows `doctor`: a copy identical to a released
  version is retired and removed whatever the record says or lacks. A
  record line that cannot be read is now a `doctor` finding that fails
  the check. A changed or unrecorded copy of a section a shared component
  writes fails `doctor` until the model declares it
  (`main: kit: target: <t>: override: <Name>: true`). The builder
  reported that the duplicated rules the first attack listed were each
  moved to one place; the second attack found that the shared loaders
  that decide which component file is used (`ts/src/cmp/ReadmeQuick.ts`,
  `ReadmeRef.ts`, `ReadmeTop.ts`, `Registered.ts`) still build its path by
  hand, and that the declared interface is still read two ways.
- **An interface that can move without stopping a pack.** A provider
  that declares the previous interface (3.2), or none, compiles unchanged
  and generates on 3.3 with one warning per target. All five breaking
  changes from 3.2 to 3.3 could be served; one (`testMock`) only after its
  requiredness moved from the type to generation time. The cost: about 70
  shared lines of machinery and 2 to 6 lines per breaking change, and each
  raise needs someone to decide how each change is served.
- Re-runs: rows 5b, S14 and S17b and two new states are now safe; the
  synthetic damaged-line state and an undeclared edited copy are now loud.
  Action tests 336 of 336; the suite 2,650 pass, 0 fail, 5 skipped. The
  builder's verdict: confirmed with conditions (a release must run
  `npm run retired`; a copy taken from an unreleased build is recognised
  only for the three shared sections).

**The structures, attacked** (an independent checker, ran). Every row and
state re-ran with the builder's outcomes, and the list regenerated to the
same bytes. Of 19 new states, 16 were safe and 3 were not:

- A project copy edited to equal an older release's text is called
  retired and deleted by a plain `package update` in merge mode, with no
  warning, even where the model declares the override: a released
  fingerprint outweighs both the record and the declaration.
- A release that forgets `npm run retired`, on a project with no record:
  the stale component is kept and used, and `doctor` says the project
  matches. The list of shared sections is hand-written, so the
  declared-override rule does not reach a newly retired component.
- A provider that imports the interface constant by a deep path compiles
  and generates with no warning, and so passes every later raise unread;
  the package has no exports map.

Each traces to one rule, and each has a local fix (a release match must
not outweigh a record that says changed, or a declaration; derive the
shared sections from what is retired and check the list's completeness;
read the declared interface from the loaded value only). None is built.
Five of the builder's changes can be reverted without any test failing,
and the served pages' behaviour is not pinned by a test. Through the
compatibility layer a served provider gives a less complete page than a
current one, never a more wrong one than its own previous page; a fact
of the wrong type, a printer that returns nothing, or a required fact set
to an empty string, each smuggled past the type checker with a cast, still
gives a silent wrong page. The checker's verdict: confirmed with
conditions, moderately sure.

**Standing after the follow-up (history):** confirmed with conditions by the
builder and the checker, and not yet as built. H5 is refuted only if
retirement cannot be made safe without breaking the tool's rules, or if a
pack's targets stop generating; every unsafe state found traces to one
rule with a local fix, and packs keep generating. As built, two states
that need no damaged record are still unsafe. The three local fixes are
to be made in the integration and attacked there.

**The three local fixes, made at the integration** (integrating builder,
ran; each with a test that fails without it):

- **An edit that equals an older release.** A record that says the copy
  changed, or an override the model declares, now outweighs a released
  fingerprint; the fingerprint decides only where no record speaks. This
  changes what an add does: it no longer refreshes a copy the record says
  the project changed, even when the copy matches an old release's text.
- **A release that skips its list.** The sections whose components count
  as overrides are now derived: the three shared sections plus every
  optional component the retired list names. `doctor` and `target add`
  read the list of the installed source, and a test runs the list
  generator against the release tags and fails if the committed list
  differs. The list was regenerated: 150 files, 21 more for the seven new
  languages. The integration counts this as breaking for a project that
  holds an undeclared changed copy of a retired optional component.
- **The interface read from the source text.** `package check` no longer
  reads the declared interface from the provider's source; generation
  reads the loaded value. Made in part: a deep import of the interface
  constant from its internal module still bypasses it. The integration
  recorded an exports map in `package.json` as the remedy.

**At twenty, rebuilt** (independent measurer, ran). All the earlier
fixtures and builds had been deleted, so the measurer rebuilt the fixtures
with 4.44.0 from the descriptions and re-ran section 1 and rows 9, 10, 13,
14 and 16, the states S1 to S18, the second attack's three unsafe states,
and the previous-interface packs. Every row re-run has its earlier
verdict. Row 1
now retires 21 copies, because js and php are ported. A project with all
twenty targets has 60 retired copies (20 x 3); a package update prunes all
60, and the 40 per-language pages and the root README equal a fresh
project's. The edit equal to an older release, with or without a declared
override, is now kept and used, loudly when undeclared. The skipped list
is caught at release (the list generator's check exits 1, and the publish
workflow runs the test suite with full history, so the completeness test
would block it) and, if released anyway, `doctor` fails on the stale
component as an undeclared override; the stale page is still written until
the project acts. The deep import of the interface constant compiles,
generates with no warning and now passes `package check` with no finding:
the misreading is gone, the bypass is silent. Its effect at a raise could
not be shown, because no raised build could be made. A pack that ships the
language's component beside the bundled one (`lua~lp`) now gets 7 changed
REFERENCE lines from the catalogue edits, and generates. Not re-run at
twenty: the interface raise and the restored-files state (both needed
release builds that no longer exist), the language pack row, the
previous-interface page comparison against 3.2's own output, the provider
mutations, and thirteen of the second attack's other states.

**The fixes, attacked** (independent attacker, ran unless marked):

- **The derived section list is wrong in one direction.** The retired list
  names nine optional components (among them `ReadmeIntro`, `ReadmeHowto`,
  `ReadmeModel`) only because dart, haskell, lean and the seneca provider
  left the bundle; no shared component writes them. So a consumer target's
  own `src/cmp/go-cli/ReadmeIntro_go-cli.ts`, which the repository
  documents as a safe extension that `doctor` reports as additive, is now
  reported as an undeclared override and fails `doctor` (run end to end
  once, for go-cli; the other names and consumer targets were derived, not
  run).
- **The interface fix removed an author-side check.** `package check` used
  to report an error for a provider declaring a version the generator
  cannot serve ('3.1'); it now says nothing, and the author learns of it
  only when a consumer generates. The test that pins the change fails when
  it is reverted, but what it pins is silence. The recorded remedy is
  ruled out by the repository itself: `ts/package.json` deliberately has
  no exports map, and `ts/test/packaging.test.ts` guards that (read).
- **The interface field is breaking in effect.** At `v33-frozen`
  `testMock` was required in the type and there was no interface field; at
  `v34-frozen` a provider that declares no interface is served as the
  previous one. kotlin's provider with its `interface` line removed is
  served 3.2 with a warning and its REFERENCE loses a clause. All seven
  new providers needed a commit for it.
- **The language pack generates.** Its suite against the frozen state: 76
  tests, 74 pass, 0 fail, 2 skipped (no dart or ghc here); dart, haskell
  and lean generate with no placeholder, and `package add` installs all
  three. Not run: the suite on the old build, and `doctor` or `remove`
  over a project the pack installed.

**Standing at twenty:** not refuted. Retiring the per-language components
can be made safe for `doctor`, `remove`, `target add` and `package update`
in every measured state, and packs keep generating, including providers
written for the previous interface and the language pack's three targets.
Every unsafe state any attack found traces to one rule, and each has a
local fix but the deep import, whose recorded remedy is ruled out and for
which no other was tried. As built it is not safe throughout: the
deep-import bypass is open and silent; the derived section list makes
`doctor` fail a documented extension; a release that skips its list is
now loud rather than silent, but the stale component still writes its
page until the project acts; and the interface raise, the restored-files
state, edition components and a pack carried across a real release were
not run at the final state.

---

## 4. How far the proposal reaches across the catalogue

The maintainers' first question was whether the proposal is a general
solution or a list of individual fixes. Every one of the 329 entries of
`docs/design/model-dependent-text-issues.md` was given one class by where
its text is written and what its fix needs. The answer, on this evidence:
the proposal is not a general solution to the catalogue; it is a general
mechanism for the per-language documentation text, and most of the catalogue
stays a list of individual fixes or needs shared derivations the proposal
does not supply. Its mechanism reaches about one entry in five (66 of 329;
58 to 70 across the open borders), and the prototype tested about one in
eight (38). At twenty languages, 34 of the 36 that are fixed or due are
fixed by shared code alone, S13 takes one declared fact per language, and
D26 is half done; one of the fixes made once introduced a sentence false
in 17 runtimes (section 3.3). The classes are a reading checked by two
samples, not a measurement (section 4.4). A quarter (81) is already written
once; 46 of those need shared derivations that the proposal assumes and does
not supply.
Just over half (175) is text the proposal does not touch: consumer targets'
writers, generated source, the tools, the language pack's text, and one
language's own sentences. Of the plan's 46 work packages, 2 would disappear
into porting their families, 9 would shrink and 35 would stay. The row for
every entry, with its class and reason, is in
`docs/design/model-dependent-text-classes.md`.

### 4.1 The classes

Each entry was classed from its Fate, Class, Where and Fix lines in the
catalogue (sdkgen 9aebaf9e), by reading, not by running. "Distinct" counts
a defect once: 66 entries say in their Fate that they repeat another, which
leaves 263, and a repeat is counted under its root's class.

| Class | What it holds | Entries | Distinct | Range, entries | Range, distinct |
|---|---|---|---|---|---|
| T | In the three sections the prototype built, as the H3 measurement scoped them (13 wholly, 25 in part) | 38 | 26 | 37 to 38 | |
| S | Written by per-language documentation components outside those sections, of the same kind (a model fact, 20; a runtime fact, 8): writing that family once would fix it. Not built | 28 | 24 | 21 to 32 | 18 to 27 |
| L | One language's own text, which no other language repeats | 6 | 6 | 5 to 13 | 5 to 12 |
| O | Already written once, in a shared component, helper, model or schema: one edit, whatever is decided. Needs a derivation no shared function gives at 9aebaf9e: 46; a plain edit: 35 | 81 | 67 (39 and 28) | 78 to 81 | 65 to 67 |
| C | A consumer target's own writer (go-cli, go-mcp, py-data) | 33 | 28 | | |
| G | Generated source: its behaviour (31) or a comment in it (9) | 40 | 29 | 35 to 40 | 24 to 29 |
| K | The tools: the generator's own actions and warnings, docgen, create-sdkgen, apidef | 83 | 65 | 83 to 84 | |
| P | The language pack's own text | 13 | 12 | 13 to 18 | 12 to 17 |
| N | Not a defect | 7 | 6 | | |
| Total | | 329 | 263 | | |

T's 26 distinct here and the H3 measurement's 30 (section 3.3) count the
same 38 entries differently: here a repeat counts under its root, and four
in-scope entries repeat a root outside the sections (S13 repeats S11, a
tool error; M37 repeats G28, a jostraca mode; X6 and S25 repeat S29 and
S23, both class S).

### 4.2 The three numbers

1. **What the mechanism addresses (T and S): 66 entries (20%), 50
   distinct (19%).** Range 58 to 70 entries (18% to 21%), 44 to 53
   distinct. The prototype tested the T part: 38 entries (12%), 26
   distinct (10%). Within T, at 3.3 and after the independent check, 28
   were fixed by shared code alone, 1 needed lines of each language
   (S13), 1 was fixed only in part (D26), 6 were not fixed (X3, S22, U52,
   U53, V27, U102: shared before the prototype, and edited by it, but not
   for these entries), and 2 showed only in js, which was not ported (N11,
   M35). At twenty languages: the six were fixed by one shared edit each,
   so 34 are fixed by shared code alone; S13 needs one provider line per
   language; D26 is half done (its rows for `extend` and `utility` need a
   declared fact per runtime); N11 and M35 are fixed for js through the
   fence its provider declares. The fix for X3 printed a new sentence that
   is false in 17 runtimes (section 3.3).
2. **One edit today (O): 81 entries (25%), 67 distinct.** Range 78 to 81
   entries, 65 to 67 distinct. Of these, 46 entries (39 distinct), give or
   take 3, need a derivation that no shared function gives at 9aebaf9e:
   `targetSurface`, `targetPlace`, `docLink`, `featureOnByDefault`,
   `modelCopyMode`, a release-tag helper, `apiDisplayName`,
   `definitionKind` and others. That is the "one answer per fact" half of
   the design note (`docs/design/model-dependent-text.md`), which the
   proposal's resolved description depends on but which the prototype
   built only for the facts its three sections print. The other 35 entries
   (28 distinct) are plain edits. Section 4.5 counts the entries that name
   one of the design's shared derivations, across every class.
3. **What the proposal does nothing for (L, C, G, K, P): 175 entries
   (53%), 140 distinct (53%).** L 6 (6 distinct), C 33 (28), G 40 (29),
   K 83 (65), P 13 (12). Range 174 to 183 entries (53% to 56%), 139 to
   146 distinct. With the 7 entries that are not defects, 182 (55%). The
   proposal's first point says code generators can read the same
   description; no fix to generated code was built or measured that way,
   so G is counted here as untouched.

By catalogue section, entries (T, S, L, O, C, G, K, P, N): S 7, 7, 0, 22, 7,
0, 6, 0, 1; X 2, 1, 0, 4, 0, 0, 0, 0, 0; G 3, 3, 0, 5, 9, 7, 4, 0, 0; V 1,
2, 3, 4, 1, 8, 12, 1, 0; U 9, 8, 3, 31, 11, 8, 22, 10, 6; N 2, 0, 0, 3, 1,
4, 13, 1, 0; M 7, 2, 0, 6, 2, 8, 23, 1, 0; D 7, 4, 0, 6, 2, 3, 1, 0, 0; A 0,
1, 0, 0, 0, 2, 2, 0, 0.

### 4.3 The 46 work packages

Fate if the proposal were adopted for every README family, read from the
classes of each package's issues (membership from appendix A of
`docs/design/model-dependent-text-plan.md`):

| Fate | Packages | Which |
|---|---|---|
| Disappears into "port that family" | 2 | WP29 (quick start, options row and REFERENCE constructor copies: T 9, S 1); WP31 (operation-dependent prose in the model, quick, intro and REFERENCE copies: T 6, S 8) |
| Shrinks | 9 | WP18, WP21, WP28, WP30, WP32, WP33, WP34, WP35, WP37: each loses its README part and keeps generated-code, escaper, harness, Makefile or one-language work |
| Stays | 35 | Among them WP08 (its T entries, in `ReadmeRefFeatures.ts`, were fixed by one shared edit each, which needed no port), WP16 (needs `featureOnByDefault`), WP22 (a generate and doctor error), WP36 (34 issues, 33 of them a consumer target's), WP41 (the pack would have to port its own families), and four with no issue of their own (WP03, WP19, WP27, WP44b), which supply what other packages read: the text guard and the derivations, which the proposal still needs |

One border could move one package: if S05, U58 and X1 fell to S, WP07
would shrink, giving 10 and 34. A package that disappears or shrinks does
not make its work vanish: each family still has to be ported, and the
prototype ported three sections.

### 4.4 How it was checked, and what the check could not settle

- **Classification.** Four classifiers each classed part of the catalogue
  (88, 86, 78 and 77 rows). A checker confirmed by script that the tables
  hold exactly 329 rows, one per entry heading, with none missing,
  doubled or extra.
- **First sample, not blind.** The checker re-decided every entry whose
  number ends in 2 or 8 (65 entries) and agreed on 61 (94%). The checker
  had seen the classifiers' tables first, so 94% is an upper bound. Fifteen
  entries were corrected on two rules and one consistency fix: an entry
  whose whole fix is another entry's tool error takes that entry's class
  (S12, S14, S19, S20 to K); docgen's text is K (U63 to U67, U76, U98,
  U106, A01, M48); the pack's generated code is G, as for M16 to M18 and
  A03 (U88).
- **Second sample, blind.** A second classifier who had not seen the table
  classed every entry ending in 2, 5 or 8 (100 entries; 65 shared with the
  first sample, 35 new). Agreement: 95 of 100 on the class, 93 of 100 on
  class and sub-class; 60 of 65 on the overlap, 33 of 35 on the new
  entries. Of the 7 disagreements, the table was wrong once (U15's
  sub-class: a plain edit, corrected), the blind rows twice on the class
  (V2, M18) and once on the sub-class (G18), and 3 are not decided by the
  rules (S05, U58, U88). With no class error in 100, the 95% upper bound
  on the error rate is about 3%: up to about 7 of the 229 entries outside
  the samples could still be wrong.
- **What limits it.** Both readings worked from the same structured lines
  of the catalogue, so they are not fully independent. Entries outside
  the samples were not re-read against source. The package fates are a
  reading of classes, not a measured port; no family beyond the three
  sections was built.
- **Borders left open, carried as the ranges above.** O or S: S05, U58 and
  X1, shared writers holding a per-language wording table whose fix is a
  per-language idiom, which is what a provider supplies. G or P: U88, M16,
  M17, M18 and A03, generated source the language pack owns (moves entries
  between G and P only). S or L: S15, S27, G03, V1, U42, U59, U60 and D27,
  sentences repeated in a few install, explanation or how-to copies. Two
  rules collide on S13 (and S25): T by the H3 scope, or the class of the
  entry its fix resolves with. The H3 checker added U37 as arguably in
  scope (section 3.3).

### 4.5 What this means

Where it was applied, the mechanism works as described: in the three
sections built, 34 of the 36 entries that are fixed or due were fixed
once, in shared code, for all twenty languages (28 by the ports and 6 by
later shared edits that touched no language's file). Of the other two, S13
needed one declared fact in each language and D26 is half done. But the
claim of "fixed once" is not shown in full, because one of the six shared
edits wrote a new sentence from a model fact that 17 runtimes contradict,
and no check saw it (section 3.3). The 28 S entries
are of the same kind and would plausibly follow if their families were
written once; they were not built, and the analyst's reading of those
families (section 5.5) found that part of them is about one language.

Its reach is about a fifth of the catalogue (66 of 329; 58 to 70 at the
ends of the ranges). On this evidence the proposal is not a general
solution to the catalogue, and the record does not support calling it
one. It is a general mechanism for one part of the problem: the
per-language documentation text. Adopted for every README family, it
would remove 2 of the 46 packages and shrink 9, by a reading of their
issues' classes rather than a measured port.

A quarter of the catalogue is already written once, and writing sentences
once changes nothing for it. More than half of that quarter needs a
shared answer to a fact that no function gives today. Just over half of
the catalogue is consumer writers, generated source, the generator's own
tools, docgen, create-sdkgen, apidef, the pack's text and a few sentences
of one language's own. Those remain individual fixes, and with the O
entries they make up the 35 packages that stay.

The principle that spans more of the catalogue is the one the proposal's
first point restates: one resolved answer per fact, read by every writer
(documents, code generators, consumer targets, docgen). Writing each
sentence once is that principle's documentation half.

How far one answer per fact would reach was not measured, but the
catalogue itself gives a count. Each entry's Class line names what its fix
needs, and 129 of the 329 entries (100 of the 263 distinct) name at least
one of the shared derivations the design note and the plan define:
`targetSurface` 44, `targetPlace` 32, `requiredOptions` 26, `docLink` 14,
`mdCell` 12, `mdInline` 9, `guardModel` 8, `featureOnByDefault` 7,
`modelCopyMode` 4, `entityDescription` 1 and `targetFeatures` 1 (an entry
can name several). By the classes of this section: O 38 of 81, K 30 of 83,
C 18 of 33, T 18 of 38, G 13 of 40, S 8 of 28, P 3 of 13, N 1 of 7 and L 0
of 6. Taken with T and S, 169 entries (51%; 131 distinct, 50%) are reached
by one of the two mechanisms, and 26 by both. The other 160 are reached by
neither: 6 are not defects, and 154 are individual fixes (K 53, O 43, G 27,
C 15, P 10, L 6). This is a count by script of what each entry's fix was
written to need, at the classes of
`docs/design/model-dependent-text-classes.md`; it is not a measurement of
what a derivation fixes, and the class O's own sub-count (46 entries
needing a derivation) includes derivations outside this list.

---

## 5. What the build found that the proposal did not say

### 5.1 Writing a sentence once makes it a claim about twenty runtimes

A shared sentence is true of every runtime that prints it, or it is false
somewhere. The proposal treated runtime differences as data, which is
right, but it did not say that most differences are not known until a
sentence is written once and read against each runtime.

The sentence review (stage 8) read all 297 distinct shared sentences and
found 14 false ids (six distinct sentences) and 35 awkward ones
(independent, read). The six, of which item 4 is two sentences:

1. "The client reads its API key from the `X` environment variable." No
   runtime reads a `*_APIKEY` variable; the example does. The shared code
   introduced this sentence and eight rule records accepted it unread. Run
   in ts and py with the variable set and no option: no credential was
   sent.
2. direct()'s Returns: "on a failure `ok` is false and `err` holds the
   error". A readable non-2xx response has `ok` false and no `err`. Run in
   ts, py and go (four cases each); read in the other seventeen.
3. The control example `explain: true`. Every runtime takes a map; ts
   throws on `true`. This was false on the old pages too. The reviewer's
   replacement `{ explain: {} }` was also false (direct records nothing in
   it; php ignores an empty array); the example was removed.
4. The test client without the test feature: ts `test()` threw (no
   fallback in `makeFeature`), and zig and clojure keep the real mock. The
   sentence now depends on a declared fact, `testMock`.
5. "An action returns that action's OWN response." An action is a create
   call and returns the entity. False on the old pages too. Run in ts and
   py.

Each was fixed once in shared code; the eleven unported languages' pages
did not move (418 files byte-identical). An independent verifier re-ran
all six and read the 41 changed or new sentences: 39 ok, 2 awkward, 0
false.

Fixing them cost more than the edit (section 6.2): 376 classes reopened
and 361 hand records added across nine languages. The first self-test run
after the fixes failed 40 controls: 22 had been written against text the
fixes retired (16 injections, 6 identity controls) and were re-aimed, and
the run exposed two tool defects, then fixed (builder, ran).

Earlier and later, the same pattern:

- "as they arrive" for streams was false for every runtime, ts included:
  every streaming feature yields from a response already read whole (stage
  6, read).
- Within one stream kind, runtimes differ in when the operation runs, so a
  second fact (`runs`) was needed; the shared "call" sentence was then false
  for java, kotlin, scala and perl, none of which was ported yet (stage 6,
  read).
- At the first wave: lua's accessor returns a kept instance when called with
  nil (php does the same), so "Create a new instance" is false; ocaml's
  `direct()` is not a call, `e_name` is a field, and its client members are
  module functions under "Instance functions" (reviewers, read).
- The utility getter: ts and js return the live object, not a copy,
  because `struct.clone` keeps a class instance by reference (run in node).
  A quoted `clone` call is therefore not proof of a copy (stage 9 survey,
  ran).
- The 3.3 shared round's own new list sentence said `list(nil, nil)`
  "lists every record", which go and ts contradict (they pass the entity's
  stored match). No check saw it; the freezing builder found it by reading.

A survey of all twenty runtimes by ten readers, two runtimes each, answered
twelve questions from the source, each answer one reader's claim with file
and line, read and not run. Where all twenty agree (direct's result in four
cases; explain taken only as a map), one sentence serves. Where they differ
(accessor caching in php and lua; live getters in py, rb, elixir; no stream
signal in c, cpp, rust, zig; cancellation only in ts and js; when a stream's
operation runs; what remove leaves), a declared fact is needed.

At twenty languages the same pattern again, each found by a reviewer, a
verifier or the attacker of the last wave:

- The `secrets` sentence of the verdict: written once from the feature
  model's hook declaration, false in 17 of 20 runtimes, passed by every
  check (attacker, read in all twenty).
- The stream sentence named its key as `callopts.signal`, TypeScript's
  notation, in every language; in C#, Kotlin, py, rb or lua the key is not
  written that way, and each runtime reads only one or two forms of the
  signal and silently ignores any other value, which the page did not say
  (csharp and kotlin reviewers, read). The integration put the key in
  words and added an optional fact for the form; only kotlin and csharp
  declare it.
- The remove sentence ("`data()` reads its record") is false for cpp,
  whose remove keeps the data the entity held and takes only the match
  from the response; the guide had said every runtime replaces the data
  (cpp reviewer, read; fixer, ran). Fixed at the integration by an
  optional fact.
- A shared naming decision, one name for the list item and the entity
  loaded after it, does not compile under C#'s whole-block scope (section
  3.4). Fixed at the integration by an optional language fact.
- java's deleted read names a class (`EntityBase`) that no page imports
  (java porter and reviewer, ran). Fixed at the integration by filling the
  package into the read.
- The feature Usage sentence prints the option key in bracket notation,
  which is not code in six of the typed languages (attacker, read).
  Recorded as awkward, not changed.
- The unported README sections still say what the REFERENCE now corrects:
  "On error, `ok` is `false` and `err` contains the error value" stands in
  12 languages' README components, and a readable non-2xx response sets no
  `err` (kotlin verifier, read).

Each correction that was made is one change for every language, which is
the proposal working. Each of these was found by a person reading runtime
source, not by a check, which is the cost the proposal did not state.

### 5.2 A declared fact needs a check, and an account is not one

A provider declares facts about its runtime. Six declared facts were wrong
in six languages at 3.1 and printed false sentences on every page: five
providers said the entity accessor takes initial data (it takes entity
options), py named a keyword its runtime lacks, and rust's direct note
claimed an `Err` its runtime never returns (guard builder: read, then
confirmed by the guard). At 3.2,
clojure and elixir declared lazy streams that read every item first, c's
page omitted two real client members, and elixir's arity notes were false
(guard builder, read).

The guard re-derives or cites each fact from the runtime source. Its
history, by mutations of provider and forms files:

| At | Mutations caught | Who |
|---|---|---|
| Version 3 freeze | 27 of 52; 11 of the 25 misses not listed as unguarded | checker, ran |
| 3.1 | 43 of 52, the 9 others in stated categories; 62 of 71 on the builder's own set | builder; checker reproduced 43 |
| 3.2 | 68 of 75 earlier; 17 of 19 newer; 11 of 12 new | merging builder, ran |
| 3.3 | 97 of 108 (5 not caught, the rest errors as before); 31 of 37 recorded attacks; 14 of 14 new attacks | freezing builder, ran |
| 3.4 | the old sets: 49 of 59 and 94 of 108, v33's result (one more caught because a php provider copy now builds); on the seven new providers, a printed method the runtime lacks and a dropped member caught in all seven, a wrong fact whose citation was moved to a real line holding the new token caught in none | attacker, ran |

On the way, the guard was found to have defects of its own: its
undocumented-member check had never fired in any language (a literal
`{ctor}` in its list became the wildcard `\w+`); its regular expressions
knew six language families; a citation of an undeclared fact was excused
as "ahead of a provider"; a missing field flag was never checked. Each was
closed when found.

The last wave found the largest such defect. The guard's check of the
entity accessor call looked up the accessor's declaration through a
function that rewrote its token (the dollar-brace placeholder gained a
second dollar sign), found nothing, and skipped the check without a word,
in six languages: php, elixir, java, kotlin, scala and cpp. Every freeze
before 3.4 passed while those six languages' accessor calls were never
judged for arity, receiver or separator (the php fixer and the cpp
reviewer found it; the integration fixed it, with a control). A related
limit stays: where instance and type calls share the `.` separator (java,
kotlin, scala, csharp), neither the guard nor the printed-call check tells
`DemoSDK.planet(...)` from `client.planet(...)`, which javac rejects;
recorded, not made.

What the attacker showed at the frozen state, beyond the stage-7 rule
(each ran): leaving out an optional fact, declaration and citation
together, passes the guard (105 of 105) and the one command for the stream
signal in csharp, java, kotlin and scala and the deleted mark in js, and
the true sentence vanishes from every page; leaving out php's cached
accessor or cpp's remove that keeps its data brings back a sentence known
to be false for that runtime, shown only by one open class for a person. A
wrong fact whose citation is moved to a real runtime line that happens to
hold the new token passes the guard in all seven new languages. A
code-valued citation without a value pin passes any wrong value whose
tokens stand in the quote (csharp's verifier showed that a pin closes it;
the integration pinned csharp's three and one of java's, and the container
fact of java, kotlin and scala still passes a wrong type this way). A
forms file can declare that its language writes calls without parentheses,
which makes the constructor check pass vacuously (cpp verifier). Removing
a getter's copy fact with its citation, then giving one false reason for
the sentence that vanishes, makes the one command pass (php verifier). And
three of the integration's own changes have no test that fails without
them: the layout fill of the deleted read, the rule that a declared call
factory occurs in the runtime, and the csharp and java citation pins.

What the guard cannot catch is in appendix C. In short: a citation whose
quote holds the token but means something else; prose that is false under
a feature option; argument order and anything only a compiler shows, where
there is no compiler; a value that agrees with an old page that was itself
wrong.

Shared defaults were hiding defects. When the second fix round made shared
fallbacks throw, clojure's REFERENCE broke at once (its signatures had never
been parsed), and c, zig and go were found to print defaults that were true
only by luck. A required fact also needs a run-time throw: with `okFalse`
bypassed, the page would have printed `undefined` (stage 6, builder).

Each fact the guard checks also costs data per language: at 3.2, a forms
file of 54 to 113 lines, a test constructor, a 7-line stream record,
receiver and failure markers, and citations for `none`, `okFalse` and each
absence.

The table of runtime facts the porters follow, itself generated from the
forms, missed three facts of the seven unported runtimes that the guard
would trip on: kotlin's no-argument secondary constructor (`constructor() :
this(null)`, `ts/project/.sdk/src/cmp/kotlin/fragment/Main.fragment.kt:10`),
scala's `def this() = this(null)`
(`.../scala/fragment/Main.fragment.scala:10`), and js's `name` field
(`.../js/fragment/EntityBase.fragment.js:7`), which the table lists as a
member the runtime does not have (guide writer, read; recorded in the guide,
not yet corrected in the forms). The second wave's porters met all three and
corrected the forms, and found more: public client fields the table omits
(php, java, csharp), private and protected cpp members it shows as
callable, a csharp parameter reader that named every defaulted parameter
after its default value, a deleted mark declared only on a base class the
examples' type cannot reach (java, kotlin, scala), and stream signals
honoured in one form only. Citations made "ahead" in the seven's forms
(`streamSignal`, `okFalse`, `testMock`, and `cached` for php) become
failures the moment a provider exists unless the provider declares the
pinned value; the freeze made that change and the guide for 3.3 is the first
place a porter reads it.

From the other side, H5 showed that a declared fact is checked only in
sdkgen's own repository: a project that edits its copy of a provider can
make its pages state a false fact, and nothing in the project fails
(section 3.5).

### 5.3 "The same sentence" has to be defined before a sentence can be reviewed once

The review tools match NEW sentences against reviewed ones by masking the
tokens a language supplies. Until stage 9 the matching was unsound in two
ways (sentence reviewers, read; tools builder, ran):

- shared words that happened to equal a model name or a fact value
  (`record`, `utility`, `id`, `fields`, `data`, `err`, `array`) were masked,
  so a wrong word there matched a reviewed sentence;
- one template was split into many "distinct" sentences by printer output,
  backticks, articles, numbers and go's bold step leads: 178 of 297 entries
  named one language alone.

The identity fix made 297 ids into 227, each with a carried verdict
(builder, ran). The independent verifier then showed the new form still
accepts wrong prose automatically when a language's own fact of another
kind stands in the slot (zig `.ok`/`.err` swapped, py `list()` for
`data_get()`, rb `Hash` for `Array`), masks numbers and the article before
a model name, and misses go's or c's branch sentence dropped from every
variation (ran). A parallel tools round closed these on its own branch (266
controls, 0 failed) and was itself beaten by 3 of its own attacks (builder,
ran). It was then merged onto the frozen tools for the base of the last
seven ports, where, re-run over the thirteen, it opened no class, found no
absent or dropped sentence and no page-check finding, and the only class
change was four shared matches that now name ts as their reference with
the same outcome (base builder, ran).

At 3.2, 229 of 297 distinct shared sentences rested only on rule records
nobody had re-read, and none had a verdict. Stage 8 gave every one a
verdict. At 3.3, sentences printed only by the four new ports have no ids
yet in the reviewed set; the freezing builder gave verdicts in the record.
At the base, 81 of the 312 distinct sentences the thirteen print have no
verdict in the reviewed set for that reason (section 3.1). At twenty, 164 of
385 distinct sentences have none: 128 printed only by the eleven languages
ported after the nine reference languages, and 36 changed or re-masked
since the review (measurer, ran). Growing the reference set from nine
languages to twenty moved every class id, so every language's hand records
had to be re-keyed at the integration (0 conflicts, no entry lost), and
larger result-style groups produced new lists of sentences absent in one
language.

### 5.4 The comparison with the old page is a reading aid, not a check

The review tools compare each NEW page with the OLD page of the same
language. Nearly every wrong port in the first wave was caught only there,
as an open class that the porter then decided by hand (reviewers, ran).
Three things limit it:

- A language with no old page, or a result style no reference language
  shares, has no comparison. For perl ("die") and swift ("wrapped") the
  dropped-sentence nets were empty by construction; dropping a shared
  sentence from one or all variations moved no number from scratch.
- The old page can be wrong. ocaml's keys "member" and swift's entityBy
  "Name" agree with OLD (152:0 and 282:0) and are wrong (tools builder,
  ran). Fact attestation against OLD can call a wrong value attested.
- Hand records are pinned by count, not content: five had gone stale
  unseen at 3.2, and the reviewers found wrong hand records in ocaml and lua
  (one hid a contradiction).

This is the reason for the stage-7 rule (section 2.2). At 3.3 the guard
and tools catch most of the first-wave attacks without the comparison;
appendix C lists what they still do not.

In the second wave the comparison was again where many attacks surfaced.
The reviewers of cpp, csharp, java, kotlin, php and scala ran between 26
and 37 attacks each (js's reviewer grouped its attacks and gave no
count), and in each language some were not caught mechanically, showing
at most as open classes that a porter decides by hand: 7 of 33 runs in
cpp, 7 of 37 in csharp, 7 of 26 guard attacks in java, 13 of 37 in
kotlin, 9 of 31 in php and 14 of 31 in scala; in js, among others, three
wrong facts in one source change that opened no class at all.
Two cases show how much rests on a person. csharp's five root quick starts
that do not compile were held failing only by the porter's honest defect
records: the verifier relabelled the three records of the duplicate name
as the same meaning and deleted a fourth (the stream sentence's), and the
one command printed PASS with the five blocks still on the pages. And the
integration accepted the catalogue round's changed sentences for the seven
new languages by written rules that matched the text, not by reading the
runtimes; the false `secrets` line went through that way.

### 5.5 Per-language content is not all syntax

The analyst of the other ten README families measured that across them
72% of prose units but only 42% of words are shared by 15 or more
languages, and that Install and Explanation have 0% shared by 15 or more
(81% and 50% of units in one language only). These figures count the
per-language README families together (intro, install, quick, how-to,
model, entity, explanation); the quick start, one of the three sections
under test, is among them at 77% of units. Install and Explanation are
documents about one language, not shared sentences. By the same analyst's
hand classification, prose genuinely about one language is about 8% of
units but about 19% of words across those families, over H1's 15% line by
words. Much of the estimated 2.3x to 3.3x shrink for the
whole documentation is dead code (`ReadmeOptions`, 1,206 lines, renders
nothing) and deduplication that needs no provider interface (analyst,
read).

### 5.6 Porting one section at a time makes documents contradict each other

A fact is stated in up to ten documentation families (the error convention
in 10; the data accessor in 10; the API key in 5). Porting the quick start
first made the ts README contradict its own options table about `region`;
porting the REFERENCE made an SDK's README and REFERENCE disagree about the
log feature's default, the test constructor, and `region` (checkers, read).
A shared half-fix spread one contradiction into 228 REFERENCE files of the
twelve unported languages before the full fix reached 381 READMEs and 20
root READMEs at once (stages 4 and 5). At 3.3 one contradiction remains in
each of the thirteen: the unported README test-mode section promises a mock
without the test feature (true side: the REFERENCE).

At twenty the same contradiction is recorded in nineteen languages
(clojure has none), and more are recorded where an unported README section
states what the ported REFERENCE corrects: php 5 (among them the accessor
said to create a new instance and `err` said to be set on any error),
kotlin 3 and js 2 (the direct paragraph's `err`), by the integrator's
one-command runs. The ts and js README rows that called the utility getter
a deep copy were corrected at the integration; the js README's unported
"Module structure" section still prints `require` beside the ES `import`
of its tutorial. One reviewer found cpp's record of the test-mode
contradiction wrongly recorded as the same meaning; it was corrected, and
the fixer ran the README's own test-mode block, which throws.

### 5.7 Defects of the generated runtimes, found by reading them for the documentation

Fixed in the prototype only where marked.

- ts, js: `test()` threw without the test feature (`makeFeature` had no fallback); fixed in the prototype with a test; ran.
- ts: an operation given `ctrl` with `explain: true` throws a TypeError (about 8 pipeline assignment sites); js ignores it; ran.
- php: explain is copied into the context, so the caller never sees the record, and an empty array records nothing (`ts/project/.sdk/tm/php/core/Context.php:55`, `ts/project/.sdk/tm/php/utility/Done.php:25`); read.
- py: direct() lets an exception from a caller-supplied `system.fetch` propagate; ran. The survey reads the same in rb, php, perl, lua, elixir, clojure, ocaml and cpp.
- zig: no live transport; `fetcher_util` ends in `ctx.fail('fetch_transport', ...)` (`ts/project/.sdk/tm/zig/core/utility.zig:2332-2336`); read.
- cpp, ocaml: no built-in live HTTP transport either; every live request throws `fetch_no_transport` unless the caller supplies `system.fetch` (`ts/project/.sdk/tm/cpp/utility/pipeline.hpp:600-616`, `ts/project/.sdk/tm/ocaml/sdk_runtime.ml:1574-1579`), and no page says so; ran for cpp (porter, fixer).
- lua: operations document `---@return string? err` while the code returns the `sdk_err` table (`ts/project/.sdk/src/cmp/lua/fragment/EntityLoadOp.fragment.lua:10-12`, `ts/project/.sdk/tm/lua/utility/make_error.lua`); read.
- c: `err` is never reset in examples, and the runtime returns NULL whenever `*err` is already set (`ts/project/.sdk/src/cmp/c/fragment/EntityListOp.fragment.c`); read.
- swift: `deleted()` is not on the Entity protocol; read.
- elixir: entity modules do not delegate `deleted/1`; read.
- java, kotlin, scala: `deleted()` is declared only on `EntityBase`, not on `SdkEntity`, the type the accessor returns and the examples bind; read (survey; the three porters), and for java ran (javac: cannot find symbol without the import).
- ocaml, cpp: an entity is marked deleted whatever the outcome; ocaml after a failed remove under `throw: false`; read.
- csharp, scala, kotlin, java: accessors write `active` into the caller's options map (kotlin `EntityBase.fragment.kt:28-34`); read, and for java ran: passing an immutable `Map.of(...)` as entity options throws UnsupportedOperationException.
- seventeen runtimes (all but ts, js and py): the `secrets` feature defines no `PreSpec` hook although its model declares one active (`ts/project/.sdk/model/feature/secrets.aontu`); csharp's `SecretsFeature.cs:317` says so deliberately. The model and the runtimes disagree, and shared text that trusts the model is false in seventeen languages; read (attacker).
- java: the mock drops a created record when its seed holds none for that entity (`TestFeature.java:228-231`), so an update straight after a create returns 404 in the crud tutorial, on old and new pages alike; read and ran (reviewer).
- cpp: remove keeps the entity's data and absorbs only the match from the response (`EntityRemoveOp.fragment.cpp:12-18`); ran (fixer). The other runtimes replace the data; not a defect in itself, but the shared sentence assumed otherwise.
- csharp: the pipeline marks an entity deleted after any successful operation named remove, `Stream("remove", ...)` included, and `MarkDeleted` is public (`EntityBase.fragment.cs:233-240`); read.
- php: the runtime's comments say remove keeps the data (`Entity.fragment.php:70-72, 394-395`), while `EntityRemoveOp.fragment.php:31-33` replaces it when the response carries a record; read.
- kotlin: `testOptions` sits in `SdkClient`'s companion object, so it is not reachable as `DemoSDK.testOptions` (`ts/project/.sdk/tm/kotlin/core/SdkClient.kt:358-361`); read, not compiled.
- streams: each runtime honours one or two forms of `callopts.signal` and silently ignores any other value (java a `BooleanSupplier`, scala and kotlin a `Function0`, swift a closure, perl a code reference, go a channel, csharp a `CancellationToken`, ts and js an `AbortSignal`; php and lua two forms); read (reviewers, attacker). Not a defect in itself; the pages did not say which.
- all twenty: no runtime streams items off the network; every streaming feature yields from a response already read whole (`ts/project/.sdk/tm/ts/src/feature/streaming/StreamingFeature.ts:52-53` in ts); read.
- fourteen runtimes: the stream reads `callopts.signal` although their operations cannot be cancelled (all but c, cpp, rust and zig read it; only ts and js can cancel); read (survey). Not a defect in itself; the old pages implied cancellation.

### 5.8 Defects of the pages, tests and tools of `main`, found on the way

- c: quick start uses `getenv` without `#include <stdlib.h>`; never compiled with auth active, in README and root README; ran.
- c: root quick start has statements at file scope (gcc: "initializer element is not constant"); ran.
- py: root quick start raises ModuleNotFoundError when run as written from the repository root (it imports once the package is on the path); ran.
- rb: root quick start never loaded from the repository root (LoadError); ran.
- go: root quick start was a fragment, not a program; ran.
- zig: examples print `std.posix.getenv`, absent in Zig 0.16 (documentation lane 5/6); ran.
- zig: `make` is reachable only as `asEntity().makeEnt()` and is documented nowhere (`ts/project/.sdk/tm/zig/core/types.zig:56,64`); read.
- c: page omits `sdk_options_map` and `sdk_get_utility` (`ts/project/.sdk/tm/c/core/utility.c:70,72`); read.
- clojure: old page documents `api/get-utility`, which `sdk.api` does not export; read.
- ocaml: old root quick start invalid in two variations (`let () = let client = ... in` with no body); test signature wrong; step numbering skipped; the unported README prints a TypeScript line (`console.log(ambient.data())`, `README.md:68` of the generated page); read.
- swift: old tutorial skipped step 2, had no server option for a templated URL, and lacked `import Foundation`; read.
- lua: old pages say the accessor creates a new instance and that direct returns `table, err`; read.
- perl: old page printed `->{id}` for an entity with no id field; accessor described as taking initial data; log called inactive by default; read.
- csharp, java, kotlin, scala: old REFERENCE pages say "raise" while the runtimes throw (`EntityBase` fragments); read.
- all twenty: `explain: true` example and "an action returns its own response" were false; ran in ts and py.
- all twenty: an escaped-backtick leak in every REFERENCE; read. The prototype's fix was partial: the feature-ordering note still prints escaped backticks around feature names in all twenty, on old and new output (H3 builder, ran).
- `ts/src/cmp/ReadmeErrors.ts:212`, `ts/src/cmp/ReadmeExplanation.ts:225`, `ts/src/helpers/opExample.ts:16-21`: fall back to TypeScript for 15 of 20 languages; the Error handling section prints TypeScript in 16 READMEs; read.
- `ts/src/cmp/ReadmeRefFeatures.ts:107` on `main`: "Set `feature.<name>.active` to true" prints the TypeScript literal for all twenty (py's is `True`, perl's `1`); at 3.2 the prototype's own `active: false` line has the same fault; left unfixed so the unported pages stay identical; read. The log feature's REFERENCE section also says to set it to true although log is on by default (H3 builder, read).
- `ts/src/cmp/ReadmeTop.ts:245-246`, `ts/src/cmp/ReadmeFeatures.ts:29` and `ts/src/cmp/ReadmeRefFeatures.ts:24` on `main`: every feature is "inactive until switched on", while the log feature is active by default; fixed in the prototype; read.
- the root README test example seeds the mock in 4 of 20 languages (ts, php, rb, perl); read.
- `ReadmeOptions` (1,206 lines) renders nothing; read.
- old REFERENCE generators react to model switches in one language each (an operation removed changes only go; Basic auth only ts); ran.
- stream() is documented in 2 languages (go, zig) and defined in at least ts, py, rb, java; read.
- lua: the old display-field fallback never fired (`ts/project/.sdk/src/cmp/lua/ReadmeQuick_lua.ts:77-80` reads `.name` on a field that has `n`); read.
- elixir: the unported transport section breaks a code span across lines (38 lines over 19 variations); ran.
- unported README test-mode sections promise a mock client without the test feature; the ts example throws; ran.
- perl: the README example runner prepends `use lib`/`use` and replaces `->new` with `->test` (`ts/project/.sdk/src/cmp/perl/ReadmeExamplesTest_perl.ts:238`), so it could not see a missing import, constructor options or wrong call arguments; changed in the prototype; read and ran.
- swift: the generated README test checks only that delimiters balance (`ts/project/.sdk/src/cmp/swift/ReadmeExamplesTest_swift.ts:120-156`); java and cpp README tests are structural; js has none; read.
- php: the README example test removes the page's `require_once` and requires the SDK by absolute path (`ts/project/.sdk/src/cmp/php/ReadmeExamplesTest_php.ts:304-318`), so it cannot see a wrong root import; read (guide writer).
- aliases: an aliased target's REFERENCE prints `any` for every field type (go2 and js2, 15 fields each); the ported go2 now prints go's types, js2 still prints `any`; ran (H5 builder).
- aliases: an aliased go target's README prints ts code in its error handling, entities, features and advanced sections, and the root README labels go and go2 both "Golang"; ran (H5 builder).
- js: the README tutorial and root quick start mix `require` with top-level `await`, which node 24 refuses before the first statement (ERR_AMBIGUOUS_MODULE_SYNTAX); as written, OLD runs 20 of 24, 13 of 17 and 13 of 17 programs in three models; js has no README example lane; ran.
- js: the old pages were an older copy of the ts components: no server variables, no secret, no Actions table, a false utility-copy sentence, and TypeScript fences on the REFERENCE; read (porter).
- ts, js: the README methods table calls `utility()` a "Deep copy of the SDK utility object" (`ReadmeModel_ts.ts:101`, `ReadmeModel_js.ts:79`, on `main`); both return the live object; ran; corrected at the integration.
- php: the root quick start fails from the repository root at `require_once 'demo_sdk.php'` in every model, which the README example test cannot see because it strips that line; ran.
- php: the REFERENCE and README call the GraphQL entity's accessor `GraphQl()`, which reaches the client's own `graphql()` and throws ArgumentCountError; the generated accessor is `GraphQl_`; ran.
- php: the old display-field pick compared a field type with `'$STRING'` without the backticks the model writes, so it never matched and fell back to the first non-id field; read.
- php: the unported README says every accessor call creates an instance (the runtime caches it) and that `err` is set on any error; read.
- cpp: the README's error-handling section prints TypeScript and tells the reader to branch on `getp(result, "ok")`, which cannot be a condition; the README promises a mock transport without the test feature, and its own test-mode block then throws `fetch_mode_block`; read and ran.
- csharp: the old REFERENCE branched on `result["ok"]`, an `object?`, which cannot compile as a condition, and declared false `= null` defaults on TestSDK, Direct and Prepare; read.
- twelve README components (py, kotlin, perl, csharp, java, php, swift, ts, scala, clojure, cpp, js): "On error, `ok` is `false` and `err` contains the error value", where a readable non-2xx response sets no `err`; read (kotlin verifier; checked against kotlin's runtime, not each one).
- cpp, csharp, php, scala: the old tutorial jumped from step 1 to step 3 when there was no list step (swift's is above); read.
- scala: the example literal table puts a bare `1.0` into a `Map[String, Object]`, believed not to compile under Scala 3 (four old READMEs); read, no compiler; boxed in the ported sections.
- `ts/test/generatedcompile.test.ts`: the csharp lane "the project builds" returns, and so passes, when dotnet is missing, instead of skipping visibly; read (csharp verifier, attacker).
- `ts/src/cmp/FeatureDocs.ts`: `FIXED_ORDER_TARGETS = ['lean']`, a shared branch on a target's name, under which the cost-and-cache ordering sentence is false for lean; read (builder of the catalogue edits).

Defects of sdkgen's own tools, found by the H5 rounds:

- `doctor prune` deleted superseded files during a dry run (`-y`); read (H5 builder); fixed on the H5 branch.
- the copy record's reader drops a line it cannot parse without a finding (`ts/src/action/copies.ts`, `readCopies`). On `main` that is deliberate (its comment says a copy can then only lose its entry); once retirement is gated on the record, an unchanged old copy then reads as an override, is kept and used, and `doctor` passes; ran (H5 checker), with a synthesised damaged line.
- `target remove` leaves the target's compiled components in `.sdk/dist/cmp/<target>/`; after a re-add of the same target they are loaded; ran (H5 builder and checker).
- `tsc --build src` in a project reports up to date after the installed sdkgen changes underneath it, so a stale build runs; ran (H5 builder and checker). This is how incremental builds behave; the scaffold's generate runs that build first.
- the copies warning at generation calls missing files "changed in this project", and after a rollback states the version direction backwards; ran (H5 builder).

---

## 6. What it cost

### 6.1 Interface changes by round

| Round | Breaking | Additive | Cause | From a newly ported language | Re-count: provider + forms |
|---|---|---|---|---|---|
| Stage 1 | 1 (before the first commit) | 2 before commit, 2 from the interface probe | writing go and c; zig and clojure | 0 | 0 (before the first commit) |
| Stage 2 (v2) | 4 by v2's count (2 provider, 2 shared-only); the naming hook disputed | 8 | the stage-1 requirements | 0 | 2 + 0 |
| Stage 3 (REFERENCE) | 1 (`RefFacts.container`) | about 5 | the REFERENCE | 0 | 1 + 0 |
| rust and elixir port | 0 | 5 | the port | 0 | 0 |
| Version 3 shape | 5 (all elective; 3 avoidable with deprecated aliases) | 11 | interface rewrite | 0 | 5 + 0 |
| Version 3 freeze | 1 (a forms file per language) | 3 | the rebuilt guard | 0 | 0 + 1 |
| rb pilot | 0 | 1 | the port | 0 | 0 |
| 3.1 | 1 (forcing 0 providers) | 6 | shared fixes | 0 | 1 + 4 |
| 3.2 | 9 shared (8 + 1) and 4 forms-framework (3 + 1) | 3 shared, 5 forms, 1 tools | turning shared defaults into declared facts | 0 | 9 + 5 |
| Sentence fix round | 2 | 3 | the sentence review | 0 | 3 + 0 (the `testMock` rename added) |
| First wave, while porting | 0 | (recorded, not made) | the ports | 0 | 0 |
| 3.3 | 3 shared (stream signal, wrapped unwrap, utility copy) and 2 forms | 11 | the first-wave reviews, the survey, the guard | 2 or 3 | 3 + 6; 6 or 7 from new languages |
| Base for the last seven | 0 | 0 | none: the frozen interface unchanged | 0 | 0 |
| Catalogue shared edits | 0 | 1 (a field of the shared feature description) | the catalogue entries | 0 | 0 |
| Migration structures, merged at 3.4 | 1 by the re-count and the attacker: the `interface` field, which every provider had to add or be served the previous version with fewer sentences (the integration counts 0, since the type allows omitting it) | a `package check` rule; the previous interface served; `testMock` required at generation instead of in the type | versioning the interface for packs (section 3.5) | 0 | 1 + 0 |
| Second wave, while porting | 0 | (recorded, not made) | the ports | 0 | 0 |
| 3.4 integration | 3 to the guard (the accessor lookup and `ref.instance` judged; the deleted read checked name by name; the scala test tree outside the runtime) and 1 changed shared sentence (the stream signal); 5 counting a changed row in two unported components | 5 optional facts (a call factory, `blockScope`, `streamSignalForm`, `removeKeeps`, the deleted read's layout fill), and tools changes | the second-wave reviews, fixes and verifications | 3 or 4 by the re-count; 4 or 5 by the integration | 0 + 3; 3 or 4 from new languages, with the changed stream sentence |

Cumulative breaking changes since the first four languages, by the
independent re-count from the code history: 25 to the provider interface
and 19 to the forms framework, 44 in all (24 and 16, 40, at `v33-frozen`),
changed shared sentences not counted. By round, provider: v2 2, stage 3 1,
version 3 5, 3.1 1, 3.2 9, the sentence fix round 3, 3.3 3, the migration
round's interface field 1; forms: the version-3 freeze 1, 3.1 4, 3.2 5,
3.3 6, 3.4 3. The builders' running count at 3.3 was about 25 to 27 with
changed shared sentences and without the forms, about 31 to 33 with the
six forms rows of the table above; section 3.1 says where the two counts
differ. The table keeps the builders' per-round figures beside the
re-count's, in its last column; the re-count's replace them. The builders'
records also disagree with each other on details: v2 counted 4 and stage 3
counted about 6, over different spans and different changes (stage 3
counted from stage 1's first commit, included the stage-1 `before` change,
the naming hook and its own `RefFacts.container`, and left out the
`sdkDescription` signature); at 3.3, the shared builder and the freezing
builder each count three breaking changes but not the same three (the
freezing builder's classification is used here). Appendix B lists the
changes, with the rows the re-count added.

What the porters see: a new port at 3.3 writes a hook, a provider and a
forms file, and declares facts the earlier ports did not have to
(`testMock`, `okFalse`, `calls`, `streamSignal` where it applies). The
seven last ports were the first to start from 3.3. Their guide (version
3.3, 957 lines) lists the required facts of 3.2 and the ten optional facts
of 3.3 with, for each, when it applies, how to tell from the runtime and
what the page says with and without it; and one row per language naming,
with file and line, what that runtime will raise. Expected first, by the
guide writer's reading: java, kotlin and scala bind results to a type that
lacks `deleted()` (swift's situation); csharp's stream takes its own
cancellation token, which the cancel absence search will find; cpp writes
`ok` as `Value(false)` (ocaml's question about `Bool false`); php spells its
SDK file name inline in `Main_php.ts:59` and has a path-relative root
import (perl's problem). A read-through of the guide as a porter of php
and of kotlin found 8 gaps, all fixed before the ports started (guide
writer, read).

What the second wave met: none of the seven needed a breaking change while
porting. Each found between one and four gaps it recorded rather than
worked around (cpp 3, kotlin 4, java 3, php 3, js 2, csharp 1, scala 2),
and each listed between five and seven problems in the guide (44 in all);
a reviewer then found the guide claiming a check of the accessor's
receiver that did not exist. The guide writer's predictions held: java,
kotlin and scala bind results to a type that lacks `deleted()`; csharp's
stream takes its own cancellation token; php spelled its SDK file name
inline and had a path-relative root import, which its port fixed. The
guide corrections were recorded for its owner and not made, because the
guide was read-only to the ports. Three ports could not pass their one
command until a shared change was made (cpp's constructor through a
template call, kotlin's and scala's false findings from the printed-call
check), and four recorded classes as defects that only shared code could
fix (csharp, java, cpp, kotlin); the integration made those changes.

### 6.2 Review labour

| When | Labour | Who |
|---|---|---|
| Version 3 freeze | 1,666 classes: 132 by normalizers, about 1,490 by about 120 content rules, 44 by hand | builder |
| 3.1 | 599 hand decisions across nine languages (rb 140); about 877 classes still on unreviewed rule records | builder |
| 3.2 | 67 class decisions, 7 hand facts, 28 absent reasons | merging builder |
| First wave | hand classes: ocaml 236, swift about 201, lua 174, perl 148; 0 by rule | porters |
| Sentence review | 297 sentences read by three reviewers | reviewers |
| Sentence fix round | 376 classes reopened, 361 hand records added, 16 stale reasons rewritten; hand decisions per language rose (ts 74 to 120, go 56 to 107, rb 145 to 183, and so on) | builder; verifier |
| 3.3 | openings decided: 70 by written rules, 19 carried, 14 by hand; ocaml's 38 stale records reworded or removed | builder |
| Catalogue shared edits | 752 classes opened in the thirteen languages by 11 changed sentences, all decided by 16 written rules applied to every language alike, 0 by hand | builder |
| Second wave | hand decisions per language at 3.4: tutorial 19 to 27, root 3 or 4, REFERENCE 55 to 115; hand records 194 (js) and 230 (java) at the port, of which 43 and 138 quote text; csharp 204 classes and scala 191 classified by hand at the port | porters, reviewers |
| 3.4 integration | every language's records re-keyed when the reference set grew to twenty (0 conflicts); the first run failed all twenty on the classes the shared changes opened, decided by written rules; java's one stale quotation re-quoted after a test was updated | integrating builder |

Self-test controls written against shared text break when the text
changes, whatever the tools' logic: after the sentence fixes 22 controls
had to be re-aimed at the new text (the first run failed 40, which also
exposed two tool defects), and 16 failed at 3.3 because two paragraphs
were re-wrapped.

At 3.4 the self-test's fact controls failed (3) until their control pages
were regenerated from the new clone, and java's one command failed on one
stale quotation of the old stream sentence, which had survived only in a
test the freeze then updated (integrating builder, ran).

### 6.3 The review tools

The tools are a set of scripts driven by one registry of ported languages: a
splitter of pages into units, a sentence ledger (OLD against NEW, by class),
a block classifier, a sentence identity and masking module, a purity lint
(no model read, no naming rule, note text only), fact attestation against
OLD, a printed-call check (5,215 calls across thirteen languages, counted in
the 3.3 round before the freeze; it reads no clojure call), a page check for
numbers, articles, headings and step counts (from the tools round beside
the freeze, merged into the base), staleness checks, a re-key script for
hand records, and the one command that runs them.

| At | Self-test controls | Failed | Time (single run, shared four CPUs) |
|---|---|---|---|
| 3.1 | 84 | 0 | 98 s |
| 3.2 | 175 | 0 | 405 s |
| Sentence fix round | 203 | 0 (1 moved) | 1,058 s |
| 3.3 | 235 | 0 (2 moved) | 2,046 s |
| Separate branch beside 3.3 | 266 | 0 (1 moved) | 1,582 s |
| Base for the last seven (that branch merged) | 266 | 0 (1 moved) | 1,723 s run alone; 2,926 s from the base copy on a busier machine |
| 3.4 | 285 | 0 (0 moved) | six batches of under 30 minutes each; the attacker's re-run at the frozen tools gave the same |

A moved control is one whose attack is known to pass. At 3.3 both are a
sentence only go's style prints, dropped and run from scratch. At the base
the one moved control is go's tutorial step 4 dropped, from scratch; the
other 3.3 control now passes. Bringing the branch onto the frozen tools
cost one merge conflict in a control file and two controls re-aimed at
text the freeze had re-wrapped (base builder, ran).

The guard and forms are code too: at 3.2 the shared guard was 1,878 lines,
the nine ported forms 907 and the eleven unported forms 789. At the base
the shared guard is 2,650 lines (2,457 without the new call check), the
thirteen ported forms 1,640 and the seven unported forms 492 (base
builder, ran). The runtime table the porters follow was 1,312 lines at 3.3,
and regenerated identical at the base. At 3.4 the shared guard is 2,740
lines and the twenty forms files 2,495 (mean 125; the seven new ones 855,
mean 122; measurer, ran), and the guard and reader tests number 105
(integrator and attacker, ran). The printed-call check reports 0
findings on NEW for all twenty, after the integration taught it type
arguments, casts and each language's separators.

### 6.4 One port

| Language | Recorded time | Notes |
|---|---|---|
| perl | 02:01 to 02:31 UTC; per-step not measured | suite 8 min within it; the porter cannot vouch for the clock |
| lua | 02:01 to 02:31 by `date -u` | the porter doubts the clock: the suite alone reported 7.8 min |
| swift | 02:01 to about 04:15 | reading 25 min, table check 10, provider and hook 15, forms and guard 15, review 40, suite and measures 25 |
| ocaml | 02:01 to about 04:15 | reading 35, table check 10, forms 15, provider and hook 25, review and classification 50, measures 15 |

The brief for the round after the first wave said each port was written "in
about half an hour". The records support that for perl and lua by the clock
(both porters doubt it), not for swift and ocaml, which took about two and a
quarter hours each; provider and hook alone took from about 3 minutes (lua,
with build and guard) to 25 minutes (ocaml) where recorded. Each port was
then reviewed, fixed and verified, which the records do not time.

The rb pilot at version 3 took about a quarter hour of wall time, 4.3
minutes of it the suite (builder).

The second wave, by the porters' own clocks (all seven ran at once on the
shared machine):

| Language | Recorded time | Notes |
|---|---|---|
| php | 15:00 to 15:44 | the porter distrusts the clock: the window looks too short for a 771 s suite and three regenerations |
| cpp | about 47 minutes | reading and table 10 min, forms and provider 10, review 12, suite 13 |
| java | 15:00 to about 15:55 | the times in its progress file ran ahead of the clock, as a note there says; it did not run the repository suite, which then failed three of its tests |
| kotlin | about 65 minutes | including finding a usable Kotlin compiler in gradle's cache |
| js | about 2 h 45 min | including 30 min running the examples by hand, since js has no lane |
| csharp | about 3 hours | classification of 204 classes about 45 min |
| scala | about 4 hours | including two suite runs and a fix of three failures the suite found |

Each was then reviewed, fixed and verified, which the records do not time.
So a port took a porter from under an hour to about four hours, and needed
three more people after it; the brief's "about half an hour" holds for
none of the seven by its own record.

---

## 7. What this evidence cannot show

- **One model family.** Every page was generated from one demonstration
  model (`Demo`, seven entities) and 21 single-switch variations of it.
  Real specifications with other shapes were not used.
- **Seven of twenty languages were never compiled.** csharp, scala, swift,
  lua, clojure, elixir and ocaml examples were checked by structure and by
  reading. Two failures in that group (csharp's duplicate local, scala's
  comparison with a primitive) were found by reading, which also means
  others may have been missed. kotlin was compiled only through a compiler
  found in gradle's offline cache.
- **The lanes compile their own models**, not the 21 review variations. A
  changed block that no lane model produces is compiled by nothing even in
  a language with a toolchain.
- **Much of the checking is human.** Hundreds of classes per language are
  decided by hand; 67 citations (3.2) are pinned prose checked only by a
  reviewer; the survey of twenty runtimes is one reader's claim per line,
  read and not run.
- **The checks were attacked by the same team.** The checkers, verifiers,
  the measurer and the attacker were independent of each build but drew on
  the same records and tools; the attack sets grew from what earlier
  attacks found. The last attack still found a false sentence every
  earlier check had passed, which says the attacks were not exhausted.
- **The checks cannot see what is not declared.** The guard checks
  declared facts against the runtime. A fact a porter leaves out, a
  sentence shared code writes from a model fact, and a citation that holds
  the right token on an unrelated line all pass it (section 5.2). The H3
  checks look for the old defects in words, not for new ones.
- **Twenty languages are not every language.** Each wave of runtimes
  needed new facts (the second wave five optional ones); a language added
  later, or the pack's dart, haskell and lean if ported, should be
  expected to need more.
- **Three sections, not the documentation.** The other ten README families
  were analysed, not built, and are a different kind of text (section 5.5).
- **The interface count measures churn, not difficulty.** Many breaking
  changes were one-line declarations; one (the forms file) was a new file
  per language. The count does not weigh them.
- **Timings** are single runs on four shared CPUs, except where a minimum of
  three is stated.
- **No maintenance over time.** Whether a change to shared prose stays cheap
  once the tools stop needing re-aimed controls is not measured.
- **The catalogue checks are patterns.** Each H3 check matches words; the
  H3 checker reintroduced six defects in other words and all six checks
  passed them. A clean result rests on the reading behind it as much as
  on the checks (section 3.3).
- **The classification of the catalogue is a reading, checked by
  samples.** One sample was not blind; the blind one, of 100 entries, found
  no class error, which still allows about 7 errors among the 229 entries
  outside the samples. Both readings worked from the catalogue's own
  structured lines. Four borders are carried as ranges, and the work
  package fates are inferred from classes, not measured by porting a
  family (section 4.4).
- **H5 ran on the builder's generation roots, not on a project made by
  create-sdkgen with `npm run generate`.** The checker's next release was
  an edited archive, not a build from source; the damaged record line was
  synthesised; edition components were never retired end to end; and the
  naming hook was not versioned or attacked.
- **Which projects lack a copy record is not known.** The unsafe H5 states
  all start from a copy the record does not hold as unchanged; how common
  that is among real projects was not measured.
- **The final migration state was partly rebuilt.** At twenty the earlier
  H5 fixtures and builds had been deleted; the measurer rebuilt the
  fixtures from their descriptions (one of them, a project-owned target,
  as an approximation), and states that need a release build were not
  re-run.
- **Some of the twenty-language evidence was read through digests.** The
  integrator read the 28 reports of the second wave through a digest and
  targeted look-ups, as its report says; the measurer and the attacker
  read the integration's report in full and re-ran its checks.

---

## 8. Not done

The prototype is finished. What follows is what it left undone: what was
recorded and not made, what was never measured, and what a real adoption
would still have to do. Nothing in this list is in progress.

**Found by the attack on the frozen state, and not fixed**

- The `secrets` sentence, "- Also attaches to pipeline hooks.", false in
  17 of 20 languages. Made true, it needs a declared fact per runtime or
  no sentence; either way the model's own declaration of a `PreSpec` hook,
  which seventeen runtimes contradict, needs a decision.
- An optional fact left out leaves no trace (the stream signal in csharp,
  java, kotlin and scala; the deleted mark in js), or brings back a
  sentence known to be false with one open class to show it (php's cached
  accessor, cpp's remove that keeps its data). Nothing requires each
  optional fact to be declared, present or absent.
- In java and kotlin the REFERENCE operation blocks bind the result as
  `Object` or `Any?` with no cast, beside the sentence that `data()` reads
  its record. The integration recorded the opposite as its reason not to
  add a declared-type fact.
- The derived list of shared sections makes `doctor` fail a consumer
  target's own component (section 3.5); the `package check` error for an
  unservable interface was removed with the c5 change; the deep import of
  the interface constant still bypasses the version check, and the remedy
  recorded for it (an exports map) is ruled out by the repository's own
  `package.json`.
- Three of the integration's changes have no test that fails without them
  (the deleted read's layout fill, the rule that a declared call factory
  occurs in the runtime, the csharp and java citation pins). The container
  fact of java, kotlin and scala still has no value pin.
- Seventeen of the prototype's earlier commits (fifteen in sdkgen, two in
  the tools) end in an attribution trailer and a session link that the
  prototype's own rules forbid; none is on `main`, and none should be
  carried there as it stands.

**Recorded at the integration and not made** (the integrator's record says
what each would take)

- Optional facts: a declared return type that needs a cast (java, kotlin,
  scala, csharp); a runtime with no built-in live transport (cpp, ocaml,
  zig); the thrown type in the throw-style sentences (cpp and others); the
  stream signal's form for java and scala, and, by the attacker, for go,
  perl, clojure, swift, elixir, ts and js too.
- Shared code: **Returns:** for entity members (php declares returns the
  page never prints; adding it changes every page that declares them, so
  breaking); php's case-folded class names (latent: no variation has two
  names that fold together); a separate fence for signature blocks (js
  prints TypeScript notation under a js fence); the operations a section
  uses passed to the imports printer (java imports `java.util.List` where
  nothing is listed).
- Guard and tools: a member's receiver judged by name where instance and
  type share `.` (java, kotlin, scala, csharp); a static signature
  compared with its declaration; `arity` required where a list has
  required parameters (breaking: it forces c, clojure, elixir and ocaml);
  key sets of direct's and prepare's returns compared; citation tokens
  matched as whole identifiers; constructor optionality compared; the
  rendered call checked for `await`; a catch type checked against what the
  runtime throws; a forms claim of parenthesis-free calls compared with
  the runtime; the getter copy fact required on every getter; an
  enumerated fact attested only where its value prints differently from
  every alternative; calls with a block argument read by the printed-call
  check; a scope checker for C#.
- The csharp lane that passes when dotnet is missing should skip visibly.
- The porting guide's corrections, recorded by the porters, reviewers and
  fixers of both waves for its owner.
- Outside the three sections: the direct how-to sentence about `err` in
  twelve languages' README components; cpp's test-mode promise and its
  TypeScript error-handling examples; js's `require` in its
  module-structure section. Inside them but shared before the prototype:
  the JavaScript spelling of every default in the feature tables.

**The catalogue (H3)**

- D26's other half: rows for `extend`, `utility`, `entity` and `test`, and
  a default column. `extend` and `utility` need a declared fact per
  runtime; `entity` and `test` were not established either way.
- U37 was decided and left: the go title follows `target.title`. U44's two
  leftover guard exceptions remain in py and elixir.
- The 17 attempts to put a fixed defect back in other words were not
  repeated at twenty; the checks those attempts fooled were strengthened
  only where a post-attack variant was added.
- The language pack was generated against the frozen state only by its own
  suite (74 of 76 pass, 2 skipped); its pages were not compared with its
  pages before the catalogue edits.

**Migration (H5)**

- States not re-run at the final state, because the release builds and
  scripts they need had been deleted: the interface raise (three states),
  restored files after an update, the previous-interface page against
  3.2's own output, the nine provider mutations, and thirteen of the
  second attack's other states.
- Never run by anyone: edition components retired end to end; a pack that
  ships providers carried across a real release that raises the interface;
  a version for the naming hook; a project made by create-sdkgen and
  generated with `npm run generate`.
- The layer that serves the previous interface serves one version only;
  nothing ties it to a number of releases. A stricter variant that makes
  omitted optional facts and printer arity loud for a provider declaring
  the current interface was built on a side branch by the migration
  builder and never had its suite run.
- `target remove` still refuses an unrecorded edited copy with the wording
  "did not write", which is inaccurate for a copy an add wrote. The CLI's
  one-line drift summary still omits the retired, outdated, damaged and
  orphan counts.
- The frozen package reports 4.44.0, because the migration round's version
  commit was left out; every release must now regenerate the retired list,
  which the publish workflow's tests check against the release tags.

**Never measured**

- Compilation or running of any example in csharp, scala, swift, lua,
  clojure, elixir and ocaml; the root quick starts of c, rust, zig, cpp
  and kotlin run from a repository root; most changed blocks of the 21
  review variations, which no lane model produces.
- A verdict for 164 of the 385 distinct shared sentences at twenty, which
  no independent reader has given; the 40 sentences printed by one
  language that the tools could not explain were read by the measurer and
  not traced to their templates.
- The other ten README families, the language pack's own documentation
  components, real specifications, and the cost of keeping shared
  sentences and declared facts true as runtimes change over time.

**Carried from earlier rounds, still open**

- The staleness checks' known holes: the builder of the tools round beside
  the 3.3 freeze beat them with five of six attacks (a staged file deleted,
  a source time set back, a loose OLD marker, a record quoting OLD as NEW,
  a quotation found only in another language's component), and none was
  fixed.
- Facts recorded and not yet expressible: ocaml's `e_deleted` marker and
  operation parameter names; lua's whole-record print in the root quick
  start; ocaml's stream kind.
- The runtime defects of section 5.7 are recorded, not fixed (except the
  ts and js test fallback). The pages of `main` listed in section 5.8 are
  unchanged on `main`.
- Hand records of classes that no longer exist were not pruned in any
  language; they have no effect, since the one command reads only classes
  that exist.
- The catalogue's open borders (section 4.4) are carried as ranges; no
  family beyond the three sections was built to settle a package's fate.

**What a real adoption would still have to do**

- Bring the description, the example representation, the shared sections,
  twenty providers and naming hooks, and the extracted naming functions
  onto `main`, and retire sixty per-language components there; and the
  migration machinery with its release step.
- Bring the guard and the twenty forms files into the repository's tests,
  and decide what replaces the review tools and the hand records, which
  are working files of the prototype and not code its CI can run. Without
  them, a declared fact and a shared sentence are checked by nothing.
- Settle the interface's versioning: a window of releases for the served
  previous version, and the check that cannot be bypassed by a deep
  import.
- Decide, family by family, whether to port the other ten README families
  or accept that ported and unported sections of one SDK contradict each
  other until they are.
- Port or keep the language pack's own components, and settle with the
  pack's maintainers how a pack meets an interface raise.
- Do the plan's work that the proposal does not replace: the derivations
  and the text guard (WP19, WP03) and the 35 packages that stay (section
  4.3).

---

## Appendix A. The twenty languages at version 3.4

From the integrator's run of the one command at the frozen commits (sdkgen
`v34-frozen`, tools `v34-frozen-tools`), three sections, 21 variations;
the attacker re-ran all twenty and got identical summaries. "Same" is units
identical to OLD; "hand" classes decided by a person (rule records, carried
from earlier rounds, in parentheses); "missing" OLD classes with no NEW
counterpart, each decided; "absent" sentences printed by every reference
language of the same result style but not by this one, each explained.
Every row: PASS, guard 4/4, printed-call findings 0, stale 0, open 0,
defect 0, unattested facts 0. The ported-at column names the stage of
section 2.1.

| Language | Ported at | Same (tut / root / ref) | Hand (tut / root / ref) | Missing | Contradictions | Absent | Example lane at 3.4 |
|---|---|---|---|---|---|---|---|
| ts | stage 1 | 59 / 21 / 14994 | 19 (+23) / 0 (+4) / 107 (+45) | 5/1/42 | 0/0/1 | 2 | README 16/16 |
| go | stage 1 | 23 / 22 / 16959 | 26 (+27) / 0 (+4) / 75 (+49) | 9/0/17 | 0/0/1 | 18 | README 12/12 |
| py | stage 1 | 59 / 19 / 14506 | 15 (+24) / 0 (+3) / 102 (+60) | 4/0/26 | 0/0/1 | 1 | README 12/12 |
| c | stage 1 | 59 / 19 / 14438 | 14 (+24) / 0 (+3) / 104 (+50) | 4/0/19 | 0/0/1 | 0 | documentation 6/6 |
| zig | stage 1 | 59 / 19 / 14567 | 18 (+23) / 3 / 103 (+58) | 5/0/25 | 0/0/1 | 7 | documentation 6/6 |
| clojure | stage 1 (REFERENCE at version 3) | 59 / 19 / 14550 | 14 (+24) / 0 (+3) / 97 (+59) | 4/0/24 | 0/0/0 | 4 | none (no toolchain) |
| rust | stage 3 | 59 / 19 / 14566 | 20 (+25) / 3 / 109 (+67) | 5/1/24 | 0/0/1 | 3 | documentation 6/6 |
| elixir | stage 3 | 59 / 19 / 14369 | 17 (+22) / 0 (+3) / 102 (+69) | 4/0/23 | 0/0/1 | 0 | none (no toolchain) |
| rb | version 3 pilot | 59 / 19 / 14587 | 28 / 3 / 126 | 5/0/25 | 0/0/1 | 0 | README 49/49 |
| perl | first wave | 59 / 19 / 14457 | 20 / 3 / 101 | 4/0/25 | 0/0/1 | 0 | README, three models, exit 0 |
| swift | first wave | 59 / 19 / 13560 | 22 / 3 / 110 | 5/0/34 | 0/0/1 | 1 | none (no toolchain) |
| ocaml | first wave | 54 / 19 / 13639 | 21 / 3 / 135 | 8/0/35 | 0/0/1 | 2 | none (no toolchain) |
| lua | first wave | 59 / 19 / 14619 | 18 / 3 / 109 | 5/0/25 | 0/0/1 | 22 | none (no toolchain) |
| js | second wave | 21 / 19 / 14877 | 27 / 4 / 55 | 7/1/38 | 0/0/2 | 0 | run as written: 24/24, 17/17, 17/17 (no lane on `main`) |
| php | second wave | 59 / 19 / 14332 | 22 / 3 / 115 | 6/1/32 | 0/0/5 | 6 | README, three models, exit 0 |
| csharp | second wave | 59 / 19 / 13409 | 20 / 3 / 92 | 4/1/45 | 0/0/1 | 0 | none (no dotnet) |
| java | second wave | 59 / 19 / 13389 | 20 / 3 / 97 | 5/1/46 | 0/0/1 | 0 | javac on every block: 24/24, 19/19, 19/19 |
| kotlin | second wave | 59 / 19 / 13503 | 19 / 3 / 77 | 5/1/40 | 0/0/3 | 0 | gradle, offline: 0 errors in three models |
| scala | second wave | 59 / 19 / 13597 | 21 / 3 / 84 | 5/1/40 | 0/0/1 | 0 | none (no compiler) |
| cpp | second wave | 59 / 19 / 13541 | 20 / 3 / 85 | 3/0/38 | 0/0/1 | 0 | documentation 6/6 |

The thirteen languages' REFERENCE counts are lower than at 3.3 because the
catalogue edits changed the feature and constructor lines on every page.
js's 21 same tutorial units, against 59 elsewhere, reflect its old pages,
an older copy of the ts components.

Facts at 3.4 (attested against the OLD page / recorded by hand / cited /
pinned prose for a reviewer to audit): ts 5/1/22/12, go 4/3/17/11, py
6/1/17/10, c 8/2/14/10, zig 8/1/19/12, clojure 8/3/17/11, rust 8/1/16/9,
elixir 4/2/17/12, rb 5/2/17/10, perl 6/3/12/8, swift 3/2/15/9 (and 1 not
printed), ocaml 7/4/16/13, lua 4/3/21/15, js 5/2/23/13, php 4/2/20/10,
csharp 4/2/17/11, java 4/2/15/11, kotlin 6/2/15/12, scala 5/2/15/10, cpp
4/3/15/10. Suite at the frozen commit: 2,702 tests, 2,697 pass, 0 fail, 5
skipped (integrator and attacker, ran). Golden 2/2. Guard and reader 105
of 105.

Second-wave history, per language (porter, reviewer, fixer, verifier): js
passed its one command at the port and after the fix, and was verified ok;
php the same. java passed at the port but broke three repository tests it
had not run; fixed, then held failing by two defect classes on its deleted
read until the integration. cpp failed at the port on the guard's reading
of its template constructor and then on a defect class for its remove
sentence; csharp on three defect classes for its root quick start and one
for the stream sentence; kotlin on six false findings of the printed-call
check and two defect classes for its stream note; scala on three false
findings of the printed-call check. Each of those five was verified as
failing only on a shared change it had recorded, and each passes at 3.4
after the integration made the change.

### At version 3.3, for comparison

From the freezing builder's run of the one command at `v33-frozen`, three
sections, 21 variations. "Same" is units identical to OLD; "hand" classes
decided by a person
(rule-recorded classes are those carried from earlier rounds); "missing" OLD
classes with no NEW counterpart, each decided. Every row: guard 4/4, stale
0, open 0, defect 0.

| Language | Ported at | Same (tut / root / ref) | Hand (tut / root / ref) | Missing | Contradictions | Example lane at 3.3 |
|---|---|---|---|---|---|---|
| ts | stage 1 | 59 / 21 / 15376 | 19 (+23 rule) / 0 (+4) / 47 (+48) | 5/1/41 | 0/0/1 | README 16/16 |
| go | stage 1 | 23 / 22 / 17439 | 26 (+27) / (+4) / 36 (+51) | 9/0/15 | 0/0/1 | README 12/12 |
| py | stage 1 | 59 / 19 / 14940 | 15 (+24) / (+3) / 42 (+62) | 4/0/24 | 0/0/1 | README 12/12 |
| c | stage 1 | 59 / 19 / 14872 | 14 (+24) / (+3) / 43 (+52) | 4/0/18 | 0/0/1 | documentation 6/6 |
| zig | stage 1 | 59 / 19 / 15001 | 18 (+23) / 3 / 45 (+60) | 5/0/24 | 0/0/1 | documentation 6/6 |
| clojure | stage 1 (REFERENCE at version 3) | 59 / 19 / 14984 | 14 (+24) / (+3) / 40 (+61) | 4/0/23 | 0/0/0 | none (no toolchain) |
| rust | stage 3 | 59 / 19 / 15000 | 20 (+25) / 3 / 49 (+69) | 5/1/23 | 0/0/1 | documentation 6/6 |
| elixir | stage 3 | 59 / 19 / 14803 | 17 (+22) / (+3) / 42 (+71) | 4/0/22 | 0/0/1 | none (no toolchain) |
| rb | version 3 pilot | 59 / 19 / 15021 | 28 / 3 / 67 | 5/0/23 | 0/0/1 | README 49/49 |
| perl | first wave | 59 / 19 / 14891 | 20 / 3 / 61 | 4/0/23 | 0/0/1 | README 7/7 in 3 models |
| swift | first wave | 59 / 19 / 13994 | 22 / 3 / 71 | 5/0/32 | 0/0/1 | none (no toolchain) |
| ocaml | first wave | 54 / 19 / 14073 | 21 / 3 / 73 | 8/0/35 | 0/0/1 | none (no toolchain) |
| lua | first wave | 59 / 19 / 15053 | 18 / 3 / 66 | 5/0/24 | 0/0/2 | none (no toolchain) |

Guard account at 3.3 (derived / cited / language / convention): ts
48/15/1/5, go 46/12/1/6, py 46/12/1/6, c 41/12/1/9, zig 39/15/1/8, clojure
42/14/1/10, rust 42/12/1/8, elixir 45/13/1/5, rb 46/12/1/6, perl 43/15/1/8,
swift 43/10/1/5, ocaml 47/13/1/10, lua 46/15/1/6 (parsed from the guard's
fact sheet; a few rows whose values contain a separator may fall into odd
buckets, as the builder notes). Suite at the tag: 2,631 tests, 2,626 pass,
0 fail, 5 skipped. The seven unported languages' pages are byte-identical
to the 3.2 output.

Re-run at the base for the last seven, under the merged tools (base
builder, ran): all thirteen pass with numbers identical to the table
above; the regenerated pages are byte-identical to the freeze's; the new
page check reports 0 findings in every language (965 to 1,675 articles
read per language); and four shared matches (in rb, perl, swift and
ocaml) now name ts as their reference, with the same outcome. lua still
matches one sentence nobody reviewed, as at the freeze.

## Appendix B. Interface changes

Breaking changes are listed one row each. Additive changes are counted per
round in section 6.1 and named here only where a later breaking change
depends on them; the full lists are in the round records. This departs
from the outline's "one row each" for additive changes, which number more
than seventy.

| # | Round | Change | Providers or files forced |
|---|---|---|---|
| 1 | Stage 1 | an optional block post-processor became `before` | the providers then being written (before the first commit) |
| 2 | v2 | English `RuntimeWords` replaced by the declared `RuntimeFacts` table | all 6 providers |
| 3 | v2 | `Expr` kind `fields`, `DescQuick.show`, `RuntimeFacts.prints` | all 6 |
| 4 | v2 | builders take the facts | shared only |
| 5 | v2 | `sdkDescription(model, target, naming)` | shared only |
| 6 | v2 (disputed) | `Ent.sym`; names from a per-language naming hook | v2 counted it additive; the stage-3 builder counted it breaking |
| 7 | Stage 3 | `RefFacts.container` | the five REFERENCE providers (the re-count: four; zig's REFERENCE came after the change) |
| 8 | Version 3 | `RefFacts.classes` replaced by `entityBy`; `DescSymbols.type` removed | elective |
| 9 | Version 3 | `DescSymbols.vars` removed; plurals from apidef's pluralize; `Naming.ident` | elective |
| 10 | Version 3 | `RefSyntax.read(value, key)` required | all 8 (the re-count: seven; clojure had no REFERENCE yet) |
| 11 | Version 3 | `prepare.fails` 'errorunion' replaced by 'note' | elective |
| 12 | Version 3 | member kinds `streamChannel`, `utilityShared` removed for neutral kinds | elective |
| 13 | Version 3 freeze | every ported language supplies a forms file | all ported |
| 14 | 3.1 | `DescQuick.show` removed for `DescEntity.show` | 0 providers |
| 15 | 3.2 | `RefFacts.lits` removed; `direct.okFalse` required | 9 |
| 16 | 3.2 | `accessor.param` required | 9 |
| 17 | 3.2 | `Member.runs` required for stream kinds | 9 |
| 18 | 3.2 | `setArg` required with data and match setters | 2 |
| 19 | 3.2 | `pairForm` and `noError` required for the pair style | 1 |
| 20 | 3.2 | `direct.abortCode` required with `direct.signal` | 1 |
| 21 | 3.2 | the error-slot style's checked statement shapes | 0 |
| 22 | 3.2 | shared lookups throw instead of guessing (`describeTarget`, `memberName` and others) | 0 |
| 23 | 3.2 | getter text honours `Member.copy` for options and entity options | providers declaring copy |
| 24 | 3.2 (forms) | the reader requires a test constructor and a stream record | all 20 forms |
| 25 | 3.2 (forms) | `none` and literals move from "language" to cited | 9 forms |
| 26 | 3.2 (forms) | rules for unquoted excuses, note tokens and runtime files | 7 forms |
| 27 | 3.2 (forms) | defaults move to cited `okFalse`, `abortCode`, `noError` | 9 forms, ahead citations in 11 |
| 28 | Sentence fix | `RefSyntax.read(value, key, truth?)` | c, go, rust, zig; swift and ocaml ports |
| 29 | Sentence fix | `RefFacts.testMock` required | all 13 |
| 30 | 3.3 | `RefFacts.streamSignal`; the cancel paragraph no longer names the stream | ts must declare it; 9 opt in |
| 31 | 3.3 | the wrapped style names its unwrap; the record fact is the plain accessor | swift |
| 32 | 3.3 | the utility sentence follows `Member.copy` | 9 declare copy; ts declares `copy: false` |
| 33 | 3.3 (forms) | absences searched over the whole runtime; type words; required call notation; whole-record check (four guard commits; the re-count counts four) | all 13 forms; the 7 unported must add calls |
| 34 | 3.3 (forms) | no ahead exemption once a provider exists; field flag checked when omitted; deleted and arity re-derived (two guard commits; the re-count counts two) | ports that cite ahead or omit a flag |
| 35 | Sentence fix (re-count) | `testMock`'s value 'model' renamed 'generated' | 7 providers and 18 forms |
| 36 | 3.1 (forms, re-count) | each method tied to its operation; parameter names and types compared; every declared fact accounted for | all 9 forms |
| 37 | 3.1 (forms, re-count) | a declaration reader with file parts and returns on a later line | c, rust and clojure forms |
| 38 | 3.1 (forms, re-count) | a citation pins the value it audited | 9 forms |
| 39 | 3.1 (forms, re-count) | a getter's copy-or-live fact must be cited | 9 forms and providers |
| 40 | 3.2 (forms, re-count) | the reader table marks members a runtime lacks; a members exception per family | c, scala, cpp and kotlin forms |
| 41 | Migration round, merged at 3.4 | a provider declares `interface`; one that does not is served as the previous version and loses sentences | all 20 providers (13 in the migration round, 7 in the integration's settlement commits) |
| 42 | 3.4 (guard) | the accessor's declaration found by its token as written; `ref.instance` judged; a template-call factory read as the constructor | cpp forms; the accessor calls of six languages judged for the first time |
| 43 | 3.4 (guard) | the generated test tree `sdktest/` is not runtime | scala forms |
| 44 | 3.4 (guard) | the deleted read checked name by name, the cast type and the layout roles included | java's template, hook, provider and utility |
| 45 | 3.4 (shared sentence) | the stream signal named in words instead of `callopts.signal` | every page that prints the stream member, in all twenty languages |
| 46 | 3.4 (two unported components) | the ts and js README row for the utility getter no longer says "deep copy" | ts and js |
| 47 | 3.4 (lifecycle, not the interface) | a record that says changed, or a declared override, outweighs a released fingerprint; an undeclared changed copy of a retired optional component fails `doctor` | projects, not providers |

Rows 35 to 40 are changes the independent re-count found in the code
history and no earlier record listed; rows 41 to 47 are the last wave's.
The table now has 47 rows. They are not the re-count's 44 (25 provider, 19
forms framework): the re-count leaves out changed shared sentences (rows
45 and 46) and the project lifecycle (row 47); it counts rows 4, 5 and 6
as breaking for no provider (rows 4 and 5 are shared only, and the naming
hook of row 6 was optional with a fallback until 3.2, when making it
mandatory forced none); it does not count row 1, which predates the first
commit; and it splits rows 33 and 34 into the six guard changes they
bundle. The builders' running count at 3.3 (about 25 to 27) left out the
forms rows and from 3.2 added two changed shared sentences that have no
row here; the builders said "about" because they split and classified
changes differently, and no builder's record reconciles its count row by
row. The re-count does, commit by commit. On every count the limit of
about 10 is crossed.

## Appendix C. Attacks that nothing mechanical catches

The first table is from the freezing builder's re-run of every attack at
`v33-frozen`, the tools records and the H3 check. The attacker of the
frozen state re-ran the old mutation sets at `v34-frozen` and got the same
result (49 of 59 and 94 of 108 caught by the guard, one more in the second
set because a php provider copy now builds), so those rows still stand,
except where a row says the integration closed it. The second table is
what the last wave's reviewers, verifiers and attacker found at 3.4.
"Caught by" says what, if anything, fails; "a hand decision" means only an
open class that a person decides.

### At 3.3

| Attack | Caught by | Why not mechanically |
|---|---|---|
| A citation whose quoted line holds the token but means something else (perl `none` quoting an unrelated line) | a reviewer | the guard checks the token, not the meaning; 12 comment-only citations are marked |
| Pinned prose false under a feature option (perl's stream note with `chunkSize > 0`) | a reviewer | the guard pins the value, not the condition |
| Shared prose that overstates (`list(nil, nil)` "lists every record") | a reviewer | no check reads a sentence's meaning |
| A sigil missing in a prose code span (perl `result->deleted`) | a reviewer | the guard strips sigils when reading |
| Argument order swapped, or `List.iter` for `List.map`, in ocaml | a compiler, absent here | same types, no toolchain |
| ocaml keys "member" and swift entityBy "Name" | a hand decision in the reviewed mode | the old page states the same wrong value |
| The clojure return type changed | nothing | the clojure runtime declares no types |
| ts entity noun changed | nothing | a convention fact, compared only with OLD |
| ts type word in a comment changed | the review (one open class) | not a guard fact |
| An integer literal changed in ts | the ts README lane (3 of 16 fail) | no review variation prints one |
| A citation token 8 lines from its quote | nothing | the unquoted window is 3 lines |
| A wrong value of another own fact in a shared slot (zig `.ok`/`.err` swapped, py `list()`, rb `Hash`), a wrong number or article | nothing in the frozen tools; closed by the tools round beside the freeze, now merged into the base | masking by fact path was not in the frozen tools |
| A sentence printed only by go's style, dropped, from scratch | nothing (a moved control) | no other language prints it |
| In the tools round beside the freeze, now in the base: ocaml `map` where the record type belongs; an article before `[]any`; a heading moved one level deeper; a sentence printed by all references but one | nothing | that round's own attacks |
| A catalogued defect brought back in other words (S49, S50, X6, S25, U43, U44 in the H3 check) | a reader | each H3 check matches words, not meaning (6 of 6 passed) |
| A staged file deleted from the project; a source time set back | nothing | the staleness check compares times and present files |
| A hand record quoting OLD as NEW, a loose OLD marker, or a quote found only in another language's component | nothing | the stale-record check accepts any match |
| A call cast to a missing type, a standard-library call, swapped arguments of one type, a flattened perl hash, a property read, any clojure call | nothing | outside what the printed-call check reads |

### At 3.4

| Attack | Language | Caught by | Why not mechanically |
|---|---|---|---|
| A shared sentence written from a model fact that the runtimes contradict ("- Also attaches to pipeline hooks." under `secrets`) | 17 of 20 | nothing | the guard checks declared facts, not shared sentences; the tools' classes were decided by a written rule; the catalogue checker looks for old defects |
| An optional fact left out, declaration and citation together (the stream signal; the deleted mark) | csharp, java, kotlin, scala; js | nothing: guard 105 of 105, one command PASS | nothing requires an optional fact to be declared, present or absent |
| An optional fact left out that brings back a sentence known to be false (php's cached accessor; cpp's remove that keeps its data) | php, cpp | a hand decision | as above; the false sentence matches the reference languages' text |
| A wrong fact whose citation is moved to a real runtime line that holds the new token (`okFalse` set to `null`) | all seven new languages | a hand decision | the guard checks that the token stands in the quote, not what the line means |
| A code-valued fact changed within its unpinned citation's tokens (`Dictionary<object?, string>`; `Map<String, String>`) | csharp before its fix; java, kotlin, scala | a hand decision | the citation is compared as a set of tokens; a value pin closes it |
| A forms file that declares calls without parentheses | cpp | nothing: the constructor check passes vacuously | nothing compares that declaration with the runtime |
| A getter's copy fact removed with its citation, then one false reason for the sentence that vanishes | php, scala | nothing once the reason is written | an absent sentence is closed by any reason |
| An import that does not resolve | csharp, scala | a hand decision | no compiler here |
| An import that does not resolve | php | only a run from the repository root | the README example test strips the page's own `require_once` |
| An import dropped from the imports printer | java | a hand decision | the java lane adds its own imports, so it still compiles |
| Operation arguments of one type swapped | java, scala | a hand decision | they compile; only a run against data would show it |
| A member called on the client type instead of an instance (`DemoSDK.planet(...)`) | java, kotlin, scala | a hand decision | where instance and type share `.`, receivers are judged by separator only; recorded, not made |
| `await` dropped from the call printer | js | a hand decision | nothing checks that a rendered call awaits; js has no lane |
| The constructor's options written as required (`options: object`) | js | a hand decision | constructor optionality is not compared |
| A catch clause for a type the runtime never throws (`std::exception`) | cpp | a hand decision | it compiles, so the lane passes; the example aborts on the first failure |
| A cast to a type the runtime lacks, or a dropped cast | csharp, kotlin, scala | a hand decision | the printed-call check reads no casts |
| A hook's module or package name that no longer matches the templates | kotlin, cpp | nothing, or a hand decision | hook literals are never compared with the runtime |
| A truth read that does not compile (`result.get("ok") == true` against an object) | scala | nothing until a reviewer read it | nothing reads whether a truth read compiles |
| A duplicate local name across a loop and a later declaration (CS0136) | csharp | nothing until a porter read it | no tool checks scope; held failing only by honest defect records |
| A null in `Map.of(...)` for a member whose only type is null | java | the repository suite only | no review variation has such a member |
| A wrong line number in a hand record's reason | csharp | nothing | the stale-record check reads quoted text, not file and line |
