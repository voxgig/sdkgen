"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeRef = void 0;
exports.refText = refText;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const utility_1 = require("../utility");
const optional_1 = require("../helpers/optional");
const ReadmeQuick_1 = require("./ReadmeQuick");
const ReadmeRefFeatures_1 = require("./ReadmeRefFeatures");
const markdown_1 = require("../helpers/markdown");
const media_1 = require("../helpers/media");
const example_1 = require("../helpers/example");
const runtimeprose_1 = require("../helpers/runtimeprose");
const sdkdesc_1 = require("../helpers/sdkdesc");
// REFERENCE.md. A target with a syntax provider that declares its reference
// facts gets the shared page; a target's own ReadmeRef_<lang> wins over it, as
// for the tutorial, and a target with neither writes nothing.
const ReadmeRef = (0, component_1.cmp)(function ReadmeRef(props) {
    const { target, ctx$ } = props;
    const t = target.name;
    const own = (0, utility_1.loadOptional)(ctx$, `./cmp/${t}/ReadmeRef_${t}`);
    const provider = null == own ? (0, optional_1.optionalComponent)(ctx$, target, 'Syntax') : undefined;
    if (provider && provider.Syntax.ref) {
        const desc = (0, ReadmeQuick_1.describeTarget)(ctx$, target);
        (0, jostraca_1.File)({ name: 'REFERENCE.md' }, () => {
            (0, jostraca_1.Content)(refText(provider.Syntax, desc));
            if (0 < desc.ref.features.length) {
                (0, ReadmeRefFeatures_1.ReadmeRefFeatures)({ target });
            }
        });
        return;
    }
    const ReadmeRef_sdk = own ?? (0, optional_1.optionalComponent)(ctx$, target, 'ReadmeRef');
    if (ReadmeRef_sdk) {
        // The per-language component owns the REFERENCE.md File, and calls the
        // shared feature reference from inside it.
        ReadmeRef_sdk['ReadmeRef']({ target });
    }
});
exports.ReadmeRef = ReadmeRef;
const code = (s) => '`' + s + '`';
// A declared signature with the description's names filled in. A name the
// templates spell (ProjectNameError) is substituted as generation substitutes
// the templates, from the same map.
function fill(sig, desc, ent) {
    const names = {
        sdk: desc.Name, client: desc.layout.client, ctor: desc.layout.ctor, module: desc.layout.module,
        accessor: ent ? ent.sym.accessor : '', var: ent ? ent.sym.var : '',
        Class: ent ? ent.className : '', Name: ent ? ent.Name : '',
    };
    return (0, sdkdesc_1.templateName)(desc.template || {}, sig)
        .replace(/\{(sdk|client|ctor|module|accessor|var|Class|Name)\}/g, (_m, k) => names[k]);
}
function fenced(p, lines) {
    return '```' + p.fence + '\n' + lines.join('\n') + '\n```\n';
}
// What an entity is called on the page: its class, its Name where the runtime
// has no class per entity, or the module its operations live in.
function typeOf(r, ent) {
    switch (r.facts.entityBy) {
        case 'class': return ent.className;
        case 'Name': return ent.Name;
        case 'module':
            if (null == ent.sym.module)
                throw new Error(`ReadmeRef: entityBy 'module' and no module named for ${ent.name}`);
            return ent.sym.module;
    }
}
// The value the direct result's `ok` holds on a failure, as the runtime writes it.
const okFalse = (r) => {
    const v = r.facts.direct.okFalse;
    if (null == v || '' === v)
        throw new Error('ReadmeRef: direct needs ref.facts.direct.okFalse');
    return code(v);
};
// How prose names a fixed member: its name from its signature, called.
function memberName(r, k) {
    const m = [...r.facts.client, ...r.facts.entity].find((x) => 'function' === typeof k ? k(x.kind) : x.kind === k);
    if (null == m)
        throw new Error(`ReadmeRef: no declared member of kind ${String(k)}`);
    // A form whose head is the call, `(ns/name args)`, is named by its head alone.
    const head = /^\((?:[^\s()/]+\/)?([^\s()/]+)[\s)]/.exec(m.sig);
    if (null != head)
        return head[1];
    const named = /([\w.]+(?:->\w+)?)\s*\(/.exec(m.sig);
    if (null == named)
        throw new Error(`ReadmeRef: the signature of ${m.kind} names no call: ${m.sig}`);
    return 'bare' === r.facts.memberNamed ? named[1] : named[1] + '()';
}
// How a map is passed to set an entity's data or match.
function setArg(r) {
    if (null == r.facts.setArg)
        throw new Error('ReadmeRef: dataArg and matchArg need ref.facts.setArg');
    return r.facts.setArg;
}
// When a stream's operation runs. No sentence says when the items are read:
// in java, kotlin, scala and perl the operation runs at the call and the
// streaming feature's items are drawn as the caller iterates.
const STREAM_RUNS = {
    iterate: 'The operation runs when iteration starts, not when the call returns.',
    call: 'The operation runs before the call returns.',
    background: 'The operation starts at the call and runs beside the caller, handing over each item as the caller takes it.',
};
// A stream kind's sentence: what it returns, then when it runs.
function streamText(what, m, r) {
    if (null == m.runs)
        throw new Error(`ReadmeRef: stream member ${m.sig} needs runs`);
    return wrap(`Run an operation through the pipeline and ${what} ${STREAM_RUNS[m.runs].replace(/\n/g, ' ')}` +
        (r.facts.streamSignal ? ' ' + STREAM_SIGNAL : ''));
}
// A stream that reads `callopts.signal` (ReadmeRef's streamSignal fact).
const STREAM_SIGNAL = 'It ends early once `callopts.signal` reports an abort.';
// What a getter hands back: a copy where the runtime clones, which its member
// declares (Member.copy).
const COPY = 'Returns a copy of the current data.';
const COPY_MATCH = 'Returns a copy of the current match criteria.';
// The sentence each fixed member kind is described by.
function memberText(m, p, desc, ent) {
    const r = p.ref;
    const sig = (k) => memberName(r, k);
    const kind = m.kind;
    switch (kind) {
        case 'options': return m.copy ? 'Return a deep copy of the current SDK options.' : 'Return the current SDK options.';
        case 'utility': return m.copy ? 'Return a copy of the SDK utility object.' : 'Return the SDK utility object.';
        case 'utilityBase': return 'Return the SDK utility object.';
        case 'tester': {
            const test = r.facts.test.find((x) => x.args) || r.facts.test[0];
            return `Alias for ${code(fill(test.call, desc).replace(/^.*?=\s*/, ''))}.`;
        }
        case 'data': return 'Get or set the entity data. When called with data, sets the entity\'s\n' +
            'internal data and returns the current data. When called without\narguments, returns ' +
            (m.copy ? 'a copy of the current data.' : 'the current data.');
        case 'match': return `Get or set the entity match criteria. Works the same as ${code(sig('data'))}.` +
            (m.copy ? ' ' + COPY_MATCH : '');
        case 'dataArg': return wrap(`Get the entity data.${m.copy ? ' ' + COPY : ''} Pass ${setArg(r)} to set it.`);
        case 'matchArg': return wrap(`Get the entity match criteria.${m.copy ? ' ' + COPY_MATCH : ''} Pass ${setArg(r)} to set it.`);
        case 'dataGet': return 'Get the entity data.' + (m.copy ? ' ' + COPY : '');
        case 'dataSet': return 'Set the entity data.';
        case 'matchGet': return 'Get the entity match criteria.' + (m.copy ? ' ' + COPY_MATCH : '');
        case 'matchSet': return 'Set the entity match criteria.';
        case 'make': return 'class' === r.facts.entityBy
            ? `Create a new ${code(ent ? typeOf(r, ent) : '')} instance with the same client and\noptions.`
            : `Create another ${code(ent ? typeOf(r, ent) : '')} entity with the same client and\noptions.`;
        case 'name': return m.field ? 'The entity name.' : 'Return the entity name.';
        case 'client': return `Return the parent ${code(desc.layout.client)} instance.`;
        case 'entopts': return m.copy ? 'Return a copy of the entity options.' : 'Return the entity options.';
        case 'stream': return streamText('stream its result items.', m, r);
        case 'streamIterator': return streamText('yield its result items as an async iterator.', m, r);
        case 'streamGenerator': return streamText('yield its result items as a generator.', m, r);
        case 'streamLazy': return streamText('return a sequence of its result items.', m, r);
        case 'streamSync': return streamText('return an iterator over its result items.', m, r);
        case 'streamFunction': return streamText('return a function that returns its next result item on each ' +
            `call, and ${code(r.facts.none)} once the items end.`, m, r);
        case 'streamList': return streamText(`return its result items, every one already read. ${(0, runtimeprose_1.failsSentence)(p.facts)}`, m, r);
        case 'direct': return 'Make a direct HTTP request to any API endpoint.';
        case 'prepare': return `Prepare a fetch definition without sending the request. Accepts the\nsame parameters as ${code(sig('direct'))}.`;
    }
}
// A table of named values: options or fetchargs.
function keyTable(p, container, rows) {
    const r = p.ref;
    const bare = 'bare' === r.facts.keys;
    let out = bare
        ? `**Parameters (${code(container)} map keys):**\n\n| Key | Value type | Description |\n| --- | --- | --- |\n`
        : '**Parameters:**\n\n| Name | Type | Description |\n| --- | --- | --- |\n';
    if (!bare && 'options' === container) {
        out += `| ${code(r.key('options', []))} | ${code(r.facts.container)} | SDK configuration options. |\n`;
    }
    for (const row of rows) {
        out += `| ${code(r.key(container, row.path))} | ${code(r.facts.valueType[row.type])} | ${row.text} |\n`;
    }
    return out;
}
function directRows(p, desc) {
    const r = p.ref;
    const rows = [
        { path: ['path'], type: 'STRING', text: 'URL path with optional `{param}` placeholders.' },
        { path: ['method'], type: 'STRING', text: 'HTTP method (default: `GET`).' },
        { path: ['params'], type: 'OBJECT', text: 'Path parameter values for `{param}` substitution.' },
        { path: ['query'], type: 'OBJECT', text: 'Query string parameters.' },
        { path: ['headers'], type: 'OBJECT', text: 'Request headers (merged with defaults).' },
        { path: ['body'], type: 'ANY', text: `Request body (${r.facts.maps} are JSON-serialized).` },
        // No example: an operation's `explain` is a map the pipeline fills, and
        // direct() records nothing in it.
        { path: ['ctrl'], type: 'OBJECT', text: 'Control options.' },
    ];
    return rows;
}
function clientMember(m, p, desc) {
    const r = p.ref;
    const f = p.facts;
    let out = `#### ${code(fill(m.sig, desc))}\n\n${memberText(m, p, desc)}\n\n`;
    if ('direct' === m.kind) {
        out += keyTable(p, 'fetchargs', directRows(p, desc));
        if (r.facts.direct.signal) {
            out += `| ${code(r.key('fetchargs', ['ctrl', 'signal']))} | ${code(r.facts.direct.signal)} | ` +
                `Aborts the request in flight: \`ok\` is then ${okFalse(r)} and \`err.code\` is ${code(abortCode(r))}. |\n`;
        }
        // A key as this language reads it: `err` is a key of the result, not the
        // error a signature may also return.
        out += '\n' + wrap(`**Returns:** ${code(fill(r.facts.direct.returns, desc))}, a result map. For a ` +
            'response, 2xx or not, it holds the keys `ok`, `status`, `headers` and `data`, and `ok` is ' +
            `${okFalse(r)} unless the status is 2xx. When the body cannot be read, \`ok\` is ${okFalse(r)} and ` +
            `the key \`err\` holds the error; a request that cannot be made gives only \`ok\` (${okFalse(r)}) ` +
            `and \`err\`. A key is read as ${code(r.read('result', 'err'))}. A failure is reported in the ` +
            `result, not as an error, so branch on ${code(r.read('result', 'ok', true))}.`) + '\n\n';
    }
    else if ('prepare' === m.kind) {
        const fails = 'value' === r.facts.prepare.fails
            ? `On failure it ${f.async ? 'resolves to' : 'returns'} the error instead.`
            : ('style' === r.facts.prepare.fails ? (0, runtimeprose_1.failsSentence)(f) : '');
        out += wrap(`**Returns:** ${code(fill(r.facts.prepare.returns, desc))}, the fetch definition: ` +
            `the request ${code(memberName(r, 'direct'))} would send.${'' === fails ? '' : ' ' + fails}`) + '\n\n';
    }
    else if (null != m.returns) {
        out += `**Returns:** ${code(fill(m.returns, desc))}.\n\n`;
    }
    return out + (0, example_1.note)(p, `member:${m.kind}`, desc);
}
// The sentence each alternate constructor is described by.
function altText(alts, desc) {
    const one = (x) => `${code(fill(x.call, desc))} ` +
        ('defaults' === x.kind ? 'uses the defaults' : 'takes the options spelled out');
    if (0 === alts.length)
        return '';
    const parts = alts.map(one);
    return ' ' + (1 === parts.length ? parts[0] : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]) + '.';
}
function constructorText(p, desc) {
    const r = p.ref;
    const container = 'bare' === r.facts.keys
        ? ` ${code('options')} is a ${code(r.facts.container)} map\n(${code(r.facts.none)} for none).` : '';
    const alts = r.facts.ctorAlts || [];
    const sentence = `Create a new SDK client instance.${container}${altText(alts, desc)}`;
    return `### Constructor\n\n${fenced(p, r.facts.ctor.map((l) => fill(l, desc)))}\n` +
        `${0 === alts.length ? sentence : wrap(sentence.replace(/\n/g, ' '))}\n\n` +
        (0, example_1.note)(p, 'ctor', desc) + keyTable(p, 'options', desc.ref.optionRows) + '\n';
}
// The test constructor exists in every runtime, with or without the test
// feature. Without it, the client has the mock only where the runtime ships
// the test feature whatever the model says (testMock 'always'); elsewhere it
// is in test mode with no transport, so the fetcher refuses every request.
function testText(p, desc) {
    const r = p.ref;
    if (0 === r.facts.test.length)
        return '';
    if (null == r.facts.testMock)
        throw new Error('ReadmeRef: the test constructor needs ref.facts.testMock');
    let out = '\n### Test client\n\n';
    const mock = desc.ref.test || 'always' === r.facts.testMock
        ? 'Create a test client with mock features active.'
        : 'Create a test client. This SDK is generated without the `test` feature, so the client has no ' +
            'mock transport and refuses every request.';
    for (const t of r.facts.test) {
        out += `#### ${code(fill(t.sig, desc))}\n\n` + wrap(mock + ' ' +
            (t.args
                ? 'The first argument holds the test feature\'s options, which the call switches on, and replaces ' +
                    `any ${code(r.key('options', ['feature', 'test']))} in the second, which holds the other client ` +
                    `options; both may be ${code(r.facts.none)}.`
                : 'It takes no arguments.') +
            altText(t.alts || [], desc)) + `\n\n${fenced(p, [fill(t.call, desc)])}\n`;
    }
    return out + (0, example_1.note)(p, 'test', desc);
}
// What the accessor's argument is. Where the signature names it otherwise
// than what it is (rb's `data`, passed on as the entity options), the page
// says both, once.
function accessorText(r, type) {
    const { arg, param } = r.facts.accessor;
    const what = 'data' === arg ? 'data' : 'options';
    const name = 'data' === arg ? 'data' : 'entopts';
    // Where an entity is no instance of a class (named by its Name or its module).
    const kind = 'class' === r.facts.entityBy ? 'instance' : 'entity';
    if (r.facts.accessor.cached) {
        return wrap(`Called with ${code(r.facts.none)}, return the ${code(type)} ${kind} the client keeps, made by ` +
            `the first such call; called with entity ${what}, create a new one.` +
            (param === name ? '' : ` Its ${code(param)} argument holds the entity ${what}.`));
    }
    const made = `Create a new ${code(type)} ${kind}.`;
    return param === name
        ? `${made} Pass ${code(r.facts.none)} for no initial\n${what}.`
        : wrap(`${made} Its ${code(param)} argument holds the entity ${what}: pass ${code(r.facts.none)} for none.`);
}
function instanceText(p, desc) {
    const r = p.ref;
    let out = `\n### Client ${r.facts.noun}\n\n` + (0, example_1.note)(p, 'instance', desc);
    for (const ent of desc.entities) {
        out += `#### ${code(fill(r.facts.accessor.sig, desc, ent))}\n\n` +
            accessorText(r, typeOf(r, ent)) + '\n\n';
    }
    // The runtime has every declared member whether or not the test feature
    // ships: tester() is an alias of the test constructor, documented above.
    for (const m of r.facts.client)
        out += clientMember(m, p, desc);
    if (r.facts.cancel) {
        out += `#### Cancelling a call

Every entity operation takes an optional \`ctrl\` object after its match or
data, and ${a(code(cancelSignal(r)))} in \`ctrl.signal\` cancels the request in flight.
The operation then rejects with an error whose \`code\` is
${code(abortCode(r))} and whose \`cause\` is the signal's reason. A request
whose signal has already aborted is not sent.

`;
    }
    return out;
}
function entityText(p, desc, ent) {
    const r = p.ref;
    const ref = (0, example_1.entOf)(desc, ent.name);
    let out = `\n---\n\n## ${typeOf(r, ent)}\n\n`;
    const text = (0, markdown_1.mdInline)(ent.text);
    if ('' !== text)
        out += text + '\n\n';
    out += fenced(p, r.instance(ref, desc)) + '\n' + (0, example_1.note)(p, 'entity', desc);
    if (0 < ent.fields.length) {
        out += '### Fields\n\n| Field | Type | Required | Description |\n| --- | --- | --- | --- |\n';
        for (const f of ent.fields) {
            out += `| ${code(f.name)} | ${code(r.type(f.type))} | ${f.required ? 'Yes' : 'No'} | ${(0, markdown_1.mdCell)(f.text)} |\n`;
        }
        out += '\n';
        if (ent.fieldOps) {
            const cols = ent.refOps.map((o) => o.name);
            out += `### Field Usage by Operation\n\n| Field | ${cols.join(' | ')} |\n| --- | ${cols.map(() => '---').join(' | ')} |\n`;
            for (const f of ent.fields) {
                out += `| ${code(f.name)} | ${cols.map((c) => f.ops.includes(c) ? 'Yes' : '-').join(' | ')} |\n`;
            }
            out += '\n';
        }
    }
    if (0 < ent.actions.length) {
        out += `### Actions

This entity exposes custom API actions in addition to the standard
operations. Select one with \`$action\` in the call's argument, beside the
route's path parameters, as the Call column shows; the action's own
arguments go beside them too, and are sent as that action's payload.

| Action | Operation | Route | Call |
| --- | --- | --- | --- |
${ent.actions.map((a) => `| ${code(a.action)} | ${code(p.facts.method[a.op])} | ${code(a.path)} | ${code(actionCall(p, desc, ent, a)).replace(/\|/g, '\\|')} |`).join('\n')}

Like any operation, an action's call gives back the entity; its data is
then that action's OWN response, which is not necessarily a ${ent.Name}
record — check the API definition for its shape.

`;
    }
    if (0 < ent.refOps.length) {
        out += '### Operations\n\n' + (0, example_1.note)(p, 'operations', desc);
        for (const op of ent.refOps) {
            const name = op.name;
            const sig = (0 < op.needs.length && r.facts.opMatched && r.facts.opMatched[name]) || r.facts.op[name];
            const block = (0, example_1.refOpBlock)(desc, p.facts, ent, op);
            out += `#### ${code(fill(sig, desc, ent))}\n\n` +
                `${wrap((0, runtimeprose_1.opText)(p.facts, op.name, op.needs, op.idInData, boundOf(block, desc), { none: r.facts.none, deleted: r.facts.deleted }))}\n\n`;
            if (null != block)
                out += (0, example_1.printBlock)(p, block, desc, (0, example_1.newScope)(true)) + '\n';
            out += (0, media_1.bodyNoteText)(op.body, r.facts.body);
        }
    }
    out += `### Common ${r.facts.entityNoun || r.facts.noun}\n\n` + (0, example_1.note)(p, 'members', desc);
    for (const m of r.facts.entity) {
        out += `#### ${code(fill(m.sig, desc, ent))}\n\n${memberText(m, p, desc, ent)}\n\n` +
            (0, example_1.note)(p, `member:${m.kind}`, desc);
    }
    return out;
}
// How one custom action is called, on one line: the statements of the call,
// with what the language declares ahead of it and the check it needs, joined.
// Not a block: its payload is the action's own, which no model states, so it
// could be neither type-checked nor run.
function actionCall(p, desc, ent, a) {
    const [stmt] = (0, example_1.actionBlock)(desc, ent, a);
    const narrow = { ...stmt, wide: false, note: undefined };
    const sc = (0, example_1.newScope)(true);
    sc.local = new Set();
    sc.stmts = [narrow];
    const lines = [...(p.before ? p.before([narrow], desc, sc) : []),
        ...p.call(narrow, desc, sc, { inAttempt: false, last: true })];
    const parts = lines.flatMap((l) => l.split('\n')).map((l) => l.trim()).filter((l) => '' !== l);
    // A statement that does not end itself is ended with `;`, except where `;`
    // opens a comment (a Lisp).
    const semi = !p.comment('').trim().startsWith(';');
    return parts.reduce((out, cur) => '' === out ? cur
        : out + (semi && !/[;{(\[,]$/.test(out) && !/^[})\].]/.test(cur) ? '; ' : ' ') + cur, '');
}
// The variable an operation's example binds its result to; for an operation
// with no example, the name the reference's examples give a result.
function boundOf(block, desc) {
    const first = (block || [])[0];
    if (null != first && 'call' === first.k && null != first.bind)
        return first.bind.name;
    const result = (desc.layout.vars || {}).result;
    if (null == result)
        throw new Error('ReadmeRef: no example name for a result');
    return result;
}
// The type of the signal that cancels a call: the one direct() takes.
function cancelSignal(r) {
    if (null == r.facts.direct.signal)
        throw new Error('ReadmeRef: cancel needs direct.signal, the signal type');
    return r.facts.direct.signal;
}
// The code of the error an abort leaves, declared with the signal.
function abortCode(r) {
    if (null == r.facts.direct.abortCode)
        throw new Error('ReadmeRef: direct.signal needs direct.abortCode');
    return r.facts.direct.abortCode;
}
const a = (s) => (/^`?[aeiou]/i.test(s) ? 'an ' : 'a ') + s;
function featuresText(p, desc) {
    const features = desc.ref.features;
    if (0 === features.length)
        return '';
    return `
---

## Features

| Feature | Version | Description |
| --- | --- | --- |
${features.map((f) => `| ${code(f.name)} | ${f.version} | ${(0, markdown_1.mdCell)(f.title)} |`).join('\n')}


Features are activated via the \`feature\` option:

${(0, example_1.printBlock)(p, (0, example_1.featureBlock)(features.map((f) => f.name)), desc, (0, example_1.newScope)(true))}
${(0, example_1.note)(p, 'features', desc)}`;
}
// Prose is wrapped at 72 columns, as the hand-written pages are.
function wrap(text) {
    const out = [];
    let line = '';
    for (const word of (0, markdown_1.spans)(text)) {
        if ('' !== line && 72 < (line + ' ' + word).length) {
            out.push(line);
            line = word;
        }
        else {
            line = '' === line ? word : line + ' ' + word;
        }
    }
    if ('' !== line)
        out.push(line);
    return out.join('\n');
}
function refText(p, desc) {
    let out = `# ${desc.Name} ${desc.ref.title} SDK Reference

Complete API reference for the ${desc.Name} ${desc.ref.title} SDK.


## ${null == p.ref?.facts.heading ? desc.layout.client : fill(p.ref.facts.heading, desc)}

`;
    out += constructorText(p, desc);
    out += testText(p, desc);
    out += instanceText(p, desc);
    for (const ent of desc.entities)
        out += entityText(p, desc, ent);
    out += featuresText(p, desc);
    return out;
}
//# sourceMappingURL=ReadmeRef.js.map