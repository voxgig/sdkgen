# k-survey clojure+ocaml notes (started)
## clojure (done reading; S = sdkgen/ts/project/.sdk)
Q1 accessor: MainEntity_clojure.ts:121 defn <name> [client data] (e-<name>/make client data); Entity.fragment.clj:54 make -> new-entity, always new; arg is ENTOPTS (fragment :32-33), not data.
Q2 options-map clone (core.clj:202-203); get-utility utility-copy new atom, custom cloned (core.clj:223-227), not in sdk.api; data-get clone (frag:21); match-get clone (frag:30); entopts: no getter, raw :_entopts field.
Q3 stream signal: 0-arg fn, checked between yields, stops seq (frag:144,166-167,185-187).
Q4 no cancel in ctrl (make-control core.clj:325); thread interrupt -> fetch_transport err (core.clj:1886-1889) inferred.
Q5 run-op at call (frag:164), items realized vec/mapv at call (177-183), lazy-seq only for signal.
Q6 deleted atom :_deleted; module fn deleted / mark-deleted (frag:72-74); data REPLACED by resdata if response has body (frag:245-247) - comment says keeps.
Q9 client.clj:127-162.
Q10 features.clj not trimmed (clojure.aontu:45 trim false) -> test-feature present; test-sdk works.
Q11 explain only map (core.clj:347); true ignored.
Q12 deps.edn :paths ["src"] (Package_clojure.ts:28).
## ocaml (done reading)
Q1 MainEntity_ocaml.ts:311-312 -> <Mod>.make, new each call; arg entopts (Entity_ocaml.ts:60-61).
Q2 no options/utility getter in Sdk_client; cl_options/cl_utility live fields (sdk_types.ml:188-189); Sdk_helpers.client_options_map clones (sdk_helpers.ml:120-121); e_data_get/e_match_get clone (Entity_ocaml.ts:101,107); e_entopts field live; e_utility = client.cl_utility shared (Entity_ocaml.ts:63,69).
Q3 signal Func -> Bool true stops (Entity_ocaml.ts:142-143,151-153).
Q4 none; control record sdk_types.ml:43-49.
Q6 e_deleted mutable bool; marked UNCONDITIONALLY after run_op (EntityOperation_ocaml.ts:265-267); data replaced by resdata (245-246).
Q9 sdk_features.ml:1783-1823; no live transport: sdk_runtime.ml:1573-1579 fetch_no_transport.
Q10 Config_ocaml.ts:236-262 make_feature falls to base_feature; sdk_test sets mode test (sdk_features.ml:1872-1879); fetcher_util blocks fetch_mode_block (sdk_runtime.ml:1554-1558).
Q12 Makefile RUNTIME/SDK order lines 77-87; build = ocamlc -c only (lines 166-168); opam build make build, no install.
Root README test snippet has no opens (ReadmeTopTest_ocaml.ts:33-36).
