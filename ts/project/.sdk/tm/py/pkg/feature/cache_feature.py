# ProjectName SDK cache feature

from __future__ import annotations
import hashlib
import hmac
import re
import secrets
import time

from projectname_sdk.feature.base_feature import ProjectNameBaseFeature
from projectname_sdk.utility.media import header_value, is_json_media


SAFE_METHODS = ("GET", "HEAD")
UNSTORED = ("no-store", "private", "no-cache")
MAX_AGE = re.compile(r'^max-age\s*=\s*"?(\d+)"?$')


# Response caching for safe (read) requests, per client: see the features
# reference for the key, the write invalidation and the Cache-Control rules.
class ProjectNameCacheFeature(ProjectNameBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "cache"
        self.active = True
        self.client = None
        self.options = {}
        self.store = {}
        self.secret = b""

    def init(self, ctx, options):
        self.client = ctx.client
        self.options = options if isinstance(options, dict) else {}

        if self.options.get("active") is True:
            self.active = True
        else:
            self.active = False

        if not self.active:
            return

        self.store = {}
        self.secret = secrets.token_bytes(32)

        utility = ctx.utility
        inner = utility.fetcher

        def cache_fetcher(fctx, fullurl, fetchdef):
            return self._through(fctx, fullurl, fetchdef, inner)

        utility.fetcher = cache_fetcher

    def _through(self, ctx, url, fetchdef, inner):
        method = "GET"
        if isinstance(fetchdef, dict) and fetchdef.get("method") is not None:
            method = str(fetchdef.get("method")).upper()
        methods = self.options.get("methods") or ["GET"]

        if method not in methods:
            if method in SAFE_METHODS:
                return inner(ctx, url, fetchdef)
            try:
                return inner(ctx, url, fetchdef)
            finally:
                self._invalidate(url)

        headers = fetchdef.get("headers") if isinstance(fetchdef, dict) else None
        key = method + " " + url + " " + self._digest(headers)
        now = self._now()
        hit = self.store.get(key)

        if hit is not None and hit["expiry"] > now:
            self._track("hit")
            return self._replay(hit["snapshot"]), None

        res, err = inner(ctx, url, fetchdef)

        if err is None and self._cacheable(res):
            snapshot = self._snapshot(res)
            ttl = cache_lifetime(snapshot["headers"],
                                 5000 if self.options.get("ttl") is None else self.options.get("ttl"))
            if ttl <= 0:
                self._track("bypass")
                return self._replay(snapshot), None
            self.store.pop(key, None)
            self._evict()
            self.store[key] = {"expiry": now + ttl, "scope": url_scope(url), "snapshot": snapshot}
            self._track("miss")
            return self._replay(snapshot), None

        self._track("bypass")
        return res, err

    def _digest(self, headers):
        pairs = []
        if isinstance(headers, dict):
            for name, val in headers.items():
                if val is not None:
                    pairs.append((str(name).lower(), val if isinstance(val, str) else str(val)))
        text = "".join(name + ":" + val + "\n" for name, val in sorted(pairs))
        return hmac.new(self.secret, text.encode("utf-8"), hashlib.sha256).hexdigest()

    def _invalidate(self, url):
        path = url_scope(url)
        collection = url_parent(path)
        for key in [k for k, e in self.store.items()
                    if scope_under(e["scope"], path) or scope_under(e["scope"], collection)]:
            del self.store[key]

    # A body the transport could not read as JSON passes through, for the operation to report.
    def _cacheable(self, res):
        if not isinstance(res, dict) or res.get("unreadable") is True:
            return False
        status = res.get("status")
        if not isinstance(status, (int, float)) or isinstance(status, bool):
            return False
        return 200 <= status < 300 and self._json(res)

    # A body that declares another type than JSON passes by, unread.
    def _json(self, res):
        ctype = header_value(res.get("headers"), "content-type")
        return ctype == "" or is_json_media(ctype)

    def _snapshot(self, res):
        data = None
        json_func = res.get("json")
        if callable(json_func):
            try:
                data = json_func()
            except Exception:
                data = None
        headers = {}
        raw = res.get("headers")
        if isinstance(raw, dict):
            for key, val in raw.items():
                headers[str(key).lower()] = val
        return {
            "status": res.get("status"),
            "statusText": res.get("statusText"),
            "data": data,
            "headers": headers,
        }

    def _replay(self, snapshot):
        data = snapshot.get("data")
        return {
            "status": snapshot.get("status"),
            "statusText": snapshot.get("statusText"),
            "body": "not-used",
            "json": lambda: data,
            "headers": dict(snapshot.get("headers") or {}),
        }

    def _evict(self):
        mx = 256 if self.options.get("max") is None else self.options.get("max")
        while len(self.store) >= mx:
            oldest = next(iter(self.store), None)
            if oldest is None:
                break
            del self.store[oldest]

    def _now(self):
        now = self.options.get("now")
        if callable(now):
            return now()
        return time.time() * 1000

    def _track(self, kind):
        client = self.client
        track = getattr(client, "_cache", None)
        if track is None:
            track = {"hit": 0, "miss": 0, "bypass": 0}
            client._cache = track
        track[kind] += 1


# The configured ttl capped by the response's Cache-Control; zero when the
# response may not be stored.
def cache_lifetime(headers, ttl):
    control = ""
    for name, val in (headers or {}).items():
        if str(name).lower() == "cache-control":
            control = str(val)
    life = ttl
    for part in control.lower().split(","):
        directive = part.strip()
        if directive in UNSTORED:
            return 0
        age = MAX_AGE.match(directive)
        if age is not None:
            life = min(life, int(age.group(1)) * 1000)
    return life


def url_scope(url):
    return re.split(r"[?#]", str(url), maxsplit=1)[0].rstrip("/")


def url_parent(scope):
    scheme = scope.find("://")
    root = 0 if scheme < 0 else scope.find("/", scheme + 3)
    if root < 0:
        return scope
    cut = scope.rfind("/")
    return scope[:max(cut, root)]


def scope_under(scope, prefix):
    return scope == prefix or scope.startswith(prefix + "/")
