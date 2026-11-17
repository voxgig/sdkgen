# Check of the final record (record3)

Checker's notes. One line per finding: where, what the record said, the
report that decides it, what was changed. Reports are under P/results.

## Verdict words

- H2: "not refuted, by 3%, on the count the criterion names" -> **refuted**.
  The criterion ("less than 2x fewer lines for those sections") names no
  count; the record's own 1.1 lists the forms file as one of the three
  things a language supplies in the structure tested from version 3 on;
  with the forms 1.54x, with the guard 1.20x (s6-measure20, ran). The
  prototype's own independent checker at version 3 judged H2 with the
  forms counted (s3a-check: 1.39x, which s3a-freeze says includes the
  forms), and the 3.2 builder gave "refuted on every count that includes
  the forms or the guard" while its doc-only projection was 2.26x
  (s3fix2-final). Moving to the doc-only count in the one round where it
  first passes (by 3%) is kinder than the evidence. The 2.06x stays in the
  verdict, with "on documentation code alone H2 would be not refuted".
  Changed: table row, verdict, 3.2 header and standing, plan table row.
- H4: "holds" -> **not refuted**. The record defines "holds" as criterion
  not crossed AND claim shown. Seven of twenty never compiled; the lanes
  compile their own models (not the 21 variations), java's adds imports,
  php's strips the require (s6-attack34 A5, A10, A11); and the brief's
  test for non-toolchain languages (byte-identical blocks except listed
  corrections) leaves many "other" blocks decided by hand (s6-integrate
  table). The claim is shown only where measured. Changed: table row,
  verdict, 3.4 header and standing.
- H1 refuted: kept. Line "at four times the limit" -> "2.5 to 4.4 times"
  (25 provider alone, 44 with forms; s6-measure20 says "2.5 to 4 times").
  Added to the verdict: the "alone" prose measure is far over 15% within
  single sections (go tutorial 33.5%, root quick starts of c, ts, perl
  over 92%; s6-measure20), all shared style-selected sentences.
- H3 not refuted: kept. The X3-charged figures were the top of their
  ranges given as single values; corrected to 5.6% to 8.3% (rule) and
  8.3% to 11.1% (strict) per entry, 6.9% to 10.3% and 10.3% to 13.8% per
  distinct defect; over the line only on the strict reading with D26's
  open half counted against (record's arithmetic). Table, verdict, 3.3.
- H5 not refuted: kept. "Every unsafe state ... has a local fix" is not
  shown for c5: its recorded remedy (exports map) is ruled out by
  ts/package.json (s6-attack34 [12]); the other remedy, applied, did not
  close the bypass (s6-measure20 row 29). Now "each has a local fix but
  one", in table, verdict and 3.5.
- Reach / generality: kept. The plan table's "shared sentences" row now
  states its condition (one of the six shared edits wrote a sentence
  false in 17 runtimes) and the forms-inclusive ratio.

## Figures that did not match

- 6.1 guide problems "40 in all" -> 44 (s5-port-*.json guide_problems:
  js 6, php 5, cpp 7, csharp 6, java 7, kotlin 7, scala 6).
- Plan table: first migration round "about 265" -> about 280 (s4-h5 cost:
  +282 / -7 with tests).
- Plan table: naming hook "22 to 26 lines per language": that is the
  seven's range (s6-measure20); across twenty it is 22 to 34 (elixir 34,
  c 28, clojure 27; wc -l of Naming_*.ts in the measurer's clean clone at
  v34-frozen, run in this check). Both given, attributed.
- Plan table: "752 classes ... in every language" -> 752 in the thirteen
  then ported (s4-h3fix).
- 3.1: "four 3.1 tightenings and one 3.2 each forced every then-ported
  forms file": F3 forced c, rust, clojure only; F9 forced c, scala, cpp,
  kotlin (s6-measure20 interface_recount rows F3, F9). Corrected.
- 3.3: stream sentence "ok in all sixteen runtimes": the attacker cites
  the reading in 14 of the 16 (not py, ocaml; s6-attack34 [0]-[3]).
- 5.4: "relabelled three records and deleted one": the deleted record was
  the stream sentence's, not a CS0136 one (s5-verify-csharp V3).
- 5.4: attack counts: "between 26 and 37 per language ... in js and
  kotlin every attack that did not change a declared value": js gave no
  count; kotlin 13 of 37 and php 9 of 31 were not caught mechanically
  (s5-review-*.json attacks). Rewritten with the counts.
- 6.3: "guard and reader tests number 105 (measurer and integrator, ran)":
  the measurer did not run them; integrator and attacker did.
- 5.8: ReadmeModel_ts.ts:103 is line 101 on main (103 was the prototype
  clone's line, s5-fix-js). Marked "on main".
- Status: "the shared changes the integration recorded and did not make,
  among them the fix for [the secrets sentence]": the integration never
  recorded it; it was found after, by the attacker. Reworded.
- 4.3: WP08 "its T entries are the unfixed ones": stale at twenty (fixed
  by shared edits; the classes file already says so). Corrected.

## Paths

- `test/packaging.test.ts` -> `ts/test/packaging.test.ts`.
- `tm/kotlin/core/SdkClient.kt` -> `ts/project/.sdk/tm/kotlin/core/...`.
- Checked on main: pipeline.hpp:600-616, sdk_runtime.ml:1574-1579,
  SecretsFeature.cs:317, TestFeature.java:228-231,
  EntityRemoveOp.fragment.cpp:12-18, EntityBase.fragment.cs:233-240,
  EntityBase.fragment.kt:28-34, SdkClient.kt:358-361,
  EntityRemoveOp.fragment.php:31-33, Entity.fragment.php:70-72,394-395,
  ReadmeModel_js.ts:79, secrets.aontu, FeatureDocs.ts, generatedcompile.

## Figures that matched (sample of what was checked)

Verdict and table: 44 = 25 + 19, 42 merged, 9 to 11 from new languages,
41 accepted, 7.1% / 14.8%, 2.06x / 1.54x / 1.20x / 2.14x / 1.50x, 15,038 /
7,285 / 9,780 / 12,520, 2,840 shared, 259 machinery, 855 / 492 forms,
1.71x / 1.43x, 2.8% to 5.6%, 34 of 36, lanes 16/12/12/6/6/49/6/6, java
24/19/19 and 20/14/14, js 24/17/17 vs 20/13/13, 60 retired, 74/76, 150
files, 1,062 words, 385 / 221 / 164 / 128 / 36 / 190 / 40, re-count rows
P1 to P25 and F1 to F19 against 6.1 and appendix B rows 35 to 47, hand
ranges 14-28 / 0-4 / 55-135, appendix A rows against s6-integrate's
table, port times, port line counts, deleted 709 to 753, provider 148 to
204, 18 kotlin sites, 8 scala, 8 php templates, 351/333, 370/352,
146/143, 1,319 blocks, 2,702 / 2,697 / 5, 105/105, 285 controls, 49/59
and 94/108, 43 + 28 + 11 attacks, 21 retired in row 1, lp 7 lines.

## House rules

No AI model or tool named; no temporary path; no em or en dash, no
spaced hyphen; no first person outside code spans; prose wrapped under
79 columns (three lines this check introduced or left long were
rewrapped). Both files clean after the check. The classes file needed no
change from this check.

## Consistency

Status, table of standings, verdict, sections 3.1 to 3.5 and section 8
now say the same words: H1 refuted, H2 refuted, H3 not refuted, H4 not
refuted, H5 not refuted; none "not decided"; none "holds".
