p = '/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/record3/model-dependent-text-prototype.md'
s = open(p).read()


def rep(a, b):
    global s
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)


rep("""- **Five of thirteen languages were never compiled.** clojure, elixir,
  swift, ocaml and lua examples were checked by structure and by reading.
  csharp, kotlin and scala will be in the same position.""", """§W - **Seven of twenty languages were never compiled.** csharp, scala, swift, lua, clojure, elixir and ocaml examples were checked by structure and by reading. Two failures in that group (csharp's duplicate local, scala's comparison with a primitive) were found by reading, which also means others may have been missed. kotlin was compiled only through a compiler found in gradle's offline cache.""")

rep("""- **The checks were attacked by the same team.** The checkers and verifiers
  were independent of each build but drew on the same records; the attack
  sets grew from what earlier attacks found.
- **Thirteen is not twenty.** The interface has needed new facts at every
  wave; the seven remaining languages include the statically typed
  JVM and .NET runtimes, whose old pages already said "raise" where the
  runtime throws.""", """§W - **The checks were attacked by the same team.** The checkers, verifiers, the measurer and the attacker were independent of each build but drew on the same records and tools; the attack sets grew from what earlier attacks found. The last attack still found a false sentence every earlier check had passed, which says the attacks were not exhausted.
§W - **The checks cannot see what is not declared.** The guard checks declared facts against the runtime. A fact a porter leaves out, a sentence shared code writes from a model fact, and a citation that holds the right token on an unrelated line all pass it (section 5.2). The H3 checks look for the old defects in words, not for new ones.
§W - **Twenty languages are not every language.** Each wave of runtimes needed new facts (the second wave five optional ones); a language added later, or the pack's dart, haskell and lean if ported, should be expected to need more.""")

rep("""- **Which projects lack a copy record is not known.** The unsafe H5 states
  all start from a copy the record does not hold as unchanged; how common
  that is among real projects was not measured.""", """- **Which projects lack a copy record is not known.** The unsafe H5 states
  all start from a copy the record does not hold as unchanged; how common
  that is among real projects was not measured.
§W - **The final migration state was partly rebuilt.** At twenty the earlier H5 fixtures and builds had been deleted; the measurer rebuilt the fixtures from their descriptions (one of them, a project-owned target, as an approximation), and states that need a release build were not re-run.
§W - **Some of the twenty-language evidence was read through digests.** The integrator read the 28 reports of the second wave through a digest and targeted look-ups, as its report says; the measurer and the attacker read the integration's report in full and re-ran its checks.""")

open(p, 'w').write(s)
print('ok')
