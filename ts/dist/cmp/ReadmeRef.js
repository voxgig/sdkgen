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
// A declared signature with the description's names filled in.
function fill(sig, desc, ent) {
    const names = {
        sdk: desc.Name, client: desc.layout.client, ctor: desc.layout.ctor, module: desc.layout.module,
        accessor: ent ? ent.sym.accessor : '', var: ent ? ent.sym.var : '',
        Class: ent ? ent.className : '', Name: ent ? ent.Name : '',
    };
    return sig.replace(/\{(sdk|client|ctor|module|accessor|var|Class|Name)\}/g, (_m, k) => names[k]);
}
function fenced(p, lines) {
    return '```' + p.fence + '\n' + lines.join('\n') + '\n```\n';
}
// What an entity is called on the page: its class, or its name where the
// runtime has no class per entity.
function typeOf(r, ent) {
    return r.facts.classes ? ent.className : ent.Name;
}
// The sentence each fixed member kind is described by.
function memberText(kind, p, desc, ent) {
    const r = p.ref;
    const sig = (k) => {
        const m = [...r.facts.client, ...r.facts.entity].find((x) => x.kind === k);
        const named = null == m ? null : /([\w.]+(?:->\w+)?)\s*\(/.exec(m.sig);
        return null == named ? k : named[1] + '()';
    };
    switch (kind) {
        case 'options': return 'Return a deep copy of the current SDK options.';
        case 'utility': return 'Return a copy of the SDK utility object.';
        case 'tester': {
            const test = r.facts.test.find((x) => x.args) || r.facts.test[0];
            return `Alias for ${code(fill(test.call, desc).replace(/^.*?=\s*/, ''))}.`;
        }
        case 'data': return 'Get or set the entity data. When called with data, sets the entity\'s\n' +
            'internal data and returns the current data. When called without\narguments, returns a copy of the current data.';
        case 'match': return `Get or set the entity match criteria. Works the same as ${code(sig('data'))}.`;
        case 'dataGet': return 'Get the entity data.';
        case 'dataSet': return 'Set the entity data.';
        case 'matchGet': return 'Get the entity match criteria.';
        case 'matchSet': return 'Set the entity match criteria.';
        case 'make': return `Create a new ${code(ent ? typeOf(r, ent) : '')} instance with the same client and\noptions.`;
        case 'name': return 'Return the entity name.';
        case 'client': return `Return the parent ${code(desc.layout.client)} instance.`;
        case 'entopts': return 'Return a copy of the entity options.';
        case 'streamIterator': return 'Run an operation through the pipeline and yield its result items as\nthey arrive, as an async iterator.';
        case 'streamGenerator': return 'Run an operation through the pipeline and yield its result items as\nthey arrive, as a generator.';
        case 'streamList': return 'Run an operation through the pipeline and return its result items as\none list.';
        case 'streamChannel': return 'Run an operation through the pipeline and send its result items on the\n' +
            'returned channel, which closes when the stream ends. A `StreamItem` holds\none item in `Item`, ' +
            'or in `Err` the error that ended the stream: the\nerror the operation itself would return, sent as the last value. Under\n' +
            '`throw: false` in `callopts["ctrl"]`, no error is sent.';
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
        out += `| ${code('options')} | ${code(r.facts.container)} | SDK configuration options. |\n`;
    }
    for (const row of rows) {
        out += `| ${code(r.key(container, row.path))} | ${code(r.facts.valueType[row.type])} | ${row.text} |\n`;
    }
    return out;
}
function directRows(p) {
    const r = p.ref;
    const explain = { k: 'map', entries: [{ key: 'explain', value: { k: 'lit', type: 'BOOLEAN', text: '' } }] };
    const rows = [
        { path: ['path'], type: 'STRING', text: 'URL path with optional `{param}` placeholders.' },
        { path: ['method'], type: 'STRING', text: 'HTTP method (default: `GET`).' },
        { path: ['params'], type: 'OBJECT', text: 'Path parameter values for `{param}` substitution.' },
        { path: ['query'], type: 'OBJECT', text: 'Query string parameters.' },
        { path: ['headers'], type: 'OBJECT', text: 'Request headers (merged with defaults).' },
        { path: ['body'], type: 'ANY', text: `Request body (${r.facts.maps} are JSON-serialized).` },
        { path: ['ctrl'], type: 'OBJECT', text: `Control options (e.g. ${code(p.expr(explain, (0, example_1.newScope)()))}).` },
    ];
    return rows;
}
function clientMember(m, p, desc) {
    const r = p.ref;
    const f = p.facts;
    let out = `#### ${code(fill(m.sig, desc))}\n\n${memberText(m.kind, p, desc)}\n\n`;
    if ('direct' === m.kind) {
        out += keyTable(p, 'fetchargs', directRows(p));
        if (r.facts.direct.signal) {
            out += `| ${code(r.key('fetchargs', ['ctrl', 'signal']))} | ${code(r.facts.direct.signal)} | ` +
                'Aborts the request in flight: `ok` is then `false` and `err.code` is `request_aborted`. |\n';
        }
        out += `\n**Returns:** ${code(r.facts.direct.returns)}. On a failure \`ok\` is \`false\` and\n` +
            '`err` holds the error. A failed request is reported in the result, not\nas an error, so branch on `ok`.\n\n';
    }
    else if ('prepare' === m.kind) {
        out += `**Returns:** ${code(r.facts.prepare.returns)}. ` +
            ('value' === r.facts.prepare.fails
                ? `On failure it ${f.async ? 'resolves to' : 'returns'} the error instead.`
                : (0, runtimeprose_1.failsSentence)(f)) + '\n\n';
    }
    return out;
}
function constructorText(p, desc) {
    const r = p.ref;
    const container = 'bare' === r.facts.keys
        ? ` ${code('options')} is a ${code(r.facts.container)} map\n(${code(r.facts.none)} for none).` : '';
    return `### Constructor\n\n${fenced(p, r.facts.ctor.map((l) => fill(l, desc)))}\n` +
        `Create a new SDK client instance.${container}\n\n` +
        keyTable(p, 'options', desc.ref.optionRows) + '\n';
}
function testText(p, desc) {
    const r = p.ref;
    if (!desc.ref.test || 0 === r.facts.test.length)
        return '';
    let out = '\n### Test client\n\n';
    for (const t of r.facts.test) {
        out += `#### ${code(fill(t.sig, desc))}\n\n` +
            (t.args
                ? `Create a test client with mock features active. Both arguments may be\n${code(r.facts.none)}.`
                : 'Create a test client with mock features active, and no options.') +
            `\n\n${fenced(p, [fill(t.call, desc)])}\n`;
    }
    return out;
}
function instanceText(p, desc) {
    const r = p.ref;
    let out = `\n### Instance ${r.facts.noun}\n\n`;
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
    out += fenced(p, r.instance(ref, desc)) + '\n';
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
operations. Select one with \`$action\` in the call's argument; the
remaining keys are sent as that action's payload.

| Action | Operation | Route |
| --- | --- | --- |
${ent.actions.map((a) => `| ${code(a.action)} | ${code(p.facts.method[a.op])} | ${code(a.path)} |`).join('\n')}

An action returns that action's OWN response, which is not necessarily a
${ent.Name} record — check the API definition for its shape.

${(0, example_1.printBlock)(p, (0, example_1.actionBlock)(desc, ent, ent.actions[0]), desc, (0, example_1.newScope)())}
`;
    }
    if (0 < ent.refOps.length) {
        out += '### Operations\n\n';
        for (const op of ent.refOps) {
            out += `#### ${code(fill(r.facts.op[op.name], desc, ent))}\n\n` +
                `${wrap((0, runtimeprose_1.opText)(p.facts, op.name, op.needs, op.idInData))}\n\n`;
            const block = (0, example_1.refOpBlock)(desc, p.facts, ent, op);
            if (null != block)
                out += (0, example_1.printBlock)(p, block, desc, (0, example_1.newScope)()) + '\n';
            out += (0, media_1.bodyNoteText)(op.body, r.facts.body);
        }
    }
    out += `### Common ${r.facts.noun}\n\n`;
    for (const m of r.facts.entity) {
        out += `#### ${code(fill(m.sig, desc, ent))}\n\n${memberText(m.kind, p, desc, ent)}\n\n`;
    }
    return out;
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

${(0, example_1.printBlock)(p, (0, example_1.featureBlock)(features.map((f) => f.name)), desc, (0, example_1.newScope)())}
`;
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


## ${desc.layout.client}

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