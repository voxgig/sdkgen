# k-recordcheck: check the written record against the records it rests on

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
You may change one file: `P/record/model-dependent-text-prototype.md`.
Write `P/record/CHECK.md` for your notes. Write nowhere else. Everything
else under `P` and under `/home/user` is read-only.

Read first: `P/brief.md` (the proposal and the hypotheses), then
`P/prompts/k-record.md` (what the writer was asked to write, and how),
then the document. The writer's report is given below this file's text in
your instructions. The records the document rests on are in `P/results/`
(`.txt` and `.json`; `s1-` is the first stage, `s2-` the second, `s3a-`,
`s3fix-`, `s3fix2-` the third stage's interface and its two fix rounds,
`s3b-` the first four ports and the sentence review, `s3c-` the rounds
after them up to the freeze of version 3.3), with `P/stage1.md` for the
first stage and `P/brief*.md` for what each round was asked.

## The job

The document will be committed to a repository and read by people who
decide on the proposal from it. You were not its writer and did not see
the digests it was written from. Find what is wrong with it.

1. **Every number.** For each figure in the document (counts, ratios,
   line counts, test and lane results, times, version identifiers), find
   it in a record (`grep` is enough for most) and compare: the value, what
   it counts, the version it was measured at, and whether a later record
   replaced it. List every mismatch, every number you could not find, and
   every number quoted as current that a later record superseded. Correct
   the document.

2. **Every claim about a hypothesis.** For H1 to H5: does the standing the
   document gives follow from the records? Look for the record that
   contradicts it: an independent check that disagreed with a builder, an
   `ok: false`, a "not done", a number on the other side of a refutation
   line. Where the document is kinder to the proposal than the records
   are, or harsher, correct it and say what you changed.

3. **Ran or read; builder or independent.** Where the document says
   something was run, measured or verified, check that the record says
   so. A claim that rests on reading is said to rest on reading.

4. **The two lists of defects.** Each entry: is it in a record, is the
   language and file right, and is it a defect of what the list says (a
   runtime, or main's pages and tests)? Is anything the records call a
   defect missing from the lists?

5. **Rules of the house.** No AI model or tool is named. No path under a
   temporary directory. No dash used as punctuation. No first person.
   Internal stage names are defined before use or not used. Paths given
   as the repository's exist in `/home/user/sdkgen` (check each).

6. **As a maintainer.** Read it once more from the top as someone who was
   not there and must decide. List what is unclear, what is asserted
   without evidence, and what question it leaves open that the records
   could answer; answer those in the document.

Keep `P/record/CHECK.md` as you go: one line per finding, with the record
that decides it and what you changed.

## What you report

The count of numbers checked, mismatched, not found and superseded, with
each mismatch. Every change to a hypothesis's standing. Every claim moved
from "ran" to "read" or the reverse. Changes to the defect lists. House
rule findings. What a maintainer would still ask. Whether, in your
judgement, the document can be committed as a record in progress, and
what must change first if not.
