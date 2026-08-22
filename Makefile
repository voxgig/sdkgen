.PHONY: all build test clean build-ts test-ts clean-ts reset sync-model check-model publish

all: check-model build test

build: build-ts

test: test-ts

clean: clean-ts

# The aontu model. The canonical copy lives at model/; npm can only ship
# files under the package root (ts/), so it is mirrored into ts/model/.
# Edit model/, then `make sync-model`.
MODEL_FILES = sdkgen.aon

sync-model:
	@for f in $(MODEL_FILES); do \
	  cp model/$$f ts/model/$$f; \
	done
	@echo "synced model/ -> ts/model/"

check-model:
	@for f in $(MODEL_FILES); do \
	  cmp -s model/$$f ts/model/$$f || { echo "DRIFT: ts/model/$$f != model/$$f (run: make sync-model)"; exit 1; }; \
	done
	@echo "model mirror in sync"
	@cd ts && node build/check-model.js

# TypeScript
build-ts:
	cd ts && npm run build

test-ts:
	cd ts && npm test

clean-ts:
	rm -rf ts/dist-test

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
	gh workflow run publish.yml --ref main -f expect_sha=$$(git rev-parse HEAD)
	@echo
	@echo "dispatched. watch with:  gh run list --workflow=publish.yml --limit 1"
