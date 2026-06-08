import type { FastifyRequest, FastifyReply } from 'fastify';
import type { CreateMoonInput, UpdateMoonInput } from '../types.js';
export declare const moonHandlers: {
    list(request: FastifyRequest<{
        Params: {
            planet_id: string;
        };
    }>, reply: FastifyReply): Promise<void>;
    get(request: FastifyRequest<{
        Params: {
            planet_id: string;
            moon_id: string;
        };
    }>, reply: FastifyReply): Promise<void>;
    create(request: FastifyRequest<{
        Params: {
            planet_id: string;
        };
        Body: CreateMoonInput;
    }>, reply: FastifyReply): Promise<void>;
    update(request: FastifyRequest<{
        Params: {
            planet_id: string;
            moon_id: string;
        };
        Body: UpdateMoonInput;
    }>, reply: FastifyReply): Promise<void>;
    delete(request: FastifyRequest<{
        Params: {
            planet_id: string;
            moon_id: string;
        };
    }>, reply: FastifyReply): Promise<void>;
};
