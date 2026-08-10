"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Feature = void 0;
const jostraca_1 = require("jostraca");
const Feature = (0, jostraca_1.cmp)(function Feature(props) {
    const { target, feature, ctx$ } = props;
    const { log } = ctx$;
    if (false !== target.srcfeature) {
        (0, jostraca_1.Folder)({ name: 'src/feature/' + feature.name }, () => {
            // TODO: Copy should just warn if from not found
            (0, jostraca_1.Copy)({
                from: 'tm/' + target.name + '/src/feature/' + feature.name,
                replace: {
                    // Feature templates reference the SDK class by placeholder — e.g.
                    // tm/ts/.../TestFeature.ts imports `ProjectNameSDK`. Without the
                    // standard replacements those placeholders reach the generated
                    // source verbatim and the target fails to COMPILE.
                    //
                    // This worked by accident everywhere it worked: Main_<lang> copies
                    // the whole tm/<lang> tree (feature dirs included) with stdrep
                    // afterwards, so the substituted version overwrote this one. Any
                    // target whose Main excludes src/ — or any consumer .sdk whose
                    // local Main_<lang> lost that Copy — got the raw placeholder.
                    // voxgig-solardemo-sdk hit exactly that and could not build its
                    // TypeScript at all.
                    ...ctx$.stdrep,
                    FEATURE_VERSION: feature.version,
                    FEATURE_Name: feature.Name,
                }
            });
        });
    }
    log.info({
        // Identifiers only — see the note in Entity.ts.
        point: 'generate-feature', target: target.name, feature: feature.name,
        note: 'target:' + target.name + ', ' + 'feature: ' + feature.name
    });
});
exports.Feature = Feature;
//# sourceMappingURL=Feature.js.map