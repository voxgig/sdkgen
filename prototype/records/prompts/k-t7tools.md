# k-t7tools: the matching that an independent check could still fool

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your directory is `P/t7/`. Write nowhere else. Everything else under `P`
is read-only.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md`,
`P/brief5.md`, `P/brief6.md`, `P/brief7.md`. Then
`P/results/s3c-sfix-verify.txt` completely: an independent engineer
attacked the review tools after the round that made sentence identity
sound, and it is your work list (`attacks` with `sound: False`,
`required_fixes`, `stale_checks`, `rekey_port`). Their scripts and copies
are in `P/sverify` (`work/`, `run/`, `logs/`). Then
`P/results/s3c-sfix-tools.txt` (how identity and the match form work,
`ident.js` and `cut.js`) and `P/results/s3c-n-tools.txt` (what this
round's tools engineer added on top: the absent list, enumerated facts by
a minimal pair, the printed-call check). Then the tools' `README.md` and
source.

You start from the state the first half of the freeze tagged, thirteen
languages with their records decided:

```sh
mkdir -p P/t7 && cd P/t7
git clone P/v33/tools tools && git -C tools checkout -b t7        # the committed state; say which commit
git clone P/v33/sdkgen sdkgen && git -C sdkgen checkout v33a
cp -a P/base32/sdkgen/ts/node_modules sdkgen/ts/node_modules && (cd sdkgen/ts && npm run build)   # exit 0
mkdir -p out && ln -s P/base32/out/old out/old && mkdir -p out/new
REGEN=1 tools/portcheck.sh sdkgen out ts        # then the other twelve: your baseline table
```

Another engineer is working in `P/v33` at the same time (the second half
of the freeze): take only what git holds at the tag `v33a` and the tools
commit you name, and never write there.

Your PATH, at the top of every shell: `export PATH=/opt/node24/bin:$PATH`.

## The job

The design says a sentence is reviewed once: when a newly ported language
prints a sentence that equals a reviewed one after its own tokens are
masked, nobody reads it again. The check found that the tools accept, in
both modes, prose that is wrong:

1. **A slot accepts any of the language's own facts.** The match form
   masks a position when its text is one of the unit language's declared
   facts, whichever fact belongs there. Accepted automatically: zig's
   `.ok` and `.err` swapped; py's `list()` where the record reader
   `data_get()` belongs; rb's `Hash` (its record type) where its
   collection `Array` belongs; rb's comment saying "a list" (its method
   name). A position must be matched by the fact that belongs at that
   position: the same fact path, or the same printer, as the reference
   sentence's slot there.
2. **Numbers and articles.** "these 3 steps" over a program of 2, a
   heading numbered 5 in second place, "Load a ambient": no trace, or
   accepted. A number that the page itself determines (how many steps a
   program lists, a heading's position) is checked against the page; an
   article is checked against the word after it.
3. **A sentence dropped from every variation.** go's and c's branch
   sentence ("A failure is reported in the result ... so branch on ...")
   dropped from all of a language's pages leaves no trace even in the
   reviewed mode, because its code span is that language's own and the
   absent list compares within a result style. This round's tools
   engineer changed the absent list (a language alone in its style is
   held to the sentences every reference prints whatever its style): read
   what they did, then make a sentence every reference prints, compared
   with its code spans as slots, absent for a language that prints it
   nowhere, whatever the style; and a sentence dropped from one variation
   is seen from scratch too. The control the earlier engineer retargeted
   (`sentence-removed-go`) gets its original intent back.
4. **A stale build the check cannot see.** Generation reads the target and
   feature models from the staged copy under `ts/dist-test-scaffold/.sdk/`;
   an edited model that was not staged passes as current. Compare
   `ts/project/.sdk/model/**`, and every other file generation reads from
   the staged tree, with its staged copy.
5. **A stale record the check cannot see.** A hand record's quotation
   found only on an OLD page counts as found. It may count only where the
   record is about the old side (a correction, a drop, a contradiction, or
   a quotation marked as the old text).

For each: the fix, where (file, function), why it is sound (what it can
still be fooled by: say so plainly), and the independent engineer's own
attack as a control in the self-test, failing as it should in both modes.
Then try to fool your own fix with three attacks of your own per item, and
report each.

Then:

- **The thirteen languages under your tools**, the one command for each in
  the reviewed mode, beside your baseline table. Stricter matching may
  open classes that were accepted automatically: list every one per
  language (the class, the unit, why it no longer matches) and whether the
  page is in fact wrong there. You do not change a decision in a hand
  record.
- **The self-test**: every control passes; yours are listed with counts.
  A control you must move is recorded with its reason and counted apart.
- **The procedure for bringing a port onto a base whose sentences
  changed** (the check ran the README's steps literally on a copy of the
  lua port and did not reach a passing one command, because no step moves
  the port onto the new base): correct the README.
- **The README**: what changed, and what a porter will now see fail.

## This job can be interrupted, and the machine is shared

Keep `P/t7/PROGRESS.md` from your first step: one line per finished item
(with the tools commit), what you are in the middle of, each decision with
its reason. Commit after each finished item; commit messages name no tool
and no model and carry no trailer of any kind. If the file exists when you
start, an earlier run was interrupted: read it, check it against
`git -C P/t7/tools log` and `status`, discard uncommitted changes it does
not describe, re-run what you rely on, and continue. Other engineers work
on this machine (4 CPUs, 15 GB): one heavy command at a time; the
self-test is heavy.

## What you report

Per item: what the tools now do, where, the control and what it prints,
your own three attacks and their outcome, and what can still fool it. The
thirteen languages' numbers beside the baseline, with every class your
change opened and whether the page is wrong. The self-test's counts. The
commits, in the order another engineer should bring them onto the frozen
tools. What you did not get to. Separate what you ran from what you read.
