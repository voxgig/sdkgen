# k-merge: thirteen languages on one clone

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/v33m/`. Write nowhere else. `P/base32`, `P/sfix`,
`P/sverify` and `P/ports` are read-only.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md`,
`P/brief5.md`, `P/brief6.md`, `P/brief7.md`. Then
`P/results/s3c-sfix-tools.txt` and `P/results/s3c-sfix-shared.txt`
completely (what the base you start from is, how records are re-keyed, what
the shared engineer says the four ports will meet), then
`P/results/s3b-wave1-consolidated.md`, then `P/base32/PORTING.md`
(sections 4, 5, 6 and 10 are how a port is made and committed).

Your PATH, at the top of every shell:

```sh
export PATH=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/zigenv/lib/python3.12/site-packages/ziglang:/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH
```

## The job

Two lines of work ran side by side from `v32-frozen`: the round that fixed
the shared sentences and the tools' idea of a sentence (`P/sfix`: clone at
tag `v33s`, tools with `rekey.js`), and four ports (perl, swift, ocaml,
lua), each in `P/ports/<lang>/` with its own clone and tools copy. You put
them on one clone. You make no shared change beyond what merging needs:
three engineers follow you, and the changes of brief 7 are theirs.

```sh
mkdir -p P/v33m && cd P/v33m
cp -a P/sfix/sdkgen sdkgen          # tag v33s
cp -a P/sfix/tools tools
mkdir -p out && ln -s P/base32/out/old out/old && mkdir -p out/new
```

1. **The start.** Build (exit 0), regenerate, and run the one command for
   the nine (ts go py c zig clojure rust elixir rb): record the table. It
   must be what `P/results/s3c-sfix-shared.txt` reports; if it is not, stop
   and say so.
2. **Bring each port's commits over**, perl, swift, ocaml, lua, one
   language at a time: the commits `v32-frozen..HEAD` of
   `P/ports/<lang>/sdkgen` (fetch them as a branch; do not copy files by
   hand). Leave the golden commits out: the golden is regenerated once, at
   the end. Each commit you bring keeps its subject and loses any trailer
   (`Co-Authored-By`, a session line: one fixer's commits carry them, and
   no commit of this clone may). Check each brought commit touches only
   what the guide's section 4 allows a port; list anything else.
3. **Make each port meet `v33s`.** The shared round changed sentences and
   may have added facts or changed what a printer is handed
   (`interface_changes` and `for_the_ports` in its report). Where
   generation throws for a port, the interface is asking for a value:
   declare it from the runtime, as a porter would (read the runtime file;
   give file and line), in that language's provider and forms. Nothing
   else in a provider changes here.
4. **Bring each port's records over and re-key them**: `hand/<lang>.json`,
   `counts/<lang>.json`, `purity-allow/<lang>.json`, `normalizers/<lang>.js`
   where present, from `P/ports/<lang>/tools`, through `rekey.js` exactly
   as the tools report's `for_ports` says. Report per language: records
   in, carried, merged, split, left for a person, lost (the expected
   number lost is none).
5. **Thirteen languages, one command each**, after a build that exited 0
   and a clean regeneration; for the four ports from scratch first
   (`SCRATCH=1`, which leaves classes open by design: record its numbers),
   then with their records.
   - The nine must be exactly as in step 1.
   - For the four, sentences changed under them. A class that now matches
     a reviewed sentence is matched for you; decide the rest by hand, by
     the guide's rules, and re-read every record of theirs whose reason
     quotes text that changed.
   - perl holds 14 records with outcome `defect` on purpose (its root
     quick start lost its library path; a list example prints a hash
     reference): they wait for a shared change that is not yours. So
     perl's one command fails at your tag, on those and on nothing else.
     Say so in the table.
6. **Everything else still holds**: the guard and the reader for all
   twenty; the golden regenerated once (only the four ports' lines, plus
   whatever a declared fact of step 3 moved) and passing; the suite without
   the toolchain lanes
   (`node --enable-source-maps --test --test-concurrency=2 $(find dist-test -name '*.test.js' ! -name 'generatedcompile.test.js' | sort)`);
   the lanes on NEW for the nine (`P/v32/mine/lanes.sh` shows how: ts
   README, go README, py README, c DOC, rust DOC, `^rb: `, the zig
   documentation lane) and perl's (`tools/before/run.sh sdkgen perl`); the
   seven unported languages (js php csharp java kotlin scala cpp)
   identical, README and REFERENCE, to what `P/sfix` generates; the tools'
   self-test.
7. **Commit and tag `v33m`** with a clean tree after a build; commit the
   tools in their git. Order of commits as the guide's section 10 says.

## This job can be interrupted, and the machine is shared

Keep `P/v33m/PROGRESS.md` from your first step: one line per finished step
(with the commit), what you are in the middle of, each decision with its
reason. Commit after each finished step. If the file exists when you
start, an earlier run was interrupted: read it, check it against
`git log` and `git status` in `P/v33m/sdkgen` and `P/v33m/tools`, discard
uncommitted changes it does not describe, re-run what you rely on, and
continue. Other engineers work on this machine (4 CPUs, 15 GB): one heavy
command at a time, the suite with `--test-concurrency=2`. After every
source change run `npm run build` and read its exit code before you
regenerate or measure.

## What you report

The table for thirteen languages (per language and section: units same,
shared, by hand, missing, contradictions, open, defect, and the block
columns), with the nine beside their numbers at `v33s`. Per port: the
commits brought (from, to, files), anything outside section 4, every fact
you declared (value, runtime file and line), the re-key counts, the
classes you decided by hand and why. The checks of step 6 with their
commands. What the three engineers who follow must know about the state
(what fails on purpose, what is fragile). What you did not get to.
Separate what you ran from what you read.
