# k-survey notes: go and c
## go (in progress)
Q1 accessor: MainEntity_go.ts:17-18 new each call; arg passed as ENTOPTS not data (registry Main_go.ts New..EntityFunc(client, entopts)); Entity.fragment.go:23
Q2: OptionsMap clone Main.fragment.go:104-105; GetUtility CopyUtility :112-113; Data clone Entity.fragment.go:105; Match clone :119; no entopts getter
Q3: stream signal chan struct{} Entity.fragment.go:151-156,187-193; stops sending, closes chan
Q4: no context/cancel in fetcher.go:115 http.NewRequest
Q5: goroutine Entity.fragment.go:217
Q6: MarkDeleted/Deleted() :79-87; data replaced by resdata RemoveOp:77-80; runOp :373-374
Q9: Main.fragment.go:246-333; always nil error
Q10: Config_go.ts:259-280 default -> base feature
Q11: control.go:6 map; context.go:73-75 true ignored
Q12: go.mod in go/ (Package_go.ts:24); module goModule packageMeta.ts:128-136
## go done; c done (all 12 + old page). Key findings:
- go accessor arg is entopts despite name `data` and docs "initial data"
- go/c Direct/sdk_direct never set error channel; c err is a string
- no-test: both factories fall back to base feature; then fetch_mode_block (go fetcher.go:222, c fetcher.c:205)
- explain: map only in both; true ignored (go context.go:73-75, c context.c:115-116)
- c root quickstart + c README omit server vars; base templated -> abort() make_options.c:124-128
- c README cc line: -I c/core with #include "core/api.h" not found from root
- c README "Error handling" shows TS try/catch
- go REFERENCE ctrl example {"explain": true} ignored
- remove: both replace data with resdata when response has data; C comment says keeps
