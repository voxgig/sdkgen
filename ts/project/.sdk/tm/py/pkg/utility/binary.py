# ProjectName SDK utility: binary

from __future__ import annotations

from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.core.binary import is_bytes, is_source, is_stream
from projectname_sdk.utility.media import RAW_BODY


MAXDEPTH = 32


# The path of the first source in a value, or None.
def _source_at(value, path, depth, seen):
    if value is None or MAXDEPTH <= depth or id(value) in seen:
        return None
    if is_source(value):
        return path
    if is_bytes(value) or is_stream(value) or isinstance(value, str):
        return None
    if isinstance(value, dict):
        entries = [(str(k), v) for k, v in value.items()]
    elif isinstance(value, (list, tuple)):
        entries = [(str(i), v) for i, v in enumerate(value)]
    else:
        return None
    seen = seen | {id(value)}
    for key, item in entries:
        found = _source_at(item, key if "" == path else path + "." + key, depth + 1, seen)
        if found is not None:
            return found
    return None


# The data keys whose values are file content: a multipart or form body's
# binary fields, and the whole of a raw body.
def binary_names(point):
    body = vs.getprop(point, "body")
    kind = vs.getprop(body, "kind")
    if "raw" == kind:
        return [RAW_BODY]
    if kind in ("multipart", "form"):
        fields = vs.getprop(body, "fields")
        return [f["name"] for f in (fields if isinstance(fields, list) else [])
                if isinstance(f, dict) and f.get("binary") is True and isinstance(f.get("name"), str)]
    return []


# Moves the values of binary fields out of the request data, before a hook,
# a transform, validation or clean reads it. A source anywhere else is refused.
def lift_sources(ctx):
    if getattr(ctx, "sources", None) is not None:
        return None

    names = binary_names(ctx.point)
    lifted = {}
    reqdata = ctx.reqdata

    if isinstance(reqdata, dict) and any(name in reqdata for name in names):
        reqdata = dict(reqdata)
        for name in names:
            if name in reqdata:
                lifted[name] = reqdata.pop(name)

    stray = _source_at(reqdata, "", 0, frozenset())
    if stray is None:
        stray = _source_at(ctx.reqmatch, "", 0, frozenset())
    if stray is not None:
        return ctx.make_error("binary_source_refused", 'A binary source was passed in "' +
                              stray + '", which is not a field the operation declares binary.')

    ctx.reqdata = reqdata
    ctx.sources = lifted
    return None


# A response the model declares to be bytes is read only through the entity's
# binary handle, never into its data.
def bytes_refused(ctx):
    response = vs.getprop(ctx.point, "response")
    transfer = getattr(ctx.ctrl, "transfer", None) if ctx.ctrl is not None else None
    if "raw" != vs.getprop(response, "kind") or vs.getprop(response, "binary") is not True \
            or transfer is not None:
        return None
    action = vs.getprop(vs.getprop(ctx.point, "select"), "$action")
    call = "binary()" if action is None else "binary('" + str(action) + "')"
    op = ctx.op
    return ctx.make_error("binary_sink_required", 'Operation "' + str(getattr(op, "name", None)) +
                          '" on entity "' + str(getattr(op, "entity", None)) +
                          "\" answers bytes, which never enter the entity's data: read them with " +
                          "entity." + call + ".bytes().")
