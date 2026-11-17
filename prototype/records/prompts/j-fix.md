# j-fix: make one port right, from its review

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
  together.
- Where the reviewer's attacks on the process were not caught by anything
  (a wrong fact that failed nowhere, a dropped sentence nobody saw), that
  is not yours to fix: copy the list into your report unchanged.
- Then: build (the tree stays clean), regenerate, the one command until it
  passes, the guard and the reader, the suite without the toolchain lanes,
  and LANG's example lane where a toolchain is here.
- Commit as the guide says (LANG's files; the golden on its own).

## What you report

Each of the reviewer's findings with one outcome: fixed (how, where), not
a defect (why, with file and line), needs a shared change (recorded as
above), or not fixed (why). The final state: the one command's screen, the
counts per section, the lanes, the commits. The final line counts
(provider, hook, forms) and the notes. What is still unverified for want of
a compiler, counted. Separate what you ran from what you read.
