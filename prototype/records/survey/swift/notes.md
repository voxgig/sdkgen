# k-survey notes swift+cpp
## swift (in progress)
Q1 new each call: MainEntity_swift.ts:25-26
Q2 optionsMap clone Main.fragment:84-85; getUtility Utility.copy Main:88-89 (shallow copy of fn slots core/Utility.swift:50); data() clone EntityBase:54; matchv clone :64; no public entopts getter (internal var :12)
Q3 signal = native ()->Bool EntityBase:193, checked between yields :238 break
Q4 no cancel found (grep signal/cancel in core/utility)
Q5 runOp at call EntityBase:223 then AsyncStream over materialised items :236
Q6 deleted() method EntityBase:100; remove fragment replaces data with resdata if non-nil
Q9 Main.fragment 190-272; unreadable -> Fetcher.swift:187-200
Q10 makeFeature default BaseFeature Config_swift.ts:116; optspec CHILD open helpers/optspec.ts:56-60
Q11 explain map only; Context.swift:56 asMap -> true ignored
## swift done; cpp done (all 12 read). Key diffs:
- remove: swift replaces data with response resdata if non-nil (RemoveOp.fragment.swift:18); cpp keeps data (RemoveOp.fragment.cpp:12-25), marks deleted unconditionally (even throw:false failure)
- stream: swift signal ()->Bool checked inside AsyncStream build closure (runs at init); cpp no signal, returns vector
- direct err: swift .nat(Error); cpp vmap{message} only; cpp catches only SdkErrorPtr
- cpp has NO built-in live transport: pipeline.hpp:608-613 fetch_no_transport
- B model templated server: swift quickstart traps (fatalError MakeOptions.swift:148), cpp throws server_var_required pipeline.hpp:1936
- no-test: both makeFeature fall back to BaseFeature; ops then fail fetch_mode_block
- Final result being submitted.
