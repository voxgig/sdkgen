# v3-shape: interface version 3, in the shared code

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your key is `v3`; your directory is `P/v3/`. Write nowhere else. Never modify
anything under `/home/user`.

Read first, in this order: `P/brief.md` (the proposal, the hypotheses, the
hard rules), `P/brief2.md`, `P/brief3.md` (what stage 2 showed, the principle
as it now stands, the measures, how to commit), `P/stage2-worklists.md` (the
lists you work from). Consult `P/stage1.md`, `P/results/s2-*.txt` and
`P/ref/PORTING.md` when you need detail.

## The job

Stage 2 left eight languages on the shared quick start (ts go py c zig
clojure rust elixir) and seven on the shared REFERENCE page (those but
clojure), with known defects. You correct the shared code and the interface,
so that what those languages print is right and so that the other twelve can
be ported without changing a shared file.

Two other engineers work around you. One is building review tooling in
parallel in `P/v3tools` (do not wait for it, do not touch it). One comes
after you and rebuilds the runtime guard, ports clojure's REFERENCE and
freezes the interface. So: do not rebuild the guard, but keep
`ts/test/runtimefacts.test.ts` passing, extending it only as far as your own
changes force.

Set up:

```sh
export PATH=/root/.local/share/uv/tools/pytest/bin:/opt/node24/bin:$PATH
mkdir -p P/v3 && cd P/v3
cp -a P/probe-ref/sdkgen sdkgen && cp -a P/probe-ref/harness harness && cp -a P/probe-ref/oldclone oldclone
cd sdkgen && git status --short | head && git log --oneline | head -3   # expect c66142da, clean
```

Rebuild once (`cd ts && npm run build`), regenerate NEW (`harness/README.txt`
says how), and confirm you reproduce one stage-2 number (`node diff2.js`
gives 0 unexplained) before changing anything.

Do the six parts in this order. Commit after each, following "How to commit"
in `brief3.md`. If you run short, stop at a clean commit that builds and
passes the suite, and say exactly what is left: the next engineer continues
from your HEAD.

## 1. The interface the other twelve languages need

Every change here should be additive. Count each one, and mark it breaking
if a provider that compiled before no longer does. Worklist D lists them
(items 5 to 14; the guard, item 5, is not yours).

a. The option table's container row goes through the provider's key printer
   (php and perl name it `$options`).
b. **Result styles.** Settle the style of each unported language by reading
   its runtime (`ts/project/.sdk/src/cmp/<lang>/fragment/Entity*Op.fragment.*`,
   the templates under `ts/project/.sdk/tm/<lang>/`, and what its old README
   says): js php rb lua csharp java kotlin scala swift cpp perl ocaml. Add
   each style that is missing, with its sentences written once in
   `runtimeprose.ts`: list, load, the four writes, the step comments, the
   failure clause, and direct()'s envelope where the style wraps it (rust's
   `Ok`). Known: perl dies; swift returns a `Value` that `asNative as?
   Entity` unwraps; lua returns `value, err`. Return the table: language,
   style, the file and line that shows it.
c. Separate nouns for the client's members and an entity's members, and the
   words ocaml and clojure use ("Fields", "Members").
d. A heading for a client that has no type (clojure prints `## api` today,
   which is why its REFERENCE is not ported).
e. One mechanism for what the page names an entity by: its class, its Name,
   or its module (elixir's `sym.type`).
f. The description reaches every printer: attempt, each, print and expr
   take it as a trailing parameter. Then remove elixir's workaround (its hook
   pre-qualifies the accessor) if it is no longer needed.
g. A printer can tell whether its block stands alone (a REFERENCE example)
   or follows the section's client block. Replace elixir's peek at
   `sc.declared`.
h. Constructors: an alternate constructor and each test-constructor variant
   has its own sentence, written once (ocaml `make0` and `test_with`; cpp's
   no-argument overload; go's `Test()`).
i. **One source for a name that comes from a template.** Today every hook
   restates `Name + 'SDK'` by concatenation, and rust's signature strings
   hold `{sdk}Error` while its printers read `layout.names`. Find what sdkgen
   itself uses to substitute `ProjectName` in templates
   (`ts/src/helpers/stdrep.ts`) and derive template names from that one
   place; or say precisely why that cannot be done.
j. **Imports are a fact of the page.** rust's lane compiles a block with
   every `use` line on its page, so a section cannot decide its own imports.
   Give a provider a declared way to state the page's import lines, printed
   by the tutorial's client block, and state the rule.
k. js's tutorial has a "Direct API Access" step that no statement
   represents (`js/ReadmeQuick_js.ts:156`). Decide once whether the tutorial
   has that step in every language or in none (the How-to section already has
   "Make a direct HTTP request" in all twenty), and record the decision as a
   unification.
l. Members whose shape differs by runtime: stream (iterator, generator,
   channel, list, lazy stream), utility (a copy, or the live node), the data
   accessor (one get-and-set function, a get and set pair, or a function
   whose argument is always passed and may be null). Use an enumerated kind
   where two or more of the TWENTY runtimes share the shape, and check that
   in the OLD output of all twenty (`harness/out/old/B/<lang>/REFERENCE.md`),
   not only among the ported ones. Otherwise it is a note (part 2).
m. Literals a sentence prints: none, true and false (py printed `false`).
   And reading one key of a result map as a printer (`result["ok"]`,
   `getp(result, "ok")`, `h.get_bool(result, "ok")`).

## 2. Notes, and no single-runtime sentence in shared code

Add the fourth thing a language supplies (see "The principle as it now
stands" in `brief3.md`): **runtime notes**. A note is static prose in the
provider, attached to a named slot of the shared page (a member, an
operation, a section), printed exactly when the shared page prints that
slot. It is optional and additive.

Then apply the rule. A sentence in shared code that only ONE of the twenty
runtimes can print moves to that language's notes. A fact that two or more
runtimes share stays an enumerated value with its sentence written once. Go
through the shared page and `runtimeprose.ts` and decide each such sentence
by looking at all twenty OLD outputs. The independent check measured the
candidates: go's channel paragraph, ts's cancelling and async-iterator text,
zig's error union, py's generator (ts and js share most of theirs, so those
stay shared).

Report every sentence moved, and every shared sentence that only one PORTED
language prints today but an unported language will share (name it).

## 3. Example shapes stay close to today's

The shared builders restructured examples without need: the root quick start
and the REFERENCE operation examples gained error handling, so almost no
block there is byte-identical to today's. In a language with no toolchain
here, such a block cannot be verified.

Survey the OLD output of all twenty languages (`harness/out/old/B`,
`doc-crud`, `doc-nested`) for the shape of: each tutorial step; the root
quick-start block; each REFERENCE operation example (list, load, create,
update, patch, remove); the instance example; the feature snippet; the
test-constructor example. A shape is: whether the call sits inside error
handling, whether its result is bound, whether and how it is printed (the
record, or chosen fields), which comments it carries (a type comment on a
create field, "Fields to update"). Tabulate it per language.

The builders then produce the majority shape of each section, unless a
catalogued correction requires otherwise (name it). A provider decides only
how a call outside error handling is written in its language.

Aim: as many blocks as possible byte-identical to OLD, and every remaining
difference either a named correction or a named unification (a language
whose old shape was the minority). Write the normalizers that undo each
correction as data others can reuse (`P/v3/harness/corrections.js`). Report,
per language and section: identical; identical after undoing named
corrections; changed by a named unification; changed otherwise (0, or each
explained).

## 4. Defects

Worklist A. Every item gets an outcome: fixed (how, where), or not (why).
Rules for the ones that need a decision:

- A provider's field-type printer is total for its language. It never falls
  back to `any` unless the old page printed `any` for that type. zig needs
  its table back (`git show 9aebaf9e:ts/project/.sdk/src/cmp/zig/ReadmeRef_zig.ts`).
  Where the language's code generator has a type map, the provider uses the
  same one.
- The name of a list variable is not a naming rule of any code generator.
  Decide once, in shared code, what an example calls it (see what OLD
  printed: the check found no bad plural there). A hook only adapts
  identifier style and reserved words, through functions its code generator
  has. No English pluralisation in any per-language file.
- Write comments follow the result style, as the sentences do (zig's create
  comment is false today; go's and ts's are imprecise).
- clojure's record accessor names the variable the code binds.
- The accessor sentence is true where the argument is always passed (C,
  Zig).
- go: two comments in a row before the create step; and "The steps are one
  program, shown whole after them." is awkward and wrong for one step.
- py: `list(reqmatch=None, ...)` beside "The match must include
  `planet_id`".

Items that say an unported README section contradicts a ported one: do not
port those sections. List them.

## 5. Facts lost

Worklist B. Every item gets exactly one outcome, in a table (item,
languages, outcome, where):

- a **shared sentence**, when it is true of every runtime (direct()'s result
  holds `ok`, `status`, `headers` and `data`; "every operation resolves to
  entities, not raw records", which is the repository's fundamental contract;
  what `testopts` and `sdkopts` are; what `options()` and `utility()`
  return);
- a **printer** (an idiom for reading a value);
- an **enumerated fact**, when two or more runtimes share it;
- a **note**, when it is true of one runtime;
- **dropped**, with the reason.

## 6. Verify and count

- `npm run build`; the suite without the toolchain lanes; the golden; the
  lanes with a toolchain here: ts README, go README, py README (real
  pytest), c DOC, rust DOC.
- Regenerate. The twelve unported languages are byte-identical to OLD in
  README and REFERENCE, except for lines from already-shared components you
  changed: list those lines.
- The measures of `brief3.md`, as far as they can be taken without the
  ledger tool: the block table of part 3; prose sharing; purity;
  language-supplied prose by words (fact tokens outside code spans, and
  notes) per section and language; source lines (each shared file; provider
  and hook per language).
- Interface changes, cumulative since stage 1's first commit, breaking or
  additive.

Report against H1 to H5 for what you touched. Say plainly what crossed a
line. Separate what you ran from what you read.
