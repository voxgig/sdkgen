declare const REQUIRED_FEATURE = "test";
type BrokenTarget = {
    target: string;
    problem: 'untested' | 'entityless';
    note: string;
};
declare function entityless(target: any): boolean;
declare function untestedTargets(model: any): BrokenTarget[];
declare function entitylessTargets(model: any): BrokenTarget[];
declare function entitylessNote(name: string): string;
declare function refuseBrokenTargets(model: any): void;
export type { BrokenTarget, };
export { REQUIRED_FEATURE, entityless, untestedTargets, entitylessTargets, entitylessNote, refuseBrokenTargets, };
