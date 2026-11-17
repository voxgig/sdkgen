# k-digest: what one part of the prototype's records says, for the written record

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
You write nothing to disk. Everything under `P` and `/home/user` is
read-only for you. Your product is the structured result you return.

Read first: `P/brief.md` (the proposal under test and the five hypotheses
H1 to H5, each with what would refute it). Then the records named at the
end of your instructions, completely, in the order given. They are the
reports of engineers who built and attacked a prototype, stage by stage;
most are the `.txt` form of a structured report (the same content is
beside each as `.json`). A brief (`P/brief3.md` and so on) is what a stage
was asked to do: read the ones named, for the stage's purpose.

## The job

A document is being written for the repository's maintainers: what the
prototype tested, how, what was measured, and what it means for each
hypothesis. Several readers each digest one part of the records; a writer
composes the document from the digests; a checker then compares every
number in it with the records. You are one of the readers.

Return, for your part:

1. **What each round was for and what it changed** (`rounds`): one entry
   per stage or round in your records: its purpose, who did it (how many
   builders, which independent checks), what it produced, and what was
   decided or changed because of it. Plain and short.

2. **Evidence** (`items`), one entry per measured fact that bears on a
   hypothesis or on the method. For each:
   - `topic`: one of `H1`, `H2`, `H3`, `H4`, `H5`, `method`, `finding`
     (something the build found that the proposal did not say), `cost`,
     `runtime-defect` (a defect of a generated SDK's runtime found on the
     way), `main-defect` (a defect of the pages or tests of `main` found
     on the way), `limit` (what could not be verified, and why);
   - `claim`: one sentence, as strong as the record supports and no
     stronger;
   - `numbers`: the figures, exactly as the record gives them, with their
     unit and what they count;
   - `source`: the record file and the key or heading inside it;
   - `by`: `builder` (the engineer who made the thing measured it) or
     `independent` (someone else did);
   - `basis`: `ran` or `read`, as the record says; `unclear` if it does
     not say;
   - `direction`: `for` the proposal, `against` it, or `neutral`.
   Keep every number that a later reader could want: line counts, ratios,
   test counts, lane results, counts of sentences and verdicts, of
   interface changes (breaking and additive, and their causes), of
   mutations and attacks caught and not, of classes decided by hand, of
   controls, times. Evidence AGAINST the proposal is recorded with the
   same care as evidence for it.

3. **Disagreements** (`disagreements`): where a later record corrects an
   earlier one, or an independent check contradicts a builder: both
   statements, their sources, and which stands.

4. **Superseded** (`superseded`): numbers in your records that a later
   round within your records replaced, so that the writer does not quote
   them as current.

5. **Quotable findings** (`findings`): the five to fifteen things in your
   part that a maintainer deciding on this proposal most needs to know,
   each in two or three plain sentences, with its source.

Rules: quote numbers, do not recompute them. Do not smooth over a failed
check or an `ok: false`: say what failed and why. Where a record separates
what was run from what was read, keep the separation. Do not name any AI
model or tool; the people in the records are "the builder", "the
reviewer", "the checker", "the porter". If a record you were given is
missing, say so and go on.
