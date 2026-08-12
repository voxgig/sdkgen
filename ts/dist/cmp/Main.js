"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Main = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const stdrep_1 = require("../helpers/stdrep");
const Main = (0, jostraca_1.cmp)(function Main(props) {
    const { target, ctx$ } = props;
    const { model, log } = ctx$;
    // Generator-owned placeholders (PROJECTENV) that the project's frozen
    // Root.ts cannot know about.
    const stdrep = (0, stdrep_1.ensureStdrep)(ctx$);
    const Main_sdk = (0, utility_1.requirePath)(ctx$, `cmp/${target.name}/Main_${target.name}`);
    Main_sdk['Main']({ model, target, stdrep });
    log.info({ point: 'generate-main', target, note: 'target:' + target.name });
});
exports.Main = Main;
//# sourceMappingURL=Main.js.map