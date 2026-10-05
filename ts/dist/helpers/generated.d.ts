declare const GENERATED_LOG = "log/generated.jsonl";
type GeneratedRecord = Record<string, Map<string, string>>;
type Claims = {
    files: Record<string, string>;
    once: string[];
    injected: string[];
    copies: {
        to: string;
        owner: string;
    }[];
    scopes: string[];
};
type PruneContext = {
    fs: any;
    log: any;
    project: string;
    out: string;
    jres: any;
    claims?: Claims;
    dryrun: boolean;
};
declare function readGenerated(fs: any, project: string): GeneratedRecord;
declare function claimedFiles(node: any, folder: string): Claims;
declare function pruneGenerated(ctx: PruneContext): string[];
export type { Claims, GeneratedRecord, };
export { GENERATED_LOG, readGenerated, claimedFiles, pruneGenerated, };
