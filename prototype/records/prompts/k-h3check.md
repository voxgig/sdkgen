# k-h3check: an independent check of the H3 measurement

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/h3check/`. Write nowhere else. Everything else under
`P` is read-only (`P/h3` included), and so is everything under
`/home/user`.

Read first: `P/brief.md` (the proposal and the hypotheses; H3 is the one
checked here), then `P/prompts/k-h3.md` (what the engineer before you was
asked to do: the scope rule, the classes, the counting rules), then the
catalogue `/home/user/sdkgen/docs/design/model-dependent-text-issues.md`.
The engineer's report is given below this file's text in your
instructions, and their working directory is `P/h3` (`PROGRESS.md`,
`issuecheck33.js`, `out/`, their clone `P/h3/sdkgen` at the tag
`v33-frozen`). Their report is a claim.

Your PATH, at the top of every shell: `export PATH=/opt/node24/bin:$PATH`.

## The job

You are trying to show the measurement is wrong. A number that survives
you is worth having; one that does not is worth more.

1. **Scope, blind first.** Before you read their scope table, judge these
   entries yourself by the scope rule of `k-h3.md`, from each entry's
   Where and the source at `main` (`git -C P/h3/sdkgen show 9aebaf9e:<path>`):
   every entry whose number ends in 3 or 7 in each catalogue section (S03,
   S07, S13, ... U103, U107, ...), which is about 60. Then compare with
   theirs and list every disagreement, with the file that decides it.
   Then read every entry they marked `no` whose text names README,
   REFERENCE, a quick start, a tutorial, a constructor table or an
   example, and say whether any belongs in scope.

2. **Every `once`, attacked.** For each entry they class `once`: read the
   thirteen ported languages' own files (`Syntax_<lang>.ts`,
   `Naming_<lang>.ts`, and the forms under `ts/test/runtimeforms/`) for a
   line that exists because of this issue: a fact only this issue needs, a
   note that says what shared prose should have said, a printer that
   branches on something the model decides. `git -C P/h3/sdkgen log -S`
   helps. One such line moves the entry to `per-language`. Also open the
   shared line they cite and check it reads the model there.

3. **Every check, attacked.** Copy their command and its `out` pages into
   your directory. For each check that reports NEW clean: (a) is it true
   on OLD for some language (can it fail at all)? (b) read the NEW page of
   three ported languages they did not quote, one of them from perl,
   swift, ocaml, lua: does the page say the wrong thing in other words, or
   say nothing where it should say the right thing (a defect "fixed" by
   deleting the sentence is not fixed if the reader still needs the
   fact)? (c) for five checks of your choice, edit a copy of a NEW page to
   put the defect back in different words, and see whether the check
   fires.

4. **The numbers, recomputed** from your corrected table: per entry and
   per distinct defect, strict and lenient, with `not fixed` counted on
   each side. Say which side of H3's line (about 10%) each reading falls
   on, and which reading the hypothesis as written in `P/brief.md` calls
   for.

5. **What the measurement cannot show.** List it: entries only read;
   languages with no compiler here whose examples changed; the seven
   unported.

Keep `P/h3check/PROGRESS.md` from your first step; if it exists when you
start, continue from it. The machine is shared (4 CPUs, 15 GB): you need
no heavy command.

## What you report

Scope disagreements (yours blind, theirs, what decides it). Each `once`
you moved, with the line. Each check that can be fooled or cannot fail,
with what you did. The recomputed numbers beside theirs. Your verdict on
H3: confirmed, refuted or not decided, and how sure. What you did not get
to. Separate what you ran from what you read.
