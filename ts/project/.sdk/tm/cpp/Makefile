# ProjectName SDK (C++) — build & test.
#
# Header-only runtime (core/, utility/, feature/, entity/); each test/*.cpp is
# an independent executable. `make test` compiles and runs them all, failing
# if any test binary exits non-zero. Mirrors the struct/cpp and tm/rust build.
#
# The ONE exception to header-only is the gated `secrets` feature (below):
# its vendored payload is a multi-translation-unit library, compiled into an
# archive the test executables link - and only while the feature is wired in.

CXX ?= g++
CXXFLAGS ?= -std=c++17 -O0 -g -Wall -Wextra -Wno-unused-parameter -pthread

# ---- the secrets feature (gated; model/feature/secrets.aon) -----------------
#
# feature/secrets/ holds the vendored @voxgig/sekreto cpp port (sekreto/),
# the voxgig/plugin host it is built on (plugin/) and the provider kinds
# (plugins/). Unlike everything else in this SDK they are .cpp/.hpp pairs,
# so they cannot ride inside a test's single translation unit: this block
# compiles them into libsdksecrets.a and links it into every test binary.
# Every quoted include in that tree is either same-directory or an explicit
# ../plugin/ or ../sekreto/ path (written at vendoring time; see
# ts/vendor/routes.json), so NO -I is needed and the vendored plugin's
# types.hpp/value.hpp can never shadow core/types.hpp.
#
# feature/secrets/kinds.cpp IS THE WIRING. Config_cpp GENERATES it only when
# the model activates `secrets` for this target (it lists the selected plugin
# definitions and carries the token-exchange transport of last resort).
# Without it nothing of the feature is compiled: a tree generated straight
# from the scaffold, or one whose model declares the feature inactive,
# carries the payload as inert source - core/config.hpp includes no
# feature/secrets.hpp, so no test translation unit ever sees a sekreto
# declaration - and a project's `target add` trims it outright.
#
# THE PLUGIN LAYER IS BUILT ONLY WHEN A KIND SURVIVED THE TRIM. The four
# shared helpers (the socket HTTP client, its OpenSSL binding, the digests
# and the child-process launcher) belong to no plugin group, so they are
# always on disk; they are compiled only beside a kind that calls them,
# because plugins/Tls.cpp hard-includes <openssl/ssl.h>. So a chain of
# built-ins ([env, memory, dotenv, file]) compiles the sekreto and
# voxgig/plugin cores alone and links libstdc++ alone, and the one external
# dependency a cpp SDK can have - OpenSSL, for the vault kinds AND for the
# exchange transport in kinds.cpp, which rides on the same vendored client -
# is linked only when a plugin group is active. `ldd` on any test binary
# shows which case this tree is. (c bundles libcurl for the same transport;
# cpp's port exports its HTTPS client as `sekreto::httprequest`, so a second
# HTTP stack would buy nothing.)
SEK_WIRED := $(wildcard feature/secrets/kinds.cpp)
SEK_SHARED := Crypto.cpp Httpjson.cpp Proc.cpp Tls.cpp
SEK_ALL := $(wildcard feature/secrets/plugins/*.cpp)
SEK_KINDS := $(filter-out $(addprefix feature/secrets/plugins/,$(SEK_SHARED)),$(SEK_ALL))
SEK_SRCS :=
SEK_LIBS :=
SEK_ARCHIVE :=
SEK_TEST_SRCS :=
ifneq ($(SEK_WIRED),)
  SEK_SRCS := feature/secrets/kinds.cpp \
    $(wildcard feature/secrets/sekreto/*.cpp feature/secrets/plugin/*.cpp)
  ifneq ($(strip $(SEK_KINDS)),)
    SEK_SRCS += $(SEK_ALL)
    SEK_LIBS := -lssl -lcrypto
  endif
  SEK_ARCHIVE := libsdksecrets.a
  # The gated suite: test/feature/<name>/ is a `feature` container, so the
  # trim drops it with the feature, and this only ever adds files that the
  # feature wired in above can link.
  SEK_TEST_SRCS := $(wildcard test/feature/secrets/*.cpp)
endif
SEK_OBJS := $(SEK_SRCS:.cpp=.o)

TEST_SRCS := $(wildcard test/*.cpp) $(SEK_TEST_SRCS)
TEST_BINS := $(TEST_SRCS:.cpp=.out)

# REBUILD WHEN A HEADER CHANGES. The runtime is header-only, so a test binary
# depends on far more than its own .cpp — but the pattern rule below names
# only that .cpp, so make happily reused a stale .out after every change to
# core/, feature/, entity/ or utility/. A real fix to the mock transport read
# as "still failing" through several rebuilds because the binary under test
# predated it. Listing the headers is cheap and makes `make test` mean what it
# says.
# test/ is listed too: the corpus suites are driven by test/*.hpp (the omni
# resolver and the retained runner support) and by the vendored omni headers
# under test/vendor/omni/, none of which the pattern rule below names either.
# feature/*/ and feature/*/*/ cover the secrets feature's vendored headers.
SDK_HDRS := $(wildcard core/*.hpp entity/*.hpp feature/*.hpp \
                       feature/*/*.hpp feature/*/*/*.hpp \
                       utility/*.hpp utility/*/*.hpp *.hpp \
                       test/*.hpp test/vendor/omni/*.hpp)

.PHONY: test build clean

build: $(TEST_BINS)

test: build
	@fail=0; \
	for b in $(TEST_BINS); do \
	  echo "===== $$b ====="; \
	  if ! ./$$b; then fail=1; fi; \
	done; \
	if [ $$fail -ne 0 ]; then echo "SOME TESTS FAILED"; exit 1; fi; \
	echo "ALL TESTS PASSED"

# The secrets archive. `ar r` REPLACES a member by basename on an archive it
# finds, and this archive carries duplicate basenames by construction
# (the vendored plugin's types.o and value.o beside nothing of the SDK's,
# today - but upstream sekreto's own Makefile deletes first for the same
# reason, and a stale member from a removed source would otherwise outlive
# it). One cold `ar rcs` keeps every member.
%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

libsdksecrets.a: $(SEK_OBJS)
	@rm -f $@
	ar rcs $@ $(SEK_OBJS)

# $(SEK_ARCHIVE) and $(SEK_LIBS) are empty unless the secrets feature is
# wired in, so this rule is byte-for-byte the header-only build otherwise.
test/%.out: test/%.cpp $(SDK_HDRS) $(SEK_ARCHIVE)
	$(CXX) $(CXXFLAGS) $< -o $@ $(SEK_ARCHIVE) $(SEK_LIBS)

clean:
	rm -f test/*.out test/feature/*/*.out $(SEK_OBJS) libsdksecrets.a

# --- Release: tag cpp/vX.Y.Z (header-only; no registry) --------------------
VERSION := $(shell cat VERSION 2>/dev/null || echo 0.0.1)
TAG := cpp/v$(VERSION)
publish:
	@echo "Header-only C++ SDK; publishing is the git tag $(TAG)."
