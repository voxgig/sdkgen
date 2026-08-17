"use strict";
// WHAT NEVER COUNTS AS CONTENT.
//
// Every tree sdkgen reads — the scaffold's `tm/<lang>` and `src/cmp/<lang>`, an
// external package's `.sdk`, a project's own copies of both — is a DIRECTORY ON
// A DEVELOPER'S MACHINE, and a developer's machine drops things in directories:
// `.DS_Store` from the Finder, `__pycache__` from running a python module,
// `node_modules` from an `npm install` in the wrong shell, a `~` backup from an
// editor. None of it is authored, none of it is tracked (it is all gitignored),
// and all of it is invisible in `git status` — so the first thing that notices
// is whatever compares two trees.
//
// It bit as: a stray `tm/py/utility/__pycache__/make_options.cpython-314.pyc`,
// created in August by running that module in place, copied verbatim by
// `target add py` into the add output, and reported by the golden-manifest test
// as toolchain drift. The copy is the real problem — the test only saw it. Left
// alone, that `.pyc` ships into every consumer's SDK repo, compiled against
// whatever python the maintainer happened to have.
//
// The rule is one list, in one place, applied by everything that walks a tree:
// the WRITER (jostraca's Copy, through `cmp.Copy.ignore`, plus the two walks
// target-add does itself) and every READER that compares against what the
// writer produced (doctor's drift walk, the feature-source scan, the definition
// listing). A writer and a reader that disagree about what counts report the
// whole tree as a fork — the same discipline `templateReplacements` and
// `aliasCmpName` are held to, and for the same reason.
//
// MEMBERSHIP IS A PROMISE that no template will ever legitimately carry that
// name, so this list holds only what a TOOL creates and a person does not: no
// `build`, `dist`, `bin` or `out` (a template may well ship one), and
// emphatically no `target` — sdkgen's own model directory is called that, and
// it is also where cargo and maven put their output. `test/junk.test.ts` checks
// the list against every name in the shipped scaffold, so an over-broad pattern
// fails there rather than by silently dropping a file from someone's SDK.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILD = exports.NOISE = exports.JUNK = void 0;
exports.isJunk = isJunk;
exports.isNoise = isNoise;
exports.copyOpts = copyOpts;
// All of these are matched against the BARE NAME of a directory entry, not its
// path — the same way jostraca's `cmp.Copy.ignore` is applied, so that naming a
// directory prunes its whole subtree without every caller having to spell out
// what is inside it.
// Droppings that are not output of anything: an editor, the Finder, or a
// version control system left them, and they occupy no space in the meaning of
// the tree. Kept separate from BUILD because "would we copy this" and "is this
// directory empty" are different questions, and only this half answers both —
// a destination holding `node_modules` is not empty by any reading.
const NOISE = [
    // Editors and merges. `~` duplicates jostraca's built-in `IGNORED_RE`,
    // deliberately: that one governs its Copy walk alone, and the walks sdkgen
    // does itself (the prune, the feature scan) have to agree with it.
    /~$/, // editor backup
    /^\.#/, // emacs lock link
    /^#.*#$/, // emacs autosave
    /\.sw[a-p]$/, // vim swap
    /\.(bak|orig|rej)$/, // backups, and what a conflicted merge leaves behind
    // Operating systems.
    /^\.DS_Store$/,
    /^__MACOSX$/,
    /^Thumbs\.db$/i,
    /^desktop\.ini$/i,
    // Version control. A nested checkout inside a template tree is never the
    // payload, and copying one produces a project git cannot make sense of.
    /^\.git$/,
    /^\.svn$/,
    /^\.hg$/,
    /^\.idea$/, // not `.vscode` — an SDK may ship editor settings
];
exports.NOISE = NOISE;
// Toolchain output, per language. Each of these appears exactly when someone
// runs that language's tools inside a template tree, which is the normal way to
// check that a template actually works — and none of them is ever the payload.
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
    /^_build$/, // mix, dune
    /^\.elixir_ls$/,
    /^\.cpcache$/, // clojure
    /^\.stack-work$/,
    /^dist-newstyle$/, // cabal
    /^\.cargo$/,
];
exports.BUILD = BUILD;
const JUNK = [...NOISE, ...BUILD];
exports.JUNK = JUNK;
// Is this directory entry something no tree operation should see?
function isJunk(name) {
    return matches(name, JUNK);
}
// Weaker: does this entry leave a directory as good as empty? Toolchain output
// does NOT — it is junk to copy and content to find.
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
// The jostraca `cmp` option block, which is how the WRITER side of the rule is
// applied: jostraca tests `cmp.Copy.ignore` against the bare name of every
// entry it walks, directories included, and prunes what matches.
//
// Passed PER CALL by each action, not left to the Jostraca instance — the same
// discipline `control.dryrun` is held to, and for a related reason: the actions
// take whatever instance their caller hands them (`actx.jostraca`), and a
// consumer that builds its own would otherwise silently lose the filter. A
// per-call value is merged last and wins.
//
// `/~$/` is first, and must stay first while any supported jostraca is at or
// below 0.31.0. That merge takes this list over its own default of `[/~$/]`
// with `deep()`, which recursed INTO index 0 — two RegExps are both objects, so
// it iterated the incoming one's enumerable properties, of which a RegExp has
// none, and kept the default. Whatever sat at index 0 was silently discarded.
// Leading with the value already there makes that a no-op instead of a hole,
// and jostraca's built-in `IGNORED_RE` covers `~` anyway.
//
// FIXED UPSTREAM (jostraca `deep` now replaces a custom-constructor value
// rather than walking into it), so this is compatibility, not a live
// workaround: harmless on a fixed jostraca, load-bearing on an older one.
//
// A FRESH object each call: `deep` mutates its base, and jostraca's merge order
// leaves these values reachable from options it keeps.
function copyOpts() {
    return {
        Copy: {
            ignore: [/~$/, ...JUNK]
        }
    };
}
//# sourceMappingURL=junk.js.map