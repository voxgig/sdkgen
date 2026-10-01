"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.COPIES = void 0;
exports.copiesPath = copiesPath;
exports.itemKey = itemKey;
exports.fingerprint = fingerprint;
exports.readCopies = readCopies;
exports.recordCopies = recordCopies;
exports.forgetCopies = forgetCopies;
exports.untouched = untouched;
exports.isCopy = isCopy;
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const definition_1 = require("../helpers/definition");
const kind_1 = require("./kind");
// What every add last wrote into `.sdk`, by fingerprint, and the version of
// the package each item came from. It is the only record that tells a copy
// the project changed from one its source has since moved past.
const COPIES = 'sdkgen-copies.json';
exports.COPIES = COPIES;
const ABOUT = 'Written by voxgig-sdkgen on every add: what it copied into ' +
    '.sdk, so that doctor, generate and package update can tell an outdated ' +
    'copy from a local edit. Commit it; do not edit it.';
function copiesPath(folder) {
    return node_path_1.default.join(folder, COPIES);
}
function itemKey(kind, name) {
    return kind + '/' + name;
}
function fingerprint(content) {
    return (0, node_crypto_1.createHash)('sha256').update(content).digest('hex').slice(0, 16);
}
// An unreadable record is treated as absent: every copy is then unrecorded,
// which is exactly the state of a project from before the record existed.
function readCopies(fs, folder) {
    const empty = { items: {}, files: {} };
    const path = copiesPath(folder);
    if (!fs.existsSync(path)) {
        return empty;
    }
    try {
        const read = JSON.parse(String(fs.readFileSync(path, 'utf8')));
        return {
            items: { ...(read?.items ?? {}) },
            files: { ...(read?.files ?? {}) },
        };
    }
    catch (err) {
        return empty;
    }
}
function writeCopies(fs, folder, record) {
    const sorted = (obj) => Object.fromEntries(Object.keys(obj).sort().map((key) => [key, obj[key]]));
    fs.writeFileSync(copiesPath(folder), JSON.stringify({
        about: ABOUT,
        items: sorted(record.items),
        files: sorted(record.files),
    }, null, 2) + '\n');
}
function provenanceOf(source) {
    return {
        ...(null == source.package ? {} : { package: source.package }),
        ...(null == source.version ? {} : { version: source.version }),
    };
}
// The trees and definition files an add owns. An index is excluded: every
// add rewrites it and no source holds a copy to compare it with.
const TREE_ROOTS = Array.from(new Set(Object.values(kind_1.KINDS)
    .flatMap((kind) => (kind.trees ?? [])
    .map((tree) => String(tree.path).split('{name}')[0]))));
function isCopy(rel) {
    if (TREE_ROOTS.some((root) => rel.startsWith(root))) {
        return true;
    }
    const dir = node_path_1.default.posix.dirname(rel);
    const base = node_path_1.default.posix.basename(rel);
    return Object.keys(kind_1.KINDS).some((kind) => dir === (0, definition_1.definitionFolder)('', kind).split(node_path_1.default.sep).join('/') &&
        base !== (0, definition_1.indexName)(kind) &&
        base.endsWith((0, definition_1.definitionFileName)('')));
}
function relativeTo(folder, abs) {
    const rel = node_path_1.default.relative(node_path_1.default.resolve(folder), node_path_1.default.resolve(abs))
        .split(node_path_1.default.sep).join('/');
    return ('' === rel || rel.startsWith('../') || node_path_1.default.isAbsolute(rel)) ?
        undefined : rel;
}
// Called by each add with what its own jostraca run wrote. A dry run writes
// nothing, so it records nothing.
function recordCopies(actx, jres, kind, sources) {
    if (true === actx.opts?.dryrun || null == jres?.files) {
        return;
    }
    const fs = actx.fs();
    const folder = actx.folder;
    const record = readCopies(fs, folder);
    const files = [
        ...(jres.files.written ?? []), ...(jres.files.unchanged ?? []),
    ];
    for (const abs of files) {
        const rel = relativeTo(folder, abs);
        if (null != rel && isCopy(rel) && fs.existsSync(abs)) {
            record.files[rel] = fingerprint(fs.readFileSync(abs));
        }
    }
    for (const source of sources) {
        record.items[itemKey(kind, source.name)] = provenanceOf(source);
    }
    pruneMissing(fs, folder, record);
    writeCopies(fs, folder, record);
}
// After a remove: the item goes, with every file entry nothing holds now.
function forgetCopies(actx, kind, name) {
    const fs = actx.fs();
    const folder = actx.folder;
    if (true === actx.opts?.dryrun || !fs.existsSync(copiesPath(folder))) {
        return;
    }
    const record = readCopies(fs, folder);
    delete record.items[itemKey(kind, name)];
    pruneMissing(fs, folder, record);
    writeCopies(fs, folder, record);
}
function pruneMissing(fs, folder, record) {
    for (const rel of Object.keys(record.files)) {
        if (!fs.existsSync(node_path_1.default.join(folder, ...rel.split('/')))) {
            delete record.files[rel];
        }
    }
}
// Was this project file left exactly as an add wrote it?
function untouched(fs, folder, record, rel) {
    const recorded = record.files[rel];
    if (null == recorded) {
        return undefined;
    }
    const abs = node_path_1.default.join(folder, ...rel.split('/'));
    return fs.existsSync(abs) && recorded === fingerprint(fs.readFileSync(abs));
}
//# sourceMappingURL=copies.js.map