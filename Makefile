.PHONY: all build test clean build-ts test-ts clean-ts reset sync-model check-model

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
