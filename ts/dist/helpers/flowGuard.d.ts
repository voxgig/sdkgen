type Unreachable = {
    flow: string;
    step: number;
    op: string;
};
declare function guardFlowSteps(model: any, log?: any): Unreachable[];
export type { Unreachable, };
export { guardFlowSteps, };
