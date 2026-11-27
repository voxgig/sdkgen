# ProjectName SDK body codec: multipart/form-data

from __future__ import annotations
import re
import secrets

from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.core.binary import body_items, is_bytes, is_source, is_stream, item_text, to_bytes


MULTIPART_MEDIA = "multipart/form-data"

OCTET_MEDIA = "application/octet-stream"

CRLF = "\r\n"

_QUOTED = {"\\": "%5C", '"': "%22", "\r": "%0D", "\n": "%0A"}


def multipart_boundary(_ctx=None):
    return secrets.token_hex(16)


# Inside a quoted header parameter nothing may end the quote or the line.
def quoted(text):
    return re.sub(r'[\\"\r\n]', lambda m: _QUOTED[m.group(0)], text)


# A local path never leaves: only its last segment, and nothing for an empty one.
def base_name(name):
    if not isinstance(name, str):
        return None
    base = re.split(r"[\\/]", name)[-1]
    return None if "" == base else base


def _file_part(ctx, name, field, value):
    content = value
    filename = None
    mtype = None

    if is_source(value):
        content = value.data
        filename = base_name(value.name)
        mtype = value.type

    if is_stream(content):
        return None, ctx.make_error("binary_feature_inactive", 'The multipart field "' + name +
                                    '" holds a stream, which needs the binary feature: ' +
                                    "pass bytes, a Blob or a source.")

    if mtype is None:
        mtype = field.get("media") if isinstance(field.get("media"), str) else OCTET_MEDIA
    return {"name": name, "filename": filename, "type": mtype,
            "content": to_bytes(content) if is_bytes(content) else to_bytes(item_text(content))}, None


def _text_part(name, field, value):
    mtype = field.get("media")
    return {"name": name, "filename": None, "type": mtype if isinstance(mtype, str) else None,
            "content": to_bytes(value) if is_bytes(value) else to_bytes(item_text(value))}


def encode_multipart(ctx, data, lifted):
    body = vs.getprop(ctx.point, "body")
    boundary_of = getattr(ctx.utility, "multipart_boundary", None) or multipart_boundary
    boundary = boundary_of(ctx)
    chunks = []

    for item in body_items(body, data, lifted):
        if item["binary"]:
            part, err = _file_part(ctx, item["name"], item["field"], item["value"])
            if err is not None:
                return None, err
        else:
            part = _text_part(item["name"], item["field"], item["value"])

        if isinstance(part["type"], str) and re.search(r"[\r\n]", part["type"]):
            return None, ctx.make_error("binary_source_refused",
                                        'The media type of the multipart field "' + item["name"] +
                                        '" contains a line break.')

        head = ("--" + boundary + CRLF +
                'Content-Disposition: form-data; name="' + quoted(part["name"]) + '"' +
                ("" if part["filename"] is None else '; filename="' + quoted(part["filename"]) + '"') +
                CRLF + ("" if part["type"] is None else "Content-Type: " + part["type"] + CRLF) + CRLF)
        chunks += [head.encode("utf-8"), part["content"], CRLF.encode("utf-8")]

    chunks.append(("--" + boundary + "--" + CRLF).encode("utf-8"))

    media = vs.getprop(body, "media")
    declared = media.split(";")[0].strip() if isinstance(media, str) else ""
    mtype = (declared or MULTIPART_MEDIA) + "; boundary=" + boundary
    return {"type": mtype, "body": b"".join(chunks)}, None
