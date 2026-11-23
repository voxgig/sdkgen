# ProjectName SDK utility: fetcher

from __future__ import annotations
import json
import os
import re
import threading
from contextvars import ContextVar
from http.cookiejar import DefaultCookiePolicy
from urllib.parse import urljoin, urlsplit
from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.core.error import ProjectNameError


# Default User-Agent — many CDNs (notably Cloudflare) reject requests with
# a library's default UA, returning 403 before the request even reaches
# the origin. The project's agent (main.kit.http.useragent) is browser-shaped
# unless the model says otherwise. Users can still override by passing a
# User-Agent header in fetchdef.
_DEFAULT_USER_AGENT = "PROJECTUSERAGENT"


_SESSION = None
_SESSION_LOCK = threading.Lock()

_CREDENTIAL_HEADERS = ("authorization", "cookie", "proxy-authorization")

# The context of the request being sent, for the hops requests follows
# inside that one call.
_SENDING = ContextVar("sending", default=None)


# What another origin is not sent: the names every client drops, and
# whatever the SDK holds as a secret, by its name or by its value.
def _is_credential(ctx, name, value):
    if str(name).lower() in _CREDENTIAL_HEADERS:
        return True
    if isinstance(value, bytes):
        value = value.decode("latin-1")
    secret = getattr(getattr(ctx, "utility", None), "clean_secret", None)
    return callable(secret) and secret(ctx, name, value) is True


# Scheme, host and port; a URL that names no port is on its scheme's own.
def _origin_of(url):
    try:
        parts = urlsplit(url)
        return (parts.scheme, parts.hostname,
                parts.port or {"http": 80, "https": 443}.get(parts.scheme))
    except ValueError:
        return url


def _session():
    # Pool connections without retaining response cookies between calls.
    global _SESSION
    if _SESSION is None:
        import requests

        # requests rebuilds each hop from the one before it, without its
        # Cookie and, on a change of host or port, without its Authorization.
        class Session(requests.Session):
            # Another origin is sent no credential, under any name; the same
            # origin keeps the Cookie it was sent.
            def rebuild_auth(self, prepared_request, response):
                sent = response.request
                headers = prepared_request.headers
                if _origin_of(prepared_request.url) != _origin_of(sent.url):
                    ctx = _SENDING.get()
                    for name in list(headers):
                        if _is_credential(ctx, name, headers[name]):
                            del headers[name]
                elif "Cookie" in sent.headers:
                    headers.setdefault("Cookie", sent.headers["Cookie"])
                super().rebuild_auth(prepared_request, response)

            # A body is not sent on to another origin: the 3xx is the answer.
            def get_redirect_target(self, resp):
                target = super().get_redirect_target(resp)
                crosses = target is not None and \
                    _origin_of(urljoin(resp.url, target)) != _origin_of(resp.url)
                if crosses and resp.request.body is not None and resp.status_code in (307, 308):
                    return None
                return target

        with _SESSION_LOCK:
            if _SESSION is None:
                session = Session()
                session.max_redirects = 5
                session.cookies.set_policy(DefaultCookiePolicy(allowed_domains=[]))
                _SESSION = session
    return _SESSION


# Text as UTF-8, and bytes or a file object as they are.
def _request_data(body):
    if isinstance(body, str):
        return body.encode("utf-8")
    if isinstance(body, (bytearray, memoryview)):
        return bytes(body)
    if isinstance(body, bytes) or hasattr(body, "read"):
        return body
    return None


_GETONLY_ENV = "VOXGIG_GETONLY_GUARD"


# A GET-only live run refuses any other method before it is sent. The error
# names the path alone: the query can carry a credential.
def _getonly_refusal(fullurl, method):
    method = str(method or "GET").upper()
    if os.environ.get(_GETONLY_ENV) != "TRUE" or method == "GET":
        return None
    rest = fullurl
    if "://" in rest:
        rest = re.sub(r"^[^/?#]*", "", rest.split("://", 1)[1])
    path = re.split(r"[?#]", rest, maxsplit=1)[0] or "/"
    return ProjectNameError(
        "fetch_getonly_block", "[GET-ONLY GUARD] blocked " + method + " " + path)


def _default_http_fetch(fullurl, fetchdef, ctx=None):
    method = fetchdef.get("method", "GET")
    refused = _getonly_refusal(fullurl, method)
    if refused is not None:
        return None, refused
    headers = fetchdef.get("headers", {})

    data = _request_data(fetchdef.get("body"))

    req_headers = {}
    has_ua = False
    for k, v in headers.items():
        if k.lower() == "user-agent":
            has_ua = True
        req_headers[k] = v
    if not has_ua:
        req_headers["User-Agent"] = _DEFAULT_USER_AGENT
        headers["user-agent"] = _DEFAULT_USER_AGENT

    # Manual redirects: fetchdef["redirect"] == "manual" surfaces a 3xx as
    # an ordinary response instead of auto-following it, which would replay
    # the request, headers included, against whatever host Location names.
    # Set by the station feature's transport middleware under an egress
    # hosts policy (mirrors the ts fetch option).
    kwargs = {"allow_redirects": fetchdef.get("redirect") != "manual"}

    proxy = fetchdef.get("proxy")
    if isinstance(proxy, str) and proxy:
        kwargs["proxies"] = {"http": proxy, "https": proxy}

    timeout = fetchdef.get("timeout")
    if isinstance(timeout, (int, float)) and timeout > 0:
        kwargs["timeout"] = timeout

    sending = _SENDING.set(ctx)
    try:
        resp = _session().request(method, fullurl, data=data, headers=req_headers, **kwargs)
        # Bytes that are not text still reach the unreadable-body error.
        body = resp.content.decode("utf-8", errors="replace")
    except Exception as e:
        return None, str(e)
    finally:
        _SENDING.reset(sending)

    resp_headers = {}
    for k, v in resp.headers.items():
        resp_headers[k.lower()] = v

    json_body = None
    unreadable = False
    if body.strip():
        try:
            json_body = json.loads(body)
        except Exception:
            unreadable = True

    status = resp.status_code
    status_text = resp.reason or ("OK" if status < 400 else "Error")

    return {
        "status": status,
        "statusText": status_text,
        "headers": resp_headers,
        "json": lambda: json_body,
        "body": body,
        "unreadable": unreadable,
    }, None


def fetcher_util(ctx, fullurl, fetchdef):
    if ctx.client.mode != "live":
        return None, ctx.make_error("fetch_mode_block",
            'Request blocked by mode: "' + ctx.client.mode +
            '" (URL was: "' + fullurl + '")')

    options = ctx.client.options_map()
    if vs.getpath(options, "feature.test.active") is True:
        return None, ctx.make_error("fetch_test_block",
            'Request blocked as test feature is active'
            ' (URL was: "' + fullurl + '")')

    sys_fetch = vs.getpath(options, "system.fetch")

    if sys_fetch is None:
        return _default_http_fetch(fullurl, fetchdef, ctx)

    if callable(sys_fetch):
        return sys_fetch(fullurl, fetchdef)

    return None, ctx.make_error("fetch_invalid", "system.fetch is not a valid function")
