p = '/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/record3/model-dependent-text-prototype.md'
s = open(p).read()


def rep(a, b):
    global s
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)


rep("""| H5 branch (not in the base) | 1 if adopted: a required `interface` field in every provider | a `package check` rule | versioning the interface for packs (section 3.5) | 0 |
""", """| Catalogue shared edits | 0 | 1 (a field of the shared feature description) | the catalogue entries | 0 |
| Migration structures, merged at 3.4 | 1 by the re-count and the attacker: the `interface` field, which every provider had to add or be served the previous version with fewer sentences (the integration counts 0, since the type allows omitting it) | a `package check` rule; the previous interface served; `testMock` required at generation instead of in the type | versioning the interface for packs (section 3.5) | 0 |
| Second wave, while porting | 0 | (recorded, not made) | the ports | 0 |
| 3.4 integration | 3 to the guard (the accessor lookup and `ref.instance` judged; the deleted read checked name by name; the scala test tree outside the runtime) and 1 changed shared sentence (the stream signal); 5 counting a changed row in two unported components | 5 optional facts (a call factory, `blockScope`, `streamSignalForm`, `removeKeeps`, the deleted read's layout fill), and tools changes | the second-wave reviews, fixes and verifications | 3 or 4 by the re-count; 4 or 5 by the integration |
""")

rep("""Cumulative breaking changes since the first four languages: about 25 to 27
(3.3 builder), counting the provider interface and changed shared
sentences but not the six forms-framework changes in the table; with them,
about 31 to 33. The records disagree on details:""", """§W Cumulative breaking changes since the first four languages, by the independent re-count from the code history: 25 to the provider interface and 19 to the forms framework, 44 in all (24 and 16, 40, at `v33-frozen`), changed shared sentences not counted. By round, provider: v2 2, stage 3 1, version 3 5, 3.1 1, 3.2 9, the sentence fix round 3, 3.3 3, the migration round's interface field 1; forms: the version-3 freeze 1, 3.1 4, 3.2 5, 3.3 6, 3.4 3. The builders' running count at 3.3 was about 25 to 27 with changed shared sentences and without the forms, about 31 to 33 with the six forms rows of the table above; section 3.1 says where the two counts differ, and the table above keeps the builders' per-round figures, which the re-count replaces. The builders' records also disagree with each other on details:""")

rep("""freezing builder's classification is used here). Appendix B lists the
changes.""", """freezing builder's classification is used here). Appendix B lists the
changes, with the rows the re-count added.""")

rep("""writer, read).

### 6.2 Review labour""", """writer, read).

§W What the second wave met: none of the seven needed a breaking change while porting. Each found between one and four gaps it recorded rather than worked around (cpp 3, kotlin 4, java 3, php 3, js 2, csharp 1, scala 2), and each listed between five and seven problems in the guide (40 in all); a reviewer then found the guide claiming a check of the accessor's receiver that did not exist. The guide writer's predictions held: java, kotlin and scala bind results to a type that lacks `deleted()`; csharp's stream takes its own cancellation token; php spelled its SDK file name inline and had a path-relative root import, which its port fixed. The guide corrections were recorded for its owner and not made, because the guide was read-only to the ports. Three ports could not pass their one command until a shared change was made (cpp's constructor through a template call, kotlin's and scala's false findings from the printed-call check), and four recorded classes as defects that only shared code could fix (csharp, java, cpp, kotlin); the integration made those changes.

### 6.2 Review labour""")

rep("""| 3.3 | openings decided: 70 by written rules, 19 carried, 14 by hand; ocaml's 38 stale records reworded or removed | builder |
""", """| 3.3 | openings decided: 70 by written rules, 19 carried, 14 by hand; ocaml's 38 stale records reworded or removed | builder |
| Catalogue shared edits | 752 classes opened in the thirteen languages by 11 changed sentences, all decided by 16 written rules applied to every language alike, 0 by hand | builder |
| Second wave | hand decisions per language at 3.4: tutorial 19 to 27, root 3 or 4, REFERENCE 55 to 115; hand records 194 (js) and 230 (java) at the port, of which 43 and 138 quote text; csharp 204 classes and scala 191 classified by hand at the port | porters, reviewers |
| 3.4 integration | every language's records re-keyed when the reference set grew to twenty (0 conflicts); the first run failed all twenty on the classes the shared changes opened, decided by written rules; java's one stale quotation re-quoted after a test was updated | integrating builder |
""")

rep("""were re-wrapped.

### 6.3 The review tools""", """were re-wrapped.

§W At 3.4 the self-test's fact controls failed (3) until their control pages were regenerated from the new clone, and java's one command failed on one stale quotation of the old stream sentence, which had survived only in a test the freeze then updated (integrating builder, ran).

### 6.3 The review tools""")

rep("""| Base for the last seven (that branch merged) | 266 | 0 (1 moved) | 1,723 s run alone; 2,926 s from the base copy on a busier machine |
""", """| Base for the last seven (that branch merged) | 266 | 0 (1 moved) | 1,723 s run alone; 2,926 s from the base copy on a busier machine |
| 3.4 | 285 | 0 (0 moved) | six batches of under 30 minutes each; the attacker's re-run at the frozen tools gave the same |
""")

rep("""builder, ran). The runtime table the porters follow was 1,312 lines at 3.3,
and regenerated identical at the base.""", """builder, ran). The runtime table the porters follow was 1,312 lines at 3.3,
and regenerated identical at the base. At 3.4 the shared guard is 2,740
lines and the twenty forms files 2,495 (mean 125; the seven new ones 855,
mean 122), and the guard and reader tests number 105 (measurer and
integrator, ran). The printed-call check reports 0 findings on NEW for all
twenty, after the integration taught it type arguments, casts and each
language's separators.""")

rep("""The rb pilot at version 3 took about a quarter hour of wall time, 4.3
minutes of it the suite (builder).""", """The rb pilot at version 3 took about a quarter hour of wall time, 4.3
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

§W Each was then reviewed, fixed and verified, which the records do not time. So a port took a porter from under an hour to about four hours, and needed three more people after it; the brief's "about half an hour" holds for none of the seven by its own record.""")

open(p, 'w').write(s)
print('ok')
