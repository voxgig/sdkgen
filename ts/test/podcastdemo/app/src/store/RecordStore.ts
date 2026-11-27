import { randomBytes } from 'node:crypto'
import type { Episode, Show } from '../types.js'

export function newId(): string {
  return randomBytes(9).toString('base64url')
}

export class ShowStore {
  private shows = new Map<string, Show>()

  all(): Show[] {
    return [...this.shows.values()]
  }

  get(id: string): Show | undefined {
    return this.shows.get(id)
  }

  put(show: Show): Show {
    this.shows.set(show.id, show)
    return show
  }

  update(id: string, change: Partial<Omit<Show, 'id'>>): Show | undefined {
    const show = this.shows.get(id)
    if (!show) return undefined
    const next = { ...show, ...change, id }
    this.shows.set(id, next)
    return next
  }

  delete(id: string): boolean {
    return this.shows.delete(id)
  }
}

export class EpisodeStore {
  private episodes = new Map<string, Episode>()

  all(): Episode[] {
    return [...this.episodes.values()]
  }

  ofShow(showId: string): Episode[] {
    return this.all().filter((e) => e.show_id === showId)
  }

  // An episode is reached only through its own show.
  get(showId: string, id: string): Episode | undefined {
    const episode = this.episodes.get(id)
    return episode && episode.show_id === showId ? episode : undefined
  }

  put(episode: Episode): Episode {
    this.episodes.set(episode.id, episode)
    return episode
  }

  update(showId: string, id: string, change: Partial<Omit<Episode, 'id' | 'show_id'>>) {
    const episode = this.get(showId, id)
    if (!episode) return undefined
    const next = { ...episode, ...change, id, show_id: showId }
    this.episodes.set(id, next)
    return next
  }

  delete(showId: string, id: string): boolean {
    return undefined != this.get(showId, id) && this.episodes.delete(id)
  }
}
