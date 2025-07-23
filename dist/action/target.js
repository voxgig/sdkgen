"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.action_target = action_target;
exports.target_add = target_add;
const node_path_1 = __importDefault(require("node:path"));
const jostraca_1 = require("jostraca");
const struct_1 = require("@voxgig/struct");
const utility_1 = require("../utility");
const action_1 = require("./action");
const CMD_MAP = {
    add: cmd_target_add
};
async function action_target(args, actx) {
    const cmdname = args[1];
    const cmd = CMD_MAP[cmdname];
    if (null == cmd) {
        throw new utility_1.SdkGenError('Unknown target cmd: ' + cmdname);
    }
    return await cmd(args, actx);
}
async function cmd_target_add(args, actx) {
    const targets_arg = args[2];
    const targets = 'string' === typeof targets_arg ? targets_arg.split(',') : targets_arg;
    return target_add(targets, actx);
}
// Code API
async function target_add(targets, actx) {
    // const jostraca = Jostraca()
    const jostraca = actx.jostraca;
    const opts = {
        fs: actx.fs,
        folder: actx.folder,
        log: actx.log.child({ cmp: 'jostraca' }),
        meta: {
            model: actx.model,
            tree: actx.tree,
            content: (0, action_1.loadContent)(actx, 'target')
        },
        model: actx.model,
    };
    const jres = await jostraca.generate(opts, () => TargetRoot({ targets, actx }));
    console.log('JRES', jres);
    console.dir(jres.audit().filter((n) => n[1].path.includes('LICENSE')), { depth: null });
    for (let file of jres.files.merged) {
        opts.log.info({ point: 'target', file, merge: true, note: 'modified: ' + file });
    }
    for (let file of jres.files.conflicted) {
        opts.log.info({ point: 'target', file, conflict: true, note: '** CONFLICT: ' + file });
    }
    // const features = Object.keys(actx.model.main.sdk.feature)
    // feature_add(features, actx)
    return {
        jres
    };
}
const TargetRoot = (0, jostraca_1.cmp)(function TargetRoot(props) {
    const { ctx$, targets, actx } = props;
    const { model, log } = ctx$;
    // TODO: jostraca - make from value easier to specify 
    // const tfolder = 'node_modules/@voxgig/sdkgen/project/.sdk'
    (0, jostraca_1.Project)({}, () => {
        (0, jostraca_1.each)(targets, (n) => {
            const tref = n.val$;
            log.info({
                point: 'target-start',
                target: tref,
                note: tref + (actx.opts.dryrun ? ' ** DRY RUN **' : '')
            });
            const { tname, tfolder, torigname, base } = resolveTarget(tref, ctx$);
            log.info({
                point: 'target-name', name: tname, folder: tfolder,
                note: tname + (tname != torigname ? 'original' + torigname : '') + ' from:' + tfolder
            });
            // TODO: validate target name is a-z0-9-_. only
            // const tname = tref
            (0, jostraca_1.Folder)({ name: 'model/target' }, () => {
                (0, jostraca_1.Copy)({
                    from: tfolder + '/model/target/' + torigname + '.jsonic',
                    // exclude: true
                    replace: {
                        "'BASE'": "'" + base + "'"
                    }
                });
                (0, jostraca_1.File)({ name: 'target-index.jsonic' }, () => (0, action_1.UpdateIndex)({
                    content: ctx$.meta.content.target_index,
                    // names: targets,
                    names: [tname]
                }));
            });
            (0, jostraca_1.Folder)({ name: 'src/cmp/' + tname }, () => {
                (0, jostraca_1.Copy)({
                    from: tfolder + '/src/cmp/' + torigname,
                    // exclude: true
                });
            });
            (0, jostraca_1.Folder)({ name: 'tm/' + tname }, () => {
                (0, jostraca_1.Copy)({
                    from: tfolder + '/tm/' + torigname,
                    exclude: [/src\/feature/],
                    replace: {
                        // TODO: standard replacements
                        ProjectName: model.const.Name,
                    }
                });
                (0, jostraca_1.Folder)({ name: 'src/feature' }, () => {
                    (0, jostraca_1.Copy)({ from: tfolder + '/tm/' + torigname + '/src/feature/README.md' });
                    (0, jostraca_1.Folder)({ name: 'base' }, () => {
                        (0, jostraca_1.Copy)({ from: tfolder + '/tm/' + torigname + '/src/feature/base' });
                    });
                });
            });
            log.info({
                point: 'target-end', target: tref, note: tname +
                    (tname != tref ? ' ref:' + tref : '')
            });
        });
    });
});
function resolveTarget(tref, ctx$) {
    let tname = tref;
    let torigname = tref;
    let tfolder = 'node_modules/@voxgig/sdkgen/project/.sdk';
    const root = ctx$.folder;
    const fs = ctx$.fs();
    let fulltfolder = node_path_1.default.normalize(node_path_1.default.join(root, tfolder));
    tname = (0, struct_1.getelem)(tref.split('/'), -1);
    let aliasref = tref;
    torigname = (0, struct_1.getelem)(aliasref.split('/'), -1);
    const aliasing = tref.split('~');
    if (1 < aliasing.length) {
        aliasref = aliasing[0];
        tname = aliasing.slice(1).join('~');
        torigname = (0, struct_1.getelem)(aliasref.split('/'), -1);
    }
    const search = [];
    let found = false;
    if (aliasref.includes('/')) {
        // NOTE: the last path element of the ref is the target name, not a folder.
        const aliasbase = node_path_1.default.dirname(aliasref);
        if (!aliasref.startsWith('/')) {
            fulltfolder = node_path_1.default.normalize(node_path_1.default.join(root, 'node_modules', aliasbase, '.sdk'));
            search.push(fulltfolder);
            found = fs.existsSync(fulltfolder);
            if (!found) {
                fulltfolder = node_path_1.default.normalize(node_path_1.default.join(root, aliasbase, '.sdk'));
                search.push(fulltfolder);
                found = fs.existsSync(fulltfolder);
            }
        }
        else {
            fulltfolder = node_path_1.default.normalize(node_path_1.default.join(aliasbase, '.sdk'));
            search.push(fulltfolder);
            found = fs.existsSync(fulltfolder);
        }
    }
    else {
        search.push(fulltfolder);
        found = fs.existsSync(fulltfolder);
    }
    if (!found) {
        throw new Error('Target folder not found in:\n' + search.join('\n  '));
    }
    const rootslash = root.endsWith('/') ? root : root + '/';
    const out = {
        tname,
        tfolder: fulltfolder,
        torigname,
        base: fulltfolder.replace(rootslash, '')
    };
    return out;
}
//# sourceMappingURL=target.js.map