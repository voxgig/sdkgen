# k-record2check: check the updated record against the new results

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
You may change two files: `P/record2/model-dependent-text-prototype.md`
and `P/record2/model-dependent-text-classes.md`. Write
`P/record2/CHECK.md` for your notes. Write nowhere else. Everything else
under `P` and under `/home/user` is read-only.

Read first: `P/brief.md` (the proposal and the hypotheses), then
`P/prompts/k-record2.md` (what the writer was asked to change, and from
which reports), then `P/prompts/k-recordcheck.md` (how the first version
of the record was checked: the same six checks apply to everything that
changed). The record as it was committed is
`/home/user/sdkgen/docs/design/model-dependent-text-prototype.md`; the
writer's report is given below this file's text in your instructions.

## The job

You were not the writer. The two files will be committed to a repository
and read by people who decide on the proposal from them.

1. **What changed.** `diff` the updated record against the committed one.
   Every changed or added figure: find it in the report it comes from
   (`P/results/s4-h3check.txt`, `s4-h5.txt`, `s4-h5check.txt`,
   `s4-general-sum.txt`, `s4-general-blind.txt`, `s3c-base33.txt`,
   `s3c-guide33.txt`) and compare the value, what it counts, and who
   measured it. List every mismatch and correct it. Every sentence that
   was removed: was it wrong, or only inconvenient?

2. **The standings.** For H1 to H5 and for the new section on the
   catalogue: does what the record now says follow from the reports? Look
   for the finding that contradicts it: an attack that succeeded, a row
   marked not safe, a range whose other end changes the sentence, a "not
   done". Where the record is kinder to the proposal than the reports, or
   harsher, correct it and say what you changed. In particular: the new
   section must not present the share the mechanism addresses as larger
   than the reports give, nor hide that six of the tested entries were not
   fixed; and it must not present the classification as more certain than
   two samples make it.

3. **The classification file.** Check the full table against
   `P/general/catalogue-classes.md` row by row by script (id, class,
   sub-class): 329 rows, none missing, none changed without a stated
   reason. Recompute the counts per class from the table itself and
   compare with the counts the file and the record print. Check that every
   id is a heading of the catalogue
   (`/home/user/sdkgen/docs/design/model-dependent-text-issues.md`).

4. **Ran or read; builder or independent**, as in the first check.

5. **Rules of the house**, in both files: no AI model or tool named; no
   path under a temporary directory; no dash used as punctuation; no first
   person; internal names defined before use or not used; repository paths
   exist in `/home/user/sdkgen` (check each new one).

6. **As a maintainer** who asked "is there a general solution, or a list
   of individual fixes": read the status, the table of standings and the
   new section. Is the answer there, plainly, in the first screen of the
   section? If not, make it so.

Keep `P/record2/CHECK.md` as you go: one line per finding, with the
report that decides it and what you changed.

## What you report

The count of figures checked, mismatched and not found, with each
mismatch. Every change to a standing. The result of the row-by-row check
of the table and the recomputed counts. House-rule findings. What a
maintainer would still ask. Whether both files can be committed, and what
must change first if not.
