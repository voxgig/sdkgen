"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.action_feature = action_feature;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const CMD_MAP = {
    add: cmd_feature_add
};
const BASE = 'node_modules/@voxgig/sdkgen';
async function action_feature(args, ctx) {
    const cmdname = args[1];
    const cmd = CMD_MAP[cmdname];
    if (null == cmd) {
        throw new utility_1.SdkGenError('Unknown feature cmd: ' + cmdname);
    }
    await cmd(args, ctx);
}
async function cmd_feature_add(args, ctx) {
    let features = args[2];
    features = 'string' === typeof features ? features.split(',') : features;
    const jostraca = (0, jostraca_1.Jostraca)();
    const opts = {
        fs: ctx.fs,
        folder: ctx.folder,
        log: ctx.log.child({ cmp: 'jostraca' }),
        meta: { model: ctx.model, tree: ctx.tree }
    };
    await jostraca.generate(opts, () => FeatureRoot({ features }));
}
const FeatureRoot = (0, jostraca_1.cmp)(function FeatureRoot(props) {
    const { ctx$, features } = props;
    // TODO: model should be a top level ctx property
    const model = ctx$.model = ctx$.meta.model;
    const target = model.main.sdk.target;
    (0, jostraca_1.Project)({}, () => {
        (0, jostraca_1.each)(features, (n) => {
            const name = n.val$;
            // TODO: validate feature is a-z0-9-_. only
            (0, jostraca_1.Folder)({ name: 'model/feature' }, () => {
                (0, jostraca_1.Copy)({
                    from: BASE + '/project/generate/model/feature/' + name + '.jsonic',
                    exclude: true
                });
            });
            (0, jostraca_1.each)(target, (target) => (0, jostraca_1.Folder)({ name: 'tm/' + target.name + '/src/feature/' + name }, () => {
                (0, jostraca_1.Copy)({
                    from: BASE + '/project/generate/tm/' + target.name + '/src/feature/' + name,
                    exclude: true
                });
            }));
        });
    });
    modifyModel({
        features,
        model: ctx$.meta.model,
        tree: ctx$.meta.tree,
        fs: ctx$.fs
    });
});
async function modifyModel({ features, model, tree, fs }) {
    // TODO: This is a kludge.
    // Aontu should provide option for as-is AST so that can be used
    // to find injection point more reliably
    const path = tree.url;
    let src = fs().readFileSync(path, 'utf8');
    // Inject feature file references into model
    features.sort().map((feature) => {
        const lineRE = new RegExp(`@"feature/${feature}.jsonic"`);
        if (!src.match(lineRE)) {
            src = src.replace(/(main:\s+sdk:\s+feature:\s+\{\s*\}\n)/, '$1' +
                `@"feature/${feature}.jsonic"\n`);
        }
    });
    fs().writeFileSync(path, src);
}
//# sourceMappingURL=feature.js.map