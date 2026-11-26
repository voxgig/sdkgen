"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyFacts = applyFacts;
exports.fact = fact;
exports.refuseRootPlan = refuseRootPlan;
const node_fs_1 = require("node:fs");
const aontu_1 = require("aontu");
const jostraca_1 = require("jostraca");
const apidef_1 = require("@voxgig/apidef");
const doctext_1 = require("./doctext");
const shipped_1 = require("./shipped");
const opShape_1 = require("./opShape");
const packageMeta_1 = require("./packageMeta");
const utility_1 = require("../utility");
const resolve_1 = require("../action/resolve");
const title_1 = require("./title");
const graphqlPoint_1 = require("./graphqlPoint");
// No fact rule reads these, and they are most of a large model. A model's
// facts are left out too: the rules compute every one afresh.
const UNREAD = ['entity', 'flow', 'fact'];
function isMap(v) {
    return null != v && 'object' === typeof v && !Array.isArray(v);
}
function copyFacts(from, to) {
    for (const [key, val] of Object.entries(from)) {
        if ('fact' === key) {
            if (isMap(val) && 0 < Object.keys(val).length) {
                to.fact = val;
            }
        }
        else if (isMap(val) && isMap(to[key])) {
            copyFacts(val, to[key]);
        }
    }
}
// Computes every fact once and writes it into the model beside what it
// describes, as `fact`. Templates read facts with `fact`; none computes one.
function applyFacts(model) {
    const kit = model?.main?.[apidef_1.KIT];
    if (!isMap(kit)) {
        return model;
    }
    const input = {};
    for (const [key, val] of Object.entries(kit)) {
        if (!UNREAD.includes(key)) {
            input[key] = val;
        }
    }
    if (isMap(kit.target)) {
        input.target = ruleTargets(kit.target);
    }
    if (isMap(kit.feature)) {
        input.feature = withoutFacts(kit.feature);
    }
    input.config = { ...(isMap(kit.config) ? kit.config : {}), auth: mapOr(kit.config?.auth) };
    input.info = { ...(isMap(kit.info) ? kit.info : {}), security: mapOr(kit.info?.security) };
    const server = ruleServer(kit.info);
    const entity = Object.fromEntries(Object.keys(mapOr(kit.entity)).map((name) => [name, {}]));
    const texts = (0, doctext_1.docTexts)(model);
    const escape = Object.fromEntries(texts.map((t, i) => ['t' + i, { raw: t.raw, vendor: t.vendor }]));
    const path = (0, shipped_1.factRulesFile)();
    const src = JSON.stringify({
        name: 'string' === typeof model.name ? model.name : '',
        main: { [apidef_1.KIT]: input }, server: server.rule, entity, escape,
    }).slice(1, -1) + '\n' + (0, node_fs_1.readFileSync)(path, 'utf8');
    const errs = [];
    const out = new aontu_1.Aontu().generate(src, { path, errs });
    if (0 < errs.length || null == out?.main?.[apidef_1.KIT]) {
        throw new Error('sdkgen facts: the fact rules did not evaluate: ' +
            errs.map((e) => `[${e.why}] ${e.msg}`).join(' | '));
    }
    copyFacts(out.main[apidef_1.KIT], kit);
    linkConsumers(kit.target, out.main[apidef_1.KIT].target);
    kit.fact = isMap(kit.fact) ? kit.fact : {};
    kit.fact.active = activeNames(kit.target);
    serverFacts(kit.fact, server, out.server.variables);
    kit.fact.env.entid = Object.fromEntries(Object.keys(entity).map((name) => [name, out.entity[name].fact.entid]));
    kit.fact.ops = entityOps(kit.entity);
    kit.fact.package = projectPackages(model);
    kit.fact.option = optionRows(kit.optspec);
    releaseTags(model);
    texts.forEach((t, i) => place(t.at, t.path, out.escape['t' + i]));
    kit.fact.field = mapOr(kit.fact.field);
    (0, title_1.titleFacts)(kit.target);
    kit.fact.external = externalTargets(model);
    place(kit, ['definitionKind'], (0, graphqlPoint_1.definitionKind)(model));
    return model;
}
// The active targets placed in another repository, read here because the model
// the project's Root receives, which its documents read, leaves them out.
function externalTargets(model) {
    const target = mapOr(model.main[apidef_1.KIT].target);
    return model.main[apidef_1.KIT].fact.active
        .filter((name) => 'external' === target[name].fact?.place)
        .map((name) => ({
        name,
        title: target[name].fact.title,
        surface: target[name].fact.surface,
        dir: target[name].fact.dir,
        url: '' === String(target[name].output?.repo ?? '') ? '' : (0, packageMeta_1.repoInfo)(model, name).repoUrl,
    }));
}
function mapOr(value) {
    return isMap(value) ? value : {};
}
function withoutFacts(items) {
    return Object.fromEntries(Object.entries(items).map(([name, item]) => [name, isMap(item) ? { ...item, fact: undefined } : item]));
}
// The URL's variables in the order serverVariables gives them: as the URL names
// them, then the declared ones it does not. A variable the URL names but the
// spec omits is declared here, empty, so the rules decide it with the rest.
const SERVER_VAR_RE = /\{([A-Za-z0-9_]+)\}/g;
function ruleServer(info) {
    const server = info?.servers?.[0];
    const url = 'string' === typeof server?.url ? server.url : '';
    const declared = mapOr(server?.variables);
    const order = [...new Set([...url.matchAll(SERVER_VAR_RE)].map((m) => m[1]))];
    order.push(...Object.keys(declared).filter((name) => !order.includes(name)));
    const variables = Object.fromEntries(order.map((name) => {
        const decl = mapOr(declared[name]);
        return [name, { default: 'string' === typeof decl.default ? decl.default : '' }];
    }));
    return { rule: { url, variables }, order, declared };
}
// aontu lists no map's keys, so the variables the rules decided are listed here.
function serverFacts(facts, server, decided) {
    facts.server = server.order.map((name) => {
        const decl = mapOr(server.declared[name]);
        return {
            name,
            dflt: server.rule.variables[name].default,
            required: decided[name].fact.required,
            description: 'string' === typeof decl.description ? decl.description : '',
        };
    });
    facts.env.server = Object.fromEntries(server.order.map((name) => [name, decided[name].fact.env]));
}
// Each entity's canonical operations, in canonical order: the list aontu
// cannot build from a map. An action-only operation counts. They sit outside
// the entities, which some tests print whole into generated source.
function entityOps(entity) {
    return Object.fromEntries(Object.entries(mapOr(entity))
        .filter(([, ent]) => isMap(ent))
        .map(([name, ent]) => [name, opShape_1.CANON_OP_ORDER.filter((op) => isMap(ent.op?.[op]) && false !== ent.op[op].active)]));
}
// The JVM package of java, kotlin and scala, and the Python package py and
// py-data import. py's is jostraca's Name for the project, lower-cased, as the
// Root names it; aontu's nom splits words differently.
function projectPackages(model) {
    const word = (s) => String(s ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const project = {};
    (0, jostraca_1.names)(project, String(model.name ?? ''));
    return {
        jvm: word(String(model.origin || 'voxgig-sdk').replace(/-sdk$/, '')) + '.' + word(model.name) + 'sdk',
        py: String(project.Name ?? '').toLowerCase() + '_sdk',
    };
}
// One row per client option, in the order main.kit.optspec declares them.
function optionRows(optspec) {
    return Object.entries(mapOr(optspec)).map(([name, spec]) => ({ name, type: optionType(spec) }));
}
function optionType(spec) {
    if (isMap(spec)) {
        return 'object';
    }
    if ('string' === typeof spec && spec.startsWith('`$')) {
        return (0, doctext_1.sentinelName)(spec);
    }
    return typeof spec;
}
// The tag before a version: `<prefix>/v`, else `v` for the tree's one npm
// package or the ts SDK's, else `<target>/v`, and empty when switched off.
// Only code compares package names, so this is the pass's, not a rule's.
function releaseTags(model) {
    const kit = model.main[apidef_1.KIT];
    const target = mapOr(kit.target);
    const npm = kit.fact.active.filter((name) => isMap(target[name]?.fact) &&
        'external' !== target[name].fact.place &&
        'npm' === (target[name].publish?.registry?.name || '') && (0, packageMeta_1.hasPackageName)(model, name) &&
        'inactive' !== (0, packageMeta_1.registryState)(model, name));
    // A model with no name, built by hand, has no package names to compare.
    const primary = (name) => npm.includes(name) && (1 === npm.length ||
        (null != model.name && (0, packageMeta_1.packageName)(model, name) === (0, packageMeta_1.packageName)(model, 'npm')));
    for (const name of Object.keys(target)) {
        if (isMap(target[name]?.fact)) {
            const tag = mapOr(target[name].publish?.tag);
            const prefix = 'string' === typeof tag.prefix ? tag.prefix : '';
            target[name].fact.tag = false === tag.active ? '' :
                '' !== prefix ? prefix + '/v' : primary(name) ? 'v' : name + '/v';
        }
    }
}
// aontu lists no map's keys, so the active targets are named here.
function activeNames(target) {
    return !isMap(target) ? [] : Object.keys(target).sort()
        .filter((name) => isMap(target[name]) && false !== target[name].active);
}
// A hand-built model may lack the slots the rules read, and only code can say
// whether a target's provenance leads to the bundled scaffold.
function ruleTargets(target) {
    const out = {};
    for (const [name, decl] of Object.entries(withoutFacts(target))) {
        out[name] = !isMap(decl) ? decl : {
            ...decl,
            name: null == decl.name ? name : decl.name,
            origname: null == decl.origname ? '' : decl.origname,
            surface: null == decl.surface ? '' : decl.surface,
            consumes: null == decl.consumes ? '' : decl.consumes,
            scaffold: (0, resolve_1.resolvesBundled)(decl, name),
        };
    }
    return out;
}
// The rules name the origin a target builds on; only the installed keys can
// say which target that is, and which targets build on each one.
function linkConsumers(target, derived) {
    if (!isMap(target) || !isMap(derived)) {
        return;
    }
    const names = Object.keys(target).sort().filter((name) => isMap(target[name]?.fact));
    for (const name of names) {
        const wraps = derived[name]?.derive?.wraps;
        target[name].fact.wraps = 'string' === typeof wraps ? wraps : '';
        target[name].fact.consumes = consumed(target, name, wraps);
    }
    for (const name of names) {
        target[name].fact.consumers = names.filter((other) => false !== target[other].active && name === target[other].fact.consumes);
    }
}
function consumed(target, name, wraps) {
    if ('string' !== typeof wraps || '' === wraps) {
        return '';
    }
    if (isMap(target[wraps])) {
        return wraps;
    }
    const found = Object.keys(target).sort().filter((other) => other !== name && wraps === target[other]?.fact?.origin);
    if (1 < found.length) {
        throw new utility_1.SdkGenError('Target "' + name + '" builds on ' + wraps + ', and ' +
            found.length + ' installed targets come from it: ' + found.join(', ') +
            '. Name one in its own model, as `consumes: \'<target>\'`.');
    }
    return found[0] ?? '';
}
function place(at, path, forms) {
    let node = at.fact = isMap(at.fact) ? at.fact : {};
    for (const key of path.slice(0, -1)) {
        node = node[key] = isMap(node[key]) ? node[key] : {};
    }
    node[path[path.length - 1]] = forms;
}
function fact(node, name) {
    const facts = node?.fact;
    if (!isMap(facts) || !(name in facts)) {
        throw new Error(`sdkgen facts: '${node?.name ?? '?'}' has no fact '${name}': ` +
            'the model did not pass through applyFacts, or lacks what the fact reads');
    }
    return facts[name];
}
// A plan no Root can write: several targets claiming the project root, or a
// target there beside the root documents, which would overwrite its own.
// `external` names the targets this run writes elsewhere; a target with no
// `output` claims no place at all.
function refuseRootPlan(model, external = []) {
    const kit = model.main[apidef_1.KIT];
    const target = kit.target || {};
    const atRoot = Object.keys(target).sort().filter((name) => !external.includes(name) && false !== target[name].active &&
        null != target[name].output && 'root' === fact(target[name], 'place'));
    if (1 < atRoot.length) {
        throw new utility_1.SdkGenError('Only one target can be generated at the project root, and ' +
            atRoot.length + ' declare `output: root: true`: ' + atRoot.join(', ') + '.');
    }
    if (1 === atRoot.length && fact(kit, 'top')) {
        throw new utility_1.SdkGenError('Target "' + atRoot[0] + '" is generated at the project root, where the ' +
            'SDK repository files (README, LICENSE, Makefile, workflows) would ' +
            'overwrite its own. Declare `main: kit: phase: top: active: false` in ' +
            'model/project.aontu.');
    }
}
//# sourceMappingURL=facts.js.map