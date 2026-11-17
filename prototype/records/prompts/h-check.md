# check-v31: are the blockers closed, and can eleven ports start?

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your key is `check-v31`; your directory is `P/check-v31/`. Write nowhere
else. Never modify `P/base`, `P/v31`, `P/h-shared`, `P/h-guard`, `P/h-tools`
or `P/check-v3`: copy what you need.

Read first: `P/brief.md`, `P/brief3.md`, `P/brief4.md` (the eight things the
last independent check found, and the two layers). Then that check's result,
`P/results/s3a-check.txt`, whose scripts are in `P/check-v3/mine`. The
engineer who froze version 3.1 reported what is given to you below this
file's text in your instructions. Do not take it on trust: it is a list of
claims.

## The job

Eleven engineers are about to port one language each (js php lua csharp java
kotlin scala swift cpp perl ocaml) from `P/base` (`sdkgen` at the tag
`v31-frozen`, `tools`, `harness`, `runtime-table.md`, `newport.sh`,
`PORTING.md`), each followed by an independent reviewer. The last check said
"not ready as written" and named blockers. You say whether each is closed,
with evidence you produced yourself, and whether anything new stands in the
way. Assume that a fix can be reported and not made, and that a tool that
reports 0 may be blind.

Set up: copy the base into your directory (`cp -a P/base/sdkgen P/check-v31/sdkgen`,
the same for `tools` and `harness`), rebuild, regenerate NEW yourself, and
compare with the handed output.

Check, in this order of importance:

1. **Classification.** Apply the earlier check's injections through the new
   process (`autoclass.js` with `inj3.json`, `autoclass2.js` with
   `inj4.json`, adapted to the new layout): py "`ok` is `True`", go "except
   for a non-2xx response", py "returns `None` on failure", ts `region`
   "Required." rebuilt from scratch, the zig type echo. Is any accepted
   without a human? Then inject at least eight false or weakened sentences
   of your own into the NEW output of rb and of two other languages, of the
   kind a wrong fact or a careless port would produce (a wrong literal, a
   wrong failure word, an optional parameter said to be required, a dropped
   sentence, a changed number, a wrong return), and record for each whether
   it is left for a human, and whether the fact sheet shows it. Read the
   shared-sentence matching: what does it mask, and can a wrong declared
   fact hide behind a mask with nothing else showing it?
2. **The note lint.** The five injected notes of the earlier check
   (`pmuts-notes.json`): flagged? A provider whose notes the lint cannot
   find: an error?
3. **The guard.** Re-run the 52 source mutations (`mutate.js`,
   `muts1.json`) on a copy of the frozen clone, rebuilding each time. For
   each: caught, or the fact's account (cited, language, convention). List
   every one that is neither. Then audit twelve cited facts across at least
   five languages: does the quote exist where the forms say, and does it
   show the declared value? Delete a forms source file and build
   incrementally: does the guard fail? Add a provider with no forms: does it?
4. **The eleven runtimes.** For ocaml, perl, java, swift, lua and kotlin,
   read the language's section of `runtime-table.md` against its runtime
   (`ts/project/.sdk/src/cmp/<lang>/fragment/`, `tm/<lang>/`): every
   operation's parameters and return, the result style, the record
   accessor, the members, the stream kind. Report each thing that is wrong
   or missing, with the file and line. A porter will write facts from this
   table.
5. **The guide, as a porter.** Run `newport.sh` for two languages you will
   not port (one of ocaml or swift, one of php or perl) and follow
   `P/base/PORTING.md` up to the point of writing the provider: does the one
   command run and say the language is not ported; are the files a porter
   must write and may not touch stated exactly; is each number the command
   prints explained; is there anything that would make two ports collide
   when merged, or make a porter edit a shared file? Name it with the
   section.
6. **The output.** For rb and two other ported languages, read OLD and NEW
   side by side for the baseline and two other variations (the tutorial, the
   root quick start, the REFERENCE), and the README's Features section of
   two unported languages. Report anything false, weaker than before, or
   awkward that the tools did not flag. Check in particular what this stage
   claims to have fixed: the display field and the fields of a nested
   entity (rb, `doc-nested`); c's load and remove sentences carrying the
   NULL result and the read of the record; the action table's call; go's
   write sentence; the README Features wording against the REFERENCE; the
   elixir and clojure notes.
7. **The numbers.** Reproduce at `v31-frozen`: the suite without the
   toolchain lanes; the golden; the lanes (ts README, go README, py README,
   c DOC, rust DOC, `^rb: `, the zig documentation lane with all six
   models, and that zig lane on `P/freeze/oldclone`); the eleven unported
   languages byte-identical to OLD apart from the lines the freeze names;
   source lines; the guard's account per language.

Give a verdict: ready, or not ready with each blocker and the smallest fix.
Report against H1 to H5. Say plainly when a threshold is crossed. Separate
what you ran from what you read. Do not soften a refutation and do not
invent agreement.
