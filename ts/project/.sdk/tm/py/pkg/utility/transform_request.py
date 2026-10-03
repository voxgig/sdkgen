# ProjectName SDK utility: transform_request

from __future__ import annotations
from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.core.helpers import to_map
from projectname_sdk.utility.param import call_args


# `$action` selects the point (see make_point_util); it is never an API field,
# so the body is a copy without it. The caller's dict is left untouched.
def _strip_action(reqdata):
    return _omit(reqdata, ["$action"])


# A header or query argument travels where prepare_headers_util or
# prepare_query_util sends it, so the body is built from the request data
# without it.
def _routed_arg_names(ctx):
    return [name for name, _orig, _val in
            call_args(ctx, "header") + call_args(ctx, "cookie") + call_args(ctx, "query")]


def _omit(reqdata, names):
    if not isinstance(reqdata, dict) or not any(n in reqdata for n in names):
        return reqdata
    return {k: v for k, v in reqdata.items() if k not in names}


def transform_request_util(ctx):
    spec = ctx.spec
    point = ctx.point

    if spec is not None:
        spec.step = "reqform"

    data = _omit(ctx.reqdata, _routed_arg_names(ctx))

    transform = to_map(vs.getprop(point, "transform"))
    if transform is None:
        return _strip_action(data)

    reqform = vs.getprop(transform, "req")
    if reqform is None:
        return _strip_action(data)

    reqdata = vs.transform({
        "reqdata": data,
    }, reqform)

    return _strip_action(reqdata)
