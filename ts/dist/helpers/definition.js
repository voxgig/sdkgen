"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertMigrated = assertMigrated;
exports.definitionFileName = definitionFileName;
exports.definitionPath = definitionPath;
exports.definitionPathAny = definitionPathAny;
exports.definitionFolder = definitionFolder;
exports.dropLegacyIncludes = dropLegacyIncludes;
exports.definitionNames = definitionNames;
exports.indexName = indexName;
exports.indexPath = indexPath;
exports.isLegacyPath = isLegacyPath;
exports.migrateIncludes = migrateIncludes;
const node_path_1 = __importDefault(require("node:path"));
const utility_1 = require("../utility");
const junk_1 = require("./junk");
const EXT = '.aontu';
// Pre-rename aontu files: read from a package not yet renamed, never written.
const LEGACY_EXT = '.aon';
const SOURCE_RE = /\.(aontu|aon)$/;
function definitionFileName(name) {
    return name + EXT;
}
// The definition file for one item.
function definitionPath(sdkfolder, kind, name) {
    return node_path_1.default.join(sdkfolder, 'model', kind, definitionFileName(name));
}
function legacyPath(path) {
    return path.replace(/\.aontu$/, LEGACY_EXT);
}
function isLegacyPath(path) {
    return path.endsWith(LEGACY_EXT);
}
// The file an item ACTUALLY has: `.aontu`, else the pre-rename `.aon`. Without
// the fallback a remove reports success and leaves the file behind, and an
// item from a package that has not renamed its files is not found at all.
function definitionPathAny(fs, sdkfolder, kind, name) {
    const current = definitionPath(sdkfolder, kind, name);
    if (fs.existsSync(current)) {
        return current;
    }
    const legacy = legacyPath(current);
    return fs.existsSync(legacy) ? legacy : current;
}
const LEGACY_INCLUDE_RE = /@([ \t]*)(?:"((?:[^"\\\r\n]|\\.)*)\.aon"|'((?:[^'\\\r\n]|\\.)*)\.aon')/y;
// Renames each `.aon` include to `.aontu`, the only extension aontu reads.
// Strings and comments are skipped whole, so a `.aon` that is only text stays.
function migrateIncludes(src) {
    return mapLegacyIncludes(src, (gap, quote, path) => '@' + gap + quote + path + '.aontu' + quote);
}
// Removes each `.aon` include instead, leaving what the file itself declares.
function dropLegacyIncludes(src) {
    return mapLegacyIncludes(src, () => '');
}
function mapLegacyIncludes(src, replace) {
    let out = '';
    let at = 0;
    while (at < src.length) {
        LEGACY_INCLUDE_RE.lastIndex = at;
        const include = '@' === src[at] ? LEGACY_INCLUDE_RE.exec(src) : null;
        if (null != include) {
            const [, gap, dq, sq] = include;
            out += null != dq ? replace(gap, '"', dq) : replace(gap, "'", sq);
            at = LEGACY_INCLUDE_RE.lastIndex;
            continue;
        }
        const end = textEnd(src, at);
        out += src.slice(at, end);
        at = end;
    }
    return out;
}
// The end of the string or comment that starts at `at`, else `at + 1`.
function textEnd(src, at) {
    const c = src[at];
    const next = src[at + 1];
    if ('#' === c || ('/' === c && '/' === next)) {
        const eol = src.indexOf('\n', at);
        return eol < 0 ? src.length : eol;
    }
    if ('/' === c && '*' === next) {
        const close = src.indexOf('*/', at + 2);
        return close < 0 ? src.length : close + 2;
    }
    if ('"' === c || "'" === c || '`' === c) {
        for (let i = at + 1; i < src.length; i++) {
            if ('\\' === src[i]) {
                i++;
            }
            else if (c === src[i] || ('`' !== c && '\n' === src[i])) {
                return i + 1;
            }
        }
        return src.length;
    }
    return at + 1;
}
// The directory holding a kind's definitions.
function definitionFolder(sdkfolder, kind) {
    return node_path_1.default.join(sdkfolder, 'model', kind);
}
// The include list beside them.
function indexName(kind) {
    return kind + '-index' + EXT;
}
function indexPath(sdkfolder, kind) {
    return node_path_1.default.join(definitionFolder(sdkfolder, kind), indexName(kind));
}
function definitionNames(fs, sdkfolder, kind) {
    const dir = definitionFolder(sdkfolder, kind);
    const index = indexName(kind);
    const indexes = [index, legacyPath(index)];
    let entries;
    try {
        entries = fs.readdirSync(dir);
    }
    catch (err) {
        return [];
    }
    // The suffix alone is not enough: `.#target.aontu` is an emacs lock link and
    // `target.aontu.orig` a merge leftover, either of which would invent an item
    // that then resolves nowhere. See helpers/junk. Both extensions, deduped.
    const names = new Set(entries
        .filter((n) => SOURCE_RE.test(n) && !indexes.includes(n) && !(0, junk_1.isJunk)(n))
        .map((n) => n.replace(SOURCE_RE, '')));
    return [...names].sort();
}
// A project from before the rename has the `.aon` file and no `.aontu`: aontu
// reads neither it nor a new `.aontu` written beside it that nothing includes.
function assertMigrated(fs, paths) {
    const stale = paths
        .filter((p) => !fs.existsSync(p) && fs.existsSync(legacyPath(p)))
        .map((p) => node_path_1.default.normalize(legacyPath(p)).split(node_path_1.default.sep).join('/'));
    if (0 === stale.length) {
        return;
    }
    throw new utility_1.SdkGenError('This project predates .aontu model files: ' + stale.join(', ') +
        (1 === stale.length ? ' has' : ' have') + ' no .aontu counterpart, ' +
        'and aontu reads only .aontu.' +
        '\n  Re-scaffold the project with the current create-sdkgen, which ' +
        'migrates it:' +
        '\n    npm create @voxgig/sdkgen@latest ...   (run over this project, ' +
        'with the arguments it was created with)');
}
//# sourceMappingURL=definition.js.map