# Check of model-dependent-text-prototype.md against the records

One line per finding: what the document said, the record that decides it, what changed.

## Numbers (about 120 checked; 18 mismatched; 1 superseded; 0 not found; several attributions corrected)

- 2.3 hand decisions "18 to 28 tutorial, 3 root, 61 to 73 reference": s3c-freeze33.txt table gives tutorial 14 to 28, root 0 to 3 (rule-only for ts, go, py, c, clojure, elixir), reference 36 to 73. Corrected.
- H1 criterion 3 table, stage 2 "about 6 (stage 3's count) ... checker agreed on about 6": s2-check_v2.txt:287 gives 4 (stage-2 checker); s2-ref.txt:660 counts from stage 1's first commit and adds block->before, Ent.sym and RefFacts.container. Split into two rows.
- 5.1 "v2 counted 4 and stage 3 about 6 for the same span, differing on the naming hook": not the same span or set (s2-ref.txt:660, s2-v2.txt:634). Corrected.
- H1 "it counts changes that force a provider (or, from 3.2, a forms file)": s3fix2-final.txt:1029-1034 builds 20 to 22 from provider changes only; s3c-freeze33.txt:36 adds 3 shared. The six forms-framework breaking changes are outside the running count. Corrected; added "about 31 to 33 with them" as this record's arithmetic; Appendix B footer and 5.1 say so.
- H1 "every breaking change turned a guess into a declared fact" through 3.2: only the 3.2 changes (s3fix2-final.txt:1104); version 3's were elective removals (s3a-shape.txt:161). Corrected.
- H1 prose "by source stayed under 15% at every version": s3a-shape.txt:918 (go notes 20.5% of REFERENCE prose, builder called it crossed), s3a-check.txt:40 (18.9%). Corrected; headline qualified.
- H1 criterion 1 "3.1, 3.2 confirmed by checker": no checker at 3.2. Corrected.
- H2 history "1.39x and 1.24x (builder and checker)": 1.24x is the checker's alone (s3a-check.txt:148). Corrected.
- H2 history "1.13x (stage 2, independent)": builder's figure reproduced by the checker (s2-v2.txt:551, s2-check_v2.txt:154). Corrected.
- H3 stage-2 issue checks presented as shared fixes with no per-language edit: s2-check_v2.txt:295 says c-getenv and M14 were provider fixes. Corrected.
- H3 "17 REFERENCE issue checks (independent, ran)": builder's 17 checks (s2-ref.txt:591); checker confirmed the listed fixes by grep (s2-check_ref.txt:98-103). Corrected.
- H4 lanes "reproduced at 3.1 and 3.2 by checkers": 3.1 checker yes (s3fix-check.txt:61); 3.2 has no checker; stage-9 verifier reproduced (s3c-sfix-verify.txt:200). Corrected.
- H4 perl HASH "17 variations (reviewer, ran)": reviewer 14 (s3b-review-perl.txt:8), verifier 17 (s3b-verify-perl.txt:37). Corrected.
- H4 root quick starts attributed to "builder" with py ModuleNotFoundError: shared builder of the 3.3 round (s3c-n-shared.txt:403-440); py imports with the package on the path, rb then fails on the live request. Added.
- H5 "13 of 14 behaviour rows": s1-migrate.json has 15 rows, 14 acceptable. Corrected. Upgrade walk also reported 12 missing and 5 outdated (s2-check_v2.txt:96). Added; lifecycle change carried since v2 (s2-ref.txt:559).
- 4.1 "40 self-test controls failed only because their text had changed": s3c-sfix-shared.txt:462 and summary: 40 failed on run 1; 22 re-aimed (16 injections, 6 identity); two tool defects exposed. Corrected in 4.1 and 5.2.
- 4.2 six wrong facts "(guard builder, ran)": s3fix-guard.txt "read, then confirmed by the guard". Corrected.
- 4.7 "sixteen runtimes ... cannot be cancelled": survey Q3/Q4: sixteen read a signal, ts and js can cancel, so fourteen. Corrected.
- 4.8 `ReadmeRefFeatures.ts:111,138` and `ReadmeTop.ts:259-261` are prototype line numbers (s3fix2-shared.txt:276, s3fix-shared.txt:155); on main the lines are ReadmeRefFeatures.ts:107 and :24, ReadmeTop.ts:245-246, ReadmeFeatures.ts:29, and main prints "to true", not `active: false`. Corrected.
- 5.3 "5,215 calls at 3.3": counted at the 3.3 round's tools (s3c-n-tools.txt:480), before the freeze. Qualified.
- 5.4 "half an hour fits provider and hook writing": perl and lua whole ports took 30 min by the clock (both porters doubt it), swift and ocaml about 2 h 15; lua's provider and hook 3 min (s3b-port-*.txt). Corrected; brief named; perl's doubt and the missing step times added.
- 7 staleness attacks attributed to the stage-9 verifier: they are the separate tools branch builder's own attacks on the verifier's fixes 4 and 5 (s3c-t7.txt:15, 194-220, 336). Corrected.
- Superseded: H3 "not yet measured; running" (status line, 3.3, 7). s4-h3.txt is a builder's full measurement at v33-frozen. Section 3.3 rewritten from it; status line and section 7 updated. Its independent check is running (no record).
- Confirmed (sample): H2 3.2 table and projections (s3fix2-final.txt:884-906); prose table (s3fix2-final.txt:912, s3c-sfix-verify.txt:621); 77 sentences breakdown; first-wave by-source figures; 297/227/178; 14 false, 35 awkward; 418 files; 39 ok 2 awkward; guard mutation rows; Appendix A table and guard account; numstat lines; suite 2,631; self-test counts and times; 1,666 classes; 599 hand; ts 74 to 120 etc.; 136/14 lines; 76/74/2; 5 OUTDATED; 24 of 105; 72%/42%; 81%/50%; 228/381 files; 1,312 lines; lanes at 3.3.

## Hypothesis standings

- H1: breaking-change criterion now also reported with the forms framework (about 31 to 33); prose criterion no longer said to hold "at every version". Harsher.
- H3: "not measured" changed to "not decided": 1/36 (2.8%) by the brief's rule, 13.9% strictest, 19.4% with the six unfixed shared entries counted against (s4-h3.txt). The prototype did change ReadmeRefFeatures.ts lines (s2-ref.txt:399, s3fix-shared.txt:155), which the H3 record's "never touched" overlooks; written as "changed a few of their lines".
- H2, H4, H5 standings unchanged.

## Ran or read

- 4.2 wrong facts: ran -> read then confirmed by the guard.
- 3.3 stage-3 REFERENCE checks: independent -> builder ran, checker confirmed by grep.
- H2 1.13x: independent -> builder, reproduced.
- H4 lane counts at 3.2: checker -> merging builder.
- Per-port H2 ratios and "31 to 33": marked as this record's arithmetic.

## Defect lists

- 4.7: sixteen -> fourteen (cancellation); full repository paths given for lua, c, php, zig, StreamingFeature.
- 4.8: ReadmeRefFeatures/ReadmeTop entries re-cited to main and reworded; backtick-leak fix noted as partial (s4-h3.txt surprises); log REFERENCE "set to true" added (s4-h3.txt); py root entry qualified; full paths for lua, perl, swift, ReadmeExplanation.

## House rules

- No model or tool named; no temporary path; no dash punctuation; no first person (grep).
- `ts/test/runtimeforms/<lang>.ts` is not in the repository: now marked as the prototype's.
- `v33s`, OLD and NEW were used undefined: defined.
- Other repository paths checked to exist in /home/user/sdkgen.

## 4.5

- "the proposal's three sections are the ones where sharing is highest": not in s2-restanatomy.txt (entity family 88% of units, quick 77%). Replaced with what the record says, including 8% of units / 19% of words genuinely per-language.
