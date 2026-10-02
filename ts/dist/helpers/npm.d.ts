type NpmHost = {
    platform: string;
    env: Record<string, string | undefined>;
    execPath: string;
    exists: (path: string) => boolean;
};
type NpmCommand = {
    file: string;
    args: string[];
};
declare function npmCommand(tool: 'npm' | 'npx', args: string[], host?: NpmHost): NpmCommand;
export type { NpmCommand, NpmHost, };
export { npmCommand, };
