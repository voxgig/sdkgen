# ProjectName SDK utility: prepare_body

from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.utility.media import is_raw_request, raw_body


def prepare_body_util(ctx):
    op = ctx.op

    if op.input == "data":
        if is_raw_request(ctx.point):
            return raw_body(ctx.reqdata)
        body = ctx.utility.transform_request(ctx)
        return body

    fields = vs.getprop(ctx.point, "fields") if ctx.point is not None else None
    if isinstance(fields, list) and 0 < len(fields):
        return _match_body(ctx, fields)

    return None


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
