# Stage 3a-fix: close what the independent check found, before the ports

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.

Read `P/brief.md` (the proposal, the hypotheses H1 to H5, the hard rules) and
`P/brief3.md` (the principle as it now stands, the measures, how to commit)
before this file. This file says what stage 3a produced, what its independent
check found wrong, and the rules of this stage.

## Rules for every engineer in this stage

- Write only inside your own directory under `P/` (your instructions name
  it). Never modify anything under `/home/user`. Never modify another
  engineer's directory: copy what you need.
- Environment, at the top of every shell:

  ```sh
  export PATH=/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/zigenv/lib/python3.12/site-packages/ziglang:/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH
  ```

  That gives node 24, real pytest and **Zig 0.16.0** (the repository's own
  pinned wheel, installed the way its nightly workflow installs it). Zig is
  new since stage 3a: the Zig lanes of `ts/test/generatedcompile.test.ts` now
  run here (`node --test --test-name-pattern '^zig: ' dist-test/generatedcompile.test.js`).
- Do not download, install or unpack any compiler, runtime or tool yourself.
  Check with `command -v` and report what is missing. Present here: node, tsc,
  go, python3 with pytest, ruby with bundle, php, perl, javac with mvn,
  gradle, rustc with cargo, gcc, g++, zig. Missing: lua, busted, dotnet,
  kotlinc, scala, sbt, swift, clojure, elixir, ocaml. Fetching a declared
  dependency through a build tool that is already here (npm, cargo, go, mvn,
  bundle) is fine.
- Never rebuild while a suite or a lane runs in the same clone. Regenerate
  the output after every source change before you measure.
- Commit as `brief3.md` says: shared source and tests; per-language files;
  the build (`ts/dist`); the golden; each on its own. Stage files by explicit
  path (a `git rm` followed by a plain `git commit` sweeps the deletion into
  the wrong commit). No tool or model name in a commit message.
- Separate what you ran from what you read. Say what you did not get to. Do
  not soften a failure. A count of 0 from a tool proves little until the tool
  has been seen to report something: where you rely on a 0, show the control.

## Where things stand

- `P/freeze/sdkgen`, tag `v3-frozen` (8d5ad97b): interface version 3. Eight
  languages (ts go py c zig clojure rust elixir) print the README tutorial,
  the root README quick start and the REFERENCE page through shared code and
  one provider each. Build, suite (2,546 pass, 0 fail), golden and five
  lanes pass (ts 16/16, go 12/12, py 12/12, c 6/6, rust 6/6).
- `P/pilot-rb/sdkgen` (2a87287f): `v3-frozen` plus three commits: the guard's
  forms accept a declaration with no parameter list (`bare`), Ruby ported by
  the guide in about twenty minutes, and its golden. Ruby's README lane went
  from 48/49 to 49/49. **This clone is the starting point of this stage.**
- `P/freeze/tools` (ledger, blocks, share, lines, purity, portcheck) and
  `P/freeze/my` (classify.js, rules.js, manual.json, blockexplain.js);
  `P/pilot-rb/tools` and `P/pilot-rb/my` are the same with Ruby's entries.
- `P/freeze/harness`: generates 21 model variations; `out/old` is from the
  pristine clone `P/freeze/oldclone` (9aebaf9e), `out/new` from the frozen one.
- `P/freeze/PORTING.md`: the porting guide, version 3.
- Results of stage 3a, in full: `P/results/s3a-{shape,tools,freeze,check,pilot}.txt`.
  `s3a-check.txt` is the independent check; `s3a-pilot.txt` is the Ruby pilot.

Zig, measured after stage 3a with the real compiler (logs `P/mine/zig-new.log`,
`P/mine/zig-old.log`): the documentation lane passes 5 of 6 models on the
frozen clone and 5 of 6 on the old code, with the same failure in both: under
the Basic-auth model the client example prints `std.posix.getenv(...)`, which
Zig 0.16 does not have (`tm/zig/feature/secrets.zig` explains what replaced
it). It is a defect of today's main that the prototype copied into
`Syntax_zig.ts`, in one place where the old code has it in three.

## What the independent check found (the reasons for this stage)

1. **The classification accepts false facts.** `my/rules.js` holds 106
   regex rules, 89 with no language restriction, first match wins, ending in
   `echo-agrees`, which marks every remaining "this value is still stated
   differently elsewhere in the same SDK" class as same-meaning. Injected
   false sentences were accepted automatically: py "on a failure `ok` is
   `True`"; go "except for a non-2xx response"; py "returns `None` on
   failure"; ts `options.server.region` "Required.". The ledger and the
   blocks tool themselves flagged 24 of 24 injected regressions; it is the
   classification layer on top that hides them.
2. **The note lint never ran.** `tools/purity.js` looks for `notes` at
   column 0; every provider indents it. Five injected notes naming a
   feature, an option, an entity, an operation and a server fact passed.
3. **The guard is narrower than reported**: 27 of 52 source mutations
   caught. Missed and not listed anywhere: two real operations swapped
   (list for load); parameter types and names; clojure's returns; a wrong
   non-`any` type where the code generator has no type map (zig, clojure;
   perl and ocaml are the same); a client member declared on the entity; the
   record printer disagreeing with the record fact; a deleted forms source
   file passing because its compiled file stays. Missed and listed as
   unguarded: collection noun, nouns, literals, null value, cancel,
   constructor, utility copy-or-live, direct returns.
4. **ocaml and perl cannot be read by the forms framework**: ocaml's
   operations are record fields typed `e_load : value -> value -> entity_obj`
   bound with `fun _ _ ->`; perl declares parameters in the body
   (`my ($self, ...) = @_;`). Java may need overloads read as optional
   parameters. A port would have to change the shared `forms.ts`.
5. **Merges would collide**: `rules.js` and `manual.json` are single files
   every porter extends; `classify.js` rewrites every language's classes.
6. **Output weaker than before**, in the ported sections: c's load and
   remove REFERENCE examples lost the NULL check and the read of the record;
   rust's load example lost its print; the ts action table's Call cell shows
   a call that cannot fill its route (`/planet/{id}/terraform` with no id);
   go's tutorial states the `(value, error)` pair only for List and Load and
   its write step has no sentence; elixir's arity facts and clojure's route
   to the utility were dropped rather than kept as notes.
7. **Two documents of one SDK disagree**, because one was ported and the
   other was not: the REFERENCE now says `log` runs unless disabled (true:
   `model/feature/log.aontu` has `active: true`) while the README's Features
   section, printed by the already-shared `ts/src/cmp/ReadmeFeatures.ts`,
   still says "no logging"; `region` defaults in the tutorial and is
   "Required" in the README options table; the Basic-auth `secret`.
8. **Thresholds**: H2 is refuted for the ported set (6,916 lines became
   4,968, 1.39x; 1.24x with the shared guard counted; projected 1.95x at
   twenty). H1: go's stream note is 18.9 to 20.4% of its REFERENCE prose
   (it prints under every entity, as the old paragraph did), over the 15%
   line; breaking interface changes since the first four languages are 10 to
   12, at or over the line of about 10, all from the two interface rewrites
   and none from a new language (rust, elixir, clojure's REFERENCE and ruby
   each needed 0).

The Ruby pilot added: `prints: 'fields'` cannot say "chosen fields in the
list, the whole record elsewhere", which is what the old rb and php printed;
the shown fields come from the example entity even when the tutorial loads a
different, nested entity; `showFields` in `sdkdesc.ts` compares a type with
`'$STRING'` while the model writes it with backticks, so it never chooses a
display field; the shared `dataGet` sentence dropped "Returns a copy of the
current data.", true of rb, py, php and perl; and ten problems in the guide
(`s3a-pilot.txt`, `guide_problems`).

## The two layers, stated once

Stage 2 showed the old failure (twenty copies of a sentence drifting from
the model). Stage 3a showed the new one (one sentence drifting from twenty
runtimes, and a review process that hides it). The design answer has two
layers, and this stage makes both real:

- **Sentences are shared and reviewed once.** A newly ported language may
  print only sentences that are already reviewed, with its own fact tokens
  in them, plus its notes. Anything else it prints is reviewed by hand, per
  class, for that language.
- **Facts are per language and each one is accounted for**: re-derived from
  the runtime by the guard; or cited (a runtime file and a quote the guard
  checks is still there); or a property of the language itself (a literal,
  the null value); or a documentation convention (a noun, a heading). A
  declared fact in none of these fails.

An independent reviewer per language audits the facts and reads the pages.
Neither layer may accept something because of the section it sits in, or
because a broad pattern matched it.
