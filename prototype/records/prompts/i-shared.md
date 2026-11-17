# i-shared: no value by default, examples that handle failure, true notes

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your key is `i-shared`; your directory is `P/i-shared/`. Write nowhere else.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md`,
`P/brief5.md` (what the re-check found, the rule of this stage, and who owns
which files). Then, in `P/results/s3fix-check.txt`: `blockers`, `masking`,
`output`, `runtime_table` and `citations`; and in `P/results/s3fix-final.txt`:
`gaps` and `contradictions`. `P/base/PORTING.md` section 2 says what a
language supplies.

## The job

You own the shared documentation code and the providers (`ts/src/**`,
`ts/project/.sdk/src/cmp/**`) and tests other than the guard's. You do not
edit `ts/test/runtimefacts.test.ts`, `ts/test/runtimereader.test.ts` or
anything under `ts/test/runtimeforms/`: the guard engineer (`P/i-guard`)
works on those in parallel from the same commit, and both sets of commits
will be put together afterwards. Where you add or change a declared fact,
declare it in the provider, give the runtime file and line that shows its
value in your report, and leave its citation to them (your guard run may
then fail on a missing citation: say so, and say which facts).

Set up:

```sh
P/base/newport.sh ws P/i-shared        # makes P/i-shared/ws/{sdkgen,tools,out}
cd P/i-shared/ws/sdkgen && git status --short | head -3 && git log --oneline | head -2   # 9089ed48, clean
cd ts && npm run build && git status --short | head -3
cd ../.. && REGEN=1 tools/portcheck.sh sdkgen out rb | tail -3     # the handed state: PASS
```

Useful, read-only: `P/v31/lanes.sh <clone>/ts <tag> <lanes...>` (the lane
runner of the last stage; copy it), `P/v31/unported.py` (the unported
languages against OLD; copy and re-point it), `P/h-shared/mine/printlost.js`
(counts old blocks whose print or check went).

Do the parts in this order; commit after each as `brief3.md` says.

## 1. Shared code never supplies a runtime value by default

a. `lit()` (`ts/src/cmp/ReadmeRef.ts:78`) prints `true`/`false` when a
   provider declares no `lits`. The value it prints in the two `direct`
   sentences is what the runtime puts in the result's `ok`: a fact of the
   runtime. Make it a fact every provider that prints those sentences must
   declare, with no default in shared code, and declare it in the nine
   providers from what each runtime's `direct` really returns (read each:
   give file and line). This is a breaking change of the interface: count
   it, and say which providers it forced work in.
b. Then sweep for the same thing everywhere. In `ts/src/cmp/ReadmeRef.ts`,
   `ReadmeQuick.ts`, `ReadmeRefFeatures.ts`, `ts/src/helpers/runtimeprose.ts`,
   `example.ts` and `sdkdesc.ts`: every place where prose or an example gets a
   token that could differ between two runtimes (a literal, a key, a member
   name, a keyword, a type word, a noun) from a default, a fallback
   (`||`, `??`, an optional fact with an else-branch) or a string written in
   the shared file itself. Write `P/i-shared/defaults.md`: one row per place
   with file and line, the token, and exactly one of:
   - **model**: it comes from the model or the option spec (say from where);
   - **constant of every runtime**: say what makes it one, and check it for
     all TWENTY runtimes, not the nine (for example the keys `ok`, `status`,
     `headers`, `data`, `err` of the `direct` result, `err.code`
     `request_aborted`, `$action`): give the file and line in each runtime, or
     the test of the repository that pins it;
   - **fact**: it is declared by the provider, with no default;
   - **was a default, now a fact**: what you changed.
   Anything that is none of these, fix. An optional fact whose absence
   prints nothing is fine; an optional fact whose absence prints a guess is
   what this part removes.
c. The stream sentences (`ReadmeRef.ts:119-126`) say when items are read
   ("as they arrive", "lazy"). Read how each of the nine runtimes produces
   the items of `stream` (as the caller iterates, or all before it
   returns, and whether that depends on a feature) and make each sentence
   say only what is true of every runtime that declares that kind. Then
   read the eleven unported runtimes' `stream` the same way (the re-check:
   ocaml materialises everything first, `Entity_ocaml.ts:141-152`; java and
   kotlin run the operation before returning the stream) and say, per
   language, which existing kind is true of it or what it needs. If the
   answer is a second declared fact (the type returned, and when items are
   read), add it once in shared code and declare it in the nine. Report the
   table for all twenty with file and line.

## 2. An example may not walk past a failure

The REFERENCE examples of load and remove were unified to the majority
shape of the old pages (the result bound, nothing printed). For c that
removed the `NULL` check and the read of the record that OLD had; its
sentence was fixed and its example was not, and c's root quick start, which
does check, now disagrees with its own REFERENCE.

Decide it once, by result style, in shared code: in a style where a failure
does not interrupt the program (errslot; decide pair, union and wrapped by
looking at what their printers already print and what OLD printed), an
example may not use a result, or make the next call, past a failure it has
not checked. The provider's existing printers (`attempt`, `print`, `call`)
print the check; the shared builder decides where one is needed. Styles
where a failure interrupts (throw, raise, die) keep the bare shape.

- c REFERENCE single-entity examples get the check and the read of the
  record back. Report, with `printlost.js`, how many of the 44 old c blocks
  are identical to OLD again (after the named corrections), and the same
  count for rust, go and zig before and after.
- The same rule for c's root quick start (a load after a list whose `err`
  was neither checked nor reset) and for the tutorial's write step (the
  sentence says "check `err` after each call" and the code does not).
- The c documentation lane must still compile every example (6/6), and the
  go, rust and zig lanes must not move.

## 3. Notes are true, each claim of them

- elixir: "Named with its arity, it is `list/2`" and "`load/2`" are false
  (`EntityListOp.fragment.ex:8`, `EntityLoadOp.fragment.ex`: the default
  arguments define arities 1 to 3, and the example under the note calls
  arity 1). Say what is true, or drop the arity naming and keep what OLD
  said that is true (`getelem/2`, `Helpers.deep/1`: check those too).
- Then every note of every provider (go, zig, rust, elixir, clojure): split
  it into its separate claims and check each against the runtime. Report
  one row per claim: the claim, file and line, true or false. Fix the false
  ones. A note must be one plain string in the notes table (the lint cannot
  read a note assembled from a constant elsewhere): make that so.
- rb's REFERENCE prints `Planet(data = nil)` beside "Pass `nil` for no
  initial options.": the signature is the runtime's (its parameter is named
  `data` and is passed on as the entity options, `MainEntity_rb.ts:21`). The
  same holds in other runtimes. Do not change a runtime. Make the sentence
  say it without a contradiction for a reader, once, in shared code, for
  every language whose parameter name is not the options' name.

## 4. Verify and count

- `npm run build`; the suite without the toolchain lanes; the golden.
- Lanes on your clone: ts README, go README, py README, c DOC, rust DOC,
  `^rb: `, and the zig documentation lane.
- Regenerate. The eleven unported languages are byte-identical to OLD in
  README and REFERENCE except for the lines the last stage already listed
  (`P/results/s3fix-final.txt`, `unported_changed_lines`): report any new
  line with its count.
- For the nine languages: which output lines changed against `P/base/out/new`,
  grouped by cause (the `ok` literal, the stream sentences, the checked
  examples, the notes, the accessor sentence), with counts. Run the one
  command for each and report the raw counts of new unclassified classes; do
  not classify (the next engineer does).
- Every interface change: additive or breaking, why, which providers it
  forced work in. The cumulative breaking count since the first four
  languages stood at about 11 to 13.
- Lines of each file you touched, before and after.

Report against H1, H3 and H4 for what you touched. Say plainly what crossed
a line. Separate what you ran from what you read. Say what you did not get
to.
