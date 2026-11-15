#!/usr/bin/env bash
# before/run.sh <sdkgen-clone> <lang> [model ...]
# Generates an SDK for <lang> with <clone> (as generatedcompile.test.ts
# generateTo does) for each model (default, crud, basic-server), runs THAT
# SDK's own README example test with the real toolchain three times, and
# prints the exact command, its result line and the minimum wall time.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
clone="$(cd "$1" && pwd)"; lang="$2"; shift 2
models="${*:-default crud basic-server}"
export PATH=/opt/node24/bin:$PATH
phpunit="$here/tools/php/vendor/bin/phpunit"

cmd_for() {
  case "$1" in
    rb)   echo "env LANG=C LC_ALL=C ruby test/readme_examples_test.rb" ;;
    php)  echo "php '$here/phpshim.php' test/ReadmeExamplesTest.php" ;;
    perl) echo "perl -Ilib t/readme_examples.t" ;;
    java) echo "mvn -B test -Dtest=ReadmeExamplesTest -DfailIfNoSpecifiedTests=false" ;;
    cpp)  echo "rm -f test/readme_examples_test.out && make -s test/readme_examples_test.out && ./test/readme_examples_test.out" ;;
    js)   echo "" ;;
  esac
}

for m in $models; do
  root="$here/work/$m/$lang/$lang"
  rm -rf "$here/work/$m/$lang"
  node "$here/gensdk.js" "$clone/ts" "$root" "$lang" "$m" | sed 's/^/  /'
  c="$(cmd_for "$lang")"
  if [ -z "$c" ]; then echo "[$lang $m] the generated SDK has no README example test (no runner file); NOT RUN"; continue; fi
  best=""
  for i in 1 2 3; do
    s=$(date +%s.%N)
    out="$(cd "$root" && eval "$c" 2>&1)"; rc=$?
    e=$(date +%s.%N); t=$(echo "$e - $s" | bc)
    [ -z "$best" ] || [ "$(echo "$t < $best" | bc)" = 1 ] && best=$t
    echo "$out" > "$here/work/$m/$lang/run$i.log"
    echo "[$lang $m] run $i: exit $rc, ${t}s"
  done
  echo "[$lang $m] command (in $root): $c"
  echo "[$lang $m] last lines:"; tail -6 "$here/work/$m/$lang/run3.log" | sed 's/^/    /'
  echo "[$lang $m] minimum of 3: ${best}s"
done
