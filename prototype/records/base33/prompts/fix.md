# fix: make one port right, from its review

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your language is named at the end of your instructions; it is written
`LANG` below. You work in the port's own workspace, `P/ports/LANG/`
(`sdkgen`, `tools`, `out`), and write nowhere else. `P/base33` and
`P/reviews/LANG` are read-only.

Read first: `P/brief.md`, `P/brief3.md`, `P/brief4.md`, `P/brief5.md`,
`P/brief6.md`, `P/brief7.md`, then `P/base33/PORTING.md`. The porter's
report and the independent reviewer's report are given below this file's
text in your instructions.

## The job

The reviewer read the port as an adversary and listed what is wrong. You
make the port right.

- Take each required fix in turn. Check it against the runtime yourself
  first (the reviewer can be wrong: say so with file and line when they
  are). Fix what is in LANG's own files: the provider, the hook, the forms
  file, the hand decisions, the notes. An optional fact the reviewer found
  missing is declared with the value the runtime shows, and cited.
- A fix that needs a shared file: do not make it. Record the affected
  classes as `defect` in `hand/LANG.json` (never `dropped`), with the
  shared file named, and record the change exactly (file, the change, why,
  breaking or additive, which providers it forces work in). One engineer
  will apply the shared changes of all the ports together.
- Where the reviewer's attacks on the process were not caught by anything
  (a wrong fact that failed nowhere, a dropped sentence nobody saw), that
  is not yours to fix: copy the list into your report unchanged.
- After every source change: `npm run build` in `sdkgen/ts`, and read its
  exit code (the one command checks that the build is current but does not
  build). Then regenerate, and run the one command with your records until
  it exits 0 (or fails only on recorded `defect` classes); run it once
  with `SCRATCH=1` and report its numbers, which are not expected to be
  zero. Then the guard and the reader, the golden, the suite without the
  toolchain lanes
  (`node --enable-source-maps --test --test-concurrency=2 $(find dist-test -name '*.test.js' ! -name 'generatedcompile.test.js' | sort)`),
  LANG's example lane where a toolchain is here, and the root quick start
  from the repository root of a generated SDK where one can run.
- Commit as the guide's section 10 says (LANG's files; the golden on its
  own; your tools files, `classes/LANG.json` included, in the tools copy).
  **Commit messages name no tool and no model and carry no trailer of any
  kind** (no `Co-Authored-By`, no session line, whatever adds one): check
  `git log --format=%B` before you report, and amend your own commits in
  this clone where one slipped in.

## This job can be interrupted, and the machine is shared

Keep `P/ports/LANG/FIX-PROGRESS.md`: one line per finding as you settle it
(the outcome, the commit). If it exists when you start, an earlier run of
this job was interrupted: read it, check it against `git log` and
`git status`, discard uncommitted changes it does not describe, and
continue. Other engineers work on this machine (4 CPUs, 15 GB): one heavy
command at a time, the suite with `--test-concurrency=2`.

## What you report

`ok` is true when every finding has one of the outcomes below and the one
command with the port's records exits 0; it is false, with the reason, when
the one command fails only on `defect` classes waiting for a shared change.
The `SCRATCH=1` run never decides `ok`.

Each of the reviewer's findings with one outcome: fixed (how, where, the
commit), not a defect (why, with file and line), needs a shared change
(recorded as above), or not fixed (why). The final state: the one
command's screen with the records and the `SCRATCH=1` run's numbers, the
counts per section, the lanes, the commits and their messages,
`git status --short` after a build (empty). The final line counts
(provider, hook, forms) and the notes. What is still unverified for want
of a compiler, counted. Separate what you ran from what you read.
