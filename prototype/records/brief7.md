# Brief 7: the first four ports are in. Merge them, change shared code once, close the holes, freeze version 3.3

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Read `brief.md`, `brief3.md`, `brief4.md`, `brief5.md` and `brief6.md` first.

## Where things stand

- `P/base32` (read-only): version 3.2, nine languages ported (ts go py c zig
  clojure rust elixir rb), tag `v32-frozen`. Its guide is `PORTING.md`.
- `P/ports/{perl,swift,ocaml,lua}` (read-only): four ports made from that
  base by the guide, each then read by an independent reviewer, fixed, and
  verified. Each holds `sdkgen` (commits on `v32-frozen`, the language's own
  files only), `tools` (its hand records, keyed by version 3.2's ids) and
  `out`. The record of each: `P/results/s3b-{port,review,fix,verify}-<lang>.txt`.
  Everything those sixteen reports say must change outside a port is in one
  file, by language: `P/results/s3b-wave1-consolidated.md`. Read all of it.
- `P/sfix` (read-only): the round that answers the sentence review
  (brief 6), in three steps of which the later ones may still be running
  when you read this. `P/sfix/tools` tells what "the same sentence" is
  (one template, one id; a token masked only where something supplied it)
  and carries `rekey.js`; `P/sfix/sdkgen`, tag `v33s` when its second step
  is done, has each false sentence fixed once and the nine languages
  reviewed again; a third engineer then checks both. Its record, as each
  step finishes: `P/results/s3c-sfix-{tools,shared,verify}.txt`. If a file
  your instructions name is not there yet, that step is not finished: say
  so in your report and work from what exists.

## What the four ports showed

Each port was written from the guide in about half an hour, touched no
shared source file, and passed the one command with its own hand records.
No port needed a breaking change to the interface. Then the reviewers read
them, and found:

**Pages that were wrong although every check passed.**

- perl's root quick start no longer runs where its reader stands: the
  shared code prints imports without knowing which page they are for, so
  `use lib 'perl/lib'` was lost. perl's own example test adds that line
  itself and could not see it. The porter recorded the loss as "dropped".
- A shared helper picks a map-valued field to display; perl then prints
  `HASH(0x...)`.
- Shared sentences false for a runtime nobody had ported: lua's accessor
  returns a kept instance when called with nil ("Create a new instance" is
  false; php does the same); direct's `err` is unset for a non-2xx response;
  ocaml's `direct()` is not a call in OCaml, its `e_name` is a field and not
  something that returns, its client members are module functions under the
  heading "Instance functions".
- Things the old page said and the new one cannot: ocaml's `e_deleted`
  marker; the copy a match getter returns; that a stream honours
  `callopts.signal` in most runtimes although their operations cannot be
  cancelled.

**Checks that a wrong port passes.** Each of these was run:

- A declared value that differs from the value its citation pins passes
  the guard when the wrong token happens to stand in the quoted line
  (lua `okFalse: 'nil'`, ocaml `'false'` against `Bool false`).
- A constructor that does not exist (`sdk.create`), a call on the wrong
  receiver (`client.Planet()` for `client:Planet()`), a test call with an
  argument missing, a test signature written on an instance: the guard
  passes all four.
- An absence ("this runtime has no cancel") is searched in files the
  porter chose; in lua and ocaml the file left out is the one that holds
  the word.
- A shared sentence dropped from every page of a language passes the one
  command when the old page never had it; for a result style no reference
  language has (perl, swift), nothing moves at all.
- An enumerated fact with a wrong value (`prints`, `keys`, `entityBy`) is
  called attested.
- A naming rule hidden in a helper function passes purity.
- A type word the printer owns is checked only against the old page.

Almost every one of these was still caught, but only as an open class in
the comparison with the old page, which the porter then decides by hand.

## The rule this round adds

**What a porter can decide by hand is not a check.** The comparison with
the old page is a reading aid: it exists only for languages that had an old
page, and its verdict is the porter's own. So a wrong fact, a call the
runtime does not have, or a sentence that vanished must fail in the guard
or in the tools before any hand record is read, with a message naming it.
And where a page is wrong because shared code cannot say the true thing,
the port records a defect and stays failing until shared code can: it does
not record "dropped".

## What is decided

Shared code and the interface. All of these are additive: an optional fact
or member that existing providers need not declare. Each new fact gets its
account in the guard (derived where the guard can read it, cited
otherwise), and for each one **every ported runtime is read**, not only the
language that raised it, because a fact one port discovered is usually true
of others (the stream signal is in most runtimes; php caches as lua does).

1. **Imports know their place.** The scope carries the place (tutorial,
   root quick start, reference), the imports printer receives it, and the
   naming hook supplies the target's directory as a layout role. perl
   prints `use lib 'lib';` in its own README and `use lib 'perl/lib';` at
   the root again. Then the root quick start of every ported language with
   a toolchain here is run from the repository root of a generated SDK,
   once on OLD and once on NEW (rb's `require_relative` and php's
   `require_once` were named as worth the same look).
2. **The `top` note slot is printed** (it is declared and nothing prints
   it).
3. **The display field is a scalar**: string first, then integer, number or
   boolean; with none, the id alone.
4. **`accessor.cached`** (optional, cited): where set, the accessor
   sentence says what a call with no options returns. One sentence, written
   once.
5. **direct's `err`**: the sentence fixed in `P/sfix` is checked against
   the four new runtimes; where runtimes differ it is a fact, not a
   sentence.
6. **`streamSignal`** (optional, cited): the sentence about
   `callopts.signal` leaves the cancel paragraph and prints on its own
   fact. `cancel` then speaks of operations only.
7. **`copy` on a match getter** prints as it does on a data getter.
8. **How prose names a member** (optional): called (`direct()`, the
   default) or bare (`direct`).
9. **A member that is a field** (optional flag): "The entity name."
   rather than "Return the entity name."
10. **The heading over the client's members follows what they are called
    on** (instance, type, module): settle it together with what `P/sfix`
    decided for c, clojure and elixir, so that there is one rule.
11. **The deleted mark** (optional fact: how the page reads it): the shared
    remove sentence names it where declared. The survey's readers found,
    in every runtime they read, that a removed entity's data is replaced
    by the response's record when the response carries one and kept only
    when it carries none (the runtimes' own comments say "keeps the data
    it held", which is half true). So no page may say "keeps its data":
    the sentence says what is true of every runtime, once, or says nothing
    about the data.
12. **The wrapped result style** names its unwrap in the sentences only
    swift prints, so swift's record fact can be the plain accessor again.
13. **"A copy" is a fact for every getter, the utility getter included.**
    Today the member kind chooses the word (`utility` says "Return a copy
    of the SDK utility object", `utilityBase` does not), and ts declares
    `utility`. The survey found that ts and js return the live object:
    `struct.clone` hands a class instance back by reference
    (`tm/ts/src/utility/StructUtility.ts:752`; run in node on the vendored
    js copy, `clone(instance) === instance` is true), and that elixir
    returns its live node, while go, c, py, rb, php, perl and lua return a
    shallow copy. The sentence follows a cited `copy` fact, as it does for
    the options getter. Note what this shows about citations: a quoted
    `clone(...)` call is not proof of a copy. Where a getter's copy rests
    on `struct.clone` of something that is not plain data, the provider
    declares what the caller really gets.

14. **A sentence that names a call names one that compiles.** The
    tutorial and the reference say `list()` where the match is optional;
    in a language without default arguments (swift) the call is
    `list(nil, nil)`, as its old page said. The call a sentence names is
    printed from the operation's facts (its name, the none value, its
    parameter count), not written as `name()`.

The survey (`P/results/s3c-survey.md`) also reports things about the
runtimes that no decision above covers and that the old and new pages
state or imply wrongly: the accessor's argument is the entity options in
every runtime although several name it `data`, and the constructor writes
`active` into the caller's map; without the test feature the test
constructor of ts and js throws, and everywhere else builds a client whose
every request is refused with `fetch_mode_block`; `direct` never uses its
own error channel in go and c; a 2xx response whose body is not JSON gives
`ok` false in several runtimes. The shared engineer reads the whole survey
and decides each: a sentence to correct, a fact to add, or a defect of a
runtime to record (and not to hide in prose).

Not decided here, for the engineer who meets it, with the reason given:
whether ocaml's signatures move to the runtime's own arrow notation once
the guard can tell a call from a field in it (item G5), and whether
operation parameter names may be cited from a generator template.

The guard (it must fail, naming the fact, in each case the reviewers ran):

- G1. A citation that pins `value:` is compared with the declared value,
  always.
- G2. The constructor the naming hook gives exists on what it is called
  on, and its binding is the one the imports printer binds; the receiver
  form the call printer prints agrees with `on`.
- G3. A printed constructor or test call passes as many arguments as its
  signature declares, and so does the call the provider's printer makes
  for each operation (swift's `load(nil)` against two parameters with no
  default passed).
- G4. `on` is read from the signature's receiver as well as from the call.
- G5. A forms file can say how a call is told from a field in the
  runtime's own notation (ocaml's arrows), so that using that notation
  does not switch the check off.
- G6. An absence is searched over the language's whole runtime (its
  component and template trees, tests apart). An exclusion is a quoted
  region with a reason, never a file left out.
- G7. Type words: where the generator has the language's type words
  (`canonToType`), the provider's are compared with them; where it has
  none, say so in the account, as a kind of its own that the reviewer
  audits.
- G8. The record expression is checked whole: every member and type it
  names exists in the runtime, and an unwrap in it is the cited unwrap
  fact, not any substring of its quote (swift's record with the cast
  dropped passed).

The tools:

- T1. An absent-list entry with no reason fails.
- T2. A language whose result style no reference shares still has an
  absent list: the sentences every reference prints whatever its style.
- T3. Purity reads the helper functions a provider or a hook defines.
- T4. An enumerated fact is judged by the sentences its value selects, or
  is reported as not judged; it is never called attested by the mere
  presence of some pair.
- T5. Block pairing works for headings without parentheses; the screen
  names a changed normalizer count; lua's printing helpers are known to
  purity; a generation that throws fails the one command (today the pipe
  drops its exit code, the screen says "regenerated 0 variations" and the
  numbers are taken from the pages of the run before).
- T6. Whatever the independent check of `P/sfix` requires
  (`P/results/s3c-sfix-verify.txt`).

One lane: perl's example test (`ReadmeExamplesTest_perl.ts`, a generator
component of perl's own) stops adding the import to a block that has one,
and runs each block from the directory its page addresses. It is the
reason a page that does not run passed.

## Who does what

The sentence round (`P/sfix`) is still running while this one starts, so
the work is laid out to wait for it only where it must:

1. **merge of the ports** (`P/v33p/`): the four ports and their records on
   the version 3.2 base, nothing else changed; thirteen languages on one
   clone, tag `v33p`. It still has version 3.2's sentences and tools.
2. **survey** (`P/survey/`, written up in `P/results/s3c-survey.md`): ten
   readers, two runtimes each, twelve questions about what every runtime
   does (the accessor's cache, the stream's signal, copies, the deleted
   mark, what each thing is called on, direct's result, the test
   constructor without the test feature, `explain`, imports). It is one
   reading of the twenty runtimes; the guard engineer makes another
   without seeing it, and where the two differ the runtime decides.
3. Three engineers, each in their own files:
   - **guard** (`P/n-guard/`, from `v33p`): `ts/test/runtimefacts.test.ts`,
     `ts/test/runtimereader.test.ts`, `ts/test/runtimeforms/**`: G1 to G7.
   - **tools** (`P/n-tools/`, from the tools of `P/sfix`, with the four
     ports' records brought in and re-keyed): T1 to T6.
   - **shared** (`P/n-shared/`, from `P/sfix/sdkgen` at tag `v33s`, once
     the sentence round has frozen it, with the four ports brought onto
     it): `ts/src/**` and `ts/project/.sdk/src/cmp/**`: the numbered
     decisions, the perl lane, and the providers that must declare the new
     facts.
4. **freeze** (`P/v33/`): the three merged; the guard meets the new
   facts; thirteen languages reviewed again and passing; every attack the
   reviewers ran and nothing caught now fails; tag `v33-frozen`.
5. **base** (`P/base33/`): the base and the guide (version 3.3) the last
   seven ports start from (js php csharp java kotlin scala cpp), with
   every guide problem the four porters met corrected.

Commit messages name no tool and no model, and carry no trailer of any
kind (one fixer's commits carry one: it is dropped when the commit is
brought over).
