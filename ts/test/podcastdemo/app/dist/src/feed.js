export const FEED_TYPE = 'application/rss+xml';
export function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}
export function renderFeed(base, show, episodes) {
    const showUrl = `${base}/api/show/${encodeURIComponent(show.id)}`;
    const items = episodes
        .filter((e) => 'published' === e.state)
        .sort((a, b) => (a.number ?? 0) - (b.number ?? 0) || a.id.localeCompare(b.id))
        .map((e) => {
        const audio = e.audio
            ? `\n      <enclosure url="${escapeXml(`${showUrl}/episode/${encodeURIComponent(e.id)}/audio`)}" length="${e.audio.size}" type="${escapeXml(e.audio.type)}"/>`
            : '';
        return [
            '    <item>',
            `      <title>${escapeXml(e.title)}</title>`,
            `      <guid isPermaLink="false">${escapeXml(e.id)}</guid>${audio}`,
            '    </item>',
        ].join('\n');
    });
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0">',
        '  <channel>',
        `    <title>${escapeXml(show.name)}</title>`,
        `    <link>${escapeXml(showUrl)}</link>`,
        `    <description>${escapeXml(`${show.name}, by ${show.author}`)}</description>`,
        ...(show.language ? [`    <language>${escapeXml(show.language)}</language>`] : []),
        ...items,
        '  </channel>',
        '</rss>',
        '',
    ].join('\n');
}
//# sourceMappingURL=feed.js.map