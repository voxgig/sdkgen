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

§W The thirteen languages' REFERENCE counts are lower than at 3.3 because the catalogue edits changed the feature and constructor lines on every page. js's 21 same tutorial units, against 59 elsewhere, reflect its old pages, an older copy of the ts components.

§W Facts at 3.4 (attested against the OLD page / recorded by hand / cited / pinned prose for a reviewer to audit): ts 5/1/22/12, go 4/3/17/11, py 6/1/17/10, c 8/2/14/10, zig 8/1/19/12, clojure 8/3/17/11, rust 8/1/16/9, elixir 4/2/17/12, rb 5/2/17/10, perl 6/3/12/8, swift 3/2/15/9 (and 1 not printed), ocaml 7/4/16/13, lua 4/3/21/15, js 5/2/23/13, php 4/2/20/10, csharp 4/2/17/11, java 4/2/15/11, kotlin 6/2/15/12, scala 5/2/15/10, cpp 4/3/15/10. Suite at the frozen commit: 2,702 tests, 2,697 pass, 0 fail, 5 skipped (integrator and attacker, ran). Golden 2/2. Guard and reader 105 of 105.

§W Second-wave history, per language (porter, reviewer, fixer, verifier): js passed its one command at the port and after the fix, and was verified ok; php the same. java passed at the port but broke three repository tests it had not run; fixed, then held failing by two defect classes on its deleted read until the integration. cpp failed at the port on the guard's reading of its template constructor and then on a defect class for its remove sentence; csharp on three defect classes for its root quick start and one for the stream sentence; kotlin on six false findings of the printed-call check and two defect classes for its stream note; scala on three false findings of the printed-call check. Each of those five was verified as failing only on a shared change it had recorded, and each passes at 3.4 after the integration made the change.

### At version 3.3, for comparison

From the freezing builder's run of the one command at `v33-frozen`, three
sections, 21 variations. "Same" is units identical to OLD; "hand" classes
decided by a person
(rule-recorded classes are those carried from earlier rounds); "missing" OLD
classes with no NEW counterpart, each decided. Every row: guard 4/4, stale
0, open 0, defect 0.
