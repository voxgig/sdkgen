"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Test = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const Test = (0, jostraca_1.cmp)(function Test(props) {
    const { target, ctx$ } = props;
    const { model, stdrep, log } = ctx$;
    const Test_sdk = (0, utility_1.requirePath)(ctx$, `./cmp/${target.name}/Test_${target.name}`);
    Test_sdk['Test']({ model, target, stdrep });
    log.info({
        point: 'generate-test', target,
        note: 'target:' + target.name
    });
});
exports.Test = Test;
//# sourceMappingURL=Test.js.map