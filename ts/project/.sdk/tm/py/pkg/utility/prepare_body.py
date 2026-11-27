# ProjectName SDK utility: prepare_body

from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.core.binary import is_source
from projectname_sdk.utility.binary import lift_sources
from projectname_sdk.utility.media import RAW_BODY, is_raw_request, raw_body


def prepare_body_util(ctx):
    op = ctx.op

    if op.input == "data":
        refused = lift_sources(ctx)
        if refused is not None:
            return ctx.utility.make_error(ctx, refused)

        if is_raw_request(ctx.point):
            raw = (ctx.sources or {}).get(RAW_BODY)
            return raw.data if is_source(raw) else raw_body(ctx.sources)

        body = ctx.utility.transform_request(ctx)

        kind = vs.getpath(ctx.point, "body.kind")
        if kind in ("form", "multipart"):
            return _encode_body(ctx, kind, body)
        return body

    fields = vs.getprop(ctx.point, "fields") if ctx.point is not None else None
    if isinstance(fields, list) and 0 < len(fields):
        return _match_body(ctx, fields)

    return None


# The encoded body, with its content type replacing any the headers carry:
# a multipart boundary is the encoder's alone to choose.
def _encode_body(ctx, kind, data):
    encode = (ctx.utility.codec or {}).get(kind)
    if not callable(encode):
        return ctx.utility.make_error(ctx, ctx.make_error(
            "body_codec_missing", "This SDK was generated without a " + kind + " encoder."))

    encoded, err = encode(ctx, data, ctx.sources or {})
    if err is not None:
        return ctx.utility.make_error(ctx, err)

    headers = ctx.spec.headers if ctx.spec is not None else None
    if isinstance(headers, dict):
        for key in [k for k in headers if isinstance(k, str) and "content-type" == k.lower()]:
            del headers[key]
        headers["content-type"] = encoded["type"]

    return encoded["body"]


# A list, load or remove routed to a method with a body sends the match
# fields that body declares, never a path parameter, and never a header,
# cookie or query argument the body does not also declare as a field.
def _match_body(ctx, fields):
    point = ctx.point
    params = vs.getprop(point, "params")
    routed = list(params) if isinstance(params, list) else []
    for kind in ("params", "header", "cookie", "query"):
        defs = vs.getpath(point, "args." + kind)
        if isinstance(defs, list):
            routed += [vs.getprop(ad, "name") for ad in defs
                       if kind == "params" or vs.getprop(ad, "field") is not True]

    body = {}
    for name in fields:
        val = vs.getprop(ctx.reqmatch or {}, name)
        if val is not None and name != "$action" and name not in routed:
            body[name] = val
    return body
