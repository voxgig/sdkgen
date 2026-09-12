/* Copyright (c) 2024-2026 Voxgig Ltd, MIT License */

import { cmp, each, Content, File, Folder } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'

import { packageName, packageVersion, repoInfo } from '../helpers/packageMeta'


// PUBLISHING AN npm TARGET FROM GITHUB ACTIONS, WITH NO TOKEN.
//
// A generated SDK is published from CI, and the credential is the whole
// problem: an NPM_TOKEN in repository secrets is long-lived, copyable, and
// readable by every workflow in the repo. GitHub OIDC Trusted Publishing
// replaces it — npm exchanges a short-lived OIDC token minted for one job in
// one repository for a publish credential, and attaches SLSA provenance on
// the way through.
//
// DISPATCH, NOT A TAG PUSH. The deploy Makefile in this same repo publishes
// with a vault-injected token, and a tag-triggered workflow racing it would
// publish the same version twice from two mechanisms. A dispatch is a
// deliberate act by someone who can see the result, which is what a release
// should be.
//
// IT TAGS WHAT IT PUBLISHED. A release that reaches the registry but leaves
// no ref behind cannot be answered later: `@voxgig-sdk/github-sdk@0.0.3` went
// out by dispatch and the repository had only v0.0.1 and v0.0.2, so nothing
// in git said which tree the published tarball came from, and nothing
// downstream could pin the SDK by tag. npm's trusted publisher is bound to
// ONE workflow file, so the tag has to be cut inside this one -- and a ref
// pushed with GITHUB_TOKEN starts no further workflow run, so it cannot be
// delegated to a tag-triggered publisher either.
//
// THE WORKFLOW FILE NAME IS PART OF THE TRUST CONFIGURATION. npm binds a
// trusted publisher to the repository AND the workflow filename, so renaming
// this file silently breaks publishing until the npm side is updated to
// match. That is also why one file per target: `publish-ts.yml` can be
// trusted for the ts package without granting anything to another target's.
//
// SET-UP IS A MAINTAINER TASK, so what a human must do once is written to
// `.sdk/PUBLISHING.md` — beside the generator, not into the target's own
// docs, which describe the SDK to the people who INSTALL it and have no
// business being told how this repo releases.
const PublishWorkflow = cmp(function PublishWorkflow(props: any) {
  const { ctx$ } = props
  const { model } = ctx$

  const targetMap = getModelPath(model, `main.${KIT}.target`) || {}

  // npm ONLY. The mechanics here are npm's — `npm publish`, `npm trust`,
  // npm's OIDC exchange — and a PyPI or RubyGems target needs a different
  // workflow rather than this one with a word changed. Emitting nothing for
  // them is the honest answer until those exist.
  const npmTargets: any[] = []
  each(targetMap, (t: any) => {
    if (false === t.active) {
      return
    }
    if ('npm' === (t.publish?.registry?.name || '')) {
      npmTargets.push(t)
    }
  })

  if (0 === npmTargets.length) {
    return
  }

  const { repoUrl } = repoInfo(model)

  Folder({ name: '.github' }, () => {
    Folder({ name: 'workflows' }, () => {
      for (const target of npmTargets) {
        File({ name: `publish-${target.name}.yml` }, () => {
          Content(publishWorkflow(model, target, npmTargets))
        })
      }
    })
  })

  Folder({ name: '.sdk' }, () => {
    File({ name: 'PUBLISHING.md' }, () => {
      Content(publishingDoc(model, npmTargets, repoUrl))
    })
  })

  ctx$.log.info({
    point: 'generate-publish-workflow',
    note: 'npm targets: ' + npmTargets.map((t: any) => t.name).join(','),
  })
})


// WHICH TAG A TARGET'S RELEASE CARRIES.
//
// A repo here publishes more than one npm package -- `ts/` and `js/` are
// separate packages from separate folders, on a lockstep version -- so a bare
// `v<version>` cut by each would be two targets racing for one tag name, and
// the loser would fail a release that had already published.
//
// The convention is the toolchain's own. @voxgig/apidef tags `v<version>` for
// its npm package and `go/v<version>` for its Go module; the generated root
// Makefile tags `<target>/v<version>` for every port. So: the ecosystem's
// PRIMARY npm target owns the bare tag, and any other npm target is prefixed
// with its own name.
//
// Resolved by comparing package names rather than hardcoding 'ts', so that a
// project that renamed or replaced its primary target still gets one bare tag
// -- and if none matches, every target is prefixed, which is wrong in no way
// that loses a release.
function isPrimaryNpm(model: any, target: any, npmTargets: any[]): boolean {
  if (1 === npmTargets.length) {
    return true
  }
  return packageName(model, target.name) === packageName(model, 'npm')
}


function releaseTag(model: any, target: any, npmTargets: any[]): string {
  return isPrimaryNpm(model, target, npmTargets) ?
    'v$VERSION' : `${target.name}/v$VERSION`
}


function publishWorkflow(model: any, target: any, npmTargets: any[]): string {
  const name = target.name
  const tag = releaseTag(model, target, npmTargets)
  // BY TARGET, NOT BY ECOSYSTEM. `packageName(model, 'npm')` resolves the
  // ecosystem's PRIMARY target — ts — so every npm target's workflow named
  // the ts package: publish-js.yml claimed `@voxgig-sdk/github-sdk` while
  // `js/` publishes `@voxgig-sdk/github-js`. It would have checked the wrong
  // package on the registry and told a maintainer to trust the wrong one,
  // while `npm publish` shipped the right one — confidently wrong in three
  // places at once.
  const pkg = packageName(model, name)

  return `# Generated by @voxgig/sdkgen. Do not edit.
#
# Publishes ${pkg} (the \`${name}/\` target) to npm, via GitHub OIDC Trusted
# Publishing — no NPM_TOKEN. npm exchanges a short-lived OIDC token minted
# for THIS job in THIS repository for a publish credential, and attaches SLSA
# provenance automatically.
#
# SET UP ONCE, by a maintainer with publish rights — see .sdk/PUBLISHING.md:
#
#   npm trust github ${pkg} \\
#     --repository <owner>/<repo> \\
#     --file publish-${name}.yml \\
#     --allow-publish
#
# THE FILENAME IS PART OF THAT CONFIGURATION. Renaming this file breaks
# publishing until the npm side is updated to match.
#
# BY DISPATCH, deliberately. The deploy Makefile publishes with a
# vault-injected token; a tag-triggered workflow racing it would publish one
# version by two mechanisms. Releasing is an act someone performs and
# watches.
#
# THREE JOBS, BECAUSE THEY NEED DIFFERENT PRIVILEGES. A dependency lifecycle
# script can ask the runner for any OIDC token its job is permitted to mint,
# so a job that both installs dependencies and holds \`id-token: write\` can be
# made to publish before its own gates finish. The same reasoning keeps
# \`contents: write\` out of both: checkout persists its token into the git
# config for the whole job.
#
#   verify   contents: read, nothing else. Installs, builds and tests.
#   publish  id-token: write. Installs no dependencies and runs no project
#            code; it packs what is already in the tree.
#   tag      contents: write. Runs git and nothing else.
#
# THE TAG IS CUT HERE BECAUSE IT CANNOT BE CUT ANYWHERE ELSE. npm binds the
# trusted publisher to ONE workflow file, so whatever must accompany a publish
# belongs inside it; and a ref pushed with GITHUB_TOKEN starts no further
# workflow run, so "tag, and let a tag-triggered publisher fire" does not
# work. A release that publishes but leaves no ref cannot be answered later:
# nothing in git says which tree the tarball came from, and nothing
# downstream can pin this SDK by tag.

name: publish-${name}

on:
  workflow_dispatch:
    inputs:
      expect_sha:
        description: 'Optional: refuse unless main is still at this commit'
        type: string
        default: ''

jobs:
  verify:
    name: verify
    runs-on: ubuntu-latest
    timeout-minutes: 20

    # Deliberately the default-minimum. This job runs third-party code.
    permissions:
      contents: read

    outputs:
      version: \${{ steps.version.outputs.version }}

    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7

      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version: 24.x

      # RELEASES COME FROM main, INCLUDING FROM THE BUTTON. workflow_dispatch
      # accepts any ref, so without this the Actions UI can release a branch.
      - name: This ref is main, and is where the caller thinks it is
        env:
          EXPECT: \${{ inputs.expect_sha }}
        run: |
          set -euo pipefail
          if [ "\${GITHUB_REF_NAME}" != "main" ]; then
            echo "::error::releases come from main, not \${GITHUB_REF_NAME}"
            exit 1
          fi
          if [ -n "\$EXPECT" ] && [ "\$EXPECT" != "\$GITHUB_SHA" ]; then
            echo "::error::main is at \$GITHUB_SHA, not \$EXPECT"
            exit 1
          fi

      - name: Resolve the version
        id: version
        working-directory: ${name}
        run: |
          set -euo pipefail
          VERSION="\$(node -p "require('./package.json').version")"
          test -n "\$VERSION" || { echo "::error::no version in ${name}/package.json"; exit 1; }
          echo "version=\$VERSION" >> "\$GITHUB_OUTPUT"
          echo "${pkg} \$VERSION"

      - run: npm install
        working-directory: ${name}

      - run: npm run build
        working-directory: ${name}

      - run: npm test
        working-directory: ${name}

  publish:
    name: npm publish
    needs: verify
    runs-on: ubuntu-latest
    timeout-minutes: 15

    # The ONLY job holding the publish credential — and it installs no
    # dependencies and runs no project code. See the header.
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7

      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version: 24.x
          registry-url: 'https://registry.npmjs.org'

      # Trusted publishing requires npm >= 11.5.1. This is npm itself, not a
      # project dependency: no package.json here is consulted.
      - name: Use a trusted-publishing capable npm
        run: npm install -g npm@latest

      # THE REGISTRY IS THE SOURCE OF TRUTH FOR "IS THIS RELEASED", not the
      # dispatch. A re-run would otherwise fail on a version conflict and
      # report a red release that in fact succeeded.
      - name: Is this version already on npm?
        id: registry
        env:
          VERSION: \${{ needs.verify.outputs.version }}
        run: |
          set -euo pipefail
          if npm view "${pkg}@\$VERSION" version >/dev/null 2>&1; then
            echo "published=true" >> "\$GITHUB_OUTPUT"
            echo "\$VERSION is already on npm — skipping publish"
          else
            echo "published=false" >> "\$GITHUB_OUTPUT"
          fi

      - name: Publish to npm
        if: steps.registry.outputs.published == 'false'
        working-directory: ${name}
        run: npm publish --access public

  # Runs git and nothing else. No install, no project code — so the
  # repository-write credential is never in scope while third-party code runs.
  #
  # It runs even when the publish step SKIPPED because the version was already
  # on the registry: that is what makes re-dispatching after a partial release
  # finish the job rather than leave a published version permanently untagged.
  tag:
    name: tag
    needs: [verify, publish]
    runs-on: ubuntu-latest
    timeout-minutes: 10

    # The ONLY job that may write to the repository, and the only one that
    # runs no project code.
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
        with:
          # Tags are needed to tell "already tagged" from "not tagged yet".
          fetch-depth: 0

      - name: Tag the release
        env:
          VERSION: \${{ needs.verify.outputs.version }}
        run: |
          set -euo pipefail
          TAG="${tag}"
          HEAD_SHA="\$(git rev-parse HEAD)"

          # EXISTENCE IS NOT ENOUGH. \`--verify\` only asks whether the name
          # resolves; a tag created between the verify job's guard and this
          # checkout could point anywhere. Treating that as idempotent would
          # leave a green run with a published artifact from THIS commit and a
          # release tag on a different one.
          AT="\$(git rev-parse -q --verify "refs/tags/\$TAG^{commit}" 2>/dev/null || true)"
          if [ -n "\$AT" ]; then
            if [ "\$AT" != "\$HEAD_SHA" ]; then
              echo "::error::\$TAG exists on \$AT, not this commit (\$HEAD_SHA)"
              exit 1
            fi
            echo "\$TAG already points here — nothing to do" >> "\$GITHUB_STEP_SUMMARY"
            exit 0
          fi
          git tag "\$TAG"
          git push origin "refs/tags/\$TAG"
          echo "pushed \$TAG" >> "\$GITHUB_STEP_SUMMARY"
`
}


function publishingDoc(model: any, targets: any[], repoUrl: string): string {
  // The doc's worked example uses the FIRST npm target; the table names each
  // target's own package, resolved per target.
  const pkg = packageName(model, targets[0].name)
  const repo = String(repoUrl || '')
    .replace(/^git\+/, '')
    .replace(/^(https?:\/\/)?(www\.)?github\.com[/:]/, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')
  const owner = '' === repo ? '<owner>/<repo>' : repo

  const rows = targets.map((t: any) =>
    `| \`${t.name}/\` | ${packageName(model, t.name)} | ` +
    `\`.github/workflows/publish-${t.name}.yml\` |`).join('\n')

  // WHICH TAG EACH TARGET CUTS. Worth a table rather than a sentence: the
  // primary npm target owns the bare `v<version>` and every other one is
  // prefixed, so with more than one npm target the answer differs per row.
  const tagRows = '| target | tag |\n|---|---|\n' + targets.map((t: any) =>
    `| \`${t.name}/\` | \`` +
    releaseTag(model, t, targets).replace('$VERSION', '<version>') +
    '\` |').join('\n')

  return `# Publishing

GENERATED by @voxgig/sdkgen — regenerated on every \`npm run generate\`.

This file is for MAINTAINERS of this repository. It is in \`.sdk/\` on
purpose: the target directories document the SDK to the people who install
it, and how this repo releases is none of their business.

| target | package | workflow |
|---|---|---|
${rows}

## How a release happens

The worked example below uses the \`${targets[0].name}\` target; every npm
target in the table above releases the same way, through its own workflow.

Publishing runs from GitHub Actions with **no NPM_TOKEN**. npm exchanges a
short-lived OIDC token — minted for one job in this repository — for a
publish credential, and attaches SLSA provenance as it goes.

1. Bump the version in the model, then regenerate:

       main: kit: target: ${targets[0].name}: publish: version: '<x.y.z>'

2. Commit and push to \`main\`, and let CI go green.
3. Run the workflow from the Actions tab, or:

       gh workflow run publish-${targets[0].name}.yml --ref main -f expect_sha=$(git rev-parse HEAD)

\`expect_sha\` is optional and worth using: it refuses if \`main\` moved between
the commit you checked and the run resolving.

It is a DISPATCH rather than a tag push because the root \`Makefile\` also
publishes, with a vault-injected token. A tag-triggered workflow racing it
would publish one version by two mechanisms.

## The release is tagged for you

The workflow cuts the git tag itself, after a successful publish, so a
released version always has a ref naming the tree it came from. Nothing to
do by hand.

${tagRows}

Re-dispatching a version that is already on the registry skips the publish
and still cuts a missing tag, so a partial release is finished by running it
again rather than repaired by hand. If the tag already exists on a DIFFERENT
commit the run fails rather than moving it: that combination means the
published artifact and the tag disagree, and only a person should decide
which is wrong.

The tag job is the only one that may write to the repository, and it runs
git and nothing else. \`contents: write\` never shares a job with project
code, for the same reason \`id-token: write\` does not — \`checkout\` persists
its token into the git config for the whole job.

## One-time set-up

npm has to be told which repository and which workflow file may publish this
package. From a machine logged in to npm with publish rights (2FA is
required):

    npm trust github ${pkg} \\
      --repository ${owner} \\
      --file publish-${targets[0].name}.yml \\
      --allow-publish

Then \`npm trust list ${pkg}\` shows it, and
\`npm trust revoke ${pkg} --id=<id>\` removes it.

**The workflow filename is part of the configuration.** Renaming
\`publish-${targets[0].name}.yml\` breaks publishing until the npm side is
updated to match.

**A brand-new package cannot be set up this way.** npm only offers the
trusted-publisher settings once a version exists, so the FIRST release of a
package goes out by hand from an authenticated machine:

    cd ts && npm publish --access public

After that, register the publisher and every later release is a dispatch.

## Why the workflow has three jobs

A dependency lifecycle script can ask the runner for any OIDC token the job
it runs in is permitted to mint. A job that both installs dependencies and
holds \`id-token: write\` can therefore be made to publish as this package
before its own gates finish.

So \`verify\` installs, builds and tests under \`contents: read\` and holds no
credential; \`publish\` holds \`id-token: write\` while installing nothing and
running no project code; and \`tag\` holds \`contents: write\` while running
git and nothing else.

The tag cannot be moved out into its own workflow: npm binds the trusted
publisher to ONE workflow filename, so anything that must accompany a publish
has to live inside this file. Nor can it be left to a tag-triggered
publisher — a ref pushed with \`GITHUB_TOKEN\` starts no further workflow run.
`
}


export {
  PublishWorkflow
}
