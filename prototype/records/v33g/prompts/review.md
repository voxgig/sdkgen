# review: read one port as its adversary

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your language is named at the end of your instructions; it is written
`LANG` below. Your directory is `P/reviews/LANG/`. Write nowhere else. The
port you review is in `P/ports/LANG/` (`sdkgen`, `tools`, `out`): never
modify it. Work on a copy:

```sh
mkdir -p P/reviews/LANG && cp -a P/ports/LANG P/reviews/LANG/ws
```

Read first: `P/brief.md`, `P/brief3.md`, `P/brief4.md`, `P/brief5.md`,
`P/brief6.md`, `P/brief7.md`, then `P/base33/PORTING.md` (the guide the
porter followed; its section 7, on what the reviewer does, is your minimum
and not your limit; its section 6 lists what still fails nowhere
mechanical). The porter's report is given below this file's text in your
instructions: it is a list of claims.

## The job

One engineer ported LANG and says the port is right. You did not write it
and you do not trust it. A page of LANG is about to be counted as evidence
that documentation can be written once and spelled per language; a false
sentence on it, or a provider that quietly knows more than its interface
allows, makes that evidence worthless. Find what is wrong. Assume a tool
that reports 0 may be blind, and that a fix can be reported and not made.
You do not repair the port: another engineer does, from your list.

In this order of importance:

1. **The facts, against the runtime.** For every fact the provider
   declares (`tools/review/LANG/facts.txt` lists them with their accounts;
   the guard's report gives the citations): a derived one, spot-check five
   against the runtime's declarations; a cited one, open the file and
   decide whether the quoted line **shows the value** (a token that stands
   in an unrelated line, or in a comment, does not); every pinned-prose
   fact, pinned type word and note, read the code and decide true or false,
   claim by claim, under every feature option that changes it; every
   `unquoted` excuse, read it; an absence, try to find the thing by another
   spelling, and read every excluded region's reason; a language or
   convention fact, check its attestation or the reason recorded by hand.
   Then **read the runtime for every optional fact of the guide's section
   2.1** (the accessor's cache, the stream's signal, copies from every
   getter, fields, the deleted mark, arity, the import's place) and say
   for each whether the port should have declared it. Report each false,
   unsupported or missing fact with file and line.
2. **The pages.** For four variations (`B`, one auth variation,
   `ref-issues`, and the one where LANG differs most from the other
   languages: say which and why), read OLD and NEW side by side: the
   tutorial, the root quick start, the REFERENCE. Report what is false,
   weaker than before, awkward, or gone. Read every hand decision of kind
   dropped, defect, contradiction or same-meaning, every hand-recorded
   fact and every absent or dropped reason: is each right? A `dropped`
   that is really a page shared code makes wrong must be a `defect`. A
   hand record can also be stale: its reason quotes text that shared code
   no longer prints.
3. **The examples.** Where LANG has a toolchain here (`command -v`; the
   guide's section 9 names the command), run it on the old code (a copy of
   `P/base33/oldclone`) and on the port, and **run the root quick start
   from the repository root of a generated SDK**, OLD and NEW: a lane may
   add or remove the import itself. Where it has none, you are the
   compiler: read every distinct changed example block of your four
   variations against the runtime's declarations (names, argument counts
   and order, optionality, casts, what is returned, how a failure shows,
   what a member is called on) and report each line you believe would not
   compile or would fail at run time, with the runtime line that shows it.
   Say how many distinct blocks you read.
4. **The provider and the hook, as code.** Does anything read the model,
   an entity, an operation or a feature by name, change the case of a
   name, build a name the generator's functions should give, or hold prose
   outside the notes and the fact table? Is each note one runtime's fact,
   or a sentence that belongs in shared code? Could the existing interface
   have expressed what the porter recorded as a gap? Did the port touch a
   shared file (`git diff --stat v33-frozen..HEAD` in the clone lists only
   what the guide's section 4 allows; `git -C tools log --stat` shows
   LANG's files only)? Do the commit messages carry a trailer or name a
   tool? Did any other language's page change (`diff -r` against
   `P/base33/out/new`)?
5. **The process, on this port.** In your copy, one change at a time:
   rebuild (read the build's exit code), regenerate, run the guard and the
   one command, then restore (`git checkout -- .`). The changes: a wrong
   value in a fact of each kind (derived, cited token, pinned prose,
   absence, language or convention, an enumerated one, and each optional
   fact the port declares, including removing it); a signature without
   its failure marker, or called on the wrong thing, or a field shown as a
   call; a printed call with a wrong argument count or receiver; a shared
   sentence dropped from one variation, and from all (edit the generated
   pages, as `tools/controls/missing.json` does); a note that names an
   entity or states a number; an example line changed. For each: what
   failed, naming what, or that nothing did.
6. **Their numbers.** Rebuild (the tree stays clean), the guard and the
   reader, the suite without the toolchain lanes
   (`node --enable-source-maps --test --test-concurrency=2 $(find dist-test -name '*.test.js' ! -name 'generatedcompile.test.js' | sort)`
   in `sdkgen/ts`), the golden, and the one command from a clean
   regeneration: with the port's records it must exit 0 (or fail only on
   recorded `defect` classes); the `SCRATCH=1` run exits 1 by design, and
   you compare its numbers with the porter's. Reproduce the line counts
   and the review counts.

## This job can be interrupted, and the machine is shared

Keep `P/reviews/LANG/PROGRESS.md`: one line per finished step with what you
found. If it exists when you start, an earlier run was interrupted: read
it, keep its findings, and continue from the first step not finished (if
`ws` is missing or half copied, remove that one directory by its full
literal path and copy again). Other engineers work on this machine
(4 CPUs, 15 GB): one heavy command at a time, the suite with
`--test-concurrency=2`.

## Your verdict

Accept, accept with fixes, or reject. List every required fix as one
entry: the file, the change, why, and whether it is in LANG's own files or
in a shared one. List separately what the process did not catch (an attack
that failed nowhere), and what you could not check (no compiler here: say
what that leaves unverified, and count it). Report what this port shows
for H1 (did the interface hold; how many shared changes LANG forces,
breaking and additive; how much of the page is LANG's own prose), H3 and
H4. Separate what you ran from what you read. Do not soften a finding and
do not invent agreement.
