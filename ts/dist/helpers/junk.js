"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILD = exports.NOISE = exports.JUNK = void 0;
exports.isJunk = isJunk;
exports.isNoise = isNoise;
exports.copyOpts = copyOpts;
const NOISE = [
    /~$/,
    /^\.#/,
    /^#.*#$/,
    /\.sw[a-p]$/,
    /\.(bak|orig|rej)$/,
    /^\.DS_Store$/,
    /^__MACOSX$/,
    /^Thumbs\.db$/i,
    /^desktop\.ini$/i,
    // Version control. A nested checkout inside a template tree is never the
    // payload, and copying one produces a project git cannot make sense of.
    /^\.git$/,
    /^\.svn$/,
    /^\.hg$/,
    /^\.idea$/,
];
exports.NOISE = NOISE;
const BUILD = [
    /^node_modules$/,
    /^__pycache__$/,
    /\.py[co]$/,
    /^\.(pytest|mypy|ruff)_cache$/,
    /^\.tox$/,
    /^\.venv$/,
    /^\.gradle$/,
    /\.class$/,
    /^\.dart_tool$/,
    /^\.?zig-cache$/,
    /^zig-out$/,
    /^_build$/,
    /^\.elixir_ls$/,
    /^\.cpcache$/,
    /^\.stack-work$/,
    /^dist-newstyle$/,
    /^\.cargo$/,
];
exports.BUILD = BUILD;
const JUNK = [...NOISE, ...BUILD];
exports.JUNK = JUNK;
function isJunk(name) {
    return matches(name, JUNK);
}
function isNoise(name) {
    return matches(name, NOISE);
}
function matches(name, patterns) {
    for (const re of patterns) {
        // These are module-level regexes reused across every entry of every tree.
        // None carries `g` or `y` today, but a `test` on a stateful regex resumes
        // from the previous match and would skip every other file — the exact bug
        // jostraca's own `excluded()` carries a comment about.
        re.lastIndex = 0;
        if (re.test(name)) {
            return true;
        }
    }
    return false;
}
function copyOpts() {
    return {
        Copy: {
            ignore: [/~$/, ...JUNK]
        }
    };
}
//# sourceMappingURL=junk.js.map