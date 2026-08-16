"use strict";
// GENERATING A DOCS ITEM. See docs/design/sdkgen-packages.md §20.3.
//
// A docs item is dispatched by the same convention a target is —
// `cmp/docs/<n>/Main_<n>` — so an item's package supplies the emitter and
// sdkgen supplies only the call.
//
// WHY THIS IS NOT RENDERED BY THE CONSUMER'S Root.ts
//
// A project's `Root.ts` is written once, by create-sdkgen, and is never
// touched again (doctor has an `unwired` category precisely because of it).
// So a kind introduced later can reach generation in one of two ways: every
// existing project edits its Root, or sdkgen runs the kind's own pass. The
// second is what happens here — `docs add` in a project scaffolded years ago
// generates with no scaffold change at all, which is the whole point of
// putting the destinations in packages.
//
// The cost is honest and small: a second `generate()` call over the same
// root, so the changes report arrives in two parts.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocsItem = exports.Docs = void 0;
exports.prepareModel = prepareModel;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const stdrep_1 = require("../helpers/stdrep");
const types_1 = require("../types");
// The model preamble every pass performs before rendering: the case-variant
// name constants (`Name`, `NAME`, …) and the ProjectName replacement map that
// template substitution reads.
//
// Done HERE rather than relied upon, because a docs pass does NOT go through
// the consumer's Root — nothing else has set `ctx$.model`, and when there are
// out-of-tree items the Root was handed a FILTERED COPY, so the preamble it
// performed did not touch this object at all.
function prepareModel(model, ctx$) {
    ctx$.model = model;
    model.const = model.const || { name: model.name };
    (0, jostraca_1.names)(model.const, model.name);
    if (null == model.const.year) {
        model.const.year = new Date().getFullYear();
    }
    (0, jostraca_1.names)(model, model.name);
    ctx$.stdrep = ctx$.stdrep || {};
    (0, jostraca_1.names)(ctx$.stdrep, model.Name, 'Project' + 'Name');
}
// One item: its emitter, called with the item and the shared replace map.
//
// No Folder here — WHERE it lands is the caller's business, because that is
// exactly what differs between the two passes: in-tree the item owns
// `<sdk-repo>/<name>/`, out-of-tree the destination IS the item's root.
const DocsItem = (0, jostraca_1.cmp)(function DocsItem(props) {
    const { item, ctx$ } = props;
    const log = ctx$.log;
    const model = props.model ?? ctx$.model;
    const stdrep = (0, stdrep_1.ensureStdrep)(ctx$);
    const Main_docs = (0, utility_1.requirePath)(ctx$, `cmp/docs/${item.name}/Main_${item.name}`);
    Main_docs['Main']({ model, docs: item, stdrep });
    log.info({
        point: 'generate-docs', docs: item.name, note: 'docs:' + item.name
    });
});
exports.DocsItem = DocsItem;
// Every IN-TREE docs item, each in its own folder.
//
// Items with `output: path` are excluded: they get their own pass rooted at
// that path, and rendering them here as well would ALSO write them into
// `<sdk-repo>/<name>/` — the same reason `withoutExternal` exists for
// targets.
const Docs = (0, jostraca_1.cmp)(function Docs(props) {
    const { ctx$ } = props;
    const model = props.model ?? ctx$.model;
    prepareModel(model, ctx$);
    const items = model?.main?.[types_1.KIT]?.docs ?? {};
    (0, jostraca_1.each)(items, (item) => {
        if (false === item.active) {
            return;
        }
        const path = item.output?.path;
        if (null != path && '' !== path) {
            return;
        }
        (0, jostraca_1.names)(item, item.name);
        (0, jostraca_1.Folder)({ name: item.name }, () => DocsItem({ item }));
    });
});
exports.Docs = Docs;
//# sourceMappingURL=Docs.js.map