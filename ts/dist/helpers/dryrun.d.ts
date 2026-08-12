type FileLists = {
    written?: string[];
    merged?: string[];
    conflicted?: string[];
    unchanged?: string[];
    preserved?: string[];
};
declare function showDryrun(log: any, point: string, jres: any, folder?: string): number;
export type { FileLists, };
export { showDryrun, };
