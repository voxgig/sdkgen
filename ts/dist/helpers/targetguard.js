"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUIRED_FEATURE = void 0;
exports.entityless = entityless;
exports.untestedTargets = untestedTargets;
exports.entitylessTargets = entitylessTargets;
exports.entitylessNote = entitylessNote;
exports.refuseBrokenTargets = refuseBrokenTargets;
const apidef_1 = require("@voxgig/apidef");
const facts_1 = require("./facts");
const surface_1 = require("./surface");
const utility_1 = require("../utility");
// What every SDK target's generated suite and test mode need.
const REQUIRED_FEATURE = 'test';
exports.REQUIRED_FEATURE = REQUIRED_FEATURE;
function activeTargets(model) {
    const kit = model.main[apidef_1.KIT];
    return (0, facts_1.fact)(kit, 'active').map((name) => [name, kit.target[name]]);
}
// An SDK, by its declared surface or by running an SDK's other phases,
// whose entity phase is off. A target that switches every phase off is a
// consumer, and one with a surface other than `sdk` says what it is.
function entityless(target) {
    const phase = (0, facts_1.fact)(target, 'phase');
    if (false !== phase.entity) {
        return false;
    }
    const surface = (0, facts_1.fact)(target, 'surface');
    return 'sdk' === surface ||
        ('' === surface && (phase.feature || phase.readme || phase.agentguide || phase.test));
}
function untestedTargets(model) {
    if (true === model.main[apidef_1.KIT].feature?.[REQUIRED_FEATURE]?.active) {
        return [];
    }
    return activeTargets(model)
        .filter(([, target]) => 'sdk' === (0, surface_1.surfaceOf)(target))
        .map(([name]) => ({
        target: name, problem: 'untested',
        note: 'Target "' + name + '" is an SDK, and the model has no active `' +
            REQUIRED_FEATURE + '` feature, which its generated tests and test mode need. ' +
            'Run `voxgig-sdkgen target add ' + name + '`, which installs it.',
    }));
}
function entitylessTargets(model) {
    return activeTargets(model)
        .filter(([, target]) => entityless(target))
        .map(([name]) => ({
        target: name, problem: 'entityless',
        note: entitylessNote(name),
    }));
}
function entitylessNote(name) {
    return 'Target "' + name + '" is an SDK with its entity phase off: its main ' +
        'module and documents name the entity classes that phase writes, so the SDK ' +
        'does not build. Remove `phase: entity: active: false` from its model or, ' +
        'for a target that is not an SDK, declare its `surface`.';
}
function refuseBrokenTargets(model) {
    const broken = [...untestedTargets(model), ...entitylessTargets(model)];
    if (0 < broken.length) {
        throw new utility_1.SdkGenError(broken.map((b) => b.note).join('\n'));
    }
}
//# sourceMappingURL=targetguard.js.map