import { notFound } from './errors.js';
import { EpisodeStore, ShowStore } from './store/RecordStore.js';
import { SlotStore, slotKey } from './store/SlotStore.js';
import { UploadStore } from './store/UploadStore.js';
export function makeContext(config, intercept = {}) {
    return {
        config,
        shows: new ShowStore(),
        episodes: new EpisodeStore(),
        slots: new SlotStore(),
        uploads: new UploadStore(config.limits.sessionTtlMs),
        intercept,
    };
}
export const showSlot = (id, slot) => slotKey('show', id, slot);
export const episodeSlot = (id, slot) => slotKey('episode', id, slot);
export function showView(ctx, show) {
    return { ...show, artwork: ctx.slots.info(showSlot(show.id, 'artwork')) };
}
export function episodeView(ctx, episode) {
    return {
        ...episode,
        audio: ctx.slots.info(episodeSlot(episode.id, 'audio')),
        transcript: ctx.slots.info(episodeSlot(episode.id, 'transcript')),
    };
}
export function findShow(ctx, id) {
    const show = ctx.shows.get(id);
    if (!show)
        throw notFound('Show', id);
    return show;
}
export function findEpisode(ctx, showId, id) {
    findShow(ctx, showId);
    const episode = ctx.episodes.get(showId, id);
    if (!episode)
        throw notFound('Episode', id);
    return episode;
}
export function removeEpisode(ctx, episode) {
    ctx.episodes.delete(episode.show_id, episode.id);
    ctx.slots.deletePrefix(slotKey('episode', episode.id, ''));
    ctx.uploads.deleteWhere((u) => u.episode_id === episode.id);
}
export function removeShow(ctx, show) {
    for (const episode of ctx.episodes.ofShow(show.id))
        removeEpisode(ctx, episode);
    ctx.shows.delete(show.id);
    ctx.slots.deletePrefix(slotKey('show', show.id, ''));
}
//# sourceMappingURL=context.js.map