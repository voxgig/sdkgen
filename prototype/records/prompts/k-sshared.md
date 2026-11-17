# k-sshared: fix each false sentence once, and review the nine again

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/sfix/`. Write nowhere else. `P/base32`,
`P/sentences` and `P/ports` are read-only.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md`,
`P/brief5.md`, `P/brief6.md`. Then `P/results/s3b-sentences.txt`
completely: the three reviewers' reports are your work list
(`false_sentences`, `fixes`, `awkward`, `pairs`, `mask_claims`). Then
`P/base32/PORTING.md` (the guide of version 3.2: sections 2, 5, 6 and 10
are how you work, section 11 the baselines you are compared with), and the
last freeze's record `P/results/s3fix2-final.txt` with its scripts in
`P/v32` (`mine/lanes.sh`, `mine/unported.py`, `mine/pcall.sh`,
`mine/apply.py`, `dec/`).

While the tools engineer worked, ten other readers went through the
twenty runtimes, two each, with twelve questions, several of which are
yours: what `direct` returns in four cases, what the test constructor does
without the test feature, what `explain` takes, what an action returns.
Their answers, with file and line, are in `P/results/s3c-survey.md`
(questions 9, 10 and 11 are yours; `P/results/s3c-survey-short.md` has
one line per runtime and question, to find your way). They are claims, and some were made
by running the code: open the line for each answer you build a sentence
on, and say where you found a reader wrong.

The tools engineer worked before you, in `P/sfix/tools`: their report is
given below this file's text in your instructions. Read it first of all.
It says how sentence identity works now, how records were re-keyed, and
what they ask of you. Use `P/sfix/tools` (commit your changes to it in
its git; touch only the nine languages' records and what their report
asks for).

```sh
cp -a P/base32/sdkgen P/sfix/sdkgen          # your clone, at v32-frozen
mkdir -p P/sfix/out && ln -s P/base32/out/old P/sfix/out/old && mkdir -p P/sfix/out/new
cd P/sfix && REGEN=1 tools/portcheck.sh sdkgen out ts    # the start: must pass before you change anything
```

Your PATH, at the top of every shell:

```sh
export PATH=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/zigenv/lib/python3.12/site-packages/ziglang:/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH
```

## The job

1. **Check each false sentence against the runtimes before you change a
   word**, by running where it can be run, and say for each whether the
   reviewer was right:
   - the client and the environment variable: read every ported runtime's
     constructor and auth path, and the eleven unported ones;
   - direct's result on a non-2xx response, and on a request that cannot
     be made: run it in ts and py at least (a generated SDK of a
     variation, with a stub transport or the test feature), read the rest;
   - `explain: true`: run it in ts and py; read the rest;
   - the test constructor without the test feature: generate the `no-test`
     variation and call it, in ts, go and py; read the rest;
   - what an action call returns: run one in ts; read the rest.
2. **Fix each false sentence once, in shared code**, so that the new
   sentence is true of all twenty runtimes: the nine that print it today
   and the eleven whose ports will. Where the truth differs between
   runtimes, that difference is a fact a provider declares, or a defect of
   one runtime: say which, and do not paper over it in prose. For the test
   constructor: if ts (and js) really throw where every other runtime
   falls back, that is a defect of the runtime template; fix it in the
   templates of ts and js as a commit of its own, with a test that fails
   without it, and say so plainly in your report, or, if the fix is more
   than a few lines, record it and make the page say what is true.
   Literals of shared prose that name a runtime thing (`err` and `data` as
   keys of direct's result, where go and c also have an `err` variable)
   are printed through the provider's own printer, so that the page shows
   how this language reads that key.
3. **Decide each awkward sentence**: apply the better wording where the
   reviewer is right, improve on it where you can, or leave it and say
   why. One template is one decision, however many ids it had.
4. **Fix the per-language defects** the reviewers met, each in the
   provider or forms of its language, after checking it against the
   runtime: c's `getp(result, "ok")` used as a truth test; elixir's list
   heading against its declaration; the clojure stream sentence over items
   already read (the freeze kept it; two readers since found it
   misleading: settle it); zig's action Call cell with an unclosed
   `switch`; c's Call cell whose variables nothing declares; a code span
   broken across lines on rust's page; the rust and zig notes that restate
   what shared code says for other styles; the heading "Instance
   Functions" for c, clojure and elixir (read what the old pages of all
   twenty languages called that section before choosing between one shared
   heading and a declared one). A change to the interface (a new required
   fact, a new style, a changed printer contract) is recorded as the last
   stages did: breaking or additive, which providers it forces work in.
5. **Review the nine again.** Build (read the exit code), regenerate, and
   run the one command for ts go py c zig clojure rust elixir rb, from
   scratch and normally. Every changed sentence opens classes: decide each
   by hand, by the guide's rules; re-read every hand record whose reason
   quotes text you changed. End state for all nine: nothing open, no
   defect, no fact without an account, nothing unattested, the guard and
   the reader passing for all twenty.
6. **The unported eleven must not move**: README and REFERENCE of js php
   lua csharp java kotlin scala swift cpp perl ocaml identical to
   `P/base32/out/new`, except lines from components that were already
   shared at the freeze; list every such line with its count.
7. **Sentences.** Run `tools/sentences.js`. A sentence you changed or
   added has no verdict: leave it so (an independent reader gives it one
   after you). Report the list of them, with for each the old sentence,
   the new one, and the runtime lines that make the new one true.
8. **Freeze** at one commit with a clean tree, tag `v33s`: the build
   leaves `git status` empty; the suite without the toolchain lanes
   (`node --enable-source-maps --test --test-concurrency=2 $(find dist-test -name '*.test.js' ! -name 'generatedcompile.test.js' | sort)`);
   the golden; the guard and the reader; the lanes on NEW (ts README, go
   README, py README, c DOC, rust DOC, `^rb: `, the zig documentation
   lane); the tools' self-test; the nine one commands. Commit as the guide
   says (shared source and tests; per-language files; the build; the
   golden), and the tools in their own git.

## This job can be interrupted, and the machine is shared

Keep `P/sfix/SHARED-PROGRESS.md` from your first step: one line per
finished step (with the commit), what you are in the middle of, each
decision with its reason. Commit after each finished step. If the file
exists when you start, an earlier run was interrupted: read it, check it
against `git log` and `git status` in `P/sfix/sdkgen` and `P/sfix/tools`,
discard uncommitted changes it does not describe, re-run what you rely on,
and continue. Five other engineers work on this machine (4 CPUs, 15 GB):
one heavy command at a time, the suite with `--test-concurrency=2`. After
every source change run `npm run build` and read its exit code before you
regenerate or measure.

## What you report

For each of the six false sentences: what you ran, what it showed, whether
the reviewer was right, the old sentence, the new one, where it is printed,
and the runtime lines (nine and eleven) that make it true. For each awkward
sentence: applied, improved or left, with the reason. For each
per-language defect: the fix and its evidence. Every interface change,
breaking or additive, with the providers it forced work in. The table per
language and section as the freeze reported it, and the lanes. The
unported lines. The sentences that now have no verdict. Every runtime
defect you found or fixed, kept apart from documentation changes. What
the four ports under way will meet when they are merged onto your commit
(sentences of theirs that changed, facts they must now declare). What you
did not get to. Separate what you ran from what you read.
