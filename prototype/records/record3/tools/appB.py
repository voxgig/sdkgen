p = '/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/record3/model-dependent-text-prototype.md'
s = open(p).read()


def rep(a, b):
    global s
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)


rep("| 7 | Stage 3 | `RefFacts.container` | the five REFERENCE providers |",
    "| 7 | Stage 3 | `RefFacts.container` | the five REFERENCE providers (the re-count: four; zig's REFERENCE came after the change) |")
rep("| 10 | Version 3 | `RefSyntax.read(value, key)` required | all 8 |",
    "| 10 | Version 3 | `RefSyntax.read(value, key)` required | all 8 (the re-count: seven; clojure had no REFERENCE yet) |")
rep("| 33 | 3.3 (forms) | absences searched over the whole runtime; type words; required call notation; whole-record check | all 13 forms; the 7 unported must add calls |",
    "| 33 | 3.3 (forms) | absences searched over the whole runtime; type words; required call notation; whole-record check (four guard commits; the re-count counts four) | all 13 forms; the 7 unported must add calls |")
rep("| 34 | 3.3 (forms) | no ahead exemption once a provider exists; field flag checked when omitted; deleted and arity re-derived | ports that cite ahead or omit a flag |",
    """| 34 | 3.3 (forms) | no ahead exemption once a provider exists; field flag checked when omitted; deleted and arity re-derived (two guard commits; the re-count counts two) | ports that cite ahead or omit a flag |
| 35 | Sentence fix (re-count) | `testMock`'s value 'model' renamed 'generated' | 7 providers and 18 forms |
| 36 | 3.1 (forms, re-count) | each method tied to its operation; parameter names and types compared; every declared fact accounted for | all 9 forms |
| 37 | 3.1 (forms, re-count) | a declaration reader with file parts and returns on a later line | c, rust and clojure forms |
| 38 | 3.1 (forms, re-count) | a citation pins the value it audited | 9 forms |
| 39 | 3.1 (forms, re-count) | a getter's copy-or-live fact must be cited | 9 forms and providers |
| 40 | 3.2 (forms, re-count) | the reader table marks members a runtime lacks; a members exception per family | c, scala, cpp and kotlin forms |
| 41 | Migration round, merged at 3.4 | a provider declares `interface`; one that does not is served as the previous version and loses sentences | all 20 providers (13 in the migration round, 7 in the integration's settlement commits) |
| 42 | 3.4 (guard) | the accessor's declaration found by its token as written; `ref.instance` judged; a template-call factory read as the constructor | cpp forms; the accessor calls of six languages judged for the first time |
| 43 | 3.4 (guard) | the generated test tree `sdktest/` is not runtime | scala forms |
| 44 | 3.4 (guard) | the deleted read checked name by name, the cast type and the layout roles included | java's template, hook, provider and utility |
| 45 | 3.4 (shared sentence) | the stream signal named in words instead of `callopts.signal` | every page that prints the stream member, in all twenty languages |
| 46 | 3.4 (two unported components) | the ts and js README row for the utility getter no longer says "deep copy" | ts and js |
| 47 | 3.4 (lifecycle, not the interface) | a record that says changed, or a declared override, outweighs a released fingerprint; an undeclared changed copy of a retired optional component fails `doctor` | projects, not providers |""")

rep("""The rows above are 34 entries, counting the forms-framework changes, the
shared-only changes and the disputed row. The records' own running count
(about 25 to 27 at 3.3) is lower: it leaves out the six forms-framework
rows (24 to 27, 33, 34), and from 3.2 adds two changed shared sentences
that have no row here. The records say "about" because builders split and
classify changes differently (the version-3 checker counted about 10
by type diffs where the builder counted about 12), and no record reconciles
its count row by row. On either count the limit of about 10 is crossed.""",
    """§W Rows 35 to 40 are changes the independent re-count found in the code history and no earlier record listed; rows 41 to 47 are the last wave's. The table now has 47 rows. They are not the re-count's 44 (25 provider, 19 forms framework): the re-count leaves out changed shared sentences (rows 45 and 46) and the project lifecycle (row 47); it counts rows 4, 5 and 6 as breaking for no provider (rows 4 and 5 are shared only, and the naming hook of row 6 was optional with a fallback until 3.2, when making it mandatory forced none); it does not count row 1, which predates the first commit; and it splits rows 33 and 34 into the six guard changes they bundle. The builders' running count at 3.3 (about 25 to 27) left out the forms rows and from 3.2 added two changed shared sentences that have no row here; the builders said "about" because they split and classified changes differently, and no builder's record reconciles its count row by row. The re-count does, commit by commit. On every count the limit of about 10 is crossed.""")

open(p, 'w').write(s)
print('ok')
