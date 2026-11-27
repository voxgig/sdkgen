# ProjectName SDK binary sources

from __future__ import annotations
import json
import math


# File content a caller hands the SDK, held as given. A string is content,
# sent encoded as UTF-8: nothing here reads a path.
class BinarySource:
    kind = "bytes"

    def __init__(self, data, opts=None):
        opts = opts if isinstance(opts, dict) else {}
        self.data = data
        name = opts.get("name")
        self.name = name if isinstance(name, str) else None
        mtype = opts.get("type")
        self.type = mtype if isinstance(mtype, str) and "" != mtype else None

    @property
    def size(self):
        return len(self.data)

    # A source serialised anywhere is described, never copied.
    def to_json(self):
        desc = {"binary$": "bytes", "size": self.size}
        if self.type is not None:
            desc["type"] = self.type
        return desc

    def __repr__(self):
        return "BinarySource(" + json.dumps(self.to_json()) + ")"


def is_bytes(value):
    return isinstance(value, (bytes, bytearray, memoryview))


def is_stream(value):
    return not isinstance(value, type) and callable(getattr(value, "read", None))


def is_source(value):
    return isinstance(value, BinarySource)


def to_bytes(value):
    if isinstance(value, bytes):
        return value
    if isinstance(value, (bytearray, memoryview)):
        return bytes(value)
    if isinstance(value, str):
        return value.encode("utf-8")
    return item_text(value).encode("utf-8")


# The one source core builds: bytes, or a string's UTF-8.
class BinaryMaker:
    def bytes(self, data, opts=None):
        return BinarySource(to_bytes(data), opts)


binary = BinaryMaker()


# The shortest text that reads back as the number, with an exponent only
# where JavaScript would write one.
def _number_text(f):
    if math.isnan(f) or math.isinf(f):
        return json.dumps(None)
    if f.is_integer() and abs(f) < 1e21:
        return str(int(f))
    text = repr(f)
    if "e" in text:
        mant, exp = text.split("e")
        sign = exp[0] if exp[0] in "+-" else "+"
        return mant + "e" + sign + exp.lstrip("+-").lstrip("0")
    return text


# A plain value as the text of a form pair or a multipart part.
def item_text(value):
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return _number_text(value)
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False, default=str)


# The values a form or multipart body carries, in wire order: the fields the
# model declares, in its order, then any other key of the data, in code point
# order. A list repeats its field per item, or is one value joined by the
# field's `join`; an absent or None value sends nothing.
def body_items(body, data, lifted):
    fields = body.get("fields") if isinstance(body, dict) else None
    fields = [f for f in (fields if isinstance(fields, list) else [])
              if isinstance(f, dict) and isinstance(f.get("name"), str)]
    declared = [f["name"] for f in fields]
    plain = data if isinstance(data, dict) else {}
    lifted = lifted if isinstance(lifted, dict) else {}

    names = []
    for name in declared:
        if (name in plain or name in lifted) and name not in names:
            names.append(name)
    names += sorted(k for k in plain if k not in declared)

    items = []
    for name in names:
        field = next((f for f in fields if f["name"] == name), {"name": name})
        value = lifted[name] if name in lifted else plain.get(name)
        file = field.get("binary") is True
        if value is None:
            continue
        if isinstance(value, (list, tuple)):
            present = [item for item in value if item is not None]
            if not file and isinstance(field.get("join"), str):
                items.append({"name": name, "field": field, "binary": file,
                              "value": field["join"].join(item_text(i) for i in present)})
            else:
                for item in present:
                    items.append({"name": name, "field": field, "value": item, "binary": file})
        else:
            items.append({"name": name, "field": field, "value": value, "binary": file})
    return items
