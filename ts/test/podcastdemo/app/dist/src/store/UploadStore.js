import { newId } from './RecordStore.js';
export class UploadStore {
    ttlMs;
    sessions = new Map();
    constructor(ttlMs) {
        this.ttlMs = ttlMs;
    }
    sweep(now) {
        for (const [id, s] of this.sessions) {
            if (Date.parse(s.expires) <= now)
                this.sessions.delete(id);
        }
    }
    count(now = Date.now()) {
        this.sweep(now);
        return this.sessions.size;
    }
    create(spec, now = Date.now()) {
        const session = {
            ...spec,
            id: newId(),
            offset: 0,
            complete: false,
            expires: new Date(now + this.ttlMs).toISOString(),
            chunks: [],
        };
        this.sessions.set(session.id, session);
        return view(session);
    }
    get(id, now = Date.now()) {
        this.sweep(now);
        const session = this.sessions.get(id);
        return session ? view(session) : undefined;
    }
    append(id, offset, bytes) {
        const session = this.sessions.get(id);
        if (!session)
            return undefined;
        if (offset !== session.offset)
            return { kind: 'conflict', offset: session.offset };
        if (session.offset + bytes.length > session.size)
            return { kind: 'too-large' };
        if (0 < bytes.length)
            session.chunks.push(Buffer.from(bytes));
        session.offset += bytes.length;
        if (session.offset === session.size && !session.complete) {
            session.complete = true;
            const whole = Buffer.concat(session.chunks);
            session.chunks = [];
            return { kind: 'complete', upload: view(session), bytes: whole };
        }
        return { kind: 'appended', upload: view(session) };
    }
    // After a failed integrity check the session starts again from zero.
    restart(id) {
        const session = this.sessions.get(id);
        if (session) {
            session.chunks = [];
            session.offset = 0;
            session.complete = false;
        }
    }
    delete(id) {
        return this.sessions.delete(id);
    }
    deleteWhere(test) {
        for (const [id, s] of this.sessions) {
            if (test(s))
                this.sessions.delete(id);
        }
    }
}
function view(session) {
    const { chunks: _chunks, ...upload } = session;
    return upload;
}
//# sourceMappingURL=UploadStore.js.map