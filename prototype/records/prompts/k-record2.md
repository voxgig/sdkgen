# k-record2: bring the record up to date with four new results

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/record2/`. Write nowhere else. Everything else under
`P` and everything under `/home/user` is read-only.

Read first: `P/brief.md` (the proposal and the five hypotheses), then
`P/prompts/k-record.md` (what the record is, who reads it, and how it is
written: every rule there holds for you). Then the record as committed:
`/home/user/sdkgen/docs/design/model-dependent-text-prototype.md`. Copy it
to `P/record2/model-dependent-text-prototype.md` and work on the copy.

## The job

The record says where a prototype stands. Since it was written, these
results came in. Each is a report in `P/results/` (`.txt`, with the same
content as `.json`): read each completely.

1. **H3, independently checked**: `s4-h3check.txt`, the check of
   `s4-h3.txt`. The record's section 3.3 was written from the measurement
   alone and says the check is running.
2. **H5 on the real structure**: `s4-h5.txt` (the measurement) and
   `s4-h5check.txt` (an independent attack on it). The record's section
   3.5 says this was not measured.
3. **How far the proposal reaches across the catalogue**:
   `s4-general-sum.txt` (four classifiers, a first check that was not
   blind), `s4-general-blind.txt` (a second, blind sample of 100 entries
   and its adjudication), and the working table
   `P/general/catalogue-classes.md`. The record has nothing on this, and it
   is the answer to the question the maintainers asked first: is there a
   general solution, or a list of individual fixes?
4. **The base for the last seven ports and the measures at thirteen
   languages**: `s3c-base33.txt` (the tools round that ran beside the
   freeze is now merged; the thirteen languages re-run under it; the
   self-test; source lines, prose shares, sentences and purity at
   thirteen) and `s3c-guide33.txt` (the porting guide of version 3.3 and
   what it says each of the seven will meet).

If one of these files does not exist when you start, say so and write the
rest; do not wait for it.

### What to change in the record

- **Status line and "Where each hypothesis stands"**: what is in now, and
  what is still out (the seven ports under way, the integration at twenty,
  the measures at twenty, the shared edits H3 still needs, the verdict).
- **3.1 H1 and 3.2 H2**: the measures at thirteen from the base report,
  beside the nine-language figures, with what each counts. If the
  thirteen-language figures move a standing, say so; if the report does
  not give a figure the record needs, say it was not measured.
- **3.3 H3**: the check's findings. What it confirmed (the scope, the
  reproduction), what it corrected (D26 only partly fixed; U44 under the
  strict reading; the claim that the features part was never touched),
  that every pattern check could be fooled by the same defect in other
  words and what a clean result therefore rests on, and the recomputed
  table. The standing: not decided, and what would decide it.
- **3.5 H5**: the result on the real structure, row by row where a row
  matters: what is unsafe without the change to the tool, what is safe
  with it, the row that stays unsafe either way and what it would need,
  the twenty-target project, the language pack, aliases, overrides,
  version skew both ways, the provider written for an older interface and
  the interface version built to catch it, the stale compiled output and
  its fix, the cost. Then what the independent attack found. The
  standing, in the words the evidence supports.
- **A new section, placed after the hypotheses and before "What the build
  found"**: how far the proposal reaches across the 329 catalogued issues.
  The classes, defined in one line each. The counts per class as entries
  and as distinct defects, with their ranges. The three numbers: what the
  mechanism addresses and how much of that was tested; what is one edit
  today and how much of that needs a derivation (the other half of the
  design note); what the proposal does nothing for, by class. The 46 work
  packages: how many disappear, shrink, stay. How it was checked, and what
  the check could not settle (the borders). Then, plainly, what this
  means: say it as the evidence does, without softening and without
  overstating; the reports' own conclusions are a starting point, not the
  text.
- **5 (cost), 6 (limits), 7 (not done)** and the appendices: whatever the
  four results change (the tools' self-test size after the merge; the
  guide; new limits such as the sample-based check of the classification;
  the list of what remains).

Keep everything else as it is, unless one of the new results contradicts
it; then correct it and list the correction.

### A second file: the classification itself

Write `P/record2/model-dependent-text-classes.md`, to be committed beside
the record: the table that gives each of the 329 entries its class, so
that a maintainer can check any row. Make it from
`P/general/catalogue-classes.md`, reorganised for a reader who was not
there: a status line in the style of the catalogue's; what the classes
are; the counts and the three numbers with ranges; the work-package table;
how it was checked (the two samples, the agreement, the corrections, the
borders left open); then the full table. Take out the working names (the
instruction file's name, "the classifiers' tables", who saw what when)
except where they are needed to say how far a number can be trusted. The
record's new section points at this file for the rows.

### Rules

Those of `k-record.md`: plain technical English; every number with what
it counts and who measured it (builder or independent; ran or read);
evidence against the proposal with the same care as evidence for it; no
first person; no dash used as punctuation; no AI model or tool named; no
path under a temporary directory; the prototype's working files "are not
in this repository"; internal names defined before use or not used.
Wrap prose at about 76 columns; tables and one-line list entries may run
long.

## What you report

For each of the four results: what you changed, section by section. Every
standing that changed and why. Every place a new result contradicted the
record as committed. The new section's numbers, as you wrote them. The
two files' paths and lengths. What a maintainer would still ask that the
records cannot answer. What you did not get to.
