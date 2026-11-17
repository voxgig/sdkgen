# The catalogue by class: what the write-once proposal reaches

This page checks four classifications of the 329 entries of
`docs/design/model-dependent-text-issues.md` (sdkgen 9aebaf9e) against the
classes of the k-general instructions, corrects them where the correction is
certain, counts the result, and maps it onto the 46 work packages of
`docs/design/model-dependent-text-plan.md`.

Classes: T tested by the prototype (copied from the scope table); S same
mechanism, not tested; L one language's own; O written once already; C a
consumer target; G generated source; K the tools (including docgen,
create-sdkgen, apidef); P a pack's text; N not a defect.

## 1. Sample check

The sample is every entry whose number ends in 2 or 8: 65 entries (S02 to
A02). The sample was not blind: the four classifiers' tables were part of
the instructions and had been seen before the sample was classified. Each
sample entry was nevertheless decided again from its Fate, Class, Where and
Fix lines. The agreement figure below is therefore an upper bound.

A second sample was then taken blind: a second classifier, who had not seen
this table, classified every entry whose number ends in 2, 5 or 8 (100
entries: S 15, X 2, G 9, V 10, U 33, N 7, M 15, D 7, A 2; the D section has
only seven headed entries ending in those digits). Its rows were compared
with this table after the corrections below had been made, and each
disagreement was decided from the catalogue entry and the source at
9aebaf9e.

Blind agreement on the class: 95 of 100. On class and sub-class: 93 of 100
(T rows compared on class only). On the 65 entries both samples share, 60
of 65 on class and sub-class; on the 35 entries ending in 5, 33 of 35. The
blind sample agreed with three of this check's own corrections (S12, U98,
M48) and disagreed with the fourth (U88).

| Id | This table | Blind | Decision | How sure |
| --- | --- | --- | --- | --- |
| S05 | O (plain) | S (runtime fact) | O by the letter of the rules: S requires the wrong text to come from a per-language component, and ReadmeErrors is shared. In substance the fix is fifteen per-language failure idioms, which is exactly a provider's error-handling block. The rules do not draw this border; carried in the range. | rules undecided |
| U58 | O (plain) | S (runtime fact) | Its Fix is "See S05/X1", so it takes S05's class, whatever that is. | follows S05 |
| V2 | S (model) | L | S. The rust sentence ("at the crate root") is the drifted copy of a sentence the other 18 how-to copies print identically ("at the project root", ReadmeHowto_<lang>.ts at 9aebaf9e), and the rust harness reads `../.env.local`, the same place. L applies only to a sentence other languages do not repeat. | sure |
| U88 | G (comment) | P | Comments in the language pack's generated dart and haskell source. G names comments in generated code; P names a pack's text that follows sdkgen, and the Fix is "follow whatever the bundled comment pass does". The rules do not draw this border. Kept as G for consistency with M16, M17, M18 and A03; carried in the range. | rules undecided |
| M18 | G (behaviour) | P | G. The defect is the lean runtime's behaviour (no server option, no Basic branch), not text; the README half of the Fix is a consequence. | fairly sure |
| G18 | G (behaviour) | G (comment) | Sub-class only. The marker comment does not depend on the model, so "comment" as defined does not fit; the defect is a handler key that never matches and handlers that are dead, a behaviour of the generator's emission. Kept. | fairly sure |
| U15 | O (needs a derivation) | O (plain) | Sub-class only: plain. The paragraph is in ReadmeExplanation's DEFAULT_LANG row (line 46), and the Fix's own route is "no row for lean once rows are keyed by origin with no default", which needs only originName, already present. U14, on the same row, is plain. CORRECTED. | sure |

Pairs confused in the blind comparison: O and S (S05, U58: a shared
component whose fix is per-language idiom), G and P (U88, M18: generated
source owned by the language pack), S and L (V2), and inside G, behaviour
and comment (G18). Confirmed errors in this table: no class error in 100,
one sub-class error (U15).

The first sample's own comparison, kept for the record:

Agreement: 61 of 65 (94 percent).

| Id | Classifiers | This check | What decides it |
| --- | --- | --- | --- |
| S12 | S (model) | K | The Fix makes no text change and no copy change: "resolved by the S11 generate/doctor error". By the rule that an entry takes the class of the site carrying most of its Fix, it is S11's class, K. |
| U88 | P | G (comment) | The text is comments in generated dart and haskell source. The same classifiers' tables put the pack's other generated code (M16, M17, M18, A03) in G with P as the second class; U88 is the same kind. |
| U98 | O (needs a derivation) | K | The site is docgen `content.ts:160-163`. k-general names docgen under K; U98 repeats U07, which the other table classed K at the same site. |
| M48 | O (needs a derivation) | K | Same docgen site as U07 and U98. |

The same rules applied outside the sample give eleven more corrections, made
because the reason is the same and the entry text leaves no doubt:

- S14, S19, S20 (classed O, O, S): each Fix reads "no change once the S11
  error lands". They become K, like S12 and S11.
- U63, U64, U65, U66, U67, U76, U106, A01 (classed O): each is written by
  docgen alone. They become K, like U07, U98, M48 and the docgen entries the
  other tables already classed K (V8, V22, V25, V26, G24, G30, U108, M46,
  M47).

Pairs of classes confused with each other, in order of how many entries
move: O and K (docgen: 10 entries; the tables disagreed among themselves,
two classing docgen K and two classing it O); S or O and K (a sentence whose
whole fix is S11's tool error: 4 entries); P and G (pack generated code: 1
entry, inconsistent across tables). The classifiers' own least-sure lists
add two pairs that this check did not move: S and L (S15, S27, G03, V1,
U42, U59, U60, D27; V2 was on this list and the blind comparison settled it
as S: whether a sentence repeated in a few install, explanation
or how-to sections would be lifted into a shared frame), and O and S (S05,
X1, U58: a shared component that already writes the text, but whose fix is
a per-language idiom that only a declared runtime fact supplies).

Inconsistencies left as they are, because each is defensible: S13 (T)
repeats S11 (K), and its Fix is wholly "resolved by the S11 error", so the
rule that such an entry takes the root's class would make it K while the
rule that T is copied from the scope table keeps it T (the two rules
collide; carried in the range); S25 (T) is likewise resolved with S24 (S); U20 (P) repeats S23 (S); U75 (S) repeats G01 (T); N15 and
D70 (G) and M37 (T) repeat G28 (K). Distinct counts follow the root.

## 2. Completeness

The catalogue holds 329 entries (S 50, X 7, G 31, V 32, U 108, N 24, M 49,
D 23, A 5). The four tables hold 88 + 86 + 78 + 77 = 329 rows. Checked by
script against every `### <id>.` heading: no id missing, none doubled, none
extra. The heading "The 50 rated medium or low" is not counted.

66 entries say in their Fate that they repeat another; no root repeats
anything, so there are 263 distinct defects.

## 3. Counts

### Per class, after the corrections

| Class | Entries | Distinct | Entries as the classifiers had it | Distinct as they had it |
| --- | --- | --- | --- | --- |
| T | 38 (yes 13, part 25) | 26 (yes 11, part 15) | 38 | 26 |
| S | 28 (model 20, runtime fact 8) | 24 (model 18, runtime fact 6) | 30 | 24 |
| L | 6 | 6 | 6 | 6 |
| O | 81 (needs a derivation 46, plain 35) | 67 (39, 28) | 93 (55, 38) | 76 (47, 29) |
| C | 33 | 28 | 33 | 28 |
| G | 40 (behaviour 31, comment 9) | 29 (21, 8) | 39 | 28 |
| K | 83 | 65 | 69 | 56 |
| P | 13 | 12 | 14 | 13 |
| N | 7 | 6 | 7 | 6 |
| Total | 329 | 263 | 329 | 263 |

### Per section (entries)

| Section | n | T | S | L | O | C | G | K | P | N |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S | 50 | 7 | 7 | 0 | 22 | 7 | 0 | 6 | 0 | 1 |
| X | 7 | 2 | 1 | 0 | 4 | 0 | 0 | 0 | 0 | 0 |
| G | 31 | 3 | 3 | 0 | 5 | 9 | 7 | 4 | 0 | 0 |
| V | 32 | 1 | 2 | 3 | 4 | 1 | 8 | 12 | 1 | 0 |
| U | 108 | 9 | 8 | 3 | 31 | 11 | 8 | 22 | 10 | 6 |
| N | 24 | 2 | 0 | 0 | 3 | 1 | 4 | 13 | 1 | 0 |
| M | 49 | 7 | 2 | 0 | 6 | 2 | 8 | 23 | 1 | 0 |
| D | 23 | 7 | 4 | 0 | 6 | 2 | 3 | 1 | 0 | 0 |
| A | 5 | 0 | 1 | 0 | 0 | 0 | 2 | 2 | 0 | 0 |

### The three numbers

The ranges below come from the borders the rules do not draw (named in
section 1) and from the blind sample. Docgen text is K by rule, so the
first round's alternative of counting docgen as O no longer sets an end of
any range. The blind sample found no class error in this table in 100
entries; with that result, up to about 3 percent of the 229 entries outside
it (about 7 entries) could still be misclassified in pairs not seen, which
widens each range by a few entries but moves no conclusion.

1. **What the proposal's mechanism addresses (T and S):** 66 entries of 329
   (20 percent), 50 distinct of 263 (19 percent). Of that, the prototype
   tested T: 38 entries (12 percent), 26 distinct (10 percent). Six T
   entries (S22, X3, U52, U53, V27, U102; 6 distinct) were not fixed by the
   prototype, because their component, ReadmeRefFeatures and FeatureDocs,
   was already shared before it; they are T by the scope table but are in
   substance one shared edit. Two more (N11, M35; 1 distinct) are js-only
   and js was not ported. Range: 58 to 70 entries (18 to 21 percent), 44 to
   53 distinct. The low end moves the S and L border to L (S15, S27, G03,
   V1, U59, U60, D27: 7 entries, 6 distinct) and S13 to K; the high end
   moves the O and S border to S (S05, U58, X1: 3 entries, 2 distinct) and
   U42 to S.
2. **One edit today, whatever is decided (O):** 81 entries (25 percent), 67
   distinct (25 percent). Of these, 46 entries (39 distinct) need a
   derivation that no shared function gives at 9aebaf9e (targetSurface,
   targetPlace, docLink, featureOnByDefault, modelCopyMode, a release-tag
   helper, apiDisplayName, definitionKind and others): that is the "one
   answer per fact" half of the design, which the proposal needs too but
   does not supply. 35 entries (28 distinct) are plain edits. Range: 78 to
   81 entries (24 to 25 percent), 65 to 67 distinct; the low end moves S05,
   U58 and X1 to S. The split between derivation and plain edit carries
   about 2 percent sub-class error from the sample (U15), so the derivation
   count is 46 give or take 3.
3. **What the proposal does nothing for (L, C, G, K, P):** 175 entries (53
   percent), 140 distinct (53 percent): L 6 (6), C 33 (28), G 40 (29), K 83
   (65), P 13 (12). With N (7 entries, 6 distinct) the share is 55 percent.
   Range: 174 to 183 entries (53 to 56 percent), 139 to 146 distinct: the
   low end moves U42 to S, the high end moves the S and L border to L and
   S13 to K. The G and P border (U88, M16, M17, M18, A03) moves entries
   between G (35 to 40) and P (13 to 18) and does not change this total.


## 4. Work packages

Fate if the proposal were adopted for every README family: (a) the package
disappears into "port that family"; (b) it shrinks; (c) it stays as it is.
Issue membership is from appendix A of the plan (S09 to WP16, G27 to WP33
and V27 to WP18 read by hand, because a pipe in their titles breaks the
table). Seven entries have no package (not a defect).

| Package | Issues | T | S | L | O | C | G | K | P | N | Fate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WP45 | 3 |  |  |  |  |  |  | 3 |  |  | (c) no T or S issue (K only) |
| WP04 | 1 |  |  |  |  |  |  | 1 |  |  | (c) no T or S issue (K only) |
| WP05a | 5 |  |  |  |  |  |  | 5 |  |  | (c) no T or S issue (K only) |
| WP06 | 2 |  |  |  |  |  |  | 2 |  |  | (c) no T or S issue (K only) |
| WP44a | 5 |  |  |  |  |  |  | 5 |  |  | (c) no T or S issue (K only) |
| WP01 | 5 |  |  |  |  |  |  | 5 |  |  | (c) no T or S issue (K only) |
| WP02 | 3 |  |  |  |  |  |  | 3 |  |  | (c) no T or S issue (K only) |
| WP03 | 0 |  |  |  |  |  |  |  |  |  | (c) no issue is assigned to it in appendix A; it supplies what other packages read (guard, derivations, root plan, pack surface), which the proposal still needs |
| WP11 | 8 |  |  |  | 1 |  | 2 | 5 |  |  | (c) no T or S issue (O,G,K only) |
| WP12 | 8 |  |  |  |  |  |  | 8 |  |  | (c) no T or S issue (K only) |
| WP07 | 8 |  |  |  | 8 |  |  |  |  |  | (c) no T or S issue (O only) |
| WP08 | 15 | 4 |  |  | 7 |  |  | 4 |  |  | (c) its T entries (S22, X3, U52, U53) are in ReadmeRefFeatures, shared before the prototype and still wrong after it; the rest is shared or schema work |
| WP09 | 7 |  |  |  | 5 |  |  | 2 |  |  | (c) no T or S issue (O,K only) |
| WP10 | 6 |  |  |  | 6 |  |  |  |  |  | (c) no T or S issue (O only) |
| WP16 | 5 | 2 |  |  | 3 |  |  |  |  |  | (c) needs featureOnByDefault for S08, S10, U51; S09 and D05 are part-tested only |
| WP17 | 5 |  |  |  | 4 |  |  | 1 |  |  | (c) no T or S issue (O,K only) |
| WP18 | 5 | 3 |  |  | 2 |  |  |  |  |  | (b) G29 goes with the ported cell sinks; V27, U102 and U103 stay shared escaper work, untouched by the prototype |
| WP13 | 12 |  |  |  | 9 |  |  | 3 |  |  | (c) no T or S issue (O,K only) |
| WP14 | 12 |  |  |  | 12 |  |  |  |  |  | (c) no T or S issue (O only) |
| WP15 | 12 |  |  |  | 12 |  |  |  |  |  | (c) no T or S issue (O only) |
| WP22 | 9 | 1 |  |  |  |  |  | 8 |  |  | (c) a generate and doctor error; S13 is T but its fix is the same error |
| WP20 | 5 |  |  |  |  |  |  | 5 |  |  | (c) no T or S issue (K only) |
| WP19 | 0 |  |  |  |  |  |  |  |  |  | (c) no issue is assigned to it in appendix A; it supplies what other packages read (guard, derivations, root plan, pack surface), which the proposal still needs |
| WP21 | 8 | 1 | 2 |  | 1 |  | 3 |  | 1 |  | (b) the README halves go with the ported families; the DQ1 pre-pass for generated code (G05, V11, M39), U74 and the pack (U20) stay |
| WP23 | 4 |  |  |  | 1 |  |  | 3 |  |  | (c) no T or S issue (O,K only) |
| WP25 | 5 |  |  |  | 5 |  |  |  |  |  | (c) no T or S issue (O only) |
| WP05b | 2 |  |  |  |  |  |  | 2 |  |  | (c) no T or S issue (K only) |
| WP26a | 13 |  |  |  |  |  |  | 13 |  |  | (c) no T or S issue (K only) |
| WP27 | 0 |  |  |  |  |  |  |  |  |  | (c) no issue is assigned to it in appendix A; it supplies what other packages read (guard, derivations, root plan, pack surface), which the proposal still needs |
| WP26b | 3 |  |  |  |  |  |  | 3 |  |  | (c) no T or S issue (K only) |
| WP44b | 0 |  |  |  |  |  |  |  |  |  | (c) no issue is assigned to it in appendix A; it supplies what other packages read (guard, derivations, root plan, pack surface), which the proposal still needs |
| WP28 | 14 | 3 |  |  |  |  | 11 |  |  |  | (b) the three type-printer entries go with the ported families; eleven code-generator entries (auth predicate, Config, regex) stay |
| WP33 | 9 | 5 | 1 |  |  |  | 2 | 1 |  |  | (b) the README cell sinks go; the jostraca raw mode (G28) and the code escapers (N15, D70) stay |
| WP29 | 10 | 9 | 1 |  |  |  |  |  |  |  | (a) every issue is a quick-start, options-row or REFERENCE constructor in a per-language copy (T 9, S 1); porting those families is the package |
| WP31 | 14 | 6 | 8 |  |  |  |  |  |  |  | (a) operation-dependent prose in ReadmeModel, ReadmeQuick, ReadmeIntro and ReadmeRef copies (T 6, S 8); porting the families is the package |
| WP34 | 5 | 1 | 1 |  | 2 |  |  | 1 |  |  | (b) D04 and S15 go with the ported REFERENCE and explanation tree; N09, M33 (shared sentence) and M10 (feature model) stay |
| WP37 | 9 | 3 | 2 | 2 |  |  | 2 |  |  |  | (b) three T and two S entries go; V5, V6 (one language), G18 and U84 (generated code) stay |
| WP30 | 8 |  | 6 |  |  |  | 2 |  |  |  | (b) the live-test how-to sentences go with a shared how-to (given declared runtime facts); the kotlin and cpp live harnesses (U72, U73) stay |
| WP32 | 7 |  | 4 |  | 1 |  | 2 |  |  |  | (b) the cd and .env.local sentences go with a shared how-to; the ../.sdk literal in 69 templates and components (V32, D60) and G21 stay |
| WP35 | 11 |  | 3 | 4 |  |  | 4 |  |  |  | (b) U60, D27 and D29 shrink to shared install sentences; the four L entries, the Makefiles (U04, V10, V21) and VERSION/LICENSE (U32) stay |
| WP36 | 34 |  |  |  | 1 | 33 |  |  |  |  | (c) no T or S issue (O,C only) |
| WP38 | 6 |  |  |  | 1 |  | 5 |  |  |  | (c) no T or S issue (O,G only) |
| WP39 | 1 |  |  |  |  |  | 1 |  |  |  | (c) no T or S issue (G only) |
| WP40 | 1 |  |  |  |  |  | 1 |  |  |  | (c) no T or S issue (G only) |
| WP41 | 14 |  |  |  |  |  | 2 |  | 12 |  | (c) the pack has its own README components; it would have to port them itself |
| WP42 | 3 |  |  |  |  |  | 3 |  |  |  | (c) no T or S issue (G only) |

Packages: (a) disappear 2, (b) shrink 9, (c) stay 35, of 46. The blind sample changes no package's fate. One border could move one package: if S05, U58 and X1 fell to S, WP07 would shrink rather than stay, giving (b) 10 and (c) 34. Moving the S and L border to L leaves WP30, WP35 and WP37 shrinking, because each keeps other T or S issues. Four packages (WP03, WP19, WP27, WP44b) hold no issue of their own. The 7 entries without a package are the not-a-defect entries.

Under (a) and (b), "goes" means the issue would be fixed by writing the
family once; it does not mean the work vanishes. The port of each family is
its own work: the prototype measured three sections.

## 5. Full table

Corrected rows say CORRECTED in the reason. Repeats is from each entry's
Fate. The where-written value is the catalogue's Class line.

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
| S09 | T | part | neutral-component | ts/src/cmp/ReadmeFeatures.ts:29-30; ts/src/cmp/ReadmeRefFeatures.ts:24,133 |  |  | Scope table: part (REFERENCE half built, README Features half not). |
| S10 | O | needs a derivation | neutral-component | ts/src/cmp/ReadmeTop.ts:245-246 |  |  | The root README features line is in shared ReadmeTop; the fix needs featureOnByDefault. |
| S11 | K |  | neutral-component | ts/src/sdkgen.ts guard; ts/src/action/doctor.ts |  | S (model) | The fix changes no text: a generate-time and doctor error for a missing test feature. |
| S12 | K |  | per-language-copy | ReadmeHowto_<lang>.ts (20); fix is S11's error | S11 | S (model) | CORRECTED from S: the Fix makes no text or copy change; all its work is S11's tool error. |
| S13 | T | part | per-language-copy | ReadmeModel_<lang>.ts and ReadmeRef_<lang>.ts | S11 |  | Scope table: part; clean only through testMock declared in every Syntax provider. |
| S14 | K |  | neutral-component | ts/src/cmp/ReadmeExplanation.ts:281; fix is S11's error | S11 | O | CORRECTED from O: the Fix is "no change beyond the S11 error". |
| S15 | S | model | per-language-copy | ReadmeExplanation_<lang>.ts (18); langpack dart |  | L | 18 module trees repeat (Base, Test, Log); the feature list could come from the description, the rest of each tree is one language's own. |
| S16 | O | plain | neutral-component | ts/src/cmp/AgentGuideContent.ts:189 |  |  | One literal sentence in the shared featureSection(); the fix deletes it. |
| S17 | O | plain | neutral-component | ts/src/cmp/ReadmeExplanation.ts:300 |  |  | A shared lead-in written before a loop; a local reorder. |
| S18 | O | plain | neutral-component | ts/src/cmp/ReadmeTop.ts:588-605 |  |  | Shared ReadmeTop writes heading and header before the row filter; a local reorder. |
| S19 | K |  | neutral-component | ts/src/cmp/AgentGuideFeature.ts:50; fix is S11's error | S11 | O | CORRECTED from O: the Fix is "no change needed once the S11 error lands". |
| S20 | K |  | per-language-copy | ReadmeModel_ts.ts:93; ReadmeModel_js.ts:71; fix is S11's error | S11 | S (model) | CORRECTED from S: the Fix is "no change once the S11 error lands". |
| S21 | C |  | consumer-main | py-data/Main_py-data.ts:700-703; tm/py-data/pkg/fetch.py |  |  | Written by the py-data Main alone, with a code half. |
| S22 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:50-53 |  |  | Scope table: yes; the prototype left ReadmeRefFeatures untouched and the text still shows in all 20 languages. |
| S23 | S | model | per-language-copy | ReadmeModel_<lang>.ts (20, Object.keys(ent.op)) |  | K | All 20 ReadmeModel copies compute their own op list; the catalogue's preferred fix is a core pre-pass (DQ1). |
| S24 | S | model | per-language-copy | ReadmeEntity_<lang>.ts (19) | S23 |  | 19 entity tables read raw ops; a shared ReadmeEntity reading description ops fixes all at once. |
| S25 | T | yes | per-language-copy | ReadmeRef_<lang>.ts (19) | S23 |  | Scope table: yes. |
| S26 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuideFeature.ts:41 |  |  | A literal six-op list in one shared guide; needs an active-op union no shared function gives. |
| S27 | S | model | per-language-copy | ocaml/ReadmeModel_ocaml.ts:103-107 |  | L | Only ocaml leaves the remove sentence ungated; a shared Result shape gated on ops would remove it, otherwise one ocaml edit. |
| S28 | T | yes | per-language-copy | ts/src/cmp/ReadmeQuick.ts:14-17; ReadmeQuick_<lang>.ts |  |  | Scope table: yes. |
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
| S49 | T | yes | per-language-copy | ReadmeQuick_<lang>.ts and ReadmeTopQuick_<lang>.ts (32) |  |  | Scope table: yes. |
| S50 | T | part | per-language-copy | ReadmeQuick/TopQuick/Model/Ref/Howto_<lang>.ts (100) |  |  | Scope table: part. |
| X1 | O | plain | neutral-component | ts/src/cmp/ReadmeExplanation.ts:40-70,225 |  | S (runtime fact) | Shared component with a LANGS table and a TypeScript default; the fix needs per-language example and prose (sibling of S05). |
| X2 | O | plain | neutral-component | ts/src/cmp/ReadmeFeatures.ts:32-33; ReadmeOptions family (dead) |  |  | The sentence is in shared ReadmeFeatures; one rewording; the dead family is a deletion. |
| X3 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:34-35,54,119-131 |  |  | Scope table: yes; not fixed by the prototype (component untouched). |
| X4 | O | plain | neutral-component | ts/src/cmp/ReadmeTop.ts:576-582; ReadmeExplanation.ts:269-286 |  |  | Two shared components disagree; one exported stage constant. |
| X5 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuideContent.ts:137-145,173-180; ReadmeTop.ts:614-640 |  |  | Shared guide prose; the merge sentence needs modelCopyMode. |
| X6 | T | part | per-language-copy | rust/zig ReadmeModel, zig ReadmeEntity, go/ReadmeQuick_go.ts:188 | S29 |  | Scope table: part. |
| X7 | S | model | per-language-copy | ReadmeModel_<lang>.ts (16); ReadmeModel.ts:88 |  | O | 16 copies hold the same literal sentence; a shared ReadmeModel comparing entityOps writes it once. |
| G01 | T | part | per-language-copy | ts/ReadmeModel_ts.ts:65-71; ReadmeTopQuick_ts.ts; ReadmeQuick_ts.ts:35 |  |  | Scope table: part. |
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
| G27 | T | part | per-language-copy | ReadmeEntity/ReadmeRef/ReadmeModel_<lang>.ts (60) |  |  | Scope table: part. |
| G28 | K |  | helper | jostraca Content; ts/src/utility.ts:343-360; TestEntity_ts.ts:261; docgen docgen.ts:293-298 |  | O | Recommended single fix is a raw mode in jostraca Content used by every emitter. |
| G29 | T | part | per-language-copy | ReadmeEntity/ReadmeRef/ReadmeModel_<lang>.ts cell sites |  |  | Scope table: part. |
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
| V27 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:95-96; FeatureDocs.ts |  |  | Scope table: yes; not fixed by the prototype (component untouched). |
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
| U06 | T | part | per-language-copy | ReadmeEntity/ReadmeRef_<lang>.ts canonToType(..., target.name) | N04 |  | Scope table: part; 13 type printers still pass a literal language. |
| U07 | K |  | other | docgen ts/src/content.ts:160-163 |  |  | docgen's surface table classes seneca-provider as an SDK. |
| U08 | N |  | neutral-component | ts/src/cmp/ReadmeTop.ts:229,442-444 |  |  | Fate: not a defect. |
| U09 | P |  | per-language-copy | langpack lean/ReadmeOptions_lean.ts:5-17 |  |  | Literal options table in the pack's lean component. |
| U10 | P |  | per-language-copy | langpack lean/ReadmeQuick_lean.ts:26 |  |  | Scope table: pack-only. |
| U11 | P |  | per-language-copy | langpack lean/ReadmeHowto_lean.ts:18 |  |  | Literal seed path in the pack's lean how-to. |
| U12 | N |  | per-language-copy | langpack lean/ReadmeTopTest_lean.ts:12 |  |  | Fate: not a defect (lean trim: false). |
| U13 | P |  | per-language-copy | langpack lean/ReadmeModel_lean.ts:7 |  |  | Literal comparison in the pack's lean component. |
| U14 | O | plain | neutral-component | ReadmeErrors.ts:25,212; ReadmeExplanation.ts:40,225 |  |  | Shared default row reaches pack languages; dropping it is the X1 edit. |
| U15 | O | plain | neutral-component | ts/src/cmp/ReadmeExplanation.ts:46 |  |  | CORRECTED from needs a derivation: the paragraph is in the shared DEFAULT_LANG row, and keying rows by originName (present) with no default row leaves lean without it, as for U14. |
| U16 | P |  | per-language-copy | langpack haskell/ReadmeInstall_haskell.ts:9-12 |  |  | Empty fence printed by the pack's haskell install. |
| U17 | P |  | per-language-copy | langpack haskell/ReadmeExplanation_haskell.ts:34 |  |  | Cabal name derived differently in the pack. |
| U18 | P |  | helper | langpack dart model; ts/src/helpers/packageMeta.ts:275-277 |  | O | The fix is the pack's dart model declaring its package name. |
| U19 | P |  | per-language-copy | langpack dart/ReadmeRef_dart.ts:72,350 |  |  | Scope table: pack-only. |
| U20 | P |  | per-language-copy | langpack dart/ReadmeEntity_dart.ts:60; ReadmeRef_dart.ts:179 | S23 |  | Scope table: pack-only. |
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
| U34 | T | part | per-language-copy | ReadmeModel.ts:70; ReadmeRef_<lang>.ts |  |  | Scope table: part. |
| U35 | S | model | per-language-copy | ReadmeModel_<lang>.ts (9) |  |  | Nine copies choose the API path point; a shared ReadmeModel calling entityPath fixes them. |
| U36 | T | part | per-language-copy | ReadmeEntity/ReadmeRef_<lang>.ts |  |  | Scope table: part. |
| U37 | O | plain | target-or-feature-model | model/target/go.aontu:4; packageMeta LANG_LABEL | G13 |  | One label source and go's title. |
| U38 | O | plain | helper | ts/src/helpers/packageMeta.ts:311-315 | G13 |  | Manifest description from shared langLabel. |
| U39 | O | needs a derivation | helper | ReadmeTop.ts:108; packageMeta apiName; AgentGuideContent.ts:116-118 |  | K | Three display-name rules; needs apiDisplayName. |
| U40 | L |  | per-language-copy | elixir Main_elixir.ts:81, Package_elixir.ts:28, ReadmeExplanation_elixir.ts:8 |  |  | The elixir app name rule is elixir's alone. |
| U41 | L |  | per-language-copy | java/utility_java.ts:29-46 (kotlin, scala) |  | G | JVM coordinates derived in three JVM languages' own utilities. |
| U42 | L |  | per-language-copy | ReadmeInstall swift, rust, cpp, zig |  |  | The literal sits inside each ecosystem's own manifest snippet. |
| U43 | T | yes | per-language-copy | ReadmeRef_<lang>.ts op-description table |  |  | Scope table: yes. |
| U44 | T | part | per-language-copy | ReadmeRef_<lang>.ts; ReadmeModel_<lang>.ts (rb, php) |  |  | Scope table: part. |
| U45 | T | yes | per-language-copy | ReadmeQuick_<lang>.ts heading |  |  | Scope table: yes. |
| U46 | C |  | per-language-copy | go-cli/Main_go-cli.ts:306 |  |  | go-cli README written by its consumer Main. |
| U47 | C |  | per-language-copy | go-cli/Main_go-cli.ts |  |  | Literal example arguments in go-cli's Main. |
| U48 | C |  | per-language-copy | py-data/Main_py-data.ts | S33 |  | Placeholder names in py-data's Main. |
| U49 | S | model | per-language-copy | ReadmeHowto_<lang>.ts (20), ReadmeTopHowto_<lang>.ts (20), ReadmeErrors.ts:44 |  |  | Same fabricated route in 40 copies; one example route printed by a shared direct() call. |
| U50 | O | plain | neutral-component | ts/src/cmp/ReadmeStation.ts |  |  | Gate on existing featureApplies and isAuthActive. |
| U51 | O | plain | neutral-component | ts/src/cmp/ReadmeFeatures.ts:29 |  |  | A missing singular in one shared lead-in. |
| U52 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:28-30,37-44 |  |  | Scope table: yes; not fixed by the prototype. |
| U53 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:54-55 |  |  | Scope table: yes; not fixed by the prototype. |
| U54 | O | plain | neutral-component | ReadmeExplanation.ts:312-313; FeatureDocs.ts:94-97 |  |  | Condition on honoursActivationOrder. |
| U55 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuideContent.ts; AgentGuide.ts |  |  | One shared function guesses a feature path; needs the layout from featureSource discovery. |
| U56 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuideTop.ts:66-68 |  |  | Unconditional sentence in the one root guide writer. |
| U57 | O | plain | neutral-component | ts/src/cmp/AgentGuideTop.ts:39-41 |  |  | Shared sentence needs only an existing predicate. |
| U58 | O | plain | neutral-component | ts/src/cmp/ReadmeErrors.ts LANGS/DEFAULT_LANG | S05 |  | The one shared table; S05's fix. |
| U59 | S | runtime fact | per-language-copy | ReadmeExplanation_<lang>.ts (11) |  | L | The same sentence in 11 copies; whether it holds is a per-target fact. |
| U60 | S | model | per-language-copy | ReadmeInstall_ocaml/swift/c/scala |  | L | A dependency-free sentence in four install sections depends only on collectDeps. |
| U61 | S | runtime fact | per-language-copy | ReadmeIntro_<lang>.ts (20) |  |  | capitalised in all 20 intro bodies; wrong where the accessor is lower case. |
| U62 | O | plain | neutral-component | ts/src/cmp/ReadmeUnions.ts:10,68; canonType.ts |  |  | One shared component; the condition is a table in canonType.ts. |
| U63 | K |  | other | docgen ts/src/content.ts (seven lines) |  | O | CORRECTED from O: docgen is another repository's tool (k-general names it under K). |
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
| U102 | T | yes | neutral-component | ts/src/cmp/FeatureDocs.ts:47-57; ReadmeRefFeatures.ts:78,95 |  |  | Scope table: yes; not fixed by the prototype. |
| U103 | O | plain | neutral-component | ts/src/cmp/ReadmeTop.ts:130-133 |  |  | One escaper beside mdCell. |
| U104 | O | plain | per-language-copy | mdCell/mdInline; ReadmeExamplesTest_<lang>.ts |  | G | Unmeasured; if real, fixed in the shared escapers. |
| U105 | K |  | other | create-sdkgen CreateRoot.ts:110 |  |  | Commented example in the scaffold. |
| U106 | K |  | other | docgen ts/src/content.ts:158,186 |  | O | CORRECTED from O: docgen splices vendor text. |
| U107 | K |  | helper | apidef ts/src/utility.ts:2484-2494; go/utility.go:2834 |  |  | apidef's firstSentence. |
| U108 | K |  | other | docgen ts/src/content.ts:272 |  |  | docgen QA classification. |
| N01 | K |  | other | sdkgen.ts:327 guardModelNames; docgen bin; @voxgig/model |  |  | Pipeline order across tools. |
| N02 | G | behaviour | helper | ts/src/utility.ts:388 configDefinition |  | O | Generated Config carries basic:true under query or cookie. |
| N03 | G | behaviour | per-language-copy | PrepareAuth_<lang>.ts (12) | V17 | K | Twelve generators keep private copies; output identical today. |
| N04 | T | part | per-language-copy | ReadmeEntity/ReadmeRef_<lang>.ts canonToType |  |  | Scope table: part. |
| N05 | O | plain | neutral-component | ReadmeErrors.ts:212,229; ReadmeExplanation.ts:225,240 |  |  | Shared tables keyed by target.name; key by origin. |
| N06 | C |  | per-language-copy | go-cli and go-mcp Mains |  |  | Consumer Mains hard-code ../go. |
| N07 | K |  | action | ts/src/action/remove.ts:293 |  |  | remove tests null != against ''. |
| N08 | O | needs a derivation | neutral-component | ts/src/cmp/AgentGuideContent.ts:137,173 | X5 |  | Shared paragraphs; needs modelCopyMode. |
| N09 | O | plain | neutral-component | AgentGuideContent.ts:189; model/feature/test.aontu:13 |  | K | Deletes a shared sentence. |
| N10 | K |  | model-schema | ts/model/sdkgen.aontu:233-247 | V15 |  | Base schema hook list. |
| N11 | T | part | per-language-copy | js/ReadmeRef_js.ts, js/ReadmeEntity_js.ts |  |  | Scope table: part; js not ported. |
| N12 | G | behaviour | per-language-copy | ReadmeExamplesTest_<lang>.ts (rb, perl, php, ts) |  |  | Generated README tests use a non-nesting regex. |
| N13 | K |  | action | ts/src/action/doctor.ts; create-sdkgen |  |  | Doctor outdated logic after a downgrade. |
| N14 | K |  | other | langpack package.json, build.yml |  |  | Pack release floor. |
| N15 | G | behaviour | per-language-copy | utility.ts:348-353 into Config_<lang>; TestEntity_ts/js | G28 |  | $$name$$ substituted in generated source. |
| N16 | K |  | other | sdkgen AGENTS.md:937; docs/how-to/add-a-feature.md |  |  | The generator's own documentation. |
| N17 | K |  | action | ts/src/action/doctor.ts, sdkgen.ts warnCopies |  |  | No copy floor. |
| N18 | K |  | helper | ts/src/helpers/copymerge.ts |  |  | --keep semantics hide stale copies. |
| N19 | K |  | helper | ts/src/helpers/copymerge.ts:420-423,543-545 |  |  | --keep records a base without checking. |
| N20 | K |  | action | ts/src/sdkgen.ts:314-335; doctor.ts:593-597 | S11 |  | Generate and doctor report a missing test feature. |
| N21 | P |  | per-language-copy | langpack dart/haskell ReadmeRef, ReadmeEntity, ReadmeModel |  |  | Scope table: pack-only. |
| N22 | K |  | test | ts/test/generatedcompile.test.ts; generateharness.ts |  |  | Test gap. |
| N23 | K |  | helper | ts/src/testkit.ts:565-600; create-sdkgen RootPlan |  |  | Root plan implemented six times. |
| N24 | K |  | test | ts/src/sdkgen.ts export block |  |  | No test pins the export surface. |
| M01 | S | model | per-language-copy | ReadmeHowto_<lang>.ts (7 copies); tm/go/Makefile:26; consumer Mains |  | C; G | Seven how-to copies hard-code the origin key in cd; a shared how-to fixes them. |
| M02 | O | needs a derivation | neutral-component | ReadmeTop.ts, alongside.ts, AgentGuideContent.ts, mcpTools.ts |  |  | Shared name comparisons; needs targetSurface. |
| M03 | O | needs a derivation | model-schema | ts/model/sdkgen.aontu:8; ReadmeTop.ts:150-157 |  |  | Ordering done once in ReadmeTop; needs targetSurface. |
| M04 | T | part | per-language-copy | ReadmeEntity/ReadmeRef_<lang>.ts canonToType | N04 |  | Scope table: part. |
| M05 | O | plain | neutral-component | ReadmeErrors.ts:212, ReadmeExplanation.ts:225 | N05 |  | Key by originName, delete the default row. |
| M06 | C |  | per-language-copy | Main_go-cli.ts, Main_go-mcp.ts | N06 |  | Only the two Go consumer Mains write ../go. |
| M07 | K |  | action | ts/src/action/remove.ts:293 | N07 |  | CLI message of target remove. |
| M08 | S | model | per-language-copy | ReadmeModel_<lang>.ts (22); Main_go-cli.ts:257-262 |  | C | ReadmeModel writes the header unconditionally in each copy. |
| M09 | K |  | action | ts/src/action/resolve.ts:357-389; opShape.ts |  |  | A generator warning misclasses a target. |
| M10 | K |  | target-or-feature-model | model/feature/secrets.aontu |  |  | Feature definition makes feature add install it inactive. |
| M11 | K |  | neutral-component | ts/src/sdkgen.ts generate(), doctor.ts | S11 | G | Generate-time and doctor error. |
| M12 | T | part | per-language-copy | ts/js ReadmeHowto, ReadmeModel, ReadmeRef, ReadmeTopQuick, ReadmeQuick |  |  | Scope table: part. |
| M13 | T | yes | per-language-copy | ReadmeQuick/ReadmeTopQuick (go, java, py) | G01 |  | Scope table: yes. |
| M14 | T | yes | per-language-copy | go/ReadmeQuick_go.ts, go/ReadmeTopQuick_go.ts |  |  | Scope table: yes. |
| M15 | G | behaviour | template | tm/go make_options.go; tm/rust; tm/zig; tm/c |  |  | Runtime templates panic on a missing server variable. |
| M16 | G | behaviour | template | langpack tm/dart PrepareAuthUtility.dart |  | P | Pack runtime template sends Basic in the header. |
| M17 | G | behaviour | template | langpack tm/haskell SdkRuntime.hs; Config_haskell.ts |  | P | haskell runtime has no Basic branch. |
| M18 | G | behaviour | template | langpack tm/lean SdkUtility.lean; Config_lean.ts |  | P | lean runtime lacks the server option and Basic. |
| M19 | P |  | per-language-copy | langpack lean/ReadmeTopQuick_lean.ts:13 |  |  | Scope table: pack-only. |
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
| M35 | T | part | per-language-copy | js/ReadmeRef_js.ts, js/ReadmeEntity_js.ts | N11 |  | Scope table: part. |
| M36 | G | behaviour | per-language-copy | ReadmeExamplesTest_<lang>.ts | N12 |  | Generated README tests regex. |
| M37 | T | part | per-language-copy | ReadmeEntity/ReadmeRef/ReadmeModel cell sinks; Config_<lang> | G28 |  | Scope table: part. |
| M38 | T | part | per-language-copy | ReadmeEntity/ReadmeRef/ReadmeModel table sinks | G27 |  | Scope table: part. |
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
| D04 | T | part | per-language-copy | ReadmeRef_<lang>, ReadmeExplanation_<lang>, ReadmeTop, AgentGuideContent |  |  | Scope table: part. |
| D05 | T | part | neutral-component | ReadmeFeatures, ReadmeRefFeatures, ReadmeTop | S09 |  | Scope table: part. |
| D10 | T | part | per-language-copy | ReadmeEntity/ReadmeRef/ReadmeModel/Entity_<lang> |  |  | Scope table: part. |
| D22 | G | behaviour | per-language-copy | PrepareAuth_<lang>.ts (12); consumer Mains; docgen |  | C | Twelve code generators importing one predicate. |
| D23 | T | part | per-language-copy | ReadmeTopQuick/ReadmeQuick/ReadmeModel_<lang> |  |  | Scope table: part. |
| D25 | S | model | per-language-copy | ReadmeHowto_<lang> Run tests; Main_go-cli/go-mcp |  | C | Per-language how-tos must name the variables their tests read. |
| D26 | T | part | per-language-copy | ReadmeModel/ReadmeRef/ReadmeOptions_<lang> |  |  | Scope table: part. |
| D27 | S | runtime fact | per-language-copy | ReadmeInstall_<lang>.ts (20); Deploy.ts, PublishWorkflow.ts, packageMeta.ts |  | O; L | Publish state and package name derived separately in 20 install copies. |
| D29 | S | model | per-language-copy | ReadmeInstall_<lang>.ts (20); tm/<lang>/Makefile (15) |  | G | The tag sentence is the same fact in 20 install sections. |
| D33 | O | needs a derivation | neutral-component | ReadmeTop.ts, alongside.ts, AgentGuide.ts, PublishWorkflow.ts, Deploy.ts |  | S | Most sites are shared and need targetPlace and docLink. |
| D34 | O | needs a derivation | neutral-component | alongside.ts PHASES, ExternalTarget.ts, AgentGuideContent.ts:65 |  | K | Phase re-derived in shared code; one export. |
| D35 | K |  | test | ts/src/testkit.ts; generateharness.ts; create-sdkgen Root |  |  | Three hand-written Roots in tooling. |
| D44 | O | needs a derivation | neutral-component | mcpTools.ts, ReadmeTop.ts:451-453,475 |  | C | Shared root README MCP section needs targetSurface. |
| D47 | S | runtime fact | per-language-copy | ReadmeHowto_<lang>.ts Run live tests (6) | G03 |  | A declared per-target fact drops the section. |
| D48 | O | needs a derivation | neutral-component | AgentGuideContent.ts; AgentGuide.ts; AgentGuideFeature.ts; ReadmeTop.ts | X5 |  | One constant plus modelCopyMode. |
| D55 | T | part | per-language-copy | ReadmeTopQuick_ts, ReadmeModel_ts, serverVars.ts | G01 |  | Scope table: part. |
| D56 | C |  | fragment | go-cli words.fragment.go:13; main.fragment.go; Main_go-cli.ts | G08 | G | go-cli registers verbs literally. |
| D60 | G | behaviour | template | 58 templates and 15 components | V32 | O | Hard-coded relative path in generated source. |
| D61 | C |  | per-language-copy | Main_py-data.ts; Main_go-cli.ts; Main_go-mcp.ts |  |  | Each consumer Main decides alone. |
| D69 | T | part | per-language-copy | ReadmeEntity/ReadmeRef/ReadmeModel cell sites | G27 |  | Scope table: part. |
| D70 | G | behaviour | per-language-copy | Config_<lang>.ts and TestEntity_<lang>.ts | G28 | O | Code escaper in each Config and TestEntity generator. |
| A01 | K |  | helper | docgen ts/src/content.ts:677,684 |  | O | CORRECTED from O: docgen writes the tutorial steps. |
| A02 | K |  | test | langpack test/langpack.test.js:812-826 |  |  | Pack test gap. |
| A03 | G | behaviour | template | langpack tm/dart MakeOptionsUtility.dart; haskell and lean |  | P | Pack runtimes hold their own option specs. |
| A04 | G | behaviour | per-language-copy | ts/Entity_ts.ts:55; js/Entity_js.ts:38 |  | L | ts and js generators name the entity file with the installed key. |
| A05 | S | runtime fact | per-language-copy | ReadmeModel_<lang>.ts Operations line |  |  | Each copy decides its own capitalisation; a shared line through the provider's spelling. |

## 6. Not done

- The first sample was not blind; the second, of 100 entries, was (see
  section 1). The second classifier read the same structured catalogue
  lines (Fate, Class, Where), which drive most classes, so the two readings
  are not fully independent either.
- Entries outside both samples were not re-read against source; their
  classes are the classifiers' except for the sixteen corrections named in
  section 1 (fifteen from the first check, U15's sub-class from the second).
- The (a), (b), (c) fate of each package is a reading of its issues'
  classes, not a measured port. No family beyond the prototype's three was
  ported.
- The S and L border was not settled by reading the install, explanation
  and how-to copies; it is carried as a range.
