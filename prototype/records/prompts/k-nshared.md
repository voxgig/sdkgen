# k-nshared: say the true thing once, for every runtime that needs it

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/n-shared/`. Write nowhere else. Everything else under
`P` is read-only.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md`,
`P/brief5.md`, `P/brief6.md`, `P/brief7.md`. Then
`P/results/s3b-wave1-consolidated.md` completely (it is your work list,
with file and line for each item), `P/results/s3c-sfix-shared.txt` (what
the shared code is at the commit you start from, and why each sentence
reads as it does), `P/results/s3c-sfix-verify.txt` if it exists (what an
independent reader still found wrong in that round: its required fixes in
shared code and providers are yours too), and `P/results/s3c-survey.md`
(ten readers' answers to twelve questions about what each of the twenty
runtimes does, with file and line; `P/results/s3c-survey-short.md` has
one line per runtime and question, to find your way: it saves you the
first reading, and it is a claim, so open the file for every answer you
build a sentence or a fact on). The reports of the engineer who merged the four ports and of the
tools engineer are given below this file's text in your instructions.
Then `P/base32/PORTING.md` sections 2, 4, 6, 8 and 13.

You start from the sentence round's clone, and bring the four ports onto
it:

```sh
mkdir -p P/n-shared/ws && cd P/n-shared/ws
cp -a P/sfix/sdkgen sdkgen                   # tag v33s: nine languages, each false sentence fixed once
cp -a P/n-tools/tools tools                  # the tools after this round's tools engineer (if P/n-tools/tools
                                             # is missing or its engineer has not finished, take P/sfix/tools and say so)
mkdir -p out && ln -s P/base32/out/old out/old && mkdir -p out/new
```

**Step 0, before any decision.** Build (exit 0), regenerate, and check the
nine pass the one command as `s3c-sfix-shared.txt` reports. Then bring the
four ports over from `P/v33p/sdkgen` (the commits `v32-frozen..v33p`,
already checked and without trailers: fetch them as a branch and
cherry-pick in order, leaving the golden commit out and regenerating the
golden once). The sentence round changed sentences and may have added
facts or changed what a printer is handed (`interface_changes` and
`for_the_ports` in its report): where generation throws for a port, the
interface is asking for a value; declare it from the runtime, with file
and line. In the tools, make sure the nine languages' records are the
sentence round's last (`P/sfix/tools`, `hand/` and `reviewed/`) and the
four ports' records are present and re-keyed (the tools engineer's report
says where they are). Then the one command for the thirteen: record the
table. perl fails there on its 14 `defect` records, on purpose, until
your decisions 1 and 3 below are made. Commit, and tag `v33m`. Everything
you report about what your decisions changed is measured against this
tag: keep a copy of its output (`cp -a out/new out/new-v33m`).

Your PATH, at the top of every shell:

```sh
export PATH=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/zigenv/lib/python3.12/site-packages/ziglang:/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH
```

**Your files**: `ts/src/**` and `ts/project/.sdk/src/cmp/**` (shared
components, the thirteen providers and naming hooks, and a generator
component of a language where a decision below names it), with the build
and the golden that follow from them. **Not yours**:
`ts/test/runtimefacts.test.ts`, `ts/test/runtimereader.test.ts`,
`ts/test/runtimeforms/**` (the guard engineer works on those, on a copy of
their own, from the tag `v33p`; the one exception is step 0, where a port
may need a citation in its own forms file to meet `v33s`) and the tools'
code (a third engineer). You may add or change a test of your own shared
code elsewhere under `ts/test`.

## The job

Brief 7 lists fourteen numbered decisions about shared code and the interface, and
one about perl's example test. Make them. For each:

1. **Know what every runtime does before you write the sentence**, all
   thirteen ported (ts go py c zig clojure rust elixir rb perl swift ocaml
   lua) and the seven unported ones (js php csharp java kotlin scala cpp),
   whose ports will print it: the survey gives a first answer per runtime
   with file and line; open that line yourself for each one you rely on
   (the component and template trees are
   `ts/project/.sdk/src/cmp/<lang>/` and `ts/project/.sdk/tm/<lang>/`), and
   read the runtime where the survey says "not found" or "unsure". A fact
   one port discovered is usually true of others. Report a table per
   decision: language, what its runtime does, file and line, and whether
   you found the survey right.
2. **Write the sentence once**, true of every runtime that will print it.
   Where runtimes differ, the difference is an optional fact a provider
   declares, with its value read from the runtime; shared code supplies no
   runtime value by default (brief 5), and it throws rather than guess
   where a fact it needs is missing.
3. **Declare the fact in every ported provider whose runtime has it**, not
   only in the language that raised it, and remove what the port did to
   live without it: perl's lost library lines come back
   (`use lib 'lib';` in its README, `use lib 'perl/lib';` at the root);
   swift's record fact is the plain accessor again; ocaml's note that
   corrects "Return the entity name." goes; lua's accessor sentence is
   true.
4. **Say what it costs the interface**: each change as one entry,
   breaking (a provider that does nothing now fails or prints something
   else) or additive, and which providers it forced work in.

The guard does not know your new facts yet: the account tests will fail
for them ("no default category"), and the guard engineer may name a fact
differently. That is expected. Report every new or changed fact exactly
(path, type, what it is read from in each runtime, the account you would
give it: derived, cited, an absence), so that the engineer who merges the
three of you can settle it. Every other test passes.

Beyond the fourteen:

- **Run the root quick start where its reader stands.** For every ported
  language with a toolchain on your PATH (check each with `command -v`),
  generate an SDK (the lanes' own models will do), and from the root of
  the generated repository run or compile the root README's quick start
  block for that language, once from the code at `v32-frozen`
  (`P/base32/oldclone` is the pristine old code, built: work on a copy)
  and once from yours. Report the table. perl's is the known failure;
  rb's `require_relative` and php's `require_once` were named as worth the
  same look.
- **perl's example test** (`ReadmeExamplesTest_perl.ts`): it adds
  `use lib` and `use <SDK>;` to every block and replaces the constructor
  call, so it cannot see a missing import or a wrong argument. Make it run
  each block from the directory its page addresses, without adding an
  import to a block that has one. Then show the lane fail on the port as
  delivered (lost library path) and pass on yours.
- **Items in the consolidated file that are shared code and that brief 7
  does not name**: decide each (do it, or say why not).

Then, at your last commit: `npm run build` exits 0 and leaves the tree
clean; the suite without the toolchain lanes
(`node --enable-source-maps --test --test-concurrency=2 $(find dist-test -name '*.test.js' ! -name 'generatedcompile.test.js' | sort)`)
fails only in the guard's account of your new facts (list each failing
test); the golden regenerated and passing; a clean regeneration into
`ws/out/new`; the lanes on NEW (`P/v32/mine/lanes.sh` shows how: ts README,
go README, py README, c DOC, rust DOC, `^rb: `, the zig documentation
lane; and perl's, `tools/before/run.sh`); the seven unported languages'
README and REFERENCE identical to your `out/new-v33m`, except lines from
components that were already shared (list each new line with its count).

After step 0 you do not classify the thirteen languages' changed pages by
hand: the engineer who freezes does. Give them what they need: for each
decision, which sentences and blocks changed in which languages and how
often (a diff of `out/new` against `out/new-v33m`, grouped by cause), and
every sentence you added or changed, with the runtime lines that make it
true (it has no verdict until someone else reads it).

## This job can be interrupted, and the machine is shared

Keep `P/n-shared/PROGRESS.md` from your first step: one line per finished
decision (with the commit), what you are in the middle of, each choice
with its reason. Commit after each finished decision: shared source and
tests; per-language files; the build; the golden (the guide's section 10).
Commit messages name no tool and no model and carry no trailer. If the
file exists when you start, an earlier run was interrupted: read it, check
it against `git log` and `git status`, discard uncommitted changes it does
not describe, re-run what you rely on, and continue. Other engineers work
on this machine (4 CPUs, 15 GB): one heavy command at a time, the suite
with `--test-concurrency=2`. After every source change run
`npm run build` and read its exit code before you regenerate or measure.

## What you report

Per decision: the table of runtimes, the sentence or change (old, new,
where it is printed), the facts added (path, type, value per language,
where read, proposed account), the providers changed, and breaking or
additive. The root quick start table. perl's lane before and after. The
suite's failures (each one named). The lanes. The unported lines. The
diff by cause for the engineer who freezes. Every sentence without a verdict.
Every runtime defect you met, kept apart from documentation changes. What
you did not get to. Separate what you ran from what you read.
