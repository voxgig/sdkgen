# k-sverify: read the changed sentences, and try to fool the new matching

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/sverify/`. Write nowhere else. `P/base32`, `P/sfix`,
`P/sentences` and `P/ports` are read-only. Work on a copy:

```sh
mkdir -p P/sverify && cp -a P/sfix/sdkgen P/sverify/sdkgen && cp -a P/sfix/tools P/sverify/tools
mkdir -p P/sverify/out && ln -s P/base32/out/old P/sverify/out/old && mkdir -p P/sverify/out/new
```

Read first: `P/brief.md`, `P/brief3.md`, `P/brief4.md`, `P/brief5.md`,
`P/brief6.md`; then `P/results/s3b-sentences.txt` (what the three
reviewers found); then `P/base32/PORTING.md` sections 5 and 6. Two
engineers' reports are given below this file's text in your instructions:
the tools engineer's and the shared engineer's. Both are claims.

Your PATH, at the top of every shell:

```sh
export PATH=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/zigenv/lib/python3.12/site-packages/ziglang:/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH
```

## The job

The design says a sentence is written once and read once. The first full
reading found six false sentences and found that the tools could not tell
which units were the same sentence. Two engineers say both are now fixed.
You did not do that work and you do not trust it. You repair nothing: you
report, and you write verdicts.

1. **Every sentence that has no verdict** (changed or added by the shared
   engineer; `node tools/sentences.js --clone sdkgen --old out/old --new out/new`
   after a regeneration lists them): read it against the runtime of at
   least three languages that print it, of different families, **and
   against the eleven unported runtimes** (js php lua csharp java kotlin
   scala swift cpp perl ocaml: their ports will print it; the runtime
   table `P/base32/runtime-table.md` says where to look). Is it true of
   all twenty? Is it good? Give each a verdict (`ok`, `false`, `awkward`,
   with a note) in `P/sverify/tools/reviewed/sentences.json`. A sentence
   that replaced a false one: is the new one true, and does it still say
   what a reader needs?
2. **The six false sentences**: for each, re-run what the shared engineer
   says they ran (the generated SDK, the call) and compare. If a runtime
   template was changed (ts, js), check the fix by running it and by the
   test that is said to fail without it (remove the fix in your copy; the
   test must fail).
3. **The new matching, as an adversary.** On copies of generated pages,
   one change at a time, classified from scratch and in the reviewed mode:
   - a wrong shared word in each place the first review named as masked
     by accident (`record`, `utility`, `id`, `fields`, `data`, `err`,
     `array`), on one language's page: left open?
   - a wrong word next to a masked token; a wrong article; a wrong number;
   - a sentence of one language reworded so that only printer output
     differs: still matched as the same sentence (it should be), and a
     verdict of `false` on it then stops every language's copy matching;
   - a comment's fact changed to another language's (py's "list" on rb's
     page): left open or matched? Which is right, and why?
   - a unit after go's bold step lead dropped: seen?
   - two different templates that are now one id: find any (list the ids
     with more than one template, or whose units differ by more than
     tokens), since merging too much is the opposite failure.
4. **The re-key.** For the nine: every hand decision of `P/base32/tools`
   has one counterpart in `P/sfix/tools` (count both sides per language;
   list any that vanished, merged with a different decision, or changed
   outcome). Re-key twice: nothing changes. Take `P/ports/lua/tools`
   (copy it) through the script as the report says the ports must:
   what happens?
5. **The stale-build and stale-record checks**: make a build stale; make a
   record's quoted token vanish: does the one command fail, naming it?
6. **The nine at the frozen commit**, in your copy: build (exit code,
   clean tree), guard and reader, golden, the suite without the toolchain
   lanes with `--test-concurrency=2`, the one command for each of the nine
   in both modes after a clean regeneration, the lanes (ts README, go
   README, py README, c DOC, rust DOC, `^rb: `, the zig documentation
   lane: `P/v32/mine/lanes.sh` shows how), the tools' self-test, and the
   unported eleven against `P/base32/out/new`. Compare each number with
   the reports.
7. **The numbers the design is judged by**: distinct sentences, by
   section; how many one language alone prints, and of those how many are
   a runtime's own fact (a note), shared code one condition selects, or
   something else (list those); the prose share "by source" and "alone"
   per language. Recount them yourself.

## This job can be interrupted, and the machine is shared

Keep `P/sverify/PROGRESS.md`, one line per finished step with what you
found; if it exists when you start, continue from it (a missing or
half-made copy is removed by its full literal path and made again). Five
other engineers work on this machine (4 CPUs, 15 GB): one heavy command at
a time, the suite with `--test-concurrency=2`.

## What you report

`ok` is true only if no sentence is false, the matching could not be
fooled in a way that accepts wrong prose, no decision was lost in the
re-key, and everything in part 6 holds. Then: the verdicts (counts, and
every `false` or `awkward` with evidence); each attack with what
happened; the re-key counts; the checks of part 6 beside the reports'
numbers; the numbers of part 7; every required fix as one entry (file,
change, why); what you could not check. Separate what you ran from what
you read. Do not soften a finding.
