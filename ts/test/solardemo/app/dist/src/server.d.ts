import Fastify from 'fastify';
export declare function build(): Promise<Fastify.FastifyInstance<import("node:http").Server<typeof import("node:http").IncomingMessage, typeof import("node:http").ServerResponse>, import("node:http").IncomingMessage, import("node:http").ServerResponse<import("node:http").IncomingMessage>, Fastify.FastifyBaseLogger, Fastify.FastifyTypeProviderDefault>>;
export declare function main(): Promise<void>;
