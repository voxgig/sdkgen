import type { Config } from './config.js';
import { EpisodeStore, ShowStore } from './store/RecordStore.js';
import { SlotStore } from './store/SlotStore.js';
import { UploadStore } from './store/UploadStore.js';
import type { Intercept } from './transfer.js';
import type { Episode, EpisodeView, Show, ShowView } from './types.js';
export interface AppContext {
    config: Config;
    shows: ShowStore;
    episodes: EpisodeStore;
    slots: SlotStore;
    uploads: UploadStore;
    intercept: Intercept;
}
export declare function makeContext(config: Config, intercept?: Intercept): AppContext;
export declare const showSlot: (id: string, slot: 'artwork') => string;
export declare const episodeSlot: (id: string, slot: 'audio' | 'transcript') => string;
export declare function showView(ctx: AppContext, show: Show): ShowView;
export declare function episodeView(ctx: AppContext, episode: Episode): EpisodeView;
export declare function findShow(ctx: AppContext, id: string): Show;
export declare function findEpisode(ctx: AppContext, showId: string, id: string): Episode;
export declare function removeEpisode(ctx: AppContext, episode: Episode): void;
export declare function removeShow(ctx: AppContext, show: Show): void;
