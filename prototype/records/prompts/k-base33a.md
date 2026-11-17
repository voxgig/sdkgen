# k-base33a: the base the last seven ports start from

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
You write in `P/base33/` (what is handed to the porters) and `P/v33b/`
(your working directory). Write nowhere else. Everything else under `P` is
read-only, `P/v33` included. Do not write `P/base33/PORTING.md` or
`P/base33/prompts/`: another engineer is writing the guide and the
porters' instruction files at the same time, in `P/v33g/`, and they are
copied in afterwards.

Read first, in this order: `P/brief.md`, `P/brief5.md`, `P/brief6.md`,
`P/brief7.md`. Then the freezing engineer's report,
`P/results/s3c-freeze33.txt` (what version 3.3 is; `for_guide` and
`freeze_checks`), `P/v33/PROGRESS.md`, and the tools engineer's report
`P/results/s3c-t7.txt` (its `bring_in` is your step 0). The layout you
reproduce is `P/base32` (read its `newport.sh` and the tools'
`mkworkspace.sh`).

Your PATH, at the top of every shell:

```sh
export PATH=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/zigenv/lib/python3.12/site-packages/ziglang:/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH
```

## The job

Version 3.3 is frozen in `P/v33` (clone at tag `v33-frozen`, tools under
git): thirteen languages ported. Seven remain (js php csharp java kotlin
scala cpp), each to be ported by one engineer, read by an independent
reviewer, fixed, and verified. You make the base they start from.

### 0. The tools fix that is not in the frozen tools yet

While the freeze was being made, another engineer closed three holes in
the sentence matching, on a copy of the tools taken at an earlier commit
(`P/t7/tools`, branch `t7`): a slot is matched only by the fact that
belongs at its position; step counts, heading numbers and articles are
checked against the page; a sentence dropped from one variation is seen
from scratch. Bring those commits onto the frozen tools exactly as that
engineer's `bring_in` says (in a clone of `P/v33/tools` under `P/v33b/`,
with a clone of `P/v33/sdkgen` at `v33-frozen` beside it, built, and
`out/old` linked to `P/base32/out/old`). Then:

- regenerate, and run the one command for the thirteen: the same numbers
  as the freezing engineer reports, except where the stricter tools open
  something. Decide every such opening by hand, by the tools' README (an
  absent or dropped sentence gets its reason or is a defect of the page; a
  class whose text is the language's own fact of another path is read; a
  page finding cannot be accepted by a record: the page is wrong, say so
  and stop);
- the controls name exact page text, and the shared sentences changed
  after that engineer took their copy: a control whose text is no longer
  on the page is re-aimed at the new text, with the same intent, and
  listed;
- the full self-test passes (about 26 minutes; run nothing else heavy
  beside it);
- commit in the tools, messages without any trailer.

### 1. The base

Make `P/base33/` with the layout of `P/base32`: `sdkgen` (a copy of
`P/v33/sdkgen` at `v33-frozen`, built, `git status` empty), `tools` (a copy
of your tools from step 0 with their git history, status clean; the thirteen
languages' decisions are the reference set), `harness`, `out/old` and
`out/new`, `oldclone` (a link to `P/freeze/oldclone`), `runtime-table.md`
(regenerated at the tag), `newport.sh <lang> <dir>` (pointing at
`P/base33`). `PORTING.md` and `prompts/` are added by someone else. Then prove it:

- run `newport.sh` for one language that is not ported (into `P/v33b/`),
  run the one command there, and show it reports NOT PORTED without an
  error and that `git status` in that workspace's tools is clean;
- run `newport.sh` for one language that is ported (a second workspace),
  regenerate there with `REGEN=1`, and show the one command passes with
  the same numbers as at the freeze: this is what tells a porter the base
  is sound before they change anything;
- the tools' self-test from the base;
- free disk (`df -h /`).


### 2. Measures at thirteen languages

As the last freeze reported them, from the base: source lines with and
without the forms and the shared guard (`node tools/lines.js`), measured
and projected to twenty with the four new ports' sizes beside the nine's;
the prose share by source and by sentence identity per language
(`node tools/sharewords.js`); the distinct shared sentences, how many one
language alone prints and why, how many have a verdict
(`node tools/sentences.js`); purity. Report against H1 to H5 what these
numbers say, and what crossed a line.


## This job can be interrupted, and the machine is shared

Keep `P/v33b/PROGRESS.md` from your first step, one line per finished
step; if it exists when you start, continue from it, re-running what you
rely on. Another engineer works on this machine at the same time (4 CPUs,
15 GB): one heavy command at a time.

## What you report

Step 0: the commits brought, conflicts, the thirteen's numbers beside the
freeze's, every opening and what you decided, every control re-aimed, the
self-test's counts. The base, with the proof of part 1. The measures.
What you did not get to. Separate what you ran from what you read.
