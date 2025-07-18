"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.feature_add = feature_add;
exports.action_feature = action_feature;
const node_path_1 = __importDefault(require("node:path"));
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const action_1 = require("./action");
const CMD_MAP = {
    add: cmd_feature_add
};
const BASE = 'node_modules/@voxgig/sdkgen';
async function action_feature(args, actx) {
    const cmdname = args[1];
    const cmd = CMD_MAP[cmdname];
    if (null == cmd) {
        throw new utility_1.SdkGenError('Unknown feature cmd: ' + cmdname);
    }
    return await cmd(args, actx);
}
async function cmd_feature_add(args, actx) {
    const features_arg = args[2];
    const features = 'string' === typeof features_arg ? features_arg.split(',') : features_arg;
    return feature_add(features, actx);
}
async function feature_add(features, actx) {
    const jostraca = (0, jostraca_1.Jostraca)();
    const opts = {
        fs: actx.fs,
        folder: actx.folder,
        log: actx.log.child({ cmp: 'jostraca' }),
        meta: {
            model: actx.model,
            tree: actx.tree,
            content: (0, action_1.loadContent)(actx, 'feature')
        }
    };
    const jres = await jostraca.generate(opts, () => FeatureRoot({ features }));
    return {
        jres
    };
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
                    // TODO: these paths needs to be parameterised
                    from: BASE + '/project/.sdk/model/feature/' + name + '.jsonic',
                    exclude: true
                });
                (0, jostraca_1.File)({ name: 'feature-index.jsonic' }, () => (0, action_1.UpdateIndex)({
                    content: ctx$.meta.content.feature_index,
                    names: features,
                }));
            });
            (0, jostraca_1.each)(target, (target) => (0, jostraca_1.Folder)({ name: 'tm/' + target.name + '/src/feature/' + name }, () => {
                const from = node_path_1.default.join((target.base || node_path_1.default.join(BASE, '/project/.sdk')), 'tm', target.name, '/src/feature/', name);
                (0, jostraca_1.Copy)({
                    // from: BASE + '/project/.sdk/tm/' + target.name + '/src/feature/' + name,
                    from,
                    exclude: true
                });
            }));
        });
    });
});
//# sourceMappingURL=feature.js.map