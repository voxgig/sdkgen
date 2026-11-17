# k-integrate34: twenty languages in one state, the shared decisions made once, frozen as version 3.4

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/v34/`. Write nowhere else. Everything else under `P`
is read-only, and so is everything under `/home/user`.

Read first, in this order: `P/brief.md` (the proposal and the five
hypotheses), `P/brief5.md`, `P/brief6.md`, `P/brief7.md` (the rule each
later round added, in its first section), then the guide
`P/base33/PORTING.md` completely (what a port is, what the one command
checks, how openings are decided by hand, how commits are made). Then the
records of what you bring together, each completely:

- the seven ports of the last wave: `P/results/s5-port-<lang>.json`,
  `s5-review-<lang>.json`, `s5-fix-<lang>.json`, `s5-verify-<lang>.json` for
  js java php cpp csharp kotlin scala (a language without a fix report was
  accepted with no required fix; say so for each);
- the collected list of shared changes the ports, reviews, fixes and
  verifications asked for: `P/mine/shared-wave2.md` (a convenience made by
  script from those reports; the reports decide where they differ);
- the catalogue round: `P/results/s4-h3fix.txt` (seven catalogued defects
  fixed by shared edits, on `refs/tags/h3fix` in `P/h3fix/sdkgen`);
- the migration round: `P/results/s4-h5.txt`, `s4-h5check.txt`,
  `s4-h5fix.txt`, `s4-h5fixcheck.txt` (the lifecycle structures, on the
  branch `h5fix` in `P/h5fix/sdkgen`, and the three unsafe states the last
  attack traced to one rule each, with a local fix not built);
- the last freeze, whose steps you repeat: `P/results/s3c-freeze33.txt`
  and `P/v33/PROGRESS.md`.

Your PATH, at the top of every shell:

```sh
export PATH=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/zigenv/lib/python3.12/site-packages/ziglang:/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH
```

## The job

Thirteen languages are ported at `v33-frozen`. Seven more were ported from
that base by the guide, each reviewed, fixed and verified, in their own
workspaces `P/ports/<lang>/` (`sdkgen` with commits on `v33-frozen`,
`tools` with commits on the base tools). Two rounds changed shared code on
the same base: the catalogue round (`h3fix`) and the migration round
(`h5fix`). You make one state of all of it, make the shared decisions the
seven ports asked for once, and freeze it.

### 1. One clone, everything brought in

```sh
mkdir -p P/v34 && cd P/v34
git clone P/base33/sdkgen sdkgen && git -C sdkgen checkout -b v34 v33-frozen
cp -a P/base33/sdkgen/ts/node_modules sdkgen/ts/node_modules
git clone P/base33/tools tools && git -C tools checkout -b v34
mkdir -p out && ln -s P/base33/out/old out/old && mkdir -p out/new
```

Bring in, by fetching each source as a branch and cherry-picking in order,
leaving out every commit whose message is `Build` and every golden-only
commit (rebuild; regenerate the golden once, at the end):

1. `h3fix` (`refs/tags/h3fix`): shared source and tests.
2. `h5fix`: the migration round's commits after `v33-frozen`. Leave out
   the commit that only sets the version to 4.45.0 unless a test needs
   the two versions to differ; if one does, keep it and say which.
3. The seven ports, one language at a time, each `v33-frozen..HEAD` of
   `P/ports/<lang>/sdkgen` (the porter's and the fixer's commits). Their
   tools commits onto your tools the same way.

List every conflict and how you settled it. A forms file or a provider
that conflicts with a shared change of `h3fix` or `h5fix` (the `interface`
field every provider now declares; `testMock` optional in the type) is
settled from the runtime and from what the shared code now asks. Build
(exit 0) after each source.

### 2. The shared decisions, made once

For every item in the shared list (gaps of the interface, of the guard's
readers, of the review tools, shared prose a review found false or
missing, a defect a port recorded because shared code could not say the
true thing), decide one of: **made** (a shared change, with a test that
fails without it), **recorded** (not made, with the reason and what it
would take), or **not a gap** (the report was wrong: show the runtime or
the code). Among them at least:

- the guard's call reader and the tools' printed-call check, on template
  calls (cpp `std::make_shared<X>(...)`), generic type arguments inside an
  argument (kotlin `mutableMapOf<String, Any?>(...)`) and the scala form
  the scala port names;
- csharp's recorded defect: shared code gives a list's loop variable and
  the loaded entity one name in one block, which C# rejects (CS0136);
- what remove leaves (cpp: remove keeps the entity's data), the operation
  return type that needs a cast (java `Object`, kotlin `Any?`, scala,
  csharp), php's case-folded class names, the js import form, the
  accessor's receiver, the entity getter return types;
- the three local fixes the last migration attack traced (a released
  fingerprint must not outweigh a record that says changed, or a declared
  override; the list of shared sections derived from what is retired, with
  a completeness check; the declared interface read from the loaded value
  only).

For each change made, record as the earlier rounds did: breaking or
additive; its cause (which newly ported language, a review, the catalogue
round, the migration round); the providers it forced work in. **How many
breaking changes a newly ported language of this wave caused is the
number hypothesis H1 turns on: report it without softening.**

### 3. Twenty languages, decided

Register all twenty as ported in the tools. Regenerate NEW, and run the one
command for all twenty in the reviewed mode, in batches that fit a
background command's 30-minute limit. Every opening (classes the shared
changes opened, sentences changed, facts a provider must now declare) is
decided by hand by the guide's rules; one written rule per changed
sentence, applied to every language, is how the last two rounds did it.
A sentence you or another round changed has no verdict: list each, with
its old and new text and what makes the new one true. End state for all
twenty: nothing open, no defect, no fact without an account, nothing
unattested, every absent sentence explained. A language that cannot reach
that state is reported with the reason, never forced.

### 4. Freeze

At one commit with a clean tree, each with its command and result:

- `npm run build` exits 0 and `git status` is clean after it;
- the suite without the toolchain lanes
  (`node --enable-source-maps --test --test-concurrency=2 $(find dist-test -name '*.test.js' ! -name 'generatedcompile.test.js' | sort)`):
  0 failures; the golden regenerated once and passing;
- the guard and the reader for all twenty;
- every example lane with a toolchain here, on NEW and on OLD: ts README,
  go README, py README, c DOC, rust DOC, `^rb: `, the zig documentation
  lane, perl (`tools/before/run.sh`), php (`tools/before/run.sh`), java
  (every documented block compiled with `javac`, as the java port did),
  cpp DOC, js (the js port's runner, `P/ports/js/my/runblocks.js`), kotlin
  (`gradle --offline`, as the kotlin port did; download nothing); and the
  root quick start of each of those run from the repository root of a
  generated SDK;
- the catalogue checker of the H3 round over all twenty languages as
  ported (`P/h3fix/issuecheck-h3fix.js`, its variations in `P/h3fix`):
  exit 0, or every entry still shown named;
- the tools' self-test (every group, with the count);
- the twenty one commands.

Tag `v34-frozen` and the tools `v34-frozen-tools`. Commit messages name no
tool and no model and carry no trailer of any kind.

## This job can be interrupted, and the machine is shared

Keep `P/v34/PROGRESS.md` from your first step: one line per finished step
(with the commit), what you are in the middle of, each decision with its
reason. If the file exists when you start, an earlier run was interrupted:
read it, check it against `git log` and `git status` in `P/v34/sdkgen` and
`P/v34/tools`, discard uncommitted changes it does not describe, re-run
what you rely on, and continue. Other engineers may work on this machine
(4 CPUs, 15 GB): one heavy command at a time, the suite with
`--test-concurrency=2`. After every source change run `npm run build` and
read its exit code before you regenerate or measure. Free disk is limited:
keep no more than two copies of the clone.

## What you report

The merge (commits, conflicts). Every shared decision (made, recorded or
not a gap), with its test, breaking or additive, cause, and providers
forced; the count of breaking changes caused by a newly ported language.
The table for twenty languages per section as the last freeze reported it.
The sentences without a verdict. Each freeze check with its command and
result. What you did not get to. Separate what you ran from what you read.
