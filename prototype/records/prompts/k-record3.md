# k-record3: the final version of the record, with the verdict

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/record3/`. Write nowhere else. Everything else under
`P` and everything under `/home/user` is read-only.

Read first: `P/brief.md` (the proposal and the five hypotheses, with what
would refute each, fixed before anything was built), then
`P/prompts/k-record.md` (who the record is for and how it is written:
every rule there holds for you). Then the record as committed:
`/home/user/sdkgen/docs/design/model-dependent-text-prototype.md`, and its
companion `/home/user/sdkgen/docs/design/model-dependent-text-classes.md`.
Copy both to `P/record3/` and work on the copies.

## The job

The prototype is finished. The record says where it stood at thirteen
languages, with three rounds in progress. Bring it to its final state and
give the verdict. These reports came in since the committed version; read
each completely (`P/results/<name>.txt`, the same content as `.json`):

- `s4-h3fix`: the seven catalogued issues fixed by shared edits (the
  record has a summary of it in section 3.3; check it against the report);
- `s4-h5fix` and `s4-h5fixcheck`: the migration structures and their
  attack (the record has a summary in section 3.5; check it);
- `s5-port-<lang>`, `s5-review-<lang>`, `s5-fix-<lang>`,
  `s5-verify-<lang>` for js java php cpp csharp kotlin scala: the last
  seven ports, each reviewed, fixed and verified;
- `s6-integrate`: all twenty languages in one state, the shared decisions
  the seven asked for, and the freeze of version 3.4 (`v34-frozen`);
- `s6-measure20`: the measures at twenty languages, including an
  independent re-count of the interface changes from the code history;
- `s6-attack34`: an independent attack on the frozen state, including a
  verdict on every sentence no one but its author had read.

### What to change

- **Status line and the table of standings**: final. Nothing is "in
  progress" or "being made" any more, except what is genuinely not done;
  say what that is.
- **A new section, "Verdict"**, placed right after the status and the
  table of standings, before section 1. For each of H1 to H5: the claim,
  the refutation criterion as fixed, the figure at twenty languages with
  who measured it (builder or independent) and whether it was run or
  read, and one word: **refuted**, **holds**, **not refuted** (the
  criterion is not crossed but the claim is not fully shown) or **not
  decided**, with the reason in two or three sentences. Where the
  independent re-count or the attack differs from a builder's figure, the
  verdict follows the evidence that survived, and says so. Then the
  answer to the question the maintainers asked first (a general solution,
  or a list of individual fixes), in one paragraph, from section 4 and
  the twenty-language results. Then what a maintainer should take from it
  for the plan (`docs/design/model-dependent-text-plan.md`): which parts
  of the proposal the evidence supports adopting, which it does not, and
  what each would cost, as the records show it. Do not recommend beyond
  the evidence; say where the evidence stops.
- **Sections 2 to 7 and the appendices**: the twenty-language results
  where the thirteen-language ones stand now: the stages table (the last
  wave, the integration, the measures and the attack), H1 to H5 with the
  twenty-language figures beside the earlier ones, the cost (interface
  changes by round including the last wave, review labour, the tools),
  the two lists of defects (add those the last wave found in the
  runtimes and on `main`'s pages), what the evidence cannot show, and
  appendix A for twenty languages. Appendix B gains the last wave's
  breaking changes.
- **Section 8, Not done**: what remains, honestly: what was recorded and
  not made, what was never measured, and what a real adoption would still
  have to do.
- The classes file: change it only if a twenty-language result changes a
  row or a count (for example a T entry now fixed in all twenty); list
  each change.

Every number with what it counts and who measured it. Evidence against the
proposal with the same care as evidence for it. No first person, no dash
used as punctuation, no AI model or tool named, no path under a temporary
directory; the prototype's working files "are not in this repository".
Wrap prose at about 76 columns; tables and one-line list entries may run
long.

## What you report

The verdict as written, hypothesis by hypothesis. Every section changed
and how. Every place a new report contradicted the record. The two files'
paths and lengths. What a maintainer would still ask that the records
cannot answer.
