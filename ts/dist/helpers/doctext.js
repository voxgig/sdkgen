"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.docTexts = docTexts;
exports.renderValue = renderValue;
exports.sentinelName = sentinelName;
const apidef_1 = require("@voxgig/apidef");
const canonSpec_1 = require("./canonSpec");
const text_1 = require("./text");
// A struct.validate sentinel as a reader's word for it: '`$FUNCTION`' ->
// 'function'. A union renders its members, so netsim's latency reads
// 'number | map'. Anything unrecognised renders verbatim rather than being
// dropped — a doc table that silently omits an option is the failure this
// whole path exists to fix.
function sentinelName(v) {
    if (Array.isArray(v)) {
        const members = ((0, canonSpec_1.isAnyOf)(v) ? (0, canonSpec_1.alternatives)(v) : v.slice(1))
            .map((m) => sentinelName(m))
            .filter((m) => 'one' !== m);
        return 0 === members.length ? 'any' : members.join(' | ');
    }
    if ('string' !== typeof v) {
        return 'any';
    }
    const bare = v.replace(/[`$]/g, '').trim().toLowerCase();
    return '' === bare ? 'any' : bare;
}
function renderValue(v) {
    if (null == v) {
        return '';
    }
    if (Array.isArray(v)) {
        return '[' + v.map((x) => renderValue(x)).join(', ') + ']';
    }
    if ('object' === typeof v) {
        const keys = Object.keys(v);
        return 0 === keys.length ? '{}' :
            '{' + keys.map((k) => k + ': ' + renderValue(v[k])).join(', ') + '}';
    }
    if ('string' === typeof v) {
        return `'${v}'`;
    }
    return String(v);
}
function given(value) {
    return null != value && '' !== value;
}
function str(value, trim = false) {
    return !given(value) ? '' : trim ? String(value).trim() : String(value);
}
// Every text the neutral documents print from the model, as they print it,
// with the node its escaped forms are written beside.
function docTexts(model) {
    const kit = model.main[apidef_1.KIT];
    const info = (0, text_1.modelText)(model);
    const own = kit.text || {};
    const def = model.main.def || {};
    const texts = [];
    const add = (at, path, raw, vendor) => texts.push({ raw, vendor, at, path });
    const slot = (name, raw) => add(kit, ['text', name], raw, !given(own[name]));
    slot('title', str(info.title));
    add(kit, ['apiName'], str(info.title) || (0, apidef_1.nom)(model, 'Name') + ' API', given(info.title) && !given(own.title));
    slot('tagline', str(info.tagline) || str(def.tagline));
    slot('summary', str(info.summary, true));
    slot('about_md', str(info.about_md, true));
    slot('website', str(info.website, true));
    slot('meta_source', str(info.meta_source, true));
    slot('docs_url', str(info.docs_url));
    add(kit, ['text', 'desc'], str(def.desc), true);
    add(kit, ['text', 'upstream'], str(info.contact?.url) || str(info.servers?.[0]?.url) ||
        str(info.homepage), true);
    for (const [name, ent] of Object.entries(kit.entity || {})) {
        add(ent, ['desc'], str(info.entity_desc[name]) || str(ent.short) || str(ent.desc), !given(own.entity_desc?.[name]));
        // Beside the kit, not the fields: some tests print an entity whole.
        for (const field of Object.values(ent.fields || {})) {
            if (given(field?.sh)) {
                add(kit, ['field', name, String(field.n), 'desc'], str(field.sh), true);
            }
        }
    }
    for (const f of Object.values(kit.feature || {})) {
        add(f, ['title'], str(f.title), false);
        const opts = f.config?.options || {};
        const spec = f.config?.optspec || {};
        for (const k of Object.keys(opts)) {
            add(f, ['option', k, 'value'], renderValue(opts[k]), false);
        }
        for (const k of Object.keys(spec).filter((k) => null == opts[k])) {
            add(f, ['option', k, 'type'], sentinelName(spec[k]), false);
        }
    }
    return texts;
}
//# sourceMappingURL=doctext.js.map