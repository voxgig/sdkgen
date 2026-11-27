import type { EpisodeView, ShowView } from './types.js';
export declare const FEED_TYPE = "application/rss+xml";
export declare function escapeXml(text: string): string;
export declare function renderFeed(base: string, show: ShowView, episodes: EpisodeView[]): string;
