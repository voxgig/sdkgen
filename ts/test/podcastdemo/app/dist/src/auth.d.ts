import type { FastifyInstance } from 'fastify';
export declare function bearerMatches(header: string | undefined, token: string): boolean;
export declare function registerBearer(fastify: FastifyInstance, token: string): void;
