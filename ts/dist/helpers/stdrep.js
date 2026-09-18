"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureStdrep = ensureStdrep;
exports.templateReplacements = templateReplacements;
exports.provenanceReplace = provenanceReplace;
const packageMeta_1 = require("./packageMeta");
function ensureStdrep(ctx$) {
    const stdrep = ctx$.stdrep = (ctx$.stdrep || {});
    if (null == stdrep.PROJECTENV) {
        stdrep.PROJECTENV = (0, packageMeta_1.envName)(ctx$.model);
    }
    return stdrep;
}
function templateReplacements(model, tname) {
    return {
        ProjectName: model?.const?.Name,
        // The port's release version, read by its Makefile to build the
        // `<target>/v<version>` tag. It comes from the same model field the
        // generated manifest uses, so the tag and the package cannot disagree.
        PROJECTVERSION: (0, packageMeta_1.packageVersion)(model, tname),
    };
}
const PROVENANCE_INDENT = '  ';
// A value as a single-quoted aontu string. These are PATHS and NAMES from the
// filesystem, so they can legally contain a quote — `/home/o'connor/pkg` is a
// valid directory — and concatenating one between quotes closes the string
// early and leaves the copied model unparsable. Aontu accepts a backslash
// escape, which keeps the quoting style every shipped model already uses.
function aontuString(value) {
    return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}
function provenanceReplace(prov) {
    const lines = ['base: ' + aontuString(prov.base)];
    if (null != prov.origname && null != prov.name &&
        prov.origname !== prov.name) {
        lines.push('origname: ' + aontuString(prov.origname));
    }
    if (null != prov.package && '' !== prov.package) {
        lines.push('package: ' + aontuString(prov.package));
    }
    return { "base: 'BASE'": lines.join('\n' + PROVENANCE_INDENT) };
}
//# sourceMappingURL=stdrep.js.map