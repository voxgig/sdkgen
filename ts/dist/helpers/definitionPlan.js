"use strict";
/* Copyright (c) 2026 Voxgig Ltd, MIT License */
Object.defineProperty(exports, "__esModule", { value: true });
exports.definitionPlan = definitionPlan;
const apidef_1 = require("@voxgig/apidef");
const opShape_1 = require("./opShape");
const pointPath_1 = require("./pointPath");
const resolved_1 = require("./resolved");
const utility_1 = require("../utility");
// The operations every target generates a method for. The model may hold
// others, which no SDK can be called with.
const GENERATED_OPS = opShape_1.CANON_OP_ORDER;
const BODY_OPS = ['create', 'update', 'patch'];
const MAX_ITEMS = 3;
const MAX_DEPTH = 8;
const MAX_SAMPLE = 32 * 1024;
function definitionPlan(ctx$) {
    const model = ctx$?.model;
    const plan = [];
    const unchecked = false === model?.main?.[apidef_1.KIT]?.config?.auth?.active ||
        false === model?.main?.[apidef_1.KIT]?.info?.auth;
    // A generated SDK sends one credential, under the scheme apidef chose for it.
    const own = model?.main?.[apidef_1.KIT]?.info?.security?.scheme;
    // Where prepareAuth puts any key, though LearnWorlds declares no scheme (and
    // its header as a parameter) and open-meteo applies its query key nowhere.
    const ownHeader = !(0, utility_1.isAuthSuppressed)(model) && 'header' === (0, utility_1.resolveAuthIn)(model) ?
        (0, utility_1.resolveAuthName)(model).toLowerCase() : null;
    const ownQuery = !(0, utility_1.isAuthSuppressed)(model) && 'query' === (0, utility_1.resolveAuthIn)(model) ?
        (0, utility_1.resolveAuthName)(model) : null;
    const ownCookie = !(0, utility_1.isAuthSuppressed)(model) && 'cookie' === (0, utility_1.resolveAuthIn)(model) ?
        (0, utility_1.resolveAuthName)(model) : null;
    // A model from before apidef recorded media types sends neither header.
    const recorded = recordsMedia(model);
    for (const entity of Object.values((0, opShape_1.entityCollection)(model))) {
        if (false === entity.active)
            continue;
        for (const [op, operation] of Object.entries(entity.op || {})) {
            // An inactive operation stays in the model but gets no method.
            if (false === operation?.active || !GENERATED_OPS.includes(op))
                continue;
            const points = (operation?.points || []).filter((p) => false !== p.a);
            for (const point of points) {
                if ('graphql' === point.k)
                    continue;
                const facts = (0, resolved_1.pointFacts)(ctx$, point);
                if ('http' !== facts?.protocol)
                    continue;
                // Points the SDK cannot tell apart are selected by order, not input.
                const select = point.q || {};
                const same = points.filter((p) => JSON.stringify(p.q || {}) === JSON.stringify(select));
                if (1 !== same.length)
                    continue;
                const params = Array.isArray(facts.parameters) ? facts.parameters : [];
                const placed = pathPlaceholders(point);
                const args = (point.g?.params || []).map((arg, i) => {
                    const wire = placed[arg.n] ?? (arg.or || arg.n);
                    const def = params.find((p) => 'path' === p?.in && wire === p?.name);
                    return { name: arg.n, wire, value: scalar(def?.example ?? def?.schema?.example) ?? 'p' + (i + 1) };
                });
                // A header argument is sent too, and must arrive as a header under
                // the definition's name, never in the query.
                const headers = (point.g?.header || [])
                    .filter((arg) => false !== arg.a &&
                    ![ownHeader, 'content-type'].includes(String(arg.or || arg.n).toLowerCase()))
                    .map((arg, i) => {
                    const wire = String(arg.or || arg.n);
                    const def = params.find((p) => 'header' === p?.in &&
                        wire.toLowerCase() === String(p?.name).toLowerCase());
                    const shared = args.find((a) => a.name === arg.n);
                    return { name: arg.n, wire, value: shared?.value ?? scalar(arg.ex ?? def?.example ?? def?.schema?.example) ?? 'h' + (i + 1) };
                });
                // A cookie argument is sent too, in the cookie header, never in the
                // query; the credential cookie is left to the credential.
                const cookies = (point.g?.cookie || [])
                    .filter((arg) => false !== arg.a && String(arg.or || arg.n) !== ownCookie)
                    .map((arg, i) => {
                    const wire = String(arg.or || arg.n);
                    const def = params.find((p) => 'cookie' === p?.in && wire === p?.name);
                    const shared = args.find((a) => a.name === arg.n) ?? headers.find((h) => h.name === arg.n);
                    return { name: arg.n, wire, value: shared?.value ?? scalar(arg.ex ?? def?.example ?? def?.schema?.example) ?? 'c' + (i + 1) };
                });
                const selected = {};
                for (const key of select.exist || []) {
                    if (args.some((a) => a.name === key) || headers.some((h) => h.name === key) ||
                        cookies.some((c) => c.name === key))
                        continue;
                    const def = params.find((p) => key === p?.name);
                    selected[key] = scalar(def?.example ?? def?.schema?.example) ?? 'v1';
                }
                // Every query argument is sent too, so a name that goes out in the
                // model's spelling fails even where no point selects on it. One that
                // another point selects on would move the SDK to that point.
                const elsewhere = new Set(points.filter((p) => p !== point)
                    .flatMap((p) => p.q?.exist || []));
                for (const arg of point.g?.query || []) {
                    if (false === arg.a || undefined !== selected[arg.n] || elsewhere.has(arg.n))
                        continue;
                    const shared = cookies.find((c) => c.name === arg.n) ?? headers.find((h) => h.name === arg.n);
                    const def = params.find((p) => 'query' === p?.in && (arg.or || arg.n) === p?.name);
                    selected[arg.n] = shared?.value ?? scalar(arg.ex ?? def?.example ?? def?.schema?.example) ?? 'v1';
                }
                // A create, update or patch sends its input as the body: only a match has a query.
                const queryArgs = BODY_OPS.includes(op) ? [] :
                    (point.g?.query || [])
                        .filter((arg) => undefined !== selected[arg.n] &&
                        !args.some((a) => a.name === arg.n))
                        .map((arg) => ({ name: arg.n, wire: String(arg.or || arg.n) }))
                        .filter((q) => params.some((p) => 'query' === p?.in && q.wire === p?.name));
                const success = successResponse(facts.responses);
                const media = null == success ? undefined : jsonMedia(success.response);
                const responseMedia = recorded ? successMedia(facts) : [];
                const rawBody = recorded && BODY_OPS.includes(op) ?
                    rawRequestBody(facts) : undefined;
                plan.push({
                    entity: entity.name,
                    accessor: (0, apidef_1.nom)(entity, 'Name'),
                    op,
                    method: String(point.m).toUpperCase(),
                    path: point.o,
                    ...(null == select.$action ? {} : { action: select.$action }),
                    args,
                    select: selected,
                    headers,
                    cookies,
                    ...(0 === responseMedia.length ? {} : { responseMedia }),
                    ...(null == rawBody ? {} : { rawBody }),
                    query: params.filter((p) => 'query' === p?.in).map((p) => p.name),
                    queryArgs,
                    auth: unchecked ? null : credentialSets(facts, own),
                    status: success?.status ?? 200,
                    sample: null == media ? null : boundedSample(fitting(sampleOf(media), media.schema)),
                    idField: entity.id?.field || 'id',
                    ...(null == ownQuery ? {} : { ownQuery }),
                });
            }
        }
    }
    return plan;
}
// The definition's name for each path parameter, keyed by the model's. The
// model may rename a placeholder, but it keeps the placeholder's place in the
// path, so position pairs each with its model name whatever `or` holds.
function pathPlaceholders(point) {
    const orig = String(point.o || '').split('/').filter((part) => '' !== part);
    const segments = (0, pointPath_1.pointSegments)(point);
    const out = {};
    if (orig.length !== segments.length)
        return out;
    segments.forEach((seg, i) => {
        const m = /^\{([^}]+)\}$/.exec(orig[i]);
        if (null != seg.var && null != m)
            out[seg.var] = m[1];
    });
    return out;
}
function scalar(value) {
    return 'string' === typeof value || 'number' === typeof value ? value : undefined;
}
function successResponse(responses) {
    if (null == responses || 'object' !== typeof responses)
        return undefined;
    const code = Object.keys(responses).filter((c) => /^2\d\d$/.test(c)).sort()[0] ??
        (null != responses['2XX'] ? '2XX' : undefined);
    return null == code ? undefined :
        { status: '2XX' === code ? 200 : Number(code), response: responses[code] };
}
function jsonMedia(response) {
    const content = response?.content;
    if (null != content && 'object' === typeof content) {
        const type = Object.keys(content).find((t) => /json/i.test(t) || '*/*' === t);
        return null == type ? undefined : content[type];
    }
    // Swagger puts the schema and examples on the response itself.
    if (null != response?.schema || null != response?.examples) {
        return { schema: response.schema, example: response.examples?.['application/json'] };
    }
    return undefined;
}
function recordsMedia(model) {
    return Object.values((0, opShape_1.entityCollection)(model)).some((entity) => Object.values(entity?.op || {}).some((operation) => (operation?.points || []).some((p) => null != p.rs || null != p.rb)));
}
// Every type a success response declares: OpenAPI 3 content, or Swagger's
// `produces` (else JSON) for a response with a schema.
function successMedia(facts) {
    const out = [];
    const add = (types) => types.forEach((t) => out.includes(t) || out.push(t));
    for (const [code, res] of Object.entries(facts.responses || {})) {
        if (!/^2(\d\d|XX)$/i.test(code))
            continue;
        if (null != res?.content && 'object' === typeof res.content) {
            add(Object.keys(res.content));
        }
        else if (null != res?.schema) {
            add(Array.isArray(facts.produces) && 0 < facts.produces.length ?
                facts.produces : ['application/json']);
        }
    }
    return out;
}
// A request body declared in concrete raw types alone, which no SDK may
// encode: no JSON, form, multipart or range.
function rawRequestBody(facts) {
    const content = facts.requestBody?.content;
    const types = null != content && 'object' === typeof content ? Object.keys(content) :
        (facts.parameters || []).some((p) => 'body' === p?.in) && Array.isArray(facts.consumes) ?
            facts.consumes : [];
    const raw = (t) => !/json|^application\/x-www-form-urlencoded|^multipart\/|\*/i
        .test(t.split(';')[0].trim());
    if (0 === types.length || !types.every(raw))
        return undefined;
    return {
        media: types,
        text: types.every((t) => /^text\/|^application\/xml|\+xml/i.test(t.split(';')[0].trim())),
    };
}
function sampleOf(media) {
    if (undefined !== media.example)
        return media.example;
    const named = Object.values(media.examples || {}).find((e) => undefined !== e?.value);
    if (null != named)
        return named.value;
    if (undefined !== media.schema?.example)
        return media.schema.example;
    return synthesize(media.schema, 0);
}
// An example whose top level contradicts its own schema proves nothing, such
// as GitHub's page of deployment rule apps written as a list of its halves.
function fitting(sample, schema) {
    const type = Array.isArray(schema?.type) ?
        schema.type.find((t) => 'null' !== t) : schema?.type;
    const object = 'object' === type || (null == type && null != schema?.properties);
    const array = 'array' === type || (null == type && null != schema?.items);
    if (object && (Array.isArray(sample) || null == sample || 'object' !== typeof sample)) {
        return undefined;
    }
    return array && !Array.isArray(sample) ? undefined : sample;
}
// Schema-shaped data where the definition gives no example: every property, one item
// per array, a union's first branch, an allOf's objects merged, else a value its parts give.
function synthesize(schema, depth) {
    if (null == schema || 'object' !== typeof schema || depth > 6)
        return undefined;
    if (undefined !== schema.example)
        return schema.example;
    if (Array.isArray(schema.enum) && 0 < schema.enum.length)
        return schema.enum[0];
    if (Array.isArray(schema.allOf)) {
        const values = schema.allOf.map((s) => synthesize(s, depth + 1));
        const parts = values.filter((v) => null != v && 'object' === typeof v && !Array.isArray(v));
        if (0 < parts.length)
            return Object.assign({}, ...parts);
        const declared = declaredValue(schema.allOf);
        return undefined !== declared ? declared : values.find((v) => undefined !== v);
    }
    const union = schema.oneOf ?? schema.anyOf;
    if (Array.isArray(union) && 0 < union.length)
        return synthesize(union[0], depth + 1);
    const type = Array.isArray(schema.type) ?
        schema.type.find((t) => 'null' !== t) : schema.type;
    if ('array' === type || null != schema.items) {
        const item = synthesize(schema.items, depth + 1);
        return undefined === item ? [] : [item];
    }
    if ('object' === type || null != schema.properties) {
        const out = {};
        for (const [key, prop] of Object.entries(schema.properties || {})) {
            const value = synthesize(prop, depth + 1);
            if (undefined !== value)
                out[key] = value;
        }
        return out;
    }
    if ('integer' === type || 'number' === type)
        return 1;
    if ('boolean' === type)
        return true;
    if ('string' === type) {
        return 'date-time' === schema.format ? '2026-01-01T00:00:00Z' :
            'date' === schema.format ? '2026-01-01' : 'x';
    }
    return undefined;
}
// Whichever part declares it: an example, then an enum's first value, then a default.
function declaredValue(parts) {
    const schemas = parts.filter((part) => null != part && 'object' === typeof part);
    const shown = schemas.find((part) => undefined !== part.example ||
        (Array.isArray(part.examples) && 0 < part.examples.length));
    if (null != shown)
        return undefined !== shown.example ? shown.example : shown.examples[0];
    const listed = schemas.find((part) => Array.isArray(part.enum) && 0 < part.enum.length);
    if (null != listed)
        return listed.enum[0];
    return schemas.find((part) => undefined !== part.default)?.default;
}
function boundedSample(sample) {
    const bound = (node, depth) => {
        if (null == node || 'object' !== typeof node)
            return node;
        if (depth > MAX_DEPTH)
            return null;
        if (Array.isArray(node))
            return node.slice(0, MAX_ITEMS).map((v) => bound(v, depth + 1));
        return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, bound(v, depth + 1)]));
    };
    const out = bound(sample, 0);
    return undefined === out || MAX_SAMPLE < JSON.stringify(out).length ? null : out;
}
// Alternatives of credentials, every one of a set needed together. Empty is a
// public operation; null is one whose schemes no SDK option can express. Only
// those the SDK's one scheme meets count, so Petstore's OAuth pets are null.
function credentialSets(facts, own) {
    const security = facts.security;
    if (!Array.isArray(security) || 0 === security.length)
        return [];
    if (security.some((req) => null == req || 0 === Object.keys(req).length))
        return [];
    const reqs = 'string' === typeof own && '' !== own ?
        security.filter((req) => Object.keys(req).every((name) => name === own)) : security;
    const schemes = facts.securitySchemes || {};
    const sets = [];
    for (const req of reqs) {
        const set = Object.keys(req).map((name) => credentialOf(schemes[name]));
        if (set.every((c) => null != c))
            sets.push(set);
    }
    return 0 === sets.length ? null : sets;
}
function credentialOf(scheme) {
    const type = String(scheme?.type || '').toLowerCase();
    const http = String(scheme?.scheme || '').toLowerCase();
    if (('http' === type && 'basic' === http) || 'basic' === type) {
        return { in: 'header', name: 'authorization', scheme: 'basic' };
    }
    if (('http' === type && 'bearer' === http) || 'oauth2' === type || 'openidconnect' === type) {
        return { in: 'header', name: 'authorization', scheme: 'bearer' };
    }
    if ('apikey' === type && 'string' === typeof scheme.name &&
        ['header', 'query', 'cookie'].includes(scheme.in)) {
        return { in: scheme.in, name: 'header' === scheme.in ? scheme.name.toLowerCase() : scheme.name };
    }
    return undefined;
}
//# sourceMappingURL=definitionPlan.js.map