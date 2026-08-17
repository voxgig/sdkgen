"use strict";
// `docs add <ref>` — the third kind. See docs/design/sdkgen-packages.md §20.
//
// WHAT A DOCS ITEM IS
//
// A generation target whose destination is a DOCUMENTATION SYSTEM rather than
// a language: a static site, a developer-portal catalogue, a hosted service's
// config. sdkgen ships the kind and no items; the items live in packages
// (`@voxgig/docgen` first), which is what makes the destinations someone
// else's business rather than a list this repo has to guess at.
//
// WHY IT IS NOT A TARGET
//
// Three reasons, argued in §20.2 and worth restating where the code is:
//
//   - a docs item's INPUT is the target collection — a page per SDK, the
//     package table, per-language tabs — so a docs item inside
//     `main.kit.target` would enumerate itself;
//   - `action/feature.ts` fans out with `each(target, …)` and warns
//     `feature-source-missing` per target with no source, so a docs item in
//     that collection would collect one warning per feature, forever
//     (`srcfeature: false` does not help — that flag is read at generate time
//     and never by the add-time fan-out);
//   - `ext`, `comment: line` and `module: name` are required, non-defaulted
//     strings in the target spread, and a site emitting `.md`, `.yml`, `.css`
//     and `.svg` at once has no honest value for `comment.line`.
//
// WHAT THIS ACTION DOES, AND WHAT IT DELIBERATELY DOES NOT
//
// It installs the definition — through the shared spine, so provenance,
// aliasing and the index come along unchanged — and the kind's trees, whose
// paths come from the registry rather than being spelled here.
//
// It does NOT fan out over targets, trim, or prune. A docs item reads the
// target collection at GENERATE time, not at add time: the opposite direction
// and the opposite moment from a feature's fan-out, so sharing that machinery
// would have been a false economy.
Object.defineProperty(exports, "__esModule", { value: true });
exports.action_docs = action_docs;
exports.docs_add = docs_add;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const stdrep_1 = require("../helpers/stdrep");
const junk_1 = require("../helpers/junk");
const kind_1 = require("./kind");
const resolve_1 = require("./resolve");
const target_1 = require("./target");
const action_1 = require("./action");
// The PREFIX of a docs item's component tree (`src/cmp/docs/`), for the
// alias rewrite. Derived from the registry's declaration rather than written
// out a second time, so the two cannot disagree about where docs components
// live.
const NAME_MARK = '\u0001name\u0001';
function cmpBase() {
    const cmp = (0, kind_1.kindTrees)('docs', NAME_MARK)
        .find((t) => 'none' === t.replace);
    return null == cmp ? 'src/cmp/docs/' : cmp.path.split(NAME_MARK)[0];
}
const CMD_MAP = Object.assign(Object.create(null), {
    add: cmd_docs_add,
});
async function action_docs(args, actx) {
    const cmdname = args[1];
    const cmd = CMD_MAP[cmdname];
    if (null == cmd) {
        throw new utility_1.SdkGenError('Unknown docs cmd: ' + cmdname + ' (expected: ' +
            Object.keys(CMD_MAP).sort().join(', ') + ')');
    }
    return await cmd(args, actx);
}
async function cmd_docs_add(args, actx) {
    return docs_add((0, action_1.parseAddNames)(args), actx);
}
// Code API.
async function docs_add(docs, actx) {
    const jostraca = actx.jostraca;
    const opts = {
        fs: actx.fs,
        folder: actx.folder,
        log: actx.log.child({ cmp: 'jostraca' }),
        meta: {
            url: actx.url,
            // Seeded: no project scaffolded before the docs kind existed has a
            // docs index, and every project alive today is in that position.
            content: (0, action_1.loadContent)(actx, 'docs', { docs: '# Docs\n' }),
        },
        model: actx.model,
        // Per-call, never left to the Jostraca instance: `generate` runs its own
        // options through OptionsShape first, which fills `control.dryrun: false`
        // and would override the instance flag. The same trap target_add
        // documents.
        control: {
            dryrun: !!actx.opts.dryrun
        },
        // Per-call for the same reason, and covering the same accident: see
        // helpers/junk.
        cmp: (0, junk_1.copyOpts)(),
    };
    opts.log.info({
        point: 'docs-start',
        note: (actx.opts.dryrun ? '** DRY RUN **' : '')
    });
    // PREFLIGHT, before a single file is written.
    //
    // The write pass emits the definition and its index entry before it copies
    // the trees, so a ref whose definition exists but whose required components
    // do not left the command failed AND the project carrying a docs item with
    // no implementation — which the next model compile then reads as real.
    // `package add` already validates a whole package up front for exactly this
    // reason; a direct `docs add` needs the same guarantee.
    preflight(docs, actx);
    // The project's own model must INCLUDE the docs index, or everything below
    // is invisible: no project scaffolded before this kind existed includes it,
    // and `main.kit.docs` would simply be absent from the next compile.
    (0, action_1.ensureModelInclude)(actx, 'docs');
    // Into the IN-MEMORY model before anything reads it. Nothing recompiles
    // `model/sdk.aontu` mid-process, so without this a second docs item in the
    // same command — and anything else later in it — behaves as if the first
    // was never installed. One definition of what gets recorded, shared with
    // `target add` and `package add`.
    (0, resolve_1.registerInstalled)('docs', docs, actx);
    const jres = await jostraca.generate(opts, () => DocsRoot({ docs, actx }));
    return { jres };
}
// Resolve every ref and check every REQUIRED tree, throwing before anything
// is written. Resolution itself is the other half: a ref that names no
// definition fails here rather than partway through the pass.
function preflight(docs, actx) {
    const fs = actx.fs();
    for (const ref of docs) {
        const source = (0, kind_1.resolveKind)(ref, 'docs', actx);
        for (const tree of (0, kind_1.kindTrees)('docs', source.origname)) {
            if (!tree.required) {
                continue;
            }
            const from = source.folder + '/' + tree.path;
            if (!fs.existsSync(from)) {
                throw new utility_1.SdkGenError('Docs ' + source.name + ': required tree not found: ' + from +
                    '\n  a docs item needs its components (' + tree.path +
                    '); nothing has been written');
            }
        }
    }
}
const DocsRoot = (0, jostraca_1.cmp)(function DocsRoot(props) {
    const { ctx$, docs } = props;
    const { log } = ctx$;
    (0, jostraca_1.Project)({}, () => {
        // Every installed name seen so far in this run: the index File is
        // re-rendered per item and the last render wins, so each render has to
        // carry all of them.
        const dnames = [];
        (0, jostraca_1.each)(docs, (n) => {
            const dref = n.val$;
            log.info({ point: 'docs-build', docs: dref, note: dref });
            // The shared spine: a BARE name resolves against what the model
            // RECORDS, so a docs item installed from a package resolves back to
            // that package on its next add rather than to the bundled scaffold.
            const source = (0, kind_1.resolveKind)(dref, 'docs', ctx$);
            dnames.push(source.name);
            log.info({
                point: 'docs-name', docs: source.name, folder: source.folder, ref: dref,
                note: source.name +
                    (source.name !== source.origname ?
                        ' (from ' + source.origname + ')' : '') +
                    ' from:' + source.folder
            });
            (0, jostraca_1.Folder)({ name: 'model/docs' }, () => (0, kind_1.kindModel)({
                ctx$, kind: 'docs', source, names: dnames,
                content: ctx$.meta.content.docs_index,
            }));
            // Both ends of every tree come from the registry's ONE declaration,
            // resolved twice: the source carries the ORIGIN name, the destination
            // the installed one. Deriving the source path by substituting inside
            // the destination path would corrupt any item whose name also appears
            // in the fixed part of the path.
            const dest = (0, kind_1.kindTrees)('docs', source.name);
            const from = (0, kind_1.kindTrees)('docs', source.origname);
            dest.forEach((tree, i) => {
                // Copy only ADDS and overwrites. A newer version of the package that
                // RETIRED a template would leave the old one behind, generating from
                // it forever — the failure `pruneStaleTemplates` exists for, and the
                // reason 30 repos once carried a superseded harness file.
                //
                // Templates only, exactly as `target add` prunes only `tm`: extra
                // files under a component tree are the project's own (doctor calls
                // them `additive`, and adding a component is the supported way to
                // extend an item), so pruning there would delete supported work.
                if ('template' === tree.replace) {
                    (0, target_1.pruneStaleTemplates)(ctx$, source.folder + '/' + from[i].path, tree.path, [], !!props.actx?.opts?.dryrun);
                }
                copyTree(ctx$, source, tree, from[i].path);
            });
            log.info({ point: 'docs-done', docs: source.name, note: source.name });
        });
    });
});
// One tree, copied from the origin path to the installed one.
//
// An optional tree the source does not ship is simply not copied — that is
// what `required: false` means, and a docs item whose every byte is generated
// legitimately has no template tree.
function copyTree(ctx$, source, tree, frompath) {
    const fs = ctx$.fs();
    const from = source.folder + '/' + frompath;
    if (!fs.existsSync(from)) {
        if (tree.required) {
            throw new utility_1.SdkGenError('Docs ' + source.name + ': required tree not found: ' + from);
        }
        ctx$.log.info({
            point: 'docs-tree-absent', docs: source.name, tree: tree.path, from,
            note: source.name + ': the source ships no ' + frompath +
                ', nothing to copy'
        });
        return;
    }
    // An ALIASED component tree cannot be copied verbatim: components are
    // dispatched by the convention `cmp/docs/<n>/Main_<n>`, so files keeping
    // the origin suffix resolve nothing — `Main_apidocs.ts` is invisible to a
    // lookup for `Main_portal`. Same rule as a target's, so the same function
    // does it; jostraca's tree Copy has no per-entry rename hook, which is why
    // an aliased tree is emitted file by file.
    if (source.name !== source.origname && 'none' === tree.replace) {
        (0, target_1.aliasCmpTree)(ctx$, from, tree.path, source.origname, source.name, cmpBase());
        return;
    }
    (0, jostraca_1.Folder)({ name: tree.path }, () => {
        (0, jostraca_1.Copy)({
            from,
            // Shared with doctor, which re-applies them before comparing.
            ...('template' === tree.replace ?
                { replace: (0, stdrep_1.templateReplacements)(ctx$.model, source.name) } : {}),
        });
    });
}
//# sourceMappingURL=docs.js.map