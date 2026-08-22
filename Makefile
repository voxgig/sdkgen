.PHONY: all build test clean build-ts test-ts clean-ts reset sync-model check-model publish

all: check-model build test

build: build-ts

test: test-ts

clean: clean-ts

# The aontu model. The canonical copy lives at model/; npm can only ship
# files under the package root (ts/), so it is mirrored into ts/model/.
# Edit model/, then `make sync-model`.
MODEL_FILES = sdkgen.aontu

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
	@echo "$(V)" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+([-+].*)?$$' || \
	  (echo "publish: V=$(V) is not a semver x.y.z" && exit 1)
	@command -v gh >/dev/null 2>&1 || \
	  (echo "publish: needs the gh CLI to dispatch the workflow" && exit 1)
	@test "$$(git rev-parse --abbrev-ref HEAD)" = "main" || \
	  (echo "publish: must be on main (currently $$(git rev-parse --abbrev-ref HEAD))" && exit 1)
	@test -z "$$(git status --porcelain)" || \
	  (echo "publish: working tree is not clean" && exit 1)
	@git fetch origin main --quiet && test -z "$$(git rev-list HEAD..origin/main)" || \
	  (echo "publish: local main is behind origin/main" && exit 1)
	@if git rev-parse -q --verify "refs/tags/v$(V)" >/dev/null 2>&1; then \
	  echo "publish: tag v$(V) already exists"; exit 1; fi
	cd ts && npm version --no-git-tag-version $(V)
	$(MAKE) all
	git add ts/package.json ts/package-lock.json
	git commit -m "$(V)"
	git push origin main
	gh workflow run publish.yml --ref main
	@echo
	@echo "dispatched. watch with:  gh run list --workflow=publish.yml --limit 1"
