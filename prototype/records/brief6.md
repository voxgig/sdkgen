# Brief 6: what the sentence review found, and the fix round it starts

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Read `brief.md`, `brief3.md`, `brief4.md` and `brief5.md` first.

## Where things stand

Version 3.2 is frozen (`P/base32`, tag `v32-frozen`, read-only): nine
languages (ts go py c zig clojure rust elixir rb) print their README
tutorial, the root quick start and their REFERENCE page from shared code
and one provider each. Four more (perl, swift, ocaml, lua) are being ported
from that base right now, each in its own workspace under `P/ports/`, by
engineers who touch only their language's files. Seven follow.

The design says a sentence is written once and reviewed once. Until now
most shared sentences had been accepted by pattern rules and never read.
Three reviewers have now read all 297 distinct sentences against the
runtimes. Their full reports are `P/results/s3b-sentences.txt` (read all of
it: it is the input of this round); their verdicts, merged, are
`P/sentences/merged.json` (248 ok, 35 awkward, 14 false).

## What they found

**False sentences (14 ids, six distinct sentences).**

1. "The client reads its API key from the `X` environment variable." No
   client reads the environment; the example does, and passes the value.
   The shared code introduced this sentence; no old page said it. Eight
   rule records accepted it unread.
2. direct's Returns: "... even for a non-2xx response; on a failure `ok` is
   false and `err` holds the error." A readable non-2xx response has no
   `err`. The old wording was right. The literal `err` also reads, in go
   and c, as the error variable of the signature, which direct never sets.
3. The control example `explain: true`: the runtimes take a map there; py,
   clojure and elixir ignore `true`, and ts is reported to throw. This one
   was wrong on the old pages too.
4. Without the test feature, "It returns a client in test mode" and "it has
   no mock transport" are reported false for ts: its `makeFeature` has no
   fallback, so `test()` throws. Read, not run.
5. "An action returns that action's OWN response": an action is a create
   call, and create returns the entity. Old wording, kept.

**Awkward sentences (35 ids)**, each with a better wording in the reports;
several are one template counted more than once.

**Per-language defects the review met on the way:** c's page says to branch
on `getp(result, "ok")`, a pointer that is always true when the key is
there; elixir's list heading shows a signature that is not the
declaration; clojure's "lazy sequence" over items already read; zig's
action Call cell shows an unclosed `switch`; c's Call cell uses variables
nothing declares; rust's page breaks a code span across two lines; a rust
note and a zig note restate what shared code says for the other styles;
the heading "Instance Functions" for c, clojure and elixir, whose members
are module functions taking the client.

**The matching itself is unsound in two ways**, and this matters more than
any one sentence:

- *The mask hides shared words.* A word of shared prose that happens to
  equal an entity name, a field name or a fact's value in the model the
  tools run on (`record`, `utility`, `id`, `fields`, `data`, `err`,
  `array`) is masked as if a language had supplied it. A wrong word in
  that place would match a reviewed sentence.
- *One shared sentence is counted as many.* Printer output, member names,
  facts printed in comments without backticks, backticks inside or outside
  a mask, a mask label that depends on two facts having the same value,
  the article before a token, a number, go's bold step lead: each splits
  one template into several "distinct" sentences, most of them listed as
  printed by one language alone. 178 of the 297 entries name one language;
  the reviewers judge that 9 of those are a runtime's own fact, 1 is old
  wording that survived, about 80 are shared code that one condition
  selects, and the rest are this artefact. So a verdict given to one copy
  does not cover the others, and "printed by this language alone" (go
  22.6% at the freeze) overstates.

## The rule this round adds

**A sentence is reviewed once only if the tools can tell what "the same
sentence" is.** So:

- one template of shared code is one sentence, whatever each language's
  tokens are, and it has one verdict;
- a token is masked because a language or the model supplied it at that
  place, never because a word happens to equal one;
- a sentence a reviewer called false is fixed in shared code, once, and the
  new sentence is true of all twenty runtimes, the unported ones included
  (their ports will print it);
- a changed sentence has no verdict until someone other than its author
  has read it.

## Who does what

- **tools** (`P/sfix/tools`, a copy of `P/base32/tools`): sound masking and
  splitting, a re-key of every record that is keyed by a class or sentence
  id (for the nine reference languages, and as a script the four ports
  under way will be run through), the verdicts carried over, and three
  smaller holes in the one command.
- **shared** (`P/sfix/sdkgen`, a copy of `P/base32/sdkgen`, after the tools
  engineer): each false sentence checked against the runtimes (run where
  it can be run) and fixed once; the awkward ones decided; the
  per-language defects fixed in their providers; the nine languages
  reviewed again with the new tools; frozen at one commit.
- **verify**: an independent reader of every changed sentence and an
  adversary of the new matching.

After this round and the four ports, one engineer merges both into the
base the last seven ports start from.
