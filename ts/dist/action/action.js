"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateIndex = void 0;
exports.ensureModelInclude = ensureModelInclude;
exports.appendIndexEntries = appendIndexEntries;
exports.removeIndexEntries = removeIndexEntries;
exports.hasIndexEntry = hasIndexEntry;
exports.parseAddNames = parseAddNames;
exports.loadContent = loadContent;
const node_path_1 = __importDefault(require("node:path"));
const jostraca_1 = require("jostraca");
const indexEntry = (name) => `@"./${name}.aon"`;
const INDEX_ENTRY_RE = /^\s*@"(?:\.\/)?([^"]+)\.aon"\s*(?:#.*)?$/;
function indexEntryName(line) {
    const m = line.match(INDEX_ENTRY_RE);
    return null == m ? undefined : m[1];
}
// Is this name already included by the index?
function hasIndexEntry(content, name) {
    return content.split('\n')
        .some((line) => indexEntryName(line) === name);
}
// Append `@"<name>.aon"` import lines for each name not already present in
// the index content. Checking against the accumulating result (not the
// original) means duplicate names in the same call are added at most once.
function appendIndexEntries(content, names) {
    let out = content;
    for (const n of names) {
        if (!hasIndexEntry(out, n)) {
            out += '\n' + indexEntry(n);
        }
    }
    return out;
}
function removeIndexEntries(content, names) {
    const drop = new Set(names);
    return content
        .split('\n')
        .filter((line) => {
        const name = indexEntryName(line);
        return undefined === name || !drop.has(name);
    })
        .join('\n');
}
const UpdateIndex = (0, jostraca_1.cmp)(function UpdateIndex(props) {
    (0, jostraca_1.Content)(appendIndexEntries(props.content, props.names));
});
exports.UpdateIndex = UpdateIndex;
function parseAddNames(args) {
    return args.slice(2)
        .flatMap((a) => 'string' === typeof a ? a.split(',') : a)
        .filter((n) => null != n && '' !== n);
}
function loadContent(actx, which, seed) {
    which = Array.isArray(which) ? which : [which];
    const content = {};
    const fs = actx.fs();
    const modelfolder = node_path_1.default.dirname(actx.url);
    which.map((w) => {
        const indexfile = node_path_1.default.join(modelfolder, w, w + '-index.aon');
        content[`${w}_index`] = (null != seed?.[w] && !fs.existsSync(indexfile)) ?
            seed[w] : fs.readFileSync(indexfile, 'utf8');
    });
    return content;
}
function ensureModelInclude(actx, kind) {
    const fs = actx.fs();
    const url = actx.url;
    if (!fs.existsSync(url)) {
        // Said out loud rather than skipped silently: without the include the
        // item is invisible to the next model compile, and a quiet no-op here
        // would look exactly like success.
        actx.log.warn({
            point: 'model-include-absent', kind, file: url,
            note: url + ' not found, so ' + indexEntry(kind + '/' + kind + '-index') +
                ' could not be added — add it by hand, or nothing will see any ' +
                kind + ' item'
        });
        return false;
    }
    const name = kind + '/' + kind + '-index';
    const content = String(fs.readFileSync(url, 'utf8'));
    if (hasIndexEntry(content, name)) {
        return false;
    }
    if (actx.opts?.dryrun) {
        actx.log.info({
            point: 'model-include-dryrun', kind, file: url, entry: indexEntry(name),
            note: '** DRY RUN ** would add ' + indexEntry(name) + ' to ' + url
        });
        return false;
    }
    fs.writeFileSync(url, content + (content.endsWith('\n') ? '' : '\n') +
        indexEntry(name) + '\n');
    actx.log.info({
        point: 'model-include-added', kind, file: url, entry: indexEntry(name),
        note: url + ': added ' + indexEntry(name) +
            ' — without it the project model never sees any ' + kind + ' item'
    });
    return true;
}
//# sourceMappingURL=action.js.map