import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { BufferContent } from '../content/content.js'
import { checkDigest, parseDigestField } from '../content/digest.js'
import { WAV_TYPE } from '../content/wav.js'
import { type AppContext, episodeSlot, findEpisode } from '../context.js'
import {
  badRequest,
  HttpError,
  notFound,
  preconditionFailed,
  requireType,
  tooLarge,
} from '../errors.js'
import type { Upload, UploadSlot } from '../types.js'
import { VTT_TYPE } from './episode.routes.js'

export const TUS_VERSION = '1.0.0'
export const OFFSET_TYPE = 'application/offset+octet-stream'

const SLOT_TYPE: Record<UploadSlot, string> = { audio: WAV_TYPE, transcript: VTT_TYPE }

type UploadParams = { Params: { upload_id: string } }

const createBody = {
  type: 'object',
  required: ['show_id', 'episode_id', 'size'],
  properties: {
    show_id: { type: 'string' },
    episode_id: { type: 'string' },
    slot: { type: 'string', enum: ['audio', 'transcript'] },
    size: { type: 'integer', minimum: 1 },
    type: { type: 'string' },
    digest: { type: 'string' },
  },
  additionalProperties: false,
}

async function requireTus(request: FastifyRequest, reply: FastifyReply) {
  reply.header('tus-resumable', TUS_VERSION)
  if (TUS_VERSION !== request.headers['tus-resumable']) {
    throw preconditionFailed(`Tus-Resumable ${TUS_VERSION} is required`, {
      'tus-version': TUS_VERSION,
    })
  }
}

export default function uploadRoutes(ctx: AppContext) {
  const limits = ctx.config.limits
  const slotLimit = (slot: UploadSlot) => ('audio' === slot ? limits.audio : limits.transcript)

  const findUpload = (id: string): Upload => {
    const upload = ctx.uploads.get(id)
    if (!upload) throw notFound('Upload', id)
    return upload
  }

  return async (fastify: FastifyInstance) => {
    fastify.post<{ Body: Omit<Upload, 'id' | 'offset' | 'complete' | 'expires'> }>(
      '/api/upload',
      { schema: { body: createBody } },
      async (request, reply) => {
        const body = request.body
        const slot: UploadSlot = body.slot ?? 'audio'
        findEpisode(ctx, body.show_id, body.episode_id)
        const type = body.type ?? SLOT_TYPE[slot]
        if (type !== SLOT_TYPE[slot]) {
          throw badRequest(`The ${slot} slot takes ${SLOT_TYPE[slot]}, not ${type}`)
        }
        if (undefined !== body.digest && null == parseDigestField(body.digest)) {
          throw badRequest('digest is malformed')
        }
        if (body.size > slotLimit(slot)) {
          throw tooLarge(`The ${slot} slot takes at most ${slotLimit(slot)} bytes`)
        }
        if (ctx.uploads.count() >= limits.sessions) {
          throw new HttpError(429, 'TooManyRequests', 'Too many open upload sessions')
        }
        const upload = ctx.uploads.create({ ...body, slot, type })
        return reply
          .code(201)
          .header('location', `/api/upload/${upload.id}`)
          .send(upload)
      },
    )

    fastify.get<UploadParams>('/api/upload/:upload_id', async (request) =>
      findUpload(request.params.upload_id),
    )

    fastify.head<UploadParams>(
      '/api/upload/:upload_id',
      { onRequest: requireTus },
      async (request, reply) => {
        const upload = findUpload(request.params.upload_id)
        return reply
          .headers({
            'upload-offset': String(upload.offset),
            'upload-length': String(upload.size),
            'cache-control': 'no-store',
          })
          .send()
      },
    )

    fastify.patch<UploadParams>(
      '/api/upload/:upload_id',
      { onRequest: requireTus, bodyLimit: limits.audio },
      async (request, reply) => {
        const upload = findUpload(request.params.upload_id)
        requireType(request.headers['content-type'], OFFSET_TYPE)
        const offsetHeader = request.headers['upload-offset']
        if ('string' !== typeof offsetHeader || !/^\d{1,15}$/.test(offsetHeader)) {
          throw badRequest('Upload-Offset must be a non-negative integer')
        }
        const bytes = (request.body as Buffer | undefined) ?? Buffer.alloc(0)
        const result = ctx.uploads.append(upload.id, Number(offsetHeader), bytes)!

        if ('conflict' === result.kind) {
          throw new HttpError(409, 'Conflict', `The upload is at offset ${result.offset}`, {
            'upload-offset': String(result.offset),
          })
        }
        if ('too-large' === result.kind) {
          throw tooLarge(`The upload is ${upload.size} bytes long`)
        }
        if ('complete' === result.kind) {
          const done = result.upload
          if (done.digest && 'mismatch' === checkDigest(done.digest, result.bytes)) {
            ctx.uploads.restart(done.id)
            throw badRequest('The uploaded bytes do not match the digest; the upload restarts')
          }
          const episode = ctx.episodes.get(done.show_id, done.episode_id)
          if (!episode) {
            ctx.uploads.delete(done.id)
            throw notFound('Episode', done.episode_id)
          }
          await ctx.slots.put(
            episodeSlot(episode.id, done.slot),
            new BufferContent(result.bytes, done.type),
          )
        }
        return reply
          .code(204)
          .header('upload-offset', String(result.upload.offset))
          .send()
      },
    )

    fastify.delete<UploadParams>('/api/upload/:upload_id', async (request, reply) => {
      if (!ctx.uploads.delete(findUpload(request.params.upload_id).id)) {
        throw notFound('Upload', request.params.upload_id)
      }
      return reply.code(204).send()
    })
  }
}
