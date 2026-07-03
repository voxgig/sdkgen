import { cmp, each, Content, File } from 'jostraca'

import {
  KIT,
  getModelPath
} from '../types'


// Generate the SDK root deployment Makefile from the model's per-target
// `publish` sections (see model/sdkgen.jsonic):
//
//   publish.tag       — git release tag `<prefix>/vX.Y.Z`; every port has
//                       one, pushed with a token from the aql key vault
//                       (--for recipe + alias, default github/github).
//   publish.registry  — package registry details (name, url, vault
//                       credential recipe or raw env mapping) plus an
//                       `active` flag. While a registry is inactive a
//                       real deploy publishes the git tag only; the
//                       package upload starts when `active` flips true.
//                       Tag-only ports (go family) have no registry.
//
// Follows the voxgig/struct root Makefile conventions: per-target deploy
// targets, deliberately no all-targets real deploy (each upload is
// irreversible), and an everything-at-once DRY run leaning on
// `aql vault exec --dry-run` filler-token cooperation in each target's
// publish recipe.
const Deploy = cmp(function Deploy(props: any) {
  const { ctx$ } = props
  const { model } = ctx$

  const targetMap = getModelPath(model, `main.${KIT}.target`) || {}
  const targets: any[] = []
  each(targetMap, (t: any) => {
    if (false !== t.active) targets.push(t)
  })

  if (0 === targets.length) {
    return
  }

  File({ name: 'Makefile' }, () => {
    Content(makeDeployMakefile(model, targets))
  })

  ctx$.log.info({
    point: 'generate-deploy',
    note: 'targets: ' + targets.map((t: any) =>
      t.name + (registryOf(t) ? (':' + registryOf(t).name + (registryOf(t).active ? '' : '(inactive)')) : ':tag-only')
    ).join(',')
  })
})


function registryOf(t: any): any | undefined {
  const reg = t.publish?.registry
  return (reg && '' !== (reg.name || '')) ? reg : undefined
}


function aliasVarName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, '_') + '_ALIAS'
}


// The aql vault exec argument string for a target: `--for=<recipe>=<alias>`
// flags where a preset recipe exists, or a raw `'alias=ENV_VAR,...'`
// mapping when any credential lacks a preset (e.g. luarocks). The github
// token for the tag push is always included.
function vaultExecArgs(t: any): string {
  const tagVault = t.publish?.tag?.vault || {}
  const ghRecipe = tagVault.recipe || 'github'
  const ghVar = aliasVarName(ghRecipe)
  const reg = registryOf(t)
  const regVault = reg?.vault || {}
  const regVar = reg ? aliasVarName(reg.name) : ''

  if (reg && '' === (regVault.recipe || '') && '' !== (regVault.env || '')) {
    // Raw env mapping style: every credential as alias=ENV_VAR.
    return `'$(${regVar})=${regVault.env},$(${ghVar})=GITHUB_TOKEN'`
  }

  const flags = []
  if (reg && '' !== (regVault.recipe || '')) {
    flags.push(`--for=${regVault.recipe}=$(${regVar})`)
  }
  flags.push(`--for=${ghRecipe}=$(${ghVar})`)
  return flags.join(' ')
}


function makeDeployMakefile(model: any, targets: any[]): string {
  // Alias variables: one per distinct vault credential, defaulting to the
  // model's alias (or the registry/recipe name).
  const aliasVars = new Map<string, string>()
  for (const t of targets) {
    const tagVault = t.publish?.tag?.vault || {}
    const ghRecipe = tagVault.recipe || 'github'
    if (!aliasVars.has(aliasVarName(ghRecipe))) {
      aliasVars.set(aliasVarName(ghRecipe), tagVault.alias || ghRecipe)
    }
    const reg = registryOf(t)
    if (reg && !aliasVars.has(aliasVarName(reg.name))) {
      aliasVars.set(aliasVarName(reg.name), reg.vault?.alias || reg.name)
    }
  }

  const summary = targets.map((t: any) => {
    const reg = registryOf(t)
    const state = reg
      ? `${reg.name} (${reg.active ? 'ACTIVE' : 'inactive: deploy publishes the git tag only'}) ${reg.url || ''}`.trim()
      : 'tag-only'
    return `#   ${t.name.padEnd(8)} ${state}`
  }).join('\n')

  const deployRules = targets.map((t: any) => {
    const reg = registryOf(t)
    // The github token is the only credential a tag-only deploy needs.
    const tagVault = t.publish?.tag?.vault || {}
    const ghRecipe = tagVault.recipe || 'github'
    const ghArgs = `--for=${ghRecipe}=$(${aliasVarName(ghRecipe)})`
    const args = vaultExecArgs(t)

    const via = t.publish?.tag?.via || 'port'

    if (!reg && 'root' === via) {
      // Tag-only port with no Makefile of its own (e.g. go-cli): the
      // root tag-push recipe is the whole deploy.
      return `
deploy-${t.name}:
\t@echo "deploy-${t.name}: tag-only port — publishing the git tag."
\taql vault exec ${ghArgs} -- $(MAKE) tag-push-${t.name}

deploy-dry-${t.name}:
\taql vault exec --dry-run ${ghArgs} -- $(MAKE) tag-push-${t.name}
${tagPushRecipe(t.name, 'tag-only port')}
`
    }

    if (reg && !reg.active) {
      // Inactive registry: deploying this target publishes its git tag
      // only. The package upload turns on by flipping
      // publish.registry.active in the model and regenerating.
      return `
deploy-${t.name}:
\t@echo "deploy-${t.name}: ${reg.name} publication is inactive — publishing the git tag only."
\taql vault exec ${ghArgs} -- $(MAKE) tag-push-${t.name}

deploy-dry-${t.name}:
\taql vault exec --dry-run ${ghArgs} -- $(MAKE) tag-push-${t.name}
${tagPushRecipe(t.name, reg.name + ' publication inactive — tag-only deploy')}
`
    }

    return `
deploy-${t.name}:
\taql vault exec ${args} -- $(MAKE) -C ${t.name} publish

deploy-dry-${t.name}:
\taql vault exec --dry-run ${args} -- $(MAKE) -C ${t.name} publish
`
  }).join('')

  const varLines = Array.from(aliasVars.entries())
    .map(([v, def]) => `${v} ?= ${def}`).join('\n')

  return `# ${model.Name} SDK deployment. GENERATED by @voxgig/sdkgen — regenerated
# on every \`npm run generate\` in .sdk/; publication details live in the
# model (.sdk/model/target/<target>.jsonic, \`publish\` section).
#
# Every port gets a git release tag <target>/vX.Y.Z. Ports with an ACTIVE
# registry also publish a package there. Credentials are injected at exec
# time by the aql key vault (https://github.com/aql-lang/aql) — never
# stored on disk or passed on the command line.
#
# Publication state (from the model):
${summary}
#
#   make deploy               list per-target deploy commands
#   make deploy-<target>      deploy ONE target (no deploy-all: each
#                             registry upload is irreversible); while a
#                             registry is inactive this publishes the
#                             port's git tag only
#   make deploy-dry           rehearse EVERY target: aql --dry-run
#                             injects a filler token that each publish
#                             recipe detects, so build + test run in full
#                             but nothing is uploaded and no tag is cut
#
# Vault aliases (override per invocation, e.g. make deploy-ts NPM_ALIAS=work:npm):

SHELL := /bin/bash

${varLines}

# Lockstep SDK version, read from the canonical ts manifest.
VERSION := $(shell node -p "require('./ts/package.json').version" 2>/dev/null || echo 0.0.0)
AQL_DRY_RUN_FILLER := AQL-DRY-RUN-FILLER-NOT-A-REAL-SECRET

TARGETS := ${targets.map((t: any) => t.name).join(' ')}

.PHONY: deploy deploy-dry \\
  $(addprefix deploy-,$(TARGETS)) $(addprefix deploy-dry-,$(TARGETS)) \\
  $(addprefix tag-push-,$(TARGETS))

deploy:
\t@echo "Deployment is per-target — pick one (each upload is irreversible):"
\t@echo "  make deploy-<target>    targets: $(TARGETS)"
\t@echo "Registry state is set in the model (.sdk/model/target/<t>.jsonic):"
${targets.map((t: any) => {
    const reg = registryOf(t)
    const state = reg ? `${reg.name} ${reg.active ? 'ACTIVE' : 'inactive (deploy = git tag only)'}` : 'tag-only'
    return `\t@echo "  deploy-${t.name.padEnd(8)} ${state}"`
  }).join('\n')}
\t@echo "Rehearse everything safely first: make deploy-dry"

deploy-dry: $(addprefix deploy-dry-,$(TARGETS))
\t@echo "deploy-dry: all targets rehearsed OK ($(TARGETS))"
${deployRules}`
}



// The root-level tag creation + push recipe for a target: aql --dry-run
// filler cooperation, idempotent tag creation, token-authenticated https
// push (works from an ssh-remote clone without ssh keys).
function tagPushRecipe(name: string, note: string): string {
  return `
tag-push-${name}:
\t@set -e; tag="${name}/v$(VERSION)"; \\
\ttoken="\$\${GITHUB_TOKEN:-$$GH_TOKEN}"; \\
\tif [ "$$token" = "$(AQL_DRY_RUN_FILLER)" ]; then \\
\t  echo "[dry-run] aql filler token detected: would create (if missing) and push tag $$tag; nothing pushed."; exit 0; fi; \\
\tif [ -z "$$token" ]; then echo "tag-push-${name}: no GITHUB_TOKEN in env — run via make deploy-${name} (aql vault exec)"; exit 1; fi; \\
\tif git rev-parse -q --verify "refs/tags/$$tag" >/dev/null; then \\
\t  echo "tag $$tag already exists — pushing existing tag"; \\
\telse git tag -a "$$tag" -m "Release $$tag"; fi; \\
\turl=$$(git remote get-url origin | sed -E 's#^git@github.com:#https://github.com/#'); \\
\thdr="AUTHORIZATION: basic $$(printf 'x-access-token:%s' "$$token" | base64 | tr -d '\\n')"; \\
\tgit -c http.extraheader="$$hdr" push "$$url" "$$tag"; \\
\techo "pushed $$tag (${note})"`
}

export {
  Deploy
}
