# k-freeze33: put the three together, review thirteen languages, freeze version 3.3

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/v33/`. Write nowhere else. Everything else under `P`
is read-only.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md`,
`P/brief5.md`, `P/brief6.md`, `P/brief7.md`. Then the three briefs your
predecessors worked from (`P/prompts/k-nshared.md`, `k-nguard.md`,
`k-ntools.md`), `P/results/s3b-wave1-consolidated.md`, and the records of
the sentence round, `P/results/s3c-sfix-{tools,shared,verify}.txt`. The
reports of the shared, guard and tools engineers are given below this
file's text in your instructions: all are claims. The survey of the
twenty runtimes is `P/results/s3c-survey.md`, with a short form in
`s3c-survey-short.md` (the shared engineer worked from it; the guard
engineer did not see it). The last freeze, whose steps
you repeat, is `P/results/s3fix2-final.txt`, with its scripts in `P/v32`
(`mine/lanes.sh`, `mine/unported.py`, `mine/pcall.sh`, `mine/apply.py`,
`mine/table.py`, `dec/`, `mutwork/`). The guide is `P/base32/PORTING.md`.

Your PATH, at the top of every shell:

```sh
export PATH=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/zigenv/lib/python3.12/site-packages/ziglang:/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH
```

## The job

Three engineers worked on thirteen ported languages, each in their own
files and from different commits:

- **shared code and providers**: `P/n-shared/ws/sdkgen`. It starts from
  the sentence round's tag `v33s`, has the four ports brought onto it
  (tag `v33m`), and then brief 7's numbered decisions. Its tools copy
  (`P/n-shared/ws/tools`) holds the records as they stood at `v33m`.
- **the guard and the forms of all twenty runtimes**: `P/n-guard/sdkgen`,
  commits on the tag `v33p` (the four ports on the version 3.2 base) that
  touch only `ts/test/runtimefacts.test.ts`,
  `ts/test/runtimereader.test.ts` and `ts/test/runtimeforms/**`.
- **the review tools**: `P/n-tools/tools`, on the sentence round's tools.

You make one state of the three, decide by hand what changed on thirteen
languages' pages, and freeze it. Seven ports start from what you freeze.

**The first half is already done.** While the shared engineer was still
working, another engineer put the guard and the tools onto the tag `v33m`
in `P/v33/` (`P/prompts/k-freeze33a.md` is what they were asked; their
report is given below with the others, and `P/v33/PROGRESS.md` is their
record, written for you): the guard's commits brought onto the clone and
their conflicts with the sentence round settled, the tools assembled,
thirteen languages run under the new tools and every opening decided
except those that waited for the shared engineer's decisions; tag `v33a`.
You continue in `P/v33/`, from that tag. Read their PROGRESS file and
report first; check what they say against the clone (`git log`,
`git status`), and re-run any check you rely on.

Do the parts in this order.

### 1. The shared engineer's decisions onto `v33a`

The shared engineer's clone is `P/n-shared/ws/sdkgen`: their decisions are
the commits `v33m..HEAD` there (shared source and tests, per-language
files, builds, a golden). Fetch them as a branch into `P/v33/sdkgen` and
cherry-pick them in order onto `v33a`, leaving out build and golden
commits (rebuild, and regenerate the golden once at the end). A forms
file may conflict where the shared engineer's step 0 and the guard
engineer both changed a citation: resolve each conflict from the runtime
(the citation must show the value the provider now declares) and list it.
Bring the shared engineer's tools commits the same way, if they made any
after `v33m`. Build. The guard meets the shared engineer's facts for the
first time.

- **Compare before you fix.** The twenty runtimes have now been read
  three times for the same facts: by the survey's ten readers, by the
  shared engineer who declared the facts (which runtimes cache an
  accessor, read a stream signal, clone a match, mark a deleted entity,
  what each constructor is called on), and by the guard engineer, who read
  them from the forms without seeing the survey. List every disagreement
  between the provider's declarations and the guard's reading, with what
  the runtime shows (file and line). A disagreement is the check working.
- Give every new fact its account, as the guard engineer's report says
  where: derived where the forms read it, cited where a runtime line shows
  it, an absence searched over the whole runtime. None may land in
  `language` or `convention` that a runtime file can show.
- Every failure the guard engineer listed as "a provider is wrong": fix
  the provider where the guard is right, the forms where the provider is
  right, and say which.
- What the independent check of the sentence round requires
  (`required_fixes` in `P/results/s3c-sfix-verify.txt`) and nobody has
  done yet: do it, or say why not.
- The reader passes for all twenty; regenerate `runtime-table.md`.

### 2. Thirteen languages, where they changed

Regenerate NEW into `out/new`. Run the one command for ts go py c zig
clojure rust elixir rb perl swift ocaml lua, in the reviewed mode. Their
pages changed (the numbered decisions of brief 7; the sentences fixed in the
round before), and the tools gained checks. Decide everything open by
hand, by the guide's rules and the tools' README: read each class; a
missing unit is restored (where) or dropped (why); an echo is a
contradiction or has a reason; an unattested or unjudged fact gets its
record with what shows it is right; an absent sentence gets its reason or
a fix. Re-read every hand record whose reason quotes text that changed.
Where the review shows a page is wrong, fix the source and say so.

- perl's 14 records with outcome `defect` waited for shared changes that
  have now been made: check that the root quick start runs from the
  repository root and that no example prints a hash reference, and decide
  those classes again from what the page now shows.
- A sentence the shared engineer added or changed has no verdict. You are
  not its author: read each against the runtime lines they give and at
  least two runtimes of different families, and write its verdict into
  `tools/reviewed/sentences.json`. A sentence you yourself change stays
  without one; list it.

End state for all thirteen: nothing open, no defect, no fact without an
account, nothing unattested or unjudged, no absent sentence without a
reason. Record per language and section the same table as the last freeze.

### 3. Every attack that nothing caught

`P/results/s3b-wave1-consolidated.md` lists, per language, the attacks the
reviewers and verifiers ran that failed nowhere, or only as an open class
a porter decides by hand. The guard and tools engineers each give a table
of them with the control that now fails. Re-run every one yourself on a
copy of your merged state (`P/v32/mutwork` shows the harness; for an
attack on generated pages, `tools/controls` shows how), and give one
table: the attack, the language, what fails now and with what message, or
that nothing does. An attack that still fails nowhere mechanical is not
hidden: it is listed with why, and it goes into the guide as something
only the reviewer can find.

### 4. Freeze

At one commit, with a clean tree:

- `npm run build` exits 0, and `git status` is clean after it;
- the suite without the toolchain lanes
  (`node --enable-source-maps --test --test-concurrency=2 $(find dist-test -name '*.test.js' ! -name 'generatedcompile.test.js' | sort)`):
  0 failures; the golden;
- the guard and the reader for all twenty;
- the lanes on NEW: ts README, go README, py README, c DOC, rust DOC,
  `^rb: `, the zig documentation lane, and perl's
  (`tools/before/run.sh`), which must now fail on a page whose import is
  missing (show it on a copy);
- the seven unported languages (js php csharp java kotlin scala cpp)
  identical to OLD in README and REFERENCE except lines from components
  already shared: list each such line against the last freeze's list,
  with its count;
- the tools' self-test (every group, with the count);
- the mutations of the last freeze (the 75, the 19, the 12), caught as
  before or better, and the guard engineer's and the tools engineer's new
  controls;
- the thirteen one commands.

Tag it `v33-frozen`. Commit the tools in their git. Commit messages name
no tool and no model and carry no trailer. Set `ok` to true in your result
only if all of the above hold at the tag.

### 5. Count what moved

- Interface changes since `v32-frozen`, each as one entry: breaking (a
  provider that does nothing now fails or prints something else) or
  additive; its cause (the sentence review; a port of wave 1, and which;
  the guard; the tools); the providers it forced work in. And the same for
  the forms framework. How many were caused by a newly ported language is
  the number H1 turns on: report it without softening.
- Per language of the four: lines deleted (the three old components),
  lines added (provider, hook, forms, other), after this round.
- The guard's account per language, for thirteen.

## This job can be interrupted, and the machine is shared

`P/v33/PROGRESS.md` exists: the first half wrote it. Add a section of your
own, headed "Second half", and keep it from your first step: one line per
finished step (with the commit), what you are in the middle of, each
decision with its reason. Commit after each finished step. If the file
already has a "Second half" section when you start, an earlier run of
your own job was interrupted: read it, check it against `git log` and
`git status` in `P/v33/sdkgen` and `P/v33/tools`, discard uncommitted
changes it does not describe, re-run what you rely on, and continue. Other engineers may work on this machine (4 CPUs, 15 GB): one
heavy command at a time, the suite with `--test-concurrency=2`. After
every source change run `npm run build` and read its exit code before you
regenerate or measure.

## What you report

The merge (commits, conflicts). Every disagreement between the two
readers of the runtimes, with what the runtime shows and what you
decided. Every provider or forms file corrected. The table for thirteen
languages. The verdicts you gave, and the sentences left without one. The
table of attacks. The freeze checks, each with its command and result.
The counts of part 5. What the engineer who writes the guide for the last
seven ports must know: every fact a porter may now declare and where its
value is read; every check that now fails where it passed before; what
only a reviewer can find. What you did not get to. Report against H1 to
H5. Separate what you ran from what you read.
