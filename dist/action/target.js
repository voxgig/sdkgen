"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.action_target = action_target;
const node_path_1 = __importDefault(require("node:path"));
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const CMD_MAP = {
    add: cmd_target_add
};
async function action_target(args, ctx) {
    const cmdname = args[1];
    const cmd = CMD_MAP[cmdname];
    if (null == cmd) {
        throw new utility_1.SdkGenError('Unknown target cmd: ' + cmdname);
    }
    await cmd(args, ctx);
}
async function cmd_target_add(args, ctx) {
    let targets = args[2];
    targets = 'string' === typeof targets ? targets.split(',') : targets;
    const jostraca = (0, jostraca_1.Jostraca)();
    const opts = {
        fs: ctx.fs,
        folder: ctx.folder,
        log: ctx.log.child({ cmp: 'jostraca' }),
        meta: { model: ctx.model, tree: ctx.tree },
        model: ctx.model
    };
    await jostraca.generate(opts, () => TargetRoot({ targets }));
}
const TargetRoot = (0, jostraca_1.cmp)(function TargetRoot(props) {
    const { ctx$, targets } = props;
    // TODO: model should be a top level ctx property
    // ctx$.model = ctx$.meta.model
    // console.log('MODEL')
    // console.dir(ctx$.model, { depth: null })
    const { model } = ctx$;
    // TODO: jostraca - make from easier to specify 
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
                        Name: model.const.Name,
                    }
                });
                (0, jostraca_1.Folder)({ name: 'src/feature' }, () => {
                    (0, jostraca_1.Copy)({ from: sdkfolder + '/tm/' + name + '/src/feature/README.md' });
                });
            });
        });
    });
    // TODO: convert to Jostraca File
    // Append target to index
    const fs = ctx$.fs();
    const tree = ctx$.meta.tree;
    // console.log('tree', tree)
    const modelfolder = node_path_1.default.dirname(tree.url);
    const targetindexfile = node_path_1.default.join(modelfolder, 'target', 'target-index.jsonic');
    const origindex = fs.readFileSync(targetindexfile, 'utf8');
    let newindex = origindex;
    targets.map((tn) => {
        if (!origindex.includes(`@"${tn}.jsonic"`)) {
            newindex += `\n@"${tn}.jsonic"`;
        }
    });
    fs.writeFileSync(targetindexfile, newindex);
    /*
    modifyModel({
      targets,
      model: ctx$.meta.model,
      tree: ctx$.meta.tree,
      fs: ctx$.fs
    })
    */
});
//# sourceMappingURL=target.js.map