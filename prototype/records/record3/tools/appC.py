p = '/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/record3/model-dependent-text-prototype.md'
s = open(p).read()


def rep(a, b):
    global s
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)


rep("""## Appendix C. Attacks that nothing mechanical catches at 3.3

From the freezing builder's re-run of every attack at `v33-frozen`, the
tools records and the H3 check. "Caught by" says what, if anything, fails.
""", """## Appendix C. Attacks that nothing mechanical catches

§W The first table is from the freezing builder's re-run of every attack at `v33-frozen`, the tools records and the H3 check. The attacker of the frozen state re-ran the old mutation sets at `v34-frozen` and got the same result (49 of 59 and 94 of 108 caught by the guard, one more in the second set because a php provider copy now builds), so those rows still stand, except where a row says the integration closed it. The second table is what the last wave's reviewers, verifiers and attacker found at 3.4. "Caught by" says what, if anything, fails; "a hand decision" means only an open class that a person decides.

### At 3.3
""")

s = s.rstrip('\n') + """

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
"""
open(p, 'w').write(s)
print('ok')
