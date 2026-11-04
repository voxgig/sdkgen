"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Main = void 0;
const component_1 = require("../helpers/component");
const utility_1 = require("../utility");
const stdrep_1 = require("../helpers/stdrep");
const useragent_1 = require("../helpers/useragent");
const Main = (0, component_1.cmp)(function Main(props) {
    const { target, ctx$ } = props;
    const { model, log } = ctx$;
    // Generator-owned placeholders (PROJECTENV) that the project's frozen
    // Root.ts cannot know about.
    const stdrep = (0, stdrep_1.ensureStdrep)(ctx$);
    // Per target, as `plain` names the target's own release; each Main_<lang>
    // copies its templates with this map before the next target sets it.
    stdrep.PROJECTUSERAGENT = (0, useragent_1.userAgent)(model, target.name);
    const Main_sdk = (0, utility_1.requirePath)(ctx$, `cmp/${target.name}/Main_${target.name}`);
    Main_sdk['Main']({ model, target, stdrep });
    log.info({ point: 'generate-main', target, note: 'target:' + target.name });
});
exports.Main = Main;
//# sourceMappingURL=Main.js.map