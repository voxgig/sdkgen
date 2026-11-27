import type { Episode, Show } from '../types.js';
export declare function newId(): string;
export declare class ShowStore {
    private shows;
    all(): Show[];
    get(id: string): Show | undefined;
    put(show: Show): Show;
    update(id: string, change: Partial<Omit<Show, 'id'>>): Show | undefined;
    delete(id: string): boolean;
}
export declare class EpisodeStore {
    private episodes;
    all(): Episode[];
    ofShow(showId: string): Episode[];
    get(showId: string, id: string): Episode | undefined;
    put(episode: Episode): Episode;
    update(showId: string, id: string, change: Partial<Omit<Episode, 'id' | 'show_id'>>): {
        title: string;
        number?: number;
        state: import("../types.js").EpisodeState;
        id: string;
        show_id: string;
    } | undefined;
    delete(showId: string, id: string): boolean;
}
