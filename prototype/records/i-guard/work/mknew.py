import json
M=[
 {"id":"new-swift-throws-runtime","lang":"swift","file":"project/.sdk/src/cmp/swift/fragment/EntityLoadOp.fragment.swift","from":"_ ctrl: VMap?) throws -> Value {","to":"_ ctrl: VMap?) -> Value {"},
 {"id":"new-swift-throws-view","lang":"swift","file":"test/runtimeforms/swift.ts","from":"? 'throws' : '' },","to":"? '' : '' },"},
 {"id":"new-ts-static-test-instance","lang":"ts","file":"project/.sdk/src/cmp/ts/fragment/Main.fragment.ts","from":"  static test(testoptsarg?: any, sdkoptsarg?: any) {","to":"  test(testoptsarg?: any, sdkoptsarg?: any) {"},
 {"id":"new-py-classmethod-test-instance","lang":"py","file":"project/.sdk/src/cmp/py/fragment/Main.fragment.py","from":"    @classmethod\n    def test(cls, testopts=None, sdkopts=None)","to":"    def test(self, testopts=None, sdkopts=None)"},
 {"id":"new-swift-static-testsdk-instance","lang":"swift","file":"project/.sdk/src/cmp/swift/fragment/Main.fragment.swift","from":"  public static func testSDK(_ testoptsIn","to":"  public func testSDK(_ testoptsIn"},
 {"id":"new-ocaml-field-to-function","lang":"ocaml","file":"project/.sdk/tm/ocaml/sdk_types.ml","from":"  mutable e_name : string;","to":"  mutable e_name : unit -> string;"},
 {"id":"new-rb-none-null","lang":"rb","file":"project/.sdk/src/cmp/rb/Syntax_rb.ts","from":"  none: 'nil',","to":"  none: 'null',"},
 {"id":"new-rb-lits-false-False","lang":"rb","file":"project/.sdk/src/cmp/rb/Syntax_rb.ts","from":"  maps: 'hashes',","to":"  maps: 'hashes',\n  lits: { true: 'true', false: 'False' },"},
 {"id":"new-py-lits-removed","lang":"py","file":"project/.sdk/src/cmp/py/Syntax_py.ts","from":"  lits: { true: 'True', false: 'False' },\n","to":""},
 {"id":"new-go-absence-matches","lang":"go","file":"project/.sdk/tm/go/utility/fetcher.go","from":"req, err := http.NewRequest(method, fullurl, bodyReader)","to":"req, err := http.NewRequest(method, fullurl, bodyReader) // abort is not wired"},
 {"id":"new-ts-unquoted-occurs","lang":"ts","file":"test/runtimeforms/ts.ts","from":"'(\\'undefined\\' !== typeof Blob && value instanceof Blob) || isStream(value)', 'return new Uint8Array(chunk)'],","to":"'(\\'undefined\\' !== typeof Blob && value instanceof Blob) || isStream(value)'],"},
 {"id":"new-go-note-token-missing","lang":"go","edits":[
   {"file":"project/.sdk/src/cmp/go/Syntax_go.ts","from":"'`callopts[\"ctrl\"]`, no error is sent.',","to":"'`callopts[\"ctrl\"]`, no error is sent; see `StreamZz`.',"},
   {"file":"test/runtimeforms/go.ts","from":"Under `throw: false` in `callopts[\\\"ctrl\\\"]`, no error is sent.\",","to":"Under `throw: false` in `callopts[\\\"ctrl\\\"]`, no error is sent; see `StreamZz`.\","}]},
 {"id":"new-swift-stream-incremental","lang":"swift","file":"test/runtimeforms/swift.ts","from":"runs: \"before it returns\", items: \"before it returns\",","to":"runs: \"before it returns\", items: \"as the caller iterates\","},
 {"id":"new-clojure-stream-incremental","lang":"clojure","file":"test/runtimeforms/clojure.ts","from":"runs: \"before it returns\", items: \"before it returns\",","to":"runs: \"before it returns\", items: \"as the caller iterates\","},
 {"id":"new-ocaml-stream-incremental-code","lang":"ocaml","file":"project/.sdk/src/cmp/ocaml/Entity_ocaml.ts","from":"      seq_of raw);","to":"      seq_of raw);\n      (* | Some fn -> fn () *)"},
 {"id":"new-swift-try-dropped-provider-na","lang":"swift","file":"test/runtimeforms/swift.ts","from":"failure: { shows: 'throws', call: 'try' },","to":""},
]
json.dump(M,open('muts-new.json','w'),indent=1)
