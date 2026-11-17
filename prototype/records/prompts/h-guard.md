# h-guard: the guard on declared facts, for all twenty runtimes

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your key is `h-guard`; your directory is `P/h-guard/`. Write nowhere else.

Read first, in this order: `P/brief.md`, `P/brief3.md`, `P/brief4.md` (what
the independent check found, and the rules of this stage). Then, in
`P/results/s3a-check.txt`, the parts `claims` [7] to [9] and [17],
`guard_controls` (52 source mutations, 27 caught) and `ready_to_port`; in
`P/results/s3a-freeze.txt`, the part `guard`; in `P/results/s3a-pilot.txt`,
`interface_gaps` [0]. The check's mutation scripts are in `P/check-v3/mine`
(`mutate.js`, `muts1.json`, `muts1.out.json`): reuse them on a copy.

## The job

A provider declares facts about its runtime (method names, signatures, the
result style, members, nouns, literals) and shared sentences are built from
them. A wrong fact is a false sentence on every page of that language. The
guard (`ts/test/runtimefacts.test.ts`, with one forms file per language under
`ts/test/runtimeforms/`) is what stands between a declared fact and the page.
The check showed it is narrower than reported, and that it cannot read two of
the runtimes still to be ported at all.

You make the guard account for **every** declared fact, and you make it able
to read **all twenty** runtimes, so that the eleven ports to come add a
provider and never touch a shared test file.

You own `ts/test/runtimefacts.test.ts` and everything under
`ts/test/runtimeforms/`, and may add other files under `ts/test/`. **Do not
edit anything under `ts/src` or `ts/project`.** Another engineer is fixing
shared documentation code in parallel in `P/h-shared` from the same starting
commit, and your commits will be put on top of theirs: keep yours to test
files so that this is mechanical.

Set up:

```sh
mkdir -p P/h-guard && cd P/h-guard
cp -a P/pilot-rb/sdkgen sdkgen
cd sdkgen && git status --short | head -3 && git log --oneline | head -3   # expect 2a87287f, clean
cd ts && npm run build && node --test dist-test/runtimefacts.test.js       # the handed state: 29/29
```

Do the parts in this order; commit after each (shared test files; then each
language's forms file as a per-language change).

## 1. Close what the mutations showed

For each, a check in the guard and a negative control that runs as a test:

a. **An operation's method is that operation's.** Today the guard only asks
   whether some declaration of the declared name exists, so `list` and `load`
   can be swapped. Tie each of the six methods to the source that defines
   that operation (most runtimes have one fragment per operation,
   `fragment/Entity<Op>Op.fragment.*`; where a runtime does not, the forms
   say how its operations are told apart).
b. **Parameter names**, wherever the declared signature names them; and
   **parameter types**, wherever both the declaration and the signature state
   one (compared as tokens, as returns are).
c. **A member is declared on the object that has it**: an entity signature
   is looked up in entity sources only, a client signature in client sources
   only.
d. **The record printer agrees with the record fact**: print a record read
   through the provider's own printer and require the declared accessor in
   it.
e. **A returns comparison that compares nothing says so**: clojure's forms
   return `''` for both sides. Either compare, or list it as unguarded with
   the reason.
f. **Field types where the code generator has no type map** (zig, clojure,
   and perl and ocaml to come): the guard can only require the printer to be
   total and never the generic type. Say so in the forms (`column: null`
   with a reason) and count it; do not let it read as guarded.
g. **A stale compiled forms file**: `npm run build` does not remove
   `dist-test/runtimeforms/<lang>.js` when its source is deleted, so a
   deleted forms file passes. The guard fails when a compiled forms file has
   no source, or when a provider has no forms source.

## 2. Every declared fact is accounted for

Today 18 to 26 declared facts per language are "unguarded" and merely
listed. Replace the list with an account. Every leaf a provider declares in
`facts`, `ref.facts` and `notes` is exactly one of:

- **derived**: the guard re-derives it from the runtime (extend this as far
  as it goes mechanically: the constructor and accessor signatures, what
  `direct` and `prepare` return, `listOf` and the collection where the list
  operation's declaration states its return);
- **cited**: the forms file names a runtime file and a quote from it that
  shows the fact, and the guard checks the file is one of the runtime's and
  still contains the quote. Where the fact's value is itself a code token,
  the quote must contain it. A note cites the lines it describes;
- **language**: a property of the language itself, not of this runtime (the
  literals for true and false, the null value, how a map is written);
- **convention**: a word the documentation chooses (a noun, a heading, the
  container word).

Put the default category of each fact key in shared test code, so a forms
file only supplies its citations. A declared fact with no account fails.
`SDKGEN_GUARD_REPORT=1` prints, per language, the count in each category and
every cited fact with its file and quote.

Fill it in for the nine ported languages (ts go py c zig clojure rust elixir
rb), reading each runtime for the citations. Where reading shows a declared
fact is wrong, do not fix the provider (it is not yours): record the
language, the fact, the declared value, what the runtime shows with file and
line, and add a forms `exceptions` entry so the suite passes, marked
`WRONG:`. The next engineer fixes the provider.

## 3. Forms for the eleven runtimes still to port

`forms.ts` reads a declaration as a name followed by a bracketed parameter
list, or bare (Ruby, added by the pilot). Before any of the eleven is ported,
show the forms can read every one of them, by writing each language's forms
file now from its runtime alone (`ts/project/.sdk/src/cmp/<lang>/fragment/`,
`Main_<lang>.ts`, `MainEntity_<lang>.ts`, `EntityBase_<lang>.ts`,
`tm/<lang>/`): js php lua csharp java kotlin scala swift cpp perl ocaml.

Known to need more than the forms have (check each, and expect others):

- **ocaml**: operations are record fields typed
  `e_load : value -> value -> entity_obj` (`tm/ocaml/sdk_types.ml`) bound
  with `fun _ _ ->` (`Entity_ocaml.ts`); parameters are arrows, not a
  bracketed list.
- **perl**: `sub load { my ($self, $reqmatch, $ctrl) = @_; ...`: the
  parameters are in the body.
- **java**: no optional parameters; an optional argument is an overload.
- **kotlin, scala, csharp**: a member may be a property (`val name`,
  `def name: T`).
- **swift**: `func load(_ reqmatch: Value? = nil, ...) throws -> Value`.
- **lua**: `function EntyClass:load(reqmatch, ctrl)` returning `value, err`.

A forms file for an unported language has no provider to check, so add a
reader test that runs for every forms file: it requires the reader to find
the six operations (or the ones the runtime has), the load declaration and a
result style, the record accessor, and at least the client and entity
members the runtime publicly has; and it writes one table,
`P/h-guard/runtime-table.md`, with a section per language for all twenty:
each operation's method, parameters (which may be left out) and return; the
result style and whether operations resolve asynchronously; the record
accessor and its arity; every public client and entity member with its
shape (data, match, stream kind); the field types. That table is what a
porter will write the provider's facts from, so read each of the eleven
sections against the runtime yourself and correct the forms until it is
right. Compare the result style and the stream kind of each with the table
in `P/freeze/PORTING.md` section 6, and report every difference with the
file and line that settles it.

The parts of a forms file that depend on how a provider spells its
signatures (`sigName`, `sigParams`, `sigReturns`, `exceptions`, citations)
are the porter's; leave them with a comment saying so.

## 4. Controls, and what is still not caught

- The guard and every negative control pass for the nine ported languages;
  the reader test passes for all twenty.
- Re-run the check's 52 mutations (a copy of your clone; rebuild for each):
  for each, caught (by which check), or not caught and the fact's category
  (cited, language, convention). Nothing may be "not caught, not accounted".
  Add mutations of your own for what you built (at least: a citation whose
  quote no longer exists; a cited code token changed; a method tied to the
  wrong operation in three languages of different families; a parameter
  renamed; a member moved between client and entity).
- Say plainly what a wrong value still passes: a cited fact whose value is a
  prose word (a collection called a "linked list") is only as good as the
  person who audits the citation. List those per language and count them.

## 5. Verify

`npm run build`; the whole suite without the toolchain lanes; `git status`
clean after a build (the guard is test code: `ts/dist` must not change).
Report the lines of the guard and of each forms file.

Report against H1 (what a language must supply, and whether the forms
framework changed in a way that would force work in an existing forms file:
breaking or additive). Separate what you ran from what you read.
