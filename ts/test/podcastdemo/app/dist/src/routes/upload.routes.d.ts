import type { FastifyInstance } from 'fastify';
import { type AppContext } from '../context.js';
export declare const TUS_VERSION = "1.0.0";
export declare const OFFSET_TYPE = "application/offset+octet-stream";
export default function uploadRoutes(ctx: AppContext): (fastify: FastifyInstance) => Promise<void>;
