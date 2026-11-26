"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.consumedTarget = consumedTarget;
const node_path_1 = __importDefault(require("node:path"));
const apidef_1 = require("@voxgig/apidef");
const facts_1 = require("./facts");
const utility_1 = require("../utility");
// The installed target a consumer builds on. `path` leads to it from the
// consumer's folder, given `sdkrel`, the way back from there to the project.
// `dir` is its folder when both share a repository, else ''. `away` says it
// is generated into a repository of its own, whose address the model may give
// as `url`.
function consumedTarget(model, target, sdkrel) {
    const kit = model.main[apidef_1.KIT];
    const name = (0, facts_1.fact)(target, 'consumes');
    if ('' === name) {
        const wraps = (0, facts_1.fact)(target, 'wraps');
        throw new utility_1.SdkGenError('Target "' + target.name + '" builds on the `' + wraps +
            '` target, and the model has none. Run `voxgig-sdkgen target add ' + wraps +
            '`, then regenerate.');
    }
    const local = kit.target?.[name];
    const away = (0, facts_1.fact)(kit, 'external').find((ext) => name === ext.name);
    if (null == away && (null == local || false === local.active)) {
        throw new utility_1.SdkGenError('Target "' + target.name + '" builds on the `' + name +
            '` target, which the model switches off. Remove its `active: false`, or ' +
            'switch "' + target.name + '" off too.');
    }
    const dir = String(null == away ? (0, facts_1.fact)(local, 'dir') : away.dir);
    const shared = null == away && 'external' !== (0, facts_1.fact)(target, 'place');
    return {
        name,
        path: node_path_1.default.posix.isAbsolute(dir) ? dir : node_path_1.default.posix.join(sdkrel, dir),
        dir: shared ? dir : '',
        away: null != away,
        url: null == away ? '' : away.url,
    };
}
//# sourceMappingURL=consumer.js.map