// A single byte range. A header this does not understand, including a
// multi-range request, is ignored, as HTTP semantics permit.
export function parseRange(header, size) {
    if (undefined == header)
        return { kind: 'none' };
    const m = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(header);
    if (!m || ('' === m[1] && '' === m[2]))
        return { kind: 'none' };
    if ('' === m[1]) {
        const suffix = Number(m[2]);
        if (0 === suffix || 0 === size)
            return { kind: 'unsatisfiable' };
        return { kind: 'range', start: Math.max(0, size - suffix), end: size - 1 };
    }
    const start = Number(m[1]);
    const last = '' === m[2] ? Infinity : Number(m[2]);
    if (last < start)
        return { kind: 'none' };
    if (start >= size)
        return { kind: 'unsatisfiable' };
    return { kind: 'range', start, end: Math.min(last, size - 1) };
}
function parseTag(text) {
    const m = /^\s*(W\/)?("[^"]*")\s*$/.exec(text);
    return m ? { weak: !!m[1], opaque: m[2] } : null;
}
function tagList(header) {
    if ('*' === header.trim())
        return '*';
    return header
        .split(',')
        .map(parseTag)
        .filter((t) => null != t);
}
export function noneMatch(header, etag) {
    if (undefined == header)
        return false;
    const tags = tagList(header);
    if ('*' === tags)
        return true;
    return tags.some((t) => t.opaque === etag);
}
// Strong comparison; `current` undefined means the representation is absent.
export function matches(header, current) {
    if (undefined == header)
        return true;
    const tags = tagList(header);
    if (undefined == current)
        return false;
    if ('*' === tags)
        return true;
    return tags.some((t) => !t.weak && t.opaque === current);
}
// A date, or a weak or different tag, means the range is not honoured.
export function ifRangeHolds(header, etag) {
    if (undefined == header)
        return true;
    const tag = parseTag(header);
    return null != tag && !tag.weak && tag.opaque === etag;
}
//# sourceMappingURL=conditional.js.map