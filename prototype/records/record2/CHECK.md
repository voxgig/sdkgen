# Check of the second version of the record and of the classes file

One line per finding: where, what, the report that decides it, what changed.

## Figures (about 360 checked against the seven reports; 0 not found)

- 2.1, 2.3, 2.4, stage 11 row: tag base33 a3fd3b8, d3b258d, five commits, 225a0de left out, one conflict, two controls re-aimed; php 8.3, composer, javac, mvn, gradle present, kotlinc etc. missing; php lane 304-318. s3c-base33, s3c-guide33. Match.
- 3.1: purity 0 open, accepted 1 to 4; by-source and alone tables (26 figures); notes; 980 words; 235/231/107, 34/4/69, go 28 ts 23 c 17 elixir 13; 28 unexplained read; 312/81/174. s3c-base33. Match.
- 3.2: 9,887; 2,473; 2,920; 5,393 1.83x; 7,033 1.41x; 9,683 1.02x; 10,632 to 7,791 1.36x; nine 1.55/1.25/0.85; 2,346 to 2,473; 1,878 to 2,650; 236/219; 144/118; per-port 255/208/281/201; projection table; 225; 62 to 92; 126; 1.59x/1.24x. s3c-base33. Match.
- 3.3: 329, 38 (13/25), 30 distinct, 5/286, 29/22, 28, D26 partial, 6 unfixed, 2 js-only; all twelve ratios; U37 sensitivity 24.3%/5.4%; 66 blind sample, 146 and 7; six fooled checks; sdkdesc 281-310; py.ts:93, elixir.ts:97. s4-h3, s4-h3check. Match.
- 3.5: rows 1 to 15 (17 table rows), 8 unsafe without, 5b unsafe both; 60/39 files; 26/25/39; 4,117 ms; timings 1,252/1,369/1,336 and 3,704/4,093/3,599, checker 1,393/1,520/1,235 and 4,349/4,105/3,672; 187 errors, 12 exports; 62/80 lines; 74/76, 10/12; cost lines; 318/318; 2,641/2,636/0/5; 22 states, 16 safe; 75 rows. s4-h5, s4-h5check. Match except below.
- 4 and the classes file: every class count, sub-class split, distinct count, range, per-section row (81 cells), the three numbers, package fates 2/9/35 and WP07 border, sample figures 88/86/78/77, 61/65, 95/100, 93/100, 60/65, 33/35, about 7 of 229. s4-general-sum, s4-general-blind; recomputed from the table by script. Match. The sum report's first ranges (57 to 70; 78 to 93; 165 to 184) are superseded by the blind report's; the files use the blind report's. Correct.
- 5.2, 5.3, 5.8, 6.1, 6.3, 7, 8, appendices A and C: 266/0/1, 1,723 s and 2,926 s, 1,640 and 492 forms, 1,312 lines, 965 to 1,675 articles, 957 lines, 8 gaps, ten optional facts, kotlin/scala/js file lines (checked in the repository). Match.

## Mismatches and corrections

1. 3.5, older interface: "Of the seven breaking changes ... six applied". s4-h5: six applicable CASES, three per provider (lua [1][8][14], ocaml [0][1][8]), four distinct changes. Rewritten.
2. 3.3 table: "66 entries re-judged blind, scope agreed". s4-h3check: agreed except U37 and S46 (arguable). Added.
3. 4.5: "seven, all in shared code, were not fixed". s4-h3check: six not fixed, D26 fixed only in part. Corrected to "not fixed or (D26) only in part".
4. 4.3: "WP36 (34 consumer issues)". s4-general-sum: 34 issues, C 33 and O 1. Corrected.
5. 8, integration: "the first lanes for php, java, cpp and js". Contradicts 2.4 (php, java and cpp have README tests on main; java and cpp structure only, php strips the import). Rewritten.
6. 3.5, rules bent: "(checker, read)". s4-h5check: the interface-reader disagreement and the copy-record bend were also seen in runs. Marked.
7. Status table, H5: "copy record holds the retired copy". The unsafe S2b state is one where the record holds an older fingerprint. s4-h5check. Now "holds the retired copy as unchanged", as section 3.5 says.
8. Status table and 3.5 (twice): a pack that ships providers "stops generating at each raise" stated as measured. s4-h5check not_done: inferred, no pack was upgraded across a raise. Marked as inference in all three places.
9. 3.3: `ts/src/helpers/sdkdesc.ts` given without saying it exists only in the prototype (absent on main). Said so.
10. 5.8: "the scaffold's generate relies on it" (stale incremental build). No report says so; s4-h5 says only that generate runs tsc first. Reworded.
11. 5.8: the copy-record reader called a defect without noting that on main it is deliberate (comment in `ts/src/action/copies.ts` above `readCopies`); it becomes a hazard only with record-gated retirement (s4-h5check rules_bent). Reworded.
12. Status table, H3: "(2.8%; 5.6% ...; 16.7% on the strictest), under the limit". The strictest figure is over the limit. s4-h3check. Reworded.
13. 5.2: bare `Main.fragment.kt:10` and others; expanded to repository paths (checked: lines 10, 10 and 7 hold the cited text).

## Sentences removed from the committed record

All removed sentences were superseded, not inconvenient: the old status, H2 "not re-measured", the 3.2 projection (kept in prose), H3 "check running", H5 "not measured", "no round ran doctor", the stand-in details (condensed), the tools branch "not in the frozen tools" (now merged), the language pack at version 2 (replaced by row 7a). One builder statement removed from 3.3, "it changed a few of their lines", was true; the new text keeps the substance through the check's correction.

## Standings

- H1, H2, H4: follow from s3c-base33. No change.
- H3: follows from s4-h3check; status-table wording fixed (12).
- H5: follows from s4-h5 and s4-h5check; the inferred pack behaviour is now marked (8) and the record condition tightened (7). Not made kinder or harsher otherwise.
- Section 4: shares are as the blind report gives them; the six unfixed are stated in 4.2; the sample basis is stated in 4.4. The plain answer was only in 4.5: added to the section's first paragraph, to the status lead, and as a "Reach" row in the standings table.

## Classification table (script)

- 329 rows in both tables, same order, none missing, none doubled; every id is a `### <id>.` heading of the catalogue and every heading has a row.
- Id, class and sub-class identical in all 329 rows. Reasons changed in 45 rows: 38 wording only ("Scope table: ..." to "In the H3 scope, ..."), U63 (working name removed), and S22, X3, V27, U37, U44, D26 with reasons from s4-h3check. WP18's fate text likewise. All stated; the table header now names them.
- Recomputed counts equal the printed ones: T 38/26 (13/25; 11/15), S 28/24 (20/8; 18/6), L 6/6, O 81/67 (46/35; 39/28), C 33/28, G 40/29 (31/9; 21/8), K 83/65, P 13/12, N 7/6; per-section rows identical; 46 packages 2/9/35.

## House rules

- No model or tool named, no temporary path, no first person, no dash as punctuation in either file (grep).
- DQ1 and "appendix A" in the classes file were used without saying they are the plan's; defined.
- Every new repository path exists in /home/user/sdkgen except the prototype's own files, which are marked as the prototype's.
