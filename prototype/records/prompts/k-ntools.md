# k-ntools: the one command fails on what a reviewer found by hand

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/n-tools/`. Write nowhere else. Everything else under
`P` is read-only.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md`,
`P/brief5.md`, `P/brief6.md`, `P/brief7.md`. Then
`P/results/s3b-wave1-consolidated.md` completely: every "attacks nothing
caught", every guide problem and every interface gap that names the tools
is your work list. Then `P/results/s3c-sfix-tools.txt` (how the tools
you start from identify a sentence and re-key records; its `for_ports`
says how a port's records are re-keyed). The merging engineer's report is
given below this file's text in your instructions: it says what the
thirteen languages' numbers are with version 3.2's tools. Then the tools'
`README.md` and source.

The tools you start from are the sentence round's, at the commit named at
the end of your instructions (that round's later steps may add records of
the nine languages on top of it; they do not change tool code):

```sh
mkdir -p P/n-tools && git clone P/sfix/tools P/n-tools/tools && git -C P/n-tools/tools checkout -b ntools <that commit>
# read-only, what you measure on: P/v33p/sdkgen (tag v33p: thirteen languages, version 3.2's sentences)  P/v33p/out/old  P/v33p/out/new
```

`git clone` leaves out what the tools' `.gitignore` leaves out (`review/`,
`runs/`): that is intended. The four ports' records are keyed by version
3.2's ids and are not in that copy: bring `hand/<lang>.json`,
`counts/<lang>.json`, `purity-allow/<lang>.json`, `normalizers/<lang>.js`
for perl, swift, ocaml and lua from `P/v33p/tools`, and take them through
`rekey.js` as `for_ports` says. That is the first real use of the re-key
on a port: report per language the records in, carried, merged, split,
left for a person, and lost (the expected number lost is none), and what
you had to do that `for_ports` did not say.

Your PATH, at the top of every shell: `export PATH=/opt/node24/bin:$PATH`.

**Your files**: everything under `P/n-tools/tools`. You do not change the
clone (other engineers work on copies of it at the same time). You do not
change a decision in a hand record; where a tool change opens something
that a person must decide, you list it for the engineer who freezes.

## The job

Independent reviewers attacked four new ports. Brief 7 names what the
tools let through (T1 to T6). Close each, with a control in the self-test
that is the reviewer's own attack.

- **T1. An absent sentence with no reason fails.** A shared sentence
  dropped from all 19 lua REFERENCE pages gave PASS: the absent count went
  from 35 to 36, one unexplained, and nothing failed.
- **T2. A language alone in its result style still has an absent list.**
  perl (`die`) and swift (`wrapped`) share their style with no reference
  language, so their absent list is always empty and a sentence dropped
  from every page leaves no trace from scratch. Give such a language the
  sentences every reference prints whatever its style, and say how you
  tell a style-independent sentence from a style-bound one (the templates
  are in `ts/src/cmp/ReadmeRef.ts`, `ReadmeQuick.ts` and
  `ts/src/helpers/runtimeprose.ts` of the clone).
- **T3. Purity reads helpers.** A depluralising rule
  (`name.replace(/s$/, '')`) inside a helper function of the provider
  passed. Purity follows the functions a provider or a naming hook
  defines or imports from its own language's directory, and applies the
  same rules there.
- **T4. An enumerated fact is judged or said not to be.** `prints`
  changed from `fields` to `record` (perl), `keys` from `bare` to `member`
  (ocaml), `entityBy` chosen against the old page (swift): the fact sheet
  said attested each time. The sheet judges an enumerated fact by the
  sentences and blocks its value selects among the references, as the
  README says it does; find out why these three passed, fix it, and where
  the tools cannot judge (a value no reference declares), the sheet says
  "not judged" and the one command fails until a hand record decides it.
- **T5. Smaller things the porters and reviewers met**: a generation that
  throws must fail the one command (the `node gen.js | tee` pipe drops
  the exit code: the screen says "regenerated 0 variations; SKIPPED:
  none" and every number is taken from the pages of the run before), and
  so must a regeneration that produced fewer variations than `old/`
  holds; block pairing by heading for
  headings without a parenthesis (ocaml's old `e_load reqmatch ctrl :
  entity_obj`: 163 pairs were matched by document order); the screen names
  a changed normalizer count when that is what is open; lua's printing
  helpers (`luaKey`, `luaString`) beside `jsKey` in purity's list; the
  blocks line says "(unported)" for a language the registry does not list
  although the clone shows it ported; `notes declared N, note regions
  found M` says which notes found no region; `*.open.json` is said, on
  the screen and in the README, to be regenerated on every run.
- **T6. What the independent check of the sentence round requires** of
  the tools (`required_fixes` and failed `attacks` in
  `P/results/s3c-sfix-verify.txt`), if that file exists when you reach
  this item; if it does not, say so: the engineer who freezes takes it up.

Then:

- **Every attack of the consolidated file that nothing caught**, as a
  table: the attack, where it should fail (the tools, the guard, a
  compiler, or nowhere mechanical: say why), and for those that are
  yours, the control that now fails, in the reviewed mode and from
  scratch. Re-run them: the pages of the four ports are in `P/v33p/out`.
- **A changed example no compiler sees.** For lua, swift and ocaml no
  compiler is here, and the reviewers' changed examples (a type error, two
  arguments swapped, an unwrap to a type the runtime lacks) were caught
  only as open block classes. Say what the tools can check about a printed
  call without a compiler (the member exists; the argument count; the
  receiver), given the facts the guard already holds for each language
  (`P/v33p/sdkgen/ts/test/runtimeforms/`, and the guard's JSON report), and
  build the cheapest such check that would have caught them. Say plainly
  what it cannot catch.
- **The thirteen at your last commit**: the one command for each, in the
  reviewed mode, against `P/v33p/sdkgen` and `P/v33p/out` (use a copy of
  that `out` directory under yours if a tool writes beside it): the same
  decisions as the merging engineer reports with version 3.2's tools,
  under the new sentence identity, except where one of your changes opens
  something. List every such opening per language (the class or fact, and
  what a person must decide). perl fails on its recorded defects on
  purpose.
- **The self-test**: every control passes (record any you had to move,
  with the reason); the new ones are listed with their counts.
- **The README**, version 3.3: what changed, and for a porter, what now
  fails that did not.

## This job can be interrupted, and the machine is shared

Keep `P/n-tools/PROGRESS.md` from your first step: one line per finished
item (with the tools commit), what you are in the middle of, each decision
with its reason. Commit after each finished item. Commit messages name no
tool and no model and carry no trailer. If the file exists when you start,
an earlier run was interrupted: read it, check it against
`git -C P/n-tools/tools log` and `status`, discard uncommitted changes it
does not describe, re-run what you rely on, and continue. Other engineers
work on this machine (4 CPUs, 15 GB): one heavy command at a time; the
self-test is heavy.

## What you report

Per item T1 to T6: what the tools now do, where (file, function), the
control and what it prints. The table of attacks. The printed-call check:
what it reads, what it caught, what it cannot. The thirteen languages'
numbers beside the merging engineer's, and every opening a person must
decide. The self-test's counts. What the engineer who merges must do with
your tools (exact commands). What you did not get to. Separate what you
ran from what you read.
