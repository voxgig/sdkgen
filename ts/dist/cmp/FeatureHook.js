"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PIPELINE_STAGES = exports.FeatureHook = void 0;
exports.pipelineLength = pipelineLength;
const jostraca_1 = require("jostraca");
const component_1 = require("../helpers/component");
const types_1 = require("../types");
const FeatureHook = (0, component_1.cmp)(function FeatureHook(props, children) {
    const { ctx$: { model } } = props;
    const feature = (0, types_1.getModelPath)(model, `main.${types_1.KIT}.feature`);
    // A feature need not implement every pipeline stage; only fire the hook
    // for features that declare it as active. Optional chaining guards
    // features whose `hook` map omits this stage entirely.
    (0, jostraca_1.each)(feature)
        .filter(feature => feature.active && feature.hook?.[props.name]?.active)
        .forEach(feature => (0, jostraca_1.each)(children, { call: true, args: feature }));
});
exports.FeatureHook = FeatureHook;
// The stages every entity operation runs, in order; each fires its hook first.
const PIPELINE_STAGES = [
    {
        name: 'Point', hook: 'PrePoint',
        purpose: 'Resolves which API endpoint to call based on the operation name and entity configuration.',
    },
    {
        name: 'Spec', hook: 'PreSpec',
        purpose: 'Builds the HTTP spec — URL, method, headers, body — from the resolved point and the caller\'s parameters.',
    },
    {
        name: 'Request', hook: 'PreRequest',
        purpose: 'Sends the HTTP request. Features can intercept here to replace the transport.',
    },
    {
        name: 'Response', hook: 'PreResponse',
        purpose: 'Parses the raw HTTP response.',
    },
    {
        name: 'Result', hook: 'PreResult',
        purpose: 'Extracts the business data from the parsed response.',
    },
    {
        name: 'Done', hook: 'PreDone',
        purpose: 'Final stage before returning to the caller. Entity state (match, data) is updated here.',
    },
];
exports.PIPELINE_STAGES = PIPELINE_STAGES;
const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
function pipelineLength() {
    return COUNT_WORDS[PIPELINE_STAGES.length] ?? String(PIPELINE_STAGES.length);
}
//# sourceMappingURL=FeatureHook.js.map