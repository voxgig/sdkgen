# Part B progress
Share: 100 sentences (reference, id 0-7). Ordered list: share.txt.
Status: read briefs, tools README, PORTING s5. Starting source reading.
- Read all 100 sentences against NEW B pages (ts go py c zig rust clojure elixir rb) and runtimes.
- Findings so far: direct() Returns sentence false (non-2xx -> no err); ctrl example `explain: true` false (runtimes take a map);
  clojure "lazy sequence" over items already realised; c/clojure accessor dropped "entity" (says less than OLD).
- Writing verdicts via work/verdicts.js -> sentences.json.
- DONE: 100/100 verdicts in sentences.json (ok 85, false 7, awkward 8).
