.PHONY: test build clean publish

test:
	dotnet test test/ProjectNameSDKTest.csproj

build:
	dotnet build ProjectNameSDK.csproj

clean:
	dotnet clean ProjectNameSDK.csproj 2>/dev/null || true
	rm -rf bin obj test/bin test/obj

# --- Release: the git tag (no NuGet upload) --------------------------------
# Publishing a version means pushing its release tag: this template has no
# `dotnet pack` + `dotnet nuget push` step, which would slot in before the
# tag (as in the voxgig/struct csharp Makefile). Run headless under the
# boru key vault, which injects the GitHub token so nothing lands on disk or
# argv:
#   boru vault exec --for=github=<alias> -- make publish
# boru `--dry-run` injects a filler token we detect to rehearse (no tag/push).
# set -e + tag-last: a failed push never leaves a tag behind.
VERSION := $(shell cat VERSION)
TAG := RELEASETAG
BORU_DRY_RUN_FILLER := BORU-DRY-RUN-FILLER-NOT-A-REAL-SECRET
publish: test
	@if git rev-parse -q --verify "refs/tags/$(TAG)" >/dev/null; then \
	  echo "tag $(TAG) already exists — bump VERSION first"; exit 1; fi
	@set -e; \
	token="$${GITHUB_TOKEN:-$$GH_TOKEN}"; \
	if [ "$$token" = "$(BORU_DRY_RUN_FILLER)" ]; then \
	  echo "[dry-run] boru filler token detected: would tag $(TAG); nothing pushed."; \
	  exit 0; \
	fi; \
	if [ -z "$(TAG)" ]; then echo "No release tag: the model cuts none for this package."; exit 0; fi; \
	git tag -a "$(TAG)" -m "csharp v$(VERSION)"; \
	url=$$(git remote get-url origin | sed -E 's#^git@github.com:#https://github.com/#'); \
	if [ -n "$$token" ] && printf '%s' "$$url" | grep -q '^https://github.com/'; then \
	  hdr="AUTHORIZATION: basic $$(printf 'x-access-token:%s' "$$token" | base64 | tr -d '\n')"; \
	  git -c http.extraheader="$$hdr" push "$$url" "$(TAG)"; \
	else \
	  git push origin "$(TAG)"; \
	fi; \
	echo "Tagged $(TAG)."
