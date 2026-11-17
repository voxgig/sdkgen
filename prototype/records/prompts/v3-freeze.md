# v3-freeze: finish interface version 3 and freeze it

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your key is `freeze`; your directory is `P/freeze/`. Write nowhere else.
Never modify anything under `/home/user`.

Read first: `P/brief.md`, `P/brief2.md`, `P/brief3.md` (the principle as it
now stands, the measures, how to commit), `P/stage2-worklists.md`,
`P/prompts/v3-shape.md` and `P/prompts/v3-tools.md` (what the two engineers
before you were asked to do). Their results are given to you below this
file's text in your instructions; their directories are `P/v3` (source
changes, HEAD of `P/v3/sdkgen`) and `P/v3tools` (review tools and their
`README.md`).

## The job

Six engineers will each port two of the remaining languages against what you
freeze, in parallel, in separate clones, and their work will be merged. So
after you, a port must touch only that language's own files unless the
interface truly lacks something, and a porter must be able to tell, with one
command, whether the port is right.

Set up:

```sh
export PATH=/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH
mkdir -p P/freeze && cd P/freeze
cp -a P/v3/sdkgen sdkgen && cp -a P/v3/harness harness && cp -a P/v3/oldclone oldclone
cp -a P/v3tools tools            # then drop its oldclone copy if it has one: use ./oldclone
```

Rebuild, regenerate, and confirm the state you were handed before changing
anything.

Do the parts in this order, committing after each as `brief3.md` says.

## 1. What was left

Finish whatever the first engineer reports as not done (their `stopped_at`
and `gaps`), in the order of their brief. If something they report as done
is not, say so and fix it.

## 2. The guard, on declared forms

Today `ts/test/runtimefacts.test.ts` matches method declarations with
regular expressions that grew per port. It knows six language forms, checks
names only, and passes wrong parameters, wrong return types and wrong nouns.
Rebuild it:

- Each language declares how its runtime writes things, in a file of its
  own (so that adding a language adds a file and edits none): where its
  runtime sources are (fragments, templates, the Main, MainEntity and
  EntityBase components), how a method or function declaration looks, how an
  operation's return looks for its result style, and how each kind of member
  looks.
- The guard then re-derives, for every ported language: each operation's
  method name; each declared signature's function, and its parameter count;
  the result style; the record accessor; every member the runtime defines
  against every member the table declares, both ways; the field-type printer
  (total over the canonical types, and equal to the code generator's own
  type map where the language has one); and anything else you can derive
  mechanically.
- A ported language with no forms fails. It does not skip and does not pass.
- For each kind of fact, a negative control: change it in a provider, and
  show the guard fails; restore it.
- What the guard cannot derive (a noun, a note, a body phrase) is listed per
  language as an unguarded declared fact, and counted.

## 3. clojure's REFERENCE page

Port it, using the nouns and the client heading added in version 3. That
makes nine languages complete. It is also the test of those additions:
record anything it still needed.

## 4. Review the nine languages with the tools

Run the ledger, the blocks tool, sharing, lines and purity from `tools/`
over the corrected output for ts go py c zig clojure rust elixir, tutorial,
root quick start and REFERENCE. Fix the tools where they are wrong for the
corrected output, and say what you changed.

- Ledger: classify every missing, reworded and added class. Restore what
  should not have been lost (a shared sentence, a fact, a printer, a note),
  or drop it with a reason. Unclassified ends at 0 for all nine.
- Blocks: every block is identical, identical after named corrections,
  changed by a named unification, or individually explained.
- Record the numbers per language and section: they are the baseline the
  ports are compared with.

## 5. Freeze

- `npm run build`; the suite without the toolchain lanes; the golden; the
  lanes with a toolchain here (ts README, go README, py README with real
  pytest, c DOC, rust DOC).
- The eleven unported languages (js php rb lua csharp java kotlin scala
  swift cpp perl ocaml, less any you ported) are byte-identical to OLD,
  except for lines from already-shared components: list those lines.
- Tag the commit `v3-frozen` in `P/freeze/sdkgen`.
- Set `ok` to true in your result only if the build, the suite and the five
  lanes pass at the tagged commit and the ledgers are at 0.

## 6. The porting guide, version 3

Write `P/freeze/PORTING.md`. It replaces `P/ref/PORTING.md` and must be
complete on its own, for an engineer who has read only `brief.md` and
`brief3.md`:

- what a language supplies (naming hook, printers, declared facts, notes,
  its guard forms) and what it never does;
- the order of work, with the file to copy from for each kind of language;
- a table for the twelve remaining languages: the settled result style,
  the nouns, how the page names an entity, known constructs from the survey
  (`stage2-worklists.md` C) and how version 3 expresses each, and the command
  that compiles or runs its examples here (from the tools engineer's
  before-numbers), or that it has no toolchain here;
- how to check a port: the one command, what each number must be, and that a
  restructured block in a language with no toolchain is unverified and is
  counted as such;
- the rules a provider and a hook follow, and what the purity tool flags;
- what to do when the interface cannot express something: stop, record the
  construct with file and line, the smallest change, breaking or additive,
  the providers it would force work in;
- how to commit so six ports merge cleanly (the four separate commits of
  `brief3.md`; never commit a build or a golden together with source);
- the traps, corrected against `stage2-worklists.md` F.

Report against H1 to H5. Say plainly what crossed a line. Separate what you
ran from what you read. Say what you did not get to.
