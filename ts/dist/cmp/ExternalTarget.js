"use strict";
// The Root for a target that generates OUTSIDE the SDK repo
// (`main: kit: target: <t>: output: path`).
//
// WHY THIS EXISTS, rather than a folder name
//
// A target's files normally land in `<sdk-repo>/<target>/`, which the
// consumer's own `Root.ts` arranges with `Folder({ name: target.name })`.
// Two things stop that reaching a sibling repo:
//
//   - jostraca REFUSES a `..` segment in a Folder name (FileHandler.validName
//     throws). Escaping the output root through a folder name is not an
//     oversight to work around; it is the guard that keeps generation inside
//     the tree it was pointed at.
//   - the output root is `jopts.folder`, per generate() CALL. So writing
//     somewhere else means another call, not another folder.
//
// So an out-of-tree target gets its own generate() pass, rooted at its
// output path, with this as the Root. It renders ONE target and nothing
// else: the consumer Root also emits the SDK repo's own furniture (its
// README, AGENTS.md, the build scaffold), and none of that belongs in a
// separate package's repo.
//
// No Folder wraps the target here — the destination IS the package, so its
// files go at the root of the output path.
//
// The phase gate mirrors the consumer Root exactly, so `output.path` is not
// a consumer-target feature: point a language target at another repo and it
// generates there the same way it would in-tree.
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
    // The same model preamble the consumer's Root.ts performs before it renders
    // anything: the case-variant name constants (`Name`, `NAME`, ...) and the
    // ProjectName replacement map that every template substitution reads.
    //
    // Done HERE rather than relied upon, because this pass gets the model the
    // in-tree pass never touched — Root mutates the filtered copy it is handed,
    // not this one — and because an SDK project with only out-of-tree targets
    // must generate the same way as one with both.
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
            (0, jostraca_1.each)(entity, (entity) => {
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