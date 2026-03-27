import type { FastifyRequest, FastifyReply } from 'fastify';
import type { CreatePlanetInput, UpdatePlanetInput, TerraformRequest, ForbidRequest } from '../types.js';
export declare const planetHandlers: {
    list(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    get(request: FastifyRequest<{
        Params: {
            planet_id: string;
        };
    }>, reply: FastifyReply): Promise<void>;
    create(request: FastifyRequest<{
        Body: CreatePlanetInput;
    }>, reply: FastifyReply): Promise<void>;
    update(request: FastifyRequest<{
        Params: {
            planet_id: string;
        };
        Body: UpdatePlanetInput;
    }>, reply: FastifyReply): Promise<void>;
    delete(request: FastifyRequest<{
        Params: {
            planet_id: string;
        };
    }>, reply: FastifyReply): Promise<void>;
    terraform(request: FastifyRequest<{
        Params: {
            planet_id: string;
        };
        Body: TerraformRequest;
    }>, reply: FastifyReply): Promise<void>;
    forbid(request: FastifyRequest<{
        Params: {
            planet_id: string;
        };
        Body: ForbidRequest;
    }>, reply: FastifyReply): Promise<void>;
};
