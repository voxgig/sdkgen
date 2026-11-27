import type { FastifyInstance } from 'fastify';
import { type AppContext } from '../context.js';
export default function showRoutes(ctx: AppContext): (fastify: FastifyInstance) => Promise<void>;
