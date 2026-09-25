type Mode = 'setup' | 'check' | 'dry-run';
type Publication = {
    pkg: string;
    file: string;
};
type TrustSpec = {
    repository: string;
    publish: Publication[];
    mode: Mode;
    replace: boolean;
    otp?: string;
};
type TrustEntry = {
    id?: string;
    type?: string;
    file?: string;
    repository?: string;
    environment?: string;
    permissions?: string[];
};
type Assessment = {
    match?: TrustEntry;
    extra: TrustEntry[];
};
type NpmPort = {
    list(pkg: string): TrustEntry[];
    create(pkg: string, repository: string, file: string): void;
    revoke(pkg: string, id: string): void;
};
declare function parseArgs(argv: string[]): TrustSpec;
declare function parseTrustList(text: string): TrustEntry[];
declare function assess(pub: Publication, repository: string, entries: TrustEntry[]): Assessment;
declare function trustCommand(repository: string, pub: Publication): string;
declare function run(spec: TrustSpec, npm: NpmPort, out: (line: string) => void): number;
declare function npmFailure(action: string, stderr: string): string;
declare function npmTrustScript(repository: string, publish: Publication[]): string;
declare function main(argv: string[]): number;
export type { Assessment, NpmPort, Publication, TrustEntry, TrustSpec, };
export { assess, main, npmFailure, npmTrustScript, parseArgs, parseTrustList, run, trustCommand, };
