"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Main = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const Main = (0, jostraca_1.cmp)(function Main(props) {
    const { target, ctx$ } = props;
    const { model, stdrep, log } = ctx$;
    (0, jostraca_1.Copy)({
        // This folder is relative to the .sdk folder in the project, as that is where
        // the sdk is generated from.
        from: 'tm/' + target.name,
        replace: {
            ...stdrep,
        }
    });
    const Main_sdk = (0, utility_1.requirePath)(ctx$, `cmp/${target.name}/Main_${target.name}`);
    Main_sdk['Main']({ model, target, stdrep });
    log.info({ point: 'generate-main', target, note: 'target:' + target.name });
});
exports.Main = Main;
//# sourceMappingURL=Main.js.map