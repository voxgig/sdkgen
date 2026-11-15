# Prototype: the generated text written once, measured

Status: **record in progress** (2026-11-15, second version the same day).
Nothing here ships, and nothing here is implemented on `main`. This record
covers a prototype built from sdkgen `main` at 9aebaf9e (4.44.0) to test
the proposal that answered the review of
`docs/design/model-dependent-text-plan.md`. Thirteen of the twenty bundled
languages are ported, and version 3.3 of the interface is frozen at them.
The base and porting guide for the other seven are ready (section 2.1).
Their ports are under way: js, java, php and cpp are written and in
independent review, and csharp, scala and kotlin are being ported.

Four results came in after the first version of this record, and are in
it now: the independent check of the catalogue measurement (H3, section
3.3); existing projects, packs and aliases on the real structure, measured
and then attacked independently (H5, section 3.5); how far the proposal
reaches across the whole catalogue (section 4, new); and the measures at
thirteen languages under the merged review tools (H1 and H2, sections 3.1
and 3.2). The answer to the maintainers' first question, from section 4:
the proposal is not a general solution to the catalogue; its mechanism
reaches about a fifth of the 329 entries, and the rest stays individual
fixes or needs shared derivations it does not supply.

Still out: the seven ports; their integration and the checks run again at
twenty languages; the measures at twenty; the seven shared edits H3 still
needs, which are being made (their result goes to section 3.3); the two
structures the attack on H5 says would decide it, which are being built
and will be attacked in turn (their result goes to section 3.5); and a
verdict, which this record does not give.

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
had not built what they read. A number marked *ran* came from a command;
a number marked *read* came from reading code or pages. OLD is the
generated output of `main` at 9aebaf9e; NEW is the prototype's output for
the same models.

### Where each hypothesis stands

This table is a summary of sections 3 and 4 and adds nothing to them. The
hypotheses and what would refute each are in section 1.3.

| | Standing at version 3.3 (thirteen languages) | Section |
|---|---|---|
| H1 | Refuted on one of its three criteria: the interface needed about 25 to 27 breaking changes after the first four languages, against a limit of about 10 (not re-counted at thirteen; the base for the last seven made none). Holds on a second: no provider reads the model, in all thirteen. On the third, per-language prose by source is at most 7.2% (go) at thirteen, under 15%; go is over it (17.0%) only by a wider measure that also counts shared sentences only one runtime's style selects | 3.1 |
| H2 | Refuted at nine languages and again at thirteen: at thirteen the documentation code shrank 1.83x, 1.41x counting the forms the guard reads, 1.02x counting the guard. Only a projection to twenty, documentation code alone at the measured provider size, passes 2x (2.16x) | 3.2 |
| H3 | Not decided. Checked independently: of the 36 catalogued entries in the three sections that are fixed or should be, 1 needed a line in each language by the brief's rule (2.8%; 5.6% on a strict reading; both under the limit of about 10%; 16.7%, over it, on the strictest reading, which counts the printers the brief exempts). But 7 are not fixed or only partly fixed (22% to 36% if counted against), each needing one shared edit; those edits are being made | 3.3 |
| H4 | Holds for the eight ported languages with a toolchain on the machine used. Not tested for the other five | 3.4 |
| H5 | Not decided. On the real structure, retirement is safe in every measured state where the project's copy record holds the retired copy as unchanged, given two tool changes; it is unsafe, with or without them, where it does not (no record, a damaged record line, files restored after an update). A pack that ships providers changes pages silently at an interface change, or, with the interface versioned, stops generating at each raise (inferred from the raise and the mutations, not run as a pack). Two structures that would decide it are being built | 3.5 |
| Reach | Not a hypothesis of the brief, but the maintainers' first question. Not a general solution to the catalogue: the mechanism reaches 66 of 329 entries (20%; 58 to 70 across the open borders); 81 (25%) are already written once, 46 of them needing a derivation the proposal does not supply; it does nothing for 175 (53%). A reading of the catalogue checked by two samples, one blind | 4 |

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
shared on `main`; the prototype changed a few of its lines and did not
port it as a section (section 3.3). The other ten README
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
then 3.1, 3.2 and 3.3 after each fix round.

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

A **hand record** is a person's decision on one class, with a reason. At 3.3
every ported language has between 14 and 28 tutorial, 0 to 3 root and 36 to
73 reference hand decisions; the nine languages ported before the first wave
also carry rule records from earlier rounds (appendix A). A mode that
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

So, of the thirteen ported languages, examples can be compiled or run here
for ts, go, py, c, rust, rb, zig and perl, and cannot for clojure, elixir,
swift, ocaml and lua. Of the seven being ported, js, php, java and cpp have
a toolchain; csharp, kotlin and scala do not. When the guide for the seven
was written, the guide writer's check found php 8.3, composer, javac, mvn,
gradle, g++ and make present, and kotlinc, kotlin, scala, scala-cli, sbt
and dotnet missing (ran).

The documentation lanes that exist on `main` are uneven: the java and cpp
README example tests check structure only, js has none, the swift test
checks that delimiters balance, and perl's runner rewrote every block
before running it (changed in 3.3, section 3.4). php's README example test
removes the page's own `require_once` and requires the SDK by an absolute
path (`ts/project/.sdk/src/cmp/php/ReadmeExamplesTest_php.ts:304-318`;
guide writer, read), the same blind spot perl's runner had; php's root
import is path-relative, like perl's `use lib`.

---

## 3. Results so far, hypothesis by hypothesis

No overall verdict is given: seven languages, the measures at twenty, and
the follow-ups that would decide H3 and H5 are outstanding. Each
hypothesis has its standing at version 3.3.

### 3.1 H1: one shared component plus one provider per language

H1 has three refutation criteria. They stand differently.

**Criterion 1: providers reading the model. Holds at thirteen.**

| When | Model reads in providers | Who | How |
|---|---|---|---|
| Stage 1 | 0 in ts, go, py, c, but reached by copying naming rules into providers (c copied its reserved set and identifier rule, zig its reserved set, py derived the module from the name). Under a strict reading 3 or more providers crossed the line | independent | ran (count) and read |
| Stage 2 (v2) | 43 hits in six providers before naming hooks, 1 after (a c array subscript judged a false positive) | independent | ran |
| Stage 4 tools, on the providers as stage 3 left them | 36 open findings: a `v + 's'` plural in all 8 hooks, `Name + 'SDK'` in 7 | builder | ran |
| 3.1, 3.2 | 0 open in all nine | builder; confirmed by the 3.1 checker | ran |
| 3.3 | 0 open in all thirteen; rb and perl carry path-join allowances with reasons | builder | ran |
| Base for the last seven (3.3, tools merged) | 0 open in all thirteen; accepted findings with reasons: 1 to 4 per language (clojure and elixir 4, rust 3) | base builder | ran |

The naming hook is what made this hold: the documentation calls the same
functions the code generator calls. That needed naming functions the
generators did not yet have (py, clojure, elixir, ocaml), extracted from
their components; for ocaml an independent reviewer generated a whole OCaml
SDK before and after and found only README.md and REFERENCE.md differ.

**Criterion 2: per-language prose over about 15%. Not crossed by source
at 3.2, at stage 9 or at thirteen languages (crossed for go's REFERENCE at
version 3); crossed for go by one other measure, which is shown to count
shared code.**

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

Disagreement in the records: the checker of 3.1 judged H1 refuted with go at
25.6% (go-only words plus notes, three sections). The builder of 3.1 said
"partly". The by-source figure, which counts what a provider writes, is
under 15% for every language over the three sections at 3.2 and at stage 9.
It was not always: at version 3, go's notes alone were 20.5% of its
REFERENCE prose by the builder's count (18.9% by the checker's denominator),
and the builder called that criterion crossed; at 3.1 the checker measured
go's REFERENCE notes at 7.8%. This record does not call the prose criterion
crossed, and says that the "alone" measure crosses it for go (17.0%
against thirteen at the base; 18.6% at `v33s`; before the identity fix,
22.6%).

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

The limit was about 10. It was first reached at version 3 and has been
crossed since. Appendix B lists each change.

What the criterion measured and what it did not: the running count counts
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

One more change is pending outside the count. The H5 builder added a
required `interface` field to the provider type, with a check at load
(section 3.5). It is on that builder's branch, not in the base the seven
ports start from. Adopted, it would be one more breaking change, touching
every provider by one line, and every later breaking change would also
raise the declared version.

**Standing:** refuted on the breaking-change criterion (about 25 to 27
against about 10, or about 31 to 33 with the forms framework). Holds on
model reads at thirteen languages. Prose: under the line by source at
thirteen (at most 7.2%, go); over it for go by the "alone" measure (17.0%).
To be measured at twenty.

### 3.2 H2: the source shrinks at least 2x

**Refuted for the measured languages on every count that includes what a
port must write, at nine languages and again at thirteen.**

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

Projected to twenty (before 15,038; the seven unported providers at the
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
choose, and states that on the documentation-code count alone the thirteen
measured languages shrank 1.83x (the nine at 3.2, 1.61x), under 2x.

**Standing:** refuted at nine languages (3.2) and at thirteen (the base
for the last seven) on every measured count: 1.83x for documentation code
alone, 1.41x with forms, 1.02x with the guard. Over 2x only as a
projection to twenty of documentation code alone at the measured provider
size (2.16x), which 1.5 times larger providers bring under (1.94x). To be
measured at twenty after the last seven ports.

### 3.3 H3: catalogued issues fixed once, for every language

**Not decided. Measured against the whole catalogue at 3.3 by a builder,
then checked by an independent checker, who reproduced the measurement and
corrected it in four places, one of them without effect on the result.** The
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

**Standing:** not decided. On the criterion as worded, a per-language
edit, the share is under 10% by the brief's rule (2.8%) and on a strict
reading (5.6%); only the strictest reading, which counts the type and
constructor printers the brief exempts, is over (16.7%; builder 13.9%).
The claim, that the issues are fixed once, is not shown: at the frozen
state 7 of the 36 entries (19%) are not fixed or only partly fixed, all in
shared code the prototype had already edited, and counted against the
proposal they give 22% to 36%, over the line on every reading. What would
decide it: the seven shared edits (X3, S22, U52, U53, V27, U102 and D26's
rows), which are being made, with their result to be added here; the seven
remaining ports; the fence-aware checks, with code-only and any-wording
variants, run over all twenty; and a count showing that the seven ports
add no line of their own beyond S13's `testMock`.

### 3.4 H4: examples still compile and run

**Holds where a toolchain exists. Untested for five of the thirteen.**

At 3.3 (freezing builder, ran; the same new-code counts were reproduced by
the checker at 3.1 and by the verifier of stage 9; the 3.2 counts are the
merging builder's own):

| Lane | Old code | 3.3 |
|---|---|---|
| ts README | 16/16 | 16/16 |
| go README | 12/12 | 12/12 |
| py README (real pytest) | 12/12 | 12/12 |
| c documentation | 5/6 | 6/6 |
| rust documentation | 6/6 | 6/6 |
| rb README | 48/49 | 49/49 |
| zig documentation (Zig 0.16.0) | 5/6 | 6/6 |
| perl README, three models | 7/7 | 7/7 |

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

**Standing:** holds for ts, go, py, c, rust, rb, zig and perl. Not tested
for clojure, elixir, swift, ocaml and lua. No failure intrinsic to the
approach remains in a language with a toolchain; one (perl's root import)
was intrinsic to the interface as it stood and needed an additive change.
No lane was re-run at the base for the last seven; its sdkgen is the
frozen tag unchanged, so these results stand as they were measured there.

### 3.5 H5: existing projects, packs and aliases move safely

**Not decided. Measured on the real structure at 3.3 by a builder, then
attacked by an independent checker who re-ran every row and 22 states of
their own; both ran every verb on real `.sdk` projects.**

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
is building both; they will be attacked in turn, and the result will be
added here.

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
eight (38), of which 28 are fixed once and 7 are not fixed or only in part
(section 3.3). The classes are a reading checked by two samples, not a
measurement (section 4.4). A quarter (81) is already written once; 46 of
those need shared derivations that the proposal assumes and does not supply.
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
   are fixed by shared code alone, 1 needed lines of each language (S13),
   1 is fixed only in part (D26), 6 are not fixed (X3, S22, U52, U53, V27,
   U102: shared before the prototype, and edited by it, but not for these
   entries), and 2 show only in js, which is not ported (N11, M35).
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
| Stays | 35 | Among them WP08 (its T entries are the unfixed ones in `ReadmeRefFeatures.ts`), WP16 (needs `featureOnByDefault`), WP22 (a generate and doctor error), WP36 (34 issues, 33 of them a consumer target's), WP41 (the pack would have to port its own families), and four with no issue of their own (WP03, WP19, WP27, WP44b), which supply what other packages read: the text guard and the derivations, which the proposal still needs |

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
sections built, 28 of the 36 entries that are fixed or due were fixed once,
in shared code, for every ported language. Of the other eight, one needed
lines in each language, and seven, all in shared code, were not fixed or
(D26) only in part, so
the claim of "fixed once" is not yet shown (section 3.3). The 28 S entries
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

On the way, the guard was found to have defects of its own: its
undocumented-member check had never fired in any language (a literal
`{ctor}` in its list became the wildcard `\w+`); its regular expressions
knew six language families; a citation of an undeclared fact was excused
as "ahead of a provider"; a missing field flag was never checked. Each was
closed when found.

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
not yet corrected in the forms). Citations made "ahead" in the seven's forms
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
verdict in the reviewed set for that reason (section 3.1).

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

### 5.7 Defects of the generated runtimes, found by reading them for the documentation

Fixed in the prototype only where marked.

- ts, js: `test()` threw without the test feature (`makeFeature` had no fallback); fixed in the prototype with a test; ran.
- ts: an operation given `ctrl` with `explain: true` throws a TypeError (about 8 pipeline assignment sites); js ignores it; ran.
- php: explain is copied into the context, so the caller never sees the record, and an empty array records nothing (`ts/project/.sdk/tm/php/core/Context.php:55`, `ts/project/.sdk/tm/php/utility/Done.php:25`); read.
- py: direct() lets an exception from a caller-supplied `system.fetch` propagate; ran. The survey reads the same in rb, php, perl, lua, elixir, clojure, ocaml and cpp.
- zig: no live transport; `fetcher_util` ends in `ctx.fail('fetch_transport', ...)` (`ts/project/.sdk/tm/zig/core/utility.zig:2332-2336`); read.
- lua: operations document `---@return string? err` while the code returns the `sdk_err` table (`ts/project/.sdk/src/cmp/lua/fragment/EntityLoadOp.fragment.lua:10-12`, `ts/project/.sdk/tm/lua/utility/make_error.lua`); read.
- c: `err` is never reset in examples, and the runtime returns NULL whenever `*err` is already set (`ts/project/.sdk/src/cmp/c/fragment/EntityListOp.fragment.c`); read.
- swift: `deleted()` is not on the Entity protocol; read.
- elixir: entity modules do not delegate `deleted/1`; read.
- java: `deleted()` is not on `SdkEntity`; read (survey).
- ocaml, cpp: an entity is marked deleted whatever the outcome; ocaml after a failed remove under `throw: false`; read.
- csharp, scala: accessors write `active` into the caller's options map; read.
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

Defects of sdkgen's own tools, found by the H5 rounds:

- `doctor prune` deleted superseded files during a dry run (`-y`); read (H5 builder); fixed on the H5 branch.
- the copy record's reader drops a line it cannot parse without a finding (`ts/src/action/copies.ts`, `readCopies`). On `main` that is deliberate (its comment says a copy can then only lose its entry); once retirement is gated on the record, an unchanged old copy then reads as an override, is kept and used, and `doctor` passes; ran (H5 checker), with a synthesised damaged line.
- `target remove` leaves the target's compiled components in `.sdk/dist/cmp/<target>/`; after a re-add of the same target they are loaded; ran (H5 builder and checker).
- `tsc --build src` in a project reports up to date after the installed sdkgen changes underneath it, so a stale build runs; ran (H5 builder and checker). This is how incremental builds behave; the scaffold's generate runs that build first.
- the copies warning at generation calls missing files "changed in this project", and after a rollback states the version direction backwards; ran (H5 builder).

---

## 6. What it cost

### 6.1 Interface changes by round

| Round | Breaking | Additive | Cause | From a newly ported language |
|---|---|---|---|---|
| Stage 1 | 1 (before the first commit) | 2 before commit, 2 from the interface probe | writing go and c; zig and clojure | 0 |
| Stage 2 (v2) | 4 by v2's count (2 provider, 2 shared-only); the naming hook disputed | 8 | the stage-1 requirements | 0 |
| Stage 3 (REFERENCE) | 1 (`RefFacts.container`) | about 5 | the REFERENCE | 0 |
| rust and elixir port | 0 | 5 | the port | 0 |
| Version 3 shape | 5 (all elective; 3 avoidable with deprecated aliases) | 11 | interface rewrite | 0 |
| Version 3 freeze | 1 (a forms file per language) | 3 | the rebuilt guard | 0 |
| rb pilot | 0 | 1 | the port | 0 |
| 3.1 | 1 (forcing 0 providers) | 6 | shared fixes | 0 |
| 3.2 | 9 shared (8 + 1) and 4 forms-framework (3 + 1) | 3 shared, 5 forms, 1 tools | turning shared defaults into declared facts | 0 |
| Sentence fix round | 2 | 3 | the sentence review | 0 |
| First wave, while porting | 0 | (recorded, not made) | the ports | 0 |
| 3.3 | 3 shared (stream signal, wrapped unwrap, utility copy) and 2 forms | 11 | the first-wave reviews, the survey, the guard | 2 or 3 |
| Base for the last seven | 0 | 0 | none: the frozen interface unchanged | 0 |
| H5 branch (not in the base) | 1 if adopted: a required `interface` field in every provider | a `package check` rule | versioning the interface for packs (section 3.5) | 0 |

Cumulative breaking changes since the first four languages: about 25 to 27
(3.3 builder), counting the provider interface and changed shared
sentences but not the six forms-framework changes in the table; with them,
about 31 to 33. The records disagree on details: v2 counted 4 and stage 3
counted about 6, over different spans and different changes (stage 3
counted from stage 1's first commit, included the stage-1 `before` change,
the naming hook and its own `RefFacts.container`, and left out the
`sdkDescription` signature); at 3.3, the shared builder and the freezing
builder each count three breaking changes but not the same three (the
freezing builder's classification is used here). Appendix B lists the
changes.

What the porters see: a new port at 3.3 writes a hook, a provider and a
forms file, and declares facts the earlier ports did not have to
(`testMock`, `okFalse`, `calls`, `streamSignal` where it applies). The
seven ports under way are the first to start from 3.3. Their guide (version
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

Self-test controls written against shared text break when the text
changes, whatever the tools' logic: after the sentence fixes 22 controls
had to be re-aimed at the new text (the first run failed 40, which also
exposed two tool defects), and 16 failed at 3.3 because two paragraphs
were re-wrapped.

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
and regenerated identical at the base.

### 6.4 One port in the first wave

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

---

## 7. What this evidence cannot show

- **One model family.** Every page was generated from one demonstration
  model (`Demo`, seven entities) and 21 single-switch variations of it.
  Real specifications with other shapes were not used.
- **Five of thirteen languages were never compiled.** clojure, elixir,
  swift, ocaml and lua examples were checked by structure and by reading.
  csharp, kotlin and scala will be in the same position.
- **The lanes compile their own models**, not the 21 review variations. A
  changed block that no lane model produces is compiled by nothing even in
  a language with a toolchain.
- **Much of the checking is human.** Hundreds of classes per language are
  decided by hand; 67 citations (3.2) are pinned prose checked only by a
  reviewer; the survey of twenty runtimes is one reader's claim per line,
  read and not run.
- **The checks were attacked by the same team.** The checkers and verifiers
  were independent of each build but drew on the same records; the attack
  sets grew from what earlier attacks found.
- **Thirteen is not twenty.** The interface has needed new facts at every
  wave; the seven remaining languages include the statically typed
  JVM and .NET runtimes, whose old pages already said "raise" where the
  runtime throws.
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

---

## 8. Not done yet

- **The seven remaining ports**, from the base for the last seven
  (`v33-frozen` with the merged tools, tag `base33`) and guide 3.3: js,
  java, php and cpp are being ported; csharp, scala and kotlin queue behind
  them. Each is to be reviewed, fixed and verified as the first wave was.
  Their results go to appendix A and sections 3.1 to 3.4.
- **Integration at twenty languages**: the seven merged, the one command
  for all twenty, the repository suite, the golden test and the example
  lanes, including lanes that run php, java and cpp examples (on `main`
  the java and cpp README tests check structure only, and php's strips the
  page's own import; section 2.4) and a first lane for js, which has none.
- **The measures at twenty languages**: H1 prose by source and by language,
  H2 lines with each count of section 3.2, purity, and the interface count
  re-counted rather than carried from the freeze.
- **H3's seven shared edits**: X3, S22, U52, U53, V27, U102 and D26's
  missing rows. They are being made; then the fence-aware checks, with
  code-only and any-wording variants, are to be run over all twenty after
  the ports, and the seven ports' own lines for S13 counted. The result
  goes to section 3.3. Two readings the checker left unscored (S13's
  residue without the test feature; the log feature's "set to true") are
  to be decided with it.
- **H5's two structures**: retired copies recognised without the copy
  record, and an interface that can move without stopping a pack. A
  follow-up is building both; they will then be attacked in turn. The
  result goes to section 3.5. Not measured by anyone yet: edition
  components retired end to end; a pack that ships providers upgraded
  across a raise end to end; a version for the naming hook; the CLI's
  one-line drift summary, which omits retired, outdated and orphan counts.
- **Sentences of the four first-wave ports**: 81 distinct sentences that
  only they print have no id or verdict in the reviewed set.
- **The stage-9 verifier's required fixes to the staleness checks** were
  made in the 3.3 round and pass the verifier's attacks, but the builder of
  the tools round beside the freeze beat them with five of six attacks of
  its own (a staged file deleted from the project, a source time set back,
  a loose OLD marker, a correction record quoting OLD as NEW, a quotation
  found only in another language's component); that round's merge into
  the base did not touch them, and none is fixed. The verifier also found
  that the documented procedure for moving an in-progress port onto new
  tools left 16 open classes where 5 were predicted; the tools round wrote
  a new step list that was not run end to end.
- **The runtime table's three omissions** (kotlin's and scala's
  no-argument constructors, js's `name` field) are recorded in the guide,
  not corrected in the forms.
- **Facts recorded and not yet expressible**: ocaml's `e_deleted` marker and
  operation parameter names; lua's whole-record print in the root quick
  start; ocaml's stream kind (two readings left for the ocaml porter).
- **Unported README sections** still contradict the ported pages (test
  mode, error handling).
- **Runtime defects** in section 5.7 are recorded, not fixed (except the ts
  and js test fallback).
- **The catalogue's open borders** (section 4.4) are carried as ranges; no
  family beyond the three sections was built to settle a package's fate.

---

## Appendix A. The thirteen languages at version 3.3

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
| 7 | Stage 3 | `RefFacts.container` | the five REFERENCE providers |
| 8 | Version 3 | `RefFacts.classes` replaced by `entityBy`; `DescSymbols.type` removed | elective |
| 9 | Version 3 | `DescSymbols.vars` removed; plurals from apidef's pluralize; `Naming.ident` | elective |
| 10 | Version 3 | `RefSyntax.read(value, key)` required | all 8 |
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
| 33 | 3.3 (forms) | absences searched over the whole runtime; type words; required call notation; whole-record check | all 13 forms; the 7 unported must add calls |
| 34 | 3.3 (forms) | no ahead exemption once a provider exists; field flag checked when omitted; deleted and arity re-derived | ports that cite ahead or omit a flag |

The rows above are 34 entries, counting the forms-framework changes, the
shared-only changes and the disputed row. The records' own running count
(about 25 to 27 at 3.3) is lower: it leaves out the six forms-framework
rows (24 to 27, 33, 34), and from 3.2 adds two changed shared sentences
that have no row here. The records say "about" because builders split and
classify changes differently (the version-3 checker counted about 10
by type diffs where the builder counted about 12), and no record reconciles
its count row by row. On either count the limit of about 10 is crossed.

## Appendix C. Attacks that nothing mechanical catches at 3.3

From the freezing builder's re-run of every attack at `v33-frozen`, the
tools records and the H3 check. "Caught by" says what, if anything, fails.

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
