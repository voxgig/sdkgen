declare function liveStrict(model: any, target?: string): boolean;
declare function liveStrictNote(strict: boolean, prefix: string, indent?: string): string;
type LiveFlowNeeds = {
    keys: string[];
    discover?: Record<string, string>;
    blocked?: string;
};
declare function liveFlowNeeds(entity: any, flow: any): LiveFlowNeeds;
export type { LiveFlowNeeds };
export { liveStrict, liveStrictNote, liveFlowNeeds };
