"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Test = void 0;
const jostraca_1 = require("jostraca");
const utility_1 = require("../utility");
const stdrep_1 = require("../helpers/stdrep");
const resolved_1 = require("../helpers/resolved");
const Test = (0, jostraca_1.cmp)(function Test(props) {
    const { target, ctx$ } = props;
    const { model, log } = ctx$;
    const stdrep = (0, stdrep_1.ensureStdrep)(ctx$);
    const points = Object.values(model.main.kit.entity || {}).flatMap((entity) => Object.values(entity.op || {}).flatMap((op) => op.points || []));
    if (points.some(point => (0, resolved_1.liveHint)(point))) {
        const supported = ['ts', 'js'].includes(target.name);
        (0, jostraca_1.File)({ name: 'live-coverage.json' }, () => (0, jostraca_1.Content)(JSON.stringify({
            version: 1, target: target.name, scenarios: supported ? 'supported' : 'unsupported',
            points: points.map(point => point.co?.id || point.m + ' ' + point.o),
            ...(!supported ? { reason: 'This target does not yet execute declarative live recipes. Its existing tests do not establish full operation coverage.' } : {}),
        }, null, 2)));
        if (!supported)
            log.warn({ point: 'live-scenarios-unsupported', note: 'Declarative live recipes are not executed by target ' + target.name });
    }
    const Test_sdk = (0, utility_1.requirePath)(ctx$, `./cmp/${target.name}/Test_${target.name}`);
    Test_sdk['Test']({ model, target, stdrep });
    log.info({
        point: 'generate-test', target,
        note: 'target:' + target.name
    });
});
exports.Test = Test;
//# sourceMappingURL=Test.js.map