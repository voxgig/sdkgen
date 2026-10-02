# ProjectName SDK utility: param

from __future__ import annotations
from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.core.helpers import to_map


def param_util(ctx, paramdef):
    point = ctx.point
    spec = ctx.spec
    match = ctx.match
    reqmatch = ctx.reqmatch
    data = ctx.data
    reqdata = ctx.reqdata

    pt = vs.typify(paramdef)
    key = ""

    if (vs.T_string & pt) > 0:
        key = paramdef
    else:
        k = vs.getprop(paramdef, "name")
        if isinstance(k, str):
            key = k

    akey = ""
    if point is not None:
        alias = to_map(vs.getprop(point, "alias"))
        if alias is not None:
            ak = vs.getprop(alias, key)
            if isinstance(ak, str):
                akey = ak

    val = vs.getprop(reqmatch, key)

    if val is None:
        val = vs.getprop(match, key)

    if val is None and akey != "":
        if spec is not None:
            spec.alias[akey] = key
        val = vs.getprop(reqmatch, akey)

    if val is None:
        val = vs.getprop(reqdata, key)

    if val is None:
        val = vs.getprop(data, key)

    if val is None and akey != "":
        val = vs.getprop(reqdata, akey)
        if val is None:
            val = vs.getprop(data, akey)

    return val


# The arguments a point declares in one location, query or header, each with
# the name it travels under and the value this call passes in its match or
# else its data. Unlike a path parameter, the entity's stored match and data
# never supply one.
def call_args(ctx, kind):
    out = []
    defs = vs.getpath(ctx.point, "args." + kind) if ctx.point is not None else None
    if isinstance(defs, list):
        for ad in defs:
            name = vs.getprop(ad, "name")
            if not isinstance(name, str) or name == "":
                continue
            wire = vs.getprop(ad, "orig")
            if not isinstance(wire, str) or wire == "":
                wire = name
            val = vs.getprop(ctx.reqmatch or {}, name)
            if val is None:
                val = vs.getprop(ctx.reqdata or {}, name)
            out.append((name, wire, val))
    return out
