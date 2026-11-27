import { randomBytes } from 'node:crypto';
export function newId() {
    return randomBytes(9).toString('base64url');
}
export class ShowStore {
    shows = new Map();
    all() {
        return [...this.shows.values()];
    }
    get(id) {
        return this.shows.get(id);
    }
    put(show) {
        this.shows.set(show.id, show);
        return show;
    }
    update(id, change) {
        const show = this.shows.get(id);
        if (!show)
            return undefined;
        const next = { ...show, ...change, id };
        this.shows.set(id, next);
        return next;
    }
    delete(id) {
        return this.shows.delete(id);
    }
}
export class EpisodeStore {
    episodes = new Map();
    all() {
        return [...this.episodes.values()];
    }
    ofShow(showId) {
        return this.all().filter((e) => e.show_id === showId);
    }
    // An episode is reached only through its own show.
    get(showId, id) {
        const episode = this.episodes.get(id);
        return episode && episode.show_id === showId ? episode : undefined;
    }
    put(episode) {
        this.episodes.set(episode.id, episode);
        return episode;
    }
    update(showId, id, change) {
        const episode = this.get(showId, id);
        if (!episode)
            return undefined;
        const next = { ...episode, ...change, id, show_id: showId };
        this.episodes.set(id, next);
        return next;
    }
    delete(showId, id) {
        return undefined != this.get(showId, id) && this.episodes.delete(id);
    }
}
//# sourceMappingURL=RecordStore.js.map