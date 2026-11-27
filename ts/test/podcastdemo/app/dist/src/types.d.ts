export interface FileInfo {
    size: number;
    type: string;
    etag: string;
    digest: string;
    modified: string;
}
export interface Show {
    id: string;
    name: string;
    author: string;
    language?: string;
}
export type EpisodeState = 'draft' | 'published';
export interface Episode {
    id: string;
    show_id: string;
    title: string;
    number?: number;
    state: EpisodeState;
}
export type UploadSlot = 'audio' | 'transcript';
export interface Upload {
    id: string;
    show_id: string;
    episode_id: string;
    slot: UploadSlot;
    size: number;
    type: string;
    digest?: string;
    offset: number;
    complete: boolean;
    expires: string;
}
export interface ShowView extends Show {
    artwork?: FileInfo;
}
export interface EpisodeView extends Episode {
    audio?: FileInfo;
    transcript?: FileInfo;
}
export interface SeedData {
    show: Record<string, Show & {
        artwork?: {
            seed: number;
            width: number;
            height: number;
        };
    }>;
    episode: Record<string, Omit<Episode, 'state'> & {
        state?: EpisodeState;
        audio: {
            seed: number;
            size: number;
        };
        transcript?: string;
    }>;
}
