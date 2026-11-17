# k-port: port one language, by the guide (version 3.2)

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your language is named at the end of your instructions; it is written
`LANG` below. Your directory is `P/ports/LANG/`. Write nowhere else.
`P/base32` is read-only.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md`,
`P/brief5.md`. Then `P/base32/PORTING.md`, completely: it is the guide, and
where it and this file differ, the guide wins and you report the
difference. Then the `## LANG` section of `P/base32/runtime-table.md`.

## The job

Nine languages print their README tutorial, the root README quick start and
their REFERENCE page from shared code and one provider each. You port LANG
the same way, following the guide step by step: its naming hook
(`Naming_LANG.ts`), its provider (`Syntax_LANG.ts`: printers, declared
facts, notes), the porter's part of its forms file
(`ts/test/runtimeforms/LANG.ts`), and the deletion of its three old
components. Then you review your own output with the one command until it
passes, deciding by hand what the tools leave for a person.

```sh
P/base32/newport.sh LANG P/ports        # makes P/ports/LANG/{sdkgen,tools,out}
cd P/ports/LANG && REGEN=1 tools/portcheck.sh sdkgen out LANG   # the expected start: NOT PORTED
```

## This job can be interrupted: keep it resumable

The machine restarted once in the middle of an earlier stage and the work
in flight was lost.

- Keep `P/ports/LANG/PROGRESS.md` from your first step on: after each step
  one line saying what is finished (with the commit, where there is one),
  what you are in the middle of, and each decision with its reason. Commit
  in the clone after each finished step, as the guide's section 10 says.
- **If `P/ports/LANG/PROGRESS.md` exists when you start**, an earlier run of
  this same job was interrupted. Read it, check it against the clone
  (`git log`, `git status`) and continue from the first step that is not
  finished. Discard uncommitted changes it does not describe
  (`git checkout -- .` in the clone), and re-run any check you rely on
  rather than trusting a line that says it passed.
- If `P/ports/LANG` exists without a `PROGRESS.md`, the workspace copy was
  interrupted: remove that one directory, typing its full literal path (no
  shell variable in an `rm`), and start again.

## The machine is shared

Five other engineers work on this machine at the same time (4 CPUs, 15 GB).
Run one heavy command at a time (a build, a generation, a suite, a lane),
never two in parallel, and run the suite, if you run it, with
`--test-concurrency=2`. Never rebuild while a suite or a lane runs in the
same clone.

## Four things matter more than finishing

1. **The table is a starting point, not the truth.** Before writing a
   fact, read every row of your section of the runtime table against the
   runtime's own files and report each wrong or missing row. Your forms
   file is yours to correct.
2. **You are testing the interface, not bending it.** A port touches only
   LANG's own files (the guide lists them exactly). When the shared code
   cannot express something LANG needs, follow the guide's protocol: stop,
   record the construct (file and line), the smallest shared change that
   would express it, whether it is breaking or additive, and which existing
   providers it would force work in. Make the shared change only if you
   cannot continue without it, as a separate commit of shared files only,
   additive only. A provider that works around the interface (reads the
   model, branches on an entity or operation name, hides prose in a
   printer) is a failed port even if every number passes. If you did work
   around something, say so yourself, with the line: an independent
   reviewer reads the provider as code and will find it.
3. **Report only what you ran.** The reviewer will audit every cited fact
   against the runtime, read the old and new pages side by side, re-run
   your commands, and change your facts to see what fails.
4. **The one command does not check that the build is current.** After
   every source change run `npm run build` in `sdkgen/ts` and read its exit
   code. A failed build leaves the previous build in place, and the one
   command then passes on the old code. Only after a build that exited 0:
   regenerate (`REGEN=1`) and check.

Where LANG has a toolchain here (check with `command -v`; the guide's
section 9 says which command runs LANG's examples), run it on the old code
(`P/base32/oldclone` is read-only: the guide's command works on a copy) and
on yours, and report both. Where it has none, say that every changed
example is unverified, count the distinct changed blocks, and read each one
against the runtime's signatures yourself: report every line you are not
sure would compile, with the runtime line that makes you doubt it.

## What you report

What the guide's section 12 lists, and:

- every wrong or missing row of the runtime table, with file and line;
- every declared fact: its value, its account (derived, cited with the
  quote, absence, pinned prose, attested against the old page, decided by
  hand), and for a hand decision the reason;
- every note, split into its claims, each with file and line;
- every gap of the interface as described above, and every shared file you
  touched (the expected number is none);
- every place the guide was wrong, unclear or missing something you
  needed, with the section;
- what the old page said that the new one does not, and the reverse, as
  the tools counted it and as you decided it;
- lines (`git diff --numstat v32-frozen..HEAD` in the clone, and `wc -l`):
  the three old components you deleted; your provider, hook and forms file;
- prose: `node tools/sharewords.js --clone sdkgen --root out/new --lang LANG`
  (by source, printed by LANG alone, notes);
- that no other language's page changed: `diff -r` of `out/new` against
  `P/base32/out/new`, leaving out LANG's own directories and the lines of
  the root README that are LANG's;
- how long each step took you (reading, table, forms, provider, review).

Report against H1 to H4 for LANG. Separate what you ran from what you read.
Say what you did not get to.
