# k-merge1: the four ports on one clone

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/v33p/`. Write nowhere else. `P/base32` and `P/ports`
are read-only.

Read first: `P/brief.md`, `P/brief5.md`, then `P/base32/PORTING.md`
(sections 4, 5, 6 and 10: what a port may touch, the one command, the
guard, how a port is committed). Then, for each of perl, swift, ocaml and
lua, the last report of its pipeline: `P/results/s3b-verify-<lang>.txt`
(and `s3b-fix-<lang>.txt`): they say what state each port is in at its
last commit and what fails there on purpose.

Your PATH, at the top of every shell:

```sh
export PATH=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/zigenv/lib/python3.12/site-packages/ziglang:/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH
```

## The job

Four languages were ported from `P/base32` (tag `v32-frozen`, nine
languages ported), each in its own workspace, `P/ports/<lang>/`, holding
`sdkgen` (commits on `v32-frozen` that touch that language's own files),
`tools` (its hand records) and `out`. Each was then reviewed, fixed and
verified by other engineers. You put the four on one clone, with their
records, so that thirteen languages stand together. You change nothing
else: several engineers start from your tag.

```sh
mkdir -p P/v33p && cd P/v33p
cp -a P/base32/sdkgen sdkgen          # tag v32-frozen
cp -a P/base32/tools tools            # under git
mkdir -p out && ln -s P/base32/out/old out/old && mkdir -p out/new
```

1. **The start.** Build (exit 0, tree clean), regenerate
   (`REGEN=1 tools/portcheck.sh sdkgen out ts`), and check the nine
   (ts go py c zig clojure rust elixir rb) pass the one command with the
   numbers of the guide's section 11.
2. **Bring each port's commits over**, perl, swift, ocaml, lua, one
   language at a time: the commits `v32-frozen..HEAD` of
   `P/ports/<lang>/sdkgen`, fetched as a branch (never copy files by
   hand), cherry-picked in order. Leave each golden commit out: the golden
   is regenerated once, at the end. Each commit keeps its subject and
   body and loses any trailer line (`Co-Authored-By`, a session line: one
   fixer's commits carry them, and no commit of this clone may). Before
   each cherry-pick, list the files the commit touches and check them
   against the guide's section 4; report anything outside it and bring it
   anyway, as its own commit.
3. **Bring each port's records over**: from `P/ports/<lang>/tools` the
   files `hand/<lang>.json`, `counts/<lang>.json`,
   `purity-allow/<lang>.json`, `normalizers/<lang>.js` and
   `classes/<lang>.json` where present, as that tools copy's last commit
   has them (`git -C P/ports/<lang>/tools status` must be clean; if it is
   not, say what is uncommitted and take the committed state). Commit
   them in your tools, one commit per language, no trailer.
4. **Thirteen languages.** Build (read the exit code), regenerate cleanly,
   regenerate the golden once
   (`SDKGEN_GOLDEN_UPDATE=1 node --test dist-test/characterize.test.js`,
   then once without the variable) and commit it. Then:
   - the one command for each of the thirteen, with their records. Each
     port's screen must equal what its verifier reports for it. perl
     fails on purpose: it holds 14 records with outcome `defect` (its
     root quick start lost its library path; a list example prints a hash
     reference), which wait for a shared change that is not yours. Every
     other number of perl's must be clean;
   - the four ports from scratch (`SCRATCH=1`), which leaves classes open
     by design: record the numbers;
   - the guard and the reader for all twenty
     (`node --test dist-test/runtimefacts.test.js dist-test/runtimereader.test.js`
     in `sdkgen/ts`);
   - the suite without the toolchain lanes
     (`node --enable-source-maps --test --test-concurrency=2 $(find dist-test -name '*.test.js' ! -name 'generatedcompile.test.js' | sort)`);
   - the lanes on NEW for the nine (`P/v32/mine/lanes.sh` shows how: ts
     README, go README, py README, c DOC, rust DOC, `^rb: `, the zig
     documentation lane) and perl's (`tools/before/run.sh sdkgen perl`);
   - the seven unported languages (js php csharp java kotlin scala cpp):
     README and REFERENCE identical to `P/base32/out/new`; and every root
     README differs from `P/base32/out/new` only inside the four ports'
     own code blocks;
   - the tools' self-test
     (`node tools/selftest.js --clone sdkgen --old out/old --new out/new --stage2 P/probe-ref/harness/out --tmp <a directory of yours>`).
5. **Tag `v33p`** with a clean tree after a build; the tools committed,
   status clean.

A conflict is not expected (each port touched its own files; the golden is
regenerated). If one happens, or a port's numbers differ from its
verifier's, stop on that language, say exactly what differs, and go on
with the others.

## This job can be interrupted, and the machine is shared

Keep `P/v33p/PROGRESS.md` from your first step: one line per finished step
(with the commit). If it exists when you start, an earlier run was
interrupted: read it, check it against `git log` and `git status`,
discard uncommitted changes it does not describe, re-run what you rely
on, and continue. Other engineers work on this machine (4 CPUs, 15 GB):
one heavy command at a time, the suite with `--test-concurrency=2`.
After every source change run `npm run build` and read its exit code.

## What you report

Per port: the commits brought (old hash, new hash, files), any trailer
removed, anything outside section 4, the records brought. The one
command's last line and numbers for each of the thirteen, beside the
verifier's for the four. The checks of step 4, each with its command and
result. What fails on purpose at the tag. What you did not get to.
Separate what you ran from what you read.
