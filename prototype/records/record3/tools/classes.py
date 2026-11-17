p = '/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/record3/model-dependent-text-classes.md'
s = open(p).read()


def rep(a, b):
    global s
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)


rep("""Status: **classification, checked by samples** (2026-11-15). This page""",
    """Status: **classification, checked by samples** (2026-11-15; the state of
the T rows brought to the prototype's twenty-language result on
2026-11-17, with no class or count changed). This page""")

rep("""26 distinct (10%). At
   its frozen state, after the independent check of the H3 measurement,
   28 of the 38 are fixed by shared code alone; 1 needed lines of each
   language (S13); 1 is fixed only in part (D26); 6 are not fixed (S22,
   X3, U52, U53, V27, U102, in `ts/src/cmp/ReadmeRefFeatures.ts` and
   `ts/src/cmp/FeatureDocs.ts`, shared before the prototype and edited by
   it, but not for these entries); 2 show only in js, which is not ported
   (N11, M35).""", """26 distinct (10%). At
   its frozen state at thirteen languages, after the independent check of
   the H3 measurement, 28 of the 38 were fixed by shared code alone; 1
   needed lines of each language (S13); 1 was fixed only in part (D26); 6
   were not fixed (S22, X3, U52, U53, V27, U102, in
   `ts/src/cmp/ReadmeRefFeatures.ts` and `ts/src/cmp/FeatureDocs.ts`,
   shared before the prototype and edited by it, but not for these
   entries); 2 showed only in js, which was not yet ported (N11, M35). At
   the final state, twenty languages: the six were fixed by one shared
   edit each, so 34 are fixed by shared code alone; S13 needs one declared
   fact in each language's provider; D26 is fixed in part (its rows for
   `extend` and `utility` need a declared fact per runtime); N11 and M35
   are fixed for js through the fence its provider declares. The catalogue
   checker finds none of them on the new pages of any of the twenty. The
   shared edit for X3 printed a new sentence under `secrets` that is false
   in 17 runtimes, which no check saw (prototype record, section 3.3).""")

rep("""| WP08 | 15 | 4 |  |  | 7 |  |  | 4 |  |  | (c) its T entries (S22, X3, U52, U53) are in ReadmeRefFeatures, shared before the prototype and still wrong after it; the rest is shared or schema work |""",
    """| WP08 | 15 | 4 |  |  | 7 |  |  | 4 |  |  | (c) its T entries (S22, X3, U52, U53) are in ReadmeRefFeatures, shared before the prototype; the prototype fixed them by one shared edit each, which needed no port, so the fate does not change; the rest is shared or schema work |""")

rep("""| WP18 | 5 | 3 |  |  | 2 |  |  |  |  |  | (b) G29 goes with the ported cell sinks; V27, U102 and U103 stay shared escaper work, not fixed by the prototype |""",
    """| WP18 | 5 | 3 |  |  | 2 |  |  |  |  |  | (b) G29 goes with the ported cell sinks; V27, U102 and U103 stay shared escaper work (the prototype fixed V27 and U102 by shared escaper edits, not by porting; U103 is not fixed) |""")

rep("""The reasons of S22, X3 and V27, and of WP18 in section 4, no longer say
the prototype left their component untouched: the H3 check found that it
had edited it, for other entries. No class changed.""", """The reasons of S22, X3 and V27, and of WP18 in section 4, no longer say
the prototype left their component untouched: the H3 check found that it
had edited it, for other entries. No class changed. The rows of the six
entries the prototype later fixed by shared edits (X3, S22, U52, U53, V27,
U102), of D26, and of N04, U06, M04, N11 and M35 say where each stands at
the prototype's final state, twenty languages; so do WP08 and WP18 in
section 4. No class or count changed with them.""")

rep("""| S22 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:50-53 |  |  | In the H3 scope, wholly; not fixed by the prototype, which edited ReadmeRefFeatures for other entries but not this one; the text still shows in all 20 languages. |""",
    """| S22 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:50-53 |  |  | In the H3 scope, wholly. Not fixed at the prototype's frozen state at thirteen languages; then fixed by one shared edit, clean in all 20 languages. |""")

rep("""| X3 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:34-35,54,119-131 |  |  | In the H3 scope, wholly; not fixed by the prototype, which edited the component for other entries but not this one. |""",
    """| X3 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:34-35,54,119-131 |  |  | In the H3 scope, wholly. Fixed by one shared edit, clean in all 20 languages; the edit also printed "Also attaches to pipeline hooks" under `secrets` from its model's hook declaration, false in 17 runtimes. |""")

rep("""| V27 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:95-96; FeatureDocs.ts |  |  | In the H3 scope, wholly; not fixed by the prototype, which edited the component for other entries but not this one. |""",
    """| V27 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:95-96; FeatureDocs.ts |  |  | In the H3 scope, wholly. Fixed by one shared edit (the type cell through the table-cell escaper), clean in all 20 languages. |""")

rep("""| U06 | T | part | per-language-copy | ReadmeEntity/ReadmeRef_<lang>.ts canonToType(..., target.name) | N04 |  | In the H3 scope, in part; 13 type printers still pass a literal language. |""",
    """| U06 | T | part | per-language-copy | ReadmeEntity/ReadmeRef_<lang>.ts canonToType(..., target.name) | N04 |  | In the H3 scope, in part; the type printers of all 20 ported languages still pass a literal language. Checked through the aliased go target at twenty and clean. |""")

rep("""| U52 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:28-30,37-44 |  |  | In the H3 scope, wholly; not fixed by the prototype. |""",
    """| U52 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:28-30,37-44 |  |  | In the H3 scope, wholly. Fixed by one shared edit, clean in all 20 languages. |""")

rep("""| U53 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:54-55 |  |  | In the H3 scope, wholly; not fixed by the prototype. |""",
    """| U53 | T | yes | neutral-component | ts/src/cmp/ReadmeRefFeatures.ts:54-55 |  |  | In the H3 scope, wholly. Fixed by one shared edit, clean in all 20 languages. |""")

rep("""| U102 | T | yes | neutral-component | ts/src/cmp/FeatureDocs.ts:47-57; ReadmeRefFeatures.ts:78,95 |  |  | In the H3 scope, wholly; not fixed by the prototype. |""",
    """| U102 | T | yes | neutral-component | ts/src/cmp/FeatureDocs.ts:47-57; ReadmeRefFeatures.ts:78,95 |  |  | In the H3 scope, wholly. Fixed by one shared edit (a code-span cell escaper), clean in all 20 languages. |""")

rep("""| N04 | T | part | per-language-copy | ReadmeEntity/ReadmeRef_<lang>.ts canonToType |  |  | In the H3 scope, in part. |""",
    """| N04 | T | part | per-language-copy | ReadmeEntity/ReadmeRef_<lang>.ts canonToType |  |  | In the H3 scope, in part. Shown only through an alias; checked through the aliased go target at twenty and clean. |""")

rep("""| N11 | T | part | per-language-copy | js/ReadmeRef_js.ts, js/ReadmeEntity_js.ts |  |  | In the H3 scope, in part; js not ported. |""",
    """| N11 | T | part | per-language-copy | js/ReadmeRef_js.ts, js/ReadmeEntity_js.ts |  |  | In the H3 scope, in part. Fixed for js when js was ported, through the fence value its provider declares. |""")

rep("""| M04 | T | part | per-language-copy | ReadmeEntity/ReadmeRef_<lang>.ts canonToType | N04 |  | In the H3 scope, in part. |""",
    """| M04 | T | part | per-language-copy | ReadmeEntity/ReadmeRef_<lang>.ts canonToType | N04 |  | In the H3 scope, in part. Checked through the aliased go target at twenty and clean. |""")

rep("""| M35 | T | part | per-language-copy | js/ReadmeRef_js.ts, js/ReadmeEntity_js.ts | N11 |  | In the H3 scope, in part. |""",
    """| M35 | T | part | per-language-copy | js/ReadmeRef_js.ts, js/ReadmeEntity_js.ts | N11 |  | In the H3 scope, in part. Fixed for js with N11. |""")

rep("""| D26 | T | part | per-language-copy | ReadmeModel/ReadmeRef/ReadmeOptions_<lang> |  |  | In the H3 scope, in part; the H3 check found it fixed only in part: the constructor table is a hand list of eight rows gated on the option spec, not derived from it. |""",
    """| D26 | T | part | per-language-copy | ReadmeModel/ReadmeRef/ReadmeOptions_<lang> |  |  | In the H3 scope, in part; the H3 check found it fixed only in part: the constructor table was a hand list of eight rows gated on the option spec, not derived from it. A later shared edit takes the rows from the option spec, in all 20 languages, except `extend`, `utility`, `entity` and `test`; `extend` and `utility` need a declared fact per runtime, and there is no default column. |""")

open(p, 'w').write(s)
print('ok')
