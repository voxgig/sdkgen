# k-base33: the base and the guide the last seven ports start from

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
You write in `P/base33/` (what you hand to the porters) and `P/v33g/`
(your working directory). Write nowhere else. Everything else under `P` is
read-only, `P/v33` included.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md`,
`P/brief5.md`, `P/brief6.md`, `P/brief7.md`. Then `P/base32/PORTING.md`
completely (the guide of version 3.2, which you replace), then
`P/results/s3b-wave1-consolidated.md` (every "Guide problems the porter
met" entry, every "Runtime-table rows the porter found wrong", and what
the reviewers could not check), then `P/prompts/k-port.md`,
`k-review.md`, `k-fix.md` and `k-verify.md` (what the engineers of a port
are told besides the guide). The freezing engineer's report is given below
this file's text in your instructions: it says what version 3.3 is.

Your PATH, at the top of every shell:

```sh
export PATH=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/zigenv/lib/python3.12/site-packages/ziglang:/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH
```

## The job

Version 3.3 is frozen in `P/v33` (clone at tag `v33-frozen`, tools under
git): thirteen languages ported. Seven remain: js php csharp java kotlin
scala cpp. Each is ported by one engineer who has read the briefs and your
guide and nothing else, then read by an independent reviewer, fixed, and
verified. Four ports have just been made that way; what their engineers
could not find in the guide, or found wrong in it, is written down. You
make the base those seven start from and the guide they follow.

### 1. The base

Make `P/base33/` with the layout of `P/base32`: `sdkgen` (a copy of
`P/v33/sdkgen` at `v33-frozen`, built, `git status` empty), `tools` (a copy
of `P/v33/tools` with its git history, status clean; the thirteen
languages' decisions are the reference set), `harness`, `out/old` and
`out/new`, `oldclone` (a link to `P/freeze/oldclone`), `runtime-table.md`
(regenerated at the tag), `newport.sh <lang> <dir>` (pointing at
`P/base33`), `PORTING.md`. Then prove it:

- run `newport.sh` for one language that is not ported (into `P/v33g/`),
  run the one command there, and show it reports NOT PORTED without an
  error and that `git status` in that workspace's tools is clean;
- run `newport.sh` for one language that is ported (a second workspace),
  regenerate there with `REGEN=1`, and show the one command passes with
  the same numbers as at the freeze: this is what tells a porter the base
  is sound before they change anything;
- the tools' self-test from the base;
- free disk (`df -h /`).

### 2. The guide, version 3.3

Write `P/base33/PORTING.md`, complete on its own. Start from the 3.2
guide and correct it:

- **Every guide problem the four porters and their reviewers met**
  (the consolidated file lists them by language): answer each in the
  section it belongs to. Among them: what "the one command passes" means
  (with the port's own records; from scratch it leaves classes open by
  design, and those numbers are reported, not zero); `hand/<lang>.json` is
  the only state and `*.open.json` is rewritten on every run; whether
  `classes/<lang>.json` is committed; what to do with a wrong row about a
  member the page does not document; how an import line or a line with no
  runtime spelling is accounted for; that a failure marker must be
  spellable in a signature; what `prints` selects and how to choose it.
- **The rule of this round** (brief 7), as what a porter does: a page that
  is wrong because shared code cannot say the true thing is recorded as a
  `defect`, never `dropped`, and reported as an interface gap; a fact is
  declared with the value the runtime shows, and the guard now compares
  it.
- **Every fact a porter may now declare, and where its value is read
  from**, as one table: the required ones of 3.2 and the optional ones of
  this round (the accessor's cache, the stream's signal, a copy from a
  match getter, how prose names a member, a member that is a field, the
  deleted mark, the place an import is printed for, what the client's
  members are called on). For each: when it applies, how to tell from the
  runtime, its account, and what the page says with and without it. **A
  porter reads the runtime for each of them**: the first four ports showed
  that a fact one language needs is usually true of others.
- **What the guard and the tools now fail on** that they passed before
  (from the freezing engineer's report), so that a porter recognises the
  message; and what only the reviewer can find (the attacks that still
  fail nowhere mechanical).
- **The table of the seven** (section 9), each row re-read against the
  regenerated `runtime-table.md` and the runtime's own files, file and
  line: result style; stream kind and when it runs; whether the stream
  reads a signal; whether the accessor caches (php does); fields and
  properties (kotlin's `name`); what the constructor and the test
  constructor are called on; the `ok` literal as the runtime writes it;
  what the root quick start must import to run from the repository root
  (php's `require_once`, js's `require`); and the command that compiles or
  runs its examples here, or the `command -v` that shows there is none.
  Say for each of the seven what the first four ports suggest it will
  meet.
- **Which shared test files name a per-language component**, searched
  again at the tag for each of the seven.
- **The baselines**: the thirteen languages at `v33-frozen` (the table the
  freezing engineer reports), and for the four new ones their lines
  before and after, as what a port is compared with.
- **What the independent reviewer and the verifier do**, corrected from
  what the four reviews showed worked: reading the examples as a compiler
  where there is none; running the root quick start where its reader
  stands; changing a fact of each kind; the citations that quote a line
  that does not show the value.

Then read your guide as a porter of php would, and as a porter of kotlin
would, from the first line to the last, with only the four briefs beside
it: list what you could not do from it, and fix it.

### 3. What the engineers of a port are told besides the guide

Write, in `P/base33/prompts/`, the four instruction files for the last
seven ports: `port.md`, `review.md`, `fix.md`, `verify.md`. Start from
`P/prompts/k-port.md`, `k-review.md`, `k-fix.md`, `k-verify.md` and change
only what version 3.3 and the experience of the first four require:
`P/base33` and `v33-frozen` for `P/base32` and `v32-frozen`; what `ok`
means (the one command passes with the port's records; from scratch its
numbers are reported); `defect`, not `dropped`, for a page shared code
makes wrong; the fixer's commits carry no trailer of any kind; the
reviewer reads every optional fact's runtime to see whether the port
should have declared it; whatever else the four pipelines' reports show a
later engineer needed and was not told. Keep each file as short as it is
now. List every change you made to them, with the reason.

### 4. Measures at thirteen languages

As the last freeze reported them, from the base: source lines with and
without the forms and the shared guard (`node tools/lines.js`), measured
and projected to twenty with the four new ports' sizes beside the nine's;
the prose share by source and by sentence identity per language
(`node tools/sharewords.js`); the distinct shared sentences, how many one
language alone prints and why, how many have a verdict
(`node tools/sentences.js`); purity. Report against H1 to H5 what these
numbers say, and what crossed a line.

## This job can be interrupted, and the machine is shared

Keep `P/v33g/PROGRESS.md` from your first step, one line per finished
step; if it exists when you start, continue from it, re-running what you
rely on. Other engineers may work on this machine (4 CPUs, 15 GB): one
heavy command at a time.

## What you report

The base, with the proof of part 1. The guide: its sections, each guide
problem with where it is answered, and what you could not do from it as a
porter before you fixed it. The four instruction files, with each change
and its reason. The measures. What a porter of each of the seven should
expect, in one line each. What you did not get to. Separate what you ran
from what you read.
