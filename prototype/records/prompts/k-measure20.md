# k-measure20: the measures at twenty languages

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/m20/`. Write nowhere else. Everything else under `P`
is read-only (`P/v34` included: copy from it), and so is everything under
`/home/user`.

Read first: `P/brief.md` (the proposal, and the five hypotheses with what
would refute each, fixed before anything was built). Then the integration
report `P/results/s6-integrate.txt` (the frozen state `v34-frozen` in
`P/v34/sdkgen`, tools `v34-frozen-tools` in `P/v34/tools`), and how the
same measures were taken before: `P/results/s3fix2-final.txt` (nine
languages, its `lines` and `hypotheses`), `P/results/s3c-base33.txt` (its
`measures`, at thirteen), `P/results/s3c-freeze33.txt` (its
`interface_changes`). The committed record of all of it is
`/home/user/sdkgen/docs/design/model-dependent-text-prototype.md`
(sections 3.1, 3.2 and 6.1, and appendix B: what each measure counted and
how).

Your PATH, at the top of every shell:

```sh
export PATH=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/zigenv/lib/python3.12/site-packages/ziglang:/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH
```

```sh
mkdir -p P/m20 && cd P/m20
git clone P/v34/sdkgen sdkgen && git -C sdkgen checkout v34-frozen
cp -a P/v34/sdkgen/ts/node_modules sdkgen/ts/node_modules && (cd sdkgen/ts && npm run build)
git clone P/v34/tools tools && git -C tools checkout v34-frozen-tools
mkdir -p out && ln -s P/base33/out/old out/old && cp -a P/v34/out/new out/new
```

## The job

Measure, with the same method as before so that the figures compare, and
say where a method had to change and why:

1. **H2, lines.** `node tools/lines.js` with all twenty registered: the
   documentation code only, plus the forms, plus the shared guard; the
   tools' own headline; and the nine-language and thirteen-language
   figures recomputed at this state beside the earlier ones. Before is the
   figure the earlier rounds used for twenty (15,038); check it. Per
   language of the seven: lines deleted, provider, hook, forms, other.
2. **H1, prose.** `node tools/sharewords.js` for all twenty: by source,
   printed by this language alone (against all twenty), notes. Which
   language is highest by each measure, and whether any is over 15%.
3. **H1, model reads.** Purity for all twenty: open findings, accepted
   ones with their reasons.
4. **H1, the interface count, re-counted.** Every breaking change to the
   provider interface from the first four languages to `v34-frozen`,
   and separately every breaking change to the forms framework the guard
   reads: one row each, with its round, its cause and the providers it
   forced. Re-count from the code history (`git log` of the shared files
   between the tags the record names, and the interface types), not from
   the earlier reports, and then compare with their counts and say where
   you differ. Then the number H1 turns on: how many breaking changes a
   newly ported language caused, per wave.
5. **Sentences.** `node tools/sentences.js` with all twenty as references:
   distinct shared sentences, how many have a verdict, how many one
   language alone prints and why.
6. **H3 at twenty.** The integration ran the catalogue checker over
   twenty; repeat it on your copy with the broader variants
   (`P/h3fix/issuecheck-h3fix.js`), and count the lines each of the seven
   ports added for a catalogued entry (S13's `testMock` and any other).
   Recompute H3's ratio over the 36 in-scope entries at twenty, per entry
   and per distinct defect, by the brief's rule, strict and strictest.
7. **H5 at this state.** Re-run the migration rows and the attacks' states
   (`P/h5fix/bin/rows.sh` and the others; repoint their paths at a copy
   under `P/m20`) against `v34-frozen`, including the three states the
   last attack found unsafe. Before, after, safe or not.

## This job can be interrupted, and the machine is shared

Keep `P/m20/PROGRESS.md` from your first step; if it exists when you
start, continue from it. One heavy command at a time; a background command
is stopped after 30 minutes.

## What you report

Each measure with its command, its figures and what it counts, beside the
earlier figures. The interface re-count, row by row, and where it differs
from the earlier reports. H3's table at twenty. H5's rows. Against each of
H1 to H5: the criterion, the figure, which side of the line. Separate what
you ran from what you read.
