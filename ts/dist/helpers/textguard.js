"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FENCES = void 0;
exports.mention = mention;
exports.linkFindings = linkFindings;
exports.markerFindings = markerFindings;
exports.fenceFindings = fenceFindings;
exports.offFindings = offFindings;
exports.textGuard = textGuard;
const node_path_1 = __importDefault(require("node:path"));
const doccheck_1 = require("./doccheck");
// The code-block tag of each bundled SDK target's documents. A consumer, whose
// directory is the name of what it wraps and a suffix, writes that language.
const FENCES = {
    c: 'c', clojure: 'clojure', cpp: 'cpp', csharp: 'csharp', elixir: 'elixir', go: 'go',
    java: 'java', js: 'js', kotlin: 'kotlin', lua: 'lua', ocaml: 'ocaml', perl: 'perl',
    php: 'php', py: 'python', rb: 'ruby', rust: 'rust', scala: 'scala', swift: 'swift',
    ts: 'ts', zig: 'zig',
};
exports.FENCES = FENCES;
const NEUTRAL_FENCES = new Set(['', 'bash', 'sh', 'shell', 'console', 'text', 'json', 'jsonc',
    'toml', 'yaml', 'xml', 'ini', 'diff']);
const MARKER = /\$\$[A-Za-z_][\w.$]*\$\$/;
// A word only where no letter, `+` or `#` continues it: `C` is not a mention
// inside `C++` or `C#`.
function mention(w) {
    return new RegExp('(?<![A-Za-z0-9_+#-])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '(?![A-Za-z0-9_+#])');
}
function docLines(files) {
    return Object.fromEntries(Object.entries(files)
        .filter(([path, text]) => path.endsWith('.md') && 'string' === typeof text)
        .map(([path, text]) => [path, text.split('\n').map((t) => ({ text: t, chain: '' }))]));
}
function isDir(present, dir) {
    const d = dir.replace(/\/+$/, '');
    if ('' === d || '.' === d || '.sdk' === d || d.startsWith('.sdk/'))
        return true;
    for (const p of present)
        if (p.startsWith(d + '/'))
            return true;
    return false;
}
// A relative link or anchor, or a `cd` in a shell block, that resolves to
// nothing the run wrote.
function linkFindings(lines, files, present) {
    const out = [];
    for (const [doc, docLines] of Object.entries(lines)) {
        const dir = node_path_1.default.posix.dirname(doc);
        let fence = '';
        for (const { text, chain } of docLines) {
            const open = /^\s*(```|~~~)\s*(\S*)/.exec(text);
            if (open) {
                fence = '' === fence ? (open[2] || 'text') : '';
                continue;
            }
            if ('' !== fence) {
                if (/^(bash|sh|shell|console)$/.test(fence)) {
                    const cd = /^\s*(?:\$\s*)?cd\s+([^\s;&|)]+)/.exec(text);
                    if (cd && !/^[~$\/]/.test(cd[1])) {
                        const fromDoc = node_path_1.default.posix.normalize(node_path_1.default.posix.join(dir, cd[1]));
                        const fromRoot = node_path_1.default.posix.normalize(cd[1]);
                        if (!isDir(present, fromDoc) && !isDir(present, fromRoot)) {
                            out.push({ relation: 'link', chain, cause: 'cd ' + cd[1], doc, line: text });
                        }
                    }
                }
                continue;
            }
            const bare = text.replace(/`[^`]*`/g, '');
            for (const m of bare.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
                const href = m[1];
                if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('/'))
                    continue;
                const [rel, frag] = href.split('#');
                const target = '' === rel ? doc : node_path_1.default.posix.normalize(node_path_1.default.posix.join(dir, rel));
                if ('' !== rel && !present.has(target) && !isDir(present, target)) {
                    out.push({ relation: 'link', chain, cause: target, doc, line: text });
                    continue;
                }
                if (null != frag && '' !== frag && target.endsWith('.md') && null != files[target] &&
                    !(0, doccheck_1.anchors)(files[target]).has(frag)) {
                    out.push({ relation: 'link', chain, cause: target + '#' + frag, doc, line: text });
                }
            }
        }
    }
    return out;
}
function markerFindings(lines) {
    const out = [];
    for (const [doc, docLines] of Object.entries(lines)) {
        for (const { text, chain } of docLines) {
            const found = MARKER.exec(text.replace(/`[^`]*`/g, ''));
            if (null != found) {
                out.push({ relation: 'marker', chain, cause: 'unfired', doc, line: text });
            }
        }
    }
    return out;
}
// A code block in a target's documents is in that target's language, or is
// data or a shell session.
function fenceFindings(lines, fences) {
    const out = [];
    const keys = Object.keys(fences).sort();
    for (const [doc, docLines] of Object.entries(lines)) {
        const dir = doc.slice(0, Math.max(0, doc.indexOf('/')));
        const own = fences[dir] ?? fences[keys.find((k) => dir.startsWith(k + '-')) ?? ''];
        if (null == own)
            continue;
        let open = false;
        for (const { text, chain } of docLines) {
            const m = /^\s*```\s*(\S*)\s*$/.exec(text);
            if (null == m)
                continue;
            if (!open && own !== m[1] && !NEUTRAL_FENCES.has(m[1])) {
                out.push({ relation: 'fence', chain, cause: m[1], doc, line: text });
            }
            open = !open;
        }
    }
    return out;
}
// A line naming something the run removed; each mention is its cause.
function offFindings(lines, mentions) {
    const out = [];
    if (0 === mentions.length)
        return out;
    for (const [doc, docLines] of Object.entries(lines)) {
        for (const { text, chain } of docLines) {
            const hit = mentions.find(([, re]) => re.test(text));
            if (null != hit) {
                out.push({ relation: 'off', chain, cause: hit[0], doc, line: text });
            }
        }
    }
    return out;
}
// The text guard over one generation: the Markdown in `files`, read for links
// and `cd`s that resolve to nothing written, unfired `$$path$$` markers, code
// blocks in another target's language, and lines naming an `absent` word.
function textGuard(files, opts = {}) {
    const lines = docLines(files);
    const present = new Set([...Object.keys(files), ...(opts.present ?? [])]);
    const absent = (opts.absent ?? []).map((w) => 'string' === typeof w ? [w, mention(w)] : [w.source, new RegExp(w.source, w.flags.replace(/[gy]/g, ''))]);
    return [
        ...linkFindings(lines, files, present),
        ...markerFindings(lines),
        ...fenceFindings(lines, { ...FENCES, ...(opts.fences ?? {}) }),
        ...offFindings(lines, absent),
    ].map(({ relation, doc, line, cause }) => ({ relation, doc, line, cause }));
}
//# sourceMappingURL=textguard.js.map