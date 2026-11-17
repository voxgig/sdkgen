# k-freeze33a: the guard and the tools meet thirteen languages (the first half of the freeze)

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/v33/`. Write nowhere else. Everything else under `P`
is read-only.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md`,
`P/brief5.md`, `P/brief6.md`, `P/brief7.md`. Then the briefs the guard and
tools engineers worked from (`P/prompts/k-nguard.md`, `k-ntools.md`),
`P/results/s3b-wave1-consolidated.md`, and the sentence round's records
(`P/results/s3c-sfix-tools.txt`, and `s3c-sfix-shared.txt` and
`s3c-sfix-verify.txt` if they exist; if they do not, the decisions of that
round are in `P/sfix/SHARED-PROGRESS.md`). The reports of the guard and
tools engineers are given below this file's text in your instructions:
both are claims. The guide is `P/base32/PORTING.md`. The whole freeze, of
which you do the first half, is described in `P/prompts/k-freeze33.md`:
read it, so that you know what the engineer after you will do with what
you leave.

Your PATH, at the top of every shell:

```sh
export PATH=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/zigenv/lib/python3.12/site-packages/ziglang:/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH
```

## The job

Three engineers worked on thirteen ported languages. Two have finished:
the guard engineer (`P/n-guard/sdkgen`: commits on the tag `v33p` that
touch only `ts/test/runtimefacts.test.ts`, `ts/test/runtimereader.test.ts`
and `ts/test/runtimeforms/**`) and the tools engineer (`P/n-tools/tools`,
branch `ntools`). The third, the shared engineer, is still making brief
7's numbered decisions in `P/n-shared/ws/sdkgen`; their first step is
done and tagged there as `v33m`: the sentence round's clone (`v33s`) with
the four ports brought onto it. You put the guard and the tools onto
`v33m`, so that when the shared engineer finishes, only their decisions
remain to be brought in, by the engineer after you.

### 1. One clone, from `v33m`

The shared engineer is working in `P/n-shared/ws` right now: never copy
its working tree, take what git holds.

```sh
mkdir -p P/v33 && cd P/v33
git clone P/n-shared/ws/sdkgen sdkgen && git -C sdkgen checkout -b freeze v33m
cp -a P/base32/sdkgen/ts/node_modules sdkgen/ts/node_modules      # the same lockfile; check with `git diff v32-frozen v33m -- ts/package-lock.json`
git clone P/n-shared/ws/tools tools                               # then check out the tools commit the shared engineer made at v33m
                                                                  # (P/n-shared/PROGRESS.md names it), on a branch of your own
mkdir -p out && ln -s P/base32/out/old out/old && mkdir -p out/new
```

Build (exit 0). The tools at that commit are this round's tools
engineer's code with the nine languages' records as the sentence round
last decided them and the four ports' records re-keyed; check that against
`P/n-tools/tools` (branch `ntools`, HEAD `d6eabfc`) and `P/sfix/tools`
file by file for `hand/`, `counts/`, `purity-allow/`, `normalizers/`,
`reviewed/` and the tool code, bring in any commit that is missing (the
sentence round's engineer adapted self-test controls after the shared
engineer took their copy), and say for each kind of file which copy you
hold and why.

### 2. The guard's commits

Check that `v33p..HEAD` of `P/n-guard/sdkgen` touches only the three test
paths, then cherry-pick the commits in order. They were made on a clone
without the sentence round's changes, and that round changed citations in
the forms (a new required fact `ref.facts.testMock`, cited for the nine
and staged ahead for the unported; a third argument of the `read`
printer), and the shared engineer's first step changed the four ports'
forms to meet it. Where a cherry-pick conflicts, resolve it from the
runtime: a citation must show the value the provider declares at `v33m`.
List every conflict and how you settled it. Build. Then:

- the guard and the reader pass for all twenty (the facts brief 7 decides
  are staged ahead of the providers, so nothing fails for want of them);
- `runtime-table.md` regenerated into `P/v33/`;
- the guard engineer's 37 attacks and the earlier 108 mutations, re-run
  on your merged clone (`P/n-guard/work` holds the harness and the sets;
  work on a copy of your clone under `P/v33/`): the same outcomes as they
  report, or say what differs.

### 3. Thirteen languages under the new tools

Regenerate NEW into `out/new`. Run the one command for ts go py c zig
clojure rust elixir rb perl swift ocaml lua, in the reviewed mode. The
tools engineer lists the openings their checks create (an enumerated fact
that is not judged or not attested; an absent sentence without a reason;
hand records whose quotation is stale; ocaml's block classes paired by
heading for the first time), and the ports each hold classes that matched
a sentence the first review called false, which the sentence round has
since corrected. Decide every one by hand, by the guide's rules and the
tools' README: read each class; an unjudged or unattested fact gets its
record with what in the runtime shows it is right (the tools engineer
found that for ocaml's `keys`, swift's and perl's `entityBy` the true
value contradicts the old page: say what the old page got wrong); an
absent sentence gets its reason or is a defect of the page; a stale
quotation is reworded and its decision re-read.

What you leave open on purpose, and only this: what waits for a decision
of brief 7 that the shared engineer is making. perl's 14 `defect` records
(decisions 1 and 3) are the known case; ts's absent "Return the entity
name." may be another (decision 9: read ts's runtime and say whether its
name member is a field). Name each and the decision it waits for.

### 4. What the independent check of the sentence round requires

If `P/results/s3c-sfix-verify.txt` exists by the time you reach this
part: its `required_fixes` and failed `attacks` that concern the guard,
the forms or the tools are yours; those in shared code or providers go on
a list for the engineer after you. If it does not exist, say so.

### 5. Leave it standing

Commit as you go (the clone: the guard commits as brought, then yours,
test files and forms only; the tools in their git), with messages that
name no tool and no model and carry no trailer. At the end: `npm run
build` exits 0 with a clean tree; the suite without the toolchain lanes
(`node --enable-source-maps --test --test-concurrency=2 $(find dist-test -name '*.test.js' ! -name 'generatedcompile.test.js' | sort)`)
has 0 failures; the golden passes; the tools' self-test passes (regenerate
the fact-mutation control pages from your clone first, as the tools
engineer's report says). Tag the clone `v33a`.

## This job can be interrupted, and the machine is shared

Keep `P/v33/PROGRESS.md` from your first step: one line per finished step
(with the commit), what you are in the middle of, each decision with its
reason. The engineer after you continues from this file: write it for
them. If it exists when you start, an earlier run of this job was
interrupted: read it, check it against `git log` and `git status` in
`P/v33/sdkgen` and `P/v33/tools`, discard uncommitted changes it does not
describe, re-run what you rely on, and continue. Another engineer is
working on this machine (4 CPUs, 15 GB): one heavy command at a time, the
suite with `--test-concurrency=2`. After every source change run `npm run
build` and read its exit code before you regenerate or measure.

## What you report

The clone and tools you hold (commits; which copy of each kind of record
and why). Every conflict and its settlement. The guard and reader counts;
the attacks and mutations beside the guard engineer's numbers. The table
for thirteen languages (per language and section: units same, shared, by
hand, missing, contradictions, open, defect, the block columns), with
every opening you decided (what, why, the runtime line) and every one you
left, with the decision it waits for. What the sentence round's check
required and what you did. The checks of part 5. What the engineer after
you must do, in order. What you did not get to. Separate what you ran
from what you read.
