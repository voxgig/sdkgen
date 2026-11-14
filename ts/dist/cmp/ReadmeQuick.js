"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadmeQuick = void 0;
exports.quickText = quickText;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const utility_1 = require("../utility");
const optional_1 = require("../helpers/optional");
const sdkdesc_1 = require("../helpers/sdkdesc");
const example_1 = require("../helpers/example");
const ReadmeQuick = (0, component_1.cmp)(function ReadmeQuick(props) {
    const { target, ctx$ } = props;
    const t = target.name;
    // A target's own ReadmeQuick_<lang> wins over its provider: a project that
    // forked it keeps its fork, and a copy an upgrade left behind keeps writing
    // what it wrote until doctor's stale finding has it removed.
    const own = (0, utility_1.loadOptional)(ctx$, `./cmp/${t}/ReadmeQuick_${t}`);
    const provider = null == own ? (0, optional_1.optionalComponent)(ctx$, target, 'Syntax') : undefined;
    if (provider) {
        (0, jostraca_1.Content)(quickText(provider.Syntax, (0, sdkdesc_1.sdkDescription)(ctx$.model, t)));
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
    return 0 === sentences.length ? '' : wrap(sentences.join(' ')) + '\n\n';
}
// Prose is wrapped at 72 columns, as the hand-written sections are.
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
function quickText(p, desc) {
    const q = desc.quick;
    const sc = (0, example_1.newScope)();
    const w = p.words;
    const steps = [];
    const list = (0, example_1.listBlock)(desc);
    const load = (0, example_1.loadBlock)(desc);
    const writes = (0, example_1.writeBlock)(desc);
    const client = (0, example_1.clientBlock)(desc);
    sc.section = [client, list, load, writes].flatMap((b) => b || []);
    steps.push({ title: 'Create a client', text: clientText(desc), block: (0, example_1.printBlock)(p, client, desc, sc) });
    const lead = ['creating a client'];
    const ent = (name) => desc.entities.find((e) => e.name === name);
    if (null != q && null != list) {
        const n = ent(q.entity).Name.toLowerCase();
        lead.push(`listing ${n} records`);
        steps.push({
            title: `List ${n} records`,
            text: wrap(`${w.op('list')} returns ${w.many} of entities, one per record, and ${w.fails}; ${w.data} reads an entity's record.`) + '\n\n',
            block: (0, example_1.printBlock)(p, list, desc, sc),
        });
    }
    if (null != q && null != q.load && null != load) {
        const e = ent(q.load.entity);
        const n = e.Name.toLowerCase();
        lead.push(`loading ${article(n)} ${n}`);
        const nested = null == q.load.nested ? '' :
            `${e.Name} is nested under ${q.load.nested.parent}, so provide the \`${q.load.nested.param}\`.\n`;
        steps.push({
            title: `Load ${article(n)} ${n}`,
            text: nested + wrap(`${w.op('load')} returns ${w.one ?? 'the entity'} and ${w.fails}; ${w.data} reads its record.`) + '\n\n',
            block: (0, example_1.printBlock)(p, load, desc, sc),
        });
    }
    if (null != q && null != writes) {
        const ops = (0, example_1.writeOps)(desc);
        const n = ent(q.entity).Name.toLowerCase();
        lead.push(`${series(ops.map((o) => GERUND[o]))} ${article(n)} ${n}`);
        const title = series(ops);
        steps.push({ title: title.charAt(0).toUpperCase() + title.slice(1), text: '', block: (0, example_1.printBlock)(p, writes, desc, sc) });
    }
    const where = placement(desc);
    let out = `
## Tutorial: your first API call

${wrap(`This tutorial walks through ${series(lead)}.${'' === where ? '' : ' ' + where}`)}

`;
    steps.forEach((s, i) => {
        out += `### ${i + 1}. ${s.title}\n\n${s.text}${s.block}\n`;
    });
    return out;
}
//# sourceMappingURL=ReadmeQuick.js.map