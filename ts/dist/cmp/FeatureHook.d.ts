declare const FeatureHook: import("jostraca").Component<any, never, never>;
declare const PIPELINE_STAGES: {
    name: string;
    hook: string;
    purpose: string;
}[];
declare function pipelineLength(): string;
export { FeatureHook, PIPELINE_STAGES, pipelineLength, };
