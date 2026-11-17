# j-review: read one port as its adversary

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your language is named at the end of your instructions; it is written
`LANG` below. Your directory is `P/reviews/LANG/`. Write nowhere else. The
port you review is in `P/ports/LANG/` (`sdkgen`, `tools`, `out`): never
modify it. Work on a copy:

```sh
mkdir -p P/reviews/LANG && cp -a P/ports/LANG P/reviews/LANG/ws
```

Read first: `P/brief.md`, `P/brief3.md`, `P/brief4.md`, `P/brief5.md`, then
`P/base32/PORTING.md` (the guide the porter followed; its section on what
the reviewer does is your minimum, not your limit). The porter's report is
given below this file's text in your instructions: it is a list of claims.

## The job

One engineer ported LANG and says the port is right. You did not write it
and you do not trust it. A page of LANG is about to be counted as evidence
that documentation can be written once and spelled per language; a false
sentence on it, or a provider that quietly knows more than its interface
allows, makes that evidence worthless. Find what is wrong. Assume a tool
that reports 0 may be blind, and that a fix can be reported and not made.

In this order of importance:

1. **The facts, against the runtime.** For every fact the provider
   declares (the fact sheet lists them with their accounts): a derived one,
   spot-check five against the runtime's declarations; a cited one, open
   the file and decide whether the quote shows the value; every pinned
   prose fact and every note, read the code and decide true or false, claim
   by claim; an absence, try to find the thing by another spelling; a
   language or convention fact, check its attestation against the old page
   or the reason recorded by hand. Read the runtime for what the page says
   and no fact covers. Report each false, unsupported or missing fact with
   file and line.
2. **The pages.** For three variations (`doc-crud`, `B`, and one where LANG
   differs most from the others: say which and why), read OLD and NEW side
   by side: the tutorial, the root quick start, the REFERENCE. Report what
   is false, weaker than before, awkward, or gone. Read every hand decision
   of kind dropped or contradiction, and a sample of twenty of the others:
   is each right?
3. **The provider and the hook, as code.** Does anything read the model, an
   entity, an operation or a feature by name, change the case of a name,
   build a name the generator's functions should give, or hold prose
   outside the notes and the fact table? Is each note one runtime's fact, or
   a sentence that belongs in shared code? Could the existing interface
   have expressed what the porter recorded as a gap, and did the port touch
   a shared file?
4. **The process, on this port.** In your copy, one change at a time,
   rebuild, regenerate and run the one command: a wrong value in a fact of
   each kind (derived, cited token, pinned prose, absence, language or
   convention, an enumerated one); a signature without its failure marker,
   or called on the wrong thing, or a field shown as a call; a sentence
   dropped from one variation, and from all; a note that names an entity or
   a number; an example line changed. For each: what failed, naming what,
   or that nothing did.
5. **Their numbers.** Rebuild (the tree stays clean), the guard and the
   reader, the suite without the toolchain lanes, the one command, and
   LANG's example lane where a toolchain is here (old code and new).
   Reproduce the line counts and the review counts.

## Your verdict

Accept, accept with fixes, or reject. List every required fix as one
entry: the file, the change, why, and whether it is in LANG's own files or
in a shared one. List separately what you could not check (no compiler
here: say what that leaves unverified, and count it). Report what this port
shows for H1 (did the interface hold, how much of the page is LANG's own
prose), H3 and H4. Separate what you ran from what you read. Do not soften
a finding and do not invent agreement.
