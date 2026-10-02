# ProjectName SDK utility: prepare_headers

from __future__ import annotations
from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.utility.param import call_args


def prepare_headers_util(ctx):
    options = ctx.client.options_map()
    headers = vs.getprop(options, "headers")

    out = {}
    if headers is not None:
        cloned = vs.clone(headers)
        if isinstance(cloned, dict):
            out = cloned

    # A header argument replaces a default of the same name, whatever its case.
    for _name, orig, val in call_args(ctx, "header"):
        if val is not None:
            wire = orig.lower()
            for key in [k for k in out if isinstance(k, str) and k.lower() == wire]:
                del out[key]
            out[wire] = vs.stringify(val)

    return out
