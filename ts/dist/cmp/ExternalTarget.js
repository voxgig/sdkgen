"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalTarget = void 0;
const jostraca_1 = require("jostraca");
const jostraca_2 = require("jostraca");
const apidef_1 = require("@voxgig/apidef");
const Main_1 = require("./Main");
const Entity_1 = require("./Entity");
const Feature_1 = require("./Feature");
const Readme_1 = require("./Readme");
const Test_1 = require("./Test");
const AgentGuide_1 = require("./AgentGuide");
const ExternalTarget = (0, jostraca_1.cmp)(function ExternalTarget(props) {
    const { model, target, cmpfolder, sdkrelpath } = props;
    const ctx$ = props.ctx$;
    ctx$.model = model;
    // Components live in the PROJECT, not in the repo being written to. This
    // pass has retargeted jostraca's output folder, which is what requirePath
    // otherwise resolves against — see utility.resolvePath.
    ctx$.cmpfolder = cmpfolder;
    // The path from the destination back to the SDK project, for a target whose
    // output sits beside the SDK in a known layout.
    ctx$.sdkrelpath = sdkrelpath;
    model.const = model.const || { name: model.name };
    (0, jostraca_1.names)(model.const, model.name);
    if (null == model.const.year) {
        model.const.year = new Date().getFullYear();
    }
    (0, jostraca_1.names)(model, model.name);
    ctx$.stdrep = ctx$.stdrep || {};
    (0, jostraca_1.names)(ctx$.stdrep, model.Name, 'Project' + 'Name');
    const entity = model.main[apidef_1.KIT].entity || {};
    const feature = model.main[apidef_1.KIT].feature || {};
    // Defaults are inclusive: a phase runs unless the target's model turns it
    // off. Consumer targets (go-cli, go-mcp, py-data, seneca-provider) switch
    // every phase off and emit everything from Main.
    const phase = target.phase || {};
    const phaseActive = (name) => false !== (phase[name] && phase[name].active);
    (0, jostraca_2.Project)({}, () => {
        (0, jostraca_1.names)(target, target.name);
        if (phaseActive('entity')) {
            (0, jostraca_1.each)(entity).filter((entity) => entity.active).map((entity) => {
                (0, jostraca_1.names)(entity, entity.name);
                (0, Entity_1.Entity)({ target, entity });
            });
        }
        if (phaseActive('feature')) {
            (0, jostraca_1.each)(feature)
                .filter((feature) => feature.active)
                .map((feature) => {
                (0, jostraca_1.names)(feature, feature.name);
                (0, Feature_1.Feature)({ target, feature });
            });
        }
        (0, Main_1.Main)({ target });
        if (phaseActive('readme')) {
            (0, Readme_1.Readme)({ target });
        }
        if (phaseActive('agentguide')) {
            (0, AgentGuide_1.AgentGuide)({ target });
        }
        if (phaseActive('test')) {
            (0, Test_1.Test)({ target });
        }
    });
});
exports.ExternalTarget = ExternalTarget;
//# sourceMappingURL=ExternalTarget.js.map