import type { FastifyInstance } from 'fastify';
import { type AppContext } from '../context.js';
export declare const VTT_TYPE = "text/vtt";
export default function episodeRoutes(ctx: AppContext): (fastify: FastifyInstance) => Promise<void>;
