import { ifRangeHolds, noneMatch, parseRange } from './content/conditional.js';
function displayType(type) {
    return type.startsWith('text/') ? `${type}; charset=utf-8` : type;
}
export function planDownload(method, headers, slot, options) {
    const { info } = slot;
    const one = (name) => {
        const v = headers[name];
        return Array.isArray(v) ? v.join(', ') : v;
    };
    const isGet = 'GET' === method;
    const base = { etag: info.etag };
    const full = {
        ...base,
        'content-type': displayType(info.type),
        'repr-digest': info.digest,
    };
    if (options.ranges)
        full['accept-ranges'] = 'bytes';
    if (options.disposition)
        full['content-disposition'] = options.disposition;
    if (options.conditional && noneMatch(one('if-none-match'), info.etag)) {
        return { status: 304, headers: base, start: 0, end: 0, body: false };
    }
    if (options.ranges && isGet && ifRangeHolds(one('if-range'), info.etag)) {
        const range = parseRange(one('range'), info.size);
        if ('unsatisfiable' === range.kind) {
            return {
                status: 416,
                headers: { 'content-range': `bytes */${info.size}` },
                start: 0,
                end: 0,
                body: false,
            };
        }
        if ('range' === range.kind) {
            const end = range.end + 1;
            return {
                status: 206,
                headers: {
                    ...full,
                    'content-range': `bytes ${range.start}-${range.end}/${info.size}`,
                    'content-length': String(end - range.start),
                },
                start: range.start,
                end,
                body: true,
            };
        }
    }
    return {
        status: 200,
        headers: { ...full, 'content-length': String(info.size) },
        start: 0,
        end: info.size,
        body: isGet,
    };
}
export async function sendDownload(request, reply, slot, options, intercept) {
    const download = planDownload(request.method, request.headers, slot, options);
    let event = {
        request,
        slot,
        download,
        stream: download.body ? slot.content.read(download.start, download.end) : undefined,
    };
    if (intercept.download)
        event = await intercept.download(event);
    const { status, headers } = event.download;
    if (416 === status) {
        reply.code(416).headers(headers);
        return reply.send({ error: 'RangeNotSatisfiable', message: headers['content-range'] });
    }
    reply.code(status).headers(headers);
    return event.stream ? reply.send(event.stream) : reply.send();
}
//# sourceMappingURL=transfer.js.map