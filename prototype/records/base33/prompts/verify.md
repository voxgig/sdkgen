# verify: check that a port's fixes were made, and that it stands

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your language is named at the end of your instructions; it is written
`LANG` below. Your directory is `P/verify/LANG/`. Write nowhere else. The
port is in `P/ports/LANG/` (`sdkgen`, `tools`, `out`): never modify it.
Work on a copy:

```sh
mkdir -p P/verify/LANG && cp -a P/ports/LANG P/verify/LANG/ws
```

Read first: `P/brief.md`, `P/brief5.md`, `P/brief7.md`, then
`P/base33/PORTING.md` (sections 2.1, 4 to 7 and 10 matter most). Three
reports are given below this file's text in your instructions: the
porter's, the independent reviewer's, and the fixer's. All three are
claims.

## The job

In earlier stages a fix was more than once reported and not made, or made
in the words of a page and not in its examples. You check this port's
fixes one by one, and that the port stands at its last commit. You did
none of the earlier work. You do not repair anything: you report.

1. **Each finding of the reviewer**, against the fixer's outcome:
   - "fixed": open the file at the last commit and the generated page, and
     decide whether the defect is gone (quote the line). A fix to a fact:
     is the new value what the runtime shows (open the runtime file), and
     does its citation's line show it?
   - "not a defect": read the fixer's reason and the runtime line; who is
     right?
   - "needs a shared change": is it true that LANG's own files cannot
     express it, and is the recorded change the smallest one? Breaking or
     additive, as recorded? Are the affected classes recorded as `defect`,
     not `dropped`?
   - "not fixed": what is left wrong on the page because of it?
2. **The port at its last commit**, in your copy: `npm run build` in
   `sdkgen/ts` (exit code 0, `git status --short` empty), the guard and
   the reader, the golden, the suite without the toolchain lanes
   (`node --enable-source-maps --test --test-concurrency=2 $(find dist-test -name '*.test.js' ! -name 'generatedcompile.test.js' | sort)`),
   the one command from a clean regeneration with the port's records
   (`REGEN=1 tools/portcheck.sh sdkgen out LANG`: it must exit 0, or fail
   only on recorded `defect` classes), then once with `SCRATCH=1` (it exits
   1 by design: compare its numbers with the fixer's, and check that the
   parts that read no hand record, guard, purity, pagecheck, callcheck and
   the build, are clean), LANG's example lane or command where a toolchain
   is here (the guide's section 9), and the root quick start run from the
   repository root of a generated SDK where one can run. Compare every
   number with the fixer's report.
3. **What the port touched**: `git diff --stat v33-frozen..HEAD` in the
   clone against the guide's section 4 (list every file outside LANG's
   own); `git -C tools log --stat`; the commit messages (no tool or model
   named, no trailer of any kind); `diff -r out/new P/base33/out/new` for
   every language but LANG.
4. **Two fresh attacks** the reviewer did not make, of your choosing (a
   wrong fact, an optional fact removed, a dropped sentence, a changed
   example): does something fail, naming it? Restore after each.

## This job can be interrupted, and the machine is shared

Keep `P/verify/LANG/PROGRESS.md`, one line per finished step; if it exists
when you start, continue from it (a missing or half-copied `ws` is removed
by its full literal path and copied again). Other engineers work on this
machine (4 CPUs, 15 GB): one heavy command at a time, the suite with
`--test-concurrency=2`.

## What you report

`ok` is true only if every required fix is made or correctly recorded as a
shared change (its classes `defect`), the port passes everything in part 2
at its last commit (the one command with the port's records exits 0; the
`SCRATCH=1` run is reported and never decides `ok`), and it touched nothing
outside what the guide allows. A port that fails only on `defect` classes
waiting for a shared change is reported with `ok` false and that reason.
Then: each finding with what you saw; every number beside the fixer's;
what is still wrong (each as one entry: file, what, why); the shared
changes this port needs, as you would hand them to the engineer who
applies them; what is unverified for want of a compiler, counted. Separate
what you ran from what you read.
