"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.anchors = anchors;
exports.docFindings = docFindings;
exports.slug = slug;
const node_path_1 = __importDefault(require("node:path"));
const generated_1 = require("./generated");
// GitHub's heading anchors, which is what a reader's browser follows.
function slug(heading) {
    return heading.trim().toLowerCase()
        .replace(/`/g, '')
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .replace(/\s/g, '-');
}
function anchors(text) {
    const out = new Set();
    const seen = new Map();
    let fence = false;
    for (const line of text.split('\n')) {
        if (/^\s*(```|~~~)/.test(line))
            fence = !fence;
        if (fence)
            continue;
        const m = /^#{1,6}\s+(.*)$/.exec(line);
        if (!m)
            continue;
        const s = slug(m[1]);
        const n = seen.get(s) ?? 0;
        out.add(0 === n ? s : s + '-' + n);
        seen.set(s, n + 1);
    }
    return out;
}
// The lines of a document outside its fenced blocks, numbered from one.
function prose(text) {
    const out = [];
    let fence = '';
    text.split('\n').forEach((line, i) => {
        const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
        if (open && ('' === fence || open[1].startsWith(fence))) {
            fence = '' === fence ? open[1] : '';
        }
        else if ('' === fence) {
            out.push([i + 1, line]);
        }
    });
    return out;
}
function cells(row) {
    return (row.trim().match(/(?<!\\)\|/g) || []).length;
}
const DELIMITER = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
// Each row of a table ends as its header ends and holds as many cells; a
// row with no header before it is the second half of a row a line break cut.
function tables(file, text) {
    const out = [];
    const lines = prose(text);
    let header = null;
    for (let i = 0; i < lines.length; i++) {
        const [num, line] = lines[i];
        if (!/^ {0,3}\|/.test(line)) {
            header = null;
        }
        else if (null == header) {
            if (DELIMITER.test(lines[i + 1]?.[1] ?? '')) {
                header = line;
                i++;
            }
            else {
                out.push({ point: 'doc-table-broken', file, line: num, note: 'a row outside a table: ' + line });
            }
        }
        else if (cells(line) !== cells(header) ||
            line.trim().endsWith('|') !== header.trim().endsWith('|')) {
            out.push({ point: 'doc-table-broken', file, line: num, note: line });
        }
    }
    return out;
}
function links(file, text, docs, exists) {
    const out = [];
    const dir = node_path_1.default.posix.dirname(file);
    for (const [num, line] of prose(text)) {
        const bare = line.replace(/(`+)[^`][\s\S]*?\1/g, '');
        for (const m of bare.matchAll(/\]\(<?([^)\s>]+)>?(?:\s+"[^"]*")?\)/g)) {
            const href = m[1];
            if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('/'))
                continue;
            const [rel, frag] = href.split('#');
            const target = '' === rel ? file : node_path_1.default.posix.normalize(node_path_1.default.posix.join(dir, decodeURI(rel)));
            if ('' !== rel && !exists(target)) {
                out.push({ point: 'doc-link-dangling', file, line: num, note: target });
            }
            else if (null != frag && '' !== frag && docs.has(target) && !anchors(docs.get(target)).has(frag)) {
                out.push({ point: 'doc-link-dangling', file, line: num, note: target + '#' + frag });
            }
        }
    }
    return out;
}
function walk(node, visit) {
    if (null == node)
        return;
    visit(node);
    for (const child of node.children ?? [])
        walk(child, visit);
}
// Every Markdown file a pass kept, checked against what the pass wrote and
// what is already in `folder`: a relative link that resolves nowhere, and a
// table row that a line break or a pipe has broken. A dry run copies nothing,
// so there a path under a copy's destination counts as written.
function docFindings(root, folder, onDisk, dryrun = false) {
    const rel = (full) => node_path_1.default.relative(node_path_1.default.resolve(folder), node_path_1.default.resolve(full)).split(node_path_1.default.sep).join('/');
    const claims = (0, generated_1.claimedFiles)(root, folder);
    const written = new Set(Object.keys(claims.files).map(rel));
    const copied = claims.copies.map((c) => rel(c.to));
    const docs = new Map();
    walk(root, (node) => {
        if ('file' === node.kind && 'string' === typeof node.fullpath && node.fullpath.endsWith('.md') &&
            Array.isArray(node.content)) {
            docs.set(rel(node.fullpath), node.content.join(''));
        }
    });
    const exists = (path) => written.has(path) ||
        [...written].some((p) => p.startsWith(path + '/')) ||
        (dryrun && copied.some((c) => path === c || path.startsWith(c + '/'))) ||
        onDisk(node_path_1.default.join(folder, path));
    const out = [];
    for (const [file, text] of docs) {
        out.push(...tables(file, text), ...links(file, text, docs, exists));
    }
    return out;
}
//# sourceMappingURL=doccheck.js.map