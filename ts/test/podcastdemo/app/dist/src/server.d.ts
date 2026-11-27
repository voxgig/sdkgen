import { type FastifyInstance } from 'fastify';
import { type Config, type Limits } from './config.js';
import { type AppContext } from './context.js';
import type { Intercept } from './transfer.js';
export declare const DEFAULT_DATA_PATH: string;
export interface BuildOptions {
    config?: Partial<Omit<Config, 'limits'>> & {
        limits?: Partial<Limits>;
    };
    intercept?: Intercept;
}
export interface PodcastApp {
    fastify: FastifyInstance;
    ctx: AppContext;
}
export declare function buildApp(options?: BuildOptions): Promise<PodcastApp>;
export declare function build(options?: BuildOptions): Promise<FastifyInstance>;
export declare function main(): Promise<void>;
