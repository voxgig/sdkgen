# k-record3check: check the final record and its verdict

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
You may change the two files in `P/record3/`
(`model-dependent-text-prototype.md`, `model-dependent-text-classes.md`)
and write `P/record3/CHECK.md` for your notes. Write nowhere else.

Read first: `P/brief.md`, then `P/prompts/k-record3.md` (what the writer
was asked) and `P/prompts/k-recordcheck.md` (the six checks; all apply to
what changed). The committed version is
`/home/user/sdkgen/docs/design/model-dependent-text-prototype.md`; the
writer's report is given below this file's text in your instructions.

## The job

You did not write it. It will be committed, and people will decide on the
proposal from its verdict.

1. **Every changed figure**, against the report it comes from
   (`P/results/s4-h3fix`, `s4-h5fix`, `s4-h5fixcheck`, `s5-*`,
   `s6-integrate`, `s6-measure20`, `s6-attack34`): value, what it counts,
   who measured it, ran or read. Correct each mismatch.
2. **The verdict, word by word.** For each hypothesis: does the word
   (refuted, holds, not refuted, not decided) follow from the criterion as
   fixed in `P/brief.md` and from the evidence that survived the
   independent checks? Look for the report that contradicts it. A verdict
   kinder to the proposal than the evidence, or harsher, is corrected,
   with the reason in `CHECK.md`. The same for the answer on generality
   and for what the record tells a maintainer to take from it: nothing
   beyond the evidence.
3. **Consistency.** The status, the table of standings, the verdict, the
   section of each hypothesis and section 8 must say the same thing.
4. **House rules**, in both files, as in `k-recordcheck.md`.

## What you report

Figures checked and mismatched, with each mismatch. Every change to a
verdict word, and why. Consistency findings. House-rule findings. Whether
both files can be committed as the final record, and what must change
first if not.
