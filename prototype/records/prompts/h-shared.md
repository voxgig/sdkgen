# h-shared: the shared-code defects, on top of the Ruby pilot

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your key is `h-shared`; your directory is `P/h-shared/`. Write nowhere else.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md` (what
the independent check found, and the rules of this stage). Then the parts of
`P/results/s3a-check.txt` named `output_defects`, `facts_status`,
`defects_status` and `misclassified`, and of `P/results/s3a-pilot.txt` named
`interface_gaps` and `facts`. Consult `P/results/s3a-shape.txt` and
`s3a-freeze.txt` for how things were built.

## The job

Nine languages are ported (ts go py c zig clojure rust elixir, and rb by the
pilot). You fix, once and in shared code wherever the defect is shared, what
the check and the pilot found wrong in what those nine print. Eleven more
languages will be ported on top of your result without touching a shared
file, so anything a shared builder or sentence gets wrong must be right when
you finish.

Two engineers work beside you from the same starting commit. One rebuilds
the guard in `P/h-guard` and owns `ts/test/runtimefacts.test.ts` and
everything under `ts/test/runtimeforms/`: **do not edit those files**. Their
commits will be put on top of yours. If a change of yours adds or changes a
declared fact, declare it in the provider, say so in your report, and leave
the guard to them. One rebuilds the review tools in `P/h-tools`: use the
existing tools to look at your output, and do not classify anything.

Set up:

```sh
mkdir -p P/h-shared && cd P/h-shared
cp -a P/pilot-rb/sdkgen sdkgen && cp -a P/pilot-rb/harness harness
cp -a P/pilot-rb/tools tools && cp -a P/pilot-rb/my my
cd sdkgen && git status --short | head -3 && git log --oneline | head -3   # expect 2a87287f, clean
```

`P/freeze/oldclone` is the pristine old code (9aebaf9e), built: use it
read-only for old lanes; never build in it. `harness/out/old` is its output.
Rebuild your clone once, regenerate NEW, and confirm the handed state (the
Ruby one-command check passes; `git status` stays clean after a build)
before changing anything.

Do the parts in this order; commit after each, as `brief4.md` says.

## 1. What the Ruby pilot found in shared code

a. `showFields` in `ts/src/helpers/sdkdesc.ts` compares a field type with
   `'$STRING'`, but the model writes types with backticks, so no display
   field is ever chosen and only the id prints. Compare through the
   canonical key. Then decide once what is shown when an entity has no
   string field: look at what the old rb, php, lua and perl components did,
   and follow the majority.
b. The fields shown for an entity come from that entity, not from the
   example entity (the tutorial of the `doc-nested` variation loads a nested
   entity and prints it with the other entity's fields).
c. `prints: 'fields'` applies everywhere today. Look at the OLD output of the
   languages that print chosen fields (rb, php, lua, perl): where each printed
   chosen fields and where the whole record (tutorial list, tutorial load,
   root quick start, REFERENCE). Express what two or more of them share as an
   enumerated value of `prints`, decided in shared code; the provider still
   only prints.
d. "Returns a copy of the current data." was dropped from the shared
   sentence for the data getter. It is a fact of a runtime: read each of the
   nine runtimes (and say what you read for php and perl, which are not
   ported yet), declare it per language as data (an optional field on the
   member), and write the sentence once.

## 2. What the check found weaker than before

a. **c and rust, REFERENCE load and remove examples.** The shared builder
   prints the majority shape of the twenty old pages (bound, not printed);
   keep that rule, it is what keeps blocks identical to the old ones and
   therefore verifiable. But no fact may be lost with the example: check that
   the sentences above each example state, for every result style, how a
   failure shows and how the record is read (for c: the NULL result and
   `*err`, and `vt->data`). Where a style's sentence does not, fix the
   sentence in `runtimeprose.ts`. Report the count of old blocks whose print
   or check went, per language, as a named unification.
b. **The action table's Call cell** (`/planet/{id}/terraform` shown as
   `create({ $action: 'terraform' })`). The call must carry the route's path
   parameters, and say that the action's own arguments go beside them, as the
   old ts page did. Once, in the shared builder.
c. **go** (and lua after it): the tutorial states the `(value, error)` pair
   only for List and Load, and its write step has no sentence. The pair
   style's sentences cover the writes.
d. **The README's Features section** is printed by the already-shared
   `ts/src/cmp/ReadmeFeatures.ts` and says no feature is active ("no
   logging"), while `log` is active by default. It must state what the
   REFERENCE states, from the same place: one function decides which features
   are active by default, and both components call it. This changes the
   README of all twenty languages: list the changed lines and count the files.
e. **elixir**: the arity naming (`list/2`, `load/2`, `getelem/2`) and the
   `Helpers.deep/1` sentence were dropped as "elixir-only prose". That is
   what a runtime note is for: restore them as notes. **clojure**: the
   keyword-lookup sentence likewise; and the page lost every route to the
   utility (`sdk.api` does not export `get-utility`, `sdk.client` does:
   `tm/clojure/src/sdk/client.clj`). Say on the page what is true.
f. **zig**: `std.posix.getenv` does not exist in Zig 0.16
   (`P/mine/zig-new.log`). Fix the one printer in `Syntax_zig.ts` so that the
   documentation lane passes all six models
   (`node --test --test-name-pattern '^zig: every documented example compiles' dist-test/generatedcompile.test.js`).
   `tm/zig/feature/secrets.zig` shows what the runtime itself does. Say where
   the old idiom remains in unported zig components.

For each item of `output_defects`, `facts_status` (every "still-lost" and
"dropped-not-accepted") and `defects_status` (every "partly" and
"not-fixed") in the check's result, give one outcome: fixed (how, where);
not fixed because it is in an unported README section (name the section and
the component); or not fixed, with the reason.

## 3. Verify and count

- `npm run build`; the suite without the toolchain lanes; the golden
  (`SDKGEN_GOLDEN_UPDATE=1 node --test dist-test/characterize.test.js`, then
  the check without the variable).
- Lanes, each on your clone: ts README, go README, py README, c DOC, rust
  DOC (patterns in `P/results/s3a-freeze.txt`, `lanes`), `^rb: `, and
  `^zig: `. For zig also run the documentation lane on `P/freeze/oldclone`
  and report old against new.
- Regenerate. The eleven unported languages (js php lua csharp java kotlin
  scala swift cpp perl ocaml) are byte-identical to OLD in README and
  REFERENCE except for lines from already-shared components: list every such
  line with its count.
- Run the existing ledger and blocks tools for the nine languages and report
  the raw counts (same, reworded, missing, added; identical and changed
  blocks). Do not classify.
- Every interface change you made: additive or breaking, why, and which
  providers it forced work in. Cumulative count since the first four
  languages (the check counted about 10 breaking).
- Source lines of each shared file and each provider and hook you touched,
  before and after.

Report against H1, H3 and H4 for what you touched. Say plainly what crossed
a line.
