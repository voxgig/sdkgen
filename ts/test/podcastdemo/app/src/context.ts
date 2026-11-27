import type { Config } from './config.js'
import { notFound } from './errors.js'
import { EpisodeStore, ShowStore } from './store/RecordStore.js'
import { SlotStore, slotKey } from './store/SlotStore.js'
import { UploadStore } from './store/UploadStore.js'
import type { Intercept } from './transfer.js'
import type { Episode, EpisodeView, Show, ShowView } from './types.js'

export interface AppContext {
  config: Config
  shows: ShowStore
  episodes: EpisodeStore
  slots: SlotStore
  uploads: UploadStore
  intercept: Intercept
}

export function makeContext(config: Config, intercept: Intercept = {}): AppContext {
  return {
    config,
    shows: new ShowStore(),
    episodes: new EpisodeStore(),
    slots: new SlotStore(),
    uploads: new UploadStore(config.limits.sessionTtlMs),
    intercept,
  }
}

export const showSlot = (id: string, slot: 'artwork') => slotKey('show', id, slot)
export const episodeSlot = (id: string, slot: 'audio' | 'transcript') =>
  slotKey('episode', id, slot)

export function showView(ctx: AppContext, show: Show): ShowView {
  return { ...show, artwork: ctx.slots.info(showSlot(show.id, 'artwork')) }
}

export function episodeView(ctx: AppContext, episode: Episode): EpisodeView {
  return {
    ...episode,
    audio: ctx.slots.info(episodeSlot(episode.id, 'audio')),
    transcript: ctx.slots.info(episodeSlot(episode.id, 'transcript')),
  }
}

export function findShow(ctx: AppContext, id: string): Show {
  const show = ctx.shows.get(id)
  if (!show) throw notFound('Show', id)
  return show
}

export function findEpisode(ctx: AppContext, showId: string, id: string): Episode {
  findShow(ctx, showId)
  const episode = ctx.episodes.get(showId, id)
  if (!episode) throw notFound('Episode', id)
  return episode
}

export function removeEpisode(ctx: AppContext, episode: Episode): void {
  ctx.episodes.delete(episode.show_id, episode.id)
  ctx.slots.deletePrefix(slotKey('episode', episode.id, ''))
  ctx.uploads.deleteWhere((u) => u.episode_id === episode.id)
}

export function removeShow(ctx: AppContext, show: Show): void {
  for (const episode of ctx.episodes.ofShow(show.id)) removeEpisode(ctx, episode)
  ctx.shows.delete(show.id)
  ctx.slots.deletePrefix(slotKey('show', show.id, ''))
}
