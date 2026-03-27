export const planetSchemas = {
    list: {
        response: {
            200: {
                type: 'array',
                items: { $ref: 'planet#' },
            },
        },
    },
    get: {
        params: {
            type: 'object',
            required: ['planet_id'],
            properties: {
                planet_id: { type: 'string' },
            },
        },
        response: {
            200: { $ref: 'planet#' },
            404: { $ref: 'error#' },
        },
    },
    create: {
        body: {
            type: 'object',
            required: ['name', 'kind', 'diameter'],
            properties: {
                name: { type: 'string' },
                kind: { type: 'string' },
                diameter: { type: 'number' },
            },
            additionalProperties: false,
        },
        response: {
            201: { $ref: 'planet#' },
            400: { $ref: 'error#' },
        },
    },
    update: {
        params: {
            type: 'object',
            required: ['planet_id'],
            properties: {
                planet_id: { type: 'string' },
            },
        },
        body: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                kind: { type: 'string' },
                diameter: { type: 'number' },
            },
            additionalProperties: false,
        },
        response: {
            200: { $ref: 'planet#' },
            404: { $ref: 'error#' },
        },
    },
    delete: {
        params: {
            type: 'object',
            required: ['planet_id'],
            properties: {
                planet_id: { type: 'string' },
            },
        },
        response: {
            204: {
                type: 'null',
            },
            404: { $ref: 'error#' },
        },
    },
    terraform: {
        params: {
            type: 'object',
            required: ['planet_id'],
            properties: {
                planet_id: { type: 'string' },
            },
        },
        body: {
            type: 'object',
            properties: {
                start: { type: 'boolean' },
                stop: { type: 'boolean' },
            },
            additionalProperties: false,
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    ok: { type: 'boolean' },
                    state: { type: 'string' },
                },
            },
            404: { $ref: 'error#' },
        },
    },
    forbid: {
        params: {
            type: 'object',
            required: ['planet_id'],
            properties: {
                planet_id: { type: 'string' },
            },
        },
        body: {
            type: 'object',
            required: ['forbid'],
            properties: {
                forbid: { type: 'boolean' },
                why: { type: 'string' },
            },
            additionalProperties: false,
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    ok: { type: 'boolean' },
                    state: { type: 'string' },
                },
            },
            404: { $ref: 'error#' },
        },
    },
};
//# sourceMappingURL=planet.schemas.js.map