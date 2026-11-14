"use strict";
// The resolved description of one target's SDK: every fact the documentation
// states, computed once from the model. Plain data, JSON-serialisable, so a
// syntax provider can print from it without reading the model.
Object.defineProperty(exports, "__esModule", { value: true });
exports.sdkDescription = sdkDescription;
const apidef_1 = require("@voxgig/apidef");
const canonType_1 = require("./canonType");
const opShape_1 = require("./opShape");
const media_1 = require("./media");
const text_1 = require("./text");
const applicability_1 = require("./applicability");
const FeatureDocs_1 = require("../cmp/FeatureDocs");
const opExample_1 = require("./opExample");
const packageMeta_1 = require("./packageMeta");
const serverVars_1 = require("./serverVars");
const utility_1 = require("../utility");
const memo = new WeakMap();
// `naming` is the target's Naming hook, which the calling component finds.
function sdkDescription(model, target, naming) {
    const targetName = target.name;
    let byTarget = memo.get(model);
    if (null == byTarget) {
        byTarget = {};
        memo.set(model, byTarget);
    }
    if (null == byTarget[targetName]) {
        byTarget[targetName] = JSON.parse(JSON.stringify(describe(model, target, naming || genericNaming)));
    }
    return byTarget[targetName];
}
// For a target with no naming hook: the class-name stem, unchanged.
const genericNaming = (model) => ({
    layout: { module: model.name, client: model.const.Name + 'SDK', ctor: model.const.Name + 'SDK' },
    symbols: (e) => ({ accessor: (0, apidef_1.nom)(e, 'Name'), var: e.name, vars: e.name + 's' }),
});
function describe(model, target, naming) {
    const targetName = target.name;
    const names = naming(model, target);
    const prefix = (0, packageMeta_1.envName)(model);
    const active = (0, utility_1.isAuthActive)(model);
    const where = (0, utility_1.resolveAuthIn)(model);
    const basic = (0, utility_1.isHttpBasicAuth)(model);
    // The runtimes read `secret` only for Basic sent in the header (PrepareAuth).
    const secret = active && basic && 'header' === where && !(0, utility_1.isAuthSuppressed)(model);
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
        name: model.name,
        Name: model.const.Name,
        package: (0, packageMeta_1.packageName)(model, targetName),
        layout: names.layout,
        env: { prefix },
        auth: { active, in: where, name: (0, utility_1.resolveAuthName)(model), basic, secret },
        options,
        server,
        entities: activeEntities.map((e) => describeEntity(e, names.symbols(e), {
            className: (0, opShape_1.entityClassName)(e, coll),
            text: [descs[e.name], e.short, e.desc].find((t) => 'string' === typeof t && '' !== t.trim()) || '',
        })),
        quick: quickChoices(activeEntities),
        ref: describeRef(model, target, active, secret, server),
    };
}
// The constructor's option rows. Each must be a key of main.kit.optspec, the
// schema make_options validates against; `feature` is assembled per target.
const OPTION_TEXT = [
    ['apikey', 'API key for authentication.'],
    ['secret', 'API secret for authentication.'],
    ['base', 'Base URL for API requests.'],
    ['prefix', 'URL prefix appended after base.'],
    ['suffix', 'URL suffix appended after path.'],
    ['headers', 'Custom headers for all requests.'],
    ['feature', 'Feature configuration.'],
    ['system', 'System overrides (e.g. custom fetch).'],
];
function describeRef(model, target, active, secret, server) {
    const spec = (0, apidef_1.getModelPath)(model, `main.${apidef_1.KIT}.optspec`, { required: false, only_active: false }) || {};
    const kind = (v) => null != v && 'object' === typeof v ? 'OBJECT' : ('string' === typeof v && !v.includes('$ANY') ? 'STRING' : 'ANY');
    const rows = [];
    for (const [key, text] of OPTION_TEXT) {
        if ('apikey' === key && !active)
            continue;
        if ('secret' === key && !secret)
            continue;
        if ('feature' !== key && !(key in spec))
            continue;
        rows.push({ path: [key], type: 'feature' === key ? 'OBJECT' : kind(spec[key]), text });
    }
    if (0 < server.length && 'server' in spec) {
        rows.push({ path: ['server'], type: 'OBJECT', text: 'Values for the variables the server URL is templated on.' });
        for (const v of server) {
            rows.push({
                path: ['server', v.name], type: 'STRING',
                text: v.required ? 'Required.' : 'Defaults to `' + v.dflt + '`.',
            });
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
        actions: (0, opShape_1.entityActions)(e).filter((a) => methods.includes(a.op)),
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
        show: showFields(fields, dataIdF),
    };
}
// The record id, then the first other string field: what php, rb, lua and perl
// chose for themselves, chosen here once.
function showFields(fields, dataIdF) {
    const display = fields.find((f) => f && f.n !== 'id' && f.n !== dataIdF && '$STRING' === f.t);
    return [dataIdF, display ? display.n : null].filter((f) => null != f);
}
//# sourceMappingURL=sdkdesc.js.map