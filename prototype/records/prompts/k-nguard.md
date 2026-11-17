# k-nguard: what a porter can decide by hand is not a check

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/n-guard/`. Write nowhere else. Everything else under
`P` is read-only. Do not read `P/survey` or `P/results/s3c-survey.md`:
other engineers are reading the twenty runtimes for the same facts, and
your reading is only worth having if it is made without theirs.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md`,
`P/brief5.md`, `P/brief6.md`, `P/brief7.md`. Then
`P/results/s3b-wave1-consolidated.md` completely: every "attacks nothing
caught", every "still wrong" and every fresh attack is your work list
where the guard is the place to catch it. Then the last guard engineer's
record `P/results/s3fix2-guard.txt`, the freeze's `P/results/s3fix2-final.txt`
(`mutations`, `account`), and `P/base32/PORTING.md` sections 2, 3 and 6.
The merging engineer's report is given below this file's text in your
instructions: it says what state you start from.

```sh
mkdir -p P/n-guard && cp -a P/v33p/sdkgen P/n-guard/sdkgen     # tag v33p: thirteen languages ported
```

Your PATH, at the top of every shell: `export PATH=/opt/node24/bin:$PATH`.

**Your files**: `ts/test/runtimefacts.test.ts`,
`ts/test/runtimereader.test.ts` and `ts/test/runtimeforms/**` (the shared
framework `forms.ts`, `account.ts`, `guard.ts`, and the forms file of each
of the twenty languages). **Not yours**: `ts/src/**` and
`ts/project/.sdk/**` and the tools. You read providers; you do not change
them. Where a provider is wrong, your test fails and says so, and you list
it for the engineer who freezes. Two other lines of work touch the clone
you copied, each on its own copy: the sentence round (`P/sfix`) is
changing shared sentences and may change a citation in the forms of some
of the nine; a shared engineer will then make brief 7's numbered decisions.
The engineer who freezes brings your commits onto theirs, so keep each of
your commits small and about one thing.

## The job

Four ports were made by the guide, and independent reviewers then changed
their facts to see what fails. Too often nothing failed but an open class
in the comparison with the old page, which the porter decides by hand.
Brief 7 names seven things the guard must do (G1 to G7). Make them, each
with a control that shows it: the reviewer's own attack, applied to a
copy, fails in the guard with a message naming the fact.

- **G1. A pinned value is compared, always.** Today a citation's `value:`
  is compared with the declared value only for prose. lua's `okFalse`
  declared `'nil'` and ocaml's declared `'false'` against a pin of
  `Bool false` both pass, because the wrong token stands somewhere in the
  quoted line. Run the guard over all twenty forms files with the change
  and report every citation that now fails: each is a declaration that
  differs from its own pin.
- **G2. The constructor exists, and calls are made on what the runtime
  declares.** `layout.ctor` from the naming hook (lua `sdk.create` passed)
  must name a member the runtime declares on that type or module, and its
  binding must be the one the imports printer binds. The receiver form a
  printed call uses (lua's `:` against `.`, a `->`, a module prefix) must
  agree with the member's `on`.
- **G3. Arity.** A printed constructor or test call passes as many
  arguments as its signature declares (ocaml `test_with Noval` against two
  parameters passed). The same for operations: have the guard ask the
  provider's own `call` printer for a call of each operation and count
  its arguments against the signature the forms derive, allowing for the
  parameters the runtime declares optional (swift's printer changed to
  print `load(nil)` against two parameters with no default passed).
- **G4. `on` from the signature too.** A test signature written on an
  instance (`$client->test(...)`) passed because only the call string is
  read.
- **G5. A call told from a field in the runtime's own notation.** The
  guard sees a call only through `name(`. ocaml's runtime declares
  `e_load : value -> value -> entity_obj`; with `parenless` the
  field-or-call check is off, so the port wrote signatures that are
  neither OCaml nor the runtime's. Let a forms file say how a call is
  recognised in its notation, keep the check on, and say what it would
  take for ocaml's signatures to move to the arrow form (do not change the
  provider). The same for rb, which is parenless already: is its check on?
- **G6. An absence is searched everywhere.** The search for "no cancel"
  ran over files the porter chose; in lua and in ocaml the file left out
  holds the word. An absence runs over the language's whole runtime (its
  trees under `ts/project/.sdk/src/cmp/<lang>/` and
  `ts/project/.sdk/tm/<lang>/`, tests apart); an exclusion is a quoted
  region with its reason, and a new use outside it fails. Re-make the
  absence of every one of the twenty forms files that has one, and report
  what each search now finds. Expect this: most runtimes' streams read
  `callopts.signal` although their operations cannot be cancelled. The
  shared engineer is splitting that into two facts (`cancel` for
  operations; an optional `streamSignal`, cited): shape the forms so that
  both can be accounted for, and say which of the twenty runtimes' streams
  read a signal, with file and line.
- **G7. Type words.** A provider's words for the field types
  (`integer`, `int`, `string`) are checked against nothing but the old
  page (perl `integer` to `int`, ocaml `int` to `float` passed). Where the
  generator has the language's own type words (the shared `canonToType`
  column, used by `EntityTypes_<lang>`), compare the provider's with them
  and let a difference need a reason; where it has none (perl), give those
  words an account of their own kind in the report, counted, that the
  reviewer audits.

- **G8. The record expression, whole.** The guard re-derives only the
  trailing accessor name of `facts.record`. swift's record carries an
  unwrap before it; with the cast dropped (`({var}.asNative)?.data()`,
  which does not compile) the guard passed, and the check a fixer added
  in swift's own forms accepts any substring of the unwrap's quote. Every
  member and type a record expression names must exist in the runtime,
  and an unwrap in it must be the cited unwrap fact itself. Do it in the
  shared framework, for every language whose record is more than one
  call.

Then:

- **The accounts for what the shared engineer adds.** Brief 7's decisions
  bring optional facts: `accessor.cached`, `streamSignal`, `copy` on a
  match getter, how prose names a member, a field flag on a member, the
  deleted mark, the place of an import, what the client's members are
  called on for their heading. You cannot see their final names. Prepare
  the guard for each kind: derived where the forms already read it
  (`field`, `on`, the accessor), cited otherwise; never `language` or
  `convention` for something a runtime file shows. Write down, for the
  engineer who merges, exactly where each account goes and what it will
  check.
- **Every attack of the consolidated file that nothing caught**, as a
  table: the attack, where it should fail (the guard, the tools, a
  compiler, or nowhere mechanical: say why), and for those that are yours,
  the control that now fails. Apply each to a copy of the clone
  (`P/v32/mutwork/mutate.js` shows the harness: apply, rebuild, run the
  guard and the reader, restore).
- **Nothing lost**: the mutations of the last freeze (the 75, the guard
  engineer's 19, the freeze's 12: `P/v32/mutwork`) are caught as before,
  or better; list any caught less.
- **The reader for all twenty** passes, and `runtime-table.md` is
  regenerated (`SDKGEN_RUNTIME_TABLE=<path>`), with a row for whatever you
  now read: what a constructor is called on, the receiver form, whether a
  stream reads a signal, the deleted mark where the runtime has one, the
  accessor's cache. Correct the rows the four porters found wrong (they
  are listed in the consolidated file) where their forms did not.

At your last commit: `npm run build` exits 0; the guard and the reader
pass for all twenty, except where a provider is now shown wrong (list each
such failure with the fact, the provider line and the runtime line: those
are findings, not things to excuse). Your commits touch only your files.

## This job can be interrupted, and the machine is shared

Keep `P/n-guard/PROGRESS.md` from your first step: one line per finished
item (with the commit), what you are in the middle of, each decision with
its reason. Commit after each finished item. Commit messages name no tool
and no model and carry no trailer. If the file exists when you start, an
earlier run was interrupted: read it, check it against `git log` and
`git status`, discard uncommitted changes it does not describe, re-run
what you rely on, and continue. Other engineers work on this machine
(4 CPUs, 15 GB): one heavy command at a time. After every source change
run `npm run build` and read its exit code.

## What you report

Per item G1 to G7: what the guard now checks, where (file, function), the
control and its failing message, every forms file you changed and why, and
what it found in the thirteen ported languages (each failure is a wrong
provider or a wrong forms file: say which, with the runtime line). The
table of attacks. The mutation counts beside the last freeze's. The
account per language (derived, cited, absence, pinned prose, language,
convention, and the new kind for type words). The stream-signal table for
twenty runtimes. What the engineer who freezes must do to make the guard
meet the shared engineer's facts. Breaking changes of the forms framework (a
forms file that did nothing now fails), each with the forms files it
forced work in. What you did not get to. Separate what you ran from what
you read.
