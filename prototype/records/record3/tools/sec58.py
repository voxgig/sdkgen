p = '/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/record3/model-dependent-text-prototype.md'
s = open(p).read()

anchor = "\nDefects of sdkgen's own tools, found by the H5 rounds:"
i = s.index(anchor)
add = """- js: the README tutorial and root quick start mix `require` with top-level `await`, which node 24 refuses before the first statement (ERR_AMBIGUOUS_MODULE_SYNTAX); as written, OLD runs 20 of 24, 13 of 17 and 13 of 17 programs in three models; js has no README example lane; ran.
- js: the old pages were an older copy of the ts components: no server variables, no secret, no Actions table, a false utility-copy sentence, and TypeScript fences on the REFERENCE; read (porter).
- ts, js: the README methods table calls `utility()` a "Deep copy of the SDK utility object" (`ReadmeModel_ts.ts:103`, `ReadmeModel_js.ts:79`); both return the live object; ran; corrected at the integration.
- php: the root quick start fails from the repository root at `require_once 'demo_sdk.php'` in every model, which the README example test cannot see because it strips that line; ran.
- php: the REFERENCE and README call the GraphQL entity's accessor `GraphQl()`, which reaches the client's own `graphql()` and throws ArgumentCountError; the generated accessor is `GraphQl_`; ran.
- php: the old display-field pick compared a field type with `'$STRING'` without the backticks the model writes, so it never matched and fell back to the first non-id field; read.
- php: the unported README says every accessor call creates an instance (the runtime caches it) and that `err` is set on any error; read.
- cpp: the README's error-handling section prints TypeScript and tells the reader to branch on `getp(result, "ok")`, which cannot be a condition; the README promises a mock transport without the test feature, and its own test-mode block then throws `fetch_mode_block`; read and ran.
- csharp: the old REFERENCE branched on `result["ok"]`, an `object?`, which cannot compile as a condition, and declared false `= null` defaults on TestSDK, Direct and Prepare; read.
- twelve README components (py, kotlin, perl, csharp, java, php, swift, ts, scala, clojure, cpp, js): "On error, `ok` is `false` and `err` contains the error value", where a readable non-2xx response sets no `err`; read (kotlin verifier; checked against kotlin's runtime, not each one).
- cpp, csharp, php, scala: the old tutorial jumped from step 1 to step 3 when there was no list step (swift's is above); read.
- scala: the example literal table puts a bare `1.0` into a `Map[String, Object]`, believed not to compile under Scala 3 (four old READMEs); read, no compiler; boxed in the ported sections.
- `ts/test/generatedcompile.test.ts`: the csharp lane "the project builds" returns, and so passes, when dotnet is missing, instead of skipping visibly; read (csharp verifier, attacker).
- `ts/src/cmp/FeatureDocs.ts`: `FIXED_ORDER_TARGETS = ['lean']`, a shared branch on a target's name, under which the cost-and-cache ordering sentence is false for lean; read (builder of the catalogue edits).
"""
s = s[:i] + "\n" + add.rstrip("\n") + s[i:]
open(p, 'w').write(s)
print('ok')
