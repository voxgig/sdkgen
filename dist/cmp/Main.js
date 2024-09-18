"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Main = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const Main = (0, jostraca_1.cmp)(function Main(props) {
    const { build, ctx$ } = props;
    const { model } = ctx$;
    const Main_sdk = require((0, utility_1.resolvePath)(ctx$, `${build.name}/Main_${build.name}`));
    Main_sdk['Main']({ model, build });
    // TODO: make optional via build model
    (0, jostraca_1.Copy)({ from: 'tm/' + build.name + '/LICENSE', name: 'LICENSE' });
});
exports.Main = Main;
//# sourceMappingURL=Main.js.map