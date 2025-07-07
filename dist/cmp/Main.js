"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Main = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const Main = (0, jostraca_1.cmp)(function Main(props) {
    const { target, ctx$ } = props;
    const { model, stdrep } = ctx$;
    (0, jostraca_1.Copy)({
        from: 'tm/' + target.name,
        replace: {
            ...stdrep,
        }
    });
    const Main_sdk = (0, utility_1.requirePath)(ctx$, `cmp/${target.name}/Main_${target.name}`);
    Main_sdk['Main']({ model, target, stdrep });
});
exports.Main = Main;
//# sourceMappingURL=Main.js.map