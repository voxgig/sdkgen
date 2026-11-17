# v32: where the three reports meet, and what is already decided

Read after `P/prompts/i-final.md` and the three results
(`P/results/s3fix2-{shared,guard,tools}.txt`). Two engineers read the same
twenty runtimes without seeing each other's work. Where they agree, that is
a check that passed. Where they differ, settle it from the runtime (file and
line) and report it; the points below are the ones already visible, with the
decision where one is made. Expect others.

## 1. The `ok` literal

The shared engineer removed `lits` and added the required fact
`ref.facts.direct.okFalse` (only the failure literal is printed). The guard
engineer cited `ref.facts.lits.true` and `lits.false` ahead of the
declaration. Decision: the fact is `direct.okFalse`, category **cited**, the
value's token required in the quote. Move the guard's `lits.false` citations
to it and drop `lits.true` (nothing prints it). Both lists give `false` for
eight languages and `False` for py: confirm each against the quoted line.

## 2. Streams

The shared engineer found that "as they arrive" was false of every runtime
(every streaming feature yields from a response already read whole), made
each stream kind state only what is returned, and added the required fact
`Member.runs` (`iterate`, `call`, `background`): when the operation runs.
The guard engineer recorded, per runtime, a stream record of three quotes
(`forms.stream`: when the operation runs, when items are drawn) and marked
clojure's and elixir's kind `streamLazy` as `WRONG:` because every item is
read before the call returns, and said swift needs a kind.

Decision: the shared engineer's model stands. A kind names what the call
returns; `runs` says when the operation runs; **no sentence says when items
arrive.** Then:

- `runs` is **derived**: the guard compares the provider's `runs` with what
  the forms' stream record gives. Compare the two engineers' tables for all
  twenty first (they agree on ts, py, rb, go, c, zig, rust, clojure and
  elixir as far as the reports show; check each) and report differences.
- Re-point the guard's `streamItems` check at what the sentences now say:
  for every kind sentence in `ReadmeRef.ts`, is it true of every runtime
  that declares that kind? "A lazy sequence" for a value whose items were
  all read before the call returned is true of the type and misleading
  about the read; with "the operation runs at the call" beside it, decide
  whether a reader is misled, and if so change the sentence once (the
  word, not the model). Then drop the `WRONG:` exceptions that no longer
  apply and keep any that do.
- ocaml: the two disagree on its kind (`streamLazy` or `streamSync`). It is
  unported: put both readings and the lines in the guide's row and let the
  porter settle it against the new sentences.

## 3. New required facts need their accounts

From the shared engineer's `needs_from_guard`: `ref.facts.direct.okFalse`
(cited), `ref.facts.direct.abortCode` (cited), `facts.noError` (cited),
`facts.pairForm` (cited: go's was a default before), `ref.facts.setArg` for
c and zig (cited), `ref.facts.accessor.param` (derived: the accessor
signature's parameter name, which the forms already read),
`ref.facts.(client|entity)[n].runs` (derived, as above). The elixir note
pins move to the new note text; the citation for the removed note goes.
None of these may land in `language` or `convention`.

## 4. What the guard found that the provider must change

- c: the runtime has `sdk_options_map` and `sdk_get_utility`
  (`tm/c/core/utility.c:70,72`, `sdk.h:477-478`) and c's REFERENCE documents
  neither. Declare them as client members; drop the `members:*` exceptions.
  Look at what OLD c printed for them and classify the new units by hand.
- "Return a deep copy" (options) and "Return a copy of the entity options"
  (entopts) rest on no fact. Either give those members a cited `copy` fact
  in the nine providers, as the data getter has, or stop the sentence
  saying "copy" where nothing shows it.
- The elixir arity notes: already removed by the shared engineer; the
  guard's `WRONG:` exceptions for them go.

## 5. Left open by the shared engineer

- `testopts` and `sdkopts` in the test-constructor sentence are literals in
  shared prose; zig's runtime spells them `testopts_in` and `sdkopts_in`
  while zig's declared signature says `testopts`. Print the names from the
  declared signature, and make sure the guard's parameter-name check
  compares that signature with the runtime (if a rename hides it, the
  rename needs its reason or the signature its fix).
- `ReadmeRefFeatures.ts` prints `active: false` and
  `feature.<name>.active` to true in TypeScript form for all twenty
  languages. Do not change it now (the eleven unported pages must stay
  identical); record it in your report as work for the integration, when
  every language has a provider to supply the literal.
- The cancel paragraph is a shared sentence only one ported runtime prints.
  Leave it; count it.

## 6. Citations

Three still do not show their value (py and rb `direct.returns`, ts
`prepare.returns`): either the declared value changes to what a line of the
runtime shows, or the citation is marked as pinned prose. No citation may
claim to show what it does not. The narrower `unquoted` rule (refused within
three lines of a quote, with the count of runtime files holding the token
printed in the report) is accepted; say so in the guide and tell the
reviewer to read each excused token.

## 7. The count that crossed its line

The shared engineer counts 8 more breaking interface changes (about 19 to
21 since the first four languages, against a line of about 10): each turned
a value shared code used to supply into a fact a provider must declare. The
guard engineer counts 3 breaking changes of the forms framework. Report
both counts as they are, and separately how many were caused by a newly
ported language (so far: none). Do not soften it: H1's line on interface
changes is crossed twice over, and the eleven ports to come are what will
show whether the interface has now stopped moving.

## 8. The guide

Everything a porter must now declare goes into the guide with one line each
and where its value is read from: `direct.okFalse` (perl: `0`),
`accessor.param`, `runs` on the stream member, `setArg` where data or match
take an argument, `pairForm` and `noError` for the pair style (lua),
`abortCode` with `direct.signal`; that shared code now throws instead of
guessing a member name, an entity name or a naming hook; the checked-example
rule by result style (which styles get a check, and what the provider's
`attempt` and `call` printers are handed); and on the guard's side the test
constructor, the stream record, the `failure` record, `on`, `field`,
`expect`, the absence citation, and the rule for `unquoted`.

## 9. What the tools engineer leaves for you

- **16 language or convention facts are unattested at the frozen state**
  (`findings_at_frozen_state` in the tools report), so the one command
  fails for seven of the nine until each is decided. Several leave the list
  by themselves once the guard's categories land (`none` and the `ok`
  literal are cited, so the guard checks them and attestation no longer
  applies). Decide every one that remains by hand, with what shows it is
  right: c, clojure and elixir `noun` 'Functions' where the old page had no
  such heading; clojure `heading` (the old page said 'Client', the new one
  `sdk.api`); go and c `errVar`; clojure `valueType.OBJECT`. A value the
  old page contradicts is either a correction of the old page (say what
  was wrong there) or a mistake in the provider (fix it).
- **A sentence go prints less often than its reference**: from scratch, go
  lacks "The server URL is templated, so `server` must give `tenant`;
  `region` defaults to `eu`." in the `auth-off` variation, where ts prints
  it. Find out whether go's page drops a sentence it should print, and fix
  the source if so.
- **The absent lists** (zig 12, rust 12, clojure 1, rb 1): sentences every
  other language of the same result style prints and this one does not.
  Explain or fix each. rb's is "Returns a `list` of entities" against rb's
  "an `Array`": if only the article differs, shared code is saying one
  thing two ways; say which.
- The tools name the `ok` literal `ref.lits.false` in places (the fact
  labels, the control `py ... lits`): follow the rename to `direct.okFalse`
  through the tools and their controls, and re-run the self-test.
- clojure's purity-allow record is keyed on the old, concatenated text of
  a note that is now one string (the shared engineer's `needs_from_guard`,
  last entry): re-key it; the decision and its reason stand. The tools
  accept a note written as several literals joined by `+`; the shared
  engineer made every note one plain string, so make the lint require that.
- The control hand files under `controls/factmut/hand/` are for the
  controls only and are never copied into `hand/`.
- 288 distinct shared sentences exist, 234 of them accepted only by rule
  records nobody re-read. Their review happens after you, by someone else,
  from `P/base32`: make sure `node tools/sentences.js` runs from the base
  and that `reviewed/sentences.json` is the only file that review writes.
  Report the count again at `v32-frozen` (the shared engineer changed
  sentences).
