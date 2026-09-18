"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerComponent = registerComponent;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const stdrep_1 = require("../helpers/stdrep");
function registerComponent(name, options = {}) {
    const member = options.export || name;
    const optional = false !== options.optional;
    return (0, jostraca_1.cmp)(function Registered(props) {
        const { target, ctx$ } = props;
        const { model, log } = ctx$;
        const stdrep = (0, stdrep_1.ensureStdrep)(ctx$);
        const mod = (0, utility_1.requirePath)(ctx$, `./cmp/${target.name}/${name}_${target.name}`, { ignore: optional });
        if (null == mod) {
            log.debug({
                point: 'generate-registered-absent', component: name, target: target.name,
                note: name + ': not implemented for ' + target.name
            });
            return;
        }
        const fn = mod[member];
        if ('function' !== typeof fn) {
            log.warn({
                point: 'generate-registered-noexport', component: name,
                target: target.name, member,
                note: name + '_' + target.name + ' does not export ' + member
            });
            return;
        }
        // Same call shape as the built-ins, plus whatever the caller passed —
        // so a registered component is written exactly like Main_<lang>.
        fn({ ...props, model, target, stdrep });
        log.info({
            point: 'generate-registered', component: name, target: target.name,
            note: name + ': target:' + target.name
        });
    });
}
//# sourceMappingURL=Registered.js.map