# ProjectName SDK (C) — build + test. Compiles the runtime (core/, utility/,
# utility/struct/, feature/, entity/) into a static archive, then builds and
# runs every tests/*.c binary. `make test` exits non-zero if any test fails.

CC ?= gcc
CFLAGS ?= -std=c11 -Wall -Wextra -Wno-unused-parameter -D_GNU_SOURCE -O0 -g
# -I feature: the gated feature headers (feature/secrets.h) a test suite
# under tests/feature/<name>/ includes by bare name, the way every test
# includes sdk.h. The three feature/secrets/... paths are the vendored
# sekreto core, the voxgig/plugin host it is built on, and the plugin
# kinds; every quoted include in that tree is a bare basename ("host.h",
# "support.h") resolved through these. Harmless when the feature trim has
# removed the directories - gcc ignores a -I it cannot find - and the
# plugin's value.h / point.h / types.h / config.h / env.h shadow nothing:
# the SDK's own value.h (utility/struct) is reached by its neighbours
# through the including file's directory, which a quoted include searches
# before any -I.
INC := -I core -I utility/struct -I feature \
  -I feature/secrets/sekreto -I feature/secrets/plugin -I feature/secrets/plugins
# The vendored omni test runner (tests/vendor/omni) is TEST-ONLY: it is
# reachable from tests/ alone, never from LIB_SRCS, so it cannot enter the
# shipped libsdk.a. That is why it lives under tests/ and not utility/.
OMNI_INC := -I tests -I tests/vendor/omni
# The test harness headers (ctest.h, feature_harness.h) by bare name, for a
# suite that lives BELOW tests/ (the gated tests/feature/<name>/ suites) and
# so cannot reach them through its own directory as tests/*.c do.
TEST_INC := -I tests
LDLIBS := -lm

# ---- the secrets feature (gated; model/feature/secrets.aon) -----------------
#
# feature/secrets/ holds the vendored @voxgig/sekreto c port (sekreto/), the
# voxgig/plugin host it is built on (plugin/) and the provider kinds
# (plugins/), two levels below feature/ - out of reach of the feature/*/*.c
# glob below, and deliberately so: this block decides what of it is built.
#
# feature/secrets/kinds.c IS THE WIRING. Config_c GENERATES it only when the
# model activates `secrets` for this target (it lists the selected plugin
# definitions and carries the token-exchange transport of last resort).
# Without it nothing of the feature is compiled: a tree generated straight
# from the scaffold, or one whose model declares the feature inactive,
# carries the payload as inert source - exactly as rust carries a module no
# parent declares - and a project's `target add` trims it outright.
#
# THE PLUGIN LAYER IS BUILT ONLY WHEN A KIND SURVIVED THE TRIM. The five
# shared helpers (the socket HTTP client, its OpenSSL binding, the encoders,
# the clock and the child-process launcher) belong to no plugin group, so
# they are always on disk; they are compiled only beside a kind that calls
# them, because plugins/tls.c hard-includes <openssl/ssl.h>. So a chain of
# built-ins ([env, memory, dotenv, file]) compiles the sekreto and
# voxgig/plugin cores alone and links libc alone, and the two external
# dependencies a c SDK can have - OpenSSL for the vault kinds, libcurl for
# the exchange transport in kinds.c - are linked only when a plugin group is
# active. `ldd` on any test binary shows which case this tree is.
SEK_WIRED := $(wildcard feature/secrets/kinds.c)
SEK_SHARED := clock.c encode.c httpjson.c proc.c tls.c
SEK_ALL := $(wildcard feature/secrets/plugins/*.c)
SEK_KINDS := $(filter-out $(addprefix feature/secrets/plugins/,$(SEK_SHARED)),$(SEK_ALL))
SEK_SRCS :=
SEK_TEST_SRCS :=
ifneq ($(SEK_WIRED),)
  # kinds.c itself is one level under feature/, so the feature/*/*.c glob
  # below already compiles it; this adds the feature and the two cores.
  SEK_SRCS := feature/secrets.c \
    $(wildcard feature/secrets/sekreto/*.c feature/secrets/plugin/*.c)
  ifneq ($(strip $(SEK_KINDS)),)
    SEK_SRCS += $(SEK_ALL)
    LDLIBS += -lssl -lcrypto -lcurl
  endif
  # The gated suite: tests/feature/<name>/ is a `feature` container, so the
  # trim drops it with the feature, and this only ever adds files that the
  # feature wired in above can link.
  SEK_TEST_SRCS := $(wildcard tests/feature/secrets/*.c)
endif

# feature/*/*.c: a feature may carry a vendored library payload in its own
# subdirectory (the station feature vendors voxgig_station there - C has no
# package registry, so tier-C libraries ride the feature source; see
# utility/struct/ for the same precedent at the utility level). Empty when
# no feature ships one. feature/secrets.c is taken OUT of the glob and put
# back by SEK_SRCS, so it is compiled only when its wiring exists.
LIB_SRCS := $(filter-out feature/secrets.c,\
  $(wildcard core/*.c utility/*.c utility/struct/*.c feature/*.c feature/*/*.c entity/*.c)) \
  $(SEK_SRCS)
LIB_OBJS := $(LIB_SRCS:.c=.o)

# Single-level on purpose: the vendored omni sources under
# tests/vendor/omni have no main() and must not become test binaries. The
# one addition is the gated secrets suite, added above only when the
# feature is wired in.
TEST_SRCS := $(wildcard tests/*.c) $(SEK_TEST_SRCS)
TEST_BINS := $(TEST_SRCS:.c=.out)

OMNI_SRCS := $(wildcard tests/vendor/omni/*.c)
OMNI_OBJS := $(OMNI_SRCS:.c=.o)

.PHONY: all build test clean publish

all: build

build: libsdk.a

%.o: %.c
	$(CC) $(CFLAGS) $(INC) -c $< -o $@

# `ar r` REPLACES a member by basename on an archive it finds, and this
# archive carries duplicate basenames by construction: core/point.o and
# core/config.o beside the vendored voxgig/plugin's point.o and config.o,
# utility/struct/value.o beside its value.o (and core/utility.o beside
# utility/struct/utility.o from before). One cold `ar rcs` keeps every
# member; an incremental one would silently drop whichever came first, so
# the archive is deleted before it is written - upstream sekreto's own
# Makefile does the same, for the same reason.
libsdk.a: $(LIB_OBJS)
	@rm -f $@
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
	@rm -f $@
	ar rcs $@ $(OMNI_OBJS)

# Only the corpus drivers and the smoke test reach for omni, and the generic
# rule must stay free of it: omni's util.c needs POSIX <regex.h>, which
# Windows does not have at all. Linking it into EVERY test binary broke the
# auth-null probe the generator's own suite builds on windows and macos,
# neither of which runs a corpus.
OMNI_TESTS := tests/struct_corpus_test.out tests/primary_corpus_test.out \
  tests/omni_smoke_test.out

$(OMNI_TESTS): tests/%.out: tests/%.c libsdk.a libomni.a
	$(CC) $(CFLAGS) $(INC) $(TEST_INC) $(OMNI_INC) $< libsdk.a libomni.a -o $@ $(LDLIBS)

tests/%.out: tests/%.c libsdk.a
	$(CC) $(CFLAGS) $(INC) $(TEST_INC) $< libsdk.a -o $@ $(LDLIBS)

# Build and run every test; aggregate pass/fail.
test: libsdk.a libomni.a
	@fail=0; total=0; \
	for src in $(TEST_SRCS); do \
	  bin=$${src%.c}.out; \
	  case " $(OMNI_TESTS) " in *" $$bin "*) omni="libomni.a"; oinc="$(OMNI_INC)";; *) omni=""; oinc="";; esac; \
	  $(CC) $(CFLAGS) $(INC) $(TEST_INC) $$oinc $$src libsdk.a $$omni -o $$bin $(LDLIBS) || { echo "BUILD FAIL: $$src"; fail=1; continue; }; \
	  total=$$((total+1)); \
	  if ./$$bin; then :; else echo "TEST FAIL: $$bin"; fail=1; fi; \
	done; \
	echo "-----------------------------------------"; \
	if [ $$fail -eq 0 ]; then echo "ALL $$total TEST BINARIES PASSED"; else echo "SOME TESTS FAILED"; fi; \
	exit $$fail

clean:
	rm -f $(LIB_OBJS) libsdk.a $(OMNI_OBJS) libomni.a $(TEST_BINS) tests/*.out \
	  tests/feature/*/*.out corpus-scoreboard.json

# C has no central registry — publishing IS the git tag.
VERSION := $(shell cat VERSION 2>/dev/null || echo 0.0.1)
publish:
	@echo "C target: tag-only publish (c/v$(VERSION)); no registry."
