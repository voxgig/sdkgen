# ProjectName SDK (C) — build + test. Compiles the runtime (core/, utility/,
# utility/struct/, feature/, entity/) into a static archive, then builds and
# runs every tests/*.c binary. `make test` exits non-zero if any test fails.

CC ?= gcc
NM ?= nm
CFLAGS ?= -std=c11 -Wall -Wextra -Wno-unused-parameter -D_GNU_SOURCE -O0 -g
# -I feature: a feature's own header (feature/<name>.h), which a suite under
# tests/feature/<name>/ includes by bare name the way every test includes
# sdk.h. Then EVERY payload directory two levels under feature/: a feature
# that carries a vendored library keeps it in feature/<name>/<lib>/, and
# every quoted include inside such a port is a bare basename resolved
# through these. Derived from the tree rather than listed, so the Makefile
# names no feature; harmless when the feature trim has removed the
# directories (the wildcard is then empty), and a payload's value.h /
# point.h / types.h shadow nothing: the SDK's own value.h (utility/struct)
# is reached by its neighbours through the including file's directory,
# which a quoted include searches before any -I.
PAYLOAD_DIRS := $(sort $(dir $(wildcard feature/*/*/*.h)))
# Payload headers are quoted includes; they must not shadow system headers
# such as <regex.h> with the plugin library's own regex.h.
INC := -I core -I utility/struct -I feature $(addprefix -iquote ,$(PAYLOAD_DIRS))
# The vendored omni test runner (tests/vendor/omni) is TEST-ONLY: it is
# reachable from tests/ alone, never from LIB_SRCS, so it cannot enter the
# shipped libsdk.a. That is why it lives under tests/ and not utility/.
OMNI_INC := -I tests -I tests/vendor/omni
# The test harness headers (ctest.h, feature_harness.h) by bare name, for a
# suite that lives BELOW tests/ (a gated feature's tests/feature/<name>/
# suite) and so cannot reach them through its own directory as tests/*.c do.
TEST_INC := -I tests
LDLIBS := -lm

# ---- gated feature payloads (model/feature/<name>.aontu plugin groups) --------
#
# A gated feature's vendored payload sits two levels under feature/
# (feature/<name>/<lib>/*.c) - out of reach of the feature/*/*.c glob below,
# and deliberately so. What of it is built is decided by a GENERATED make
# fragment, feature/<name>/kinds.mk, that Config_c emits beside the
# feature's generated kinds.c only when the model activates the feature for
# this target. The fragment appends the payload sources to FEATURE_SRCS, the
# feature's suite to FEATURE_TEST_SRCS, and - only when a plugin group is
# active - the plugin layer and the external libraries it brings to LDLIBS.
# Nothing here names a feature: a tree whose model never activated one
# carries its payload as inert source (as rust carries a module no parent
# declares), links libc alone, and a project's `target add` trims it
# outright. `ldd` on any test binary shows which case this tree is.
FEATURE_SRCS :=
FEATURE_TEST_SRCS :=
-include $(wildcard feature/*/kinds.mk)

# ---- TLS for https:// ----------------------------------------------------------
#
# TLS=openssl binds the platform's OpenSSL, unvendored (-lssl -lcrypto);
# TLS=none links no TLS library, and an https:// request then fails saying
# so. The default, auto, is openssl wherever its headers and POSIX sockets
# are found. OPENSSL_CFLAGS and OPENSSL_LIBS reach an OpenSSL installed off
# the compiler's own paths, as `pkg-config --cflags --libs openssl` prints.
TLS ?= auto
OPENSSL_CFLAGS ?=
OPENSSL_LIBS ?= -lssl -lcrypto
ifeq ($(TLS),auto)
TLS_BACKEND := $(shell printf '\#include <openssl/ssl.h>\n\#include <sys/socket.h>\n' | \
  $(CC) $(OPENSSL_CFLAGS) -x c -E - >/dev/null 2>&1 && echo openssl || echo none)
else
TLS_BACKEND := $(TLS)
endif
ifeq ($(filter openssl none,$(TLS_BACKEND)),)
$(error TLS must be auto, openssl or none, not '$(TLS)')
endif
ifeq ($(TLS_BACKEND),openssl)
INC += $(OPENSSL_CFLAGS)
LDLIBS += $(OPENSSL_LIBS)
endif

# feature/*/*.c: a feature may carry a vendored library payload in its own
# subdirectory (the station feature vendors voxgig_station there - C has no
# package registry, so tier-C libraries ride the feature source; see
# utility/struct/ for the same precedent at the utility level). Empty when
# no feature ships one. A gated feature's own feature/<name>.c is in this
# glob too and always compiles (its headers are on INC above); without its
# kinds.mk nothing references it, so the archive member is never pulled
# into a link.
LIB_SRCS := $(wildcard core/*.c utility/*.c utility/struct/*.c feature/*.c feature/*/*.c entity/*.c) \
  utility/tls/$(TLS_BACKEND).c $(FEATURE_SRCS)
LIB_OBJS := $(LIB_SRCS:.c=.o)

# ---- one prefix per SDK -------------------------------------------------------
#
# Every global symbol in libsdk.a carries this SDK's prefix, so two generated
# SDKs link into one program and neither binds to the other's code. The names
# are read off objects compiled without it (build/plain/), never listed:
# core/prefix.h maps each to $(SDK_PREFIX)<name>, and libsdk.a is compiled
# with that header forced in, vendored payloads included, so their files stay
# as vendored. A name that already has the prefix keeps it.
SDK_PREFIX := projectname_
PREFIX_H := core/prefix.h
PREFIXED := -include $(PREFIX_H)
# What a program's own code sees through core/sdk.h: only the names the SDK's
# headers mention, so a private name such as a vendored payload's `fail`
# never renames an identifier of the program's own.
API_PREFIX_H := core/prefix_api.h
API_HDRS := $(filter-out $(PREFIX_H) $(API_PREFIX_H),$(wildcard core/*.h utility/struct/*.h entity/*.h feature/*.h))
PLAIN_OBJS := $(addprefix build/plain/,$(LIB_OBJS))
# What the compiler puts before a C name in an object: `_` on Mach-O.
LABEL_PREFIX := $(shell echo __USER_LABEL_PREFIX__ | $(CC) -E -P - 2>/dev/null | tr -d ' \n')

# The C names the objects in $(1) define, sorted, one per line.
defined_names = $(NM) -P -g $(1) | awk -v label='$(LABEL_PREFIX)' \
  'NF >= 2 && $$2 ~ /^[A-Z]$$/ && $$2 != "U" { n = $$1; \
  if (label != "" && index(n, label) == 1) n = substr(n, length(label) + 1); \
  if (n ~ /^[A-Za-z_][A-Za-z0-9_]*$$/) print n }' | LC_ALL=C sort -u

# One #define per name. A read that found no names, or a name whose prefixed
# form is ALSO defined, stops the build: the first would leave every name
# unprefixed, the second would merge two definitions into one. No placeholder
# may sit in these two programs: the generator reads the text between two
# doubled dollar signs as a model path, and leaves a placeholder in it as
# written.
prefix_map = BEGIN { print "/* Generated by make from the names libsdk.a defines. Do not edit. */"; \
  print "\#ifndef " guard; print "\#define " guard } \
  { names[NR] = $$0; have[$$0] = 1 } \
  END { if (NR == 0) { print "nm listed no names in build/plain" | "cat 1>&2"; exit 1 } \
  for (i = 1; i <= NR; i++) { n = names[i]; if (index(n, prefix) == 1) continue; \
  if ((prefix n) in have) { print "both " n " and " prefix n " are defined" | "cat 1>&2"; exit 1 } \
  print "\#define " n " " prefix n } print "\#endif" }

# Single-level on purpose: the vendored omni sources under
# tests/vendor/omni have no main() and must not become test binaries. A
# gated feature's suite under tests/feature/<name>/ is added by its
# generated kinds.mk, so it is only ever built when the feature it links
# against is wired in.
TEST_SRCS := $(wildcard tests/*.c) $(FEATURE_TEST_SRCS)
TEST_BINS := $(TEST_SRCS:.c=.out)

OMNI_SRCS := $(wildcard tests/vendor/omni/*.c)
OMNI_OBJS := $(OMNI_SRCS:.c=.o)

.PHONY: all build test clean publish ldlibs check-tls FORCE

all: build

build: libsdk.a

# What a program linking libsdk.a links beside it, as `make -s ldlibs`
# prints it: run it with the TLS= the archive was built with.
ldlibs:
	@echo $(LDLIBS)

# Keep this before the generic rule for GNU make 3.81 on macOS.
# omni's util.c includes <regex.h>. CFLAGS is `?=`, so an operator override
# can drop the -D_GNU_SOURCE that exposes it; -D_POSIX_C_SOURCE is the
# minimum omni itself compiles under (its own test/run.c sets exactly this).
# _DARWIN_C_SOURCE is needed BESIDE it, not instead of it: on Darwin,
# defining _POSIX_C_SOURCE alone LOWERS __DARWIN_C_LEVEL and hides regex_t,
# so the same flag that exposes the header on glibc hides it on macOS. Each
# platform ignores the other's macro.
tests/vendor/omni/%.o: tests/vendor/omni/%.c
	$(CC) $(CFLAGS) -D_POSIX_C_SOURCE=200809L -D_DARWIN_C_SOURCE -c $< -o $@

# Also before the generic rule, for the same reason.
build/plain/%.o: %.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) $(INC) -DPROJECTNAME_SDK_UNPREFIXED -c $< -o $@

# Rewritten only when the names change, so an edit that defines nothing new
# recompiles only the file it touched.
$(PREFIX_H): $(PLAIN_OBJS)
	@$(call defined_names,$(PLAIN_OBJS)) \
	  | awk -v prefix='$(SDK_PREFIX)' -v guard='PROJECTNAME_PREFIX_H' '$(prefix_map)' > $@.tmp \
	  || { rm -f $@.tmp; exit 1; }
	@if cmp -s $@.tmp $@; then rm -f $@.tmp; else mv $@.tmp $@; fi

$(API_PREFIX_H): $(PREFIX_H) $(API_HDRS)
	@cat $(API_HDRS) | tr -cs 'A-Za-z0-9_' '\n' > $@.words
	@awk -v guard='PROJECTNAME_PREFIX_API_H' 'FNR == NR { said[$$0] = 1; next } \
	  FNR == 1 { print "/* Generated by make: the names in prefix.h the headers mention. */"; \
	  print "#ifndef " guard; print "#define " guard } \
	  /^#define / && 3 == NF && ($$2 in said) { print } END { print "#endif" }' \
	  $@.words $(PREFIX_H) > $@.tmp || { rm -f $@.words $@.tmp; exit 1; }
	@rm -f $@.words
	@if cmp -s $@.tmp $@; then rm -f $@.tmp; else mv $@.tmp $@; fi

# The TLS backend this archive was built with, rewritten only when TLS=
# selects another, so a switch rebuilds the archive.
TLS_STAMP := build/tls-backend
$(TLS_STAMP): FORCE
	@mkdir -p $(dir $@)
	@if [ "$$(cat $@ 2>/dev/null)" != "$(TLS_BACKEND)" ]; then echo $(TLS_BACKEND) > $@; fi

FORCE:

%.o: %.c $(PREFIX_H) $(API_PREFIX_H)
	$(CC) $(CFLAGS) $(INC) $(PREFIXED) -c $< -o $@

# `ar r` REPLACES a member by basename on an archive it finds, and this
# archive carries duplicate basenames by construction: core/utility.o
# beside utility/struct/utility.o, and a vendored payload's point.o,
# config.o and value.o beside core's and utility/struct's. One cold
# `ar rcs` keeps every member; an incremental one would silently drop
# whichever came first, so the archive is deleted before it is written.
# The archive is then read back: a name it defines without the prefix is
# one another SDK's archive can define too, so it is not kept, and nor is an
# archive the read found no names in.
libsdk.a: $(LIB_OBJS) $(TLS_STAMP)
	@rm -f $@
	ar rcs $@ $(LIB_OBJS)
	@names=$$($(call defined_names,$@)); \
	stray=$$(printf '%s\n' "$$names" | grep -v '^$(SDK_PREFIX)'); \
	if [ -z "$$names" ]; then stray="(nm listed none)"; fi; \
	if [ -n "$$stray" ]; then \
	  echo "libsdk.a defines names without the $(SDK_PREFIX) prefix:" $$stray >&2; \
	  rm -f $@; exit 1; \
	fi


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
	$(CC) $(CFLAGS) $(INC) $(TEST_INC) $(OMNI_INC) $(PREFIXED) $< libsdk.a libomni.a -o $@ $(LDLIBS)

tests/%.out: tests/%.c libsdk.a
	$(CC) $(CFLAGS) $(INC) $(TEST_INC) $(PREFIXED) $< libsdk.a -o $@ $(LDLIBS)

# The TLS boundary, read off the objects as sekreto's check-core reads it:
# in a TLS=none build no object outside a gated feature's payload names
# OpenSSL, and in a TLS=openssl build utility/tls/openssl.c alone does. The
# read must find the fetcher calling the transport, or it read nothing.
CORE_OBJS = $(filter-out $(FEATURE_SRCS:.c=.o),$(LIB_OBJS))
check-tls: $(LIB_OBJS)
	@needs=$$(for o in $(CORE_OBJS); do $(NM) -P -g $$o | awk -v o=$$o -v label='$(LABEL_PREFIX)' \
	  '$$2 == "U" { n = $$1; if (label != "" && index(n, label) == 1) n = substr(n, length(label) + 1); \
	  print o " " n }'; done); \
	printf '%s\n' "$$needs" | grep -qx 'utility/fetcher.o $(SDK_PREFIX)http_fetch' \
	  || { echo "check-tls: nm found no call from the fetcher to the transport" >&2; exit 1; }; \
	ssl=$$(printf '%s\n' "$$needs" | grep -E ' (SSL|OPENSSL|X509|ERR|EVP|BIO|PEM)_' \
	  | grep -v '^utility/tls/openssl.o '); \
	if [ -n "$$ssl" ]; then echo "check-tls: OpenSSL is named outside utility/tls/openssl.c:" $$ssl >&2; exit 1; fi; \
	if [ openssl = $(TLS_BACKEND) ]; then printf '%s\n' "$$needs" | grep -qx 'utility/tls/openssl.o SSL_connect' \
	  || { echo "check-tls: the openssl backend does not name SSL_connect" >&2; exit 1; }; fi; \
	echo "check-tls: TLS=$(TLS_BACKEND); OpenSSL is named by $(if $(filter openssl,$(TLS_BACKEND)),utility/tls/openssl.c alone,no object)"

# Build and run every test; aggregate pass/fail.
test: libsdk.a libomni.a check-tls
	@fail=0; total=0; \
	for src in $(TEST_SRCS); do \
	  bin=$${src%.c}.out; \
	  case " $(OMNI_TESTS) " in *" $$bin "*) omni="libomni.a"; oinc="$(OMNI_INC)";; *) omni=""; oinc="";; esac; \
	  $(CC) $(CFLAGS) $(INC) $(TEST_INC) $$oinc $(PREFIXED) $$src libsdk.a $$omni -o $$bin $(LDLIBS) || { echo "BUILD FAIL: $$src"; fail=1; continue; }; \
	  total=$$((total+1)); \
	  if ./$$bin; then :; else echo "TEST FAIL: $$bin"; fail=1; fi; \
	done; \
	echo "-----------------------------------------"; \
	if [ $$fail -eq 0 ]; then echo "ALL $$total TEST BINARIES PASSED"; else echo "SOME TESTS FAILED"; fi; \
	exit $$fail

clean:
	rm -f $(LIB_OBJS) libsdk.a $(OMNI_OBJS) libomni.a $(TEST_BINS) tests/*.out \
	  tests/feature/*/*.out corpus-scoreboard.json $(PREFIX_H) $(API_PREFIX_H)
	rm -rf build/plain $(TLS_STAMP)

# C has no central registry — publishing IS the git tag.
VERSION := $(shell cat VERSION 2>/dev/null || echo 0.0.1)
publish:
	@echo "C target: tag-only publish (c/v$(VERSION)); no registry."
