"use strict";
// The resolved description of one target's SDK: every fact the documentation
// states, computed once from the model. Plain data, JSON-serialisable, so a
// syntax provider can print from it without reading the model.
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPTION_UNSTATED = exports.OPTION_TEXT = void 0;
exports.templateName = templateName;
exports.sdkDescription = sdkDescription;
exports.readsSecret = readsSecret;
exports.showFieldsOf = showFields;
const apidef_1 = require("@voxgig/apidef");
const utility_1 = require("@voxgig/apidef/dist/utility");
const canonType_1 = require("./canonType");
const opShape_1 = require("./opShape");
const media_1 = require("./media");
const text_1 = require("./text");
const applicability_1 = require("./applicability");
const FeatureDocs_1 = require("../cmp/FeatureDocs");
const opExample_1 = require("./opExample");
const packageMeta_1 = require("./packageMeta");
const serverVars_1 = require("./serverVars");
const utility_2 = require("../utility");
const memo = new WeakMap();
// `naming` is the target's Naming hook, which the calling component finds;
// `stdrep` the template substitutions generation applies (ctx$.stdrep).
// The runtimes read `secret` only for Basic sent in the header (PrepareAuth).
function readsSecret(model) {
    return (0, utility_2.isAuthActive)(model) && (0, utility_2.isHttpBasicAuth)(model) && 'header' === (0, utility_2.resolveAuthIn)(model) && !(0, utility_2.isAuthSuppressed)(model);
}
function sdkDescription(model, target, naming, stdrep) {
    const targetName = target.name;
    let byTarget = memo.get(model);
    if (null == byTarget) {
        byTarget = {};
        memo.set(model, byTarget);
    }
    if (null == byTarget[targetName]) {
        byTarget[targetName] = JSON.parse(JSON.stringify(describe(model, target, naming || genericNaming, templateMap(model, stdrep))));
    }
    return byTarget[targetName];
}
// The ProjectName family of substitutions, as generation applies them to the
// templates: the Root's ctx$.stdrep (names(stdrep, Name, 'ProjectName')).
function templateMap(model, stdrep) {
    const src = stdrep && null != stdrep.ProjectName ? stdrep : projectNames(model.const.Name);
    const out = {};
    for (const [k, v] of Object.entries(src)) {
        if (/^project[_-]?name[_-]?$/i.test(k) && 'string' === typeof v)
            out[k] = v;
    }
    return out;
}
function projectNames(Name) {
    const snake = Name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    return {
        ProjectName: Name, project_name_: snake, 'project-name-': snake.replace(/_/g, '-'),
        projectname: Name.toLowerCase(), PROJECTNAME: Name.toUpperCase(),
    };
}
// A name as the templates spell it, substituted as the templates are.
function templateName(map, name) {
    const keys = Object.keys(map).sort((a, b) => b.length - a.length);
    if (0 === keys.length)
        return name;
    const re = new RegExp(keys.map((k) => k.replace(/[-]/g, '\\-')).join('|'), 'g');
    return name.replace(re, (k) => map[k]);
}
// For a target with no naming hook: the class-name stem, unchanged.
const genericNaming = (model, _target, tm) => ({
    layout: { module: model.name, client: tm('ProjectNameSDK'), ctor: tm('ProjectNameSDK') },
    symbols: (e) => ({ accessor: (0, apidef_1.nom)(e, 'Name'), var: e.name }),
});
function describe(model, target, naming, template) {
    const targetName = target.name;
    const names = naming(model, target, (n) => templateName(template, n));
    const ident = names.ident || ((n) => n);
    const layout = {
        ...names.layout,
        vars: Object.fromEntries(['results', 'item', 'result', 'created'].map((n) => [n, ident(n)])),
    };
    const prefix = (0, packageMeta_1.envName)(model);
    const active = (0, utility_2.isAuthActive)(model);
    const where = (0, utility_2.resolveAuthIn)(model);
    const basic = (0, utility_2.isHttpBasicAuth)(model);
    const secret = readsSecret(model);
    const server = (0, serverVars_1.serverVariables)(model)
        .filter((v) => referenced(model, v.name))
        .map((v) => ({ name: v.name, required: v.required, dflt: v.dflt }));
    const options = [];
    if (active)
        options.push({ name: 'apikey', env: prefix + '_APIKEY' });
    if (secret)
        options.push({ name: 'secret', env: prefix + '_SECRET' });
    const required = server.filter((v) => v.required);
    if (0 < required.length) {
        options.push({ name: 'server', vars: required.map((v) => ({ name: v.name, placeholder: '<' + v.name + '>' })) });
    }
    const entityMap = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.entity`) || {};
    const activeEntities = Object.values(entityMap).filter((e) => e.active !== false);
    const coll = (0, opShape_1.entityCollection)(model);
    const descs = (0, text_1.modelText)(model).entity_desc || {};
    return {
        target: targetName,
        template,
        name: model.name,
        Name: model.const.Name,
        package: (0, packageMeta_1.packageName)(model, targetName),
        layout,
        env: { prefix },
        auth: { active, in: where, name: (0, utility_2.resolveAuthName)(model), basic, secret },
        options,
        server,
        entities: activeEntities.map((e) => describeEntity(e, { ...names.symbols(e), plural: ident((0, utility_1.pluralize)(e.name)) }, {
            className: (0, opShape_1.entityClassName)(e, coll),
            text: [descs[e.name], e.short, e.desc].find((t) => 'string' === typeof t && '' !== t.trim()) || '',
        })),
        quick: quickChoices(activeEntities),
        ref: describeRef(model, target, active, secret, server),
    };
}
// The constructor's option rows come from main.kit.optspec, the schema
// make_options validates against: one row per key, in the schema's order,
// then `feature`, which is assembled per target. A key is left out where the
// model makes it inapplicable (no auth, no Basic secret, no templated server
// URL) or where what it does differs between runtimes and no runtime fact
// says which (OPTION_UNSTATED). Rows follow this table's order, then any other
// schema key, sorted; text for a key the schema lacks is never read.
const OPTION_TEXT = {
    apikey: 'API key for authentication.',
    secret: 'Password for HTTP Basic authentication; `apikey` is the user name.',
    auth: 'Settings for how the credential is sent.',
    base: 'Base URL for API requests.',
    prefix: 'URL prefix appended after base.',
    suffix: 'URL suffix appended after path.',
    headers: 'Custom headers for all requests.',
    allow: 'Comma-separated allow-lists of the HTTP methods and the operations the client may use.',
    feature: 'Feature configuration.',
    system: 'System overrides (e.g. custom fetch).',
    clean: 'Redaction of everything the SDK emits.',
    server: 'Values for the variables the server URL is templated on.',
};
exports.OPTION_TEXT = OPTION_TEXT;
const OPTION_UNSTATED = {
    entity: 'per-entity overrides: which runtimes read them is not established',
    extend: 'feature instances: rust, c and ocaml do not read the option, and zig takes them as an argument of new_with',
    utility: 'utility replacements: rust, c, zig, ocaml and cpp hold options in a closed value union that cannot carry one',
    test: 'test-mode settings beside feature.test: which runtimes read them is not established',
};
exports.OPTION_UNSTATED = OPTION_UNSTATED;
function describeRef(model, target, active, secret, server) {
    const spec = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.optspec`, { required: false, only_active: false }) || {};
    const kind = (v) => null != v && 'object' === typeof v ? 'OBJECT' : ('string' === typeof v && !v.includes('$ANY') ? 'STRING' : 'ANY');
    const applies = { apikey: active, auth: active, secret, server: 0 < server.length };
    const rows = [];
    const keys = [...Object.keys(spec), 'feature'];
    const order = Object.keys(OPTION_TEXT);
    const rank = (k) => order.includes(k) ? order.indexOf(k) : order.length;
    for (const key of keys.filter((k, i) => i === keys.indexOf(k)).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))) {
        if (key in OPTION_UNSTATED || false === applies[key])
            continue;
        rows.push({ path: [key], type: 'feature' === key ? 'OBJECT' : kind(spec[key]), text: OPTION_TEXT[key] || '' });
        if ('server' === key) {
            for (const v of server) {
                rows.push({
                    path: ['server', v.name], type: 'STRING',
                    text: v.required ? 'Required.' : 'Defaults to `' + v.dflt + '`.',
                });
            }
        }
    }
    const feats = (0, applicability_1.targetFeatures)(model, target);
    return {
        title: target.title || target.name,
        test: null != feats.test && false !== feats.test.active,
        optionRows: rows,
        features: (0, FeatureDocs_1.featureDocs)(model, target).map((f) => ({
            name: f.name, title: f.title, version: String((feats[f.name] || {}).version || ''),
        })),
    };
}
function referenced(model, name) {
    const url = model?.main?.[apidef_1.KIT]?.info?.servers?.[0]?.url || '';
    return url.includes('{' + name + '}');
}
function describeEntity(e, sym, named) {
    const id = (0, opShape_1.entityIdField)(e);
    const ops = (0, opShape_1.entityOps)(e).filter((o) => opShape_1.CANON_OP_ORDER.includes(o));
    // An op reached only through `$action` still has its method: the reference
    // shows its signature, and its routes under Actions.
    const methods = opShape_1.CANON_OP_ORDER.filter((o) => null != e.op?.[o] && false !== e.op[o].active);
    const fields = Object.values(e.fields || {}).filter((f) => null != f && null != f.n);
    return {
        name: e.name,
        Name: (0, apidef_1.nom)(e, 'Name'),
        className: named.className,
        sym,
        text: named.text,
        ops,
        id,
        dataId: (0, opShape_1.entityDataIdField)(e),
        parents: isNested(e) ? (0, opExample_1.requiredItems)(e, 'load').filter((it) => it.name !== id).map((it) => it.name) : [],
        fields: fields.map((f) => ({
            name: f.n,
            type: f.t,
            required: !!f.r,
            text: 'string' === typeof f.sh ? f.sh : '',
            ops: methods.filter((o) => null != f.op?.[o] && false !== f.op[o].active),
        })),
        fieldOps: fields.some((f) => null != f.op && 0 < Object.keys(f.op).length),
        refOps: methods.map((o) => describeOp(e, o, id)),
        actions: (0, opShape_1.entityActions)(e).filter((a) => methods.includes(a.op))
            .map((a) => ({ ...a, params: actionParams(e, a, id) })),
        show: showFields(fields, (0, opShape_1.entityDataIdField)(e)),
    };
}
// The reference's example members for one operation: what a call must give,
// each a typed placeholder (the id as `<entity>_id`, a create's data as
// `example_<field>`).
function describeOp(e, op, idF) {
    const idFirst = (a, b) => (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1);
    const ph = (it, other) => typed(it, it.name === idF ? e.name + '_id' : other);
    let args = [];
    if ('load' === op || 'remove' === op) {
        args = (0, opExample_1.matchExampleItems)(e, op, idF).sort(idFirst).map((it) => ph(it, it.name));
    }
    else if ('list' === op) {
        args = (0, opExample_1.requiredItems)(e, 'list').map((it) => typed(it, 'example'));
    }
    else if ('create' === op) {
        args = (0, opExample_1.requestExampleItems)(e, 'create').filter((it) => !it.optional)
            .map((it) => typed(it, 'example_' + it.name));
    }
    else {
        args = (0, opExample_1.requestExampleItems)(e, op).filter((it) => !it.optional || it.name === idF)
            .sort(idFirst).map((it) => ph(it, it.name));
    }
    return {
        name: op,
        action: (0, opShape_1.opNeedsAction)(e.op[op]),
        args,
        needs: 'list' === op ? (0, opExample_1.requiredItems)(e, 'list').map((it) => it.name) : [],
        idInData: ('update' === op || 'patch' === op) && (0, opExample_1.sendsId)(e, op, idF) ? idF : null,
        body: 'create' === op || 'update' === op || 'patch' === op ? (0, media_1.bodyFacts)(e.op[op]) : null,
    };
}
// The path parameters of an action's route, in route order, typed from the
// point that declares them.
function actionParams(e, a, idF) {
    const points = Object.values(e.op?.[a.op]?.points || {});
    const pt = points.find((p) => null != p && p.q?.['$action'] === a.action && String(p.o || '') === a.path);
    const declared = Object.values(pt?.g?.params || {}).filter((x) => null != x && null != x.n);
    return [...a.path.matchAll(/\{([^}]+)\}/g)].map((m) => {
        const it = declared.find((x) => x.n === m[1] || x.or === m[1]) || { n: m[1], t: '`$STRING`' };
        return typed({ name: it.n, type: it.t }, it.n === idF || 'id' === it.n ? e.name + '_id' : it.n);
    });
}
function isNested(e) {
    return null != e.relations && null != e.relations.ancestors && 0 < e.relations.ancestors.length &&
        (0, opShape_1.entityOps)(e).includes('load') &&
        (0, opShape_1.opRequestShape)(e, 'load').items.some((it) => !it.optional && it.name !== (0, opShape_1.entityIdField)(e));
}
const typed = (it, placeholder) => ({ name: it.name, type: (0, canonType_1.canonScalarKey)(it.type), placeholder });
const idFirst = (idF) => (a, b) => (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1);
// The choices every quick start made, each made here once.
function quickChoices(activeEntities) {
    const ex = activeEntities[0];
    if (null == ex)
        return null;
    const ops = (0, opShape_1.entityOps)(ex);
    const idF = (0, opShape_1.entityIdField)(ex);
    const dataIdF = (0, opShape_1.entityDataIdField)(ex);
    const nested = activeEntities.find(isNested);
    let load = null;
    if (nested) {
        const neIdF = (0, opShape_1.entityIdField)(nested);
        const items = (0, opExample_1.requiredItems)(nested, 'load')
            .sort((a, b) => (a.name === neIdF ? 1 : 0) - (b.name === neIdF ? 1 : 0));
        const param = items.find((it) => it.name !== neIdF).name;
        load = {
            entity: nested.name,
            args: items.map((it) => typed(it, it.name === neIdF ? 'example_id' : 'example_' + it.name)),
            nested: { param, parent: param.replace(/_id$/, '') },
        };
    }
    else if (ops.includes('load')) {
        load = {
            entity: ex.name,
            args: (0, opExample_1.matchExampleItems)(ex, 'load', idF).sort(idFirst(idF))
                .map((it) => typed(it, it.name === idF ? 'example_id' : 'example_' + it.name)),
            nested: null,
        };
    }
    // Chain on the created id only where its type is KNOWN to match the match
    // key's, so the literal example type-checks by construction.
    const fields = Object.values(ex.fields || {});
    const dataIdField = dataIdF ? fields.find((f) => f && f.n === dataIdF) : null;
    const dataIdType = dataIdField ? (dataIdField.t ?? dataIdField.type) : null;
    const chains = (opname) => {
        if (null == dataIdF || !ops.includes('create'))
            return false;
        const item = (0, opShape_1.opRequestShape)(ex, opname).items.find((it) => it.name === idF);
        const matchType = item ? item.type : null;
        return null != matchType && null != dataIdType && matchType === dataIdType;
    };
    const idArg = (opname) => chains(opname)
        ? { name: idF, fromCreated: dataIdF }
        : typed((0, opShape_1.opRequestShape)(ex, opname).items.find((it) => it.name === idF) || { name: idF }, 'example_id');
    const bodyFields = (opname) => {
        const items = (0, opExample_1.requestExampleItems)(ex, opname)
            .filter((it) => (it.name !== idF && it.name !== 'id') || ('create' === opname && !it.optional));
        const req = items.filter((it) => !it.optional);
        const opt = items.filter((it) => it.optional);
        const chosen = 'create' === opname
            ? (req.length ? req : items.slice(0, 2))
            : req.concat(opt).slice(0, Math.max(2, req.length));
        return chosen.map((it) => typed(it, 'example_' + it.name));
    };
    const write = (opname) => !ops.includes(opname) ? null :
        ((0, opExample_1.sendsId)(ex, opname, idF) ? [idArg(opname)] : []).concat(bodyFields(opname));
    return {
        entity: ex.name,
        list: ops.includes('list') ? (0, opExample_1.requiredItems)(ex, 'list').map((it) => typed(it, 'example')) : null,
        load,
        create: ops.includes('create') ? bodyFields('create') : null,
        update: write('update'),
        patch: write('patch'),
        remove: !ops.includes('remove') ? null : (0, opExample_1.matchExampleItems)(ex, 'remove', idF).sort(idFirst(idF))
            .map((it) => it.name === idF ? idArg('remove') : typed(it, 'example_' + it.name)),
        chainsId: ['update', 'patch', 'remove'].some((o) => ops.includes(o) && (0, opExample_1.sendsId)(ex, o, idF) && chains(o)),
    };
}
// The record id, then the first other string field, else the first other
// integer, number or boolean field; with no scalar, the id alone (a map or a
// list printed whole is no display field: perl prints `HASH(0x...)`).
function showFields(fields, dataIdF) {
    const other = fields.filter((f) => f && f.n !== 'id' && f.n !== dataIdF);
    const display = ['STRING', 'INTEGER', 'NUMBER', 'BOOLEAN']
        .map((k) => other.find((f) => k === (0, canonType_1.canonScalarKey)(f.t))).find((f) => null != f);
    return [dataIdF, display ? display.n : null].filter((f) => null != f);
}
//# sourceMappingURL=sdkdesc.js.map