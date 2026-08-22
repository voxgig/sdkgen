# How to release and tag

```sh
make publish V=3.8.0
```

Bumps `ts/package.json` (and its lockfile), runs `make all`, commits, pushes
`main`, and dispatches the publish workflow — which publishes to npm and
writes the `v<V>` tag.

Every guard runs **before** anything is written, because a release cannot be
taken back: npm never allows republishing a version. It refuses unless `V` is
a semver, `gh` is present, you are on `main` with a clean tree, not behind
`origin/main`, and `v<V>` is not already taken.

## Or drive the workflow directly

```sh
gh workflow run publish.yml --ref main
```

**There is no version input, deliberately.** The dispatch releases whatever
the ref already says, so bump the version first, in a normal reviewed PR. A
version input would let the dispatch and the file disagree — you would tag
`v3.8.0` on a package that says `3.7.2`.

## Why publishing and tagging live in the same file

**npm allows exactly one workflow file per trusted publisher.** The entry
registered on npmjs.com names owner, repo, and a single workflow *filename*,
and every `@voxgig` package is registered against `publish.yml`.

The *name* is arbitrary — other orgs register `release.yml` — but only the
registered file can publish, so anything that must accompany a publish has to
live inside it. A second workflow cannot publish whatever permissions it
holds; npm rejects the exchange and reports it as:

```
npm error 404 Not Found - PUT https://registry.npmjs.org/@voxgig%2fsdkgen
```

Read literally that says the package does not exist, which is nonsense — npm
answers an unregistered publisher with **404 rather than 403** so as not to
leak whether a package exists. Expect to lose an hour to the wrong hypothesis
unless you know this.

Renaming `publish.yml` breaks publishing until the npm-side entry is updated
to match.

## Two jobs, because they need different privileges

| job | permissions | runs |
| --- | --- | --- |
| `publish` | `id-token: write`, `contents: read` | `npm ci`, build, tests, publish |
| `tag` | `contents: write` | git, and nothing else |

OIDC **cannot create a tag** — its audience is the registry, not GitHub. The
per-run `GITHUB_TOKEN` writes tags, and it is the same trust model
(short-lived, one run, no stored secret) aimed at GitHub instead.

They are separate jobs on purpose. `checkout` persists its token into the git
config for the **whole job**, so combining them would hand a repository-write
credential to every dependency `postinstall` script that runs during
`npm ci`. Splitting keeps the write credential in a job that installs nothing.

A ref pushed with `GITHUB_TOKEN` does not start another workflow run — GitHub
suppresses that so workflows cannot trigger themselves — so the tag job cannot
be replaced by "tag and let the publisher fire on it".

## What the workflow refuses to do

1. **A tag that already exists *on a different commit*** — the version was not
   bumped, and moving it would rewrite a published release. A tag already
   pointing at **this** commit is the idempotent case: nothing to create, not
   an error, which is what makes re-dispatching after a partial release safe.
2. **A pushed tag that disagrees with the package version.** On the manual
   `v*` path: pushing `v3.8.0` while `ts/package.json` still says `3.7.2`
   would resolve 3.7.2, find it published, skip the publish and go green —
   leaving a tag with no release behind it.
3. **A failing `make check-model`, build or test.**

And one that fails *open*, on purpose:

4. **A version already on npm** is checked, not assumed. A run can publish and
   then fail before tagging, leaving a version on npm with nothing pointing at
   it. Without this check that state is unrecoverable — the publish step dies
   on `cannot publish over the previously published versions` before the tag
   job runs. Publishing only what is missing, and tagging either way, makes a
   dispatch idempotent.

## If something goes wrong

**Failed at the tag step.** The publish succeeded; only the ref write did not.
Re-dispatch — the registry check skips the completed publish and retries the
tag. If it fails again, a tag protection rule is refusing `GITHUB_TOKEN`, and
that is a repository settings fix.

**On npm but untagged.** Same remedy: re-dispatch. This is exactly the case
guard 4 exists for.

**npm refuses the publish.** That version already exists. npm does not allow
republishing a version, ever. Bump and re-release.
