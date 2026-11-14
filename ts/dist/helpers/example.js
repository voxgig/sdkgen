"use strict";
// A language-neutral representation of an example program, the builders the
// shared documentation components call, and the interface a target's syntax
// provider implements to print it. Nothing here reads the model: examples are
// built from an SdkDescription.
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientBlock = clientBlock;
exports.indent = indent;
exports.listBlock = listBlock;
exports.newScope = newScope;
exports.loadBlock = loadBlock;
exports.printBlock = printBlock;
exports.printStmts = printStmts;
exports.uses = uses;
exports.writeBlock = writeBlock;
exports.writeOps = writeOps;
// A null arg on a call: the call takes no match. A create always takes data.
// ---- the builders
function entOf(desc, name) {
    const e = desc.entities.find((x) => x.name === name);
    return { name, Name: e ? e.Name : name };
}
function argEntries(args, of) {
    return args.map((a) => ({
        key: a.name,
        value: null != a.fromCreated && null != of
            ? { k: 'field', of, field: a.fromCreated }
            : { k: 'lit', type: a.type, text: a.placeholder },
    }));
}
function optionEntries(options) {
    return options.map((o) => 'server' === o.name
        ? { key: 'server', value: { k: 'map', entries: o.vars.map((v) => ({ key: v.name, value: { k: 'str', text: v.placeholder } })) } }
        : { key: o.name, value: { k: 'env', name: o.env } });
}
function clientBlock(desc) {
    return [{ k: 'client', options: optionEntries(desc.options) }];
}
function listBlock(desc) {
    const q = desc.quick;
    if (null == q || null == q.list)
        return null;
    const entity = entOf(desc, q.entity);
    const many = { role: 'many', entity };
    const item = { role: 'item', entity };
    return [{
            k: 'attempt', what: 'list', body: [
                { k: 'call', entity, op: 'list', arg: 0 < q.list.length ? argEntries(q.list, null) : null, bind: many },
                { k: 'each', item, of: many, body: [{ k: 'print', what: { k: 'record', of: item } }] },
            ],
        }];
}
function loadBlock(desc) {
    const q = desc.quick;
    if (null == q || null == q.load)
        return null;
    const entity = entOf(desc, q.load.entity);
    const one = { role: 'one', entity };
    return [{
            k: 'attempt', what: 'load', body: [
                { k: 'call', entity, op: 'load', arg: 0 < q.load.args.length ? argEntries(q.load.args, null) : null, bind: one },
                { k: 'print', what: { k: 'record', of: one } },
            ],
        }];
}
const WRITE_OPS = ['create', 'update', 'patch', 'remove'];
function writeOps(desc) {
    const q = desc.quick;
    return null == q ? [] : WRITE_OPS.filter((o) => null != q[o]);
}
function writeBlock(desc) {
    const q = desc.quick;
    const ops = writeOps(desc);
    if (0 === ops.length)
        return null;
    const entity = entOf(desc, q.entity);
    const created = { role: 'created', entity };
    const out = [];
    for (const op of ops) {
        if (0 < out.length)
            out.push({ k: 'gap' });
        const chained = q[op].some((a) => null != a.fromCreated);
        out.push({ k: 'comment', text: WRITE_COMMENT[op](chained) });
        out.push({
            k: 'call', entity, op,
            arg: 'create' === op || 0 < q[op].length ? argEntries(q[op], created) : null,
            bind: 'create' === op ? created : null,
        });
    }
    return out;
}
const WRITE_COMMENT = {
    create: () => 'Create — returns the created entity',
    update: (chained) => 'Update' + (chained ? ' — the id comes off the created entity\'s record' : ''),
    patch: (chained) => 'Patch — sends only the fields given' +
        (chained ? '; the id comes off the created entity\'s record' : ''),
    remove: () => 'Remove',
};
function uses(stmts) {
    const found = { env: false, field: false, entities: [] };
    const expr = (e) => {
        if ('env' === e.k)
            found.env = true;
        if ('field' === e.k)
            found.field = true;
        if ('map' === e.k)
            e.entries.forEach((en) => expr(en.value));
    };
    const walk = (s) => {
        if ('client' === s.k)
            s.options.forEach((en) => expr(en.value));
        if ('call' === s.k) {
            if (!found.entities.includes(s.entity.name))
                found.entities.push(s.entity.name);
            (s.arg || []).forEach((en) => expr(en.value));
        }
        if ('print' === s.k)
            expr(s.what);
        if ('each' === s.k || 'attempt' === s.k)
            s.body.forEach(walk);
    };
    stmts.forEach(walk);
    return found;
}
function printStmts(p, stmts, desc, sc) {
    const inner = (body) => printStmts(p, body, desc, sc);
    const out = [];
    for (const s of stmts) {
        switch (s.k) {
            case 'client':
                out.push(...p.client(s, desc, sc));
                break;
            case 'call':
                out.push(...p.call(s, desc, sc));
                break;
            case 'each':
                out.push(...p.each(s, inner, sc));
                break;
            case 'print':
                out.push(...p.print(s, sc));
                break;
            case 'attempt':
                out.push(...p.attempt(s, inner, sc));
                break;
            case 'comment':
                out.push(p.comment(s.text));
                break;
            case 'gap':
                out.push('');
                break;
        }
    }
    return out;
}
// A whole code block: the fence, the provider's lines, the closing fence.
function printBlock(p, stmts, desc, sc) {
    sc.local = new Set();
    sc.stmts = stmts;
    const lines = [...(p.before ? p.before(stmts, desc, sc) : []), ...printStmts(p, stmts, desc, sc)];
    return '```' + p.fence + '\n' + lines.join('\n') + '\n```\n';
}
function newScope() {
    return { declared: new Set(), local: new Set(), stmts: [], section: [] };
}
function indent(lines, by) {
    return lines.map((l) => '' === l ? l : by + l);
}
//# sourceMappingURL=example.js.map