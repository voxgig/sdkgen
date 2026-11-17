# PART A progress
- share: 90 sentences (tutorial 71, rootquick 19); list in share.txt sorted by langs/classes.
- status: read briefs, tools README, PORTING s5. Starting source reading.
- read all 90 (sources: ReadmeQuick.ts, runtimeprose.ts, example.ts; outputs B, crud-bare, doc-nested, ref-issues for ts c go py rust zig elixir clojure rb; old pages for c zig rust py go clojure).
- FALSE found: "The client reads its API key [and secret] from the `X` environment variable[s]." (4 ids). No constructor reads env; the example passes os env as `apikey` (ReadmeQuick.ts:79/82; sdkdesc.ts:247; constructors read options.apikey: PrepareAuth_py.ts:114, PrepareAuth_c.ts:146, PrepareAuth_rust.ts:144).
- awkward: go pair write sentence "too" dangles when no list/load step precedes (ref-issues); program-count sentence; failsShort union verbless; "There is no {ok, data} wrapper" old go wording.
- writing verdicts now.
- DONE: 90/90 verdicts in sentences.json (ok 72, false 4, awkward 14). Remaining: report.
