# k-survey: what two runtimes actually do, with file and line

`P` is `/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2`.
Your two languages are named at the end of your instructions; they are
written `LANGS` below. Your directory is `P/survey/<first of your two
languages>/` (make it; notes only). Write nowhere else. You change no
code and run nothing heavy.

## Background, in a paragraph

A code generator produces a client SDK for an API in twenty languages. For
each language it has a runtime: components that generate source
(`ts/project/.sdk/src/cmp/<lang>/`, TypeScript files that emit that
language's code, with `fragment/` holding source templates) and plain
templates copied into every SDK (`ts/project/.sdk/tm/<lang>/`). The SDK's
documentation is being rewritten so that a sentence is written once for
all twenty languages and each language only supplies how its runtime
spells things. Four languages were just moved to that structure, and
reviewers found sentences that are false for one runtime or another,
because nobody had read all twenty runtimes for the fact the sentence
states. You read two of them, for twelve facts. Other engineers read the
other eighteen. What you report will decide what the documentation says,
so a wrong answer becomes a false sentence on a public page: answer from
the code, give the file and line, quote the line, and say "not found" or
"unsure" rather than guess.

The code is in `P/base32/sdkgen` (read-only). For a language `L`:

- `P/base32/sdkgen/ts/project/.sdk/src/cmp/L/` and its `fragment/`
- `P/base32/sdkgen/ts/project/.sdk/tm/L/`
- its old documentation, generated: `P/base32/out/old/B/L/README.md` and
  `REFERENCE.md` (and `P/base32/out/old/B/README.md`, the repository's
  root README, with a quick start per language). `B` is one model of
  several; `no-test` is one generated without the test feature.
- a table another engineer's reader made of each runtime's declarations,
  which has been wrong before: `P/base32/runtime-table.md`, section
  `## L`. Use it to find your way, never as evidence.

Names you will meet: the client (the SDK object or module), the entity
accessor (the client's function that gives an entity, for example
`client.Planet()`), the operations (`load`, `list`, `create`, `update`,
`patch`, `remove`), `direct` and `prepare` (a raw request and its dry
run), `stream`, the test constructor (`test`, `testSDK`, `test_with`),
the feature factory (`makeFeature`, `make_feature`), `ctrl` (per-call
control options).

## The twelve questions, for each of your two languages

1. **The accessor and the cache.** Called with no argument, or with the
   language's null, does the entity accessor make a new entity each time,
   or return one the client keeps? And with an argument?
2. **Getters: a copy or the live value?** For each of the client's
   options getter, the client's utility getter, the entity's data getter,
   its match getter and its entity-options getter (name each as the
   runtime spells it; say which do not exist): does it return a clone or
   the value the object holds?
3. **The stream and a signal.** Does the entity's `stream` read a signal
   from its call options (`callopts.signal` or what the runtime calls
   it)? What kind of value is it (an abort signal, a function, a flag)
   and what does the stream do when it fires?
4. **Cancelling an operation.** Can a caller cancel `load`, `list` or
   `direct` once started (a signal in `ctrl`, a cancellation token, a
   context)? If so, what does the caller get (an error code, an
   exception)?
5. **When the stream's operation runs.** At the call, when the caller
   first asks for an item, or beside the caller (a thread, a goroutine)?
   Give the lines in order.
6. **After remove.** How does a removed entity show that it is deleted
   (a field, a method, a key: its name)? Does it keep the data it held,
   or is the data cleared or replaced?
7. **What each thing is called on.** For the constructor, each test
   constructor, `direct`, `prepare`, the options and utility getters, the
   entity accessor, and an operation: is it called on an instance, on the
   type (a static or class method), or is it a module-level function that
   takes the client or entity as an argument? Write one real call of each
   as a program would write it.
8. **Fields or calls.** Which members of the entity that a program reads
   (name, client, data, match, the deleted mark, entity options) are
   fields or properties, read without a call, and which are functions or
   methods?
9. **direct's result**, in four cases: (a) a 2xx response; (b) a non-2xx
   response whose body can be read; (c) a response whose body cannot be
   read; (d) a request that cannot be made at all. For each: which of
   `ok`, `status`, `headers`, `data`, `err` the result holds and with
   what value (write `ok`'s value exactly as the runtime writes it); and
   what the function's own failure channel does (throws, a second return
   value, an error out-parameter: is it ever set by `direct`?).
10. **The test constructor without the test feature.** In an SDK
    generated without the `test` feature, what happens when the test
    constructor is called: does the feature factory fall back to a base
    feature for a name it has no class for, or does it fail (how)? Trace
    it: the test constructor, then the client's constructor, then the
    factory.
11. **`ctrl.explain`.** What type does the runtime take for `explain` in
    the control options: a boolean, or a map it fills? What happens when a
    caller passes true?
12. **What a standalone program must import.** To construct the client in
    a file of its own: (a) run from the SDK's own directory (`L/` inside
    the repository), (b) run from the repository root. Give the exact
    lines for each, and what in the runtime or its packaging makes them
    so (a package manifest, a module path, a library directory). Say what
    the old root README's quick start printed
    (`P/base32/out/old/B/README.md`) and whether that would run from the
    repository root.

And one more, briefly: **anything the old page of either language states
about the runtime that the code contradicts**, met on the way.

## How to work

Read the code, not the documentation, for every answer; then compare with
what the old page says and note a difference. Follow a call to where the
value is made (a `direct` that delegates to a helper: read the helper).
Where the two of your languages differ, say so plainly: that is the most
useful thing you can find. Keep a notes file in your directory as you go,
so that an interrupted run can be continued: if it exists when you start,
continue from it.

## What you report

For each language and question: the answer in one or two sentences; the
evidence (file, line, the quoted line; several where the answer needs
them); how sure you are (read and certain, read and inferred, not found);
and what the old page says about it, if anything. Then what surprised
you, and what you did not get to.
