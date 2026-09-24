"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBare = exports.recordedRef = exports.KINDS = void 0;
exports.aliasModelKey = aliasModelKey;
exports.kindTrees = kindTrees;
exports.escapeRe = escapeRe;
exports.kindDef = kindDef;
exports.resolveKind = resolveKind;
exports.kindModel = kindModel;
exports.kindIndex = kindIndex;
exports.installedModelText = installedModelText;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const stdrep_1 = require("../helpers/stdrep");
const definition_1 = require("../helpers/definition");
const resolve_1 = require("./resolve");
Object.defineProperty(exports, "recordedRef", { enumerable: true, get: function () { return resolve_1.recordedRef; } });
Object.defineProperty(exports, "isBare", { enumerable: true, get: function () { return resolve_1.isBare; } });
const action_1 = require("./action");
const BARE_KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function aliasModelKey(kind) {
    return function aliasModelText(src, origname, name) {
        const mustQuote = !BARE_KEY_RE.test(name);
        return src.replace(new RegExp(kind + ":(\\s*)('?)" + escapeRe(origname) + "\\2:", 'g'), (_m, gap, quote) => {
            const q = ('' !== quote || mustQuote) ? "'" : '';
            return kind + ':' + gap + q + name + q + ':';
        });
    };
}
function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const KINDS = Object.assign(Object.create(null), {
    target: {
        name: 'target', alias: true, ownedWhenAliased: true,
        rename: aliasModelKey('target'),
        // Components are dispatched by the convention `cmp/<t>/Main_<t>`, and the
        // template tree is what `target add` copies — a target missing either is
        // not installable, however complete its model file looks.
        trees: [
            { path: 'src/cmp/{name}', replace: 'none', required: true },
            { path: 'tm/{name}', replace: 'template', required: true },
        ],
    },
    feature: { name: 'feature', alias: false },
    edition: {
        name: 'edition', alias: true, ownedWhenAliased: true,
        rename: aliasModelKey('edition'),
        trees: [
            { path: 'src/cmp/edition/{name}', replace: 'none', required: true },
            { path: 'tm/edition/{name}', replace: 'template', required: false },
        ],
    },
});
exports.KINDS = KINDS;
function kindTrees(kind, name) {
    return (kindDef(kind).trees ?? []).map((t) => ({
        ...t,
        path: t.path.split('{name}').join(name),
    }));
}
function kindDef(kind) {
    const def = KINDS[kind];
    if (null == def) {
        throw new utility_1.SdkGenError('Unknown kind: ' + kind);
    }
    return def;
}
function resolveKind(ref, kind, ctx$) {
    const def = kindDef(kind);
    const source = (0, resolve_1.resolveSource)(ref, kind, ctx$);
    if (!def.alias && source.name !== source.origname) {
        throw new utility_1.SdkGenError(capitalise(kind) + ' aliasing is not supported: ' + ref +
            '\n  A ' + kind + ' name is part of the generated config ' +
            '(options.' + kind + '.<name>) and of the hook wiring in every target, ' +
            'so it cannot be renamed at install time.');
    }
    if (!ctx$.fs().existsSync(source.model)) {
        throw new Error(capitalise(kind) + ' definition not found: ' + source.model);
    }
    return source;
}
// What `add` writes as an item's model file, and doctor re-derives to compare.
function installedModelText(kind, source, src) {
    const rename = kindDef(kind).rename;
    const aliased = source.name !== source.origname;
    return (0, definition_1.migrateIncludes)((aliased && null != rename) ?
        rename(src, source.origname, source.name) : src);
}
function kindModel(props) {
    const { ctx$, kind, source } = props;
    const def = kindDef(kind);
    const fs = ctx$.fs();
    const log = ctx$.log;
    const aliased = source.name !== source.origname;
    const owned = aliased && true === def.ownedWhenAliased;
    const replace = (0, stdrep_1.provenanceReplace)({
        base: source.base,
        origname: source.origname,
        name: source.name,
        package: source.package,
    });
    if (owned) {
        const dest = (0, definition_1.definitionPath)(ctx$.folder ?? '.', kind, source.name);
        if (fs.existsSync(dest)) {
            log.info({
                point: kind + '-alias-model-kept', [kind]: source.name, file: dest,
                note: source.name + ': keeping the existing aliased ' + kind +
                    ' model (project-owned — an alias is differentiated by editing it)'
            });
        }
    }
    const src = fs.readFileSync(source.model, 'utf8');
    (0, jostraca_1.File)({ name: (0, definition_1.definitionFileName)(source.name), exclude: owned }, () => (0, jostraca_1.Content)({ src: installedModelText(kind, source, src), replace }));
}
function kindIndex(props) {
    const { kind, names, content } = props;
    (0, jostraca_1.File)({ name: (0, definition_1.indexName)(kindDef(kind).name) }, () => (0, action_1.UpdateIndex)({
        content,
        names,
    }));
}
function capitalise(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
//# sourceMappingURL=kind.js.map