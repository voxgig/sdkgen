"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.action_target = action_target;
exports.target_add = target_add;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const feature_1 = require("./feature");
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
    const jostraca = (0, jostraca_1.Jostraca)();
    const opts = {
        fs: actx.fs,
        folder: actx.folder,
        log: actx.log.child({ cmp: 'jostraca' }),
        meta: {
            model: actx.model,
            tree: actx.tree,
            content: (0, action_1.loadContent)(actx, 'target')
        },
        model: actx.model
    };
    const jres = await jostraca.generate(opts, () => TargetRoot({ targets }));
    const features = Object.keys(actx.model.main.sdk.feature);
    (0, feature_1.feature_add)(features, actx);
    return {
        jres
    };
}
const TargetRoot = (0, jostraca_1.cmp)(function TargetRoot(props) {
    const { ctx$, targets } = props;
    const { model } = ctx$;
    // TODO: jostraca - make from value easier to specify 
    const sdkfolder = 'node_modules/@voxgig/sdkgen/project/.sdk';
    (0, jostraca_1.Project)({}, () => {
        (0, jostraca_1.each)(targets, (n) => {
            // TODO: validate target is a-z0-9-_. only
            const name = n.val$;
            (0, jostraca_1.Folder)({ name: 'model/target' }, () => {
                (0, jostraca_1.Copy)({
                    from: sdkfolder + '/model/target/' + name + '.jsonic',
                    // exclude: true
                });
                (0, jostraca_1.File)({ name: 'target-index.jsonic' }, () => (0, action_1.UpdateIndex)({
                    content: ctx$.meta.content.target_index,
                    names: targets,
                }));
            });
            (0, jostraca_1.Folder)({ name: 'src/cmp/' + name }, () => {
                (0, jostraca_1.Copy)({
                    from: sdkfolder + '/src/cmp/' + name,
                    // exclude: true
                });
            });
            (0, jostraca_1.Folder)({ name: 'tm/' + name }, () => {
                (0, jostraca_1.Copy)({
                    from: sdkfolder + '/tm/' + name,
                    exclude: [/src\/feature/],
                    replace: {
                        // TODO: standard replacements
                        ProjectName: model.const.Name,
                    }
                });
                (0, jostraca_1.Folder)({ name: 'src/feature' }, () => {
                    (0, jostraca_1.Copy)({ from: sdkfolder + '/tm/' + name + '/src/feature/README.md' });
                    (0, jostraca_1.Folder)({ name: 'base' }, () => {
                        (0, jostraca_1.Copy)({ from: sdkfolder + '/tm/' + name + '/src/feature/base' });
                    });
                });
            });
        });
    });
});
//# sourceMappingURL=target.js.map