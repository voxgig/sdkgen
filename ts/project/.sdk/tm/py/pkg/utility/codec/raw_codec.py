# ProjectName SDK body codec: a raw body read to maxBuffer

from __future__ import annotations
import re

from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.core.binary import is_bytes, to_bytes
from projectname_sdk.utility.media import RAW_BODY, header_value
from projectname_sdk.schema import OPTSPEC


DEFAULT_MAX_BUFFER = 16777216

_CHUNK = 65536


def max_buffer(ctx):
    for val in (vs.getprop(ctx.options, "maxBuffer"), vs.getprop(OPTSPEC, "maxBuffer")):
        if isinstance(val, (int, float)) and not isinstance(val, bool) and 0 <= val:
            return int(val)
    return DEFAULT_MAX_BUFFER


def _cancel(body):
    close = getattr(body, "close", None)
    if callable(close):
        try:
            close()
        except Exception:
            pass


def _too_large(ctx, code, limit, declared=None):
    what = "is longer than" if declared is None else "of " + str(declared) + " bytes exceeds"
    return ctx.make_error(code, "response: body " + what + " maxBuffer (" + str(limit) + " bytes)")


def _chunks(body):
    read = getattr(body, "read", None)
    if callable(read):
        while True:
            chunk = read(_CHUNK)
            if not chunk:
                return
            yield chunk
    else:
        yield from body


# The whole body, refused past the bound: by its declared length before a
# byte is read, else by the count as it arrives.
def read_bounded(ctx, response, limit, code):
    body = response.body
    length = header_value(response.headers, "content-length").strip()
    declared = int(length) if re.fullmatch(r"\d+", length) else None

    if declared is not None and limit < declared:
        _cancel(body)
        raise _too_large(ctx, code, limit, declared)

    if body is None:
        return b""
    if isinstance(body, str) or is_bytes(body):
        data = to_bytes(body)
        if limit < len(data):
            raise _too_large(ctx, code, limit)
        return data

    parts = []
    count = 0
    try:
        for chunk in _chunks(body):
            data = to_bytes(chunk)
            count += len(data)
            if limit < count:
                raise _too_large(ctx, code, limit)
            parts.append(data)
    finally:
        _cancel(body)
    return b"".join(parts)


# A raw success body: text into the record under `$body`; bytes only into a
# binary handle's read, never into the record.
def read_raw(ctx):
    response = ctx.response
    result = ctx.result
    transfer = getattr(ctx.ctrl, "transfer", None) if ctx.ctrl is not None else None
    limit = max_buffer(ctx)

    if vs.getpath(ctx.point, "response.binary") is True:
        result.body = None
        if isinstance(transfer, dict) and "read" == transfer.get("direction"):
            transfer["bytes"] = read_bounded(ctx, response, limit, "binary_too_large")
        else:
            _cancel(response.body)
        return

    data = read_bounded(ctx, response, limit, "response_too_large")
    result.body = {RAW_BODY: data.decode("utf-8", errors="replace")}
