"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.action_edition = action_edition;
exports.edition_add = edition_add;
const kindCollection_1 = require("../helpers/kindCollection");
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const stdrep_1 = require("../helpers/stdrep");
const junk_1 = require("../helpers/junk");
const kind_1 = require("./kind");
const resolve_1 = require("./resolve");
const target_1 = require("./target");
const action_1 = require("./action");
// The PREFIX of a edition item's component tree (`src/cmp/edition/`), for the
// alias rewrite. Derived from the registry's declaration rather than written
// out a second time, so the two cannot disagree about where edition components
// live.
const NAME_MARK = '\u0001name\u0001';
function cmpBase() {
    const cmp = (0, kind_1.kindTrees)('edition', NAME_MARK)
        .find((t) => 'none' === t.replace);
    return null == cmp ? 'src/cmp/edition/' : cmp.path.split(NAME_MARK)[0];
}
const CMD_MAP = Object.assign(Object.create(null), {
    add: cmd_edition_add,
    remove: cmd_edition_remove,
});
async function action_edition(args, actx) {
    const cmdname = args[1];
    const cmd = CMD_MAP[cmdname];
    if (null == cmd) {
        throw new utility_1.SdkGenError('Unknown edition cmd: ' + cmdname + ' (expected: ' +
            Object.keys(CMD_MAP).sort().join(', ') + ')');
    }
    return await cmd(args, actx);
}
async function cmd_edition_add(args, actx) {
    return edition_add((0, action_1.parseAddNames)(args), actx);
}
async function cmd_edition_remove(args, actx) {
    return require('./remove').kind_remove('edition', (0, action_1.parseAddNames)(args), actx);
}
async function edition_add(edition, actx) {
    edition = edition.map(ref => !ref.includes('/') && !ref.includes('\\') &&
        !(0, kindCollection_1.kindCollection)(actx.model, 'edition')[ref.split('~')[0]] ? '@voxgig/docgen/project/' + ref : ref);
    const jostraca = actx.jostraca;
    const opts = {
        fs: actx.fs,
        folder: actx.folder,
        log: actx.log.child({ cmp: 'jostraca' }),
        meta: {
            url: actx.url,
            content: (0, action_1.loadContent)(actx, 'edition', { edition: '# Docs\n' }),
        },
        model: actx.model,
        control: {
            dryrun: !!actx.opts.dryrun
        },
        cmp: (0, junk_1.copyOpts)(),
    };
    opts.log.info({
        point: 'edition-start',
        note: (actx.opts.dryrun ? '** DRY RUN **' : '')
    });
    preflight(edition, actx);
    (0, action_1.ensureModelInclude)(actx, 'edition');
    // Later items in the command read this in-memory registration.
    (0, resolve_1.registerInstalled)('edition', edition, actx);
    const jres = await jostraca.generate(opts, () => EditionRoot({ edition, actx }));
    return { jres };
}
function preflight(edition, actx) {
    const fs = actx.fs();
    for (const ref of edition) {
        const source = (0, kind_1.resolveKind)(ref, 'edition', actx);
        for (const tree of (0, kind_1.kindTrees)('edition', source.origname)) {
            if (!tree.required) {
                continue;
            }
            const from = source.folder + '/' + tree.path;
            if (!fs.existsSync(from)) {
                throw new utility_1.SdkGenError('Docs ' + source.name + ': required tree not found: ' + from +
                    '\n  a edition item needs its components (' + tree.path +
                    '); nothing has been written');
            }
        }
    }
}
const EditionRoot = (0, jostraca_1.cmp)(function EditionRoot(props) {
    const { ctx$, edition } = props;
    const { log } = ctx$;
    (0, jostraca_1.Project)({}, () => {
        const dnames = [];
        (0, jostraca_1.each)(edition, (n) => {
            const dref = n.val$;
            log.info({ point: 'edition-build', edition: dref, note: dref });
            const source = (0, kind_1.resolveKind)(dref, 'edition', ctx$);
            dnames.push(source.name);
            log.info({
                point: 'edition-name', edition: source.name, folder: source.folder, ref: dref,
                note: source.name +
                    (source.name !== source.origname ?
                        ' (from ' + source.origname + ')' : '') +
                    ' from:' + source.folder
            });
            (0, jostraca_1.Folder)({ name: 'model/edition' }, () => (0, kind_1.kindModel)({
                ctx$, kind: 'edition', source, names: dnames,
                content: ctx$.meta.content.edition_index,
            }));
            // Both ends of every tree come from the registry's ONE declaration,
            // resolved twice: the source carries the ORIGIN name, the destination
            // the installed one. Deriving the source path by substituting inside
            // the destination path would corrupt any item whose name also appears
            // in the fixed part of the path.
            const dest = (0, kind_1.kindTrees)('edition', source.name);
            const from = (0, kind_1.kindTrees)('edition', source.origname);
            dest.forEach((tree, i) => {
                if ('template' === tree.replace) {
                    (0, target_1.pruneStaleTemplates)(ctx$, source.folder + '/' + from[i].path, tree.path, [], !!props.actx?.opts?.dryrun);
                }
                copyTree(ctx$, source, tree, from[i].path);
            });
            log.info({ point: 'edition-done', edition: source.name, note: source.name });
        });
        if (0 < dnames.length) {
            (0, jostraca_1.Folder)({ name: 'model/edition' }, () => (0, kind_1.kindIndex)({
                kind: 'edition', names: dnames,
                content: ctx$.meta.content.edition_index,
            }));
        }
    });
});
// One tree, copied from the origin path to the installed one.
//
// An optional tree the source does not ship is simply not copied — that is
// what `required: false` means, and a edition item whose every byte is generated
// legitimately has no template tree.
function copyTree(ctx$, source, tree, frompath) {
    const fs = ctx$.fs();
    const from = source.folder + '/' + frompath;
    if (!fs.existsSync(from)) {
        if (tree.required) {
            throw new utility_1.SdkGenError('Docs ' + source.name + ': required tree not found: ' + from);
        }
        ctx$.log.info({
            point: 'edition-tree-absent', edition: source.name, tree: tree.path, from,
            note: source.name + ': the source ships no ' + frompath +
                ', nothing to copy'
        });
        return;
    }
    if (source.name !== source.origname && 'none' === tree.replace) {
        (0, target_1.aliasCmpTree)(ctx$, from, tree.path, source.origname, source.name, cmpBase());
        return;
    }
    (0, jostraca_1.Folder)({ name: tree.path }, () => {
        (0, jostraca_1.Copy)({
            from,
            ...('template' === tree.replace ?
                { replace: (0, stdrep_1.templateReplacements)(ctx$.model, source.name) } : {}),
        });
    });
}
//# sourceMappingURL=edition.js.map