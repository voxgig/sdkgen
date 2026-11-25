export declare function repositoryStatus(root: string, env?: Record<string, string | undefined>): {
    root: string;
    name: any;
    repository: {
        branch: string;
        commit: string | null;
        state: string;
        upstream: string | null;
        ahead: number | null;
        behind: number | null;
    };
    model: {
        path: string;
        compiled: boolean;
        error: string | undefined;
        generatedAt: string | null;
    };
    override: {
        targets: string[];
        error: string | undefined;
    };
    toolchain: {
        node: string;
        packages: {
            name: string;
            version: any;
        }[];
    };
    targets: {
        name: string;
        active: boolean;
        place: import("../helpers/placement").Place;
        path: string;
        present: boolean;
        stale: string | null;
        state: string;
        readme: boolean;
        version: any;
        publication: any;
    }[];
    editions: {
        name: string;
        active: boolean;
        kind: any;
        path: any;
        present: boolean;
    }[];
};
export declare function main(args?: string[]): number;
