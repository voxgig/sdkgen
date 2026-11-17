p = '/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/record3/model-dependent-text-prototype.md'
s = open(p).read()


def rep(a, b):
    global s
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)


# 5.1
rep("""operation runs; what remove leaves), a declared fact is needed.

### 5.2 A declared fact needs a check, and an account is not one""", """operation runs; what remove leaves), a declared fact is needed.

§W At twenty languages the same pattern again, each found by a reviewer, a verifier or the attacker of the last wave:

§W - The `secrets` sentence of the verdict: written once from the feature model's hook declaration, false in 17 of 20 runtimes, passed by every check (attacker, read in all twenty).
§W - The stream sentence named its key as `callopts.signal`, TypeScript's notation, in every language; in C#, Kotlin, py, rb or lua the key is not written that way, and each runtime reads only one or two forms of the signal and silently ignores any other value, which the page did not say (csharp and kotlin reviewers, read). The integration put the key in words and added an optional fact for the form; only kotlin and csharp declare it.
§W - The remove sentence ("`data()` reads its record") is false for cpp, whose remove keeps the data the entity held and takes only the match from the response; the guide had said every runtime replaces the data (cpp reviewer, read; fixer, ran). Fixed at the integration by an optional fact.
§W - A shared naming decision, one name for the list item and the entity loaded after it, does not compile under C#'s whole-block scope (section 3.4). Fixed at the integration by an optional language fact.
§W - java's deleted read names a class (`EntityBase`) that no page imports (java porter and reviewer, ran). Fixed at the integration by filling the package into the read.
§W - The feature Usage sentence prints the option key in bracket notation, which is not code in six of the typed languages (attacker, read). Recorded as awkward, not changed.
§W - The unported README sections still say what the REFERENCE now corrects: "On error, `ok` is `false` and `err` contains the error value" stands in 12 languages' README components, and a readable non-2xx response sets no `err` (kotlin verifier, read).

§W Each correction is one change for every language, which is the proposal working. Each was also found only by a person reading one runtime, which is the cost the proposal did not state.

### 5.2 A declared fact needs a check, and an account is not one""")

# 5.2 table row
rep("""| 3.3 | 97 of 108 (5 not caught, the rest errors as before); 31 of 37 recorded attacks; 14 of 14 new attacks | freezing builder, ran |
""", """| 3.3 | 97 of 108 (5 not caught, the rest errors as before); 31 of 37 recorded attacks; 14 of 14 new attacks | freezing builder, ran |
| 3.4 | the old sets: 49 of 59 and 94 of 108, v33's result (one more caught because a php provider copy now builds); on the seven new providers, a printed method the runtime lacks and a dropped member caught in all seven, a wrong fact whose citation was moved to a real line holding the new token caught in none | attacker, ran |
""")

rep("""as "ahead of a provider"; a missing field flag was never checked. Each was
closed when found.""", """as "ahead of a provider"; a missing field flag was never checked. Each was
closed when found.

§W The last wave found the largest such defect. The guard's check of the entity accessor call looked up the accessor's declaration through a function that rewrote its token (the dollar-brace placeholder gained a second dollar sign), found nothing, and skipped the check without a word, in six languages: php, elixir, java, kotlin, scala and cpp. Every freeze before 3.4 passed while those six languages' accessor calls were never judged for arity, receiver or separator (the php fixer and the cpp reviewer found it; the integration fixed it, with a control). A related limit stays: where instance and type calls share the `.` separator (java, kotlin, scala, csharp), neither the guard nor the printed-call check tells `DemoSDK.planet(...)` from `client.planet(...)`, which javac rejects; recorded, not made.

§W What the attacker showed at the frozen state, beyond the stage-7 rule (each ran): leaving out an optional fact, declaration and citation together, passes the guard (105 of 105) and the one command for the stream signal in csharp, java, kotlin and scala and the deleted mark in js, and the true sentence vanishes from every page; leaving out php's cached accessor or cpp's remove that keeps its data brings back a sentence known to be false for that runtime, shown only by one open class for a person. A wrong fact whose citation is moved to a real runtime line that happens to hold the new token passes the guard in all seven new languages. A code-valued citation without a value pin passes any wrong value whose tokens stand in the quote (csharp's verifier showed the pin closes it; java, kotlin and scala still lack pins). A forms file can declare that its language writes calls without parentheses, which makes the constructor check pass vacuously (cpp verifier). Removing a getter's copy fact with its citation, then giving one false reason for the sentence that vanishes, makes the one command pass (php verifier). And three of the integration's own changes have no test that fails without them: the layout fill of the deleted read, the rule that a declared call factory occurs in the runtime, and the csharp and java citation pins.""")

rep("""member the runtime does not have (guide writer, read; recorded in the guide,
not yet corrected in the forms).""", """member the runtime does not have (guide writer, read; recorded in the guide,
not yet corrected in the forms). The second wave's porters met all three and
corrected the forms, and found more: public client fields the table omits
(php, java, csharp), private and protected cpp members it shows as
callable, a csharp parameter reader that named every defaulted parameter
after its default value, a deleted mark declared only on a base class the
examples' type cannot reach (java, kotlin, scala), and stream signals
honoured in one form only.""")

# 5.3
rep("""At the base, 81 of the 312 distinct sentences the thirteen print have no
verdict in the reviewed set for that reason (section 3.1).""", """At the base, 81 of the 312 distinct sentences the thirteen print have no
verdict in the reviewed set for that reason (section 3.1). At twenty, 164 of
385 distinct sentences have none: 128 printed only by the eleven languages
ported after the nine reference languages, and 36 changed or re-masked
since the review (measurer, ran). Growing the reference set from nine
languages to twenty moved every class id, so every language's hand records
had to be re-keyed at the integration (0 conflicts, no entry lost), and
larger result-style groups produced new lists of sentences absent in one
language.""")

# 5.4
rep("""This is the reason for the stage-7 rule (section 2.2). At 3.3 the guard
and tools catch most of the first-wave attacks without the comparison;
appendix C lists what they still do not.""", """This is the reason for the stage-7 rule (section 2.2). At 3.3 the guard
and tools catch most of the first-wave attacks without the comparison;
appendix C lists what they still do not.

§W In the second wave the comparison was again where many attacks surfaced. The reviewers ran between 26 and 37 attacks per language, and in each language some failed only as open classes that a porter decides by hand (7 of 33 runs in cpp, 7 of 37 in csharp, 7 of 26 in java, 14 of 31 in scala, and in js and kotlin every attack that did not change a declared value). Two cases show how much rests on a person. csharp's five root quick starts that do not compile were held failing only by the porter's honest defect records: the verifier relabelled three records and deleted one, and the one command printed PASS with the five blocks still on the pages. And the integration accepted the catalogue round's changed sentences for the seven new languages by written rules that matched the text, not by reading the runtimes; the false `secrets` line went through that way.""")

# 5.6
rep("""root READMEs at once (stages 4 and 5). At 3.3 one contradiction remains in
each of the thirteen: the unported README test-mode section promises a mock
without the test feature (true side: the REFERENCE).""", """root READMEs at once (stages 4 and 5). At 3.3 one contradiction remains in
each of the thirteen: the unported README test-mode section promises a mock
without the test feature (true side: the REFERENCE).

§W At twenty the same contradiction is recorded in nineteen languages (clojure has none), and more are recorded where an unported README section states what the ported REFERENCE corrects: php 5 (among them the accessor said to create a new instance and `err` said to be set on any error), kotlin 3 and js 2 (the direct paragraph's `err`), by the integrator's one-command runs. The ts and js README rows that called the utility getter a deep copy were corrected at the integration; the js README's unported "Module structure" section still prints `require` beside the ES `import` of its tutorial. One reviewer found cpp's record of the test-mode contradiction wrongly recorded as the same meaning; it was corrected, and the fixer ran the README's own test-mode block, which throws.""")

open(p, 'w').write(s)
print('ok')
