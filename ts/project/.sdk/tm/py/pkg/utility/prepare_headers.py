# ProjectName SDK utility: prepare_headers

from __future__ import annotations
from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.utility.param import call_args
from projectname_sdk.utility.media import media_headers


# The form style of a cookie parameter: a list repeats the name, a map sends
# its own keys, and every value is percent-encoded.
def _cookie_pair(wire, val):
    def esc(v):
        return vs.escurl(vs.stringify(v))
    if vs.islist(val):
        pairs = [wire + "=" + esc(item) for item in val]
    elif vs.ismap(val):
        pairs = [vs.escurl(key) + "=" + esc(val[key]) for key in vs.keysof(val)]
    else:
        pairs = [wire + "=" + esc(val)]
    return "&".join(pairs)


def prepare_headers_util(ctx):
    options = ctx.client.options_map()
    headers = vs.getprop(options, "headers")

    out = {}
    if headers is not None:
        cloned = vs.clone(headers)
        if isinstance(cloned, dict):
            out = cloned
    out = media_headers(ctx.point, out)

    # A header argument replaces a default of the same name, whatever its case.
    for _name, orig, val in call_args(ctx, "header"):
        if val is not None:
            wire = orig.lower()
            for key in [k for k in out if isinstance(k, str) and k.lower() == wire]:
                del out[key]
            out[wire] = vs.stringify(val)

    # A cookie argument travels in the cookie header, form serialized and
    # percent-encoded, replacing a cookie of the same name among those the
    # caller's headers already send.
    sent = [(orig, val) for _name, orig, val in call_args(ctx, "cookie") if val is not None]
    if sent:
        names = [n for orig, val in sent
                 for n in ([vs.escurl(k) for k in vs.keysof(val)] if vs.ismap(val) else [orig])]
        kept = []
        for key in [k for k in out if isinstance(k, str) and k.lower() == "cookie"]:
            given = out.pop(key)
            if isinstance(given, str):
                for piece in given.split(";"):
                    rest = [pair.strip() for pair in piece.split("&")]
                    rest = [pair for pair in rest if pair != "" and pair.split("=", 1)[0].strip() not in names]
                    if rest:
                        kept.append("&".join(rest))
        for orig, val in sent:
            pair = _cookie_pair(orig, val)
            if pair != "":
                kept.append(pair)
        if kept:
            out["cookie"] = "; ".join(kept)

    return out
