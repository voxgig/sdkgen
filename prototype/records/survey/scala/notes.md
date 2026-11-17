# k-survey notes: scala, csharp

(paths relative to base32/sdkgen/ts/project/.sdk)

## scala (done reading core)
Q1 accessor always `new` (src/cmp/scala/MainEntity_scala.ts:31-32), arg entopts passed, mutated (EntityBase:21-28 puts active).
Q2 optionsMap() clone (SdkClient:83); getUtility() Utility.copy() field copy (SdkClient:88, Utility:54); data() clone (EntityBase:49); matchArgs() clone (59); no entopts getter (protected var :16).
Q3 callopts "signal" Function0 -> TRUE; checked in hasNext; stream ends (EntityBase:166,210-213,224).
Q4 no cancel for load/list/direct (grep: no signal/cancel in tm/scala core).
Q5 runOp at stream call (EntityBase:192) before iterator returned (218).
Q6 deleted() method, deletedFlag; data kept, replaced by resdata if present (RemoveOp fragment:83-86).
Q7 new DemoSDK(opts); DemoSDK.testSDK(null,null) companion object; instance direct/prepare/optionsMap/getUtility/accessor(null)/op.
Q8 all methods: getName(), data(), matchArgs(), deleted(); client/entopts protected; deleted() not on SdkEntity trait (Contracts:16-27).
Q9 rawRequest SdkClient:244-318.
Q10 makeFeature default BaseFeature (Config_scala.ts:165); mode test -> fetcher throws fetch_mode_block (Fetcher:205).
Q11 explain must be JMap; true ignored (Context.scala:48).
Q12 project.scala only (Package_scala.ts:13-14); package voxgig.demosdk.core (utility_scala.ts:24-33).

## csharp
Q1 accessor new each call (MainEntity_csharp.ts:25-28); entopts mutated (EntityBase.fragment.cs:42-50)
Q2 OptionsMap clone (Main.fragment.cs:97-101), GetUtility Copy (103-106), Data/Match clone (EntityBase:85,98), no entopts getter (CloneOpts protected :70)
Q3 callopts["signal"] CancellationToken + [EnumeratorCancellation]; yield break (EntityBase.fragment.cs:257-377)
Q4 no; DefaultHttpFetch sync Send no token (Fetcher.cs:161)
Q5 async iterator: deferred to first MoveNextAsync (line 306 inside iterator body)
Q6 Deleted() method, data kept/replaced
Q9 RawRequest Main.fragment.cs:239-344; OpDenied plain Exception (229) vs scala SdkError
Q10 MakeFeature default BaseFeature (Config_csharp.ts:237-238); FetcherUtil mode block (Fetcher.cs:225)
Q11 explain Dictionary only (Context.cs:66)
Q12 csproj library, Compile Remove test/** (Package_csharp.ts:54-77); namespace DemoSdk; Voxgig.Struct
Old-page: direct ok/err claims; ts code blocks in scala/csharp README; quick start omits server vars (B base templated) -> server_var_required; no-test test-mode example cannot work.
