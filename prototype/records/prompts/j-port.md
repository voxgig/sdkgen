# j-port: port one language, by the guide

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

Three things matter more than finishing:

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
   printer) is a failed port even if every number passes.
3. **Report only what you ran.** An independent reviewer will audit every
   cited fact against the runtime, read the old and new pages side by side,
   re-run your commands, and change your facts to see what fails.

Where LANG has a toolchain here (check with `command -v`; the guide's table
says which command runs LANG's examples), run it on the old code and on
yours and report both. Where it has none, say that every changed example
is unverified, and count them.

## What you report

What the guide's "What you report" section lists, and:

- every wrong or missing row of the runtime table, with file and line;
- every declared fact: its value, its account (derived, cited with the
  quote, absence, pinned prose, attested against the old page, decided by
  hand), and for a hand decision the reason;
- every note, split into its claims, each with file and line;
- every gap of the interface as described above, and every shared file you
  touched (the expected number is none);
- every place the guide was wrong, unclear or missing something you needed,
  with the section;
- what the old page said that the new one does not, and the reverse, as the
  tools counted it and as you decided it;
- lines: the three old components you deleted; your provider, hook and
  forms file;
- how long each step took you (reading, forms, provider, review).

Report against H1 to H4 for LANG. Separate what you ran from what you read.
Say what you did not get to.
