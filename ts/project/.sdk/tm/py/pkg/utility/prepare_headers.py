# ProjectName SDK utility: prepare_headers

from __future__ import annotations
from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.utility.param import call_args
from projectname_sdk.utility.media import media_headers


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

    # A cookie argument travels in the cookie header as name=value, after any
    # cookies the caller's headers already send.
    cookies = [orig + "=" + vs.stringify(val)
               for _name, orig, val in call_args(ctx, "cookie") if val is not None]
    if cookies:
        given = [k for k in out if isinstance(k, str) and k.lower() == "cookie"]
        sent = [out[k] for k in given if isinstance(out[k], str) and out[k] != ""]
        for key in given:
            del out[key]
        out["cookie"] = "; ".join(sent + cookies)

    return out
