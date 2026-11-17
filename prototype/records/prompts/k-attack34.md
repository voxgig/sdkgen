# k-attack34: an independent attack on the frozen state at twenty languages

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/a34/`. Write nowhere else. Everything else under `P`
is read-only (`P/v34` included: copy from it), and so is everything under
`/home/user`.

Read first: `P/brief.md` (the proposal and the hypotheses), `P/brief7.md`
(its first section: what a porter can decide by hand is not a check), then
the integration report `P/results/s6-integrate.txt`: it is a claim. The
frozen state is `v34-frozen` in `P/v34/sdkgen`, the tools
`v34-frozen-tools` in `P/v34/tools`. The record so far is
`/home/user/sdkgen/docs/design/model-dependent-text-prototype.md`.

Your PATH: as in `P/prompts/k-integrate34.md`.

```sh
mkdir -p P/a34 && cd P/a34
git clone P/v34/sdkgen sdkgen && git -C sdkgen checkout v34-frozen
cp -a P/v34/sdkgen/ts/node_modules sdkgen/ts/node_modules && (cd sdkgen/ts && npm run build)
git clone P/v34/tools tools && git -C tools checkout v34-frozen-tools
mkdir -p out && ln -s P/base33/out/old out/old && cp -a P/v34/out/new out/new
```

## The job

You did not build this. Find what is wrong with it.

1. **The freeze checks, re-run.** Every check the integration report
   lists, on your copy: the build and clean tree, the suite, the golden,
   the guard and reader, the twenty one commands, the self-test, the
   catalogue checker. Every result that differs.
2. **Every sentence without a verdict.** The integration lists the
   sentences that no one but their author has read, and the catalogue
   round's 11 (`P/results/s4-h3fix.txt`, `needs_reader`). Read each
   against the runtimes of at least three languages of different families
   (open the line), and give it a verdict: ok, awkward or false, with the
   reason.
3. **The shared decisions.** For each decision the integration made: does
   its test fail without it (revert the hunk in a copy and run)? For each
   one it recorded and did not make: is the reason true? Is any change
   called additive in fact breaking for a provider written against 3.3?
4. **Attacks.** The earlier mutation sets (`P/v33/mine/*.json` and the
   harness `P/v33/mine/mutate.js`, if they survive; otherwise rebuild a
   set from the records), re-run; then at least five attacks per new
   language of the last seven (js java php cpp csharp kotlin scala): a
   wrong fact changed with its citation; a call printer that prints a
   call the runtime does not have; a dropped sentence; a wrong article or
   number; an import that does not resolve. For each: caught by what,
   with what message, or nothing.
5. **The pages.** Read the tutorial, root quick start and REFERENCE of
   csharp, scala and kotlin (no compiler here for two of them) in the
   baseline variation and one other, as a compiler would: every line you
   doubt, with the runtime line that makes you doubt it.

Keep `P/a34/PROGRESS.md` from your first step; if it exists when you
start, continue from it. One heavy command at a time; a background command
is stopped after 30 minutes.

## What you report

Each freeze check, theirs and yours. A verdict for every sentence. Each
decision's test, and each recorded reason, checked. The attack table: the
attack, the language, caught or not, by what. The doubtful lines. Your
judgement against H1 to H5: what the frozen state shows and what it does
not. Separate what you ran from what you read.
