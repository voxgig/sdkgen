"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Deploy = void 0;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const packageMeta_1 = require("../helpers/packageMeta");
const facts_1 = require("../helpers/facts");
const types_1 = require("../types");
const Deploy = (0, component_1.cmp)(function Deploy(props) {
    const { ctx$ } = props;
    const { model } = ctx$;
    const kit = model.main[types_1.KIT];
    const targets = (0, facts_1.fact)(kit, 'active').map((name) => kit.target[name]);
    if (0 === targets.length) {
        return;
    }
    (0, jostraca_1.File)({ name: 'Makefile' }, () => {
        (0, jostraca_1.Content)(makeDeployMakefile(model, targets));
    });
    ctx$.log.info({
        point: 'generate-deploy',
        note: 'targets: ' + targets.map((t) => {
            const state = (0, packageMeta_1.registryState)(model, t.name);
            return t.name + ('tag' === state ? ':tag-only' :
                ':' + registryOf(t).name + ('active' === state ? '' : '(publish ' + pendingWord(state) + ')'));
        }).join(',')
    });
});
exports.Deploy = Deploy;
// The declared registry block, `none` included: a port that declares one
// has its release tag cut at the root, whatever registryState calls it.
function registryOf(t) {
    const reg = t.publish?.registry;
    return (reg && '' !== (reg.name || '')) ? reg : undefined;
}
function pendingWord(state) {
    return 'inactive' === state ? 'inactive' : 'pending';
}
function aliasVarName(name) {
    return name.toUpperCase().replace(/[^A-Z0-9]+/g, '_') + '_ALIAS';
}
// The boru vault exec argument string for a target: `--for=<recipe>=<alias>`
// flags where a preset recipe exists, or a raw `'alias=ENV_VAR,...'`
// mapping when any credential lacks a preset (e.g. luarocks). The github
// token for the tag push is always included.
function vaultExecArgs(t) {
    const tagVault = t.publish?.tag?.vault || {};
    const ghRecipe = tagVault.recipe || 'github';
    const ghVar = aliasVarName(ghRecipe);
    const reg = registryOf(t);
    const regVault = reg?.vault || {};
    const regVar = reg ? aliasVarName(reg.name) : '';
    if (reg && '' === (regVault.recipe || '') && '' !== (regVault.env || '')) {
        return `'$(${regVar})=${regVault.env},$(${ghVar})=GITHUB_TOKEN'`;
    }
    const flags = [];
    if (reg && '' !== (regVault.recipe || '')) {
        flags.push(`--for=${regVault.recipe}=$(${regVar})`);
    }
    flags.push(`--for=${ghRecipe}=$(${ghVar})`);
    return flags.join(' ');
}
function makeDeployMakefile(model, targets) {
    const aliasVars = new Map();
    for (const t of targets) {
        const tagVault = t.publish?.tag?.vault || {};
        const ghRecipe = tagVault.recipe || 'github';
        if (!aliasVars.has(aliasVarName(ghRecipe))) {
            aliasVars.set(aliasVarName(ghRecipe), tagVault.alias || ghRecipe);
        }
        const reg = registryOf(t);
        if (reg && 'tag' !== (0, packageMeta_1.registryState)(model, t.name) && !aliasVars.has(aliasVarName(reg.name))) {
            aliasVars.set(aliasVarName(reg.name), reg.vault?.alias || reg.name);
        }
    }
    const summary = targets.map((t) => {
        const reg = registryOf(t);
        const rs = (0, packageMeta_1.registryState)(model, t.name);
        const state = 'tag' === rs ? 'tag-only' :
            `${reg.name} (${'active' === rs ? 'ACTIVE' : 'publish ' + pendingWord(rs) + ': deploy publishes the git tag only'}) ${reg.url || ''}`.trim();
        return `#   ${t.name.padEnd(8)} ${state}`;
    }).join('\n');
    const deployRules = targets.map((t) => {
        const reg = registryOf(t);
        const tagVault = t.publish?.tag?.vault || {};
        const ghRecipe = tagVault.recipe || 'github';
        const ghArgs = `--for=${ghRecipe}=$(${aliasVarName(ghRecipe)})`;
        const args = vaultExecArgs(t);
        const via = t.publish?.tag?.via || 'port';
        const dir = (0, facts_1.fact)(t, 'dir');
        const rs = (0, packageMeta_1.registryState)(model, t.name);
        if ('tag' === rs && (reg || 'root' === via)) {
            return `
deploy-${t.name}:
\t@echo "deploy-${t.name}: tag-only port — publishing the git tag."
\tboru vault exec ${ghArgs} -- $(MAKE) tag-push-${t.name}

deploy-dry-${t.name}:
\tboru vault exec --dry-run ${ghArgs} -- $(MAKE) tag-push-${t.name}
${tagPushRecipe(t.name, (0, packageMeta_1.packageVersion)(model, t.name), 'tag-only port')}
`;
        }
        if ('tag' !== rs && 'active' !== rs) {
            const word = pendingWord(rs);
            return `
deploy-${t.name}:
\t@echo "deploy-${t.name}: ${reg.name} publication is ${word} — publishing the git tag only."
\tboru vault exec ${ghArgs} -- $(MAKE) tag-push-${t.name}

deploy-dry-${t.name}:
\tboru vault exec --dry-run ${ghArgs} -- $(MAKE) tag-push-${t.name}
${tagPushRecipe(t.name, (0, packageMeta_1.packageVersion)(model, t.name), reg.name + ' publication ' + word + ' — tag-only deploy')}
`;
        }
        return `
deploy-${t.name}:
\tboru vault exec ${args} -- $(MAKE) -C ${dir} publish

deploy-dry-${t.name}:
\tboru vault exec --dry-run ${args} -- $(MAKE) -C ${dir} publish
`;
    }).join('');
    const varLines = Array.from(aliasVars.entries())
        .map(([v, def]) => `${v} ?= ${def}`).join('\n');
    return `# ${model.Name} SDK deployment. GENERATED by @voxgig/sdkgen — regenerated
# on every \`npm run generate\` in .sdk/; publication details live in the
# model (.sdk/model/target/<target>.aontu, \`publish\` section).
#
# Every port gets a git release tag <target>/vX.Y.Z. Ports with an ACTIVE
# registry also publish a package there. Credentials are injected at exec
# time by the boru key vault (https://github.com/boru-lang/boru) — never
# stored on disk or passed on the command line.
#
# Publication state (from the model):
${summary}
#
#   make deploy               list per-target deploy commands
#   make deploy-<target>      deploy ONE target (no deploy-all: each
#                             registry upload is irreversible); while a
#                             registry is pending this publishes the
#                             port's git tag only
#   make deploy-dry           rehearse EVERY target: boru --dry-run
#                             injects a filler token that each publish
#                             recipe detects, so build + test run in full
#                             but nothing is uploaded and no tag is cut
#
# Vault aliases (override per invocation, e.g. make deploy-ts NPM_ALIAS=work:npm):

SHELL := /bin/bash

${varLines}

BORU_DRY_RUN_FILLER := BORU-DRY-RUN-FILLER-NOT-A-REAL-SECRET

TARGETS := ${targets.map((t) => t.name).join(' ')}

.PHONY: deploy deploy-dry \\
  $(addprefix deploy-,$(TARGETS)) $(addprefix deploy-dry-,$(TARGETS)) \\
  $(addprefix tag-push-,$(TARGETS))

deploy:
\t@echo "Deployment is per-target — pick one (each upload is irreversible):"
\t@echo "  make deploy-<target>    targets: $(TARGETS)"
\t@echo "Registry state is set in the model (.sdk/model/target/<t>.aontu):"
${targets.map((t) => {
        const reg = registryOf(t);
        const rs = (0, packageMeta_1.registryState)(model, t.name);
        const state = 'tag' === rs ? 'tag-only' :
            `${reg.name} ${'active' === rs ? 'ACTIVE' : 'publish ' + pendingWord(rs) + ' (deploy = git tag only)'}`;
        return `\t@echo "  deploy-${t.name.padEnd(8)} ${state}"`;
    }).join('\n')}
\t@echo "Rehearse everything safely first: make deploy-dry"

deploy-dry: $(addprefix deploy-dry-,$(TARGETS))
\t@echo "deploy-dry: all targets rehearsed OK ($(TARGETS))"
${deployRules}`;
}
// The root-level tag creation + push recipe for a target: boru --dry-run
// filler cooperation, idempotent tag creation, token-authenticated https
// push (works from an ssh-remote clone without ssh keys).
function tagPushRecipe(name, version, note) {
    // The version is embedded in both Make and shell syntax.
    if (!/^[0-9A-Za-z][0-9A-Za-z.+-]*$/.test(version)) {
        throw new Error('Deploy: invalid publish.version for target "' + name + '": ' + JSON.stringify(version));
    }
    return `
tag-push-${name}:
\t@set -e; tag="${name}/v${version}"; \\
\ttoken="\$\${GITHUB_TOKEN:-$$GH_TOKEN}"; \\
\tif [ "$$token" = "$(BORU_DRY_RUN_FILLER)" ]; then \\
\t  echo "[dry-run] boru filler token detected: would create (if missing) and push tag $$tag; nothing pushed."; exit 0; fi; \\
\tif [ -z "$$token" ]; then echo "tag-push-${name}: no GITHUB_TOKEN in env — run via make deploy-${name} (boru vault exec)"; exit 1; fi; \\
\tif git rev-parse -q --verify "refs/tags/$$tag" >/dev/null; then \\
\t  echo "tag $$tag already exists — pushing existing tag"; \\
\telse git tag -a "$$tag" -m "Release $$tag"; fi; \\
\turl=$$(git remote get-url origin | sed -E 's#^git@github.com:#https://github.com/#'); \\
\thdr="AUTHORIZATION: basic $$(printf 'x-access-token:%s' "$$token" | base64 | tr -d '\\n')"; \\
\tgit -c http.extraheader="$$hdr" push "$$url" "$$tag"; \\
\techo "pushed $$tag (${note})"`;
}
//# sourceMappingURL=Deploy.js.map