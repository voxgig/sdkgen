"use strict";
/* Copyright (c) 2026 Voxgig Ltd, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RAW_BODY = void 0;
exports.bodyNote = bodyNote;
exports.opRawBody = opRawBody;
exports.opRequestBody = opRequestBody;
const jostraca_1 = require("jostraca");
// A point's `rb` and `rs` reach the generated config as `body` and `response`.
const RAW_BODY = '$body';
exports.RAW_BODY = RAW_BODY;
// The bodies an operation's active points declare that are not JSON.
function opBodies(op) {
    const points = op?.points ? (0, jostraca_1.each)(op.points) : [];
    return points
        .filter((pt) => false !== pt?.a)
        .map((pt) => pt?.rb)
        .filter((rb) => null != rb && 'json' !== rb.kind);
}
// A raw body first: it is the one that needs the caller's `$body`.
function opRequestBody(op) {
    const bodies = opBodies(op);
    return bodies.find((rb) => 'raw' === rb.kind) || bodies[0];
}
function opRawBody(op) {
    const rb = opRequestBody(op);
    return 'raw' === rb?.kind ? rb : undefined;
}
function codeList(types) {
    return types.map((t) => '`' + t + '`').join(', ');
}
// The reference note for a body that is not JSON. `values` names what the
// target accepts as `$body`, `once` the stream among them, `binary: false` a
// target without bytes, `tier` its codec tier, and `source` how a caller
// builds a file part.
function bodyNote(op, target) {
    const rb = opRequestBody(op);
    if (null == rb || 'string' !== typeof rb.media) {
        return '';
    }
    const encodes = ENCODING_TIERS.includes(String(target.tier));
    if ('raw' !== rb.kind) {
        if (!encodes) {
            return 'Declares a `' + rb.media + '` body, which this SDK does not encode yet: ' +
                'it sends the data as JSON.\n\n';
        }
        return encodedNote(rb, target);
    }
    if (true === rb.binary && false === target.binary) {
        return 'Declares a binary `' + rb.media + '` body, which this SDK cannot send yet.\n\n';
    }
    const others = (Array.isArray(rb.alternatives) ? rb.alternatives : [])
        .map((alt) => alt?.media).filter((m) => 'string' === typeof m);
    const encoded = encodes ? [] : opBodies(op).filter((b) => 'raw' !== b.kind)
        .map((b) => b.media).filter((m) => 'string' === typeof m);
    return 'Sends its body unencoded, as `' + rb.media + '`: pass it as `' + RAW_BODY +
        '`, ' + target.values + '.' +
        (null == target.once ? '' : ' ' + target.once.charAt(0).toUpperCase() + target.once.slice(1) +
            ' is read in full before the request is sent, so that a retry sends the same bytes.') +
        (0 < others.length ? ' The operation also accepts ' + codeList(others) +
            ': a `content-type` header option that is not JSON replaces the declared one.' : '') +
        (0 < encoded.length ? ' Its other endpoints declare ' + codeList(encoded) +
            ' bodies, which this SDK sends as JSON.' : '') +
        '\n\n';
}
const ENCODING_TIERS = ['encoded', 'streamed', 'resumable'];
function encodedNote(rb, target) {
    const fields = Array.isArray(rb.fields) ? rb.fields : [];
    const files = fields.filter((f) => true === f?.binary).map((f) => String(f.name));
    const how = 'form' === rb.kind ? 'form-encoded' : 'as multipart parts';
    return 'Sends its data ' + how + ', as `' + rb.media + '`.' +
        (0 < files.length ? ' ' + (1 === files.length ? 'The field ' : 'The fields ') +
            codeList(files) + ' ' + (1 === files.length ? 'carries' : 'carry') +
            ' a file: pass ' + (target.source ?? 'a binary source') +
            ', or bytes; a string there is sent as its content, never read as a path.' : '') +
        '\n\n';
}
//# sourceMappingURL=media.js.map