export declare function repositoryStatus(root: string): {
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
        path: string;
        present: boolean;
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
