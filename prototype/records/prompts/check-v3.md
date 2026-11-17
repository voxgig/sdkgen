# check-v3: an independent check of the frozen interface

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your key is `check-v3`; your directory is `P/check-v3/`. Write nowhere else.
Never modify anything under `/home/user`, and never modify `P/freeze`,
`P/v3` or `P/v3tools`: copy what you need.

Read first: `P/brief.md` (the proposal, the hypotheses, the hard rules),
`P/brief3.md` (what stage 2 showed, the principle as it now stands, the
measures), `P/stage2-worklists.md`. The engineer who froze the interface
reported what is given to you below this file's text in your instructions.
Do not take it on trust: it is a list of claims.

## The job

Six engineers are about to port the remaining languages against the frozen
interface in `P/freeze/sdkgen` (tag `v3-frozen`), using the tools in
`P/freeze/tools` and the guide `P/freeze/PORTING.md`. You say whether that is
sound, with evidence you produced yourself. Stage 2's checkers found a
regression the builders' own tools had hidden; assume the same can be true
here.

Set up: copy the clone and the tools into your directory
(`cp -a P/freeze/sdkgen P/check-v3/sdkgen`, the same for `harness`, `tools`,
`oldclone`), rebuild (`export PATH=/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH`),
regenerate OLD and NEW yourself. Compare with scripts of your own where a
claim rests on a tool: a tool that reports 0 proves little until it has been
seen to report something.

Check, in this order of importance:

1. **The guard.** For each kind of declared fact, change it in a copy of a
   provider (a method name, a parameter list, a return style, a collection
   noun, a type name, a literal, a member removed, a member invented), for
   at least three languages of different families, and record whether the
   guard fails. Check that a ported language with no forms fails.
2. **The review tools.** Inject regressions into a copy of the NEW output (a
   type cell, a sentence removed, a false sentence added, a comment changed
   inside a block, a variable renamed, a block restructured) and record
   whether the ledger and the blocks tool flag each without being told
   where. Then read the classification files for three languages: is any
   class marked "same meaning" or "dropped" that is in fact a lost or false
   fact? Quote it.
3. **The defects and the lost facts of stage 2** (`stage2-worklists.md` A
   and B). For each item: fixed; partly; not fixed. For each lost fact:
   restored (as what); dropped with a reason you accept; dropped with a
   reason you do not accept; still lost.
4. **Read the output.** For three languages of different families, read OLD
   and NEW side by side for the baseline and two other variations: the
   tutorial, the root quick start, and the REFERENCE. Report anything false,
   weaker than before, or awkward, that the tools did not flag.
5. **The numbers.** Reproduce: the lanes (ts README, go README, py README
   with real pytest, c DOC, rust DOC) on NEW; the suite without the
   toolchain lanes; the unported languages byte-identical to OLD apart from
   the lines the freeze names; provider purity, including the note lint;
   language-supplied prose by words per section and language (fact tokens
   and notes); sentences in shared code that only one ported language
   prints; source lines; the count of interface changes, breaking and
   additive, from the git history.
6. **Is it ready?** Read `P/freeze/PORTING.md` as someone about to port php
   or ocaml would. Name anything that would stop them, or make two ports
   conflict when merged.

Report against H1 to H5. Say plainly when a threshold is crossed. Separate
what you ran from what you read. Do not soften a refutation and do not
invent agreement.
