import type { FastifyInstance, FastifyRequest } from 'fastify'
import { BufferContent } from '../content/content.js'
import { matches } from '../content/conditional.js'
import { checkDigest } from '../content/digest.js'
import { WAV_TYPE } from '../content/wav.js'
import {
  type AppContext,
  episodeSlot,
  episodeView,
  findEpisode,
  findShow,
  removeEpisode,
} from '../context.js'
import {
  badRequest,
  mediaEssence,
  notFound,
  preconditionFailed,
  requireType,
  unsupportedType,
} from '../errors.js'
import { newId } from '../store/RecordStore.js'
import { sendDownload } from '../transfer.js'
import type { Episode } from '../types.js'

export const VTT_TYPE = 'text/vtt'

type ShowParams = { Params: { show_id: string } }
type EpisodeParams = { Params: { show_id: string; episode_id: string } }

const updateBody = {
  type: 'object',
  properties: {
    show_id: { type: 'string' },
    title: { type: 'string', minLength: 1 },
    number: { type: 'integer' },
  },
  additionalProperties: false,
}

const publishBody = {
  type: 'object',
  required: ['publish'],
  properties: {
    publish: { type: 'boolean' },
    why: { type: 'string' },
  },
  additionalProperties: false,
}

const CREATE_FIELDS = new Set(['title', 'number'])

async function readCreate(request: FastifyRequest) {
  if (!request.isMultipart()) {
    throw unsupportedType(request.headers['content-type'], 'multipart/form-data')
  }
  const fields: Record<string, string> = {}
  let audio: Buffer | undefined

  for await (const part of request.parts()) {
    if ('file' === part.type) {
      if ('audio' !== part.fieldname || undefined !== audio) {
        part.file.resume()
        throw badRequest(`Unexpected file part '${part.fieldname}'`)
      }
      if (mediaEssence(part.mimetype) !== WAV_TYPE) {
        part.file.resume()
        throw unsupportedType(part.mimetype, WAV_TYPE)
      }
      audio = await part.toBuffer()
    } else {
      if (!CREATE_FIELDS.has(part.fieldname) || part.fieldname in fields) {
        throw badRequest(`Unexpected field '${part.fieldname}'`)
      }
      if (part.valueTruncated) throw badRequest(`Field '${part.fieldname}' is too long`)
      fields[part.fieldname] = String(part.value)
    }
  }

  if (!fields.title) throw badRequest('Field title is required')
  if (!audio) throw badRequest('File part audio is required')
  let number: number | undefined
  if (undefined !== fields.number) {
    if (!/^-?\d{1,15}$/.test(fields.number)) throw badRequest('Field number is not an integer')
    number = Number(fields.number)
  }
  return { title: fields.title, number, audio }
}

export default function episodeRoutes(ctx: AppContext) {
  const base = '/api/show/:show_id/episode'
  const item = `${base}/:episode_id`

  return async (fastify: FastifyInstance) => {
    fastify.get<ShowParams>(base, async (request) => {
      const show = findShow(ctx, request.params.show_id)
      return ctx.episodes.ofShow(show.id).map((e) => episodeView(ctx, e))
    })

    fastify.post<ShowParams>(base, async (request, reply) => {
      const show = findShow(ctx, request.params.show_id)
      const { title, number, audio } = await readCreate(request)
      const episode = ctx.episodes.put({
        id: newId(),
        show_id: show.id,
        title,
        ...(undefined === number ? {} : { number }),
        state: 'draft',
      })
      await ctx.slots.put(episodeSlot(episode.id, 'audio'), new BufferContent(audio, WAV_TYPE))
      return reply.code(201).send(episodeView(ctx, episode))
    })

    fastify.get<EpisodeParams>(item, async (request) =>
      episodeView(ctx, findEpisode(ctx, request.params.show_id, request.params.episode_id)),
    )

    fastify.put<EpisodeParams & { Body: Partial<Episode> }>(
      item,
      { schema: { body: updateBody } },
      async (request) => {
        const { show_id, episode_id } = request.params
        findEpisode(ctx, show_id, episode_id)
        const { show_id: bodyShow, ...change } = request.body
        if (undefined !== bodyShow && bodyShow !== show_id) {
          throw badRequest('show_id in the body does not match the path')
        }
        return episodeView(ctx, ctx.episodes.update(show_id, episode_id, change)!)
      },
    )

    fastify.delete<EpisodeParams>(item, async (request, reply) => {
      removeEpisode(ctx, findEpisode(ctx, request.params.show_id, request.params.episode_id))
      return reply.code(204).send()
    })

    fastify.post<EpisodeParams & { Body: { publish: boolean; why?: string } }>(
      `${item}/publish`,
      { schema: { body: publishBody } },
      async (request) => {
        const { show_id, episode_id } = request.params
        findEpisode(ctx, show_id, episode_id)
        const state = request.body.publish ? 'published' : 'draft'
        ctx.episodes.update(show_id, episode_id, { state })
        return { ok: true, state }
      },
    )

    const audioSlot = (request: FastifyRequest<EpisodeParams>) => {
      const episode = findEpisode(ctx, request.params.show_id, request.params.episode_id)
      const slot = ctx.slots.get(episodeSlot(episode.id, 'audio'))
      if (!slot) throw notFound('Audio of episode', episode.id)
      return { episode, slot }
    }

    const sendAudio = async (request: FastifyRequest<EpisodeParams>, reply: any) => {
      const { episode, slot } = audioSlot(request)
      return sendDownload(
        request,
        reply,
        slot,
        {
          ranges: true,
          conditional: true,
          disposition: `attachment; filename="${episode.id}.wav"`,
        },
        ctx.intercept,
      )
    }

    fastify.get<EpisodeParams>(`${item}/audio`, sendAudio)
    fastify.head<EpisodeParams>(`${item}/audio`, sendAudio)

    fastify.put<EpisodeParams>(
      `${item}/audio`,
      { bodyLimit: ctx.config.limits.audio },
      async (request) => {
        const episode = findEpisode(ctx, request.params.show_id, request.params.episode_id)
        requireType(request.headers['content-type'], WAV_TYPE)
        const key = episodeSlot(episode.id, 'audio')
        if (!matches(request.headers['if-match'], ctx.slots.info(key)?.etag)) {
          throw preconditionFailed('If-Match does not match the current audio')
        }
        const bytes = request.body as Buffer
        const digest = request.headers['repr-digest']
        if ('string' === typeof digest) {
          const check = checkDigest(digest, bytes)
          if ('malformed' === check) throw badRequest('Repr-Digest is malformed')
          if ('mismatch' === check) throw badRequest('Repr-Digest does not match the content')
        }
        await ctx.slots.put(key, new BufferContent(bytes, WAV_TYPE))
        return episodeView(ctx, episode)
      },
    )

    fastify.get<EpisodeParams>(`${item}/transcript`, async (request, reply) => {
      const episode = findEpisode(ctx, request.params.show_id, request.params.episode_id)
      const slot = ctx.slots.get(episodeSlot(episode.id, 'transcript'))
      if (!slot) throw notFound('Transcript of episode', episode.id)
      return sendDownload(request, reply, slot, { ranges: false, conditional: false }, ctx.intercept)
    })

    fastify.put<EpisodeParams>(
      `${item}/transcript`,
      { bodyLimit: ctx.config.limits.transcript },
      async (request) => {
        const episode = findEpisode(ctx, request.params.show_id, request.params.episode_id)
        requireType(request.headers['content-type'], VTT_TYPE)
        await ctx.slots.put(
          episodeSlot(episode.id, 'transcript'),
          new BufferContent(request.body as Buffer, VTT_TYPE),
        )
        return episodeView(ctx, episode)
      },
    )
  }
}
