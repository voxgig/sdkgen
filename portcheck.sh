#!/usr/bin/env bash
# portcheck.sh <clone> <out-root> <lang>
#   <clone>     an sdkgen clone (built: ts/dist, ts/dist-test, ts/dist-test-scaffold)
#   <out-root>  holds old/ and new/ (one directory per model variation)
#   <lang>      the one language to check
# Env: REGEN=1 regenerates <out-root>/new from <clone> first (see the SKIPPED
#      line it prints: the alias variation needs the clone under tools/).
#      GUARD='<test file>' the guard suite (default ts/dist-test/runtimefacts.test.js).
#      SCRATCH=1 classifies from scratch (no hand entries, no rule records, no
#      hand-recorded facts), as for a language nobody has reviewed; the classes
#      go to review/<lang>/scratch-classes/, never to classes/<lang>.json.
#      STRICT_SENTENCES=1 fails on a shared match against a reference sentence
#      with no verdict in reviewed/sentences.json.
# Writes only this language's files: classes/<lang>.json and review/<lang>/.
# Exit 1 on anything unclassified (RECOUNT and INVALID included), a defect, an
# impure provider, notes with no region the lint read, a failed guard, a stale
# build (a source newer than its output) or a stale hand record (a reason that
# quotes text no page and no file of the clone holds any more).
set -u
here="$(cd "$(dirname "$0")" && pwd)"
clone="$(cd "$1" && pwd)"; root="$(cd "$2" && pwd)"; lang="$3"
export PATH=/opt/node24/bin:$PATH
out="$here/review/$lang"
mkdir -p "$out"
rc=0
step() { echo "[portcheck $lang] $1" >&2; }

if [ "${REGEN:-0}" = 1 ]; then
  step "regenerate NEW from $clone (a progress line per variation)"
  # the generator's own exit code, not tee's: a generation that throws leaves
  # new/ as the run before wrote it, and nothing may be measured on that
  set -o pipefail
  node "$here/gen/gen.js" "$root/new" "$clone/ts" 2>&1 | tee "$out/regen.log" >&2
  grc=$?
  set +o pipefail
  got=$(grep -c 'READMEs in' "$out/regen.log"); skipped=$(grep 'SKIPPED' "$out/regen.log" | sed 's/^.*\] \([^:]*\):.*/\1/' | tr '\n' ' ')
  want=$(ls "$root/old" | wc -l)
  step "regenerated $got of the $want variations old/ holds; SKIPPED: ${skipped:-none}"
  if [ $grc != 0 ]; then echo "REGENERATION FAILED (exit $grc): the generator threw; new/ holds the pages of an earlier run and nothing is measured"; tail -n 5 "$out/regen.log"; echo "PORTCHECK $lang: FAIL"; exit 1; fi
  if [ "$got" -lt "$want" ]; then echo "REGENERATION SHORT: $got variations regenerated, old/ holds $want (skipped: ${skipped:-none}); a variation not regenerated keeps an earlier run's pages, so nothing is measured (make the workspace with mkworkspace.sh so the alias variation can be staged)"; echo "PORTCHECK $lang: FAIL"; exit 1; fi
fi

sections=$(node -e 'const r=require(process.argv[1]);console.log(Object.keys(r.ported).filter(s=>r.ported[s].includes(process.argv[2])).join(","))' "$here/ported.json" "$lang")
# A language the registry does not list is read off the clone (a provider and
# no ReadmeQuick_<lang>; `ref:` and no ReadmeRef_<lang>), so a port need not edit ported.json.
if [ -z "$sections" ]; then
  cmpdir="$clone/ts/project/.sdk/src/cmp/$lang"
  if [ -f "$cmpdir/Syntax_$lang.ts" ]; then
    [ -f "$cmpdir/ReadmeQuick_$lang.ts" ] || sections="tutorial,rootquick"
    if grep -q '^  ref: {' "$cmpdir/Syntax_$lang.ts" && [ ! -f "$cmpdir/ReadmeRef_$lang.ts" ]; then sections="${sections:+$sections,}reference"; fi
  fi
fi
[ -n "$sections" ] || { echo "$lang: NOT PORTED. No section is ported for it: ported.json does not list it, and the clone has no Syntax_$lang.ts in ts/project/.sdk/src/cmp/$lang/. Nothing to classify yet."; echo "PORTCHECK $lang: NOT PORTED"; exit 1; }
missing_vars=$(comm -23 <(ls "$root/old" | sort) <(ls "$root/new" | sort) | tr '\n' ' ')
step "sections: $sections; variations in old/ missing from new/: ${missing_vars:-none}"

# the build must be current: a failed build leaves the previous output in place
step "build: is every output newer than its source (ts/src, ts/test, the components and fragments)"
node "$here/buildfresh.js" "$clone" > "$out/build.txt" 2>&1 || { grep '^STALE BUILD' "$out/build.txt" | head -20; rc=1; }

cls="$here/classes"; scratch=(); fscratch=()
if [ "${SCRATCH:-0}" = 1 ]; then cls="$out/scratch-classes"; scratch=(--scratch --out-file "$cls/$lang.json"); fscratch=(--scratch); mkdir -p "$cls"; step "FROM SCRATCH: no hand entries, no rule records, no hand-recorded facts; classes in $cls"; fi
step "classify (hand/$lang.json, then stage-3a rule records for this language, then exact shared sentences)"
node "$here/classify.js" --clone "$clone" --old "$root/old" --new "$root/new" --lang "$lang" --section "$sections" "${scratch[@]}" > "$out/classify.log" 2>&1 || { cat "$out/classify.log"; echo "classify failed"; exit 1; }
step "ledger";   node "$here/ledger.js" --old "$root/old" --new "$root/new" --lang "$lang" --section "$sections" --classes "$cls" --json > "$out/ledger.json" 2> "$out/ledger.err" || rc=1
step "blocks";   node "$here/blocks.js" --old "$root/old" --new "$root/new" --lang "$lang" --section "$sections" --ported "$sections" --classes "$cls" --json > "$out/blocks.json" 2> "$out/blocks.err" || rc=1
# human-readable worklists too (same run, text form)
node "$here/ledger.js" --old "$root/old" --new "$root/new" --lang "$lang" --section "$sections" --classes "$cls" > "$out/ledger.log" 2>&1
node "$here/blocks.js" --old "$root/old" --new "$root/new" --lang "$lang" --section "$sections" --ported "$sections" --classes "$cls" > "$out/blocks.log" 2>&1
step "fact sheet (and the language and convention facts against the OLD page)"; node "$here/factsheet.js" --clone "$clone" --old "$root/old" --new "$root/new" --lang "$lang" --section "$sections" "${fscratch[@]}" > "$out/factsheet.log" 2>&1 || rc=1
if [ "${SCRATCH:-0}" != 1 ]; then
  step "hand records: does every quotation in a reason still stand on a page or in the clone"
  node "$here/handstale.js" --clone "$clone" --old "$root/old" --new "$root/new" --lang "$lang" --json > "$out/handstale.json" 2> "$out/handstale.err" || rc=1
else rm -f "$out/handstale.json"; fi
step "printed calls: each call of a runtime member in a block, against the guard's forms (arity, receiver, member)"
node "$here/callcheck.js" --clone "$clone" --new "$root/new" --lang "$lang" --json > "$out/calls.json" 2> "$out/calls.err" || rc=1
step "purity";   node "$here/purity.js" --providers "$clone/ts/project/.sdk/src/cmp" --lang "$lang" --root "$root/new" --json > "$out/purity.json" 2> "$out/purity.err" || rc=1

guard="${GUARD:-ts/dist-test/runtimefacts.test.js}"
gres="NOT RUN ($guard not in the clone)"
if [ -f "$clone/$guard" ]; then
  step "guard: node --test --test-name-pattern '^$lang: ' $guard"
  if (cd "$clone/ts" && node --test --test-name-pattern "^$lang: " "${guard#ts/}" > "$out/guard.log" 2>&1); then gres="pass"; else gres="FAILED"; rc=1; fi
  gres="$gres ($(grep -E '^ℹ (pass|fail) ' "$out/guard.log" | tr '\n' ' ' | sed 's/ℹ //g'))"
  [ -n "$(grep -E '^ℹ tests 0$' "$out/guard.log")" ] && { gres="FAILED: the guard ran no test for $lang"; rc=1; }
else rc=1
fi

node "$here/summary.js" "$lang" "$out" "$gres" "$missing_vars" || rc=1
[ $rc = 0 ] && echo "PORTCHECK $lang: PASS" || echo "PORTCHECK $lang: FAIL"
exit $rc
