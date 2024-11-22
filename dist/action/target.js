"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.action_target = action_target;
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
    targets = 'string' === typeof targets ? [targets] : targets;
    const jostraca = (0, jostraca_1.Jostraca)();
    const opts = {
        fs: ctx.fs,
        folder: ctx.folder,
        log: ctx.log.child({ cmp: 'jostraca' }),
        meta: { model: ctx.model, tree: ctx.tree }
    };
    await jostraca.generate(opts, () => TargetRoot({ targets }));
}
const TargetRoot = (0, jostraca_1.cmp)(function TargetRoot(props) {
    const { ctx$, targets } = props;
    // TODO: model should be a top level ctx property
    ctx$.model = ctx$.meta.model;
    console.log('MODEL');
    console.dir(ctx$.model, { depth: null });
    (0, jostraca_1.Project)({}, () => {
        (0, jostraca_1.each)(targets, (n) => {
            // TODO: validate target is a-z0-9-_. only
            const target = n.val$;
            (0, jostraca_1.Folder)({ name: 'model/target' }, () => {
                (0, jostraca_1.Copy)({
                    from: 'node_modules/@voxgig/sdkgen/tm/generate/model/target/' + target + '.jsonic',
                    // exclude: true
                });
            });
            (0, jostraca_1.Folder)({ name: 'tm/target/' + target }, () => {
                (0, jostraca_1.Copy)({
                    from: 'node_modules/@voxgig/sdkgen/tm/generate/tm/target/' + target,
                    // exclude: true
                });
            });
            (0, jostraca_1.Folder)({ name: 'src/target/' + target }, () => {
                (0, jostraca_1.Copy)({
                    from: 'node_modules/@voxgig/sdkgen/tm/generate/src/target/' + target,
                    // exclude: true
                });
            });
        });
    });
    modifyModel({
        targets,
        model: ctx$.meta.model,
        tree: ctx$.meta.tree,
        fs: ctx$.fs
    });
});
async function modifyModel({ targets, model, tree, fs }) {
    // TODO: This is a kludge.
    // Aontu should provide option for as-is AST so that can be used
    // to find injection point more reliably
    const path = tree.url;
    let src = fs.readFileSync(path, 'utf8');
    // Inject target file references into model
    targets.sort().map((target) => {
        const lineRE = new RegExp(`main:\\s+sdk:\\s+target:\\s+${target}:\\s+@"target/${target}.jsonic"`);
        if (!src.match(lineRE)) {
            src = src.replace(/(main:\s+sdk:\s+target:\s+\{\s*\}\n)/, '$1' +
                `main: sdk: target: ${target}: @"target/${target}.jsonic"\n`);
        }
    });
    fs.writeFileSync(path, src);
}
//# sourceMappingURL=target.js.map