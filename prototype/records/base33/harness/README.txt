Quick-start prototype harness. Run from this directory with node 24 on PATH.
  node gen.js old /home/user/sdkgen/ts                      # OLD outputs (alias variation skipped: needs a writable stage)
  node gen.js oldclone ../oldclone/ts --only alias && cp -r out/oldclone/alias-go2 out/old/   # OLD alias from a pristine clone at 9aebaf9e
  node gen.js new "$(cd ../sdkgen/ts; pwd)"                 # NEW outputs
  node diff.js [--detail all|ts|go|py|c] [--un] [--json]    # quick-start diff with reasons
  node agg.js                                               # per-language totals, prose sharing
  node metrics.js                                           # sizes, provider model reads, interface
  node survey.js <old|new> <variation> [langs]              # print quick-start sections
  node pylane.js <sdkgen-ts> <outdir>                       # py README example test with a pytest stub
  node h5.js                                                # doctor / target add / alias probe

v2 (interface version 2) additions, run from this directory with node 24:
  node gen.js old /home/user/sdkgen/ts                       # OLD, now with the root README (lib2 calls ReadmeTop)
  node gen.js oldclone "$(cd ../oldclone/ts; pwd)" --only alias && cp -r out/oldclone/alias-go2 out/old/
  node gen.js new "$(cd ../sdkgen/ts; pwd)"                  # NEW
  node diff2.js [--detail <lang>|all] [--un] [--json]        # both sections, reasons, unported and outside checks
  node prose.js new [--json]                                 # sentences and provider-supplied words per section
  node purity.js [sdkgen-ts]                                 # what the providers hold besides printing
  node metrics2.js                                           # source lines before/after, projection, second section
  ../lanes.sh                                                # ts, go, py (real pytest), c DOC lanes
  ../mig/bin/tool.js mk|use|cli|build|gen <project>          # upgrade walk (projects in ../mig/work)
Variations: op-absent-readonly replaced by ex-readonly (example entity planet with list and load only).
