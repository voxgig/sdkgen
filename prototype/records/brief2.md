# Stage 2 brief: what stage 1 showed, and what must change before the other languages are ported

Read `brief.md` (beside this file) first: the proposal, the five hypotheses
and the thresholds fixed in advance, the hard rules, the paths, the
toolchains. Then `stage1.md` (beside this file): the full record of stage 1.
This file says what stage 1 means and what stage 2 must do about it.

## What stage 1 showed

Held up:

- The README quick start was rebuilt as one shared component plus a syntax
  provider per language for ts, go, py and c, and then, by an independent
  agent attacking the interface, for zig and clojure. No changed line was left
  without a stated reason, and the 16 (then 14) unported languages stayed
  byte-identical in 19 model variations.
- Every catalogued quick-start issue is fixed in every ported language by the
  shared code; two (go indentation, a missing C include) are provider fixes.
- Examples compile and run: ts 16/16, go 12/12, py 12/12 with real pytest
  (it is at `/root/.local/share/uv/tools/pytest/bin`; put that on `PATH`), c
  5/6 with the one failure in the unported root README.
- Retiring per-language components can be made safe for existing projects,
  aliases and packs with a 136-line change to the tool that uses the copy
  record (`migrate`'s commits a49fddc0, 7bb5161b, c193a603).

Did not hold up, or was bought at a cost that has to be paid back:

1. **Naming rules ended up copied into providers.** `Syntax_c` copies
   `C_RESERVED`, `cVarName` and `cIdent`; `Syntax_zig` copies `ZIG_RESERVED`;
   `Syntax_py` re-derives the package directory. They were copied so that a
   script would count zero model reads. A provider that holds "is this name
   reserved" holds a model-dependent condition. Worse is to come: elixir's
   accessor name depends on the whole entity collection, inactive entities
   included, so no provider could compute it from the description at all.
2. **The quick start reached "100% shared prose" partly by deleting facts.**
   c lost "or NULL with *err set" and "check `err` after the call"; go lost
   its paragraph on `(value, error)` and "there is no {ok, data} wrapper"; py
   lost "returns the ENTITY — call data_get()". Deleting a true,
   language-specific fact is not sharing it.
3. **go lost its runnable program.** Its quick start was one complete
   program that the README harness compiled and then RAN in test mode. It is
   now fragments that are only type-checked. The interface had no way to
   present a section as one compilable unit, so the idiom was dropped and
   called "structure".
4. **Runtime phrases are per-language prose.** The four `RuntimeWords` are
   English fragments. By words they are 7 to 15% of the quick start's prose in
   ts, py, c and go, and 19 to 23% in zig: over the 15% line of H1 for zig by
   that measure, while by sentences the figure is 0%. Both figures are true
   and both must be reported.
5. **Decisions still made in providers.** Which fields of a record to print
   (php, rb, lua, perl pick them from the model), whether a write's result is
   printed, `Syntax_go` choosing a constructor by option count, `Syntax_ts`
   holding a list of write operation names.
6. **H2 is refuted for the quick start alone.** Four languages: 945 lines
   became 1,069. Projected to twenty: 1.59x to 1.66x, and 1.36x if the other
   providers are the size of c's. It reaches 2x only if the description and
   the example representation are reused by other sections. That reuse has
   to be measured, not assumed.
7. **An upgraded project keeps the old text.** The architect made a
   project's own `ReadmeQuick_<lang>` win over the provider, which packs need,
   and without `migrate`'s change nothing removes a leftover copy.
8. **Porting one section makes a document contradict itself.** The ts quick
   start now says `region` defaults to `eu` while the unported options table
   in the same README says it is required. A fact has to move in every
   section that states it, not in one.

## What stage 2 must build (interface version 2)

A. **Names come from the description, computed by the language's own naming
   rules.** A name that the generated code uses (the package or module, the
   client class, an entity's accessor, handle or method, a reserved-word
   rename) is decided by the functions the code generator for that language
   already calls (`utility_<lang>.ts`, `ts/src/helpers/naming.ts`). The
   description builder calls those same functions through one per-language
   hook, and stores the results (a `layout` block and per-entity symbols).
   That hook MAY read the model: it is the code generator's naming logic, and
   documentation and code must get the same answer from it. A syntax provider
   then reads names from the description and holds no naming rule, no
   reserved-word list and no string surgery on a name. Show, for at least one
   name per language, that the code generator and the description call the
   same function.

   So the proposal's sentence is refined, and the refinement is itself a
   finding: a language supplies (1) its naming rules, shared with its code
   generator, and (2) printers. It does not decide what is shown.

B. **A provider may present a section as one complete program.** Where a
   language's README test compiles and runs a whole program today, the shared
   component must be able to keep that: the same sentences, with the code
   assembled by the provider into one runnable unit. An example that the
   suite executes today must not become one that is only type-checked. go is
   the case; check what each ported language's README test does before
   deciding.

C. **Runtime facts are declared, structured, and counted.** A statement
   about a language's own runtime that does not depend on the model (how a
   failure is reported, what a list returns, how a record is read, whether a
   method exists) belongs to the language. Restore the facts stage 1
   deleted. Hold them in a declared table per language, in as structured a
   form as the shared sentences allow, and count them two ways for every
   ported language: sentences, and words. A fact that depends on the model
   may never be in that table.

   The table can drift from the runtime it describes (the hand-written
   method tables in today's REFERENCE generators already disagree with the
   runtimes: `stream` is documented in 2 languages and exists in at least 6).
   Say how it would be guarded.

D. **The decisions leave the providers.** Whether a record or chosen fields
   are printed (a declared capability of the language, with the field choice
   made once in the description); whether a write's result is shown; anything
   else `probe-interface` listed. Add `Scope.section`, a call context, and
   `RuntimeWords.one` as that probe did.

E. **The migration change is part of the build.** Take `migrate`'s
   lifecycle change (its commits a49fddc0, 7bb5161b, c193a603: `target.ts`,
   `doctor.ts`, `edition.ts`, `remove.ts`, `retire.test.ts`), not its
   stand-in. A project's own component still wins, and the record tells a
   retired copy from an override.

F. **Count interface changes honestly.** Every change to the provider
   interface or the example representation after stage 1's first commit is
   counted, marked breaking or additive, with the languages it forced
   re-work in. H1's line is about 10 breaking changes after the first four
   languages.

## Measures every stage-2 agent reports the same way

- Prose shared across the ported languages: by sentence and by word, with
  provider-declared runtime phrases counted separately from shared text.
- Code blocks byte-identical to the old output, and every changed one with
  its reason.
- Source lines before and after, counted, with the shared infrastructure
  (description, example representation, walker) shown separately so reuse
  across sections is visible.
- Model reads and naming rules in providers: zero, counted by script, and
  not achieved by copying.
- Example tests: what compiles, what RUNS, before and after.
