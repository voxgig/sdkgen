type LangCmd = {
    install?: string;
    build?: string;
    test?: string;
    note?: string;
};
declare const LANG_CMD: Record<string, LangCmd>;
declare function langCmd(name: string): LangCmd;
declare function langCommandsBlock(name: string): string;
declare function activeTargets(model: any): any[];
declare function activeFeatures(model: any): any[];
declare function activeEntities(model: any): any[];
declare function projectName(model: any): string;
declare function workflowSection(): string;
declare function featureSection(): string;
declare function customiseSection(): string;
declare function aontuSection(): string;
declare function claudePointer(title: string): string;
export { LANG_CMD, langCmd, langCommandsBlock, activeTargets, activeFeatures, activeEntities, projectName, workflowSection, featureSection, customiseSection, aontuSection, claudePointer, };
