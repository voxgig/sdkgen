.PHONY: test build lint clean corpus smoke

# Compile the whole SDK (runtime + test runners + the vendored omni corpus
# engine under sdktest/vendor/omni) via scala-cli. scala-cli compiles every
# .scala/.java file under the project directory, so the vendored tree needs
# no build-file entry of its own.
build:
	scala-cli compile .

# Run, in order: the omni SMOKE test (the vendored corpus engine must be able
# to FAIL a bad entry, or every corpus run below is vacuously green), the
# runtime test suite, the generated per-entity entity/direct tests, the
# secrets feature suite, the shared struct corpus and the primary-utility
# corpus. Any one reporting a failure exits non-zero.
#
# Main classes are NAMED here rather than globbed, so a per-feature suite has
# to be listed. SecretsTestMain drives the feature through the `extend` seam
# and so runs in every scala SDK, model-activated or not. SdkCleanTestMain is
# the canary sweep: no credential leaves the SDK in any form. SdkServerTestMain
# checks how a templated base URL takes its server variables.
# SdkConcurrencyTestMain races first requests on one client. SdkCodecTestMain
# sends and reads every non-JSON body against a local listener, and ships
# only where the model has such a body.
test:
	scala-cli run . --main-class OmniSmoke
	scala-cli run . --main-class SdkTestMain
	scala-cli run . --main-class SdkEntityTestMain
	scala-cli run . --main-class SdkCleanTestMain
	scala-cli run . --main-class SdkServerTestMain
	scala-cli run . --main-class SdkConcurrencyTestMain
	scala-cli run . --main-class SecretsTestMain
	if [ -f sdktest/CodecTest.scala ]; then scala-cli run . --main-class SdkCodecTestMain; fi
	scala-cli run . --main-class Runner -- SDKREL/.sdk/test/test.json
	scala-cli run . --main-class PrimaryCorpusMain -- SDKREL/.sdk/test/test.json

# The vendored omni engine alone: proves the corpus runner can still fail.
smoke:
	scala-cli run . --main-class OmniSmoke

corpus:
	scala-cli run . --main-class Runner -- SDKREL/.sdk/test/test.json
	scala-cli run . --main-class PrimaryCorpusMain -- SDKREL/.sdk/test/test.json

# "Lint": a clean compile means the code type-checks.
lint:
	scala-cli compile .

clean:
	rm -rf .scala-build .bsp out
