# v32: put the three together, decide what changed by hand, freeze version 3.2

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your key is `v32`; you write in `P/v32/` (your working directory) and in
`P/base32/` (what you hand to the porters). Write nowhere else. `P/base` is
version 3.1 and stays as it is.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md`,
`P/brief5.md`. Then the three briefs your predecessors worked from:
`P/prompts/i-shared.md`, `P/prompts/i-guard.md`, `P/prompts/i-tools.md`.
Their results are in `P/results/s3fix2-shared.txt`, `P/results/s3fix2-guard.txt`
and `P/results/s3fix2-tools.txt`: read all three in full; they are claims,
not facts. Then read `P/prompts/i-final-notes.md`: where the three reports
meet, what is already decided, and what you must settle from the runtime.
Their directories: `P/i-shared/ws/sdkgen`
(shared code and providers), `P/i-guard/sdkgen` (the guard, the forms of all
twenty runtimes) with `P/i-guard/runtime-table.md`, `P/i-tools/ws/tools`
(the review tools). The re-check they answer: `P/results/s3fix-check.txt`
(its scripts: `P/check-v31/mine`). The last freeze, whose steps you repeat:
`P/results/s3fix-final.txt`, with its scripts in `P/v31` (`lanes.sh`,
`unported.py`, `mutwork/`, `apply.py`, `dec/`).

## The job

Eleven languages remain. Four are ported first (perl, swift, ocaml, lua),
each by one engineer who follows your guide and is then read by an
independent reviewer; then the other seven. After you, a port touches only
that language's own files, one command tells a porter whether the port is
right, and a wrong fact or a missing sentence fails somewhere.

Do the parts in this order.

## 0. This job can be interrupted: keep it resumable

The machine this runs on restarted once in the middle of this job and the
run was lost. So:

- Keep `P/v32/PROGRESS.md` from your first step on: after each step, one
  line saying what is finished (with the commit, where there is one), what
  you are in the middle of, and every decision you made with its reason.
  Commit in the clone after each finished step, small commits, as
  `brief3.md` says.
- **If `P/v32/PROGRESS.md` exists when you start**, an earlier run of this
  same job was interrupted. Read it, check what it says against the clone
  (`git log`, `git status`) and the directories, and continue from the
  first step that is not finished. Discard uncommitted changes it does not
  describe (`git checkout -- .` in the clone); re-run any check you rely on
  rather than trusting a line that says it passed.
- If it does not exist, `P/v32` must not exist either: start from part 1.

## 1. One clone

```sh
mkdir -p P/v32 && cd P/v32
cp -a P/i-shared/ws/sdkgen sdkgen
cp -a P/i-tools/ws/tools tools
ln -s P/base/out/old old-out      # the OLD output, read-only
```

Bring the guard engineer's commits onto the clone (they start from the same
commit, `9089ed48`, and touch only `ts/test/runtimefacts.test.ts`,
`ts/test/runtimereader.test.ts` and `ts/test/runtimeforms/**`): cherry-pick
them in order. Build. The guard meets the shared engineer's changes for the
first time: make it pass for the nine honestly.

- Two people wrote the same facts independently: the shared engineer
  declared the `ok` literals and how each runtime's stream produces its
  items; the guard engineer cited them from the runtimes. **Compare the two
  lists before you fix anything**, and report every disagreement with what
  the runtime shows (file and line). A disagreement is the check working.
- Fix a provider where the guard is right and the forms where the provider
  is right. Fix every fact or note the guard engineer marked `WRONG:`.
  Every declared fact ends derived, cited (showing its value, or a search
  that stays empty, or pinned prose) or attested against the old page.
- The reader test passes for all twenty; regenerate `runtime-table.md`.

Regenerate NEW from your clone into `P/v32/out/new` (with `out/old` linked).

## 2. The nine languages, where they changed

Run the one command for ts go py c zig clojure rust elixir rb. Their output
changed (the `ok` literal as a fact, the stream sentences, the checked
examples in c, the notes, the accessor sentence) and the tools gained
checks (a language or convention fact attested against the old page; a
shared sentence printed less often than its reference). Decide everything
that is open by hand, by the tools' rules: read each class; a missing unit
is restored (where) or dropped (why); an echo is a contradiction or has a
reason; an unattested fact gets its hand entry with what shows it is right;
a sentence printed less often than its reference gets its reason or a fix.
Where the review shows the output is wrong, fix the source and say so.

End state for all nine: nothing open, no fact without an account, no
language or convention fact that is neither attested nor decided by hand.
Record per language and section the same table as the last freeze (same,
shared matched, by hand, missing, contradictions; blocks identical,
corrected, unified, otherwise), and the count of shared outcomes matched
against sentences nobody reviewed.

## 3. Freeze

At one commit, with a clean tree:

- `npm run build`, and `git status` clean after it;
- the suite without the toolchain lanes; the golden;
- the lanes on NEW: ts README, go README, py README, c DOC, rust DOC,
  `^rb: `, the zig documentation lane (six models);
- the eleven unported languages byte-identical to OLD in README and
  REFERENCE except lines from already-shared components: list each new line
  against the last freeze's list, with its count;
- the tools' self-test (every group, with the count);
- the mutations: the 75 of the last stage, the guard engineer's new ones,
  and the re-check's three kinds re-run by you on copies: (a) rb `none`
  'null', `maps` 'arrays', `noun` 'Functions', `lits.false` 'False', and py
  with its literals removed: each must fail the one command or the guard,
  for a reason that names the fact; (b) a shared sentence dropped from one
  rb variation, classified from scratch: left for a person; (c) the table
  sections of swift, lua, ocaml and perl show `throws`, what the test
  constructor is called on, fields apart from functions, lua's error value
  from the code, and how each stream produces its items: quote the rows.

Tag it `v32-frozen`. Put the tools under git too (`git init` in the tools
directory, one commit), so that "at one commit" covers them and a porter's
changes show as that language's files only. Set `ok` to true in your result
only if all of the above hold at the tag and the nine checks pass.

## 4. The base the ports start from

Make `P/base32/` with the layout of `P/base`: `sdkgen` (a copy at
`v32-frozen`, built), `tools` (with the nine languages' decisions as the
reference, and its git history), `harness`, `out/old` and `out/new`,
`oldclone` (a link to `P/freeze/oldclone`), `runtime-table.md`,
`newport.sh <lang> <dir>` (pointing at `P/base32`), `PORTING.md`. Run
`newport.sh` once for a language you will not port and show the one command
reports it as not ported, without error; show `git status` in that
workspace's tools is clean. Check free disk (`df -h /`).

## 5. The porting guide, version 3.2

Write `P/base32/PORTING.md`, complete on its own for an engineer who has
read only the four briefs. Start from `P/base/PORTING.md` and correct it:

- Every problem the re-check found in the guide (`guide` in its result):
  the start message quoted as the command prints it; the block table's
  `classes` column; what the compiler column means (a compiler on PATH; the
  changed blocks of the variations are compiled only by the lanes, on the
  lanes' own models); the rule for `unquoted`; notes as one plain string.
- The rule of this stage (`brief5.md`), as what a porter does: declare
  every runtime value the page prints (no shared default will supply one);
  write each signature with every dimension the table shows (failure
  marker, what it is called on, callable or field, where a return is only a
  comment); record how the stream produces its items from the code; cite
  with a quote that shows the value, an absence by a search; decide by hand
  a language or convention fact the old page does not attest.
- **Before writing any fact, a porter reads every row of the language's
  section of `runtime-table.md` against the runtime and reports each wrong
  or missing row** (the table is produced by a reader that has been wrong
  before; the forms file is the language's own, so the porter corrects it).
- Section 9, the table of the eleven, corrected from the new
  `runtime-table.md` and the two engineers' reports: perl's `ok` is 0 or 1
  and its `test` is a class method; swift's `throws` and static `testSDK`;
  lua's error value is a table and its `test` a dot function; ocaml's
  fields, its client members, and its stream; java's and kotlin's stream;
  whatever else changed.
- Which shared test files name a per-language component: search `ts/test`
  for `Readme(Quick|TopQuick|Ref)_<lang>` and other per-language names for
  each of the eleven, and list, per language, the shared test files a port
  must touch when it deletes its three old components (the Ruby pilot and
  `lua-table-keys.test.ts` are the known cases). A port may edit such a
  file only in the lines that name its own language.
- What the independent reviewer does after the porter, so that a porter
  reports only what was run: audits every cited fact and every pinned-prose
  fact against the runtime; reads OLD and NEW side by side for three
  variations; re-runs the one command; changes facts of each category in
  the port's provider and checks that something fails; drops a sentence and
  checks that something fails.
- The order: perl, swift, ocaml and lua are ported first. Say what that
  means for a porter: a construct the shared code cannot express is
  recorded (file, line, the smallest change, breaking or additive, which
  providers it would force work in) and, only if the port cannot continue,
  made as a separate commit of shared files only, additive only.
- The baselines of section 11 at `v32-frozen`.

## 6. Measures at nine languages

As the last freeze reported them (source lines with and without the forms
and the shared guard, measured and projected to twenty; the guard's account
per language; purity; interface changes since the first four languages,
breaking and additive, cumulative, and how many a newly ported language
caused), and two more: prose by source (the words of the output that a
provider's own string literals supply, against all prose words, per
language and section) beside prose printed by one language alone; and the
count of distinct shared sentences with how many have been read by a person.

Report against H1 to H5. Say plainly what crossed a line. Separate what you
ran from what you read. Say what you did not get to.
