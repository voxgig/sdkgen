# Pending workflow patch

`publish-tag-containment.patch` modifies `.github/workflows/publish.yml`.

## Why a patch and not the edit

Automation that writes to `.github/workflows/` needs the GitHub App
`workflows` permission, which the agent that prepared this branch does not
hold. Shipping the change as a patch keeps it reviewable in the diff and lets
a maintainer apply it with their own credentials.

## Apply it

```sh
git apply release/publish-tag-containment.patch
git add .github/workflows/publish.yml
git commit -m "ci: the released commit must be on main"
```

The patch applies and reverses cleanly against the commit that introduced it,
and the resulting workflow parses.

## What it changes

One step, added to the `publish` job immediately after the existing
`Dispatches must come from main`:

```yaml
- name: The released commit must be on main
  run: |
    set -euo pipefail
    git fetch --no-tags --depth=0 origin main
    if ! git merge-base --is-ancestor "$GITHUB_SHA" origin/main; then
      echo "::error::$GITHUB_SHA is not contained in origin/main; refusing to release it"
      exit 1
    fi
    echo "$GITHUB_SHA is on main"
```

It is deliberately **unconditional**: it is the one guard that has to hold on
both ways into the workflow. The existing branch-name check covers
`workflow_dispatch` only, and the pushed-tag guard compares the tag's name
with `ts/package.json` and nothing more — so a `v*` tag pushed from an
unmerged branch carrying a bumped version passed every check and published.
npm never allows republishing a version, so that could not be undone.

`fetch-depth: 0` is already set on the checkout, so `merge-base` has the
history it needs.

`docs/how-to/release-and-tag.md` lists the refusals the workflow makes; this
one is added there.
