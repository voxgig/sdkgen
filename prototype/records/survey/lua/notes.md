# k-survey notes: lua, elixir
S = base32/sdkgen/ts/project/.sdk
## lua
Q1 MainEntity_lua.ts:20-26 cache when data==nil; new with arg.
Q2 options_map Main.fragment.lua:159-160 vs.clone; get_utility :168-169 Utility.copy (shallow fn copy, custom copied); data_get Entity.fragment:100-102 clone; match_get :114-116 clone; no entopts getter.
Q3 stream signal callopts["signal"] Entity:133; fn or table.aborted :166-177; on fire: coroutine returns -> iteration ends silently (nil).
Q5 coroutine created :179, body runs at first resume (iterator call) :233 -> lazy.
Q6 mark_deleted :82-84; deleted() method :87; remove replaces _data with resdata if non-nil (RemoveOp:27-28).
Q9 direct Main:265-375.
Q11 context.lua:53 explain only if table; true ignored.
Q4 none (grep signal/cancel/abort in tm/lua: none; timeout_feature.lua:3-4 sync)
Q7 SDK.new / SDK.test static on module table; methods with colon.
Q9 Main.fragment.lua:295-375 ; 2nd return always nil
Q10 _make_feature falls back to features.base (Main:70-76); optspec feature $CHILD open (src/helpers/optspec.ts:56-61); mode test -> fetcher fetch_mode_block (fetcher.lua:383)
Q12 rockspec module ["<name>_sdk"]; tests run from lua/ (busted, no package.path). Root README L93 uses sdk without require; L385 require("demo_sdk") won't resolve from root.
Old page contradictions: README:59-68 direct err convention; REFERENCE:94 explain=true.
LUA DONE (except write-up). Next elixir.
## elixir (done reading)
Q1 MainEntity_elixir.ts:20-21 always new. Q2 options_map clone Main.fragment.ex:79-81; get_utility LIVE :84; data_get/match_get clone entity_base.ex:86-88,100-102; no entopts getter.
Q3 signal 0-arity fn, entity_base.ex:117,153,172 take_while. Q5 run_op at :150 eager; streaming stream_items eager (feature/streaming.ex:47,58).
Q6 _deleted, EntityBase.deleted/1 only (Entity.fragment.ex has no deleted/1 delegate!) runtime-table wrong.
Q9 Main.fragment.ex:206-283 single map; prepare raise rescued. Q10 features.ex `_ -> Feature.new()` Main_elixir.ts:130. Q11 context.ex:71-72.
Old page: README:76-100,1004-1010 TS code blocks in elixir page.
Remaining: write result.
