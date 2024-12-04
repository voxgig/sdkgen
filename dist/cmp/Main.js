"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Main = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const Main = (0, jostraca_1.cmp)(function Main(props) {
    const { target, ctx$ } = props;
    const { model } = ctx$;
    const Main_sdk = require((0, utility_1.resolvePath)(ctx$, `target/${target.name}/Main_${target.name}`));
    Main_sdk['Main']({ model, target });
    // TODO: make optional via target model
    (0, jostraca_1.Copy)({ from: 'tm/' + target.name + '/LICENSE', name: 'LICENSE' });
});
exports.Main = Main;
//# sourceMappingURL=Main.js.map