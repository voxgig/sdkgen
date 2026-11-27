# ProjectName SDK body codec: application/x-www-form-urlencoded

from __future__ import annotations

from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.core.binary import body_items, is_bytes, is_source, is_stream, item_text, to_bytes


FORM_MEDIA = "application/x-www-form-urlencoded"

_HEX = "0123456789ABCDEF"

_SAFE = frozenset(b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz*-._")


# Byte serialisation: alphanumerics and `*-._` as they are, a space as `+`,
# every other byte as %HH.
def form_escape(data):
    out = []
    for byte in data:
        if byte in _SAFE:
            out.append(chr(byte))
        elif 0x20 == byte:
            out.append("+")
        else:
            out.append("%" + _HEX[byte >> 4] + _HEX[byte & 15])
    return "".join(out)


def _form_value(ctx, name, value):
    content = value.data if is_source(value) else value
    if is_stream(content):
        return None, ctx.make_error("binary_source_refused", 'The form field "' + name +
                                    '" holds a Blob or a stream, which a form body cannot carry: ' +
                                    "pass its bytes.")
    return (to_bytes(content) if is_bytes(content) else to_bytes(item_text(content))), None


def encode_form(ctx, data, lifted):
    body = vs.getprop(ctx.point, "body")
    pairs = []

    for item in body_items(body, data, lifted):
        value, err = _form_value(ctx, item["name"], item["value"])
        if err is not None:
            return None, err
        pairs.append(form_escape(to_bytes(item["name"])) + "=" + form_escape(value))

    media = vs.getprop(body, "media")
    media = media if isinstance(media, str) and "" != media else FORM_MEDIA
    return {"type": media, "body": "&".join(pairs)}, None
