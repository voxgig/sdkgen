// The classification rules of stage 3a, kept as a RECORD. Each one names the
// languages whose classes were read when it was written (`langs`, required)
// and applies to no other; a rule with no list is an error. A rule never
// classifies a new class: classify.js applies it only to a class id it
// already classified, at the same count (pinned/<lang>.json), and checks the
// rule still matches that class's text. `echo-agrees` (every echo
// same-meaning) is removed: an echo is a human's, as a contradiction or a
// reasoned same-meaning.
const EIGHT = ['ts', 'go', 'py', 'c', 'zig', 'clojure', 'rust', 'elixir']
const R = (name, outcome, re, o = {}) => ({ name, outcome, re, langs: EIGHT, ...o })
const W = (name, why, re, o = {}) => ({ name, outcome: 'dropped', why, re, langs: EIGHT, ...o })

const RULES = [
  // ---- server variables (S49: a templated server URL needs its variables; G01: a defaulted one is not required)
  R('server-vars', 'correction:S49', /(^|[^\w])(server|tenant|region|eu|account) \(\d+ times\)|The server URL is templated|Values for the variables the server URL is templated on|^`?options\.server|^`server(\.\w+)?`|^\+?(server|tenant|region|account)\b|"server"|server: \{|\bserver\.(tenant|region|account)\b|<tenant>|<account>/),
  R('server-required-cell', 'correction:G01', /^Required\.$|^Defaults to `[^`]*`\.$|Required: this API's server URL is templated on these/),
  // ---- HTTP Basic secret (S50, M12: the runtimes read secret only for Basic in the header)
  R('basic-secret', 'correction:S50', /DEMO_SECRET|\bsecret \(\d+ times\)|API secret for authentication|options\.secret|reads its API key and secret/),
  R('apikey-env', 'unification:client-env-sentence', /The client reads its API key from the `[^`]+` environment variable|DEMO_APIKEY \(\d+ times\)/),

  // ---- the test constructor (S13: without the test feature there is no mock transport)
  R('test-nofeature', 'correction:S13', /generated without the `test` feature|Create a test client in test mode\.|Create a test client with mock features active\.$/),
  R('test-opts-shared', 'restored:shared', /`testopts` are the test feature's options|It returns a client in test mode|^Test feature options\.$|^Additional SDK options merged with test defaults\.$|^\*\*Returns:\*\* `\w+` instance in test mode\.$|^`(testopts|sdkopts)`$|\(removed\) `(testopts|sdkopts)`|Both arguments may be `[^`]+`\.$/),
  R('test-heading', 'unification:ref-test-heading', /^Test client$|^Static (Methods|Functions)$|^Static constructors$|^Test constructors?$/),

  // ---- features (S09: log defaults on; the shared feature reference states it)
  R('features-log', 'correction:S09', /Each feature is inactive until switched on|Inactive by default: leaving it out costs nothing|Active by default: set `active: false`/),
  R('features-escape', 'correction:ref-features-escape', /The array form of \\?`feature\\?` is significant/),

  // ---- field descriptions with a pipe, a break or a relative link (G27, G29, M38, D69)
  R('field-escape', 'correction:G27', /^Level( =>|$)|^percent$|see \[the guide\]\(guide\.md\)|Words the project chose \| not the spec|see the guide or \[site\]/),
  // ---- a class name taken by a collision (U34)
  R('class-collision', 'correction:U34', /PlanetEntityClient|^PlanetEntity$/),

  // ---- tutorial lead-in and step numbering (S28: the lead-in names only steps that exist; U45: the write heading names its operations)
  R('tutorial-leadin', 'correction:S28', /^This tutorial walks through creating a client/),
  R('step-numbers', 'correction:S28', /^\d\. Load an? \w+(\s+=>\s+\d\. Load an? \w+)?$|^\d\. List \w+ records( =>|$)|^\d\. Create a client( =>|$)/),
  R('write-heading', 'correction:U45', /^\d\. Create(, update)?(, patch)?,? and remove( =>|$)|^\d\. (Update|Create|Remove|Patch)( =>|$)|^\d\. Create and remove/),

  // ---- the fundamental contract, stated once (repository rule: operations resolve to entities)
  R('entities-contract', 'restored:shared', /Every operation returns entities, not raw records|every operation resolves to entities, not raw records/),

  // ---- reference: operation sentences, written once from the result style
  R('op-failure-clause', 'unification:op-failure-clause', /(, and (throws|raises|dies) on failure\.|and raises on error\.|and throws on error\.| raises on failure\.$|It raises on failure\.|It throws on failure\.)/),
  R('op-sentences', 'unification:op-sentences', /^(Resolves|Returns) (to )?(an? |the )?(array|vector|slice|list|\w+ list|entities|entity|created entity|updated entity|patched entity)|^Remove the entity matching the given criteria\.$|^The match is optional|The match must include `|^The data must include the entity|reads its record\.$|whose record `[^`]+` reads/),
  R('op-signature', 'correction:runtime-forms', /^`(\w+\.)?(list|load|create|update|patch|remove|List|Load|Create|Update|Patch|Remove)\(.*=>  `/),

  // ---- reference: direct() and prepare(), written once
  R('direct-shared', 'restored:shared', /a result map holding `ok`, `status`, `headers` and `data`|A failed request is reported in the result, not as an error|^\*\*Returns:\*\* `[^`]+`(\.)?$|On a failure `ok` is `false`|On failure it (resolves to|returns) the error instead|the fetch definition: the request|^Accepts the same parameters as|Prepare a fetch definition without sending|^Returns the `fetchdef`|fetchdef \(\d+ times\)|Returns a result `\w+` with `ok`/),
  R('direct-rows', 'unification:direct-table', /^HTTP method \(default|^Path parameter values|^Control options \(e\.g\.|^explain \(\d+ times\)|^System overrides/),

  // ---- reference: accessors and members
  R('accessor-sentence', 'unification:accessor-sentence', /^Create a new `[^`]+` (entity )?instance\.|^Pass `[^`]+` for no initial (data|options)\.|^\*\*Returns:\*\* `\w+` instance\.$|^Initial entity data\.$/),
  R('make-sentence', 'unification:member-sentences', /instance with the same (client and )?options\./),
  R('stream-member', 'restored:fact', /Run an operation through the pipeline|stream \(\d+ times\)|^`stream\(|callopts \(\d+ times\)|^`?action`? \(\d+ times\)|^args \(\d+ times\)/),

  // ---- tokens: each appears or vanishes because of a change judged above
  R('tok-region', 'correction:G01', /^[+-]?(eu|region)\s+\(\d+ times\)/, { types: ['novel-token', 'block-novel-token', 'block-vanished-token'] }),
  R('tok-secret', 'correction:S50', /^[+-]?(secret|DEMO_SECRET)\s+\(\d+ times\)/, { types: ['novel-token', 'block-novel-token'] }),
  R('tok-server-wording', 'correction:S49', /^[+-]?(templated|these|this|URL|API|Required|is)\s+\(\d+ times\)/, { types: ['block-vanished-token'] }),
  R('tok-generic-names', 'unification:ref-generic-names', /^[+-]?(item|results|result)\s+\(\d+ times\)/, { types: ['block-novel-token', 'block-vanished-token', 'novel-token'] }),
  R('tok-nested-load', 'unification:root-load-nested', /Ⓔ_id: |example_Ⓔ_id: |^planet_id\s+\(\d+ times\)/),
  R('tok-c-stdlib', 'correction:c-stdlib', /^\+stdlib\s+\(/),
  R('tok-chain', 'unification:tutorial-write-unbound', /^[+-](getp|updated|patched|removed|returned|holds|sets)\s+\(/),
  R('tok-zig-return', 'unification:zig-bind-outside', /^\+return\s+\(/, { langs: ['zig'] }),
  R('tok-go-program', 'restored:printer', /^[+-](package|main|func|New)\s+\(/, { langs: ['go'] }),
  R('tok-elixir-print', 'unification:ref-list-printed', /^\+(Voxgig|Struct|IO|puts|jsonify|getelem|size|do|end|i|data_get)\s+\(/, { langs: ['elixir'] }),
  R('tok-c-err', 'correction:c-err-declared', /^\+PNError\s+\(/, { langs: ['c'] }),
  R('tok-update-note', 'restored:shared', /^\+(Only|Fields|change)\s+\(/),
  R('tok-testsdk', 'correction:go-testsdk-args', /^-(testopts|sdkopts)\s+\(/, { langs: ['go'] }),
  R('tok-comment-words', 'unification:step-comment-runtime-fact', /^[+-](returns|specific|all|an|reads|off|comes|failure|of|its|entities|error|s|to|single|sent|own|on|if|call|arguments|are|throws|the|terminated|string|slice|sends|resolves|non|carries|array|ENTITY|for|is|set)\s+\(/, { types: ['block-novel-token', 'block-vanished-token'] }),
  R('tok-rust', 'unification:ref-load-unprinted', /^\+(Ok|Vec)\s+\(/, { types: ['block-novel-token'], langs: ['rust'] }),
  R('tok-apikey', 'unification:client-env-sentence', /^DEMO_APIKEY\s+\(/),
  R('tok-direct-explain', 'unification:direct-table', /^(explain|jo|vstr|v_str|cmap|vbool|v_bool|jm|Bool|True|False|str|vec|Vec|_|e)\s+\(\d+ times\)/, { types: ['novel-token'] }),
  R('tok-stream', 'restored:fact', /^(callopts|action|stream|args|unwrap|Ok|IntoIter|seq|Enumerable|ambient_stream|switch)\s+\(\d+ times\)/, { types: ['novel-token'] }),
  R('tok-direct-keys', 'restored:shared', /^(status|ok|err)\s+\(\d+ times\)|^(fetchdef|result_dict)\s+\(\d+ times\)/, { types: ['novel-token', 'vanished-token'] }),
  R('tok-ts-await', 'correction:ref-6', /^await\s+\(/, { langs: ['ts'] }),
  R('tok-none-literal', 'unification:accessor-sentence', /^undefined\s+\(/, { langs: ['ts'] }),

  R('tok-action-call', 'correction:ref-6', /^(client|_)\s+\(\d+ times\)/, { types: ['novel-token'] }),
  // ---- actions: every language now shows the Actions table (stage 2), with the call printed by the provider
  R('actions-table', 'correction:ref-6', /^Actions$|exposes custom API actions|Select one with `\$action`|^Action$|^Route$|^Call$|^Operation$|action's OWN response|terraform/),
  // ---- read one by one: the missing units of the eight languages
  R('page-structure', 'unification:ref-page-structure', /^(Client|\*\*Options:\*\*|make-sdk|Client functions|\*\*Fetch args:\*\*|\*\*fetchargs keys:\*\*|Constructors|Entity Accessors|Test Constructor|Common Methods|Quickstart)$|^(Name|Type|Description)$/, { types: ['missing'] }),
  W('accessor-table', 'the accessor parameter table: the sentence under each accessor names the same argument and what to pass for none (stage 3 fact B decision)', /^(\*\*Parameters:\*\*|`object`|`data`)$/, { types: ['missing'], langs: ['ts'] }),
  W('clojure-utility', 'sdk.api does not export get-utility (Main_clojure.ts writes only make-sdk, test-sdk, direct, graphql, prepare and options-map), so OLD documented a function the namespace lacks; the guard now checks the public namespace', /get-utility|Return a copy of the SDK utility object\./, { langs: ['clojure'] }),
  W('clojure-keyword-note', 'the signatures ((:data-get ent)) show the keyword call; a sentence saying so would be clojure-only prose', /State accessors are stored on the entity map/),
  W('elixir-deep', 'the code shows Demo.Helpers.deep; a sentence on it is elixir-only prose (stage 3 decision)', /build one from a native map with `Demo\.Helpers\.deep\/1`/),
  R('direct-escape', 'restored:shared', /This escape hatch never (raises|sets)|^\*\*Returns:\*\* a result `map`\.$|^Returns a result (map|node) with `ok`|^Returns the fetchdef|^Returns the `fetchdef`/),
  R('stream-result', 'restored:shared', /`StreamResult` is `\.ok` with the items/),
  R('go-test-ctors', 'restored:shared', /^Test client with options\.$|No-arg convenience constructor/),
  R('go-program-lead', 'same-meaning', /^A complete program: create a client, then call the entity operations\.$/),
  R('go-pair-paragraph', 'restored:fact', /^Each operation returns `\(value, error\)`/),
  R('go-write-comments', 'unification:write-comment-style', /^(Create|Remove|Update) a planet\.$|^Patch a planet: only the fields given are sent\.$/),
  R('step-comment', 'unification:step-comment-runtime-fact', /^List planet records — the value is a \[\]any/),
  R('record-sentence', 'same-meaning', /^`(vt->data|data\(None\)|asEntity\(\)\.data\(null\))` reads an entity's record\.$|Read each record with `\(\(:data-get \w+\)\)`|^Iterate them directly, and call `\.data\(\)`/),
  R('write-comments', 'restored:fact', /^Create — (\.ok carries|returns)/),
  R('write-comment-id', 'same-meaning', /^Patch — sends only the fields given$|^Update$/, { types: ['missing'] }),
  R('collision-units', 'correction:U34', /^`(\.ok` (carries|is a slice)|Ok` (is a `Vec`|is the entity|is the patched|is the updated))/),
  R('remove-inactive', 'correction:S25', /^`(\w+\* )?(vt->)?remove\(|^`\(remove ent/),
  R('sig-forms', 'correction:runtime-forms', /^`(match_set\(match\)|data_set\(data\)|prepare\(client, fetchargs\) :: map\(\)|direct\(client, fetchargs\) :: map\(\))`$/),
  R('tester-notest', 'correction:S13', /^Alias for `\w+\.test\(\)`\.$|^`tester\(testopts\?, sdkopts\?\)`$/),

  // ---- read one by one: the reworded units
  R('root-step-comment', 'unification:step-comment-runtime-fact', /^(Load a specific|List all) \w+ \(/, { types: ['reworded'] }),
  R('step-num2', 'correction:S28', /^\d\. Load an? \w+\s+=>\s+\d\. Load/),
  R('write-heading2', 'correction:U45', /^\d\. Create, update, and remove\s+=>/),
  R('write-comment-id2', 'unification:write-comment-style', /^(Update|Patch) — .*\s+=>\s+(Update|Patch) — /),
  W('elixir-arity', 'arity naming (list/2, getelem/2) is elixir-only prose; RuntimeFacts.named is call or bare, and the code shows getelem (stage 3 decision)', /^`list\/2` returns/),
  R('page-structure2', 'unification:ref-page-structure', /^`options` is a `[^`]+` map\.\s+=>|^Create a new SDK client\.\s+=>|^Functions\s+=>\s+Instance Functions|^\*\*(Options|Parameters):\*\*\s+=>|^Create a `[^`]+` handle\.\s+=>|^\*\*Returns:\*\* `object`\s+=>/),
  R('elixir-utility-note', 'restored:note', /^Return the SDK utility node\.\s+=>/),
  R('sig-forms2', 'correction:runtime-forms', /^`(data_set|match_set)\((data|match)\)`\s+=>/),
  R('rust-op-sentences', 'unification:op-sentences', /^`Ok` is the \w+ entity, and `Err` a failure\.\s+=>/),
  R('zig-stream-note', 'restored:note', /^Under `throw: false` in `callopts\.ctrl`/),
  R('go-load-comment-pairing', 'unification:step-comment-runtime-fact', /^Load a single planet — the value is the entity; Data\(\) reads its record\.\s+=>/),

  R('tok-c-stream', 'restored:fact', /^ambient_stream\s+\(/, { langs: ['c'] }),
  W('tok-elixir-getelem', 'the elixir arity sentence (getelem/2) is dropped as elixir-only prose; the code shows getelem', /^getelem\s+\(/, { langs: ['elixir'] }),
  R('tok-go-load', 'restored:fact', /^Load\s+\(/, { langs: ['go'] }),
  R('tok-go-nested', 'unification:tutorial-nested-load', /^planet_id\s+\(/, { langs: ['go'] }),
  R('tok-rust-map', 'restored:shared', /^Map\s+\(/, { langs: ['rust'] }),
  R('tok-rust-result', 'unification:op-sentences', /^Result\s+\(/, { langs: ['rust'] }),
  W('tok-zig-switch', 'the instruction to switch on .ok: the union sentence states .ok and .err and the code shows the switch (stage 3 decision)', /^switch\s+\(/, { langs: ['zig'], types: ['vanished-token'] }),

  // ---- read one by one: the added units
  R('add-structure', 'unification:ref-page-structure', /^(Instance Functions|Common Functions|sdk\.api|Constructor|\*\*Parameters \(`(options|fetchargs)` map keys\):\*\*|Value type|Key|Field Usage by Operation|Field|Yes|update|`level`)$|^`options` is a `Voxgig\.Struct` map \(`nil` for none\)\.$/, { types: ['added'] }),
  R('add-type-cells', 'correction:S49', /^`(string|map|map\(\)|String\.t\(\)|dict|str|map\[string\]any)`$/, { types: ['added'] }),
  R('add-ctrl-row', 'unification:direct-table', /^`(ctrl|fetchargs\["ctrl"\])`$/, { types: ['added'] }),
  R('add-action-op', 'correction:ref-6', /^`(create|Create)`$/, { types: ['added'] }),
  R('add-secret', 'correction:S50', /^`(secret|options\["secret"\])`$/, { types: ['added'] }),
  R('add-fails', 'unification:op-failure-clause', /^It returns `NULL` with `\*err` set on failure\.$|^Its `(Err|\.err)` reports failure\.$|^`err` is non-nil on failure\.$/),
  R('add-stream-sig', 'restored:fact', /^`(voxgig_value\* \w+_stream\(|\(stream ent action args callopts\))/),
  R('add-update-note', 'restored:shared', /^(Fields to update|Only the fields to change)$/),
  R('add-write-comment', 'unification:write-comment-style', /^(Update|Patch) — .*the id comes off the created entity's record$|^(Update|Remove)$|^Create — (Ok carries|resolves to) the created entity/, { types: ['added'] }),
  R('add-note-elixir', 'restored:note', /^It is the client's own node, not a copy\.$/),
  R('add-note-rust', 'restored:note', /^The result map comes back inside `Ok` even for a non-2xx response/),
  R('add-note-go', 'restored:note', /^It sends the items on the returned channel/),
  R('add-sig-forms', 'correction:runtime-forms', /^`(direct|prepare)\(client, fetchargs \\\\ nil\) :: map\(\)`$|^`(data_set|match_set)\((data|match)=None\)`$/),
  R('add-go-test', 'restored:shared', /^Create a test client with mock features active, and no options\.$/),
  R('add-step-comment', 'unification:step-comment-runtime-fact', /^(Load an? \w+|List \w+ records): /, { types: ['added'] }),
  R('add-go-a5', 'correction:A5', /^The program after (these \d+ steps runs them in order|this step runs it)\.$/),
  R('add-go-steps', 'unification:go-tutorial-program', /^\*\*(Create a client|Create, update, patch, and remove|Create and remove|Create, update, and remove|Update)\.\*\*$/),
  R('add-go-pair', 'restored:fact', /^\*\*List \w+ records\.\*\* `List\(\)` returns `\(value, error\)`|^There is no `\{ok, data\}` wrapper/),
  R('add-nested-sentence', 'unification:tutorial-nested-load', /is nested under \w+, so provide the `\w+`\./),
  R('add-tutorial-op', 'unification:tutorial-op-sentence', /^`(load|list)\(\)` (returns|resolves to) /, { types: ['added'] }),
  R('add-ref-op', 'unification:op-sentences', /^The result's `(Ok|\.ok)` is (the entity|a slice|a `Vec`|the created|the updated|the patched)/),
  R('add-type-comment', 'unification:ref-type-comments', /^string$/, { types: ['added'] }),

]

for (const r of RULES) {
  if (!Array.isArray(r.langs) || 0 === r.langs.length) throw new Error(`rule ${r.name}: no language list`)
  for (const l of r.langs) if (!EIGHT.includes(l)) throw new Error(`rule ${r.name}: ${l} was not read when the rules were written`)
}
module.exports = RULES
