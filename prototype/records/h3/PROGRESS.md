# h3 PROGRESS
- step0: started fresh (no prior PROGRESS.md). Reading briefs.
- step1 setup: clone at v33-frozen 0065f1e2, build exit 0 (4s incremental), gen copied, out/old linked. Generating out/new.
- step1 done: gen out/new 21/21 variations, none SKIPPED (gen needs absolute ts path; relative fails with module-not-found). Next: read prior H3 work.
- step2 scope (done, from Where + source at 9aebaf9e). Catalogue holds 329 entries (S50 X7 G31 V32 U108 N24 M49 D23 A5), not 330: the 330th '### ' heading is "The 50 rated medium or low".
  extractor: work/extract.js -> work/entries.json (fields fate/class/where).
  yes (13): S22 S25 S28 S49 X3 V27 U43 U45 U52 U53 U102 M13 M14
  part (25): S09 S13 S50 X6 G01 G27 G29 U06 U34 U36 U44 N04 N11 M04 M12 M35 M37 M38 D04 D05 D10 D23 D26 D55 D69
  pack (5): U10 U19 U20 N21 M19
  no: the other 286. Arguable no's: D25 (only section site is lean ReadmeQuick: pack), U74 (entityOps is called by every quick start but the visible wrong text is in intros), U75 (serverVars also called by ReadmeModel; text is in ReadmeModel_ts), U49 (direct example path: Howto/TopHowto/Errors only; checked no ReadmeRef/Quick at main has /api/resource).
  repeats per Fate inside scope: {G01,M13,D55} {S09,D05} {G27,M38,D69} {N04,U06,M04} {N11,M35}; out-of-scope roots: S25->S23, S13->S11, X6->S29, M37->G28. => 38 entries, 30 distinct (29 if S25 and D10's REFERENCE half are one defect).
- step3: added 5 variations to gen/variations.js (no-cache one-wrap only-wrap feat-text ref-dollar); out/old is now a dir of per-variation links to base32/out/old plus OLD of the 5 generated from freeze/oldclone (gen writes its mstage under h3/gen).
- step4: issuecheck33.js written (inlines work/pages.js), 28 checks over 38 entries; every check true on OLD for >=1 language. First result (ported = 13):
  NEW clean for every ported lang: S28 U45 S49 G01/M13/D55 M14 S50 D23 M12 X6 S25/D10 U43 U44 U34 U36 G27/M38/D69 G29 M37 S13 N04/U06/M04 S09/D05 D26
  NEW still shows for all 20: X3 S22 U52 U53 V27 U102 (all ReadmeRefFeatures, shared since main, untouched by the prototype)
  N11/M35: js only -> unported only. D04: no variation shows it -> read.
  S13 is clean only through ref.facts.testMock declared by all 13 providers (zig, clojure 'always').
  Next: read NEW pages (two families per fixed entry), find decision sites (shared line + per-language lines).
- step5 (classes, decided): once 29 entries / 22 distinct; per-language S13 (testMock in 13 Syntax_<lang> + 20 runtimeforms + ts/js Config fragment fallback b09502f1); not fixed X3 S22 U52 U53 V27 U102 (ReadmeRefFeatures/FeatureDocs, shared since main, untouched); unported only N11/M35 (js).
  strictest reading also counts N04/U06/M04 (13 type printers pass a literal language) and M14 (go printer): 5 entries.
  Read NEW pages (two families each) for every clean check: all say the true thing (notes in final report).
  Uncatalogued residues seen: REF 'Set `feature.log.active` to true' for log (on by default); escaped backticks '\`cost\` activated before \`cache\`' in ordering note (all 20, OLD and NEW).
  Next: part 3 (other direction), then final run + report.
- step6: final run saved work/issuecheck33.out (exit 1: 78 NEW-true cells on ported langs = 6 unfixed entries x 13).
- step7: numbers computed; report returned. Clone clean (git status empty).
