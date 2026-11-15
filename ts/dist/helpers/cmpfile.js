"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPILED_EXTS = exports.CMP_DIST = exports.CMP_SRC = void 0;
exports.componentModule = componentModule;
exports.componentSource = componentSource;
exports.parseComponent = parseComponent;
exports.compiledStem = compiledStem;
exports.compiledFiles = compiledFiles;
exports.sourceStem = sourceStem;
exports.aliasCmpName = aliasCmpName;
exports.aliasCmpText = aliasCmpText;
const utility_1 = require("../utility");
// A per-target component: `.sdk/src/cmp/<t>/<Name>_<t>.ts`, compiled by the
// project to `.sdk/dist/cmp/<t>/<Name>_<t>.js`, which the loader requires.
const CMP_SRC = 'src/cmp/';
exports.CMP_SRC = CMP_SRC;
const CMP_DIST = 'dist/cmp/';
exports.CMP_DIST = CMP_DIST;
// What `tsc` writes beside each compiled module.
const COMPILED_EXTS = ['.js', '.js.map', '.d.ts', '.d.ts.map'];
exports.COMPILED_EXTS = COMPILED_EXTS;
const COMPONENT_RE = /^src\/cmp\/([^/]+)\/([A-Za-z]+)_\1\.ts$/;
function componentModule(target, name) {
    return './cmp/' + target + '/' + name + '_' + target;
}
function componentSource(target, name) {
    return CMP_SRC + target + '/' + name + '_' + target + '.ts';
}
function parseComponent(rel) {
    const m = rel.match(COMPONENT_RE);
    return null == m ? undefined : { target: m[1], name: m[2] };
}
// `src/cmp/<t>/X.ts` -> `dist/cmp/<t>/X`, relative to `.sdk`.
function compiledStem(rel) {
    return CMP_DIST + rel.slice(CMP_SRC.length).replace(/\.ts$/, '');
}
function compiledFiles(rel) {
    const stem = compiledStem(rel);
    return COMPILED_EXTS.map((ext) => stem + ext);
}
// `dist/cmp/<t>/X.js` -> `src/cmp/<t>/X`, without an extension: the source
// may be `.ts` or `.js`.
function sourceStem(distRel) {
    return CMP_SRC + distRel.slice(CMP_DIST.length).replace(/\.js$/, '');
}
function aliasCmpName(name, torigname, tname) {
    return name.replace(new RegExp('_' + (0, utility_1.escapeRe)(torigname) + '(\\.[^.]+)$'), '_' + tname + '$1');
}
function aliasCmpText(src, torigname, tname, cmpbase = CMP_SRC) {
    const orig = (0, utility_1.escapeRe)(torigname);
    return src
        // The fragment directory, read relative to __dirname. The fragments are
        // copied into the ALIAS's folder, so leaving the origin path would miss —
        // or, if the origin target is also installed, silently read ITS fragments.
        .replace(new RegExp((0, utility_1.escapeRe)(cmpbase) + orig + '/', 'g'), cmpbase + tname + '/')
        // Sibling imports: `'./Package_go'` -> `'./Package_go2'`. Anchored on the
        // closing quote (captured, so the style is preserved) to keep it off file
        // EXTENSIONS — `Main.fragment.go` must not become `Main.fragment.go2`.
        .replace(new RegExp('_' + orig + '([\'"])', 'g'), '_' + tname + '$1');
}
//# sourceMappingURL=cmpfile.js.map