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
        case 'module': return ent.sym.module ?? ent.Name;
    }
}
const lit = (r, v) => code((r.facts.lits || { true: 'true', false: 'false' })[v ? 'true' : 'false']);
// How prose names a fixed member: its name from its signature, called.
function memberName(r, k) {
    const m = [...r.facts.client, ...r.facts.entity].find((x) => x.kind === k);
    const named = null == m ? null : /([\w.]+(?:->\w+)?)\s*\(/.exec(m.sig);
    return null == named ? k : named[1] + '()';
}
// What a getter hands back: a copy where the runtime clones, which its member
// declares (Member.copy).
const COPY = 'Returns a copy of the current data.';
// The sentence each fixed member kind is described by.
function memberText(m, p, desc, ent) {
    const r = p.ref;
    const sig = (k) => memberName(r, k);
    const kind = m.kind;
    switch (kind) {
        case 'options': return 'Return a deep copy of the current SDK options.';
        case 'utility': return 'Return a copy of the SDK utility object.';
        case 'utilityBase': return 'Return the SDK utility object.';
        case 'tester': {
            const test = r.facts.test.find((x) => x.args) || r.facts.test[0];
            return `Alias for ${code(fill(test.call, desc).replace(/^.*?=\s*/, ''))}.`;
        }
        case 'data': return 'Get or set the entity data. When called with data, sets the entity\'s\n' +
            'internal data and returns the current data. When called without\narguments, returns ' +
            (m.copy ? 'a copy of the current data.' : 'the current data.');
        case 'match': return `Get or set the entity match criteria. Works the same as ${code(sig('data'))}.`;
        case 'dataArg': return wrap(`Get the entity data.${m.copy ? ' ' + COPY : ''} Pass ${r.facts.setArg || 'a map'} to set it.`);
        case 'matchArg': return `Get the entity match criteria. Pass ${r.facts.setArg || 'a map'} to set it.`;
        case 'dataGet': return 'Get the entity data.' + (m.copy ? ' ' + COPY : '');
        case 'dataSet': return 'Set the entity data.';
        case 'matchGet': return 'Get the entity match criteria.';
        case 'matchSet': return 'Set the entity match criteria.';
        case 'make': return `Create a new ${code(ent ? typeOf(r, ent) : '')} instance with the same client and\noptions.`;
        case 'name': return 'Return the entity name.';
        case 'client': return `Return the parent ${code(desc.layout.client)} instance.`;
        case 'entopts': return 'Return a copy of the entity options.';
        case 'stream': return 'Run an operation through the pipeline and stream its result items.';
        case 'streamIterator': return 'Run an operation through the pipeline and yield its result items as\nthey arrive, as an async iterator.';
        case 'streamGenerator': return 'Run an operation through the pipeline and yield its result items as\nthey arrive, as a generator.';
        case 'streamLazy': return 'Run an operation through the pipeline and return a lazy stream of its\nresult items.';
        case 'streamSync': return 'Run an operation through the pipeline and return an iterator over its\nresult items.';
        case 'streamFunction': return 'Run an operation through the pipeline and return a function that\n' +
            `returns its next result item on each call, and ${code(r.facts.none)} once the items end.`;
        case 'streamList': return 'Run an operation through the pipeline and return its result items as\none list. ' + (0, runtimeprose_1.failsSentence)(p.facts);
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
    const explain = { k: 'map', entries: [{ key: 'explain', value: { k: 'lit', type: 'BOOLEAN', text: '' } }] };
    const rows = [
        { path: ['path'], type: 'STRING', text: 'URL path with optional `{param}` placeholders.' },
        { path: ['method'], type: 'STRING', text: 'HTTP method (default: `GET`).' },
        { path: ['params'], type: 'OBJECT', text: 'Path parameter values for `{param}` substitution.' },
        { path: ['query'], type: 'OBJECT', text: 'Query string parameters.' },
        { path: ['headers'], type: 'OBJECT', text: 'Request headers (merged with defaults).' },
        { path: ['body'], type: 'ANY', text: `Request body (${r.facts.maps} are JSON-serialized).` },
        { path: ['ctrl'], type: 'OBJECT', text: `Control options (e.g. ${code(p.expr(explain, (0, example_1.newScope)(true), desc))}).` },
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
                `Aborts the request in flight: \`ok\` is then ${lit(r, false)} and \`err.code\` is \`request_aborted\`. |\n`;
        }
        out += '\n' + wrap(`**Returns:** ${code(fill(r.facts.direct.returns, desc))}, a result map holding \`ok\`, ` +
            '`status`, `headers` and `data`, even for a non-2xx response; on a failure `ok` is ' +
            `${lit(r, false)} and \`err\` holds the error. A failed request is reported in the result, ` +
            `not as an error, so branch on ${code(r.read('result', 'ok'))}.`) + '\n\n';
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
// feature; without it, the client it returns has no mock transport.
function testText(p, desc) {
    const r = p.ref;
    if (0 === r.facts.test.length)
        return '';
    let out = '\n### Test client\n\n';
    const mock = desc.ref.test ? 'with mock features active' :
        'in test mode. This SDK is generated without the `test` feature, so it has no mock transport';
    for (const t of r.facts.test) {
        out += `#### ${code(fill(t.sig, desc))}\n\n` + wrap((t.args
            ? `Create a test client ${mock}. \`testopts\` are the test feature's options ` +
                `and \`sdkopts\` further client options, merged over the test defaults; both may be ${code(r.facts.none)}.`
            : `Create a test client ${mock}, and no options.`) +
            `${altText(t.alts || [], desc)} It returns a client in test mode.`) + `\n\n${fenced(p, [fill(t.call, desc)])}\n`;
    }
    return out + (0, example_1.note)(p, 'test', desc);
}
function instanceText(p, desc) {
    const r = p.ref;
    let out = `\n### Instance ${r.facts.noun}\n\n` + (0, example_1.note)(p, 'instance', desc);
    for (const ent of desc.entities) {
        out += `#### ${code(fill(r.facts.accessor.sig, desc, ent))}\n\n` +
            `Create a new ${code(typeOf(r, ent))} instance. Pass ${code(r.facts.none)} for no initial\n` +
            ('data' === r.facts.accessor.arg ? 'data.' : 'options.') + '\n\n';
    }
    // tester() aliases the test constructor, so it is documented with it.
    for (const m of r.facts.client)
        if ('tester' !== m.kind || desc.ref.test)
            out += clientMember(m, p, desc);
    if (r.facts.cancel) {
        out += `#### Cancelling a call

Every entity operation takes an optional \`ctrl\` object after its match or
data, and an \`AbortSignal\` in \`ctrl.signal\` cancels the request in flight.
The operation then rejects with an error whose \`code\` is
\`request_aborted\` and whose \`cause\` is the signal's reason. A request
whose signal has already aborted is not sent. \`stream()\` takes the signal
as \`callopts.signal\`, and ends when it aborts.

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
${ent.actions.map((a) => `| ${code(a.action)} | ${code(p.facts.method[a.op])} | ${code(a.path)} | ${code(actionCall(p, desc, ent, a))} |`).join('\n')}

An action returns that action's OWN response, which is not necessarily a
${ent.Name} record — check the API definition for its shape.

`;
    }
    if (0 < ent.refOps.length) {
        out += '### Operations\n\n' + (0, example_1.note)(p, 'operations', desc);
        for (const op of ent.refOps) {
            const name = op.name;
            const sig = (0 < op.needs.length && r.facts.opMatched && r.facts.opMatched[name]) || r.facts.op[name];
            const block = (0, example_1.refOpBlock)(desc, p.facts, ent, op);
            out += `#### ${code(fill(sig, desc, ent))}\n\n` +
                `${wrap((0, runtimeprose_1.opText)(p.facts, op.name, op.needs, op.idInData, boundOf(block)))}\n\n`;
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
// How one custom action is called, on one line: the call statement as the
// language writes it outside error handling. Not a block: its payload is the
// action's own, which no model states, so it could be neither type-checked
// nor run.
function actionCall(p, desc, ent, a) {
    const [stmt] = (0, example_1.actionBlock)(desc, ent, a);
    const narrow = { ...stmt, wide: false, note: undefined };
    return p.call(narrow, desc, (0, example_1.newScope)(true), { inAttempt: false, last: true })[0].split('\n')[0];
}
// The variable an operation's example binds its result to.
function boundOf(block) {
    const first = (block || [])[0];
    return null != first && 'call' === first.k && null != first.bind ? first.bind.name : 'result';
}
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
    for (const word of text.split(' ')) {
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