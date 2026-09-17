.PHONY: all build test clean build-ts test-ts clean-ts scan-prose vale-install reset check-model publish vendor vendor-check vendor-audit

all: check-model build test

build: build-ts

test: test-ts scan-prose

clean: clean-ts

# Validate the authoritative model shipped directly from ts/model/.
check-model:
	@cd ts && node build/check-model.js

# Vendored libraries (struct, omni, plugin, sekreto) at the shared tag.
# Routes: ts/vendor/routes.json; manifest: ts/test/vendored.json.
# Filter with V='--lib=omni --lang=ts'.
vendor:
	cd ts && node build/vendor.js $(V)

vendor-check:
	cd ts && node build/vendor.js --check $(V)

# What upstream has, at the tag, that no route takes. Run it when cutting a
# new shared tag: a resync refreshes the files already routed and picks up
# NOTHING new by itself, so this is where an added upstream file is seen.
vendor-audit:
	cd ts && node build/vendor.js --audit $(V)

# TypeScript
build-ts:
	cd ts && npm run build

test-ts:
	cd ts && npm test

clean-ts:
	rm -rf ts/dist-test

# The vale release the prose gate runs. ONE source of truth: the workflow
# that installs it in CI. A second copy of the number here is how the local
# gate and CI's gate come to run different versions and disagree about what
# passes -- which is the whole failure this target exists to prevent.
VALE_VERSION = $(shell sed -n "s/.*VALE_VERSION: *'\([0-9.]*\)'.*/\1/p" .github/workflows/docs.yml)

# Where `make vale-install` puts it. Repo-local, so installing needs no sudo
# and one checkout's vale cannot be another's.
VALE_BIN = .vale/bin/vale

# The vale on PATH wins, so a system install is used as-is; otherwise the
# repo-local one.
VALE = $(shell command -v vale 2>/dev/null || echo $(VALE_BIN))

# The prose gate over the reader-facing pages (STYLE-GUIDE.md). Both halves
# read the same files -- the page set tools/check_prose.py prints -- and
# BOTH HALVES MUST RUN.
#
# check_prose carries the house rules .vale.ini switches Google's OFF in
# favour of, and vale carries Google's rules plus the spelling and banned
# lists. Skipping either widens what is allowed, so neither is optional.
#
# This used to print a note and carry on when vale was absent, and the note
# was the whole defect: `make test` reported ok with half the gate unrun, so
# a contributor without vale could only discover a prose error from a red
# CI run on a pushed branch. It has happened. A missing tool is now a
# failure with the command that fixes it, and `PROSE_VALE=skip` is there for
# the case where someone genuinely means to run the other half alone --
# loudly, and never by default.
scan-prose:
	@echo "======== scan: prose (vale + check_prose) ========"
	@if [ -x "$(VALE)" ] || command -v "$(VALE)" >/dev/null 2>&1; then \
	  "$(VALE)" sync >/dev/null && \
	  "$(VALE)" --minAlertLevel=error $$(python3 tools/check_prose.py --files); \
	elif [ "skip" = "$(PROSE_VALE)" ]; then \
	  echo "!! vale SKIPPED (PROSE_VALE=skip): Google's rules, the spelling"; \
	  echo "!! check and the banned list did NOT run. CI still runs them."; \
	else \
	  echo "vale is not installed, and it is half of this gate." >&2; \
	  echo "" >&2; \
	  echo "  make vale-install     # the pinned $(VALE_VERSION), into $(VALE_BIN)" >&2; \
	  echo "" >&2; \
	  echo "To run the other half alone, and see what is not being checked:" >&2; \
	  echo "" >&2; \
	  echo "  make scan-prose PROSE_VALE=skip" >&2; \
	  echo "" >&2; \
	  exit 1; \
	fi
	@python3 tools/check_prose.py

# Fetch the pinned vale into VALE_BIN. Same release CI installs, so a clean
# local run and a clean CI run mean the same thing.
#
# The asset name is NOT `uname` output: vale publishes macOS builds as
# `macOS`, where uname says `Darwin`, and calls x86_64 `64-bit`. Mapped
# rather than interpolated, so this fails with a name a reader can check
# against the releases page instead of a 404 from a URL nobody reads.
vale-install:
	@test -n "$(VALE_VERSION)" || \
	  { echo "no VALE_VERSION in .github/workflows/docs.yml" >&2; exit 1; }
	@set -e; \
	os=$$(uname -s); arch=$$(uname -m); \
	case "$$os" in \
	  Linux)  os=Linux ;; \
	  Darwin) os=macOS ;; \
	  *) echo "no vale build mapped for $$os; install it yourself and put it on PATH" >&2; exit 1 ;; \
	esac; \
	case "$$arch" in \
	  x86_64|amd64) arch=64-bit ;; \
	  arm64|aarch64) arch=arm64 ;; \
	  *) echo "no vale build mapped for $$arch; install it yourself and put it on PATH" >&2; exit 1 ;; \
	esac; \
	asset="vale_$(VALE_VERSION)_$${os}_$${arch}.tar.gz"; \
	mkdir -p $(dir $(VALE_BIN)); \
	echo "fetching $$asset -> $(VALE_BIN)"; \
	curl -sSfL \
	  "https://github.com/errata-ai/vale/releases/download/v$(VALE_VERSION)/$$asset" \
	  | tar xz -C $(dir $(VALE_BIN)) vale
	@$(VALE_BIN) --version

reset:
	cd ts && npm run reset

# ONE COMMAND RELEASES THIS PACKAGE.
#
#   make publish V=3.8.0
#
# Bumps ts/package.json (and its lockfile) via `npm version
# --no-git-tag-version`, runs the full suite, commits, pushes main, and
# dispatches publish.yml — which publishes to npm and writes the v<V> tag.
#
# Every guard runs BEFORE anything is written, because a release cannot be
# taken back: npm never allows republishing a version.
#
# There is deliberately no version input on the workflow itself; it reads
# ts/package.json, so the dispatch and the file cannot disagree.
publish:
	@test -n "$(V)" || (echo "Usage: make publish V=x.y.z" && exit 1)
	@echo "$(V)" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$$' || \
	  (echo "publish: V=$(V) is not a semver x.y.z (build metadata is not accepted)" && exit 1)
	@# NO `+build` METADATA. npm canonicalizes 1.2.3+meta to 1.2.3, so every
	@# guard here would check v1.2.3+meta while the workflow publishes and tags
	@# v1.2.3 — the tag-already-exists check would look at the wrong name and
	@# this target would push a bump for a release the workflow then refuses.
	@case "$(V)" in \
	  *+*) echo "publish: V=$(V) carries +build metadata, which npm discards"; exit 1 ;; \
	esac
	@command -v gh >/dev/null 2>&1 || \
	  (echo "publish: needs the gh CLI to dispatch the workflow" && exit 1)
	@test "$$(git rev-parse --abbrev-ref HEAD)" = "main" || \
	  (echo "publish: must be on main (currently $$(git rev-parse --abbrev-ref HEAD))" && exit 1)
	@test -z "$$(git status --porcelain)" || \
	  (echo "publish: working tree is not clean" && exit 1)
	@git fetch origin main --quiet && test -z "$$(git rev-list HEAD..origin/main)" || \
	  (echo "publish: local main is behind origin/main" && exit 1)
	@# ASK THE REMOTE, NOT THE CLONE. `git fetch origin main` does not fetch
	@# tags, so a local rev-parse happily passes in a fresh or stale clone
	@# while v$(V) already exists on origin — and by the time the workflow
	@# refuses, this target has already bumped and pushed main.
	@if git ls-remote --exit-code --tags origin "refs/tags/v$(V)" >/dev/null 2>&1; then \
	  echo "publish: tag v$(V) already exists on origin"; exit 1; fi
	@if git rev-parse -q --verify "refs/tags/v$(V)" >/dev/null 2>&1; then \
	  echo "publish: tag v$(V) already exists locally"; exit 1; fi
	cd ts && npm version --no-git-tag-version $(V)
	@# `npm version` updates package.json and its lockfile ONLY. This
	@# repo also carries the version in generated files, and the suite
	@# asserts they agree — so without this stamp `make all` below fails
	@# on every real bump, and the release command could never work.
	cd ts && npm run embed-version
	$(MAKE) all
	git add ts/package.json ts/package-lock.json ts/bin/voxgig-sdkgen ts/project/sdkgen-package.json
	git commit -m "$(V)"
	git push origin main
	@# `--ref main` is a MOVING target: another commit can land between the
	@# push above and the run resolving, and get published under the
	@# version just bumped. Pin the dispatch to the SHA we pushed.
	@#
	@# AND WAIT FOR THE REMOTE TO CATCH UP FIRST. `git push` returns before
	@# the ref is visible to every GitHub read path, so a dispatch fired
	@# immediately after it can resolve `main` to the commit BEFORE the
	@# release commit — the run then refuses with "main has moved", naming
	@# the very SHA just pushed. That is the expect_sha guard working
	@# correctly, and it cost three manual re-dispatches across two repos
	@# before anyone wrote this down. Poll until the remote agrees, then
	@# dispatch.
	@target=$$(git rev-parse HEAD); 	for i in 1 2 3 4 5 6 7 8 9 10; do 	  remote=$$(git ls-remote origin refs/heads/main | cut -f1); 	  if [ "$$remote" = "$$target" ]; then break; fi; 	  echo "waiting for origin/main to reach $$target (saw $$remote)"; 	  sleep 3; 	done; 	gh workflow run publish.yml --ref main -f expect_sha=$$target
	@echo
	@echo "dispatched. watch with:  gh run list --workflow=publish.yml --limit 1"
