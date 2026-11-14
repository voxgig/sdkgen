"use strict";
// A language-neutral representation of an example program, the builders the
// shared documentation components call, and the interface a target's syntax
// provider implements to print it. Nothing here reads the model: examples are
// built from an SdkDescription and the provider's declared runtime facts.
Object.defineProperty(exports, "__esModule", { value: true });
exports.actionBlock = actionBlock;
exports.clientBlock = clientBlock;
exports.entOf = entOf;
exports.featureBlock = featureBlock;
exports.refOpBlock = refOpBlock;
exports.indent = indent;
exports.listBlock = listBlock;
exports.newScope = newScope;
exports.loadBlock = loadBlock;
exports.printBlock = printBlock;
exports.printJoined = printJoined;
exports.printProgram = printProgram;
exports.printStmts = printStmts;
exports.printSteps = printSteps;
exports.uses = uses;
exports.writeBlock = writeBlock;
exports.writeOps = writeOps;
const runtimeprose_1 = require("./runtimeprose");
// ---- the builders
function entOf(desc, name) {
    const e = desc.entities.find((x) => x.name === name);
    return e ? { name, Name: e.Name, sym: e.sym } : { name, Name: name, sym: { accessor: name, var: name, vars: name + 's' } };
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
const WRITE_OPS = ['create', 'update', 'patch', 'remove'];
function call(entity, op, arg, bind) {
    const wide = WRITE_OPS.includes(op) || ('load' === op && null != arg && 1 < arg.length);
    return { k: 'call', entity, op, arg, bind, wide };
}
// How an example shows an entity: the whole record, or the chosen fields where
// the runtime's examples print those.
function show(desc, facts, of) {
    const fields = desc.quick ? desc.quick.show : [];
    return 'fields' === facts.prints && 0 < fields.length ? { k: 'fields', of, fields } : { k: 'record', of };
}
function clientBlock(desc) {
    return [{ k: 'client', options: optionEntries(desc.options) }];
}
function listBlock(desc, facts) {
    const q = desc.quick;
    if (null == q || null == q.list)
        return null;
    const entity = entOf(desc, q.entity);
    const many = { role: 'many', entity };
    const item = { role: 'item', entity };
    return [{
            k: 'attempt', what: 'list', body: [
                call(entity, 'list', 0 < q.list.length ? argEntries(q.list, null) : null, many),
                { k: 'each', item, of: many, body: [{ k: 'print', what: show(desc, facts, item) }] },
            ],
        }];
}
function loadBlock(desc, facts) {
    const q = desc.quick;
    if (null == q || null == q.load)
        return null;
    const entity = entOf(desc, q.load.entity);
    const one = { role: 'one', entity };
    return [{
            k: 'attempt', what: 'load', body: [
                call(entity, 'load', 0 < q.load.args.length ? argEntries(q.load.args, null) : null, one),
                { k: 'print', what: show(desc, facts, one) },
            ],
        }];
}
function writeOps(desc) {
    const q = desc.quick;
    return null == q ? [] : WRITE_OPS.filter((o) => null != q[o]);
}
// Write results are not shown, by every language alike; the created entity is
// bound only where a later call reads its id.
function writeBlock(desc, facts) {
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
        out.push({ k: 'comment', text: 'create' === op ? (0, runtimeprose_1.createComment)(facts) : WRITE_COMMENT[op](chained) });
        out.push(call(entity, op, 'create' === op || 0 < q[op].length ? argEntries(q[op], created) : null, 'create' === op && q.chainsId ? created : null));
    }
    return out;
}
const WRITE_COMMENT = {
    update: (chained) => 'Update' + (chained ? ' — the id comes off the created entity\'s record' : ''),
    patch: (chained) => 'Patch — sends only the fields given' +
        (chained ? '; the id comes off the created entity\'s record' : ''),
    remove: () => 'Remove',
};
// The reference's example for one operation: a list or load consumed as the
// tutorial consumes it, a write called alone. None for an operation reached
// only through `$action`.
function refOpBlock(desc, facts, ent, op) {
    if (op.action)
        return null;
    const entity = entOf(desc, ent.name);
    const arg = 0 < op.args.length ? argEntries(op.args, null) : null;
    if ('list' === op.name) {
        const many = { role: 'many', entity };
        const item = { role: 'item', entity };
        return [{
                k: 'attempt', what: 'list', body: [
                    call(entity, 'list', arg, many),
                    { k: 'each', item, of: many, body: [{ k: 'print', what: { k: 'record', of: item } }] },
                ],
            }];
    }
    if ('load' === op.name) {
        const one = { role: 'one', entity };
        return [{
                k: 'attempt', what: 'load', body: [
                    call(entity, 'load', arg, one),
                    { k: 'print', what: { k: 'record', of: one } },
                ],
            }];
    }
    return [call(entity, op.name, 'remove' === op.name ? arg : (arg || []), null)];
}
// A call that selects a custom action.
function actionBlock(desc, ent, a) {
    return [call(entOf(desc, ent.name), a.op, [{ key: '$action', value: { k: 'str', text: a.action } }], null)];
}
// The client constructed with the named features switched on.
function featureBlock(names) {
    return [{
            k: 'client', options: [{
                    key: 'feature', value: {
                        k: 'map', entries: names.map((n) => ({
                            key: n, value: { k: 'map', entries: [{ key: 'active', value: { k: 'lit', type: 'BOOLEAN', text: '' } }] },
                        })),
                    },
                }],
        }];
}
function uses(stmts) {
    const found = { env: false, field: false, print: false, entities: [] };
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
        if ('print' === s.k) {
            found.print = true;
            expr(s.what);
        }
        if ('each' === s.k || 'attempt' === s.k)
            s.body.forEach(walk);
    };
    stmts.forEach(walk);
    return found;
}
function printStmts(p, stmts, desc, sc, inAttempt = false) {
    const out = [];
    stmts.forEach((s, i) => {
        const inner = (body) => printStmts(p, body, desc, sc, inAttempt || 'attempt' === s.k);
        switch (s.k) {
            case 'client':
                out.push(...p.client(s, desc, sc));
                break;
            case 'call':
                out.push(...p.call(s, desc, sc, { inAttempt, last: i === stmts.length - 1 }));
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
    });
    // A printer may return a multi-line string as one line; indenting needs lines.
    return out.flatMap((l) => l.split('\n'));
}
// A whole code block: the fence, the provider's lines, the closing fence.
function printBlock(p, stmts, desc, sc) {
    sc.local = new Set();
    sc.stmts = stmts;
    const lines = [...(p.before ? p.before(stmts, desc, sc) : []), ...printStmts(p, stmts, desc, sc)];
    return fenced(p, lines);
}
// Steps printed under one local scope, each with what it hoists ahead of it.
function printSteps(p, steps, desc, sc) {
    sc.local = new Set();
    sc.stmts = steps.flatMap((s) => s.stmts);
    return steps.map((s) => {
        // A step's leading comment names it, so it stays ahead of what is hoisted.
        const lead = 'comment' === s.stmts[0]?.k ? 1 : 0;
        return {
            title: s.title,
            lines: [
                ...printStmts(p, s.stmts.slice(0, lead), desc, sc),
                ...(p.before ? p.before(s.stmts, desc, sc) : []),
                ...printStmts(p, s.stmts.slice(lead), desc, sc),
            ],
        };
    });
}
// Steps printed into one program, by the provider's program printer.
function printProgram(p, steps, desc, sc) {
    return fenced(p, p.program(printSteps(p, steps, desc, sc), desc, sc));
}
// Steps printed into one block, a blank line between them.
function printJoined(p, steps, desc, sc) {
    return fenced(p, printSteps(p, steps, desc, sc).flatMap((s, i) => 0 === i ? s.lines : ['', ...s.lines]));
}
function fenced(p, lines) {
    return '```' + p.fence + '\n' + lines.join('\n') + '\n```\n';
}
function newScope() {
    return { declared: new Set(), local: new Set(), stmts: [], section: [] };
}
function indent(lines, by) {
    return lines.map((l) => '' === l ? l : by + l);
}
//# sourceMappingURL=example.js.map