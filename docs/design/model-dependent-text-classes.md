# The issue catalogue by class: what the write-once proposal reaches

Status: **classification, checked by samples** (2026-11-15; the state of
the T rows brought to the prototype's twenty-language result on
2026-11-17, with no class or count changed). This page
gives each of the 329 entries of `docs/design/model-dependent-text-issues.md`
(sdkgen 9aebaf9e) one class, so that a maintainer can check any row. It
is the evidence behind section 4 of
`docs/design/model-dependent-text-prototype.md`, which says what the
numbers mean for the proposal. The classes were read from each entry's
Fate, Class, Where and Fix lines, and corrected where a check found them
wrong; nothing here was run except the completeness check and the counts.
The working files of the classification are not in this repository.

## 1. The classes

| Class | What it holds |
|---|---|
| T | Text in the three sections the prototype built (the README tutorial, the root README quick start, the REFERENCE), as the prototype's measurement of its hypothesis H3 (catalogued issues in those sections are fixed once, for every language) scoped them: "yes" wholly, "part" in part |
| S | Text written by per-language documentation components outside those sections, of the same kind: writing that family once, conditioned on the model (sub-class "model") or on a declared runtime fact ("runtime fact"), would fix it. Not built |
| L | One language's own text, which no other language repeats |
| O | Text already written once, in a shared component, helper, model or schema: one edit, whatever is decided. Sub-class "needs a derivation" when the fix needs a shared answer no function gives at 9aebaf9e; "plain" otherwise |
| C | A consumer target's own writer (go-cli, go-mcp, py-data) |
| G | Generated source: its behaviour, or a comment in it |
| K | The tools: the generator's own actions and warnings, docgen, create-sdkgen, apidef |
| P | The language pack's own text |
| N | Not a defect (the catalogue's Fate says so) |

The proposal's mechanism addresses T and S. It does nothing for L, C, G,
K and P. O is one edit today; whether it is a good edit depends on the
derivation it needs.

Two rules decide the cases the definitions leave open. An entry whose whole
fix is another entry's change takes that entry's class (so S12, S14, S19
and S20, whose fix is S11's generate and doctor error, are K). Docgen's
text is K. A third rule, for consistency, puts the language pack's
generated code in G (M16, M17, M18, A03, U88).

"Distinct" counts a defect once: 66 entries say in their Fate that they
repeat another, which leaves 263 distinct defects, and a repeat is counted
under its root's class. So T has 38 entries but 26 distinct defects here,
where the H3 measurement counts 30: four in-scope entries repeat a root of
another class (S13 repeats S11, K; M37 repeats G28, K; X6 repeats S29, S;
S25 repeats S23, S).

## 2. Counts

| Class | Entries | Distinct | Range, entries | Range, distinct |
|---|---|---|---|---|
| T | 38 (yes 13, part 25) | 26 (yes 11, part 15) | 37 to 38 | |
| S | 28 (model 20, runtime fact 8) | 24 (model 18, runtime fact 6) | 21 to 32 | 18 to 27 |
| L | 6 | 6 | 5 to 13 | 5 to 12 |
| O | 81 (needs a derivation 46, plain 35) | 67 (39, 28) | 78 to 81 | 65 to 67 |
| C | 33 | 28 | | |
| G | 40 (behaviour 31, comment 9) | 29 (21, 8) | 35 to 40 | 24 to 29 |
| K | 83 | 65 | 83 to 84 | |
| P | 13 | 12 | 13 to 18 | 12 to 17 |
| N | 7 | 6 | | |
| Total | 329 | 263 | | |

The ranges come from the borders named in section 5, not from a sampling
estimate. Beyond them, the blind sample (section 5) allows up to about 7
misclassified entries among the 229 outside the samples.

Entries per catalogue section:

| Section | n | T | S | L | O | C | G | K | P | N |
|---|---|---|---|---|---|---|---|---|---|---|
| S | 50 | 7 | 7 | 0 | 22 | 7 | 0 | 6 | 0 | 1 |
| X | 7 | 2 | 1 | 0 | 4 | 0 | 0 | 0 | 0 | 0 |
| G | 31 | 3 | 3 | 0 | 5 | 9 | 7 | 4 | 0 | 0 |
| V | 32 | 1 | 2 | 3 | 4 | 1 | 8 | 12 | 1 | 0 |
| U | 108 | 9 | 8 | 3 | 31 | 11 | 8 | 22 | 10 | 6 |
| N | 24 | 2 | 0 | 0 | 3 | 1 | 4 | 13 | 1 | 0 |
| M | 49 | 7 | 2 | 0 | 6 | 2 | 8 | 23 | 1 | 0 |
| D | 23 | 7 | 4 | 0 | 6 | 2 | 3 | 1 | 0 | 0 |
| A | 5 | 0 | 1 | 0 | 0 | 0 | 2 | 2 | 0 | 0 |

## 3. The three numbers

1. **What the mechanism addresses (T and S): 66 entries of 329 (20%), 50
   distinct of 263 (19%).** Range 58 to 70 entries (18% to 21%), 44 to 53
   distinct. The low end moves the S and L border to L (S15, S27, G03, V1,
   U59, U60, D27: 7 entries, 6 distinct) and S13 to K; the high end moves
   the O and S border to S (S05, U58, X1: 3 entries, 2 distinct) and U42
   to S. The prototype tested T: 38 entries (12%), 26 distinct (10%). At
   its frozen state at thirteen languages, after the independent check of
   the H3 measurement, 28 of the 38 were fixed by shared code alone; 1
   needed lines of each language (S13); 1 was fixed only in part (D26); 6
   were not fixed (S22, X3, U52, U53, V27, U102, in
   `ts/src/cmp/ReadmeRefFeatures.ts` and `ts/src/cmp/FeatureDocs.ts`,
   shared before the prototype and edited by it, but not for these
   entries); 2 showed only in js, which was not yet ported (N11, M35). At
   the final state, twenty languages: the six were fixed by one shared
   edit each, so 34 are fixed by shared code alone; S13 needs one declared
   fact in each language's provider; D26 is fixed in part (its rows for
   `extend` and `utility` need a declared fact per runtime); N11 and M35
   are fixed for js through the fence its provider declares. The catalogue
   checker finds none of them on the new pages of any of the twenty. The
   shared edit for X3 printed a new sentence under `secrets` that is false
   in 17 runtimes, which no check saw (prototype record, section 3.3).
2. **One edit today (O): 81 entries (25%), 67 distinct (25%).** Range 78
   to 81 entries, 65 to 67 distinct; the low end moves S05, U58 and X1 to
   S. Of these, 46 entries (39 distinct), give or take 3 for the
   sub-class error the blind sample measured, need a derivation that no
   shared function gives at 9aebaf9e: `targetSurface`, `targetPlace`,
   `docLink`, `featureOnByDefault`, `modelCopyMode`, a release-tag helper,
   `apiDisplayName`, `definitionKind` and others. That is the "one answer
   per fact" half of `docs/design/model-dependent-text.md`, which the
   proposal needs and does not supply. The other 35 entries (28 distinct)
   are plain edits.
3. **What the proposal does nothing for (L, C, G, K, P): 175 entries
   (53%), 140 distinct (53%).** L 6 (6 distinct), C 33 (28), G 40 (29), K
   83 (65), P 13 (12). With the 7 entries that are not defects, 182 (55%).
   Range 174 to 183 entries (53% to 56%), 139 to 146 distinct: the low end
   moves U42 to S, the high end moves the S and L border to L and S13 to
   K. The G and P border moves entries between G (35 to 40) and P (13 to
   18) and does not change this total.

## 4. The 46 work packages

The fate of each package of `docs/design/model-dependent-text-plan.md` if
the proposal were adopted for every README family: (a) it disappears into
"port that family"; (b) it shrinks; (c) it stays as it is. Issue
membership is from the plan's appendix A; S09, G27 and V27 were assigned
by hand (to WP16, WP33 and WP18), because a pipe in their titles breaks
that table. The fates are a reading of the issues' classes, not a measured
port, and a package that disappears or shrinks still costs the port of
its family.

Result: (a) 2, (b) 9, (c) 35. One border could move one package: if S05,
U58 and X1 fell to S, WP07 would shrink, giving (b) 10 and (c) 34. Moving
the S and L border to L leaves WP30, WP35 and WP37 shrinking, because each
keeps other T or S issues. Four packages (WP03, WP19, WP27, WP44b) hold no
issue of their own. The 7 entries that are not defects have no package.

| Package | Issues | T | S | L | O | C | G | K | P | N | Fate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WP29 | 10 | 9 | 1 |  |  |  |  |  |  |  | (a) every issue is a quick-start, options-row or REFERENCE constructor in a per-language copy (T 9, S 1); porting those families is the package |
| WP31 | 14 | 6 | 8 |  |  |  |  |  |  |  | (a) operation-dependent prose in ReadmeModel, ReadmeQuick, ReadmeIntro and ReadmeRef copies (T 6, S 8); porting the families is the package |
| WP18 | 5 | 3 |  |  | 2 |  |  |  |  |  | (b) G29 goes with the ported cell sinks; V27, U102 and U103 stay shared escaper work (the prototype fixed V27 and U102 by shared escaper edits, not by porting; U103 is not fixed) |
| WP21 | 8 | 1 | 2 |  | 1 |  | 3 |  | 1 |  | (b) the README halves go with the ported families; the core pre-pass of the plan's decision DQ1, for generated code (G05, V11, M39), U74 and the pack (U20) stay |
| WP28 | 14 | 3 |  |  |  |  | 11 |  |  |  | (b) the three type-printer entries go with the ported families; eleven code-generator entries (auth predicate, Config, regex) stay |
| WP30 | 8 |  | 6 |  |  |  | 2 |  |  |  | (b) the live-test how-to sentences go with a shared how-to (given declared runtime facts); the kotlin and cpp live harnesses (U72, U73) stay |
| WP32 | 7 |  | 4 |  | 1 |  | 2 |  |  |  | (b) the cd and .env.local sentences go with a shared how-to; the ../.sdk literal in 69 templates and components (V32, D60) and G21 stay |
| WP33 | 9 | 5 | 1 |  |  |  | 2 | 1 |  |  | (b) the README cell sinks go; the jostraca raw mode (G28) and the code escapers (N15, D70) stay |
| WP34 | 5 | 1 | 1 |  | 2 |  |  | 1 |  |  | (b) D04 and S15 go with the ported REFERENCE and explanation tree; N09, M33 (shared sentence) and M10 (feature model) stay |
| WP35 | 11 |  | 3 | 4 |  |  | 4 |  |  |  | (b) U60, D27 and D29 shrink to shared install sentences; the four L entries, the Makefiles (U04, V10, V21) and VERSION/LICENSE (U32) stay |
| WP37 | 9 | 3 | 2 | 2 |  |  | 2 |  |  |  | (b) three T and two S entries go; V5, V6 (one language), G18 and U84 (generated code) stay |
| WP01 | 5 |  |  |  |  |  |  | 5 |  |  | (c) no T or S issue (K only) |
| WP02 | 3 |  |  |  |  |  |  | 3 |  |  | (c) no T or S issue (K only) |
| WP03 | 0 |  |  |  |  |  |  |  |  |  | (c) no issue is assigned to it in the plan's appendix A; it supplies what other packages read (guard, derivations, root plan, pack surface), which the proposal still needs |
| WP04 | 1 |  |  |  |  |  |  | 1 |  |  | (c) no T or S issue (K only) |
| WP05a | 5 |  |  |  |  |  |  | 5 |  |  | (c) no T or S issue (K only) |
| WP05b | 2 |  |  |  |  |  |  | 2 |  |  | (c) no T or S issue (K only) |
| WP06 | 2 |  |  |  |  |  |  | 2 |  |  | (c) no T or S issue (K only) |
| WP07 | 8 |  |  |  | 8 |  |  |  |  |  | (c) no T or S issue (O only) |
| WP08 | 15 | 4 |  |  | 7 |  |  | 4 |  |  | (c) its T entries (S22, X3, U52, U53) are in ReadmeRefFeatures, shared before the prototype; the prototype fixed them by one shared edit each, which needed no port, so the fate does not change; the rest is shared or schema work |
| WP09 | 7 |  |  |  | 5 |  |  | 2 |  |  | (c) no T or S issue (O,K only) |
| WP10 | 6 |  |  |  | 6 |  |  |  |  |  | (c) no T or S issue (O only) |
| WP11 | 8 |  |  |  | 1 |  | 2 | 5 |  |  | (c) no T or S issue (O,G,K only) |
| WP12 | 8 |  |  |  |  |  |  | 8 |  |  | (c) no T or S issue (K only) |
| WP13 | 12 |  |  |  | 9 |  |  | 3 |  |  | (c) no T or S issue (O,K only) |
| WP14 | 12 |  |  |  | 12 |  |  |  |  |  | (c) no T or S issue (O only) |
| WP15 | 12 |  |  |  | 12 |  |  |  |  |  | (c) no T or S issue (O only) |
| WP16 | 5 | 2 |  |  | 3 |  |  |  |  |  | (c) needs featureOnByDefault for S08, S10, U51; S09 and D05 are part-tested only |
| WP17 | 5 |  |  |  | 4 |  |  | 1 |  |  | (c) no T or S issue (O,K only) |
| WP19 | 0 |  |  |  |  |  |  |  |  |  | (c) no issue is assigned to it in the plan's appendix A; it supplies what other packages read (guard, derivations, root plan, pack surface), which the proposal still needs |
| WP20 | 5 |  |  |  |  |  |  | 5 |  |  | (c) no T or S issue (K only) |
| WP22 | 9 | 1 |  |  |  |  |  | 8 |  |  | (c) a generate and doctor error; S13 is T but its fix is the same error |
| WP23 | 4 |  |  |  | 1 |  |  | 3 |  |  | (c) no T or S issue (O,K only) |
| WP25 | 5 |  |  |  | 5 |  |  |  |  |  | (c) no T or S issue (O only) |
| WP26a | 13 |  |  |  |  |  |  | 13 |  |  | (c) no T or S issue (K only) |
| WP26b | 3 |  |  |  |  |  |  | 3 |  |  | (c) no T or S issue (K only) |
| WP27 | 0 |  |  |  |  |  |  |  |  |  | (c) no issue is assigned to it in the plan's appendix A; it supplies what other packages read (guard, derivations, root plan, pack surface), which the proposal still needs |
| WP36 | 34 |  |  |  | 1 | 33 |  |  |  |  | (c) no T or S issue (O,C only) |
| WP38 | 6 |  |  |  | 1 |  | 5 |  |  |  | (c) no T or S issue (O,G only) |
| WP39 | 1 |  |  |  |  |  | 1 |  |  |  | (c) no T or S issue (G only) |
| WP40 | 1 |  |  |  |  |  | 1 |  |  |  | (c) no T or S issue (G only) |
| WP41 | 14 |  |  |  |  |  | 2 |  | 12 |  | (c) the pack has its own README components; it would have to port them itself |
| WP42 | 3 |  |  |  |  |  | 3 |  |  |  | (c) no T or S issue (G only) |
| WP44a | 5 |  |  |  |  |  |  | 5 |  |  | (c) no T or S issue (K only) |
| WP44b | 0 |  |  |  |  |  |  |  |  |  | (c) no issue is assigned to it in the plan's appendix A; it supplies what other packages read (guard, derivations, root plan, pack surface), which the proposal still needs |
| WP45 | 3 |  |  |  |  |  |  | 3 |  |  | (c) no T or S issue (K only) |

## 5. How it was checked

**Classification.** Four classifiers each classed part of the catalogue
(88, 86, 78 and 77 rows). A checker confirmed by script, against every
`### <id>.` heading of the catalogue, that the four tables hold exactly
329 rows: none missing, none doubled, none extra. The heading "The 50
rated medium or low" is not an entry.

**First sample, not blind.** The checker re-decided every entry whose
number ends in 2 or 8 (65 entries, S02 to A02) from its Fate, Class, Where
and Fix lines, and agreed with the classifiers on 61 (94%). The checker
had seen the classifiers' tables before classing the sample, so 94% is an
upper bound. The four disagreements, and the eleven entries outside the
sample that the same reasons move, give fifteen corrections:

| Id | Was | Now | Why |
|---|---|---|---|
| S12 | S (model) | K | The Fix makes no text or copy change: it is resolved by S11's generate and doctor error |
| S14, S19, S20 | O, O, S | K | Each Fix reads "no change once the S11 error lands" |
| U98, M48 | O (needs a derivation) | K | Docgen's text (`content.ts:160-163`), the same site as U07, which was already K |
| U63, U64, U65, U66, U67, U76, U106, A01 | O | K | Written by docgen alone, like V8, V22, V25, V26, G24, G30, U108, M46 and M47, already K |
| U88 | P | G (comment) | Comments in the pack's generated dart and haskell source; the pack's other generated code (M16, M17, M18, A03) was already G |

**Second sample, blind.** A second classifier, who had not seen the
table, classed every entry whose number ends in 2, 5 or 8 (100 entries: S
15, X 2, G 9, V 10, U 33, N 7, M 15, D 7, A 2; 65 shared with the first
sample and 35 new). Its rows were compared with the table after the
corrections above, and each disagreement was decided from the catalogue
entry and the source at 9aebaf9e.

- Agreement on the class: 95 of 100. On class and sub-class: 93 of 100 (T
  rows compared on class only). On the 65 shared with the first sample, 60;
  on the 35 new, 33.
- The blind classifier agreed with three of the first check's corrections
  (S12, U98, M48) and not with the fourth (U88).
- Errors found in this table: no class error in 100, one sub-class error
  (U15, corrected). Errors found in the blind rows: two class errors (V2,
  M18) and one sub-class error (G18). Not decided by the rules: three
  (S05, U58, U88).
- With no class error in 100, the 95% upper bound on the error rate is
  about 3%: up to about 7 of the 229 entries outside the samples could
  still be misclassified, most likely in the pairs below.

| Id | This table | Blind | Decision | How sure |
|---|---|---|---|---|
| S05 | O (plain) | S (runtime fact) | O by the letter: S needs the wrong text to come from a per-language component, and `ReadmeErrors.ts` is shared. In substance the fix is fifteen per-language failure idioms, which is exactly a provider's error-handling block. Carried as a border | rules undecided |
| U58 | O (plain) | S (runtime fact) | Its Fix is "See S05/X1", so it follows S05 | follows S05 |
| V2 | S (model) | L | S. rust's "at the crate root" is a drifted copy of the sentence the other 18 how-to copies print ("at the project root"), and the rust harness reads `../.env.local`, the same place. L is for a sentence no other language repeats | sure |
| U88 | G (comment) | P | Generated source the pack owns; G names comments in generated code, P a pack's text, and the Fix is "follow whatever the bundled comment pass does". Kept G, with M16, M17, M18 and A03. Carried as a border | rules undecided |
| M18 | G (behaviour) | P | G: the lean runtime's behaviour (no server option, no Basic branch); the README half of the Fix follows from it | fairly sure |
| G18 | G (behaviour) | G (comment) | Sub-class only. The marker comment does not depend on the model; the defect is a handler key that never matches and dead handlers | fairly sure |
| U15 | O (needs a derivation) | O (plain) | Plain: the paragraph is in `ReadmeExplanation.ts`'s default row (line 46), and keying rows by `originName`, which exists, with no default row fixes it, as for U14. Corrected | sure |

**What the samples cannot settle.** Both readings worked from the same
structured lines of the catalogue, which drive most classes, so they are
not fully independent. Entries outside both samples were not re-read
against source; they carry the classifiers' classes, apart from the
sixteen corrections (fifteen from the first check, U15 from the second).

**Borders left open, carried as the ranges of sections 2 and 3:**

- O or S: S05, U58, X1. A shared writer holds a per-language wording table
  and the fix is a per-language idiom, which only a declared runtime fact
  supplies.
- G or P: U88, M16, M17, M18, A03. Generated source the language pack
  owns. Moves entries between G and P only.
- S or L: S15, S27, G03, V1, U42, U59, U60, D27. Whether a sentence
  repeated in a few install, explanation or how-to copies would be lifted
  into a shared frame. Not settled by reading those copies.
- T or K: S13 (and S25 with S23, class S). The T class copies the H3
  scope, while the rule that an entry takes the class of the change that
  fixes it would make S13 K, like S11.
- In scope or not: the independent check of the H3 measurement judged U37
  (the go REFERENCE title "Golang", written by go's REFERENCE component)
  arguably in scope; on the rule the measurement used (every site the
  entry names) it stays O here.

Inconsistencies inside repeat chains left as they are, because each is
defensible; distinct counts follow the root: S13 (T) repeats S11 (K); U20
(P) repeats S23 (S); U75 (S) repeats G01 (T); N15 and D70 (G) and M37 (T)
repeat G28 (K).

## 6. The table

One row per entry, in catalogue order. "Where written" is the catalogue's
Class line. "Repeats" is from the entry's Fate. "Also" is the class a
border or a first reading would give instead. Rows changed by a check say
CORRECTED, and the rows the H3 check revised say so (D26, U44, U37).
The reasons of S22, X3 and V27, and of WP18 in section 4, no longer say
the prototype left their component untouched: the H3 check found that it
had edited it, for other entries. No class changed. The rows of the six
entries the prototype later fixed by shared edits (X3, S22, U52, U53, V27,
U102), of D26, and of N04, U06, M04, N11 and M35 say where each stands at
the prototype's final state, twenty languages; so do WP08 and WP18 in
section 4. No class or count changed with them. DQ1, named in a few
reasons, is the plan's first decision for the maintainer (what an
operation-level `active: false` means; the recommended answer is a core
pre-pass before generation).

| Id | Class | Sub-class | Where written | Component | Repeats | Also | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | O | needs a derivation | neutral-component | ts/src/cmp/Changelog.ts:23 |  |  | One fixed string in the shared Changelog component; the fix needs targetSurface. |
| S02 | O | needs a derivation | neutral-component | ts/src/cmp/Changelog.ts:22 |  |  | The six language names are a literal in one shared component; listing active SDK targets needs targetSurface. |
| S03 | O | needs a derivation | neutral-component | ts/src/cmp/Security.ts:34 |  |  | The registry list is a literal in shared Security.ts; the fix also needs targetSurface. |
| S04 | O | needs a derivation | neutral-component | ts/src/cmp/PublishWorkflow.ts:417 |  |  | publishingDoc is one shared writer with a literal cd ts; the fix needs targetPlace. |
| S05 | O | plain | neutral-component | ts/src/cmp/ReadmeErrors.ts:25-53,212; ts/src/helpers/opExample.ts:20 |  | S (runtime fact) | A shared component with a LANGS table and a TypeScript default row writes it once; the fix is still a per-language error idiom for 15 languages. |
| S06 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuideTop.ts:33 |  |  | An unconditional sentence in the shared root guide writer; counting SDK targets needs targetSurface. |
| S07 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuideContent.ts:126 |  |  | workflowSection() is shared and names ts/ and go/ literally; the fix needs targetPlace. |
| S08 | O | needs a derivation | neutral-component | ts/src/cmp/ReadmeFeatures.ts:31 |  |  | A fixed paragraph in the shared ReadmeFeatures; the fix needs featureOnByDefault. |
| S09 | T | part | neutral-component | ts/src/cmp/ReadmeFeatures.ts:29-30; ts/src/cmp/ReadmeRefFeatures.ts:24,133 |  |  | In the H3 scope, in part (REFERENCE half built, README Features half not). |
| S10 | O | needs a derivation | neutral-component | ts/src/cmp/ReadmeTop.ts:245-246 |  |  | The root README features line is in shared ReadmeTop; the fix needs featureOnByDefault. |
| S11 | K |  | neutral-component | ts/src/sdkgen.ts guard; ts/src/action/doctor.ts |  | S (model) | The fix changes no text: a generate-time and doctor error for a missing test feature. |
| S12 | K |  | per-language-copy | ReadmeHowto_<lang>.ts (20); fix is S11's error | S11 | S (model) | CORRECTED from S: the Fix makes no text or copy change; all its work is S11's tool error. |
| S13 | T | part | per-language-copy | ReadmeModel_<lang>.ts and ReadmeRef_<lang>.ts | S11 |  | In the H3 scope, in part; clean only through testMock declared in every Syntax provider. |
| S14 | K |  | neutral-component | ts/src/cmp/ReadmeExplanation.ts:281; fix is S11's error | S11 | O | CORRECTED from O: the Fix is "no change beyond the S11 error". |
| S15 | S | model | per-language-copy | ReadmeExplanation_<lang>.ts (18); langpack dart |  | L | 18 module trees repeat (Base, Test, Log); the feature list could come from the description, the rest of each tree is one language's own. |
| S16 | O | plain | neutral-component | ts/src/cmp/AgentGuideContent.ts:189 |  |  | One literal sentence in the shared featureSection(); the fix deletes it. |
| S17 | O | plain | neutral-component | ts/src/cmp/ReadmeExplanation.ts:300 |  |  | A shared lead-in written before a loop; a local reorder. |
| S18 | O | plain | neutral-component | ts/src/cmp/ReadmeTop.ts:588-605 |  |  | Shared ReadmeTop writes heading and header before the row filter; a local reorder. |
| S19 | K |  | neutral-component | ts/src/cmp/AgentGuideFeature.ts:50; fix is S11's error | S11 | O | CORRECTED from O: the Fix is "no change needed once the S11 error lands". |
| S20 | K |  | per-language-copy | ReadmeModel_ts.ts:93; ReadmeModel_js.ts:71; fix is S11's error | S11 | S (model) | CORRECTED from S: the Fix is "no change once the S11 error lands". |
| S21 | C |  | consumer-main | py-data/Main_py-data.ts:700-703; tm/py-data/pkg/fetch.py |  |  | Written by the py-data Main alone, with a code half. |
| S22 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:50-53 |  |  | In the H3 scope, wholly. Not fixed at the prototype's frozen state at thirteen languages; then fixed by one shared edit, clean in all 20 languages. |
| S23 | S | model | per-language-copy | ReadmeModel_<lang>.ts (20, Object.keys(ent.op)) |  | K | All 20 ReadmeModel copies compute their own op list; the catalogue's preferred fix is a core pre-pass (DQ1). |
| S24 | S | model | per-language-copy | ReadmeEntity_<lang>.ts (19) | S23 |  | 19 entity tables read raw ops; a shared ReadmeEntity reading description ops fixes all at once. |
| S25 | T | yes | per-language-copy | ReadmeRef_<lang>.ts (19) | S23 |  | In the H3 scope, wholly. |
| S26 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuideFeature.ts:41 |  |  | A literal six-op list in one shared guide; needs an active-op union no shared function gives. |
| S27 | S | model | per-language-copy | ocaml/ReadmeModel_ocaml.ts:103-107 |  | L | Only ocaml leaves the remove sentence ungated; a shared Result shape gated on ops would remove it, otherwise one ocaml edit. |
| S28 | T | yes | per-language-copy | ts/src/cmp/ReadmeQuick.ts:14-17; ReadmeQuick_<lang>.ts |  |  | In the H3 scope, wholly. |
| S29 | S | model | per-language-copy | ReadmeModel_<lang>.ts (14) |  |  | Unconditional in 14 copies, gated in go and lua; one shared Result shape on the op union fixes it. |
| S30 | S | model | per-language-copy | ReadmeIntro_<lang>.ts (20); opShape.ts:430; ReadmeTop.ts:317 |  | O | 20 intro bodies write the Entities sentence; gating it is per-copy work a shared intro body would do once. |
| S31 | C |  | consumer-main | go-mcp/Main_go-mcp.ts:158-170; ReadmeTop.ts:451-460 |  | O | Written by go-mcp's Main and shared ReadmeTop keyed on the literal go-mcp. |
| S32 | C |  | consumer-main | go-cli/Main_go-cli.ts:317,323 |  |  | Literal words in the go-cli Main only. |
| S33 | C |  | consumer-main | py-data/Main_py-data.ts |  |  | The SomeEntity placeholder appears only in the py-data Main. |
| S34 | O | plain | neutral-component | ts/src/cmp/ReadmeExplanation.ts:338 |  |  | One unconditional sentence in a shared component; reword. |
| S35 | C |  | consumer-main | go-cli/Main_go-cli.ts |  |  | API-key lines only in the go-cli Main, which never calls isAuthActive. |
| S36 | C |  | consumer-main | go-mcp/Main_go-mcp.ts |  |  | Same as S35 in the go-mcp Main. |
| S37 | C |  | consumer-main | py-data/Main_py-data.ts; tm/py-data/pkg/auth.py:97 |  |  | Credential text and behaviour belong to py-data alone. |
| S38 | O | needs a derivation | helper | ts/src/helpers/alongside.ts:20-23,36-37 |  |  | One shared helper writes the note; the fix needs docLink and targetSurface. |
| S39 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuide.ts; AgentGuideFeature.ts |  |  | Links are literals in shared agent-guide components; needs docLink and targetPlace. |
| S40 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuide.ts:46-54; AgentGuideContent.ts:59 |  |  | Shared components write the path note; needs targetPlace. |
| S41 | S | model | per-language-copy | ReadmeHowto_<lang>.ts (20); ts/ReadmeInstall_ts.ts:22-29 |  | L | 20 how-to copies spell the cd directory; a shared how-to taking it from placement fixes them once. |
| S42 | O | needs a derivation | helper | ts/src/helpers/alongside.ts:36-37 | S38 |  | Same shared helper as S38; needs docLink. |
| S43 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuideTop.ts:53-56 |  |  | Shared root guide links every target guide; needs docLink and targetPlace. |
| S44 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuideTop.ts:53-56 | S43 |  | Same site and fix as S43. |
| S45 | O | needs a derivation | neutral-component | ts/src/cmp/ReadmeTop.ts:392,396,418,689 |  |  | Shared ReadmeTop builds tgt.name/README.md links; needs docLink. |
| S46 | K |  | other | ts/project/.sdk/src/cmp/ts/Main_ts.ts:80-83; guardModel, package check |  | G (behaviour) | The fix makes generate and package check refuse phase.entity off; tool work. |
| S47 | O | needs a derivation | model-schema | ts/model/sdkgen.aontu:150-153; PublishWorkflow.ts:87-90; Deploy.ts:218 |  | K | One releaseTag derivation read by shared PublishWorkflow and Deploy, or a schema removal. |
| S48 | N |  | neutral-component | ts/src/cmp/ReadmeTop.ts:680 |  |  | Fate: not a defect. |
| S49 | T | yes | per-language-copy | ReadmeQuick_<lang>.ts and ReadmeTopQuick_<lang>.ts (32) |  |  | In the H3 scope, wholly. |
| S50 | T | part | per-language-copy | ReadmeQuick/TopQuick/Model/Ref/Howto_<lang>.ts (100) |  |  | In the H3 scope, in part. |
| X1 | O | plain | neutral-component | ts/src/cmp/ReadmeExplanation.ts:40-70,225 |  | S (runtime fact) | Shared component with a LANGS table and a TypeScript default; the fix needs per-language example and prose (sibling of S05). |
| X2 | O | plain | neutral-component | ts/src/cmp/ReadmeFeatures.ts:32-33; ReadmeOptions family (dead) |  |  | The sentence is in shared ReadmeFeatures; one rewording; the dead family is a deletion. |
| X3 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:34-35,54,119-131 |  |  | In the H3 scope, wholly. Fixed by one shared edit, clean in all 20 languages; the edit also printed "Also attaches to pipeline hooks" under `secrets` from its model's hook declaration, false in 17 runtimes. |
| X4 | O | plain | neutral-component | ts/src/cmp/ReadmeTop.ts:576-582; ReadmeExplanation.ts:269-286 |  |  | Two shared components disagree; one exported stage constant. |
| X5 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuideContent.ts:137-145,173-180; ReadmeTop.ts:614-640 |  |  | Shared guide prose; the merge sentence needs modelCopyMode. |
| X6 | T | part | per-language-copy | rust/zig ReadmeModel, zig ReadmeEntity, go/ReadmeQuick_go.ts:188 | S29 |  | In the H3 scope, in part. |
| X7 | S | model | per-language-copy | ReadmeModel_<lang>.ts (16); ReadmeModel.ts:88 |  | O | 16 copies hold the same literal sentence; a shared ReadmeModel comparing entityOps writes it once. |
| G01 | T | part | per-language-copy | ts/ReadmeModel_ts.ts:65-71; ReadmeTopQuick_ts.ts; ReadmeQuick_ts.ts:35 |  |  | In the H3 scope, in part. |
| G02 | C |  | consumer-main | go-cli/go-mcp Main and main.fragment.go |  | G (behaviour) | go-cli and go-mcp Mains and fragments, each a single writer, with a code half. |
| G03 | S | runtime fact | per-language-copy | ReadmeHowto_<lang>.ts (swift, c, zig, ocaml, scala, elixir) |  | L | Run live tests block is repeated by 19 how-tos; whether tests read TEST_LIVE is a declared runtime fact. |
| G04 | G | behaviour | helper | ts/src/utility.ts:22-30,47-51; PrepareAuth_<lang>.ts, TestClean_<lang>.ts |  | O | Generated auth code places credentials under info.auth:false; no document involved. |
| G05 | G | behaviour | neutral-component | Entity_<lang>.ts; flowGuard.ts; utility.ts withPointParts |  | K | Entity code, Config and flow tests still generate an inactive op; fix is a core pre-pass (DQ1). |
| G06 | C |  | consumer-main | go-cli, go-mcp, py-data Mains and fragments |  |  | Three consumer writers each reading only apikey. |
| G07 | S | runtime fact | per-language-copy | ReadmeHowto_<lang>.ts (13); TestEntity_<lang>.ts; serverVars.ts:59-61 |  |  | Every how-to lists only TEST_LIVE plus apikey; a shared live-tests block from server variables, filtered by what each runtime reads. |
| G08 | C |  | fragment | go-cli main.fragment.go:37,122; words.fragment.go:13; Main_go-cli.ts |  | G (behaviour) | The go-cli help text and word table belong to one consumer writer. |
| G09 | C |  | fragment | go-cli/go-mcp main.fragment.go and Mains |  | G (behaviour) | Env help and key read are in the two consumer fragments only. |
| G10 | C |  | fragment | go-cli/fragment/main.fragment.go:1 |  | G (comment) | A package comment in the go-cli fragment. |
| G11 | C |  | consumer-main | go-mcp/Main_go-mcp.ts:57,63,87 |  |  | Tool descriptions are literals in go-mcp's Main. |
| G12 | C |  | consumer-main | py-data/Main_py-data.ts:229-251,653-670,848-859 |  | G (behaviour) | py-data's Main writes both the raise and the notebook text. |
| G13 | O | needs a derivation | helper | ts/src/helpers/packageMeta.ts:14-29,311-315; Package_rust/java/ocaml |  | G (behaviour) | Manifest description from shared pkgDescription with a LANG_LABEL table; needs title plus targetSurface. |
| G14 | G | comment | fragment | Main.fragment.* (13); tm/<lang>/** (6) |  |  | Source comments name a fixed wrapper list. |
| G15 | G | comment | fragment | cpp Main.fragment.cpp:21; tm/java/core/SdkClient.java:385; tm/go/core/result.go:17 |  |  | Comments in copied runtime fragments and templates. |
| G16 | G | comment | fragment | go Entity.fragment.go:84; java EntityBase.fragment.java:38; c Entity.fragment.c:17 |  |  | Entity comments in generated source presume ops. |
| G17 | O | plain | fragment | recommended fix in ts/src/cmp/AgentGuideContent.ts; citations in 78 files |  | G (comment) | Recommended fix adds the cited section once to the shared per-target AGENTS.md writer. |
| G18 | G | behaviour | fragment | py/fragment/Main.fragment.py:94; Main_<lang> handlers |  |  | A dead marker line and dead handlers in generated-code machinery. |
| G19 | G | comment | fragment | PrepareAuth_<lang>.ts; fragments and tm of 20 targets | G04 |  | Credential comments and code in generated source. |
| G20 | K |  | neutral-component | ts/src/sdkgen.ts:374-382 (withoutExternal) |  | O | Generator core hands project components a model with relocated targets removed (DQ3). |
| G21 | O | needs a derivation | neutral-component | alongside.ts:36-37; AgentGuide.ts:38-52; ts/ReadmeHowto_ts.ts:183; ReadmeExampleTest_ts.ts:39 |  | S (model); G | Two of four sites are shared and need docLink and targetPlace. |
| G22 | C |  | consumer-main | py-data/Main_py-data.ts:23-31 |  | K | py-data's Main throws; the root cause is withoutExternal (G20). |
| G23 | C |  | consumer-main | go-cli/go-mcp Main (../go, go.mod replace) |  |  | The literal ../go is in the two consumer Mains only. |
| G24 | K |  | other | docgen ts/src/content.ts:160-166,189,254 |  |  | Defect in docgen. |
| G25 | O | needs a derivation | neutral-component | ReadmeTop.ts:243-249,557-562; AgentGuideTop.ts:33,39; generated.ts:405-425 |  | K | Lead-ins in shared root components need docLink; pruning is core (DQ3). |
| G26 | O | needs a derivation | helper | ts/src/helpers/packageMeta.ts:42-50; ts/model/sdkgen.aontu:145 |  | K | Shared repoInfo ignores the target; one helper change or a schema deletion. |
| G27 | T | part | per-language-copy | ReadmeEntity/ReadmeRef/ReadmeModel_<lang>.ts (60) |  |  | In the H3 scope, in part. |
| G28 | K |  | helper | jostraca Content; ts/src/utility.ts:343-360; TestEntity_ts.ts:261; docgen docgen.ts:293-298 |  | O | Recommended single fix is a raw mode in jostraca Content used by every emitter. |
| G29 | T | part | per-language-copy | ReadmeEntity/ReadmeRef/ReadmeModel_<lang>.ts cell sites |  |  | In the H3 scope, in part. |
| G30 | K |  | other | docgen ts/src/docgen.ts:114-128 |  |  | docgen's safeMarkdown throws. |
| G31 | S | model | helper | ReadmeEntity_<lang>.ts (20); ReadmeTop.ts:504-505; docgen content.ts:197 |  | O; K | 20 ReadmeEntity copies each choose the description slot; a shared ReadmeEntity fixes them once. |
| V1 | S | runtime fact | per-language-copy | ReadmeHowto_<t>.ts Run live tests (c, elixir, ocaml, scala, swift, zig) | G03 |  | A shared how-to conditioned on a declared, guarded per-target fact drops it from six at once. |
| V2 | S | model | per-language-copy | rust/ReadmeHowto_rust.ts:138 |  |  | rust drifted from the shared .env.local sentence; one shared sentence from targetPlace is right for rust. |
| V3 | O | plain | helper | packageMeta.ts installCommand; ReadmeTop.ts:383-386 |  | L | Add the missing registry commands to installCommand; the copies then print a real command. |
| V4 | L |  | per-language-copy | js/ReadmeInstall_js.ts:9-13 |  |  | Only js's install component prints the slug in a js fence. |
| V5 | L |  | per-language-copy | py/ReadmeExplanation_py.ts:16-30 |  |  | The py layout tree describes py's own package. |
| V6 | L |  | per-language-copy | clojure/ReadmeExplanation_clojure.ts:34-35 |  |  | The namespace example is clojure's own idiom. |
| V7 | C |  | per-language-copy | go-cli/Main_go-cli.ts:66,402-403; go-mcp/Main_go-mcp.ts:154,459-460 |  |  | Inline env-prefix derivation in the consumer Mains. |
| V8 | K |  | other | docgen ts/src/content.ts, ts/src/sdk-reference.ts |  |  | All four defects are in docgen's own derivations. |
| V9 | P |  | per-language-copy | langpack lean/ReadmeIntro_lean.ts:7-10 |  |  | Literal verb list in the pack's lean intro. |
| V10 | G | behaviour | neutral-component | ts/src/cmp/Deploy.ts:141-145 |  | O | The root Makefile calls a publish rule five target Makefiles lack; generated build code. |
| V11 | G | behaviour | neutral-component | Entity_<lang>.ts; guardModel in sdkgen.ts | G05 | K | Entity generators still emit an inactive op; fix is a core pre-pass. |
| V12 | K |  | neutral-component | ts/src/helpers/applicability.ts:18-28; ts/src/cmp/Feature.ts:18-28 |  |  | Log level and remedy of the generator's own warning. |
| V13 | O | needs a derivation | neutral-component | ts/src/helpers/alongside.ts; ReadmeTop.ts:146-172 |  |  | Shared alongsideNote and ReadmeTop classify with isConsumer; needs targetSurface. |
| V14 | O | needs a derivation | neutral-component | ts/src/cmp/ReadmeIntro.ts:26; ReadmeTop.ts |  |  | Shared intro frame prints target.title; needs targetTitle. |
| V15 | K |  | model-schema | ts/model/sdkgen.aontu:233-246; modelcheck |  | O | Schema hook list and a new package-check rule. |
| V16 | K |  | model-schema | ts/model/sdkgen.aontu:212-215 |  |  | A comment in the generator's own schema. |
| V17 | G | behaviour | per-language-copy | PrepareAuth_<lang>.ts (12) |  |  | Local copies of an auth predicate in code generators. |
| V18 | G | behaviour | per-language-copy | Config_<lang>.ts; utility.ts configDefinition |  |  | Generated Config derives auth and server blocks twice. |
| V19 | G | behaviour | helper | utility.ts isAuthActive vs PrepareAuth gate; tm/ts MakeOptionsUtility.ts | G04 |  | The generated SDK places an apikey the documents say is absent. |
| V20 | G | behaviour | helper | ts/src/helpers/flowGuard.ts:18; TestEntity_<lang>.ts |  |  | No generated flow test calls patch. |
| V21 | G | comment | template | tm/rust/Makefile:12-15; tm/perl/Makefile:25-28 |  |  | Template Makefile comments state the registry state. |
| V22 | K |  | target-or-feature-model | docgen content.ts:271,592-595; feature model descriptions |  |  | Recommended fix is in docgen; the feature models stay. |
| V23 | K |  | other | apidef transform/top.ts; docgen content.ts:186 |  |  | Provenance flag in apidef and prose in docgen. |
| V24 | O | needs a derivation | neutral-component | ReadmeTop.ts, Changelog.ts, AgentGuideContent.ts |  | K | Shared components write OpenAPI spec; needs definitionKind. |
| V25 | K |  | other | docgen ts/src/content.ts:157-158,186,197-198 |  |  | docgen classifies vendor and project text the wrong way round. |
| V26 | K |  | other | docgen ts/src/qa.ts:33-47 |  |  | docgen's QA stripping. |
| V27 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:95-96; FeatureDocs.ts |  |  | In the H3 scope, wholly. Fixed by one shared edit (the type cell through the table-cell escaper), clean in all 20 languages. |
| V28 | K |  | neutral-component | ts/src/sdkgen.ts:390-409,793-802 |  | O | Skip log level and one target set in generate. |
| V29 | K |  | neutral-component | ts/src/sdkgen.ts:723-737 |  |  | SDKGEN_EXTERNAL parser accepts unknown keys. |
| V30 | K |  | neutral-component | ts/src/action/kind.ts:171-195; doctor.ts |  |  | Add and doctor handling of aliased model files. |
| V31 | K |  | neutral-component | ts/src/action/target.ts:510-595 |  |  | target add reads feature.trim from the wrong source. |
| V32 | G | behaviour | template | 54 tm files and 15 components (tm/ts/test/utility/index.ts:3) |  |  | Templates hard-code ../.sdk; out-of-tree tests miss the corpus. |
| U01 | O | needs a derivation | neutral-component | ts/src/helpers/alongside.ts:20-31 |  |  | Shared alongsideNote matches literal keys; needs targetSurface. |
| U02 | O | needs a derivation | neutral-component | ts/src/cmp/ReadmeTop.ts:146-165,433-452 |  |  | Root README is one shared component; needs targetSurface. |
| U03 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuideContent.ts:18-37 |  |  | LANG_CMD keyed by target name; needs originName and targetSurface. |
| U04 | G | behaviour | template | tm/<lang>/Makefile TAG (15); go/ReadmeInstall_go.ts:19; Deploy.ts:218 |  | L | Most of the fix is 15 template Makefiles; the README half is one go literal. |
| U05 | O | plain | neutral-component | ReadmeErrors.ts:212; ReadmeExplanation.ts:225 |  |  | Two shared tables keyed by target.name; key by originName. |
| U06 | T | part | per-language-copy | ReadmeEntity/ReadmeRef_<lang>.ts canonToType(..., target.name) | N04 |  | In the H3 scope, in part; the type printers of all 20 ported languages still pass a literal language. Checked through the aliased go target at twenty and clean. |
| U07 | K |  | other | docgen ts/src/content.ts:160-163 |  |  | docgen's surface table classes seneca-provider as an SDK. |
| U08 | N |  | neutral-component | ts/src/cmp/ReadmeTop.ts:229,442-444 |  |  | Fate: not a defect. |
| U09 | P |  | per-language-copy | langpack lean/ReadmeOptions_lean.ts:5-17 |  |  | Literal options table in the pack's lean component. |
| U10 | P |  | per-language-copy | langpack lean/ReadmeQuick_lean.ts:26 |  |  | In the H3 scope as language pack only. |
| U11 | P |  | per-language-copy | langpack lean/ReadmeHowto_lean.ts:18 |  |  | Literal seed path in the pack's lean how-to. |
| U12 | N |  | per-language-copy | langpack lean/ReadmeTopTest_lean.ts:12 |  |  | Fate: not a defect (lean trim: false). |
| U13 | P |  | per-language-copy | langpack lean/ReadmeModel_lean.ts:7 |  |  | Literal comparison in the pack's lean component. |
| U14 | O | plain | neutral-component | ReadmeErrors.ts:25,212; ReadmeExplanation.ts:40,225 |  |  | Shared default row reaches pack languages; dropping it is the X1 edit. |
| U15 | O | plain | neutral-component | ts/src/cmp/ReadmeExplanation.ts:46 |  |  | CORRECTED from needs a derivation: the paragraph is in the shared DEFAULT_LANG row, and keying rows by originName (present) with no default row leaves lean without it, as for U14. |
| U16 | P |  | per-language-copy | langpack haskell/ReadmeInstall_haskell.ts:9-12 |  |  | Empty fence printed by the pack's haskell install. |
| U17 | P |  | per-language-copy | langpack haskell/ReadmeExplanation_haskell.ts:34 |  |  | Cabal name derived differently in the pack. |
| U18 | P |  | helper | langpack dart model; ts/src/helpers/packageMeta.ts:275-277 |  | O | The fix is the pack's dart model declaring its package name. |
| U19 | P |  | per-language-copy | langpack dart/ReadmeRef_dart.ts:72,350 |  |  | In the H3 scope as language pack only. |
| U20 | P |  | per-language-copy | langpack dart/ReadmeEntity_dart.ts:60; ReadmeRef_dart.ts:179 | S23 |  | In the H3 scope as language pack only. |
| U21 | S | model | per-language-copy | ReadmeHowto_<lang>.ts (12), ReadmeInstall_<lang>.ts (5) |  |  | The same cd line in 17 copies; one shared line from targetPlace and docLink. |
| U22 | S | model | per-language-copy | ReadmeHowto_<lang>.ts (10) |  | G | Ten how-tos repeat one placement sentence; aligning runners is template work. |
| U23 | C |  | per-language-copy | go-cli/Main_go-cli.ts:358; go-mcp Main | G23 |  | Literal ../go replace path in the consumer Mains. |
| U24 | C |  | per-language-copy | py-data/Main_py-data.ts:23-30 |  |  | The guard is in py-data's Main. |
| U25 | K |  | neutral-component | ts/src/sdkgen.ts:374-382,939-950; docgen content.ts:244-246 | G24 | O | Model filtering and docgen listing disagree; fix in generate and docgen. |
| U26 | O | plain | neutral-component | ts/src/cmp/PublishWorkflow.ts:26-34 |  |  | Skip targets whose registryState is inactive. |
| U27 | O | needs a derivation | neutral-component | Deploy.ts:157,218; PublishWorkflow.ts:87-90 |  |  | Two shared components disagree on the tag; needs the release-tag helper. |
| U28 | O | plain | neutral-component | ts/src/cmp/PublishWorkflow.ts:372-374 |  |  | Condition the sentence on registryState. |
| U29 | O | needs a derivation | neutral-component | PublishWorkflow.ts:176-188,364-369; packageMeta.ts:80-97 |  |  | Literal main needs a release-branch slot and one helper. |
| U30 | O | plain | neutral-component | ts/src/cmp/Security.ts:27 |  |  | SECURITY.md written once; repoInfo().hostName exists. |
| U31 | O | plain | neutral-component | Deploy.ts:39-42,100-105; packageMeta registryState |  |  | Treat none as no registry in registryState. |
| U32 | G | behaviour | template | tm/<lang>/VERSION and LICENSE; stdrep.ts:27 |  |  | VERSION and LICENSE year frozen in templates. |
| U33 | O | plain | neutral-component | ts/src/cmp/Changelog.ts:11,20 |  |  | Literal [0.0.1]; packageVersion exists. |
| U34 | T | part | per-language-copy | ReadmeModel.ts:70; ReadmeRef_<lang>.ts |  |  | In the H3 scope, in part. |
| U35 | S | model | per-language-copy | ReadmeModel_<lang>.ts (9) |  |  | Nine copies choose the API path point; a shared ReadmeModel calling entityPath fixes them. |
| U36 | T | part | per-language-copy | ReadmeEntity/ReadmeRef_<lang>.ts |  |  | In the H3 scope, in part. |
| U37 | O | plain | target-or-feature-model | model/target/go.aontu:4; packageMeta LANG_LABEL | G13 |  | One label source and go's title. The H3 check judged it arguably in scope (the go REFERENCE title). |
| U38 | O | plain | helper | ts/src/helpers/packageMeta.ts:311-315 | G13 |  | Manifest description from shared langLabel. |
| U39 | O | needs a derivation | helper | ReadmeTop.ts:108; packageMeta apiName; AgentGuideContent.ts:116-118 |  | K | Three display-name rules; needs apiDisplayName. |
| U40 | L |  | per-language-copy | elixir Main_elixir.ts:81, Package_elixir.ts:28, ReadmeExplanation_elixir.ts:8 |  |  | The elixir app name rule is elixir's alone. |
| U41 | L |  | per-language-copy | java/utility_java.ts:29-46 (kotlin, scala) |  | G | JVM coordinates derived in three JVM languages' own utilities. |
| U42 | L |  | per-language-copy | ReadmeInstall swift, rust, cpp, zig |  |  | The literal sits inside each ecosystem's own manifest snippet. |
| U43 | T | yes | per-language-copy | ReadmeRef_<lang>.ts op-description table |  |  | In the H3 scope, wholly. |
| U44 | T | part | per-language-copy | ReadmeRef_<lang>.ts; ReadmeModel_<lang>.ts (rb, php) |  |  | In the H3 scope, in part; on the H3 check's strict reading, two guard exceptions in the py and elixir forms files remain from a per-language fact since dropped. |
| U45 | T | yes | per-language-copy | ReadmeQuick_<lang>.ts heading |  |  | In the H3 scope, wholly. |
| U46 | C |  | per-language-copy | go-cli/Main_go-cli.ts:306 |  |  | go-cli README written by its consumer Main. |
| U47 | C |  | per-language-copy | go-cli/Main_go-cli.ts |  |  | Literal example arguments in go-cli's Main. |
| U48 | C |  | per-language-copy | py-data/Main_py-data.ts | S33 |  | Placeholder names in py-data's Main. |
| U49 | S | model | per-language-copy | ReadmeHowto_<lang>.ts (20), ReadmeTopHowto_<lang>.ts (20), ReadmeErrors.ts:44 |  |  | Same fabricated route in 40 copies; one example route printed by a shared direct() call. |
| U50 | O | plain | neutral-component | ts/src/cmp/ReadmeStation.ts |  |  | Gate on existing featureApplies and isAuthActive. |
| U51 | O | plain | neutral-component | ts/src/cmp/ReadmeFeatures.ts:29 |  |  | A missing singular in one shared lead-in. |
| U52 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:28-30,37-44 |  |  | In the H3 scope, wholly. Fixed by one shared edit, clean in all 20 languages. |
| U53 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:54-55 |  |  | In the H3 scope, wholly. Fixed by one shared edit, clean in all 20 languages. |
| U54 | O | plain | neutral-component | ReadmeExplanation.ts:312-313; FeatureDocs.ts:94-97 |  |  | Condition on honoursActivationOrder. |
| U55 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuideContent.ts; AgentGuide.ts |  |  | One shared function guesses a feature path; needs the layout from featureSource discovery. |
| U56 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuideTop.ts:66-68 |  |  | Unconditional sentence in the one root guide writer. |
| U57 | O | plain | neutral-component | ts/src/cmp/AgentGuideTop.ts:39-41 |  |  | Shared sentence needs only an existing predicate. |
| U58 | O | plain | neutral-component | ts/src/cmp/ReadmeErrors.ts LANGS/DEFAULT_LANG | S05 |  | The one shared table; S05's fix. |
| U59 | S | runtime fact | per-language-copy | ReadmeExplanation_<lang>.ts (11) |  | L | The same sentence in 11 copies; whether it holds is a per-target fact. |
| U60 | S | model | per-language-copy | ReadmeInstall_ocaml/swift/c/scala |  | L | A dependency-free sentence in four install sections depends only on collectDeps. |
| U61 | S | runtime fact | per-language-copy | ReadmeIntro_<lang>.ts (20) |  |  | capitalised in all 20 intro bodies; wrong where the accessor is lower case. |
| U62 | O | plain | neutral-component | ts/src/cmp/ReadmeUnions.ts:10,68; canonType.ts |  |  | One shared component; the condition is a table in canonType.ts. |
| U63 | K |  | other | docgen ts/src/content.ts (seven lines) |  | O | CORRECTED from O: docgen is another repository's tool (docgen's text is K by rule). |
| U64 | K |  | template | docgen tm/edition/*/sdk-setup.json; sdk-reference.ts |  | O | CORRECTED from O: docgen's static table. |
| U65 | K |  | template | docgen tm/edition/*/sdk-setup.json:9,14,15 |  | O | CORRECTED from O: docgen hard-codes voxgig. |
| U66 | K |  | other | docgen ts/src/content.ts:568 |  | O | CORRECTED from O: one docgen sentence. |
| U67 | K |  | other | docgen ts/src/content.ts:187,222-223,243 |  | O | CORRECTED from O: docgen SUMMARY.md prose. |
| U68 | O | needs a derivation | helper | ts/src/helpers/packageMeta.ts:311-315,326-330 |  |  | Shared helpers; needs an official-publisher slot. |
| U69 | O | plain | neutral-component | ts/src/cmp/ReadmeTop.ts:233 | V24 |  | Literal tagline in shared ReadmeTop. |
| U70 | N |  | neutral-component | ts/src/cmp/ReadmeTop.ts:680 | S48 |  | Fate: repeats S48, not a defect. |
| U71 | N |  | per-language-copy | PrepareAuth_<lang>.ts |  |  | Fate: not a defect. |
| U72 | G | behaviour | per-language-copy | kotlin/TestEntity_kotlin.ts:367-372 |  |  | Generated kotlin live test omits the server block. |
| U73 | G | behaviour | per-language-copy | cpp/TestEntity_cpp.ts:100,114-136 |  |  | Generated cpp live harness never builds a live client. |
| U74 | O | plain | helper | ts/src/helpers/opShape.ts:409-431 |  |  | Two shared helpers append non-canonical ops; one edit. |
| U75 | S | model | per-language-copy | ts/ReadmeModel_ts.ts:66-72; serverVars.ts | G01 | O | Wrong Required row in ReadmeModel_ts; needs only requiredOptions. |
| U76 | K |  | other | docgen ts/src/sdk-reference.ts:37-43, content.ts:573 |  | O | CORRECTED from O: docgen Client defaults block. |
| U77 | P |  | per-language-copy | langpack dart/Config_dart.ts:45-60 |  | K | Dead code in a pack component. |
| U78 | C |  | per-language-copy | py-data/Main_py-data.ts:238-239 |  |  | py-data Main writes the docstring. |
| U79 | C |  | per-language-copy | py-data/Main_py-data.ts:424,876 |  |  | py-data Main sentences. |
| U80 | C |  | per-language-copy | py-data/Main_py-data.ts:586,642,825 |  |  | py-data Main literal subdirectory. |
| U81 | C |  | per-language-copy | go-mcp/Main_go-mcp.ts:57-59 |  |  | go-mcp TOOL_SPEC literal. |
| U82 | C |  | per-language-copy | go-mcp/Main_go-mcp.ts:56-57 |  |  | go-mcp per-op help text. |
| U83 | C |  | fragment | go-cli/Main_go-cli.ts:366,390 and fragments |  | G | go-cli's own Main and fragment comments. |
| U84 | G | comment | per-language-copy | ts/Main_ts.ts:78; Schema_<lang>.ts (14) |  |  | Header comment in generated source. |
| U85 | N |  | template | tm/go/core/types.go, java SdkEntity.java, kotlin Interfaces.kt |  |  | Fate: not a defect. |
| U86 | G | comment | per-language-copy | go/EntityTypes_go.ts:150,172 |  |  | Godoc comment in generated go. |
| U87 | G | comment | fragment | perl/rb/clojure EntityLoadOp and Remove fragments |  |  | Fixed comments in generated op source. |
| U88 | G | comment | fragment | langpack dart fragments; tm/haskell SdkTypes.hs, SdkFeatures.hs |  | P | CORRECTED from P: comments in generated source; pack runtime code is G elsewhere (M16-M18, A03). |
| U89 | K |  | other | create-sdkgen check-drift.sh:56-100 |  |  | create-sdkgen drift script. |
| U90 | K |  | other | ts/src/admin/status.ts:56-60 |  |  | Admin status tool. |
| U91 | K |  | action | ts/src/action/remove.ts:285-300 |  |  | remove planOutput. |
| U92 | K |  | neutral-component | ts/src/sdkgen.ts:909-936 |  | G | Generator path logic; fix makes the tool warn or refuse. |
| U93 | K |  | other | create-sdkgen ci.yml:44-80 |  |  | Scaffold CI. |
| U94 | K |  | helper | ts/src/testkit.ts:425-455 |  |  | Testkit API gap. |
| U95 | N |  | other | docgen ts/src/content.ts:157 |  |  | Fate: not a defect. |
| U96 | O | needs a derivation | helper | ts/src/helpers/alongside.ts:4-10 | V13 | K | One shared predicate; needs targetSurface. |
| U97 | K |  | action | ts/src/action/kind.ts:168,191; doctor.ts:888-891 | V30 |  | Add and doctor alias exemption. |
| U98 | K |  | other | docgen ts/src/content.ts:160-163 | U07 | O | CORRECTED from O: docgen; repeats U07, which is K. |
| U99 | O | plain | helper | ts/src/helpers/packageMeta.ts:14-29 | G13 |  | One shared label table. |
| U100 | K |  | action | ts/src/helpers/manifest.ts, ts/src/action/check.ts |  |  | Missing package-check rule. |
| U101 | K |  | helper | ts/src/helpers/applicability.ts:56-66; check.ts:307 |  |  | Pack tag compatibility rule. |
| U102 | T | yes | neutral-component | ts/src/cmp/FeatureDocs.ts:47-57; ReadmeRefFeatures.ts:78,95 |  |  | In the H3 scope, wholly. Fixed by one shared edit (a code-span cell escaper), clean in all 20 languages. |
| U103 | O | plain | neutral-component | ts/src/cmp/ReadmeTop.ts:130-133 |  |  | One escaper beside mdCell. |
| U104 | O | plain | per-language-copy | mdCell/mdInline; ReadmeExamplesTest_<lang>.ts |  | G | Unmeasured; if real, fixed in the shared escapers. |
| U105 | K |  | other | create-sdkgen CreateRoot.ts:110 |  |  | Commented example in the scaffold. |
| U106 | K |  | other | docgen ts/src/content.ts:158,186 |  | O | CORRECTED from O: docgen splices vendor text. |
| U107 | K |  | helper | apidef ts/src/utility.ts:2484-2494; go/utility.go:2834 |  |  | apidef's firstSentence. |
| U108 | K |  | other | docgen ts/src/content.ts:272 |  |  | docgen QA classification. |
| N01 | K |  | other | sdkgen.ts:327 guardModelNames; docgen bin; @voxgig/model |  |  | Pipeline order across tools. |
| N02 | G | behaviour | helper | ts/src/utility.ts:388 configDefinition |  | O | Generated Config carries basic:true under query or cookie. |
| N03 | G | behaviour | per-language-copy | PrepareAuth_<lang>.ts (12) | V17 | K | Twelve generators keep private copies; output identical today. |
| N04 | T | part | per-language-copy | ReadmeEntity/ReadmeRef_<lang>.ts canonToType |  |  | In the H3 scope, in part. Shown only through an alias; checked through the aliased go target at twenty and clean. |
| N05 | O | plain | neutral-component | ReadmeErrors.ts:212,229; ReadmeExplanation.ts:225,240 |  |  | Shared tables keyed by target.name; key by origin. |
| N06 | C |  | per-language-copy | go-cli and go-mcp Mains |  |  | Consumer Mains hard-code ../go. |
| N07 | K |  | action | ts/src/action/remove.ts:293 |  |  | remove tests null != against ''. |
| N08 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuideContent.ts:137,173 | X5 |  | Shared paragraphs; needs modelCopyMode. |
| N09 | O | plain | neutral-component | AgentGuideContent.ts:189; model/feature/test.aontu:13 |  | K | Deletes a shared sentence. |
| N10 | K |  | model-schema | ts/model/sdkgen.aontu:233-247 | V15 |  | Base schema hook list. |
| N11 | T | part | per-language-copy | js/ReadmeRef_js.ts, js/ReadmeEntity_js.ts |  |  | In the H3 scope, in part. Fixed for js when js was ported, through the fence value its provider declares. |
| N12 | G | behaviour | per-language-copy | ReadmeExamplesTest_<lang>.ts (rb, perl, php, ts) |  |  | Generated README tests use a non-nesting regex. |
| N13 | K |  | action | ts/src/action/doctor.ts; create-sdkgen |  |  | Doctor outdated logic after a downgrade. |
| N14 | K |  | other | langpack package.json, build.yml |  |  | Pack release floor. |
| N15 | G | behaviour | per-language-copy | utility.ts:348-353 into Config_<lang>; TestEntity_ts/js | G28 |  | $$name$$ substituted in generated source. |
| N16 | K |  | other | sdkgen AGENTS.md:937; docs/how-to/add-a-feature.md |  |  | The generator's own documentation. |
| N17 | K |  | action | ts/src/action/doctor.ts, sdkgen.ts warnCopies |  |  | No copy floor. |
| N18 | K |  | helper | ts/src/helpers/copymerge.ts |  |  | --keep semantics hide stale copies. |
| N19 | K |  | helper | ts/src/helpers/copymerge.ts:420-423,543-545 |  |  | --keep records a base without checking. |
| N20 | K |  | action | ts/src/sdkgen.ts:314-335; doctor.ts:593-597 | S11 |  | Generate and doctor report a missing test feature. |
| N21 | P |  | per-language-copy | langpack dart/haskell ReadmeRef, ReadmeEntity, ReadmeModel |  |  | In the H3 scope as language pack only. |
| N22 | K |  | test | ts/test/generatedcompile.test.ts; generateharness.ts |  |  | Test gap. |
| N23 | K |  | helper | ts/src/testkit.ts:565-600; create-sdkgen RootPlan |  |  | Root plan implemented six times. |
| N24 | K |  | test | ts/src/sdkgen.ts export block |  |  | No test pins the export surface. |
| M01 | S | model | per-language-copy | ReadmeHowto_<lang>.ts (7 copies); tm/go/Makefile:26; consumer Mains |  | C; G | Seven how-to copies hard-code the origin key in cd; a shared how-to fixes them. |
| M02 | O | needs a derivation | neutral-component | ReadmeTop.ts, alongside.ts, AgentGuideContent.ts, mcpTools.ts |  |  | Shared name comparisons; needs targetSurface. |
| M03 | O | needs a derivation | model-schema | ts/model/sdkgen.aontu:8; ReadmeTop.ts:150-157 |  |  | Ordering done once in ReadmeTop; needs targetSurface. |
| M04 | T | part | per-language-copy | ReadmeEntity/ReadmeRef_<lang>.ts canonToType | N04 |  | In the H3 scope, in part. Checked through the aliased go target at twenty and clean. |
| M05 | O | plain | neutral-component | ReadmeErrors.ts:212, ReadmeExplanation.ts:225 | N05 |  | Key by originName, delete the default row. |
| M06 | C |  | per-language-copy | Main_go-cli.ts, Main_go-mcp.ts | N06 |  | Only the two Go consumer Mains write ../go. |
| M07 | K |  | action | ts/src/action/remove.ts:293 | N07 |  | CLI message of target remove. |
| M08 | S | model | per-language-copy | ReadmeModel_<lang>.ts (22); Main_go-cli.ts:257-262 |  | C | ReadmeModel writes the header unconditionally in each copy. |
| M09 | K |  | action | ts/src/action/resolve.ts:357-389; opShape.ts |  |  | A generator warning misclasses a target. |
| M10 | K |  | target-or-feature-model | model/feature/secrets.aontu |  |  | Feature definition makes feature add install it inactive. |
| M11 | K |  | neutral-component | ts/src/sdkgen.ts generate(), doctor.ts | S11 | G | Generate-time and doctor error. |
| M12 | T | part | per-language-copy | ts/js ReadmeHowto, ReadmeModel, ReadmeRef, ReadmeTopQuick, ReadmeQuick |  |  | In the H3 scope, in part. |
| M13 | T | yes | per-language-copy | ReadmeQuick/ReadmeTopQuick (go, java, py) | G01 |  | In the H3 scope, wholly. |
| M14 | T | yes | per-language-copy | go/ReadmeQuick_go.ts, go/ReadmeTopQuick_go.ts |  |  | In the H3 scope, wholly. |
| M15 | G | behaviour | template | tm/go make_options.go; tm/rust; tm/zig; tm/c |  |  | Runtime templates panic on a missing server variable. |
| M16 | G | behaviour | template | langpack tm/dart PrepareAuthUtility.dart |  | P | Pack runtime template sends Basic in the header. |
| M17 | G | behaviour | template | langpack tm/haskell SdkRuntime.hs; Config_haskell.ts |  | P | haskell runtime has no Basic branch. |
| M18 | G | behaviour | template | langpack tm/lean SdkUtility.lean; Config_lean.ts |  | P | lean runtime lacks the server option and Basic. |
| M19 | P |  | per-language-copy | langpack lean/ReadmeTopQuick_lean.ts:13 |  |  | In the H3 scope as language pack only. |
| M20 | K |  | other | infrapack package.json; build.yml |  |  | Infrastructure pack floor. |
| M21 | K |  | other | langpack package.json, sdkgen-package.json | N14 |  | Pack floor lane. |
| M22 | K |  | other | published @voxgig/sdkgen <=4.41.0 |  |  | Registry releases; npm deprecate. |
| M23 | K |  | action | ts/src/action/doctor.ts:975-995 | N13 |  | Doctor version comparison. |
| M24 | K |  | template | create-sdkgen .sdk/package.json |  |  | Scaffold manifest ordering. |
| M25 | K |  | template | create-sdkgen Root.ts makeFlow |  |  | Dead code in the scaffold Root. |
| M26 | K |  | helper | create-sdkgen RootPlan.ts/Root.ts; testkit.ts:565; generateharness.ts |  |  | Six statements of the run plan. |
| M27 | K |  | generator-docs | sdkgen AGENTS.md:479-486 |  |  | The repository's own agent guide. |
| M28 | K |  | generator-docs | sdkgen AGENTS.md:937-938 | N16 |  | Stale list in the repository's own guide. |
| M29 | K |  | other | @voxgig/model order; docgen bin; sdkgen.ts guards | N01 | O | Tool ordering. |
| M30 | G | behaviour | helper | ts/src/utility.ts:388 | N02 | O | Generated Config carries basic:true where no PrepareAuth reads it. |
| M31 | G | behaviour | per-language-copy | PrepareAuth_<lang>.ts (12) | V17 |  | Code generators re-derive suppression. |
| M32 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuideContent.ts:137 | X5 |  | Root AGENTS.md; needs modelCopyMode. |
| M33 | O | plain | neutral-component | AgentGuideContent.ts:189; test.aontu:13 | N09 |  | One shared sentence. |
| M34 | K |  | model-schema | ts/model/sdkgen.aontu:234-247 | V15 |  | Base schema hook vocabulary. |
| M35 | T | part | per-language-copy | js/ReadmeRef_js.ts, js/ReadmeEntity_js.ts | N11 |  | In the H3 scope, in part. Fixed for js with N11. |
| M36 | G | behaviour | per-language-copy | ReadmeExamplesTest_<lang>.ts | N12 |  | Generated README tests regex. |
| M37 | T | part | per-language-copy | ReadmeEntity/ReadmeRef/ReadmeModel cell sinks; Config_<lang> | G28 |  | In the H3 scope, in part. |
| M38 | T | part | per-language-copy | ReadmeEntity/ReadmeRef/ReadmeModel table sinks | G27 |  | In the H3 scope, in part. |
| M39 | G | behaviour | model-schema | sdkgen.aontu op slot; Entity_ts.ts:41-63; guardModel | G05 | K | A flagged op still generates a method. |
| M40 | C |  | per-language-copy | py-data/Main_py-data.ts:30 | G22 |  | Only py-data's Main refuses a relocated py. |
| M41 | O | needs a derivation | neutral-component | alongside.ts:8-10; ReadmeTop.ts:165-167 | V13 |  | Shared code misclasses an old go-cli copy; needs targetSurface. |
| M42 | K |  | action | ts/src/action/doctor.ts; sdkgen.ts | N17 |  | Doctor and generate diagnostic. |
| M43 | K |  | test | ts/test/generatedcompile.test.ts |  |  | Test gap. |
| M44 | K |  | test | ts/src/sdkgen.ts export block | N24 |  | Test gap. |
| M45 | K |  | test | ts/test/generateharness.ts |  |  | Fixture reads unsubstituted files. |
| M46 | K |  | other | docgen package.json peer; content.ts:145 |  |  | docgen floor. |
| M47 | K |  | other | docgen ts/bin/voxgig-docgen:14-18 |  |  | docgen bin passes no logger. |
| M48 | K |  | other | docgen ts/src/content.ts:160-163,171-172 |  | O | CORRECTED from O: docgen's surface table (same site as U07). |
| M49 | K |  | action | ts/src/action/target.ts |  |  | Performance of target add. |
| D01 | O | needs a derivation | neutral-component | alongside.ts, ReadmeTop.ts:144, AgentGuideContent.ts:98, Deploy.ts, PublishWorkflow.ts |  | K | Nine private active-target filters mostly in shared code. |
| D02 | O | needs a derivation | neutral-component | alongside.ts, ReadmeTop.ts, AgentGuideContent.ts, packageMeta.ts, mcpTools.ts |  | K | Surface decided in shared code; needs targetSurface. |
| D04 | T | part | per-language-copy | ReadmeRef_<lang>, ReadmeExplanation_<lang>, ReadmeTop, AgentGuideContent |  |  | In the H3 scope, in part. |
| D05 | T | part | neutral-component | ReadmeFeatures, ReadmeRefFeatures, ReadmeTop | S09 |  | In the H3 scope, in part. |
| D10 | T | part | per-language-copy | ReadmeEntity/ReadmeRef/ReadmeModel/Entity_<lang> |  |  | In the H3 scope, in part. |
| D22 | G | behaviour | per-language-copy | PrepareAuth_<lang>.ts (12); consumer Mains; docgen |  | C | Twelve code generators importing one predicate. |
| D23 | T | part | per-language-copy | ReadmeTopQuick/ReadmeQuick/ReadmeModel_<lang> |  |  | In the H3 scope, in part. |
| D25 | S | model | per-language-copy | ReadmeHowto_<lang> Run tests; Main_go-cli/go-mcp |  | C | Per-language how-tos must name the variables their tests read. |
| D26 | T | part | per-language-copy | ReadmeModel/ReadmeRef/ReadmeOptions_<lang> |  |  | In the H3 scope, in part; the H3 check found it fixed only in part: the constructor table was a hand list of eight rows gated on the option spec, not derived from it. A later shared edit takes the rows from the option spec, in all 20 languages, except `extend`, `utility`, `entity` and `test`; `extend` and `utility` need a declared fact per runtime, and there is no default column. |
| D27 | S | runtime fact | per-language-copy | ReadmeInstall_<lang>.ts (20); Deploy.ts, PublishWorkflow.ts, packageMeta.ts |  | O; L | Publish state and package name derived separately in 20 install copies. |
| D29 | S | model | per-language-copy | ReadmeInstall_<lang>.ts (20); tm/<lang>/Makefile (15) |  | G | The tag sentence is the same fact in 20 install sections. |
| D33 | O | needs a derivation | neutral-component | ReadmeTop.ts, alongside.ts, AgentGuide.ts, PublishWorkflow.ts, Deploy.ts |  | S | Most sites are shared and need targetPlace and docLink. |
| D34 | O | needs a derivation | neutral-component | alongside.ts PHASES, ExternalTarget.ts, AgentGuideContent.ts:65 |  | K | Phase re-derived in shared code; one export. |
| D35 | K |  | test | ts/src/testkit.ts; generateharness.ts; create-sdkgen Root |  |  | Three hand-written Roots in tooling. |
| D44 | O | needs a derivation | neutral-component | mcpTools.ts, ReadmeTop.ts:451-453,475 |  | C | Shared root README MCP section needs targetSurface. |
| D47 | S | runtime fact | per-language-copy | ReadmeHowto_<lang>.ts Run live tests (6) | G03 |  | A declared per-target fact drops the section. |
| D48 | O | needs a derivation | neutral-component | AgentGuideContent.ts; AgentGuide.ts; AgentGuideFeature.ts; ReadmeTop.ts | X5 |  | One constant plus modelCopyMode. |
| D55 | T | part | per-language-copy | ReadmeTopQuick_ts, ReadmeModel_ts, serverVars.ts | G01 |  | In the H3 scope, in part. |
| D56 | C |  | fragment | go-cli words.fragment.go:13; main.fragment.go; Main_go-cli.ts | G08 | G | go-cli registers verbs literally. |
| D60 | G | behaviour | template | 58 templates and 15 components | V32 | O | Hard-coded relative path in generated source. |
| D61 | C |  | per-language-copy | Main_py-data.ts; Main_go-cli.ts; Main_go-mcp.ts |  |  | Each consumer Main decides alone. |
| D69 | T | part | per-language-copy | ReadmeEntity/ReadmeRef/ReadmeModel cell sites | G27 |  | In the H3 scope, in part. |
| D70 | G | behaviour | per-language-copy | Config_<lang>.ts and TestEntity_<lang>.ts | G28 | O | Code escaper in each Config and TestEntity generator. |
| A01 | K |  | helper | docgen ts/src/content.ts:677,684 |  | O | CORRECTED from O: docgen writes the tutorial steps. |
| A02 | K |  | test | langpack test/langpack.test.js:812-826 |  |  | Pack test gap. |
| A03 | G | behaviour | template | langpack tm/dart MakeOptionsUtility.dart; haskell and lean |  | P | Pack runtimes hold their own option specs. |
| A04 | G | behaviour | per-language-copy | ts/Entity_ts.ts:55; js/Entity_js.ts:38 |  | L | ts and js generators name the entity file with the installed key. |
| A05 | S | runtime fact | per-language-copy | ReadmeModel_<lang>.ts Operations line |  |  | Each copy decides its own capitalisation; a shared line through the provider's spelling. |
