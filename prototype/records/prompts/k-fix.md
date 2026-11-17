# k-fix: make one port right, from its review

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your language is named at the end of your instructions; it is written
`LANG` below. You work in the port's own workspace, `P/ports/LANG/`
(`sdkgen`, `tools`, `out`), and write nowhere else. `P/base32` and
`P/reviews/LANG` are read-only.

Read first: `P/brief.md`, `P/brief3.md`, `P/brief4.md`, `P/brief5.md`, then
`P/base32/PORTING.md`. The porter's report and the independent reviewer's
report are given below this file's text in your instructions.

## The job

The reviewer read the port as an adversary and listed what is wrong. You
make the port right.

- Take each required fix in turn. Check it against the runtime yourself
  first (the reviewer can be wrong: say so with file and line when they
  are). Fix what is in LANG's own files: the provider, the hook, the forms
  file, the hand decisions, the notes.
- A fix that needs a shared file: do not make it. Record it exactly (file,
  the change, why, breaking or additive, which providers it forces work
  in). One engineer will apply the shared changes of all the ports
  together. If the porter made a shared change, leave it as its own commit
  and say whether the review supports it.
- Where the reviewer's attacks on the process were not caught by anything
  (a wrong fact that failed nowhere, a dropped sentence nobody saw), that
  is not yours to fix: copy the list into your report unchanged.
- After every source change: `npm run build` in `sdkgen/ts`, and read its
  exit code (the one command does not check that the build is current).
  Then regenerate, the one command until it passes in both modes
  (`SCRATCH=1` first), the guard and the reader, the golden, the suite
  without the toolchain lanes
  (`node --enable-source-maps --test --test-concurrency=2 $(find dist-test -name '*.test.js' ! -name 'generatedcompile.test.js' | sort)`),
  and LANG's example lane where a toolchain is here.
- Commit as the guide's section 10 says (LANG's files; the golden on its
  own; your tools files in the tools copy).

## This job can be interrupted, and the machine is shared

Keep `P/ports/LANG/FIX-PROGRESS.md`: one line per finding as you settle it
(the outcome, the commit). If it exists when you start, an earlier run of
this job was interrupted: read it, check it against `git log` and
`git status`, discard uncommitted changes it does not describe, and
continue. Five other engineers work on this machine (4 CPUs, 15 GB): one
heavy command at a time, the suite with `--test-concurrency=2`.

## What you report

Each of the reviewer's findings with one outcome: fixed (how, where, the
commit), not a defect (why, with file and line), needs a shared change
(recorded as above), or not fixed (why). The final state: the one
command's screen in both modes, the counts per section, the lanes, the
commits, `git status --short` after a build (empty). The final line counts
(provider, hook, forms) and the notes. What is still unverified for want
of a compiler, counted. Separate what you ran from what you read.
