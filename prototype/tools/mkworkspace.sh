#!/usr/bin/env bash
# mkworkspace.sh <base-dir> <lang> [<clone>] [<out-old>]
# A porter's workspace in one step: <base-dir>/<lang>/ holding
#   sdkgen/   a copy of <clone> (default: the clone this tools/ was set up
#             against, TOOLS_CLONE below), built tree and node_modules included,
#             so the porter builds and commits in their own copy;
#   tools/    a copy of this tools/ directory WITHOUT review/ and runs/ (each
#             porter writes only hand/<lang>.json, normalizers/<lang>.js,
#             purity-allow/<lang>.json and, generated, classes/<lang>.json);
#   out/old   a symbolic link to <out-old> (the OLD output, never copied);
#   out/new   an empty directory: `REGEN=1 tools/portcheck.sh sdkgen out <lang>`
#             fills it from the porter's clone (the alias variation too, since
#             the clone sits inside the workspace).
# Refuses a base under /home/user, and an existing workspace.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
base="$1"; lang="$2"
clone="${3:-${TOOLS_CLONE:-/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/base32/sdkgen}}"
old="${4:-${TOOLS_OLD:-/tmp/claude-0/-home-user/f1977c62-4748-5872-8f72-6f448dbac3f1/scratchpad/design/proto2/base32/out/old}}"
case "$(realpath -m "$base")" in /home/user/*) echo "refused: $base is under /home/user"; exit 1;; esac
[[ "$lang" =~ ^[a-z][a-z0-9]*$ ]] || { echo "refused: '$lang' is not a language name"; exit 1; }
ws="$(realpath -m "$base")/$lang"
[ -e "$ws" ] && { echo "refused: $ws exists"; exit 1; }
[ -d "$clone/ts/dist-test-scaffold" ] || { echo "refused: $clone is not a built clone (no ts/dist-test-scaffold)"; exit 1; }
[ -d "$old" ] || { echo "refused: no OLD output at $old"; exit 1; }
mkdir -p "$ws/out/new"
echo "[mkworkspace] copying the clone ($(du -sh "$clone" | cut -f1)) to $ws/sdkgen"
cp -a "$clone" "$ws/sdkgen"
# a link in the copy that still names the source clone would let a build write there
if grep -rIl --include='*.js' --include='*.json' "$(realpath "$clone")" "$ws/sdkgen/ts/dist-test-scaffold" "$ws/sdkgen/ts/dist" 2>/dev/null | head -1 | grep -q .; then
  echo "[mkworkspace] WARNING: the built tree names $clone by absolute path; rebuild in $ws/sdkgen before relying on it"
fi
echo "[mkworkspace] copying tools"
mkdir -p "$ws/tools"
(cd "$here" && tar --exclude=./review --exclude=./runs --exclude=./out-stage2 --exclude=./inject --exclude=./before/work --exclude='./gen/mstage-*' -cf - .) | (cd "$ws/tools" && tar -xf -)
ln -s "$(realpath "$old")" "$ws/out/old"
(cd "$ws/sdkgen" && git rev-parse --short HEAD > "$ws/BASE" && git status --short | head -3)
echo "[mkworkspace] $ws ready: clone $(cat "$ws/BASE"), tools, out/old -> $(realpath "$old")"
echo "  next: cd $ws && REGEN=1 tools/portcheck.sh sdkgen out $lang"
