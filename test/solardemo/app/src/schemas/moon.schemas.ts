export const moonSchemas = {
  list: {
    params: {
      type: 'object',
      required: ['planet_id'],
      properties: {
        planet_id: { type: 'string' },
      },
    },
    response: {
      200: {
        type: 'array',
        items: { $ref: 'moon#' },
      },
      404: { $ref: 'error#' },
    },
  },
  get: {
    params: {
      type: 'object',
      required: ['planet_id', 'moon_id'],
      properties: {
        planet_id: { type: 'string' },
        moon_id: { type: 'string' },
      },
    },
    response: {
      200: { $ref: 'moon#' },
      404: { $ref: 'error#' },
    },
  },
  create: {
    params: {
      type: 'object',
      required: ['planet_id'],
      properties: {
        planet_id: { type: 'string' },
      },
    },
    body: {
      type: 'object',
      required: ['name', 'planet_id', 'kind', 'diameter'],
      properties: {
        name: { type: 'string' },
        planet_id: { type: 'string' },
        kind: { type: 'string' },
        diameter: { type: 'number' },
      },
      additionalProperties: false,
    },
    response: {
      201: { $ref: 'moon#' },
      400: { $ref: 'error#' },
      404: { $ref: 'error#' },
    },
  },
  update: {
    params: {
      type: 'object',
      required: ['planet_id', 'moon_id'],
      properties: {
        planet_id: { type: 'string' },
        moon_id: { type: 'string' },
      },
    },
    body: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        planet_id: { type: 'string' },
        kind: { type: 'string' },
        diameter: { type: 'number' },
      },
      additionalProperties: false,
    },
    response: {
      200: { $ref: 'moon#' },
      404: { $ref: 'error#' },
    },
  },
  delete: {
    params: {
      type: 'object',
      required: ['planet_id', 'moon_id'],
      properties: {
        planet_id: { type: 'string' },
        moon_id: { type: 'string' },
      },
    },
    response: {
      204: {
        type: 'null',
      },
      404: { $ref: 'error#' },
    },
  },
}
