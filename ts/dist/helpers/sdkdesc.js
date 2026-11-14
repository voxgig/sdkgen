"use strict";
// The resolved description of one target's SDK: every fact the documentation
// states, computed once from the model. Plain data, JSON-serialisable, so a
// syntax provider can print from it without reading the model.
Object.defineProperty(exports, "__esModule", { value: true });
exports.sdkDescription = sdkDescription;
const apidef_1 = require("@voxgig/apidef");
const canonType_1 = require("./canonType");
const opShape_1 = require("./opShape");
const opExample_1 = require("./opExample");
const packageMeta_1 = require("./packageMeta");
const serverVars_1 = require("./serverVars");
const optional_1 = require("./optional");
const utility_1 = require("../utility");
const memo = new WeakMap();
function sdkDescription(ctx$, target) {
    const model = ctx$.model;
    const targetName = target.name;
    let byTarget = memo.get(model);
    if (null == byTarget) {
        byTarget = {};
        memo.set(model, byTarget);
    }
    if (null == byTarget[targetName]) {
        const hook = (0, optional_1.optionalComponent)(ctx$, target, 'Naming');
        const naming = hook ? hook.Naming : genericNaming;
        byTarget[targetName] = JSON.parse(JSON.stringify(describe(model, target, naming)));
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
        entities: activeEntities.map((e) => describeEntity(e, names.symbols(e))),
        quick: quickChoices(activeEntities),
    };
}
function referenced(model, name) {
    const url = model?.main?.[apidef_1.KIT]?.info?.servers?.[0]?.url || '';
    return url.includes('{' + name + '}');
}
function describeEntity(e, sym) {
    const id = (0, opShape_1.entityIdField)(e);
    return {
        name: e.name,
        Name: (0, apidef_1.nom)(e, 'Name'),
        sym,
        ops: (0, opShape_1.entityOps)(e).filter((o) => opShape_1.CANON_OP_ORDER.includes(o)),
        id,
        dataId: (0, opShape_1.entityDataIdField)(e),
        parents: isNested(e) ? (0, opExample_1.requiredItems)(e, 'load').filter((it) => it.name !== id).map((it) => it.name) : [],
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