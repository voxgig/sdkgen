"use strict";
// Replacement keys the GENERATOR owns, merged into the project's `ctx$.stdrep`.
//
// `stdrep` itself is built by the consumer's `Root.ts`
// (`names(ctx$.stdrep, model.Name, 'ProjectName')`), which lives outside this
// package and is frozen at project-init time — so a new placeholder cannot be
// added there without every existing project resyncing its root wiring. These
// are added here instead, immediately before the templates that use them are
// copied, so an old project gets them without touching its scaffold.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureStdrep = ensureStdrep;
exports.templateReplacements = templateReplacements;
const packageMeta_1 = require("./packageMeta");
// PROJECTENV — the env-var base for this SDK's `<BASE>_TEST_LIVE`,
// `<BASE>_APIKEY` and friends.
//
// NOT `PROJECTNAME`. That one is the camel-cased class name uppercased, which
// SWALLOWS a hyphen: `voxgig-solardemo` becomes `VOXGIGSOLARDEMO`, while every
// component-generated env var reads `VOXGIG_SOLARDEMO`. Both spellings used to
// reach the same generated SDK — `test/utility.ts` (a template) read one and
// `PlanetEntity.test.ts` (a component) the other — so setting either variable
// sent half the suite live and left the rest mocked, green either way.
function ensureStdrep(ctx$) {
    const stdrep = ctx$.stdrep = (ctx$.stdrep || {});
    if (null == stdrep.PROJECTENV) {
        stdrep.PROJECTENV = (0, packageMeta_1.envName)(ctx$.model);
    }
    return stdrep;
}
// The substitutions `target add` applies when it copies a target's TEMPLATE
// tree (tm/<t>).
//
// ONE definition, because two consumers must agree exactly: `target add`
// writes the files, and `doctor` re-applies these to the scaffold before
// comparing, to tell a substitution artefact from a real hand-edit. When
// PROJECTVERSION was added to the writer alone, every project's VERSION file
// immediately read as an edited master.
function templateReplacements(model, tname) {
    return {
        ProjectName: model?.const?.Name,
        // The port's release version, read by its Makefile to build the
        // `<target>/v<version>` tag. It comes from the same model field the
        // generated manifest uses, so the tag and the package cannot disagree.
        PROJECTVERSION: (0, packageMeta_1.packageVersion)(model, tname),
    };
}
//# sourceMappingURL=stdrep.js.map