# ProjectName SDK (C) — build + test. Compiles the runtime (core/, utility/,
# utility/struct/, feature/, entity/) into a static archive, then builds and
# runs every tests/*.c binary. `make test` exits non-zero if any test fails.

CC ?= gcc
CFLAGS ?= -std=c11 -Wall -Wextra -Wno-unused-parameter -D_GNU_SOURCE -O0 -g
INC := -I core -I utility/struct
# The vendored omni test runner (tests/vendor/omni) is TEST-ONLY: it is
# reachable from tests/ alone, never from LIB_SRCS, so it cannot enter the
# shipped libsdk.a. That is why it lives under tests/ and not utility/.
OMNI_INC := -I tests -I tests/vendor/omni
LDLIBS := -lm

# feature/*/*.c: a feature may carry a vendored library payload in its own
# subdirectory (the station feature vendors voxgig_station there - C has no
# package registry, so tier-C libraries ride the feature source; see
# utility/struct/ for the same precedent at the utility level). Empty when
# no feature ships one.
LIB_SRCS := $(wildcard core/*.c utility/*.c utility/struct/*.c feature/*.c feature/*/*.c entity/*.c)
LIB_OBJS := $(LIB_SRCS:.c=.o)

# Single-level on purpose: the vendored omni sources under
# tests/vendor/omni have no main() and must not become test binaries.
TEST_SRCS := $(wildcard tests/*.c)
TEST_BINS := $(TEST_SRCS:.c=.out)

OMNI_SRCS := $(wildcard tests/vendor/omni/*.c)
OMNI_OBJS := $(OMNI_SRCS:.c=.o)

.PHONY: all build test clean publish

all: build

build: libsdk.a

%.o: %.c
	$(CC) $(CFLAGS) $(INC) -c $< -o $@

libsdk.a: $(LIB_OBJS)
	ar rcs $@ $(LIB_OBJS)

# omni's util.c includes <regex.h>. CFLAGS is `?=`, so an operator override
# can drop the -D_GNU_SOURCE that exposes it; -D_POSIX_C_SOURCE is the
# minimum omni itself compiles under (its own test/run.c sets exactly this).
# _DARWIN_C_SOURCE is needed BESIDE it, not instead of it: on Darwin,
# defining _POSIX_C_SOURCE alone LOWERS __DARWIN_C_LEVEL and hides regex_t,
# so the same flag that exposes the header on glibc hides it on macOS. Each
# platform ignores the other's macro.
tests/vendor/omni/%.o: tests/vendor/omni/%.c
	$(CC) $(CFLAGS) -D_POSIX_C_SOURCE=200809L -D_DARWIN_C_SOURCE -c $< -o $@

libomni.a: $(OMNI_OBJS)
	ar rcs $@ $(OMNI_OBJS)

# Only the corpus drivers and the smoke test reach for omni, and the generic
# rule must stay free of it: omni's util.c needs POSIX <regex.h>, which
# Windows does not have at all. Linking it into EVERY test binary broke the
# auth-null probe the generator's own suite builds on windows and macos,
# neither of which runs a corpus.
OMNI_TESTS := tests/struct_corpus_test.out tests/primary_corpus_test.out \
  tests/omni_smoke_test.out

$(OMNI_TESTS): tests/%.out: tests/%.c libsdk.a libomni.a
	$(CC) $(CFLAGS) $(INC) $(OMNI_INC) $< libsdk.a libomni.a -o $@ $(LDLIBS)

tests/%.out: tests/%.c libsdk.a
	$(CC) $(CFLAGS) $(INC) $< libsdk.a -o $@ $(LDLIBS)

# Build and run every test; aggregate pass/fail.
test: libsdk.a libomni.a
	@fail=0; total=0; \
	for src in $(TEST_SRCS); do \
	  bin=$${src%.c}.out; \
	  case " $(OMNI_TESTS) " in *" $$bin "*) omni="libomni.a"; oinc="$(OMNI_INC)";; *) omni=""; oinc="";; esac; \
	  $(CC) $(CFLAGS) $(INC) $$oinc $$src libsdk.a $$omni -o $$bin $(LDLIBS) || { echo "BUILD FAIL: $$src"; fail=1; continue; }; \
	  total=$$((total+1)); \
	  if ./$$bin; then :; else echo "TEST FAIL: $$bin"; fail=1; fi; \
	done; \
	echo "-----------------------------------------"; \
	if [ $$fail -eq 0 ]; then echo "ALL $$total TEST BINARIES PASSED"; else echo "SOME TESTS FAILED"; fi; \
	exit $$fail

clean:
	rm -f $(LIB_OBJS) libsdk.a $(OMNI_OBJS) libomni.a $(TEST_BINS) tests/*.out \
	  corpus-scoreboard.json

# C has no central registry — publishing IS the git tag.
VERSION := $(shell cat VERSION 2>/dev/null || echo 0.0.1)
publish:
	@echo "C target: tag-only publish (c/v$(VERSION)); no registry."
