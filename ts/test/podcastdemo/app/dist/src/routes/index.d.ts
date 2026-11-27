import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';
export default function routes(ctx: AppContext): (fastify: FastifyInstance) => Promise<void>;
