"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeQuick = void 0;
exports.quickText = quickText;
exports.topQuickText = topQuickText;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const utility_1 = require("../utility");
const optional_1 = require("../helpers/optional");
const sdkdesc_1 = require("../helpers/sdkdesc");
const example_1 = require("../helpers/example");
const runtimeprose_1 = require("../helpers/runtimeprose");
const ReadmeQuick = (0, component_1.cmp)(function ReadmeQuick(props) {
    const { target, ctx$ } = props;
    const t = target.name;
    // A target's own ReadmeQuick_<lang> wins over its provider: a pack that
    // ships one, and a project's override, keep it. A copy an upgrade left
    // behind unchanged is RETIRED by doctor and removed by the next add.
    const own = (0, utility_1.loadOptional)(ctx$, `./cmp/${t}/ReadmeQuick_${t}`);
    const provider = null == own ? (0, optional_1.optionalComponent)(ctx$, target, 'Syntax') : undefined;
    if (provider) {
        (0, jostraca_1.Content)(quickText(provider.Syntax, (0, sdkdesc_1.sdkDescription)(ctx$, target)));
        return;
    }
    const placement = (0, utility_1.credentialPlacement)(ctx$.model);
    (0, jostraca_1.Content)(`
## Tutorial: your first API call

This tutorial walks through creating a client, listing entities, and
loading a specific record.${'' === placement ? '' : ' ' + placement}

`);
    const ReadmeQuick_sdk = own ?? (0, optional_1.optionalComponent)(ctx$, target, 'ReadmeQuick');
    if (ReadmeQuick_sdk) {
        ReadmeQuick_sdk['ReadmeQuick']({ target });
    }
});
exports.ReadmeQuick = ReadmeQuick;
const article = (s) => /^[aeiou]/i.test(s) ? 'an' : 'a';
function series(items) {
    if (items.length < 3)
        return items.join(' and ');
    return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
}
const GERUND = { create: 'creating', update: 'updating', patch: 'patching', remove: 'removing' };
function placement(desc) {
    const { active, in: where, name } = desc.auth;
    if (!active)
        return '';
    if ('query' === where)
        return `The client sends the API key as the \`${name}\` query parameter.`;
    if ('cookie' === where)
        return `The client sends the API key as the \`${name}\` cookie.`;
    return 'authorization' === name.toLowerCase() ? '' : `The client sends the API key in the \`${name}\` header.`;
}
function clientText(desc) {
    const env = desc.options.filter((o) => null != o.env).map((o) => '`' + o.env + '`');
    const sentences = [];
    if (1 === env.length) {
        sentences.push(`The client reads its API key from the ${env[0]} environment variable.`);
    }
    else if (2 === env.length) {
        sentences.push(`The client reads its API key and secret from the ${env[0]} and ${env[1]} environment variables.`);
    }
    const required = desc.server.filter((v) => v.required).map((v) => '`' + v.name + '`');
    const dflt = desc.server.filter((v) => !v.required).map((v) => `\`${v.name}\` defaults to \`${v.dflt}\``);
    if (0 < required.length) {
        sentences.push(`The server URL is templated, so \`server\` must give ${series(required)}` +
            (0 < dflt.length ? `; ${series(dflt)}.` : '.'));
    }
    else if (0 < dflt.length) {
        sentences.push(`The server URL is templated; ${series(dflt)}.`);
    }
    return sentences.join(' ');
}
// Prose is wrapped at 72 columns, as the hand-written sections are. A list
// item's continuation lines are indented under its text.
function wrap(text, first = '', rest = '') {
    const out = [];
    let line = first;
    let empty = true;
    for (const word of text.split(' ')) {
        if (!empty && 72 < (line + ' ' + word).length) {
            out.push(line);
            line = rest + word;
        }
        else {
            line = empty ? line + word : line + ' ' + word;
        }
        empty = false;
    }
    if (!empty)
        out.push(line);
    return out.join('\n');
}
// The steps every quick start takes, each with its sentences, from the
// description and the runtime facts alone.
function quickSteps(p, desc) {
    const q = desc.quick;
    const f = p.facts;
    const steps = [];
    const lead = ['creating a client'];
    const ent = (name) => desc.entities.find((e) => e.name === name);
    steps.push({ title: 'Create a client', text: clientText(desc), stmts: (0, example_1.clientBlock)(desc) });
    const list = (0, example_1.listBlock)(desc, f);
    if (null != q && null != list) {
        const n = ent(q.entity).Name.toLowerCase();
        lead.push(`listing ${n} records`);
        steps.push({ title: `List ${n} records`, text: (0, runtimeprose_1.listSentence)(f), stmts: list });
    }
    const load = (0, example_1.loadBlock)(desc, f);
    if (null != q && null != q.load && null != load) {
        const e = ent(q.load.entity);
        const n = e.Name.toLowerCase();
        lead.push(`loading ${article(n)} ${n}`);
        const nested = null == q.load.nested ? '' :
            `${e.Name} is nested under ${q.load.nested.parent}, so provide the \`${q.load.nested.param}\`. `;
        steps.push({ title: `Load ${article(n)} ${n}`, text: nested + (0, runtimeprose_1.loadSentence)(f), stmts: load });
    }
    const writes = (0, example_1.writeBlock)(desc, f);
    if (null != q && null != writes) {
        const ops = (0, example_1.writeOps)(desc);
        const n = ent(q.entity).Name.toLowerCase();
        lead.push(`${series(ops.map((o) => GERUND[o]))} ${article(n)} ${n}`);
        const title = series(ops);
        steps.push({ title: title.charAt(0).toUpperCase() + title.slice(1), text: '', stmts: writes });
    }
    return { steps, lead };
}
function quickText(p, desc) {
    const sc = (0, example_1.newScope)();
    const { steps, lead } = quickSteps(p, desc);
    sc.section = steps.flatMap((s) => s.stmts);
    const where = placement(desc);
    let out = `
## Tutorial: your first API call

${wrap(`This tutorial walks through ${series(lead)}.${'' === where ? '' : ' ' + where}`)}

`;
    // A runtime whose examples are whole programs gets the same sentences, as a
    // numbered list, and the steps as one program.
    if (p.program) {
        out += 'The steps are one program, shown whole after them.\n\n';
        steps.forEach((s, i) => {
            const lead = `${i + 1}. **${s.title}.**`;
            out += ('' === s.text ? lead : wrap(s.text.trim(), lead + ' ', '   ')) + '\n';
        });
        out += '\n' + (0, example_1.printProgram)(p, steps, desc, sc) + '\n';
        return out;
    }
    steps.forEach((s, i) => {
        out += `### ${i + 1}. ${s.title}\n\n${'' === s.text ? '' : wrap(s.text.trim()) + '\n\n'}${(0, example_1.printBlock)(p, s.stmts, desc, sc)}\n`;
    });
    return out;
}
// The root README's quick start for one language: the tutorial's first steps,
// client, list and load, in one block, each step named in a comment that
// states its runtime fact.
function topQuickText(p, desc) {
    const sc = (0, example_1.newScope)();
    const f = p.facts;
    const { steps } = quickSteps(p, desc);
    const first = steps.filter((s) => /^(Create a client|List |Load )/.test(s.title));
    // The comment names the step, so the program printer adds no title of its own.
    const commented = first.map((s) => ({
        title: '',
        stmts: 'Create a client' === s.title ? s.stmts : [
            { k: 'comment', text: /^List /.test(s.title) ? (0, runtimeprose_1.listComment)(f, s.title) : (0, runtimeprose_1.loadComment)(f, s.title) },
            ...s.stmts,
        ],
    }));
    sc.section = commented.flatMap((s) => s.stmts);
    return p.program ? (0, example_1.printProgram)(p, commented, desc, sc) : (0, example_1.printJoined)(p, commented, desc, sc);
}
//# sourceMappingURL=ReadmeQuick.js.map