# ProjectName SDK codec test
#
# Every form, multipart and raw point this SDK has, driven through a real
# entity operation against a local listener that decodes what arrives. The
# cases come from the client's own config, so no case names an entity.

import http.server
import re
import threading
from urllib.parse import unquote_to_bytes

import pytest

from projectname_sdk import ProjectNameSDK


PROBE = ProjectNameSDK({"base": "http://127.0.0.1:1"})
CONFIG = PROBE.get_root_ctx().config

RAN = {"ran": 0, "failed": 0}


def _accessors(client):
    out = {}
    for attr in dir(client):
        if not attr[:1].isupper():
            continue
        acc = getattr(client, attr, None)
        if not callable(acc):
            continue
        try:
            ent = acc()
        except Exception:
            continue
        getname = getattr(ent, "get_name", None)
        if callable(getname) and getname() in (CONFIG.get("entity") or {}):
            out[getname()] = attr
    return out


# A value for each path parameter a point names.
def _params(point):
    out = {}
    for part in point.get("parts") or []:
        m = re.fullmatch(r"\{(.+)\}", str(part))
        if m is not None:
            out[m.group(1)] = "p1"
    return out


def _action(point):
    return (point.get("select") or {}).get("$action")


def _select(point):
    action = _action(point)
    return {} if action is None else {"$action": action}


def _content(name):
    return ("file:" + name + "\u0000ÿ\r\n--").encode("latin-1")


# The data a form or multipart point is sent, and the parts it must arrive as.
def _plan(client, body):
    data = {}
    expect = []
    form = "form" == body.get("kind")
    for field in body.get("fields") or []:
        name = field.get("name")
        if not isinstance(name, str):
            continue
        if field.get("binary") is True:
            mtype = None if form else (field.get("media") or "application/octet-stream")
            data[name] = client.binary.bytes(_content(name),
                                             {"name": "/local/dir/" + name + ".bin", "type": mtype})
            expect.append({"name": name, "value": _content(name)} if form else
                          {"name": name, "file": _content(name), "filename": name + ".bin",
                           "type": mtype})
        elif field.get("list") is True:
            data[name] = ["a", "b c"]
            expect += [{"name": name, "value": b"a"}, {"name": name, "value": b"b c"}]
        elif isinstance(field.get("join"), str):
            data[name] = ["a", "b"]
            expect.append({"name": name, "value": ("a" + field["join"] + "b").encode("utf-8")})
        else:
            data[name] = 'v"' + name + "\r\n"
            expect.append({"name": name, "value": ('v"' + name + "\r\n").encode("utf-8")})
    return data, expect


def _multipart(arrived):
    ctype = arrived["headers"].get("content-type", "")
    m = re.search(r"boundary=([^;]+)", ctype)
    assert m is not None, "no boundary in " + ctype
    boundary = m.group(1).encode("latin-1")
    body = arrived["body"]
    assert body.endswith(b"--" + boundary + b"--\r\n"), "the body does not close"
    parts = []
    for chunk in body.split(b"--" + boundary)[1:-1]:
        at = chunk.index(b"\r\n\r\n")
        head = chunk[2:at].decode("latin-1").replace("\r\n", "\n")
        content = chunk[at + 4:-2]
        disp = re.search(r'^Content-Disposition: form-data; name="([^"]*)"(?:; filename="([^"]*)")?$',
                         head, re.M)
        assert disp is not None, "a part without a disposition: " + repr(head)
        ctype = re.search(r"^Content-Type: (.*)$", head, re.M)
        if disp.group(2) is None:
            parts.append({"name": disp.group(1), "value": content})
        else:
            parts.append({"name": disp.group(1), "file": content, "filename": disp.group(2),
                          "type": None if ctype is None else ctype.group(1)})
    return parts


def _form(body):
    out = []
    for pair in [p for p in body.split(b"&") if p != b""]:
        name, _, value = pair.partition(b"=")
        out.append({"name": unquote_to_bytes(name.replace(b"+", b" ")).decode("utf-8"),
                    "value": unquote_to_bytes(value.replace(b"+", b" "))})
    return out


def _sent(got, expect):
    names = {e["name"] for e in expect}
    return [g for g in got if g["name"] in names]


def _op(ent, opname, args):
    return getattr(ent, opname)(args)


def _cases():
    out = []
    acc = _accessors(PROBE)
    entities = CONFIG.get("entity") or {}

    for ename in sorted(entities):
        accessor = acc.get(ename)
        if accessor is None:
            continue
        ops = entities[ename].get("op") or {}
        for opname in sorted(ops):
            for point in ops[opname].get("points") or []:
                label = ename + "." + opname + ("" if _action(point) is None else
                                                ":" + _action(point))
                rb = point.get("body") or {}
                rs = point.get("response") or {}
                writes = opname in ("create", "update", "patch")

                if rb.get("kind") in ("form", "multipart") and writes:
                    def run(client, net, accessor=accessor, opname=opname, point=point, rb=rb):
                        data, expect = _plan(client, rb)
                        net.answer("application/json", b'{"id":"p1"}')
                        _op(getattr(client, accessor)(), opname,
                            {**_params(point), **_select(point), **data})
                        arrived = net.arrived()
                        if "form" == rb["kind"]:
                            assert arrived["headers"].get("content-type") == rb.get("media")
                            assert _sent(_form(arrived["body"]), expect) == expect
                        else:
                            assert _sent(_multipart(arrived), expect) == expect
                    out.append((label + " sends a " + rb["kind"] + " body", run))

                if "raw" == rb.get("kind") and writes:
                    def run(client, net, accessor=accessor, opname=opname, point=point, rb=rb,
                            label=label):
                        net.answer("application/json", b'{"id":"p1"}')
                        ent = getattr(client, accessor)()
                        ent.data_set(_params(point))
                        ent.match_set(_params(point))
                        if rb.get("binary") is True:
                            got = ent.binary(*([] if _action(point) is None else [_action(point)])) \
                                .put(client.binary.bytes(_content(label), {"type": rb.get("media")}))
                            assert got is ent
                            assert net.arrived()["body"] == _content(label)
                        else:
                            text = 'text "' + label + '"\n'
                            _op(ent, opname, {**_select(point), "$body": text})
                            assert net.arrived()["body"].decode("utf-8") == text
                        assert net.arrived()["headers"].get("content-type") == rb.get("media")
                    kind = "binary" if rb.get("binary") is True else "text"
                    out.append((label + " sends a raw " + kind + " body", run))

                if "raw" == rs.get("kind") and "load" == opname:
                    def run(client, net, accessor=accessor, point=point, rs=rs, label=label):
                        ent = getattr(client, accessor)()
                        ent.data_set(_params(point))
                        ent.match_set(_params(point))
                        if rs.get("binary") is True:
                            net.answer(rs.get("media"), _content(label))
                            got = ent.binary(*([] if _action(point) is None else [_action(point)])) \
                                .bytes()
                            assert got == _content(label)
                            with pytest.raises(Exception) as refused:
                                ent.load({**_params(point), **_select(point)})
                            assert "binary_sink_required" == getattr(refused.value, "code", None)
                        else:
                            net.answer(rs.get("media"), ("café " + label).encode("utf-8"))
                            got = ent.load({**_params(point), **_select(point)})
                            assert got is ent
                            assert ent.data_get().get("$body") == "café " + label
                    kind = "binary" if rs.get("binary") is True else "text"
                    out.append((label + " reads a raw " + kind + " body", run))
    return out


CASES = _cases()


class _Net:
    def __init__(self):
        self.reply = {}
        self.arrivals = []

    def answer(self, mtype, body):
        self.reply = {"type": mtype, "body": body}

    def arrived(self):
        assert 0 < len(self.arrivals), "nothing arrived"
        return self.arrivals[-1]


NET = _Net()


class _Handler(http.server.BaseHTTPRequestHandler):
    def _any(self):
        length = int(self.headers.get("content-length") or 0)
        body = self.rfile.read(length) if 0 < length else b""
        NET.arrivals.append({"method": self.command, "url": self.path, "body": body,
                             "headers": {k.lower(): v for k, v in self.headers.items()}})
        reply = NET.reply.get("body") or b""
        self.send_response(NET.reply.get("status") or 200)
        self.send_header("content-type", NET.reply.get("type") or "application/json")
        self.send_header("content-length", str(len(reply)))
        self.end_headers()
        self.wfile.write(reply)

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = _any

    def log_message(self, *args):
        pass


@pytest.fixture(scope="module")
def base():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield "http://127.0.0.1:" + str(server.server_address[1])
    server.shutdown()
    server.server_close()
    print("codec: ran " + str(RAN["ran"]) + " case(s), " + str(RAN["failed"]) + " failed")


def test_this_sdk_has_a_point_to_drive():
    assert 0 < len(CASES), "no form, multipart or raw point was found"


@pytest.mark.parametrize("name,run", CASES, ids=[c[0] for c in CASES])
def test_codec(base, name, run):
    RAN["ran"] += 1
    NET.arrivals.clear()
    NET.reply = {}
    try:
        run(ProjectNameSDK({"base": base}), NET)
    except BaseException:
        RAN["failed"] += 1
        raise
