export declare const DEFAULT_PORT = 8903;
export declare const DEFAULT_TOKEN = "podcastdemo-local-token";
export declare const LOOPBACK_HOSTS: Set<string>;
export interface Limits {
    audio: number;
    artwork: number;
    transcript: number;
    sessions: number;
    sessionTtlMs: number;
}
export interface Config {
    host: string;
    port: number;
    token: string;
    logLevel: string;
    dataPath?: string;
    limits: Limits;
}
export declare function loadConfig(env?: NodeJS.ProcessEnv): Config;
