"use strict";
// The Root for a DOCS item that generates outside the SDK repo
// (`main: kit: docs: <n>: output: path`).
//
// Out of tree is the NORMAL case for a docs item, not the exception it is for
// a target: a documentation site usually has its own repo, and in-tree it
// would collide with the SDK repo's own README and CI workflows.
//
// The two facts that make this a separate `generate()` pass rather than a
// folder are the ones `ExternalTarget` documents at length: jostraca's
// `FileHandler.validName` refuses a `..` segment in a folder name (the guard
// that keeps generation inside the tree it was pointed at, not an oversight
// to route around), and the output root is `jopts.folder` PER CALL — so
// writing somewhere else means another call.
//
// No Folder wraps the item: the destination IS the site, so its files go at
// the root of the output path.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalDocs = void 0;
const jostraca_1 = require("jostraca");
const Docs_1 = require("./Docs");
const ExternalDocs = (0, jostraca_1.cmp)(function ExternalDocs(props) {
    const { model, item, cmpfolder, sdkrelpath } = props;
    const ctx$ = props.ctx$;
    // Components live in the PROJECT, not in the repo being written to. This
    // pass has retargeted jostraca's output folder, which is what requirePath
    // otherwise resolves against — see utility.resolvePath. Losing this line
    // makes the pass look for components under the DESTINATION.
    ctx$.cmpfolder = cmpfolder;
    // The path from the destination back to the SDK project, for a site that
    // sits beside the SDK in a known layout and needs to name it.
    ctx$.sdkrelpath = sdkrelpath;
    // The same preamble the in-tree pass performs — one definition, both
    // callers, because a project whose ONLY docs item is out of tree must
    // generate exactly as one with both.
    (0, Docs_1.prepareModel)(model, ctx$);
    (0, jostraca_1.Project)({}, () => {
        (0, jostraca_1.names)(item, item.name ?? item.key$);
        (0, Docs_1.DocsItem)({ item });
    });
});
exports.ExternalDocs = ExternalDocs;
//# sourceMappingURL=ExternalDocs.js.map