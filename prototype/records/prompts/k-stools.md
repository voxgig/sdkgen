# k-stools: make "the same sentence" something the tools can tell

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/sfix/`. Write nowhere else. `P/base32`, `P/sentences`
and `P/ports` are read-only.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md`,
`P/brief5.md`, `P/brief6.md`. Then `P/results/s3b-sentences.txt`
completely (the three reviewers' reports: their summaries, `pairs`,
`mask_claims`, `single_language`, and every fix entry that names the
tools). Then `P/base32/tools/README.md` and the tools' source
(`cut.js`, `facts.js`, `classify.js`, `ledger.js`, `sentences.js`,
`share.js`, `sharewords.js`, `rules.js`, `selftest.js`, `portcheck.sh`,
`summary.js`): about 3,200 lines in all.

```sh
mkdir -p P/sfix && cp -a P/base32/tools P/sfix/tools     # under git: commit as you go
# the clone and the output you measure on, both read-only:
#   P/base32/sdkgen   P/base32/out/old   P/base32/out/new
```

At the top of every shell: `export PATH=/opt/node24/bin:$PATH`.

## The job

Make the tools sound in the two ways brief 6 names, without losing a
single decision the nine languages' reviewers made.

1. **One template, one sentence.** Two units that shared code printed from
   the same template must get the same sentence id whatever each
   language's tokens are. The reviewers list what splits them today:
   printer output and member names left unmasked (`r.read`, `Direct()`,
   `sdk_direct()`, the `Control options (e.g. ...)` example); a fact
   printed in a comment without backticks; a value that carries its own
   backticks (rust's `Vec`); backticks inside or outside a mask; a mask
   label that changes when two facts have the same value (`nil` is go's
   `noError` and its `none`); a class name masked in different shapes; the
   article before a token ("a"/"an"); a number ("these 3 steps"); go's bold
   step lead (the splitter does not split after `.**`). Fix the mask and
   the splitter so that the identity of a sentence does not depend on any
   of these (keep the labels for display; they need not be part of the
   id).
2. **A token is masked because something supplied it there.** Today a
   shared word that equals an entity name, a field name or a fact value in
   the baseline model (`record`, `utility`, `id`, `fields`, `data`, `err`,
   `array`) is masked, so wrong wording in that place matches a reviewed
   sentence. Decide how the tools can know that a token came from the
   model or from a fact rather than from shared prose, and say why your
   way is sound. Ways to consider: where the token stands (a code span, an
   identifier position); whether the word at that place changes across the
   21 variations, whose models name different entities and fields; a
   second generation of one variation with its model's names changed. The
   test of your answer is a control: change one shared word that is masked
   today (for example "record" in "without one, every record is listed")
   on one language's generated page, and the changed unit must be left
   open, from scratch and in the reviewed mode.
3. **Leave out what is not a sentence of shared code**: the fixture
   model's own texts ("Level | percent see the guide ...", "Words the
   project chose | not the spec") are listed as reference sentences today.
4. **Re-key, losing nothing.** Class ids and sentence ids change with the
   mask. Write `tools/rekey.js`: for one language, map every record keyed
   by an id (the entries of `hand/<lang>.json`, its `absent` ids, the
   stage-3a rule records for that language, `counts/<lang>.json`,
   `purity-allow/<lang>.json` where keyed that way, `classes/<lang>.json`
   as generated) from the old id to the new one through the units the
   class is made of, not by guessing. Where several old classes merge into
   one new class, their decisions must agree or the class is listed for a
   person; where one old class splits, each part inherits the decision and
   is listed. Run it for the nine. The one command must then pass for all
   nine with the same decisions: produce the table of the freeze (per
   language and section: same, shared, rule records, by hand, missing,
   contradictions, and the block columns) before and after, and explain
   every number that moved. Four ports are under way (perl, swift, ocaml,
   lua) whose `hand/<lang>.json` is keyed by the old ids: the script must
   work for a language that is not in the reference set. Test that on a
   copy: `cp -a P/ports/lua/tools P/sfix/try-lua-tools` (copy it, never
   write there; if it has no `hand/lua.json` yet, say so and test with a
   reference language taken as if it were new).
5. **Carry the verdicts over.** `P/sentences/merged.json` holds a verdict
   for each of the 297 old ids. Map them onto the new sentences: a new
   sentence takes a verdict only if every old id that became it has the
   same one; a mix of `ok` with `awkward` or `false` takes the worse and
   keeps every note; write the result to `tools/reviewed/sentences.json`.
   Report how many distinct sentences there now are, by section, how many
   a single language prints, and for those how many are a note, how many
   shared code that one condition selects (the reviewers' classification
   is in their reports; re-derive it, do not copy it).
6. **Three smaller holes in the one command.**
   - It does not check that the clone's build is current: a failed build
     leaves the old one in place and the check passes on old code. Make it
     fail, naming the stale file, when a source file under `ts/src`,
     `ts/project/.sdk/src/cmp` or `ts/test` is newer than what the build
     made from it.
   - A hand record stays decided when the text its reason quotes has
     changed (the freeze found five). Make a record whose `why` quotes
     code tokens or page text fail as STALE when a quoted token is on
     neither the OLD nor the NEW page of that language nor in the clone.
     Say how many of the nine languages' records carry something
     checkable.
   - The prose measure "printed by this language alone" (`sharewords.js`)
     counts the splits above as a language's own prose. Recompute it on
     the new sentence identity and report both the old and the new figure
     per language, beside "by source".
7. **The self-test.** Every existing control still passes (record any you
   had to move, with the reason); add controls for each thing above: a
   shared word changed where it used to be masked; the same template in
   two languages giving one id; a bold step lead; a comment fact; the
   re-key round trip (re-keying twice changes nothing; a decision is never
   lost); the stale build; the stale hand record.

## What not to do

Do not change `P/base32`. Do not change the clone: if a tool cannot tell
something without a change to shared code (for example, shared code
marking where a model name is printed), record it as a request for the
shared engineer who works after you, with the smallest change that would
do, and make the tool work as well as it can without it. Do not weaken a
check to make a number pass: a control that fails after your change is a
finding.

## This job can be interrupted, and the machine is shared

Keep `P/sfix/TOOLS-PROGRESS.md` from your first step: one line per
finished step (with the tools commit), what you are in the middle of, each
decision with its reason. Commit in `P/sfix/tools` after each finished
step. If the file exists when you start, an earlier run was interrupted:
read it, check it against `git -C P/sfix/tools log` and `status`, discard
uncommitted changes it does not describe, re-run what you rely on, and
continue. Five other engineers work on this machine (4 CPUs, 15 GB): one
heavy command at a time; the self-test is heavy.

## What you report

For each numbered part: what you did, where (file, function), and what
shows it works (the command and its output). The before and after table
for the nine. The distinct-sentence counts before and after, by section,
and the single-language counts with their classification. Every decision
that could not be carried over by the script, with what you did about it.
The self-test's counts. What the four ports' engineers and the engineer
who merges them need to do with your script, in exact commands. Every
request for the shared engineer. What you did not get to. Separate what
you ran from what you read.
