p = '/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/record3/model-dependent-text-prototype.md'
s = open(p).read()


def rep(a, b):
    global s
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)


rep("- java: `deleted()` is not on `SdkEntity`; read (survey).",
    "- java, kotlin, scala: `deleted()` is declared only on `EntityBase`, not on `SdkEntity`, the type the accessor returns and the examples bind; read (survey; the three porters), and for java ran (javac: cannot find symbol without the import).")
rep("- csharp, scala: accessors write `active` into the caller's options map; read.",
    "- csharp, scala, kotlin, java: accessors write `active` into the caller's options map (kotlin `EntityBase.fragment.kt:28-34`); read, and for java ran: passing an immutable `Map.of(...)` as entity options throws UnsupportedOperationException.")
rep("- zig: no live transport; `fetcher_util` ends in `ctx.fail('fetch_transport', ...)` (`ts/project/.sdk/tm/zig/core/utility.zig:2332-2336`); read.",
    "- zig: no live transport; `fetcher_util` ends in `ctx.fail('fetch_transport', ...)` (`ts/project/.sdk/tm/zig/core/utility.zig:2332-2336`); read.\n- cpp, ocaml: no built-in live HTTP transport either; every live request throws `fetch_no_transport` unless the caller supplies `system.fetch` (`ts/project/.sdk/tm/cpp/utility/pipeline.hpp:600-616`, `ts/project/.sdk/tm/ocaml/sdk_runtime.ml:1574-1579`), and no page says so; ran for cpp (porter, fixer).")

anchor = "- all twenty: no runtime streams items off the network;"
i = s.index(anchor)
add = """- seventeen runtimes (all but ts, js and py): the `secrets` feature defines no `PreSpec` hook although its model declares one active (`ts/project/.sdk/model/feature/secrets.aontu`); csharp's `SecretsFeature.cs:317` says so deliberately. The model and the runtimes disagree, and shared text that trusts the model is false in seventeen languages; read (attacker).
- java: the mock drops a created record when its seed holds none for that entity (`TestFeature.java:228-231`), so an update straight after a create returns 404 in the crud tutorial, on old and new pages alike; read and ran (reviewer).
- cpp: remove keeps the entity's data and absorbs only the match from the response (`EntityRemoveOp.fragment.cpp:12-18`); ran (fixer). The other runtimes replace the data; not a defect in itself, but the shared sentence assumed otherwise.
- csharp: the pipeline marks an entity deleted after any successful operation named remove, `Stream("remove", ...)` included, and `MarkDeleted` is public (`EntityBase.fragment.cs:233-240`); read.
- php: the runtime's comments say remove keeps the data (`Entity.fragment.php:70-72, 394-395`), while `EntityRemoveOp.fragment.php:31-33` replaces it when the response carries a record; read.
- kotlin: `testOptions` sits in `SdkClient`'s companion object, so it is not reachable as `DemoSDK.testOptions` (`tm/kotlin/core/SdkClient.kt:358-361`); read, not compiled.
- streams: each runtime honours one or two forms of `callopts.signal` and silently ignores any other value (java a `BooleanSupplier`, scala and kotlin a `Function0`, swift a closure, perl a code reference, go a channel, csharp a `CancellationToken`, ts and js an `AbortSignal`; php and lua two forms); read (reviewers, attacker). Not a defect in itself; the pages did not say which.
"""
s = s[:i] + add + s[i:]
open(p, 'w').write(s)
print('ok')
