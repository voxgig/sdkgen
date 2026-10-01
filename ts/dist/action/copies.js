"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IGNORED_LOG = exports.COPY_LOG = void 0;
exports.ignoredLog = ignoredLog;
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
// What every add wrote into `.sdk`, by fingerprint, and the version of the
// package each item came from: the only record that tells a copy the project
// changed from one its source has since moved past. Append-only, one line per
// add or remove that changed the record, holding just the change.
const COPY_LOG = 'log/copies.jsonl';
exports.COPY_LOG = COPY_LOG;
// Where 4.34.0 kept the whole record, until the next write moves it.
const LEGACY = 'sdkgen-copies.json';
const IGNORED_LOG = '.sdk/.gitignore ignores log/, so .sdk/' + COPY_LOG +
    ' is not committed and a fresh clone has no copy record. Delete the ' +
    'log/ line.';
exports.IGNORED_LOG = IGNORED_LOG;
function logPath(folder) {
    return node_path_1.default.join(folder, ...COPY_LOG.split('/'));
}
function itemKey(kind, name) {
    return kind + '/' + name;
}
// CRLF and LF copies of one file share a fingerprint, as doctor compares
// them. latin1 maps each byte to one character, so nothing else changes.
function fingerprint(content) {
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
    const lf = Buffer.from(bytes.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
    return (0, node_crypto_1.createHash)('sha256').update(lf).digest('hex').slice(0, 16);
}
// Unreadable lines are skipped. A copy can then only lose its entry, which
// leaves it unrecorded, as in a project from before the record existed.
function readCopies(fs, folder) {
    const record = { items: {}, files: {} };
    const log = logPath(folder);
    const entries = fs.existsSync(log) ?
        String(fs.readFileSync(log, 'utf8')).split('\n').map(parseEntry) :
        [readLegacy(fs, folder)];
    for (const entry of entries) {
        if (null != entry) {
            apply(record, entry);
        }
    }
    return record;
}
function parseEntry(line) {
    if ('' === line.trim()) {
        return undefined;
    }
    try {
        return JSON.parse(line) ?? undefined;
    }
    catch (err) {
        return undefined;
    }
}
function readLegacy(fs, folder) {
    const path = node_path_1.default.join(folder, LEGACY);
    if (!fs.existsSync(path)) {
        return undefined;
    }
    try {
        const read = JSON.parse(String(fs.readFileSync(path, 'utf8')));
        return { items: read?.items ?? {}, files: read?.files ?? {} };
    }
    catch (err) {
        return undefined;
    }
}
function apply(record, entry) {
    for (const [key, item] of Object.entries(entry.items ?? {})) {
        if (null == item) {
            delete record.items[key];
        }
        else {
            record.items[key] = item;
        }
    }
    for (const [rel, print] of Object.entries(entry.files ?? {})) {
        if (null == print) {
            delete record.files[rel];
        }
        else {
            record.files[rel] = print;
        }
    }
}
// The only writer. An entry that changes nothing is not written, so an add
// that rewrites identical copies leaves the log, and git, as they were.
function appendEntry(actx, op, entry) {
    const fs = actx.fs();
    const folder = actx.folder;
    const log = logPath(folder);
    const legacy = node_path_1.default.join(folder, LEGACY);
    const fresh = !fs.existsSync(log);
    const lines = [];
    if (fresh) {
        const imported = readLegacy(fs, folder);
        if (null != imported && changes(imported)) {
            lines.push(entryLine('import', imported));
        }
    }
    if (changes(entry)) {
        lines.push(entryLine(op, entry));
    }
    if (0 < lines.length) {
        fs.mkdirSync(node_path_1.default.dirname(log), { recursive: true });
        fs.appendFileSync(log, lines.join('\n') + '\n');
        if (fresh && ignoredLog(fs, folder)) {
            actx.log.warn({ point: 'copies-ignored', note: IGNORED_LOG });
        }
    }
    if (fs.existsSync(legacy)) {
        fs.unlinkSync(legacy);
    }
}
// The line every create-sdkgen scaffold wrote before the record moved into
// log/. Only git knows every rule, so this finds that one, not all of them.
function ignoredLog(fs, folder) {
    const path = node_path_1.default.join(folder, '.gitignore');
    return fs.existsSync(path) && String(fs.readFileSync(path, 'utf8'))
        .split('\n').some((line) => /^\/?log(\/\*?)?$/.test(line.trim()));
}
function changes(entry) {
    return 0 < Object.keys(entry.items ?? {}).length ||
        0 < Object.keys(entry.files ?? {}).length;
}
function entryLine(op, entry) {
    const sorted = (obj = {}) => Object.fromEntries(Object.keys(obj).sort().map((key) => [key, obj[key]]));
    return JSON.stringify({
        at: new Date().toISOString(),
        op,
        items: sorted(entry.items),
        files: sorted(entry.files),
    });
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
    const items = {};
    const files = gone(fs, folder, record);
    for (const source of sources) {
        const key = itemKey(kind, source.name);
        const item = provenanceOf(source);
        const known = record.items[key];
        if (null == known ||
            known.package !== item.package || known.version !== item.version) {
            items[key] = item;
        }
    }
    const written = [
        ...(jres.files.written ?? []), ...(jres.files.unchanged ?? []),
    ];
    for (const abs of written) {
        const rel = relativeTo(folder, abs);
        if (null != rel && isCopy(rel) && fs.existsSync(abs)) {
            const print = fingerprint(fs.readFileSync(abs));
            if (print !== record.files[rel]) {
                files[rel] = print;
            }
        }
    }
    appendEntry(actx, 'add', { items, files });
}
// After a remove: the item goes, with every file entry nothing holds now.
function forgetCopies(actx, kind, name) {
    if (true === actx.opts?.dryrun) {
        return;
    }
    const fs = actx.fs();
    const folder = actx.folder;
    const record = readCopies(fs, folder);
    const key = itemKey(kind, name);
    appendEntry(actx, 'remove', {
        items: null == record.items[key] ? {} : { [key]: null },
        files: gone(fs, folder, record),
    });
}
function gone(fs, folder, record) {
    const missing = {};
    for (const rel of Object.keys(record.files)) {
        if (!fs.existsSync(node_path_1.default.join(folder, ...rel.split('/')))) {
            missing[rel] = null;
        }
    }
    return missing;
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